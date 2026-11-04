import { describe, expect, it } from "vitest";
import { clopperPearson, clusterBootstrap, mulberry32 } from "../src/validation/stats";
import { a2Passes, scoreMenu, A2_LIMITS } from "../src/validation/score";
import { judgeA1, judgeA2, judgeA3, verdict } from "../src/validation/verdict";
import { buildReport } from "../src/validation/report";
import type { Dish } from "../src/menu/schema";

const d = (name: string, price: number | null): Dish => ({ name, section: "", price, description: null, tags: [] });

describe("US-20 Validation scoring and report (A1-A3 verdict)", () => {
  it("[ai] T1 unit: dish matcher counts correct, invented and missed dishes on a hand-made fixture", () => {
    const truth = [d("Dan Dan Noodles", 14), d("Pork Dumplings", 9), d("Garlic Bok Choy", 12), d("Soup of the Day", null)];
    const extracted = [d("Dandan Noodles", 14), d("Pork Dumplings", 10), d("Soup of the day", null), d("Kung Pao Chicken", 15)];
    const s = scoreMenu(extracted, truth);
    expect(s).toMatchObject({ truthCount: 4, correct: 2, wrongPrice: 1, invented: 1, missed: 1 });
    expect(s.accuracy).toBe(0.5);
    expect(s.inventedNames).toEqual(["Kung Pao Chicken"]);
    expect(s.missedNames).toEqual(["Garlic Bok Choy"]);
  });

  it("[ai] T2 unit: A2 pass/fail rule - 95% correct passes, 94% fails; 1 invented dish fails; 121 s fails", () => {
    const base = { accuracy: 0.95, invented: 0, seconds: 60, manualFixes: 0 };
    expect(A2_LIMITS).toEqual({ minAccuracy: 0.95, maxInvented: 0, maxSeconds: 120 });
    expect(a2Passes(base)).toBe(true);
    expect(a2Passes({ ...base, accuracy: 0.94 })).toBe(false);
    expect(a2Passes({ ...base, invented: 1 })).toBe(false);
    expect(a2Passes({ ...base, seconds: 121 })).toBe(false);
    expect(a2Passes({ ...base, seconds: 119.9 })).toBe(true);
    expect(a2Passes({ ...base, manualFixes: 1 })).toBe(false);
  });

  it("[ai] T3 unit: Clopper-Pearson for 8/10 returns [0.444, 0.975] and for 24/30 returns [0.614, 0.923] (+-0.001)", () => {
    const [lo1, hi1] = clopperPearson(8, 10);
    expect(lo1).toBeCloseTo(0.444, 3);
    expect(hi1).toBeCloseTo(0.975, 3);
    const [lo2, hi2] = clopperPearson(24, 30);
    expect(lo2).toBeCloseTo(0.614, 3);
    expect(hi2).toBeCloseTo(0.923, 3);
    expect(clopperPearson(0, 10)[0]).toBe(0);
    expect(clopperPearson(10, 10)[1]).toBe(1);
  });

  it("[ai] T4 unit: bootstrap with a fixed seed is reproducible and resamples whole restaurants", () => {
    const restaurants = [
      { correct: 100, total: 100 },
      { correct: 0, total: 10 },
    ];
    const a = clusterBootstrap(restaurants, { resamples: 2000, seed: 42 });
    const b = clusterBootstrap(restaurants, { resamples: 2000, seed: 42 });
    expect(a).toEqual(b);
    // Whole-restaurant resampling of these two can only pool to 0, 100/110 or 1.
    const allowed = [0, 100 / 110, 1];
    for (const v of a.samples) expect(allowed.some((x) => Math.abs(x - v) < 1e-12)).toBe(true);
    expect(a.lo).toBe(0);
    expect(a.hi).toBe(1);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("[ai] T5 unit: A1 passes at 24/30 and fails at 23/30; A3 passes at 8/10 and fails at 7/10", () => {
    expect(judgeA1(24, 30).pass).toBe(true);
    expect(judgeA1(23, 30).pass).toBe(false);
    expect(judgeA3(8, 10).pass).toBe(true);
    expect(judgeA3(7, 10).pass).toBe(false);
  });

  it("[ai] AC1 unit: A2 needs 8/10 restaurants and a bootstrap lower bound >= 90%", () => {
    expect(judgeA2({ passed: 8, n: 10, bootstrapLo: 0.91 }).pass).toBe(true);
    expect(judgeA2({ passed: 8, n: 10, bootstrapLo: 0.89 }).pass).toBe(false);
    expect(judgeA2({ passed: 7, n: 10, bootstrapLo: 0.99 }).pass).toBe(false);
  });

  it("[ai] T6 unit: verdict is Validated only when A1, A2 and A3 all pass, and names the failed assumption otherwise", () => {
    const pass = { pass: true, summary: "" };
    const fail = { pass: false, summary: "" };
    expect(verdict({ a1: pass, a2: pass, a3: pass })).toMatchObject({ outcome: "Validated", failed: [] });
    const v = verdict({ a1: pass, a2: fail, a3: pass });
    expect(v.outcome).toBe("Invalidated");
    expect(v.failed).toEqual(["A2"]);
    expect(v.pivots[0]).toMatch(/narrow import/i);
    expect(verdict({ a1: pass, a2: null, a3: pass })).toMatchObject({ outcome: "Pending", pending: ["A2"] });
  });

  it("[ai] AC4/AC5/AC7 unit: the report states every count with its interval and the verdict", () => {
    const md = buildReport({ a1: { readable: 25, n: 30, bySourceType: { html: 9, pdf: 3, "ordering-page": 12, "image-on-site": 1, "third-party-only": 5 } }, a2: null, a3: null });
    expect(md).toContain("25/30");
    expect(md).toMatch(/95% CI \[0\.65\d, 0\.94\d\]/);
    expect(md).toContain("A1 Sources exist: PASS");
    expect(md).toContain("A2 Import works: NOT RUN YET");
    expect(md).toContain("Verdict: Pending");
  });
});

describe("US-20 report from the repository's data files", () => {
  it("[ai] AC7 integration: the report reads the real A1 survey and marks A2/A3 pending until their results exist", async () => {
    const { assembleInputs } = await import("../src/validation/assemble");
    const inputs = assembleInputs(import.meta.dirname + "/../../");
    expect(inputs.a1).toMatchObject({ readable: 25, n: 30 });
    const md = buildReport(inputs);
    expect(md).toContain("A1 Sources exist: PASS");
  }, 30_000); // scores the real benchmark data, which takes a few seconds on CI

  it("[ai] AC1/AC6 unit: A2 results are scored against the hand-copied menus", async () => {
    const { scoreA2 } = await import("../src/validation/assemble");
    const truth = { restaurant_id: "aa", copied_by: "T", copied_on: "x", source_url: "x", dishes: [{ name: "Dan Dan Noodles", section: "", price: 14 }] };
    const results = { promptTag: "t", model: "m", startedAt: "x", restaurants: [{ id: "aa", tier: "hard", sourceType: "pdf", status: "active", failure: null, seconds: 30, retries: 1, inputTokens: 1, outputTokens: 1, costUsd: 0, snapshot: null, dishes: [d("Dan Dan Noodles", 14)] }] };
    const a2 = scoreA2(results as never, new Map([["aa", truth]]), new Map([["aa", "Restaurant AA"]]));
    expect(a2.restaurants[0]).toMatchObject({ name: "Restaurant AA", pass: true, retries: 1 });
    expect(a2.restaurants[0].score.accuracy).toBe(1);
    expect(a2.bootstrap.lo).toBe(1);
  });
});

describe("US-20 report: which importer ran", () => {
  it("[ai] AC7 unit: the A2 section names the importer version, so v1 and v2 runs can't be confused", () => {
    const a2 = { promptTag: "t", importer: "v2-render", restaurants: [], bootstrap: { lo: 0, hi: 0 } };
    expect(buildReport({ a1: null, a2, a3: null })).toContain("Importer: v2 (JavaScript pages rendered in a local browser before import)");
    expect(buildReport({ a1: null, a2: { ...a2, importer: "v1" }, a3: null })).toContain("Importer: v1 (plain download)");
    expect(buildReport({ a1: null, a2: { ...a2, importer: "v3" }, a3: null })).toContain("Importer: v3 (v2 plus add-ons such as \"Extra sauce\" left out, by the answer keys' rule)");
  });
});
