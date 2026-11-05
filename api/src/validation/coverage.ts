// Node-only: A3, whether reviews mention specific dishes often enough to back picks with real quotes.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { type LlmPath, llmPath } from "../llm/select";
import type { Llm } from "../llm/types";
import { storeMenu } from "../menu/import";
import type { Dish } from "../menu/schema";
import { createRestaurant } from "../restaurants/repo";
import { fetchReviews } from "../reviews/collect";
import { extractMentions } from "../reviews/mentions";
import { DISH_MATCH_THRESHOLD, dishScore } from "../text/match";
import { loadManifest, loadTruth } from "./benchmark-set";
import { toCsv } from "./csv";
import { localDb } from "./localdb";
import type { A3Restaurant } from "./report";
import { mulberry32 } from "./stats";

export const ENOUGH = { dishes: 3, mentions: 3 };

/** Per-restaurant coverage: dishes with >= 1 / >= 3 / >= 10 matched mentions, and whether a full top 3 is possible. */
export function coverageRow(id: string, name: string, reviews: number, counts: Map<string, number>): A3Restaurant {
  const values = [...counts.values()];
  const atLeast = (n: number) => values.filter((v) => v >= n).length;
  return { id, name, reviews, atLeast1: atLeast(1), atLeast3: atLeast(3), atLeast10: atLeast(10), enough: atLeast(ENOUGH.mentions) >= ENOUGH.dishes };
}

type Mention = { source_id: string; dish: string };

/**
 * Extraction quality against the hand-labeled reviews. Only reviews in the labeled
 * sample count; a label with an empty dish marks a review that mentions none.
 */
export function precisionRecall(predicted: Mention[], labels: Mention[]) {
  const labeled = new Set(labels.map((l) => l.source_id));
  const truth = labels.filter((l) => l.dish);
  const used = new Set<number>();
  let tp = 0;
  let fp = 0;
  for (const p of predicted.filter((m) => labeled.has(m.source_id))) {
    const hit = truth.findIndex((t, i) => !used.has(i) && t.source_id === p.source_id && dishScore(t.dish, p.dish) >= DISH_MATCH_THRESHOLD);
    if (hit >= 0) {
      used.add(hit);
      tp += 1;
    } else fp += 1;
  }
  const fn = truth.length - used.size;
  return { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0 };
}

export function sampleForLabeling<T>(reviews: T[], k: number, seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...reviews];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

function latestA2Dishes(root: string, id: string): Dish[] | null {
  const dir = root + "validation/a2-benchmark/results/";
  if (!existsSync(dir)) return null;
  const latest = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().at(-1);
  if (!latest) return null;
  const r = JSON.parse(readFileSync(dir + latest, "utf8")).restaurants.find((x: { id: string }) => x.id === id);
  return r?.dishes?.length ? r.dishes : null;
}

export type CoverageResults = {
  model?: string;
  promptTag: string;
  llmPath: LlmPath;
  restaurants: A3Restaurant[];
  predictedMentions: { restaurant_id: string; source_id: string; dish: string }[];
};

/**
 * For each medium-hard benchmark restaurant: pull reviews (US-06), extract mentions
 * (US-07) against the hand-copied menu (or the imported one if none), and count coverage.
 */
export async function runCoverage(opts: { root: string; llm: Llm; fetch: typeof fetch; apifyToken?: string; promptTag: string; seed?: number }): Promise<CoverageResults> {
  const { root, llm, promptTag, seed = 20261104 } = opts;
  const db = localDb();
  const outDir = root + "validation/a3-coverage/";
  mkdirSync(outDir + "reviews", { recursive: true });
  const restaurants: A3Restaurant[] = [];
  const predictedMentions: CoverageResults["predictedMentions"] = [];
  const allReviews: { source_id: string; restaurant_id: string; text: string }[] = [];

  for (const r of loadManifest(root).restaurants.filter((x) => x.tier !== "easy")) {
    await createRestaurant(db, { id: r.id, name: r.name, address: "", mapsUrl: r.maps_url });
    const truth = loadTruth(root, r.id);
    const dishes: Dish[] = truth
      ? truth.dishes.map((d) => ({ ...d, description: null, tags: [] }))
      : (latestA2Dishes(root, r.id) ?? []);
    await storeMenu(db, { restaurantId: r.id, sourceUrl: r.menu_url, sourceType: r.source_type, snapshotKey: "", status: "active", attempts: 1, dishes });

    await fetchReviews({ db, fetch: opts.fetch, apifyToken: opts.apifyToken }, r.id);
    const { results: reviews } = await db.prepare("SELECT id, source_id, text, rating, date FROM reviews WHERE restaurant_id = ?").bind(r.id).all<{ id: string; source_id: string; text: string }>();
    writeFileSync(`${outDir}reviews/${r.id}.json`, JSON.stringify(reviews, null, 2));
    allReviews.push(...reviews.map((x) => ({ source_id: x.source_id, restaurant_id: r.id, text: x.text })));

    await extractMentions({ db, llm }, r.id);
    const { results: rows } = await db
      .prepare(
        `SELECT d.id AS dish_id, (SELECT COUNT(DISTINCT m.review_id) FROM mentions m WHERE m.dish_id = d.id) AS n
         FROM dishes d JOIN menus mn ON mn.id = d.menu_id WHERE mn.restaurant_id = ? AND mn.status = 'active'`,
      )
      .bind(r.id)
      .all<{ dish_id: string; n: number }>();
    restaurants.push(coverageRow(r.id, r.name, reviews.length, new Map(rows.map((x) => [x.dish_id, x.n]))));

    const { results: ms } = await db
      .prepare("SELECT rv.source_id, COALESCE(d.name, m.mention) AS dish FROM mentions m JOIN reviews rv ON rv.id = m.review_id LEFT JOIN dishes d ON d.id = m.dish_id WHERE m.restaurant_id = ? ORDER BY rv.source_id")
      .bind(r.id)
      .all<{ source_id: string; dish: string }>();
    predictedMentions.push(...ms.map((m) => ({ restaurant_id: r.id, ...m })));
  }

  const sample = sampleForLabeling(allReviews, 50, seed).map((r) => ({ ...r, dishes_mentioned: "", labeled_by: "" }));
  writeFileSync(outDir + "to-label.csv", toCsv(sample, ["source_id", "restaurant_id", "text", "dishes_mentioned", "labeled_by"]));
  const results: CoverageResults = { promptTag, ...(llm.model ? { model: llm.model } : {}), llmPath: llmPath(llm), restaurants, predictedMentions };
  writeFileSync(outDir + "results.json", JSON.stringify(results, null, 2));
  return results;
}
