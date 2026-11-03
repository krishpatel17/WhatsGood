import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { loadManifest, loadTruth, manifestPredatesResults, TruthSchema, validateManifest } from "../src/validation/benchmark-set";
import { isReadable, parseSurvey } from "../src/validation/survey";

const ROOT = import.meta.dirname + "/../../";
const TRUTH_DIR = ROOT + "validation/a2-benchmark/truth/";

describe("US-18 Benchmark restaurant set and correct menus", () => {
  it("[ai] T1 unit: every correct-menu file validates against the menu schema", () => {
    const template = JSON.parse(readFileSync(TRUTH_DIR + "_template.json", "utf8"));
    expect(TruthSchema.safeParse(template).success).toBe(true);
    expect(TruthSchema.safeParse({ ...template, dishes: [{ name: "x", section: "", price: "12" }] }).success).toBe(false);
    expect(TruthSchema.safeParse({ ...template, copied_by: "" }).success).toBe(false);
    for (const f of readdirSync(TRUTH_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
      expect(TruthSchema.safeParse(JSON.parse(readFileSync(TRUTH_DIR + f, "utf8"))).success, f).toBe(true);
    }
    expect(loadTruth(ROOT, "no-such-restaurant")).toBeNull();
  });

  it("[ai] T2 unit: the restaurant manifest has 1 easy + 10 medium-hard entries, each with a tier, menu source type and review source", () => {
    const manifest = loadManifest(ROOT);
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.restaurants.filter((r) => r.tier === "easy")).toHaveLength(1);
    expect(manifest.restaurants.filter((r) => r.tier !== "easy")).toHaveLength(10);
    const broken = { ...manifest, restaurants: [...manifest.restaurants.slice(1), { ...manifest.restaurants[1], review_source: "" }] };
    expect(validateManifest(broken)).toEqual(expect.arrayContaining(["expected 1 easy restaurant, found 0", `${manifest.restaurants[1].id}: missing review_source`]));
  });

  it("[ai] T2b unit: the medium-hard set covers PDF, image-only, JavaScript ordering pages and long menus", () => {
    const types = new Set(loadManifest(ROOT).restaurants.filter((r) => r.tier !== "easy").map((r) => r.source_type));
    for (const t of ["pdf", "image-on-site", "ordering-page", "html"]) expect(types.has(t), t).toBe(true);
  });

  it("[ai] T3 unit: every medium-hard entry is marked readable in the US-23 survey", () => {
    const survey = new Map(parseSurvey(readFileSync(ROOT + "validation/a1-survey/survey.csv", "utf8")).map((r) => [r.id, r]));
    for (const r of loadManifest(ROOT).restaurants) {
      const row = survey.get(r.survey_id);
      expect(row, r.survey_id).toBeDefined();
      expect(isReadable(row!.source_type), r.survey_id).toBe(true);
      expect(r.source_type).toBe(row!.source_type);
    }
  });

  it("[ai] T4 unit: the manifest's commit timestamp predates the first benchmark result (checked in CI)", () => {
    const check = manifestPredatesResults("validation/a2-benchmark/manifest.json", "validation/a2-benchmark/results");
    expect(check.manifestCommittedAt, "manifest must be committed").not.toBeNull();
    if (check.firstResultAt !== null) expect(check.manifestCommittedAt!).toBeLessThan(check.firstResultAt);
  });
});
