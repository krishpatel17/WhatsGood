import { z } from "zod";
import { type Db, newId, nowIso } from "../db";
import { EventSchema, type UsageEvent } from "../events/log";
import type { Recommended } from "../recommend/validate";

export const RatingSchema = z
  .object({ dishId: z.string().nullable(), dishName: z.string().trim().min(1).optional(), rating: z.number().int().min(1).max(5) })
  .refine((r) => r.dishId !== null || r.dishName, { message: "name the dish you ordered", path: ["dishName"] });

export type StoredRecommendation = {
  id: string;
  profileId: string;
  restaurantId: string;
  mode: string;
  picks: Recommended[];
  explanation: string | null;
  createdAt: string;
  dismissedAt: string | null;
  rated: boolean;
};

export async function getRecommendation(db: Db, id: string): Promise<StoredRecommendation | null> {
  const row = await db
    .prepare(
      `SELECT r.*, EXISTS (SELECT 1 FROM ratings x WHERE x.recommendation_id = r.id) AS rated
       FROM recommendations r WHERE r.id = ?`,
    )
    .bind(id)
    .first<{ id: string; profile_id: string; restaurant_id: string; mode: string; picks: string; explanation: string | null; created_at: string; dismissed_at: string | null; rated: number }>();
  if (!row) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    restaurantId: row.restaurant_id,
    mode: row.mode,
    picks: JSON.parse(row.picks),
    explanation: row.explanation,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at,
    rated: !!row.rated,
  };
}

export type RateResult = { ok: true; ratingId: string } | { ok: false; status: 400 | 404 | 409; error: string };

/** Record which dish the diner ordered and how they rated it (1-5). One rating per recommendation. */
export async function rateMeal(db: Db, recommendationId: string, input: unknown): Promise<RateResult> {
  const rec = await getRecommendation(db, recommendationId);
  if (!rec) return { ok: false, status: 404, error: "recommendation not found" };
  const parsed = RatingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues.map((i) => i.message).join("; ") };
  if (rec.rated) return { ok: false, status: 409, error: "already rated" };

  const { dishId, rating } = parsed.data;
  let dishName = parsed.data.dishName ?? "";
  if (dishId !== null) {
    const pick = rec.picks.find((p) => p.dishId === dishId);
    if (!pick) return { ok: false, status: 400, error: "that dish was not one of your picks" };
    dishName = pick.name;
  }

  const ratingId = newId();
  const ids = { profileId: rec.profileId, restaurantId: rec.restaurantId, recommendationId: rec.id };
  const events: UsageEvent[] = [
    { type: "pick_ordered", ...ids, dishId, dishName },
    { type: "rating_submitted", ...ids, dishId, rating },
  ];
  const insert = db
    .prepare("INSERT INTO ratings (id, recommendation_id, profile_id, restaurant_id, dish_id, dish_name, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(recommendation_id) DO NOTHING")
    .bind(ratingId, rec.id, rec.profileId, rec.restaurantId, dishId, dishName, rating, nowIso());
  // Only the request that won the unique recommendation ID can emit events.
  await db.batch([insert, ...events.map((event) => {
    const e = EventSchema.parse(event);
    return db.prepare("INSERT INTO events (id, type, profile_id, restaurant_id, recommendation_id, payload, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ratings WHERE id = ?)")
      .bind(newId(), e.type, rec.profileId, rec.restaurantId, rec.id, JSON.stringify(e), nowIso(), ratingId);
  })]);
  const saved = await db.prepare("SELECT id FROM ratings WHERE id = ?").bind(ratingId).first();
  if (!saved) return { ok: false, status: 409, error: "already rated" };
  return { ok: true, ratingId };
}
