import type { IngredientTag } from "../menu/schema";
import type { Diet, Profile } from "../profile/schema";
import type { MenuDish, Pick } from "../recommend/types";
import { ingredientsNamed } from "./dish-words";

const MEAT: IngredientTag[] = ["pork", "beef", "lamb", "poultry", "meat"];

/** Ingredient tags each diet rules out. */
export const DIET_CONFLICTS: Record<Diet, IngredientTag[]> = {
  vegetarian: [...MEAT, "fish", "shellfish"],
  vegan: [...MEAT, "fish", "shellfish", "dairy", "egg"],
  pescatarian: MEAT,
  no_pork: ["pork"],
  no_beef: ["beef"],
  halal: ["pork", "alcohol"],
  kosher: ["pork", "shellfish"],
  gluten_free: ["gluten"],
  dairy_free: ["dairy"],
};

// Tags that describe taste, not ingredients.
const TASTE_TAGS: IngredientTag[] = ["spicy"];

export type Flag = "ask_server" | "price_unknown";

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function dishConflicts(dish: MenuDish, profile: Profile): string[] {
  const tags = new Set<IngredientTag>([...dish.tags.map((t) => t.tag), ...ingredientsNamed(dish)]);
  const conflicts = profile.allergies.filter((a) => tags.has(a)).map((a) => `allergy: ${a}`);
  for (const diet of profile.diets) {
    if (DIET_CONFLICTS[diet].some((t) => tags.has(t))) conflicts.push(`diet: ${diet}`);
  }
  return conflicts;
}

function overBudget(dish: MenuDish, profile: Profile): string | null {
  if (profile.budget === null || dish.price === null || dish.price <= profile.budget) return null;
  return `price ${money(dish.price)} is over budget ${money(profile.budget)}`;
}

export function dishFlags(dish: MenuDish, profile: Profile): Flag[] {
  const flags: Flag[] = [];
  const hasRestriction = profile.allergies.length > 0 || profile.diets.length > 0;
  const knowsIngredients = dish.tags.some((t) => !TASTE_TAGS.includes(t.tag));
  if (hasRestriction && !knowsIngredients) flags.push("ask_server");
  if (profile.budget !== null && dish.price === null) flags.push("price_unknown");
  return flags;
}

/** Restrictions only remove dishes; what is left carries flags for anything we can't confirm. */
export function filterForProfile(dishes: MenuDish[], profile: Profile) {
  const allowed: (MenuDish & { flags: Flag[] })[] = [];
  const removed: { dish: MenuDish; reasons: string[] }[] = [];
  for (const dish of dishes) {
    const budget = overBudget(dish, profile);
    const reasons = [...dishConflicts(dish, profile), ...(budget ? [budget] : [])];
    if (reasons.length) removed.push({ dish, reasons });
    else allowed.push({ ...dish, flags: dishFlags(dish, profile) });
  }
  return { allowed, removed };
}

const BANNED = [/\ballergen[- ]free\b/i, /\bsafe(ly)?\b/i];

export function checkRestrictions(picks: Pick[], resolved: (MenuDish | null)[], profile: Profile): string[] {
  const errors: string[] = [];
  picks.forEach((p, i) => {
    const dish = resolved[i];
    if (dish) {
      for (const c of dishConflicts(dish, profile)) errors.push(`item[${i}] "${p.dish}" conflicts with user ${c}`);
      const budget = overBudget(dish, profile);
      if (budget) errors.push(`item[${i}] "${p.dish}" ${budget}`);
    }
    for (const re of BANNED) {
      const hit = p.reason.match(re);
      if (hit) {
        errors.push(`item[${i}] "${p.dish}" reason says "${hit[0].toLowerCase()}"`);
        break;
      }
    }
  });
  return errors;
}
