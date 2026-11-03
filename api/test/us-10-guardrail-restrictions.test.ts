import { describe, expect, it } from "vitest";
import { checkRestrictions, dishConflicts, dishFlags, filterForProfile } from "../src/guardrails/restrictions";
import { ProfileSchema, type Profile } from "../src/profile/schema";
import type { MenuDish } from "../src/recommend/types";
import type { IngredientTag } from "../src/menu/schema";

const dish = (name: string, tags: IngredientTag[], price: number | null = 12): MenuDish => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  name,
  section: "Mains",
  price,
  description: null,
  tags: tags.map((tag) => ({ tag, source: "stated" as const })),
});
const profile = (p: Partial<Profile>) => ProfileSchema.parse(p);
const pick = (name: string, reason = "Reviewers love it.") => ({ dish: name, reason, quotes: [], mention_count: 0 });

const danDan = dish("Dan Dan Noodles", ["gluten", "pork", "peanut"], 14);
const lamb = dish("Cumin Lamb Noodles", ["gluten", "lamb", "spicy"], 16.5);
const special = dish("Chef's Special", [], 22);
const soup = dish("Soup of the Day", ["dairy"], null);

describe("US-10 Guardrail: restrictions and budget", () => {
  it("[ai] T1 unit: a peanut-tagged dish is removed for a peanut allergy", () => {
    expect(dishConflicts(danDan, profile({ allergies: ["peanut"] }))).toEqual(["allergy: peanut"]);
    const { allowed, removed } = filterForProfile([danDan, lamb], profile({ allergies: ["peanut"] }));
    expect(allowed.map((d) => d.name)).toEqual(["Cumin Lamb Noodles"]);
    expect(removed).toEqual([{ dish: danDan, reasons: ["allergy: peanut"] }]);
  });

  it("[ai] T2 unit: a no-pork diet removes a pork-tagged dish", () => {
    expect(dishConflicts(danDan, profile({ diets: ["no_pork"] }))).toEqual(["diet: no_pork"]);
    expect(dishConflicts(lamb, profile({ diets: ["no_pork"] }))).toEqual([]);
    expect(dishConflicts(lamb, profile({ diets: ["vegetarian"] }))).toEqual(["diet: vegetarian"]);
    expect(dishConflicts(soup, profile({ diets: ["vegan"] }))).toEqual(["diet: vegan"]);
  });

  it("[ai] T3 unit: an untagged dish + any restriction gets the ask-your-server flag", () => {
    expect(dishFlags(special, profile({ allergies: ["sesame"] }))).toContain("ask_server");
    expect(dishFlags(special, profile({ diets: ["halal"] }))).toContain("ask_server");
    expect(dishFlags(special, profile({}))).not.toContain("ask_server");
    expect(dishFlags(lamb, profile({ allergies: ["sesame"] }))).not.toContain("ask_server");
    // A taste tag alone says nothing about ingredients.
    expect(dishFlags(dish("Mystery Bowl", ["spicy"]), profile({ allergies: ["soy"] }))).toContain("ask_server");
  });

  it("[ai] T4 unit: over-budget dish removed; null-price dish flagged", () => {
    const { allowed, removed } = filterForProfile([danDan, lamb, soup], profile({ budget: 15 }));
    expect(allowed.map((d) => d.name)).toEqual(["Dan Dan Noodles", "Soup of the Day"]);
    expect(removed).toEqual([{ dish: lamb, reasons: ["price $16.50 is over budget $15"] }]);
    expect(allowed[1].flags).toContain("price_unknown");
    expect(dishFlags(soup, profile({}))).not.toContain("price_unknown");
  });

  it("[ai] T5 unit: output text containing 'safe' or 'allergen-free' fails validation", () => {
    const p = profile({ allergies: ["peanut"] });
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Safe for your peanut allergy.")], [lamb], p)).toEqual(['item[0] "Cumin Lamb Noodles" reason says "safe"']);
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Totally allergen-free!")], [lamb], p)).toEqual(['item[0] "Cumin Lamb Noodles" reason says "allergen-free"']);
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Spicy and fragrant.")], [lamb], p)).toEqual([]);
  });

  it("[ai] AC1/AC3 unit: a conflicting or over-budget pick fails validation with the reason", () => {
    const p = profile({ diets: ["no_pork"], budget: 15 });
    expect(checkRestrictions([pick("Dan Dan Noodles"), pick("Cumin Lamb Noodles")], [danDan, lamb], p)).toEqual([
      'item[0] "Dan Dan Noodles" conflicts with user diet: no_pork',
      'item[1] "Cumin Lamb Noodles" price $16.50 is over budget $15',
    ]);
    // Unresolved picks are the on-menu guardrail's job, not this one's.
    expect(checkRestrictions([pick("Unknown")], [null], p)).toEqual([]);
  });
});
