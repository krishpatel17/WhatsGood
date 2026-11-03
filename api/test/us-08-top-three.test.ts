import { beforeEach, describe, expect, it } from "vitest";
import { buildPrompt, loadContext } from "../src/recommend/context";
import { validatePicks } from "../src/recommend/validate";
import { createApp } from "../src/app";
import { ProfileSchema } from "../src/profile/schema";
import { createProfile } from "../src/profile/repo";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { seedRestaurant } from "./helpers/seed";
import { context, goodPicks } from "./fixtures/recommend-context";

type Seed = Awaited<ReturnType<typeof seedRestaurant>>;

/** Mentions that back three dishes at r1 (as US-07 would store them). */
function seedMentions(db: ReturnType<typeof testDb>, seed: Seed) {
  const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, 'r1', ?, ?, 'x', ?, ?, 1)");
  insert.run("m1", seed.reviewId("google:1"), seed.dishId("Dan Dan Noodles"), 0.8, "The dan dan noodles are great");
  insert.run("m2", seed.reviewId("google:3"), seed.dishId("Dan Dan Noodles"), 1, "Best dan dan noodles in town");
  insert.run("m3", seed.reviewId("google:4"), seed.dishId("Dan Dan Noodles"), 0.6, "Loved the dan dan noodles");
  insert.run("m4", seed.reviewId("google:2"), seed.dishId("Cumin Lamb Noodles (Spicy)"), 0.9, "Cumin lamb noodles were spicy and perfect.");
  insert.run("m5", seed.reviewId("google:1"), seed.dishId("Pork Dumplings"), -0.7, "skip the pork dumplings, they were soggy");
}

const validResponse = {
  picks: [
    { dish: "Dan Dan Noodles", reason: "The most-praised dish here, and you like spicy food.", quotes: ["Best dan dan noodles in town"], mention_count: 3 },
    { dish: "Cumin Lamb Noodles (Spicy)", reason: "Spicy and well loved.", quotes: ["Cumin lamb noodles were spicy and perfect."], mention_count: 1 },
  ],
};

describe("US-08 Get my top 3 dishes", () => {
  let db: ReturnType<typeof testDb>;
  let seed: Seed;
  let profileId: string;
  beforeEach(async () => {
    db = testDb();
    seed = await seedRestaurant(db);
    await seedRestaurant(db, "other");
    db.raw.exec("UPDATE dishes SET name = 'Secret Other Dish' WHERE restaurant_id = 'other' AND name = 'Pork Dumplings'");
    seedMentions(db, seed);
    profileId = await createProfile(db, ProfileSchema.parse({ tastes: ["spicy"], notes: "I love noodles" }));
  });

  it("[ai] T1 unit: prompt builder includes only this restaurant's menu and reviews, plus the profile", async () => {
    const ctx = await loadContext(db, "r1", ProfileSchema.parse({ tastes: ["spicy"], notes: "I love noodles", allergies: ["soy"] }));
    const prompt = JSON.stringify(buildPrompt(ctx));
    expect(prompt).toContain("Dan Dan Noodles");
    expect(prompt).toContain("Best dan dan noodles in town");
    expect(prompt).toContain("mentions: 3");
    expect(prompt).toContain("I love noodles");
    expect(prompt).toContain("Pick up to 2 dishes");
    expect(prompt).not.toContain("Secret Other Dish");
    // Dishes removed by restrictions are not offered to the model.
    expect(prompt).not.toContain("Vegetable Dumplings");
  });

  describe("a dish listed in two sections", () => {
    beforeEach(() => {
      db.raw
        .prepare("INSERT INTO dishes (id, menu_id, restaurant_id, name, section, price, description, tags) SELECT 'lunch-twin', menu_id, restaurant_id, name, 'Lunch', price, description, tags FROM dishes WHERE id = ?")
        .run(seed.dishId("Dan Dan Noodles"));
    });

    it("[ai] T9 unit: the prompt offers it once, with its reviews", async () => {
      const ctx = await loadContext(db, "r1", ProfileSchema.parse({}));
      const prompt = (buildPrompt(ctx)[0] as { text: string }).text;
      expect(prompt.match(/^- Dan Dan Noodles \(/gm)).toHaveLength(1);
      expect(prompt.match(/^- Dan Dan Noodles: mentions: 3/gm)).toHaveLength(1);
      expect(ctx.plan.candidates).toContain(seed.dishId("Dan Dan Noodles"));
      expect(ctx.plan.candidates).not.toContain("lunch-twin");
    });

    it("[ai] T10 unit: plan counts it as one dish", async () => {
      // Soy leaves Dan Dan and its twin plus one other dish, so three rows but two dishes.
      db.raw.exec("UPDATE dishes SET tags = '[{\"tag\":\"soy\",\"source\":\"stated\"}]' WHERE restaurant_id = 'r1' AND name NOT IN ('Dan Dan Noodles', 'Cumin Lamb Noodles (Spicy)')");
      const { plan, allowed } = await loadContext(db, "r1", ProfileSchema.parse({ allergies: ["soy"] }));
      expect(allowed.map((d) => d.name).sort()).toEqual(["Cumin Lamb Noodles (Spicy)", "Dan Dan Noodles", "Dan Dan Noodles"]);
      expect(plan.maxPicks).toBe(2);
      expect(plan.explanation).toBe("Only 2 dishes on this menu fit your profile.");
    });

    it("[ai] T11 integration: the shown and stored picks never repeat it", async () => {
      // Reviews landed on both listings, so both would rank in the top 3.
      db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES ('m6', 'r1', ?, 'lunch-twin', 'x', 1, 'Loved the dan dan noodles', 1)").run(seed.reviewId("google:4"));
      const llm = mockLlm([{ raw: "not json" }, { raw: "not json" }, { raw: "not json" }]);
      const res = await createApp({ db, llm }).request(`/restaurants/r1/recommend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { mode: string; picks: { name: string }[] };
      expect(body.mode).toBe("fallback");
      const names = body.picks.map((p) => p.name);
      expect(names).toContain("Dan Dan Noodles");
      expect(new Set(names).size).toBe(names.length);
      const stored = db.raw.prepare("SELECT picks FROM recommendations").get() as { picks: string };
      expect((JSON.parse(stored.picks) as { name: string }[]).filter((p) => p.name === "Dan Dan Noodles")).toHaveLength(1);
    });
  });

  it("[ai] T2 unit: response parser accepts 1-3 picks and rejects 4", () => {
    expect(validatePicks({ picks: goodPicks.picks.slice(0, 1) }, context()).errors).toEqual([]);
    expect(validatePicks(goodPicks, context()).errors).toEqual([]);
    const four = { picks: [...goodPicks.picks, { dish: "Vegetable Dumplings", reason: "Light.", quotes: [], mention_count: 0 }] };
    expect(validatePicks(four, context()).errors).toContain("returned 4 picks; expected 1 to 3");
  });

  it("[ai] T3 integration: a valid mocked response reaches the client", async () => {
    const llm = mockLlm([validResponse]);
    const app = createApp({ db, llm });
    const res = await app.request("/restaurants/r1/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recommendationId: string; mode: string; picks: { name: string; quotes: string[]; mentionCount: number; reason: string }[]; explanation: string | null };
    expect(body.mode).toBe("llm");
    expect(body.picks.map((p) => p.name)).toEqual(["Dan Dan Noodles", "Cumin Lamb Noodles (Spicy)"]);
    expect(body.picks[0]).toMatchObject({ quotes: ["Best dan dan noodles in town"], mentionCount: 3 });
    expect(body.explanation).toBe("Only 2 dishes that fit your profile have positive reviews.");
    const stored = db.raw.prepare("SELECT profile_id, restaurant_id, mode, picks FROM recommendations WHERE id = ?").get(body.recommendationId) as Record<string, string>;
    expect(stored).toMatchObject({ profile_id: profileId, restaurant_id: "r1", mode: "llm" });
    expect(JSON.parse(stored.picks)[0].name).toBe("Dan Dan Noodles");
  });

  it("[ai] T3 integration: an invalid response goes to the US-12 loop before anything is shown", async () => {
    const invented = { picks: [{ ...validResponse.picks[0], quotes: ["Best noodles on Earth"] }] };
    const llm = mockLlm([invented, validResponse]);
    const app = createApp({ db, llm });
    const res = await app.request("/restaurants/r1/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId }) });
    const body = (await res.json()) as { mode: string; picks: { quotes: string[] }[] };
    expect(llm.calls).toHaveLength(2);
    expect(body.mode).toBe("llm");
    expect(body.picks[0].quotes).toEqual(["Best dan dan noodles in town"]);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM llm_failures").get()).toEqual({ n: 1 });
  });

  it("[ai] T4 integration: a restaurant with zero reviews returns labeled menu-only picks", async () => {
    await seedRestaurant(db, "new", []);
    const llm = mockLlm([{ picks: [{ dish: "Garlic Bok Choy Noodles", reason: "A light noodle dish for a noodle lover.", quotes: [], mention_count: 0 }] }]);
    const app = createApp({ db, llm });
    const res = await app.request("/restaurants/new/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId }) });
    const body = (await res.json()) as { picks: { labels: string[] }[]; explanation: string };
    expect(body.picks[0].labels).toEqual(["menu_only"]);
    expect(body.explanation).toMatch(/menu only/);
  });

  it("[ai] AC1 integration: unknown restaurant or profile is 404, no loaded menu is 409, and the fallback list needs no model", async () => {
    const app = createApp({ db, llm: mockLlm([]) });
    const post = (path: string, body: object) => app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await post("/restaurants/nope/recommend", { profileId })).status).toBe(404);
    expect((await post("/restaurants/r1/recommend", { profileId: "nope" })).status).toBe(404);
    db.raw.exec("INSERT INTO restaurants (id, name, address, created_at) VALUES ('empty', 'Empty', 'x', '2026-11-01')");
    expect((await post("/restaurants/empty/recommend", { profileId })).status).toBe(409);
    const fb = await app.request(`/restaurants/r1/fallback?profileId=${profileId}`);
    const body = (await fb.json()) as { mode: string; picks: { name: string; reason: null }[] };
    expect(body.mode).toBe("fallback");
    expect(body.picks.map((p) => p.name)).toEqual(["Dan Dan Noodles", "Cumin Lamb Noodles (Spicy)"]);
  });
});
