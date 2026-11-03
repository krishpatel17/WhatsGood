import { z } from "zod";
import { type Db, newId, nowIso } from "../db";

const base = { profileId: z.string().min(1), restaurantId: z.string().min(1), recommendationId: z.string().min(1) };

export const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("recommendation_shown"),
    ...base,
    mode: z.enum(["llm", "fallback", "none"]).optional(),
    picks: z.array(z.object({ dishId: z.string(), name: z.string(), quotes: z.array(z.string()) })),
  }),
  z.object({ type: z.literal("pick_ordered"), ...base, dishId: z.string().nullable(), dishName: z.string().min(1) }),
  z.object({ type: z.literal("rating_submitted"), ...base, dishId: z.string().nullable(), rating: z.number().int().min(1).max(5) }),
]);

export type UsageEvent = z.infer<typeof EventSchema>;
export type EventType = UsageEvent["type"];

export async function logEvent(db: Db, event: UsageEvent): Promise<void> {
  const e = EventSchema.parse(event);
  await db
    .prepare("INSERT INTO events (id, type, profile_id, restaurant_id, recommendation_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(newId(), e.type, e.profileId, e.restaurantId, e.recommendationId, JSON.stringify(e), nowIso())
    .run();
}

export async function listEvents<T extends EventType>(db: Db, type: T) {
  const { results } = await db.prepare("SELECT payload, created_at FROM events WHERE type = ? ORDER BY created_at, id").bind(type).all<{ payload: string; created_at: string }>();
  return results.map((r) => ({ ...(JSON.parse(r.payload) as Extract<UsageEvent, { type: T }>), createdAt: r.created_at }));
}
