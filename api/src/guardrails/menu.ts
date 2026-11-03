import { bestDishMatch } from "../text/match";
import type { MenuDish, Pick } from "../recommend/types";

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
    const first = dish ? resolved.indexOf(dish) : i;
    if (first !== i) errors.push(`item[${i}] "${picks[i].dish}" repeats item[${first}]`);
  });
  return { errors, resolved };
}
