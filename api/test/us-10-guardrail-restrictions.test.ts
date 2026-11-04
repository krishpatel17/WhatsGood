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
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Safe for your peanut allergy.")], [lamb], p)).toEqual([
      'item[0] "Cumin Lamb Noodles" reason names "peanut", which conflicts with user allergy: peanut. If the dish contains it, pick another dish',
      'item[0] "Cumin Lamb Noodles" reason says "safe"',
    ]);
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Totally allergen-free!")], [lamb], p)).toEqual(['item[0] "Cumin Lamb Noodles" reason says "allergen-free"']);
    expect(checkRestrictions([pick("Cumin Lamb Noodles", "Spicy and fragrant.")], [lamb], p)).toEqual([]);
  });

  it("[ai] T10 unit: a reason naming a conflicting ingredient fails validation and names the word", () => {
    expect(checkRestrictions([pick("Chef's Special", "Topped with crispy bacon.")], [special], profile({ diets: ["vegetarian"] }))).toEqual([
      'item[0] "Chef\'s Special" reason names "bacon", which conflicts with user diet: vegetarian. If the dish contains it, pick another dish',
    ]);
    expect(checkRestrictions([pick("Chef's Special", "Rich peanut sauce.")], [special], profile({ allergies: ["peanut"] }))).toEqual([
      'item[0] "Chef\'s Special" reason names "peanut", which conflicts with user allergy: peanut. If the dish contains it, pick another dish',
    ]);
    // Accents don't hide a word.
    expect(checkRestrictions([pick("Chef's Special", "Loaded with camarón.")], [special], profile({ allergies: ["shellfish"] }))).toHaveLength(1);
  });

  it("[ai] T11 unit: a reason's ingredient only fails for a diner it conflicts with", () => {
    const reason = "Topped with crispy bacon.";
    expect(checkRestrictions([pick("Chef's Special", reason)], [special], profile({}))).toEqual([]);
    expect(checkRestrictions([pick("Chef's Special", reason)], [special], profile({ allergies: ["peanut"], diets: ["no_beef"] }))).toEqual([]);
  });

  it("[ai] T12 unit: saying a dish lacks the ingredient still fails, since that is a safety claim", () => {
    expect(checkRestrictions([pick("Chef's Special", "No pork in sight.")], [special], profile({ diets: ["no_pork"] }))).toHaveLength(1);
    expect(checkRestrictions([pick("Chef's Special", "A pork-free favorite.")], [special], profile({ diets: ["no_pork"] }))).toHaveLength(1);
  });

  it("[ai] T13 unit: a plant-based dish can say burger, and only the dish's own words make it plant-based", () => {
    const vegetarian = profile({ diets: ["vegetarian"] });
    const veggie = dish("Veggie Burger", ["soy"]);
    expect(checkRestrictions([pick("Veggie Burger", "The best burger in town.")], [veggie], vegetarian)).toEqual([]);
    expect(checkRestrictions([pick("Chef's Special", "The best burger in town.")], [special], vegetarian)).toHaveLength(1);
    expect(checkRestrictions([pick("Chef's Special", "A burger beyond compare.")], [special], vegetarian)).toHaveLength(1);
  });

  it("[ai] T14 unit: 'tender' as an adjective is not chicken tenders", () => {
    const vegetarian = profile({ diets: ["vegetarian"] });
    expect(checkRestrictions([pick("Chef's Special", "Tender eggplant in a bright sauce.")], [special], vegetarian)).toEqual([]);
    expect(checkRestrictions([pick("Chef's Special", "Crispy tenders.")], [special], vegetarian)).toHaveLength(1);
  });

  it("[ai] T15 unit: added words conflict in a reason and in a dish's own name", () => {
    const cases: [string, Partial<Profile>][] = [
      ["cheesy", { allergies: ["dairy"] }],
      ["buttery", { diets: ["dairy_free"] }],
      ["paneer", { allergies: ["dairy"] }],
      ["pesto", { allergies: ["dairy"] }],
      ["pesto", { allergies: ["tree_nut"] }],
      ["nutty", { allergies: ["tree_nut"] }],
      ["nutty", { allergies: ["peanut"] }],
      ["satay", { allergies: ["peanut"] }],
      ["naan", { allergies: ["gluten"] }],
      ["tempura", { diets: ["gluten_free"] }],
      ["seitan", { allergies: ["gluten"] }],
      ["couscous", { allergies: ["gluten"] }],
      ["flour tortilla", { allergies: ["gluten"] }],
      ["aioli", { allergies: ["egg"] }],
      ["mayo", { allergies: ["egg"] }],
      ["miso", { allergies: ["soy"] }],
      ["lard", { diets: ["no_pork"] }],
      ["gelatin", { diets: ["vegetarian"] }],
      ["gelatin", { diets: ["halal"] }],
      ["foie gras", { diets: ["vegetarian"] }],
      ["goose", { diets: ["pescatarian"] }],
      ["sushi", { allergies: ["fish"] }],
      ["from the sea", { allergies: ["fish"] }],
      ["from the sea", { allergies: ["shellfish"] }],
      ["seafood", { allergies: ["fish"] }],
      ["pig", { diets: ["no_pork"] }],
      ["red wine", { diets: ["halal"] }],
      ["beer", { diets: ["halal"] }],
      ["bourbon", { diets: ["halal"] }],
      ["sake", { diets: ["halal"] }],
    ];
    for (const [word, p] of cases) {
      expect(checkRestrictions([pick("Chef's Special", `Great with ${word}.`)], [special], profile(p)), word).toHaveLength(1);
      expect(dishConflicts(dish(`House ${word}`, []), profile(p)), word).toHaveLength(1);
    }
  });

  it("[ai] T16 unit: lookalikes of the added words do not conflict", () => {
    const cases: [string, Partial<Profile>][] = [
      ["root beer", { diets: ["halal"] }],
      ["root-beer float", { diets: ["halal"] }],
      ["shrimp cocktail", { diets: ["halal"] }],
      ["ginger ale", { diets: ["halal"] }],
      ["ginger", { diets: ["halal"] }],
      ["aleppo pepper", { diets: ["halal"] }],
      ["corn flour", { allergies: ["gluten"] }],
      ["rice flour", { allergies: ["gluten"] }],
      ["flourless", { allergies: ["gluten"] }],
    ];
    for (const [word, p] of cases) {
      expect(checkRestrictions([pick("Chef's Special", `Great with ${word}.`)], [special], profile(p)), word).toEqual([]);
      expect(dishConflicts(dish(`House ${word}`, []), profile(p)), word).toEqual([]);
    }
    expect(checkRestrictions([pick("Chef's Special", "Worth ordering for the sake of the sauce.")], [special], profile({ diets: ["halal"] }))).toEqual([]);
    // Sushi usually has fish, but a plant-based roll says so.
    expect(dishConflicts(dish("Veggie Sushi", []), profile({ allergies: ["fish"] }))).toEqual([]);
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

  it("[ai] T7 unit: an untagged dish is removed when its name states a conflict", () => {
    const untagged = (name: string) => dish(name, []);
    const vegetarian = profile({ diets: ["vegetarian"] });
    for (const name of ["Afghan Beef Meatball", "Black & Blue Ridge Burger", "Chicken Kofta Kabob", "Tacos al Pastor", "SHRIMP & GRITS", "Grilled Trout", "Caldo de Camarón", "Hand-Cut NY Strip*", "Cheesesteak Hoagie", "Murgh Chalow", "Slaw Dog"]) {
      expect(dishConflicts(untagged(name), vegetarian)).toEqual(["diet: vegetarian"]);
    }
    expect(dishConflicts(untagged("Peanut Tofu Soup"), profile({ allergies: ["peanut"] }))).toEqual(["allergy: peanut"]);
    expect(dishConflicts(untagged("HAM BISCUIT"), profile({ diets: ["no_pork"] }))).toEqual(["diet: no_pork"]);
    expect(dishConflicts(untagged("Cheese Calzone"), profile({ allergies: ["dairy", "gluten"] }))).toEqual(["allergy: dairy", "allergy: gluten"]);
  });

  it("[ai] T8 unit: a description can state a conflict too", () => {
    const special = { ...dish("Chef's Special", []), description: "Slow-cooked lamb with rice" };
    expect(dishConflicts(special, profile({ diets: ["vegetarian"] }))).toEqual(["diet: vegetarian"]);
  });

  it("[ai] T9 unit: plant-based and lookalike names are not removed", () => {
    const vegetarian = profile({ diets: ["vegetarian"] });
    for (const name of ["The Beyond Burger", "Veggie Kabob", "V - NO–BULL VEGGIE BURGER", "Afghan Red Beans", "Fried Eggplant"]) {
      expect(dishConflicts(dish(name, []), vegetarian)).toEqual([]);
    }
    expect(dishConflicts(dish("Fried Eggplant", []), profile({ allergies: ["egg"] }))).toEqual([]);
    expect(dishConflicts(dish("Shamrock Salad", []), profile({ diets: ["no_pork"] }))).toEqual([]);
    expect(dishConflicts(dish("Peanut Butter Pie", []), profile({ allergies: ["peanut"] }))).toEqual(["allergy: peanut"]);
  });
});
