import { beforeEach, describe, expect, it } from "vitest";
import { auditPicks } from "../src/audit/audit";
import { logEvent } from "../src/events/log";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";
import { seedRecommendation } from "./helpers/recommendation";

describe("US-21 Audit picks for invented dishes and quotes", () => {
  let db: ReturnType<typeof testDb>;
  let s: Awaited<ReturnType<typeof seedRecommendation>>;
  beforeEach(async () => {
    db = testDb();
    s = await seedRecommendation(db);
  });

  it("[ai] T1 integration: a clean log reports 0 invented", async () => {
    const report = await auditPicks(db);
    expect(report).toEqual({ recommendations: 1, picks: 2, quotes: 2, inventedDishes: 0, inventedQuotes: 0, failures: [] });
  });

  it("[ai] T2 integration: a log with one planted fake quote reports exactly 1, with its recommendation ID", async () => {
    await logEvent(db, {
      type: "recommendation_shown",
      profileId: s.profileId,
      restaurantId: "r1",
      recommendationId: "planted",
      picks: [{ dishId: s.dishId("Dan Dan Noodles"), name: "Dan Dan Noodles", quotes: ["Best dan dan noodles in the whole world"] }],
    });
    const report = await auditPicks(db);
    expect(report).toMatchObject({ recommendations: 2, inventedDishes: 0, inventedQuotes: 1 });
    expect(report.failures).toEqual([{ recommendationId: "planted", kind: "quote", detail: 'Dan Dan Noodles: "Best dan dan noodles in the whole world"' }]);
  });

  it("[ai] AC1 integration: a dish missing from the stored menu, or a real quote about another dish, is caught", async () => {
    await logEvent(db, {
      type: "recommendation_shown",
      profileId: s.profileId,
      restaurantId: "r1",
      recommendationId: "bad",
      picks: [
        { dishId: "ghost", name: "Kung Pao Chicken", quotes: [] },
        { dishId: s.dishId("Pork Dumplings"), name: "Pork Dumplings", quotes: ["Best dan dan noodles in town"] },
      ],
    });
    const report = await auditPicks(db);
    expect(report.inventedDishes).toBe(1);
    expect(report.inventedQuotes).toBe(1);
    expect(report.failures.map((f) => f.kind)).toEqual(["dish", "quote"]);
  });

  it("[ai] AC2 integration: GET /admin/audit returns the report", async () => {
    const res = await createApp({ db }).request("/admin/audit");
    expect(await res.json()).toMatchObject({ inventedDishes: 0, inventedQuotes: 0 });
  });
});
