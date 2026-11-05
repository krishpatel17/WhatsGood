import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { coverageRow, precisionRecall, runCoverage, sampleForLabeling } from "../src/validation/coverage";
import { mockLlm } from "./helpers/llm";
import type { LlmRequest } from "../src/llm/types";
import { apifyItems } from "./fixtures/apify-reviews";
import { easyMenu } from "./fixtures/menus";

describe("US-24 Review dish-coverage measurement (A3)", () => {
  it("[ai] T1 unit: coverage counter computes the >= 1 / >= 3 / >= 10 buckets on a fixture", () => {
    const counts = new Map([
      ["a", 12],
      ["b", 3],
      ["c", 2],
      ["d", 1],
      ["e", 0],
    ]);
    expect(coverageRow("r1", "R One", 40, counts)).toEqual({ id: "r1", name: "R One", reviews: 40, atLeast1: 4, atLeast3: 2, atLeast10: 1, enough: false });
  });

  it("[ai] T2 unit: 'enough' is true with 3 dishes at 3 mentions and false with 2", () => {
    expect(coverageRow("r", "R", 10, new Map([["a", 3], ["b", 3], ["c", 3]])).enough).toBe(true);
    expect(coverageRow("r", "R", 10, new Map([["a", 3], ["b", 3], ["c", 2]])).enough).toBe(false);
  });

  it("[ai] T3 unit: precision/recall against a hand-labeled fixture match hand-computed values", () => {
    const labels = [
      { source_id: "g1", dish: "Dan Dan Noodles" },
      { source_id: "g1", dish: "Pork Dumplings" },
      { source_id: "g2", dish: "Cumin Lamb Noodles" },
      { source_id: "g3", dish: "" }, // labeled: no dish mentioned
    ];
    const predicted = [
      { source_id: "g1", dish: "dan dan noodles" }, // TP
      { source_id: "g2", dish: "Cumin Lamb Noodles (Spicy)" }, // TP (fuzzy)
      { source_id: "g3", dish: "Pork Dumplings" }, // FP
      { source_id: "g9", dish: "Pork Dumplings" }, // not in the labeled sample: ignored
    ];
    // TP = 2, FP = 1, FN = 1 (g1 Pork Dumplings) -> precision 2/3, recall 2/3.
    const pr = precisionRecall(predicted, labels);
    expect(pr).toEqual({ tp: 2, fp: 1, fn: 1, precision: 2 / 3, recall: 2 / 3 });
  });

  it("[ai] AC3 unit: the labeling sample is a seeded random 50 reviews", () => {
    const reviews = Array.from({ length: 200 }, (_, i) => ({ source_id: `g${i}`, restaurant_id: "r", text: `review ${i}` }));
    const a = sampleForLabeling(reviews, 50, 7);
    expect(a).toHaveLength(50);
    expect(new Set(a.map((r) => r.source_id)).size).toBe(50);
    expect(sampleForLabeling(reviews, 50, 7)).toEqual(a);
    expect(sampleForLabeling(reviews, 50, 8)).not.toEqual(a);
  });

  describe("runner", () => {
    let root: string;
    beforeEach(() => {
      root = mkdtempSync(tmpdir() + "/cov-") + "/";
      mkdirSync(root + "validation/a2-benchmark/truth", { recursive: true });
      const entry = (id: string, tier: string) => ({ id, survey_id: id.toUpperCase(), name: `Restaurant ${id}`, tier, source_type: "html", menu_url: `https://${id}.example`, review_source: "google-maps", maps_url: `https://maps.example/${id}` });
      writeFileSync(root + "validation/a2-benchmark/manifest.json", JSON.stringify({ created: "x", rule: "x", restaurants: [entry("ez", "easy"), entry("aa", "medium"), entry("bb", "hard")] }));
      for (const id of ["aa", "bb"]) {
        writeFileSync(
          root + `validation/a2-benchmark/truth/${id}.json`,
          JSON.stringify({ restaurant_id: id, copied_by: "Test", copied_on: "2026-11-04", source_url: "x", dishes: easyMenu.dishes.map((d) => ({ name: d.name, section: d.section, price: d.price })) }),
        );
      }
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("[manual] A3-R01 repeated extraction spans from one review cannot satisfy three-review coverage", async () => {
      const extract = (req: LlmRequest) => {
        const ids = [...JSON.stringify(req.messages).matchAll(/\[review ([\w-]+)\] The dan dan/g)].map((m) => m[1]);
        return { mentions: ids.flatMap((review_id) => Array.from({ length: 3 }, () => ({ review_id, dish: "Dan Dan Noodles", sentiment: 0.8, quote: "The dan dan noodles are great" }))) };
      };
      const fetcher = (async () => Response.json(apifyItems)) as typeof fetch;
      const out = await runCoverage({ root, llm: mockLlm([extract, extract]), fetch: fetcher, apifyToken: "t", promptTag: "prompts-test" });
      for (const restaurant of out.restaurants) {
        expect(restaurant).toMatchObject({ atLeast1: 1, atLeast3: 0, atLeast10: 0, enough: false });
      }
    });

    it("[ai] T4 integration: run over 2 fixture restaurants (mocked LLM) writes the results file US-20 expects", async () => {
      const apify = (async () => Response.json(apifyItems)) as unknown as typeof fetch;
      const extract = (req: LlmRequest) => {
        const ids = [...JSON.stringify(req.messages).matchAll(/\[review ([\w-]+)\] The dan dan/g)].map((m) => m[1]);
        return { mentions: ids.map((review_id) => ({ review_id, dish: "Dan Dan Noodles", sentiment: 0.8, quote: "The dan dan noodles are great" })) };
      };
      const out = await runCoverage({ root, llm: mockLlm([extract, extract]), fetch: apify, apifyToken: "t", promptTag: "prompts-test", seed: 1 });
      const saved = JSON.parse(readFileSync(root + "validation/a3-coverage/results.json", "utf8"));
      expect(saved).toEqual(out);
      expect(saved.promptTag).toBe("prompts-test");
      expect(saved.restaurants.map((r: { id: string }) => r.id)).toEqual(["aa", "bb"]);
      expect(saved.restaurants[0]).toEqual({ id: "aa", name: "Restaurant aa", reviews: 3, atLeast1: 1, atLeast3: 0, atLeast10: 0, enough: false });
      expect(saved.predictedMentions[0]).toMatchObject({ restaurant_id: "aa", source_id: "google:g-001", dish: "Dan Dan Noodles" });
      const toLabel = readFileSync(root + "validation/a3-coverage/to-label.csv", "utf8");
      expect(toLabel.split("\n")[0]).toBe("source_id,restaurant_id,text,dishes_mentioned,labeled_by");
      expect(toLabel.trim().split("\n")).toHaveLength(1 + 6);
    });
  });
});
