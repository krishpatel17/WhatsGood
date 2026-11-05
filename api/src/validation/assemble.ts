// Node-only: gathers the A1-A3 data files in the repo into report inputs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { z } from "zod";
import { DishSchema } from "../menu/schema";
import { loadManifest, loadTruth, validateManifest, type Truth } from "./benchmark-set";
import { parseCsv } from "./csv";
import type { CoverageResults } from "./coverage";
import { precisionRecall } from "./coverage";
import type { A1Input, A2Input, A3Input } from "./report";
import type { BenchmarkResults } from "./runner";
import { isFoodDish } from "./food-only";
import { a2Passes, scoreMenu } from "./score";
import { clusterBootstrap } from "./stats";
import { isReadable, parseSurvey } from "./survey";

export function a1FromSurvey(root: string): A1Input | null {
  const path = root + "validation/a1-survey/survey.csv";
  if (!existsSync(path)) return null;
  const rows = parseSurvey(readFileSync(path, "utf8"));
  if (rows.some((r) => !r.source_type)) return null;
  const bySourceType: Record<string, number> = {};
  for (const r of rows) bySourceType[r.source_type] = (bySourceType[r.source_type] ?? 0) + 1;
  return { readable: rows.filter((r) => isReadable(r.source_type)).length, n: rows.length, bySourceType };
}

/** Scores benchmark results against the hand-copied menus. Only medium-hard restaurants with a correct menu count. */
export function scoreA2(results: BenchmarkResults, truths: Map<string, Truth>, names: Map<string, string>): A2Input {
  const score = (foodOnly: boolean) =>
    results.restaurants
    .filter((r) => r.tier !== "easy" && truths.has(r.id))
    .map((r) => {
      const keep = <T extends { name: string; section: string }>(ds: T[]) => (foodOnly ? ds.filter(isFoodDish) : ds);
      const truth = keep(truths.get(r.id)!.dishes).map((d) => ({ ...d, description: null, tags: [] }));
      const score = scoreMenu(keep(r.dishes), truth);
      const manualFixes = 0;
      return {
        id: r.id,
        name: names.get(r.id) ?? r.id,
        tier: r.tier,
        sourceType: r.sourceType,
        seconds: r.seconds,
        retries: r.retries,
        manualFixes,
        score,
        pass: r.status === "active" && a2Passes({ accuracy: score.accuracy, invented: score.invented, seconds: r.seconds, manualFixes }),
      };
    });
  const restaurants = score(false);
  const boot = clusterBootstrap(restaurants.map((r) => ({ correct: r.score.correct, total: r.score.truthCount })), { resamples: 10_000 });
  return { promptTag: results.promptTag, llmPath: results.llmPath, importer: results.importer ?? "v1", restaurants, foodOnly: score(true), bootstrap: { lo: boot.lo, hi: boot.hi } };
}

function latestJson<T>(dir: string): T | null {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((x) => x.endsWith(".json")).sort().at(-1);
  return f ? (JSON.parse(readFileSync(dir + f, "utf8")) as T) : null;
}

// Saved files are external inputs: a matching row count alone cannot prove completeness.
const count = z.number().int().nonnegative();
const benchmarkSchema = z.object({
  promptTag: z.string().min(1), model: z.string().min(1), startedAt: z.string(),
  llmPath: z.enum(["anthropic-api", "claude-login-bridge"]),
  restaurants: z.array(z.object({
    id: z.string().min(1), tier: z.enum(["easy", "medium", "hard"]), sourceType: z.string(),
    status: z.enum(["active", "needs_review", "failed"]), failure: z.string().nullable(),
    seconds: z.number().nonnegative(), retries: count, inputTokens: count, outputTokens: count,
    costUsd: z.number().nonnegative(), snapshot: z.string().nullable(), dishes: z.array(DishSchema),
  }).passthrough()),
}).passthrough();
const coverageSchema = z.object({
  promptTag: z.string().min(1), llmPath: z.enum(["anthropic-api", "claude-login-bridge"]),
  restaurants: z.array(z.object({id:z.string(),name:z.string(),reviews:count,atLeast1:count,atLeast3:count,atLeast10:count,enough:z.boolean()})),
  predictedMentions: z.array(z.object({restaurant_id:z.string(),source_id:z.string(),dish:z.string()})),
});
const sameIds = (actual: string[], expected: string[]) => new Set(actual).size === actual.length && actual.length === expected.length && actual.every((id) => expected.includes(id));

export function assembleInputs(root: string): { a1: A1Input | null; a2: A2Input | null; a3: A3Input | null } {
  const a1 = a1FromSurvey(root);

  let a2: A2Input | null = null;
  const saved = latestJson<unknown>(root + "validation/a2-benchmark/results/");
  const results = saved === null ? null : benchmarkSchema.parse(saved) as BenchmarkResults;
  if (results) {
    const manifest = loadManifest(root);
    if (validateManifest(manifest).length) return { a1, a2: null, a3: null };
    const truths = new Map(manifest.restaurants.map((r) => [r.id, loadTruth(root, r.id)] as const).filter((x): x is [string, Truth] => x[1] !== null));
    const scored = scoreA2(results, truths, new Map(manifest.restaurants.map((r) => [r.id, r.name])));
    // A2 needs all 10 medium-hard restaurants scored against a hand-copied menu.
    const expected = manifest.restaurants.filter((r) => r.tier !== "easy").map((r) => r.id);
    if (new Set(manifest.restaurants.map((r) => r.id)).size === manifest.restaurants.length
      && sameIds(results.restaurants.map((r) => r.id), manifest.restaurants.map((r) => r.id))
      && sameIds(scored.restaurants.map((r) => r.id), expected)) a2 = scored;
  }

  let a3: A3Input | null = null;
  const covPath = root + "validation/a3-coverage/results.json";
  if (existsSync(covPath)) {
    const cov = coverageSchema.parse(JSON.parse(readFileSync(covPath, "utf8"))) as CoverageResults;
    const manifest = loadManifest(root);
    if (validateManifest(manifest).length) return { a1, a2: null, a3: null };
    const expected = manifest.restaurants.filter((r) => r.tier !== "easy").map((r) => r.id);
    if (!sameIds(cov.restaurants.map((r) => r.id), expected) || (results && results.promptTag !== cov.promptTag)) return { a1, a2, a3: null };
    const labelsPath = root + "validation/a3-coverage/labels.csv";
    let precision: number | null = null;
    let recall: number | null = null;
    if (existsSync(labelsPath)) {
      const labels = parseCsv(readFileSync(labelsPath, "utf8")).flatMap((r) => {
        const dishes = r.dishes_mentioned.split(";").map((s) => s.trim()).filter(Boolean);
        return dishes.length ? dishes.map((dish) => ({ source_id: r.source_id, dish })) : [{ source_id: r.source_id, dish: "" }];
      });
      ({ precision, recall } = precisionRecall(cov.predictedMentions, labels));
    }
    a3 = { promptTag: cov.promptTag, llmPath: cov.llmPath, restaurants: cov.restaurants, precision, recall };
  }
  return { a1, a2, a3 };
}
