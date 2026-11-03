import { type Db, newId, nowIso } from "../db";
import { setReviewStats } from "../restaurants/repo";

export type ReviewRow = { source_id: string; text: string; rating: number | null; date: string | null; source: string };

// Apify actor that scrapes Google Maps reviews for a place URL.
export const APIFY_ACTOR = "compass~google-maps-reviews-scraper";
export const MAX_REVIEWS = 300;

/** One Apify dataset item to a review row, or null if it has no text we could quote. */
export function mapApifyItem(item: Record<string, unknown>): ReviewRow | null {
  const id = item.reviewId;
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (typeof id !== "string" || !text) return null;
  const published = typeof item.publishedAtDate === "string" ? item.publishedAtDate.slice(0, 10) : null;
  return { source_id: `google:${id}`, text, rating: typeof item.stars === "number" ? item.stars : null, date: published, source: "google" };
}

export async function countReviews(db: Db, restaurantId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE restaurant_id = ?").bind(restaurantId).first<{ n: number }>();
  return row?.n ?? 0;
}

/** Store reviews, skipping any source ID already stored for this restaurant. Returns the new total. */
export async function saveReviews(db: Db, restaurantId: string, rows: ReviewRow[]): Promise<number> {
  const fetchedAt = nowIso();
  for (const r of rows) {
    await db
      .prepare("INSERT OR IGNORE INTO reviews (id, restaurant_id, source_id, source, text, rating, date, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(newId(), restaurantId, r.source_id, r.source, r.text, r.rating, r.date, fetchedAt)
      .run();
  }
  const total = await countReviews(db, restaurantId);
  await setReviewStats(db, restaurantId, total, fetchedAt);
  return total;
}

export async function fetchReviews(deps: { db: Db; fetch: typeof fetch; apifyToken?: string }, restaurantId: string) {
  if (!deps.apifyToken) throw new Error("APIFY_TOKEN is not set");
  const place = await deps.db.prepare("SELECT maps_url FROM restaurants WHERE id = ?").bind(restaurantId).first<{ maps_url: string | null }>();
  if (!place?.maps_url) throw new Error(`Restaurant ${restaurantId} has no maps URL to collect reviews from`);

  const res = await deps.fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`, {
    method: "POST",
    headers: { authorization: `Bearer ${deps.apifyToken}`, "content-type": "application/json" },
    body: JSON.stringify({ startUrls: [{ url: place.maps_url }], maxReviews: MAX_REVIEWS, reviewsSort: "newest", language: "en" }),
  });
  if (!res.ok) throw new Error(`Apify request failed with HTTP ${res.status}`);
  const items = (await res.json()) as Record<string, unknown>[];
  const rows = items.map(mapApifyItem).filter((r): r is ReviewRow => r !== null);
  const before = await countReviews(deps.db, restaurantId);
  const total = await saveReviews(deps.db, restaurantId, rows);
  return { fetched: items.length, stored: total - before, total };
}
