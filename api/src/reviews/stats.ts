import type { Db } from "../db";
import { aggregateMentions } from "./mentions";

/** Distinct mentioning reviews and mean per-review sentiment for each dish. */
export async function dishStats(db: Db, restaurantId: string) {
  const { results } = await db
    .prepare("SELECT dish_id, AVG(sentiment) AS sentiment FROM mentions WHERE restaurant_id = ? AND dish_id IS NOT NULL GROUP BY dish_id, review_id")
    .bind(restaurantId)
    .all<{ dish_id: string; sentiment: number }>();
  return aggregateMentions(results);
}

/** Matched quotes for one dish, most positive first. */
export async function dishQuotes(db: Db, dishId: string) {
  const { results } = await db
    .prepare("SELECT m.quote, m.sentiment, m.review_id FROM mentions m WHERE m.dish_id = ? ORDER BY m.sentiment DESC, m.id")
    .bind(dishId)
    .all<{ quote: string; sentiment: number; review_id: string }>();
  return results;
}
