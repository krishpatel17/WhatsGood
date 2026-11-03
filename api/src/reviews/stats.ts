import type { Db } from "../db";
import { aggregateMentions } from "./mentions";

/** Matched mention count and mean sentiment for each dish of a restaurant. */
export async function dishStats(db: Db, restaurantId: string) {
  const { results } = await db
    .prepare("SELECT dish_id, sentiment FROM mentions WHERE restaurant_id = ? AND dish_id IS NOT NULL")
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
