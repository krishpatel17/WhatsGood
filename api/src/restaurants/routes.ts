import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { createRestaurant, getRestaurant, listRestaurants } from "./repo";
import { searchRestaurants } from "./search";
import { scanMenu, validateUpload, VISION_TYPES } from "../menu/scan";

const NewRestaurantSchema = z.object({ name: z.string().min(1), address: z.string().min(1), area: z.string().optional() });

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
