import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { createRestaurant, getRestaurant, listRestaurants } from "./repo";
import { searchRestaurants } from "./search";
import { scanMenu, validateUpload, VISION_TYPES } from "../menu/scan";
import { fetchReviews } from "../reviews/collect";
import { importFailureMessage, importMenu } from "../menu/import";
import { extractMentions } from "../reviews/mentions";
import { getProfile } from "../profile/repo";
import { quickFallback, recommend } from "../recommend/service";

const NewRestaurantSchema = z.object({ name: z.string().min(1), address: z.string().min(1), area: z.string().optional(), mapsUrl: z.url().optional() });

export const restaurantRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await listRestaurants(c.get("deps").db);
    const q = c.req.query("q") ?? "";
    const results = q ? searchRestaurants(rows, q) : rows;
    return c.json(results.length ? { results } : { results, suggest: "scan_menu" });
  })
  .get("/:id", async (c) => {
    const row = await getRestaurant(c.get("deps").db, c.req.param("id"));
    return row ? c.json(row) : c.json({ error: "not found" }, 404);
  })
  .post("/:id/menu", async (c) => {
    const deps = c.get("deps");
    if (!(await getRestaurant(deps.db, c.req.param("id")))) return c.json({ error: "not found" }, 404);
    const body = z.object({ url: z.url() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "send { url } with the menu page, PDF or ordering page" }, 400);
    const result = await importMenu(deps, { restaurantId: c.req.param("id"), url: body.data.url });
    if (result.status === "needs_review") return c.json({ ...result, error: importFailureMessage(result.failures) }, 422);
    return c.json(result, 201);
  })
  .post("/:id/reviews/fetch", async (c) => {
    const { db, fetch, apifyToken } = c.get("deps");
    if (!(await getRestaurant(db, c.req.param("id")))) return c.json({ error: "not found" }, 404);
    return c.json(await fetchReviews({ db, fetch, apifyToken }, c.req.param("id")));
  })
  .post("/:id/reviews/extract", async (c) => {
    const { db, llm } = c.get("deps");
    if (!(await getRestaurant(db, c.req.param("id")))) return c.json({ error: "not found" }, 404);
    return c.json(await extractMentions({ db, llm }, c.req.param("id")));
  })
  .post("/:id/recommend", async (c) => {
    const { db, llm } = c.get("deps");
    const body = (await c.req.json().catch(() => ({}))) as { profileId?: string };
    const [restaurant, profile] = await Promise.all([getRestaurant(db, c.req.param("id")), getProfile(db, body.profileId ?? "")]);
    if (!restaurant || !profile) return c.json({ error: restaurant ? "profile not found" : "restaurant not found" }, 404);
    if (!restaurant.has_menu) return c.json({ error: "no menu loaded", suggest: "scan_menu" }, 409);
    return c.json(await recommend({ db, llm }, restaurant.id, body.profileId!, profile));
  })
  .get("/:id/fallback", async (c) => {
    const { db } = c.get("deps");
    const [restaurant, profile] = await Promise.all([getRestaurant(db, c.req.param("id")), getProfile(db, c.req.query("profileId") ?? "")]);
    if (!restaurant || !profile) return c.json({ error: "not found" }, 404);
    return c.json(await quickFallback(db, restaurant.id, profile));
  })
  .post("/:id/scan", async (c) => {
    const { db, blobs, llm } = c.get("deps");
    if (!(await getRestaurant(db, c.req.param("id")))) return c.json({ error: "not found" }, 404);
    const body = await c.req.parseBody();
    const photo = body.photo;
    if (!(photo instanceof File)) return c.json({ error: "Attach the photo as the 'photo' field." }, 400);
    const problem = validateUpload(photo);
    if (problem) return c.json({ error: problem }, 400);
    const mediaType = VISION_TYPES.find((t) => t === photo.type);
    if (!mediaType) return c.json({ error: "HEIC photos must be converted to JPEG before upload." }, 415);
    const result = await scanMenu({ db, blobs, llm }, { restaurantId: c.req.param("id"), bytes: new Uint8Array(await photo.arrayBuffer()), mediaType });
    return c.json(result, result.status === "retake" ? 422 : 201);
  })
  .post("/", async (c) => {
    const parsed = NewRestaurantSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const id = await createRestaurant(c.get("deps").db, parsed.data);
    return c.json({ id, ...parsed.data }, 201);
  });
