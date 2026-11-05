import { z } from "zod";
import { type Db, newId } from "../db";
import type { Llm, LlmUsage } from "../llm/types";
import { REVIEW_MENTIONS_SYSTEM } from "../prompts/review-mentions";
import { bestDishMatch } from "../text/match";

export const REVIEWS_PER_CALL = 25;

export const MentionsSchema = z.object({
  mentions: z.array(z.object({ review_id: z.string(), dish: z.string(), sentiment: z.number(), quote: z.string() })),
});

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** True when the quote appears word for word in the review (whitespace runs count as one space). */
export function quoteInReview(quote: string, review: string): boolean {
  const q = squash(quote);
  return q.length > 0 && squash(review).includes(q);
}

export function matchMention(dish: string, menu: { id: string; name: string }[]): { dishId: string; score: number } | null {
  const best = bestDishMatch(dish, menu);
  return best ? { dishId: best.item.id, score: best.score } : null;
}

export function aggregateMentions(rows: { dish_id: string | null; sentiment: number }[]) {
  const sums = new Map<string, { n: number; total: number }>();
  for (const r of rows) {
    if (!r.dish_id) continue;
    const s = sums.get(r.dish_id) ?? { n: 0, total: 0 };
    s.n += 1;
    s.total += r.sentiment;
    sums.set(r.dish_id, s);
  }
  return new Map([...sums].map(([id, s]) => [id, { mentions: s.n, avgSentiment: Math.round((s.total / s.n) * 1000) / 1000 }]));
}

export async function activeMenuDishes(db: Db, restaurantId: string) {
  const { results } = await db
    .prepare("SELECT d.id, d.name, d.section, d.price, d.description, d.tags FROM dishes d JOIN menus m ON m.id = d.menu_id WHERE m.restaurant_id = ? AND m.status = 'active'")
    .bind(restaurantId)
    .all<{ id: string; name: string; section: string; price: number | null; description: string | null; tags: string }>();
  return results;
}

export type ExtractResult = { reviews: number; mentions: number; matched: number; rejectedQuotes: number; invalid: number; usage: LlmUsage };

/** Extract dish mentions from all of a restaurant's reviews, replacing any earlier extraction. */
export async function extractMentions(deps: { db: Db; llm: Llm }, restaurantId: string): Promise<ExtractResult> {
  const { db, llm } = deps;
  const dishes = await activeMenuDishes(db, restaurantId);
  const { results: reviews } = await db.prepare("SELECT id, text FROM reviews WHERE restaurant_id = ? ORDER BY date, id").bind(restaurantId).all<{ id: string; text: string }>();
  const byId = new Map(reviews.map((r) => [r.id, r.text]));
  const result: ExtractResult = { reviews: reviews.length, mentions: 0, matched: 0, rejectedQuotes: 0, invalid: 0, usage: { input_tokens: 0, output_tokens: 0 } };

  const statements = [db.prepare("DELETE FROM mentions WHERE restaurant_id = ?").bind(restaurantId)];
  const menuText = dishes.map((d) => `- ${d.name}`).join("\n");

  for (let i = 0; i < reviews.length; i += REVIEWS_PER_CALL) {
    const batch = reviews.slice(i, i + REVIEWS_PER_CALL);
    const reviewText = batch.map((r) => `[review ${r.id}] ${squash(r.text)}`).join("\n");
    const res = await llm.json({
      task: "review_mentions",
      system: REVIEW_MENTIONS_SYSTEM,
      messages: [{ role: "user", content: `MENU:\n${menuText}\n\nREVIEWS:\n${reviewText}` }],
      schema: MentionsSchema,
      effort: "low",
    });
    result.usage.input_tokens += res.usage.input_tokens;
    result.usage.output_tokens += res.usage.output_tokens;
    const parsed = MentionsSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("invalid mention extraction: previous evidence was kept");
    }
    for (const m of parsed.data.mentions) {
      const review = byId.get(m.review_id);
      if (!review || m.sentiment < -1 || m.sentiment > 1) {
        result.invalid += 1;
        continue;
      }
      if (!quoteInReview(m.quote, review)) {
        result.rejectedQuotes += 1;
        continue;
      }
      const match = matchMention(m.dish, dishes);
      statements.push(db
        .prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(newId(), restaurantId, m.review_id, match?.dishId ?? null, m.dish, m.sentiment, squash(m.quote), match?.score ?? 0));
      result.mentions += 1;
      if (match) result.matched += 1;
    }
  }
  // Model work must finish before any previous evidence is replaced.
  await db.batch(statements);
  return result;
}
