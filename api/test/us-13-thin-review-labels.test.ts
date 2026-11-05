import { describe, expect, it } from "vitest";
import { labelsFor, planPicks, FEW_REVIEWS_THRESHOLD } from "../src/recommend/plan";
import type { MenuDish } from "../src/recommend/types";
import type { Evidence } from "../src/guardrails/evidence";

const dish = (id: string): MenuDish => ({ id, name: `Dish ${id}`, section: "Mains", price: 10, description: null, tags: [] });
const ev = (counts: Record<string, [number, number]>): Evidence => ({
  reviews: new Map([["rv", "text"]]),
  byDish: new Map(Object.entries(counts).map(([id, [count, avgSentiment]]) => [id, { count, avgSentiment, reviewIds: new Set(["rv"]) }])),
});
const noReviews: Evidence = { reviews: new Map(), byDish: new Map() };

describe("US-13 Label picks when reviews are thin", () => {
  it("[ai] T1 unit: 2 mentions -> labeled; 3 mentions -> not labeled", () => {
    expect(FEW_REVIEWS_THRESHOLD).toBe(3);
    expect(labelsFor(2, "reviews")).toEqual(["few_reviews"]);
    expect(labelsFor(3, "reviews")).toEqual([]);
    expect(labelsFor(0, "menu_only")).toEqual(["menu_only"]);
  });

  it("[manual] US13-R01 planning: one eligible dish sets maxPicks=1 and an explanation", () => {
    const plan = planPicks([dish("a")], ev({ a: [5, 0.8] }));
    expect(plan.maxPicks).toBe(1);
    expect(plan.mode).toBe("reviews");
    expect(plan.explanation).toBe("Only 1 dish on this menu fits your profile.");
  });

  it("[ai] AC2 unit: when fewer than 3 dishes have positive review evidence, show only those and say why", () => {
    const plan = planPicks([dish("a"), dish("b"), dish("c"), dish("d")], ev({ a: [4, 0.9], b: [1, 0.5], c: [6, -0.4] }));
    expect(plan).toEqual({
      mode: "reviews",
      maxPicks: 2,
      candidates: ["a", "b"],
      explanation: "Only 2 dishes that fit your profile have positive reviews.",
    });
  });

  it("[ai] AC2 unit: 3 or more backed dishes give a full top 3 with no explanation", () => {
    const plan = planPicks([dish("a"), dish("b"), dish("c"), dish("d")], ev({ a: [4, 0.9], b: [3, 0.5], c: [6, 0.4], d: [1, 0.2] }));
    expect(plan).toMatchObject({ mode: "reviews", maxPicks: 3, explanation: null });
    expect(plan.candidates).toHaveLength(4);
  });

  it("[ai] T3 unit: a menu with no reviews gives labeled menu-only picks", () => {
    const plan = planPicks([dish("a"), dish("b"), dish("c"), dish("d")], noReviews);
    expect(plan).toEqual({
      mode: "menu_only",
      maxPicks: 3,
      candidates: ["a", "b", "c", "d"],
      explanation: "No reviews mention dishes here yet, so these picks are based on the menu only.",
    });
  });

  it("[ai] AC2 unit: nothing fits the profile -> no picks and a reason", () => {
    expect(planPicks([], ev({}))).toEqual({ mode: "reviews", maxPicks: 0, candidates: [], explanation: "No dishes on this menu fit your profile." });
  });
});
