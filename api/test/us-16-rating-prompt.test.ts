import { beforeEach, describe, expect, it } from "vitest";
import { pendingRating, shouldPrompt } from "../src/feedback/prompt";
import { rateMeal } from "../src/feedback/rating";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";
import { seedRecommendation } from "./helpers/recommendation";

const MIN = 60_000;
const now = new Date("2026-11-04T20:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * MIN).toISOString();
const rec = (over: Partial<Parameters<typeof shouldPrompt>[0]> = {}) => ({ createdAt: ago(90), rated: false, dismissedAt: null, promptedAt: null, picks: 2, ...over });

describe("US-16 Prompt to rate my last meal", () => {
  it("[ai] T1 unit: 59-minute-old recommendation -> no prompt; 61-minute-old -> prompt", () => {
    expect(shouldPrompt(rec({ createdAt: ago(59) }), now)).toBe(false);
    expect(shouldPrompt(rec({ createdAt: ago(61) }), now)).toBe(true);
  });

  it("[ai] T2 unit: a dismissed or rated recommendation never prompts again", () => {
    expect(shouldPrompt(rec({ dismissedAt: ago(10) }), now)).toBe(false);
    expect(shouldPrompt(rec({ rated: true }), now)).toBe(false);
    expect(shouldPrompt(rec({ promptedAt: ago(5) }), now)).toBe(false);
    expect(shouldPrompt(rec({ picks: 0 }), now)).toBe(false);
  });

  describe("on app open", () => {
    let db: ReturnType<typeof testDb>;
    let s: Awaited<ReturnType<typeof seedRecommendation>>;
    beforeEach(async () => {
      db = testDb();
      s = await seedRecommendation(db);
      db.raw.prepare("UPDATE recommendations SET created_at = ?").run(ago(120));
    });

    it("[ai] AC1/AC2 integration: the prompt appears once per recommendation", async () => {
      const first = await pendingRating(db, s.profileId, now);
      expect(first?.id).toBe(s.recommendationId);
      expect(first?.picks.map((p) => p.name)).toEqual(["Dan Dan Noodles", "Cumin Lamb Noodles (Spicy)"]);
      expect(await pendingRating(db, s.profileId, now)).toBeNull();
    });

    it("[ai] AC1 integration: a rated recommendation is never offered", async () => {
      await rateMeal(db, s.recommendationId, { dishId: s.dishId("Dan Dan Noodles"), rating: 4 });
      expect(await pendingRating(db, s.profileId, now)).toBeNull();
    });

    it("[ai] AC2 integration: GET /profiles/:id/pending-rating and POST /recommendations/:id/dismiss", async () => {
      const app = createApp({ db });
      const dismiss = await app.request(`/recommendations/${s.recommendationId}/dismiss`, { method: "POST" });
      expect(dismiss.status).toBe(204);
      const res = await app.request(`/profiles/${s.profileId}/pending-rating`);
      expect(await res.json()).toEqual({ recommendation: null });
      expect((await app.request("/recommendations/nope/dismiss", { method: "POST" })).status).toBe(404);
    });
  });
});
