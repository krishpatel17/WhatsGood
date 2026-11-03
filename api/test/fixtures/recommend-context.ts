// A hand-built recommendation context: the easy menu plus review evidence.
import type { Evidence } from "../../src/guardrails/evidence";
import { filterForProfile } from "../../src/guardrails/restrictions";
import { planPicks } from "../../src/recommend/plan";
import type { MenuDish } from "../../src/recommend/types";
import { ProfileSchema, type Profile } from "../../src/profile/schema";
import type { PickContext } from "../../src/recommend/validate";
import { easyMenu } from "./menus";

export const menu: MenuDish[] = easyMenu.dishes.map((d, i) => ({ ...d, id: `d${i + 1}` }));
// d1 Dan Dan Noodles, d2 Cumin Lamb Noodles (Spicy), d3 Garlic Bok Choy Noodles, d4 Pork Dumplings, d5 Vegetable Dumplings

export const evidence: Evidence = {
  reviews: new Map([
    ["rv1", "The dan dan noodles are great but skip the pork dumplings, they were soggy."],
    ["rv2", "Cumin lamb noodles were spicy and perfect. Get them."],
    ["rv3", "Best dan dan noodles in town, numbing and rich."],
    ["rv4", "Loved the dan dan noodles. Service was slow."],
    ["rv5", "The cumin lamb noodles are the best thing on the menu."],
    ["rv6", "Garlic bok choy noodles were fresh and light."],
  ]),
  byDish: new Map([
    ["d1", { count: 3, avgSentiment: 0.8, reviewIds: new Set(["rv1", "rv3", "rv4"]) }],
    ["d2", { count: 2, avgSentiment: 0.95, reviewIds: new Set(["rv2", "rv5"]) }],
    ["d3", { count: 1, avgSentiment: 0.6, reviewIds: new Set(["rv6"]) }],
    ["d4", { count: 1, avgSentiment: -0.7, reviewIds: new Set(["rv1"]) }],
  ]),
};

export function context(profile: Partial<Profile> = {}): PickContext {
  const p = ProfileSchema.parse(profile);
  const { allowed } = filterForProfile(menu, p);
  return { restaurantId: "r1", profile: p, menu, allowed, evidence, plan: planPicks(allowed, evidence) };
}

export const goodPicks = {
  picks: [
    { dish: "Dan Dan Noodles", reason: "The most-praised dish here, and it's spicy.", quotes: ["Best dan dan noodles in town"], mention_count: 3 },
    { dish: "Cumin Lamb Noodles (Spicy)", reason: "Reviewers call it the best thing on the menu.", quotes: ["The cumin lamb noodles are the best thing on the menu."], mention_count: 2 },
    { dish: "Garlic Bok Choy Noodles", reason: "A lighter option reviewers liked.", quotes: ["Garlic bok choy noodles were fresh and light."], mention_count: 1 },
  ],
};
