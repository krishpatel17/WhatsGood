import { Hono } from "hono";
import type { AppEnv } from "../app";
import { getRecommendation, rateMeal } from "./rating";
import { dismissPrompt } from "./prompt";

export const recommendationRoutes = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const rec = await getRecommendation(c.get("deps").db, c.req.param("id"));
    return rec ? c.json(rec) : c.json({ error: "not found" }, 404);
  })
  .post("/:id/dismiss", async (c) => {
    return (await dismissPrompt(c.get("deps").db, c.req.param("id"))) ? c.body(null, 204) : c.json({ error: "not found" }, 404);
  })
  .post("/:id/rating", async (c) => {
    const result = await rateMeal(c.get("deps").db, c.req.param("id"), await c.req.json().catch(() => ({})));
    return result.ok ? c.json({ ratingId: result.ratingId }, 201) : c.json({ error: result.error }, result.status);
  });
