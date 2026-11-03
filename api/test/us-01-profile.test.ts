import { beforeEach, describe, expect, it } from "vitest";
import { ProfileSchema, restrictionFilters } from "../src/profile/schema";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";

const full = {
  allergies: ["peanut"],
  diets: ["no_pork"],
  budget: 18,
  tastes: ["spicy"],
  notes: "I love noodles",
};

describe("US-01 Set up my profile once", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    app = createApp({ db: testDb() });
  });

  const json = (method: string, body: unknown) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  it("[ai] T1 unit: schema rejects unknown allergy or diet values and a negative budget", () => {
    expect(ProfileSchema.safeParse(full).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...full, allergies: ["kryptonite"] }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...full, diets: ["carnivore-only"] }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...full, budget: -1 }).success).toBe(false);
  });

  it("[ai] T2 integration: POST then GET returns the same profile", async () => {
    const created = await app.request("/profiles", json("POST", full));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const got = await app.request(`/profiles/${id}`);
    expect(got.status).toBe(200);
    expect(await got.json()).toMatchObject({ id, ...full });
  });

  it("[ai] T3 integration: PATCH of one field leaves the other fields unchanged", async () => {
    const { id } = (await (await app.request("/profiles", json("POST", full))).json()) as { id: string };
    const patched = await app.request(`/profiles/${id}`, json("PATCH", { budget: 25 }));
    expect(patched.status).toBe(200);
    const got = await (await app.request(`/profiles/${id}`)).json();
    expect(got).toMatchObject({ ...full, budget: 25 });
  });

  it("[ai] T4 unit: an empty profile produces an empty restriction filter set", () => {
    const empty = ProfileSchema.parse({});
    expect(empty).toMatchObject({ allergies: [], diets: [], budget: null, tastes: [], notes: "" });
    expect(restrictionFilters(empty).size).toBe(0);
    expect([...restrictionFilters(ProfileSchema.parse(full))].sort()).toEqual(["no_pork", "peanut"]);
  });

  it("[ai] AC1/AC4: an invalid body is rejected with 400 and an empty body is accepted", async () => {
    expect((await app.request("/profiles", json("POST", { budget: -5 }))).status).toBe(400);
    expect((await app.request("/profiles", json("POST", {}))).status).toBe(201);
  });

  it("[ai] unknown profile id returns 404", async () => {
    expect((await app.request("/profiles/nope")).status).toBe(404);
    expect((await app.request("/profiles/nope", json("PATCH", { budget: 1 }))).status).toBe(404);
  });
});
