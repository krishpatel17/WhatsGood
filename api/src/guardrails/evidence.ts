import type { Db } from "../db";
import { quoteInReview } from "../reviews/mentions";
import type { MenuDish, Pick } from "../recommend/types";

export type DishEvidence = { count: number; avgSentiment: number; reviewIds: Set<string> };
export type Evidence = { reviews: Map<string, string>; byDish: Map<string, DishEvidence> };

/** This restaurant's stored reviews and, per dish, its matched mention count and the reviews that mention it. */
export async function loadEvidence(db: Db, restaurantId: string): Promise<Evidence> {
  const { results: reviews } = await db.prepare("SELECT id, text FROM reviews WHERE restaurant_id = ?").bind(restaurantId).all<{ id: string; text: string }>();
  const { results: mentions } = await db
    .prepare("SELECT dish_id, review_id, sentiment FROM mentions WHERE restaurant_id = ? AND dish_id IS NOT NULL")
    .bind(restaurantId)
    .all<{ dish_id: string; review_id: string; sentiment: number }>();
  const sums = new Map<string, { count: number; total: number; reviewIds: Set<string> }>();
  for (const m of mentions) {
    const s = sums.get(m.dish_id) ?? { count: 0, total: 0, reviewIds: new Set<string>() };
    s.count += 1;
    s.total += m.sentiment;
    s.reviewIds.add(m.review_id);
    sums.set(m.dish_id, s);
  }
  const byDish = new Map(
    [...sums].map(([id, s]) => [id, { count: s.count, avgSentiment: Math.round((s.total / s.count) * 1000) / 1000, reviewIds: s.reviewIds }] as const),
  );
  return { reviews: new Map(reviews.map((r) => [r.id, r.text])), byDish };
}

/** Every quote is verbatim from a review that mentions the dish, and every count matches the database. */
export function checkEvidence(picks: Pick[], resolved: (MenuDish | null)[], ev: Evidence): string[] {
  const errors: string[] = [];
  picks.forEach((p, i) => {
    const dish = resolved[i];
    if (!dish) return;
    const stored = ev.byDish.get(dish.id);
    const count = stored?.count ?? 0;
    if (p.mention_count !== count) errors.push(`item[${i}] "${p.dish}" mention_count ${p.mention_count} does not match database count ${count}`);
    if (count > 0 && p.quotes.length === 0) errors.push(`item[${i}] "${p.dish}" has no review quote`);
    p.quotes.forEach((q, j) => {
      const sources = [...ev.reviews].filter(([, text]) => quoteInReview(q, text)).map(([id]) => id);
      if (sources.length === 0) errors.push(`item[${i}].quotes[${j}] quote not found in reviews for this restaurant`);
      else if (!sources.some((id) => stored?.reviewIds.has(id))) errors.push(`item[${i}].quotes[${j}] quote comes from a review that does not mention "${dish.name}"`);
    });
  });
  return errors;
}
