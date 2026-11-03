import { type Db, newId, nowIso } from "../db";
import type { RestaurantRow } from "./search";

export type NewRestaurant = { id?: string; name: string; address: string; area?: string; mapsUrl?: string };

export async function createRestaurant(db: Db, r: NewRestaurant): Promise<string> {
  const id = r.id ?? newId();
  await db
    .prepare("INSERT INTO restaurants (id, name, address, area, maps_url, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, r.name, r.address, r.area ?? null, r.mapsUrl ?? null, nowIso())
    .run();
  return id;
}

const WITH_FLAGS = `
  SELECT r.id, r.name, r.address, r.review_count, r.reviews_fetched_at,
    EXISTS (SELECT 1 FROM menus m WHERE m.restaurant_id = r.id AND m.status = 'active') AS has_menu,
    r.review_count > 0 AS has_reviews
  FROM restaurants r`;

type FlagRow = Omit<RestaurantRow, "has_menu" | "has_reviews"> & {
  has_menu: number;
  has_reviews: number;
  review_count: number;
  reviews_fetched_at: string | null;
};

const toRow = (r: FlagRow) => ({ ...r, has_menu: !!r.has_menu, has_reviews: !!r.has_reviews });

export async function listRestaurants(db: Db) {
  const { results } = await db.prepare(WITH_FLAGS).all<FlagRow>();
  return results.map(toRow);
}

export async function getRestaurant(db: Db, id: string) {
  const row = await db.prepare(`${WITH_FLAGS} WHERE r.id = ?`).bind(id).first<FlagRow>();
  return row ? toRow(row) : null;
}

export async function setReviewStats(db: Db, id: string, count: number, fetchedAt = nowIso()): Promise<void> {
  await db.prepare("UPDATE restaurants SET review_count = ?, reviews_fetched_at = ? WHERE id = ?").bind(count, fetchedAt, id).run();
}
