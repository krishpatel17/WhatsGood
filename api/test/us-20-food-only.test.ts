import { describe, expect, it } from "vitest";
import { scoreA2 } from "../src/validation/assemble";
import { isFoodDish } from "../src/validation/food-only";
import { buildReport } from "../src/validation/report";

const out = (name: string, section: string, price: number | null) => ({ name, section, price, description: null, tags: [] });
const key = (name: string, section: string, price: number | null) => ({ name, section, price });

describe("US-20 report: exploratory food-only A2 score (added after the v4 run)", () => {
  it("[ai] AC7 unit: drinks, sauces and toppings are recognised by section or by item name", () => {
    for (const [name, section] of [
      ["VIOGNIER", "WHITES"],
      ["Orange", "Beverages (No Refills)"],
      ["Herb Butter", "TOPPINGS"],
      ["Mimosas", "Happy Hour"],
      ["Minute Maid Juice", "Quench Your Thirst"],
      ["Dressing and sauces 2oz", "Sides, Limited Release Gear, and Other Goodies"],
    ]) expect(isFoodDish({ name, section }), name).toBe(false);
    for (const [name, section] of [
      ["Chicken Marsala", "HOUSE SPECIALTIES"],
      ["Greek Salad", "Salads"],
      ["Seasonal Catch", "SIMPLY WOOD GRILLED"],
      ["Sesame Noodles", "Noodles"],
      ["Barbecue Ribs", "Mains"], // "bar" only as a whole word
      ["Maine Root", "Quench Your Thirst"], // no generic drink word: counted as food
    ]) expect(isFoodDish({ name, section }), name).toBe(true);
  });

  it("[ai] AC7 unit: the food-only score leaves drinks out of both the key and the import, and the official score is unchanged", () => {
    const truth = { restaurant_id: "aa", copied_by: "T", copied_on: "x", source_url: "x", dishes: [key("Dan Dan Noodles", "Noodles", 14), key("VIOGNIER - Eastwood Farm", "Virginia Wines - WHITES", 12)] };
    const results = { promptTag: "t", model: "m", startedAt: "x", restaurants: [{ id: "aa", tier: "hard", sourceType: "pdf", status: "active", failure: null, seconds: 30, retries: 0, inputTokens: 1, outputTokens: 1, costUsd: 0, snapshot: null, dishes: [out("Dan Dan Noodles", "Noodles", 14), out("VIOGNIER", "WHITES", 12)] }] };
    const a2 = scoreA2(results as never, new Map([["aa", truth]]), new Map([["aa", "AA"]]));
    expect(a2.restaurants[0].pass).toBe(false); // pre-registered: the wine name doesn't match
    expect(a2.foodOnly![0]).toMatchObject({ pass: true, score: { truthCount: 1, invented: 0, missed: 0 } });
  });

  it("[ai] AC7 unit: the report shows the food-only score as exploratory, after the official result, without changing the verdict", () => {
    const row = (pass: boolean) => ({ id: "aa", name: "AA", tier: "hard", sourceType: "pdf", seconds: 1, retries: 0, manualFixes: 0, pass, score: { truthCount: 1, extractedCount: 1, correct: 1, wrongPrice: 0, invented: 0, missed: 0, accuracy: 1, inventedNames: [], missedNames: [], wrongPriceNames: [] } });
    const a2 = { promptTag: "t", importer: "v4", restaurants: [row(false)], foodOnly: [row(true)], bootstrap: { lo: 0, hi: 0 } };
    const md = buildReport({ a1: null, a2, a3: null });
    expect(md).toContain("A2 Import works: FAIL");
    expect(md).toContain("### Exploratory, not the pre-registered test: food dishes only");
    expect(md).toContain("1/1 restaurants pass when drinks, sauces and toppings are left out");
    expect(md.indexOf("### Exploratory")).toBeGreaterThan(md.indexOf("## A2"));
  });
});
