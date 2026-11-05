// Node-only: the A2 benchmark restaurant set and its hand-copied correct menus.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { z } from "zod";
import { commitsTouching, commitTime } from "./history";

export const ManifestEntrySchema = z.object({
  id: z.string().min(1),
  survey_id: z.string().min(1),
  name: z.string().min(1),
  tier: z.enum(["easy", "medium", "hard"]),
  source_type: z.string(),
  menu_url: z.string(),
  why: z.string().optional(),
  review_source: z.string(),
  maps_url: z.string(),
});
export const ManifestSchema = z.object({ created: z.string(), rule: z.string(), restaurants: z.array(ManifestEntrySchema) });
export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

/** A hand-copied correct menu. Ingredient tags are not part of the answer key. */
export const TruthSchema = z.object({
  restaurant_id: z.string().min(1),
  copied_by: z.string().min(1),
  copied_on: z.string().min(1),
  source_url: z.string().min(1),
  dishes: z.array(z.object({ name: z.string().min(1), section: z.string(), price: z.number().nullable() })).min(1),
});
export type Truth = z.infer<typeof TruthSchema>;

export function loadManifest(root: string): Manifest {
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(root + "validation/a2-benchmark/manifest.json", "utf8")));
  if (new Set(manifest.restaurants.map((r) => r.id)).size !== manifest.restaurants.length) throw new Error("restaurant IDs must be unique");
  return manifest;
}

export function validateManifest(m: Manifest): string[] {
  const errors: string[] = [];
  if (new Set(m.restaurants.map((r) => r.id)).size !== m.restaurants.length) errors.push("restaurant IDs must be unique (duplicate IDs found)");
  const easy = m.restaurants.filter((r) => r.tier === "easy").length;
  const hard = m.restaurants.filter((r) => r.tier !== "easy").length;
  if (easy !== 1) errors.push(`expected 1 easy restaurant, found ${easy}`);
  if (hard !== 10) errors.push(`expected 10 medium-hard restaurants, found ${hard}`);
  for (const r of m.restaurants) {
    if (!r.source_type) errors.push(`${r.id}: missing source_type`);
    if (!r.review_source) errors.push(`${r.id}: missing review_source`);
    if (!r.menu_url) errors.push(`${r.id}: missing menu_url`);
  }
  return errors;
}

export function loadTruth(root: string, id: string): Truth | null {
  const path = `${root}validation/a2-benchmark/truth/${id}.json`;
  if (!existsSync(path)) return null;
  const truth = TruthSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (truth.restaurant_id !== id) throw new Error(`truth restaurant_id does not match ${id}`);
  return truth;
}

/** When the manifest and the first benchmark result were first committed (ms since epoch, null if never). */
export function manifestPredatesResults(manifestPath: string, resultsDir: string) {
  const manifestCommits = commitsTouching(manifestPath);
  const resultCommits = commitsTouching(resultsDir);
  return {
    manifestCommittedAt: manifestCommits.length ? commitTime(manifestCommits[0]) : null,
    firstResultAt: resultCommits.length ? commitTime(resultCommits[0]) : null,
  };
}

export function truthFiles(root: string): string[] {
  const dir = root + "validation/a2-benchmark/truth/";
  return readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
}
