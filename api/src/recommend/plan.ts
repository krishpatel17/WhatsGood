import type { Evidence } from "../guardrails/evidence";
import { uniqueDishes } from "../guardrails/menu";
import type { MenuDish } from "./types";

export const MAX_PICKS = 3;
export const FEW_REVIEWS_THRESHOLD = 3;

export type Mode = "reviews" | "menu_only";
export type Label = "few_reviews" | "menu_only";

export type Plan = { mode: Mode; maxPicks: number; candidates: string[]; explanation: string | null };

export function labelsFor(mentions: number, mode: Mode): Label[] {
  if (mode === "menu_only") return ["menu_only"];
  return mentions < FEW_REVIEWS_THRESHOLD ? ["few_reviews"] : [];
}

const dishes = (n: number) => (n === 1 ? "1 dish" : `${n} dishes`);

/**
 * How many picks to show and from which dishes. `listed` is the menu after
 * restriction and budget filtering. Fewer than 3 picks always comes with a reason.
 */
export function planPicks(listed: MenuDish[], ev: Evidence): Plan {
  const allowed = uniqueDishes(listed, ev);
  if (allowed.length === 0) return { mode: "reviews", maxPicks: 0, candidates: [], explanation: "No dishes on this menu fit your profile." };

  const backed = allowed.filter((d) => {
    const e = ev.byDish.get(d.id);
    return e && e.count > 0 && e.avgSentiment > 0;
  });
  if (backed.length === 0) {
    const explanation =
      ev.byDish.size === 0
        ? "No reviews mention dishes here yet, so these picks are based on the menu only."
        : "No dish that fits your profile has positive reviews, so these picks are based on the menu only.";
    return { mode: "menu_only", maxPicks: Math.min(MAX_PICKS, allowed.length), candidates: allowed.map((d) => d.id), explanation };
  }
  if (allowed.length < MAX_PICKS) {
    return { mode: "reviews", maxPicks: allowed.length, candidates: allowed.map((d) => d.id), explanation: `Only ${dishes(allowed.length)} on this menu ${allowed.length === 1 ? "fits" : "fit"} your profile.` };
  }
  if (backed.length < MAX_PICKS) {
    return { mode: "reviews", maxPicks: backed.length, candidates: backed.map((d) => d.id), explanation: `Only ${dishes(backed.length)} that fit your profile have positive reviews.` };
  }
  return { mode: "reviews", maxPicks: MAX_PICKS, candidates: allowed.map((d) => d.id), explanation: null };
}
