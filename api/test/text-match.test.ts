// Shared fuzzy matcher used by US-02 (search), US-07 (mentions) and US-09 (menu guardrail).
import { describe, expect, it } from "vitest";
import { dishScore, normalize, similarity } from "../src/text/match";

describe("text matching helpers", () => {
  it("[ai] normalize lowercases, strips accents, punctuation and possessives", () => {
    expect(normalize("Bodo's  Bagels!")).toBe("bodos bagels");
    expect(normalize("Crème Brûlée")).toBe("creme brulee");
  });

  it("[ai] similarity is 1 for equal strings and 0 against an empty string", () => {
    expect(similarity("abc", "abc")).toBe(1);
    expect(similarity("abc", "")).toBe(0);
    expect(similarity("kitten", "sitting")).toBeCloseTo(1 - 3 / 7, 5);
  });

  it("[ai] dishScore ignores word order, spacing and plural forms", () => {
    expect(dishScore("Spicy Cumin Lamb Noodles", "Cumin Lamb Noodles (Spicy)")).toBeGreaterThanOrEqual(0.9);
    expect(dishScore("dan dan noodles", "Dandan Mian")).toBeGreaterThanOrEqual(0.9);
    expect(dishScore("pork dumpling", "Pork Dumplings")).toBe(1);
  });

  it("[ai] dishScore ignores a bracketed note on one side only", () => {
    expect(dishScore("Cumin Lamb Noodles (Spicy)", "Cumin Lamb Noodles")).toBeGreaterThanOrEqual(0.9);
    expect(dishScore("Dumplings (Pork)", "Dumplings (Tofu)")).toBeLessThan(0.9);
  });

  it("[ai] dishScore keeps different dishes apart", () => {
    expect(dishScore("noodles", "Dumplings")).toBeLessThan(0.9);
    expect(dishScore("noodles", "Dan Dan Noodles")).toBeLessThan(0.9);
    expect(dishScore("chicken sandwich", "fish sandwich")).toBeLessThan(0.9);
  });
});
