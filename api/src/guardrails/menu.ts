import { bestDishMatch, dishScore, normalize } from "../text/match";
import type { MenuDish, Pick } from "../recommend/types";
import type { Evidence } from "./evidence";

/**
 * Two menu listings of one dish, such as the same name in two sections. Only an exact match after
 * normalizing counts: the fuzzy on-menu threshold would merge "Sandwich #1" and "Sandwich #2".
 */
export function sameDish(a: string, b: string): boolean {
  // Names with no Latin letters normalize to nothing, so they can only match exactly.
  return a === b || (normalize(a) !== "" && dishScore(a, b) === 1);
}

/** One listing per dish, keeping the one with the most review mentions so its evidence stays attached. */
export function uniqueDishes<T extends { id: string; name: string }>(dishes: T[], ev: Evidence): T[] {
  const mentions = (d: T) => ev.byDish.get(d.id)?.count ?? 0;
  const kept: T[] = [];
  for (const d of dishes) {
    const i = kept.findIndex((k) => sameDish(k.name, d.name));
    if (i === -1) kept.push(d);
    else if (mentions(d) > mentions(kept[i]) || (mentions(d) === mentions(kept[i]) && d.id < kept[i].id)) kept[i] = d;
  }
  return kept;
}

/** Every pick must name a dish on this restaurant's stored menu (exact or normalized score >= 0.9), once. */
export function checkOnMenu(picks: Pick[], menu: MenuDish[]): { errors: string[]; resolved: (MenuDish | null)[] } {
  const errors: string[] = [];
  const resolved = picks.map((p, i) => {
    const exact = menu.find((d) => d.name === p.dish);
    const dish = exact ?? bestDishMatch(p.dish, menu)?.item ?? null;
    if (!dish) {
      errors.push(`item[${i}] "${p.dish}" is not on this restaurant's menu`);
      return null;
    }
    return dish;
  });
  resolved.forEach((dish, i) => {
    const first = dish ? resolved.findIndex((d) => d && sameDish(d.name, dish.name)) : i;
    if (first !== i) errors.push(`item[${i}] "${picks[i].dish}" repeats item[${first}]`);
  });
  return { errors, resolved };
}
