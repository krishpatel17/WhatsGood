import { beforeEach, describe, expect, it } from "vitest";
import { RatingSchema } from "../src/feedback/rating";
import { listEvents } from "../src/events/log";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";
import { seedRecommendation } from "./helpers/recommendation";

describe("US-15 Rate my meal", () => {
  it("[ai] T1 unit: rating outside 1-5 is rejected", () => {
    expect(RatingSchema.safeParse({ dishId: "d1", rating: 1 }).success).toBe(true);
    expect(RatingSchema.safeParse({ dishId: "d1", rating: 5 }).success).toBe(true);
    for (const rating of [0, 6, 3.5, "4"]) expect(RatingSchema.safeParse({ dishId: "d1", rating }).success, String(rating)).toBe(false);
  });

  it("[ai] AC1 unit: 'something else' needs the dish name the diner typed", () => {
    expect(RatingSchema.safeParse({ dishId: null, dishName: "Off-menu special", rating: 4 }).success).toBe(true);
    expect(RatingSchema.safeParse({ dishId: null, rating: 4 }).success).toBe(false);
  });

  describe("rating a recommendation", () => {
    let db: ReturnType<typeof testDb>;
    let s: Awaited<ReturnType<typeof seedRecommendation>>;
    let app: ReturnType<typeof createApp>;
    beforeEach(async () => {
      db = testDb();
      s = await seedRecommendation(db);
      app = createApp({ db });
    });
    const rate = (id: string, body: object) => app.request(`/recommendations/${id}/rating`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    it("[ai] T2 integration: the rating row links to the recommendation, dish, user and timestamp", async () => {
      const res = await rate(s.recommendationId, { dishId: s.dishId("Dan Dan Noodles"), rating: 5 });
      expect(res.status).toBe(201);
      const row = db.raw.prepare("SELECT * FROM ratings").get() as Record<string, unknown>;
      expect(row).toMatchObject({ recommendation_id: s.recommendationId, dish_id: s.dishId("Dan Dan Noodles"), dish_name: "Dan Dan Noodles", profile_id: s.profileId, restaurant_id: "r1", rating: 5 });
      expect(String(row.created_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect((await listEvents(db, "pick_ordered"))[0]).toMatchObject({ recommendationId: s.recommendationId, dishName: "Dan Dan Noodles" });
      expect((await listEvents(db, "rating_submitted"))[0]).toMatchObject({ recommendationId: s.recommendationId, rating: 5 });
    });

    it("[ai] AC1 integration: 'something else' stores the typed dish with no dish id", async () => {
      expect((await rate(s.recommendationId, { dishId: null, dishName: "Scallion pancake", rating: 3 })).status).toBe(201);
      expect(db.raw.prepare("SELECT dish_id, dish_name FROM ratings").get()).toEqual({ dish_id: null, dish_name: "Scallion pancake" });
    });

    it("[ai] AC1 integration: a dish that was not one of the picks is rejected, as are unknown recommendations and double ratings", async () => {
      expect((await rate(s.recommendationId, { dishId: s.dishId("Pork Dumplings"), rating: 4 })).status).toBe(400);
      expect((await rate("nope", { dishId: null, dishName: "x", rating: 4 })).status).toBe(404);
      expect((await rate(s.recommendationId, { dishId: null, dishName: "x", rating: 9 })).status).toBe(400);
      await rate(s.recommendationId, { dishId: s.dishId("Dan Dan Noodles"), rating: 5 });
      expect((await rate(s.recommendationId, { dishId: s.dishId("Dan Dan Noodles"), rating: 4 })).status).toBe(409);
    });

    it("[ai] AC2 integration: GET /recommendations/:id returns the picks to choose from", async () => {
      const res = await app.request(`/recommendations/${s.recommendationId}`);
      const body = (await res.json()) as { picks: { name: string }[]; rated: boolean };
      expect(body.picks.map((p) => p.name)).toEqual(["Dan Dan Noodles", "Cumin Lamb Noodles (Spicy)"]);
      expect(body.rated).toBe(false);
    });
  });
});
