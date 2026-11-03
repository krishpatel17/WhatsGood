import { Hono } from "hono";
import type { AppEnv } from "../app";
import { ProfilePatchSchema, ProfileSchema } from "./schema";
import { createProfile, getProfile, updateProfile } from "./repo";
import { pendingRating } from "../feedback/prompt";

export const profileRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
    const parsed = ProfileSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const id = await createProfile(c.get("deps").db, parsed.data);
    return c.json({ id, ...parsed.data }, 201);
  })
  .get("/:id", async (c) => {
    const profile = await getProfile(c.get("deps").db, c.req.param("id"));
    return profile ? c.json({ id: c.req.param("id"), ...profile }) : c.json({ error: "not found" }, 404);
  })
  .get("/:id/pending-rating", async (c) => {
    return c.json({ recommendation: await pendingRating(c.get("deps").db, c.req.param("id")) });
  })
  .patch("/:id", async (c) => {
    const parsed = ProfilePatchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const profile = await updateProfile(c.get("deps").db, c.req.param("id"), parsed.data);
    return profile ? c.json({ id: c.req.param("id"), ...profile }) : c.json({ error: "not found" }, 404);
  });
