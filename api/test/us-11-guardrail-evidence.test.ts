import { beforeEach, describe, expect, it } from "vitest";
import { checkEvidence, loadEvidence, type Evidence } from "../src/guardrails/evidence";
import type { MenuDish } from "../src/recommend/types";
import { testDb } from "./helpers/db";
import { seedRestaurant } from "./helpers/seed";

const danDan: MenuDish = { id: "d1", name: "Dan Dan Noodles", section: "Noodles", price: 14, description: null, tags: [] };
const dumplings: MenuDish = { id: "d2", name: "Pork Dumplings", section: "Dumplings", price: 9, description: null, tags: [] };

const evidence: Evidence = {
  reviews: new Map([
    ["rv1", "The dan dan noodles are great but skip the pork dumplings, they were soggy."],
    ["rv2", "Best dan dan noodles in town, numbing and rich."],
    ["rv3", "Nice patio, friendly staff and great noodles."],
  ]),
  byDish: new Map([
    ["d1", { count: 2, avgSentiment: 0.9, reviewIds: new Set(["rv1", "rv2"]) }],
    ["d2", { count: 1, avgSentiment: -0.7, reviewIds: new Set(["rv1"]) }],
  ]),
};
const pick = (dish: string, quotes: string[], mention_count: number) => ({ dish, reason: "Reviewers love it.", quotes, mention_count });

describe("US-11 Guardrail: quotes and counts are real", () => {
  it("[ai] T1 unit: verbatim quote passes; a one-word change fails", () => {
    expect(checkEvidence([pick("Dan Dan Noodles", ["Best dan dan noodles in town"], 2)], [danDan], evidence)).toEqual([]);
    expect(checkEvidence([pick("Dan Dan Noodles", ["Best dan dan noodles in Charlottesville"], 2)], [danDan], evidence)).toEqual([
      "item[0].quotes[0] quote not found in reviews for this restaurant",
    ]);
  });

  it("[ai] T2 unit: a real quote from a review that doesn't mention the dish fails", () => {
    expect(checkEvidence([pick("Dan Dan Noodles", ["friendly staff and great noodles"], 2)], [danDan], evidence)).toEqual([
      'item[0].quotes[0] quote comes from a review that does not mention "Dan Dan Noodles"',
    ]);
  });

  it("[ai] T3 unit: a count off by one fails", () => {
    expect(checkEvidence([pick("Pork Dumplings", ["skip the pork dumplings"], 2)], [dumplings], evidence)).toEqual([
      'item[0] "Pork Dumplings" mention_count 2 does not match database count 1',
    ]);
    expect(checkEvidence([pick("Pork Dumplings", ["skip the pork dumplings"], 1)], [dumplings], evidence)).toEqual([]);
  });

  it("[ai] AC1 unit: a dish with mentions needs at least one quote; a dish with none needs count 0", () => {
    expect(checkEvidence([pick("Dan Dan Noodles", [], 2)], [danDan], evidence)).toEqual(['item[0] "Dan Dan Noodles" has no review quote']);
    const lamb: MenuDish = { ...danDan, id: "d9", name: "Cumin Lamb Noodles" };
    expect(checkEvidence([pick("Cumin Lamb Noodles", [], 0)], [lamb], evidence)).toEqual([]);
    expect(checkEvidence([pick("Cumin Lamb Noodles", [], 5)], [lamb], evidence)).toEqual(['item[0] "Cumin Lamb Noodles" mention_count 5 does not match database count 0']);
  });

  describe("loading evidence from the database", () => {
    let db: ReturnType<typeof testDb>;
    beforeEach(() => {
      db = testDb();
    });

    it("[ai] AC2 integration: counts and mentioning reviews come from the stored mentions of this restaurant only", async () => {
      const seed = await seedRestaurant(db);
      const other = await seedRestaurant(db, "r2");
      const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, ?, ?, ?, 'x', ?, 'q', 1)");
      insert.run("m1", "r1", seed.reviewId("google:1"), seed.dishId("Dan Dan Noodles"), 0.8);
      insert.run("m2", "r1", seed.reviewId("google:3"), seed.dishId("Dan Dan Noodles"), 1);
      insert.run("m3", "r2", other.reviewId("google:4"), other.dishId("Dan Dan Noodles"), 0.6);
      const ev = await loadEvidence(db, "r1");
      expect(ev.reviews.size).toBe(5);
      expect(ev.byDish.get(seed.dishId("Dan Dan Noodles"))).toEqual({
        count: 2,
        avgSentiment: 0.9,
        reviewIds: new Set([seed.reviewId("google:1"), seed.reviewId("google:3")]),
      });
      expect(ev.byDish.has(other.dishId("Dan Dan Noodles"))).toBe(false);
    });
  });
});
