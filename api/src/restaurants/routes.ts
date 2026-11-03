import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { createRestaurant, getRestaurant, listRestaurants } from "./repo";
import { searchRestaurants } from "./search";

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
  .post("/", async (c) => {
    const parsed = NewRestaurantSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const id = await createRestaurant(c.get("deps").db, parsed.data);
    return c.json({ id, ...parsed.data }, 201);
  });
