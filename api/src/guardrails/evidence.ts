import type { Db } from "../db";
import { normalize } from "../text/match";
import { quoteInReview } from "../reviews/mentions";
import type { MenuDish, Pick } from "../recommend/types";

export type DishEvidence = { count: number; avgSentiment: number; reviewIds: Set<string> };
export type Evidence = { reviews: Map<string, string>; byDish: Map<string, DishEvidence>; quotes?: Map<string, { reviewId: string; quote: string }[]> };

/** Distinct review counts, per-review sentiment and attributed quote spans for each dish. */
export async function loadEvidence(db: Db, restaurantId: string): Promise<Evidence> {
  const { results: reviews } = await db.prepare("SELECT id, text FROM reviews WHERE restaurant_id = ?").bind(restaurantId).all<{ id: string; text: string }>();
  const { results: mentions } = await db
    .prepare("SELECT dish_id, review_id, sentiment, quote FROM mentions WHERE restaurant_id = ? AND dish_id IS NOT NULL")
    .bind(restaurantId)
    .all<{ dish_id: string; review_id: string; sentiment: number; quote: string }>();
  const perReview = new Map<string, { dishId: string; reviewId: string; total: number; n: number }>();
  const quotes: NonNullable<Evidence["quotes"]> = new Map();
  for (const m of mentions) {
    const key = JSON.stringify([m.dish_id, m.review_id]);
    const r = perReview.get(key) ?? { dishId: m.dish_id, reviewId: m.review_id, total: 0, n: 0 };
    r.total += m.sentiment;
    r.n += 1;
    perReview.set(key, r);
    const list = quotes.get(m.dish_id) ?? [];
    list.push({ reviewId: m.review_id, quote: m.quote });
    quotes.set(m.dish_id, list);
  }
  const sums = new Map<string, { count: number; total: number; reviewIds: Set<string> }>();
  for (const r of perReview.values()) {
    const s = sums.get(r.dishId) ?? { count: 0, total: 0, reviewIds: new Set<string>() };
    s.count += 1;
    s.total += r.total / r.n;
    s.reviewIds.add(r.reviewId);
    sums.set(r.dishId, s);
  }
  const byDish = new Map(
    [...sums].map(([id, s]) => [id, { count: s.count, avgSentiment: Math.round((s.total / s.count) * 1000) / 1000, reviewIds: s.reviewIds }] as const),
  );
  return { reviews: new Map(reviews.map((r) => [r.id, r.text])), byDish, quotes };
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
      else {
        // Review-level membership alone cannot distinguish opposite opinions about two dishes.
        const spans = ev.quotes?.get(dish.id);
        const attributed = spans
          ? spans.some((span) => sources.includes(span.reviewId) && quoteInReview(q, span.quote))
          : normalize(q).includes(normalize(dish.name.replace(/\([^)]*\)/g, " ")));
        if (!attributed) errors.push(`item[${i}].quotes[${j}] quote is not attributed to "${dish.name}"`);
      }
    });
  });
  return errors;
}
