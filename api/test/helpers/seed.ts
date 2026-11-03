// Seeds a restaurant with the easy-menu dishes and a few reviews.
import { createRestaurant } from "../../src/restaurants/repo";
import { storeMenu } from "../../src/menu/import";
import { saveReviews, type ReviewRow } from "../../src/reviews/collect";
import { easyMenu } from "../fixtures/menus";
import type { testDb } from "./db";

export const seedReviews: ReviewRow[] = [
  { source_id: "google:1", source: "google", rating: 4, date: "2026-10-01", text: "The dan dan noodles are great but skip the pork dumplings, they were soggy." },
  { source_id: "google:2", source: "google", rating: 5, date: "2026-10-02", text: "Cumin lamb noodles were spicy and perfect. Get them." },
  { source_id: "google:3", source: "google", rating: 5, date: "2026-10-03", text: "Best dan dan noodles in town, numbing and rich." },
  { source_id: "google:4", source: "google", rating: 4, date: "2026-10-04", text: "Loved the dan dan noodles. Service was slow." },
  { source_id: "google:5", source: "google", rating: 3, date: "2026-10-05", text: "Nice patio, friendly staff." },
];

export async function seedRestaurant(db: ReturnType<typeof testDb>, id = "r1", reviews = seedReviews) {
  await createRestaurant(db, { id, name: "Test Noodle House", address: "1 Main St" });
  const menuId = await storeMenu(db, { restaurantId: id, sourceUrl: "https://x", sourceType: "html", snapshotKey: "s", status: "active", attempts: 1, dishes: easyMenu.dishes });
  if (reviews.length) await saveReviews(db, id, reviews);
  const dishes = db.raw.prepare("SELECT id, name FROM dishes WHERE menu_id = ?").all(menuId) as { id: string; name: string }[];
  const reviewRows = db.raw.prepare("SELECT id, source_id FROM reviews WHERE restaurant_id = ?").all(id) as { id: string; source_id: string }[];
  return {
    menuId,
    dishId: (name: string) => dishes.find((d) => d.name === name)!.id,
    reviewId: (sourceId: string) => reviewRows.find((r) => r.source_id === sourceId)!.id,
  };
}
