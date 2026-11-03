import { beforeEach, describe, expect, it } from "vitest";
import { EventSchema, listEvents, logEvent } from "../src/events/log";
import { recommend } from "../src/recommend/service";
import { ProfileSchema } from "../src/profile/schema";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { seedRestaurant } from "./helpers/seed";

const base = { profileId: "p1", restaurantId: "r1", recommendationId: "rec1" };

describe("US-17 Log usage events", () => {
  it("[ai] T1 unit: each event type validates its required fields", () => {
    expect(EventSchema.safeParse({ type: "recommendation_shown", ...base, picks: [{ dishId: "d1", name: "Dan Dan Noodles", quotes: ["Best dan dan noodles in town"] }] }).success).toBe(true);
    expect(EventSchema.safeParse({ type: "recommendation_shown", ...base }).success).toBe(false);
    expect(EventSchema.safeParse({ type: "pick_ordered", ...base, dishId: "d1", dishName: "Dan Dan Noodles" }).success).toBe(true);
    expect(EventSchema.safeParse({ type: "pick_ordered", ...base, dishId: null, dishName: "Off-menu special" }).success).toBe(true);
    expect(EventSchema.safeParse({ type: "pick_ordered", ...base, dishId: "d1" }).success).toBe(false);
    expect(EventSchema.safeParse({ type: "rating_submitted", ...base, dishId: "d1", rating: 4 }).success).toBe(true);
    expect(EventSchema.safeParse({ type: "rating_submitted", ...base, dishId: "d1", rating: 6 }).success).toBe(false);
    expect(EventSchema.safeParse({ type: "rating_submitted", restaurantId: "r1", recommendationId: "rec1", dishId: "d1", rating: 4 }).success).toBe(false);
    expect(EventSchema.safeParse({ type: "page_view", ...base }).success).toBe(false);
  });

  describe("with a database", () => {
    let db: ReturnType<typeof testDb>;
    beforeEach(() => {
      db = testDb();
    });

    it("[ai] AC1 integration: events are stored with user ID, restaurant ID and timestamp", async () => {
      await logEvent(db, { type: "pick_ordered", ...base, dishId: "d1", dishName: "Dan Dan Noodles" });
      const [e] = await listEvents(db, "pick_ordered");
      expect(e).toMatchObject({ type: "pick_ordered", profileId: "p1", restaurantId: "r1", dishName: "Dan Dan Noodles" });
      expect(e.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await expect(logEvent(db, { type: "pick_ordered", ...base } as never)).rejects.toThrow();
    });

    it("[ai] T2 integration: showing picks writes a recommendation_shown event containing the dishes and quotes", async () => {
      const seed = await seedRestaurant(db);
      const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, 'r1', ?, ?, 'x', ?, ?, 1)");
      insert.run("m1", seed.reviewId("google:3"), seed.dishId("Dan Dan Noodles"), 1, "Best dan dan noodles in town");
      const llm = mockLlm([{ picks: [{ dish: "Dan Dan Noodles", reason: "Most loved.", quotes: ["Best dan dan noodles in town"], mention_count: 1 }] }]);
      const rec = await recommend({ db, llm }, "r1", "p1", ProfileSchema.parse({}));
      const [shown] = await listEvents(db, "recommendation_shown");
      expect(shown).toMatchObject({
        profileId: "p1",
        restaurantId: "r1",
        recommendationId: rec.recommendationId,
        mode: "llm",
        picks: [{ dishId: seed.dishId("Dan Dan Noodles"), name: "Dan Dan Noodles", quotes: ["Best dan dan noodles in town"] }],
      });
    });
  });
});
