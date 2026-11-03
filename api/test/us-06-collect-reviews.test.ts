import { beforeEach, describe, expect, it } from "vitest";
import { fetchReviews, mapApifyItem, saveReviews } from "../src/reviews/collect";
import { createRestaurant, getRestaurant } from "../src/restaurants/repo";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";
import { apifyItems } from "./fixtures/apify-reviews";

const count = (db: ReturnType<typeof testDb>) => (db.raw.prepare("SELECT COUNT(*) AS n FROM reviews").get() as { n: number }).n;

function apifyFetch(items: unknown[], seen: Request[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return Response.json(items);
  }) as typeof fetch;
}

describe("US-06 Collect a restaurant's reviews", () => {
  let db: ReturnType<typeof testDb>;
  beforeEach(async () => {
    db = testDb();
    await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St", mapsUrl: "https://maps.example/place/test-noodle-house" });
  });

  it("[ai] T1 unit: Apify response mapper produces review rows with all fields", () => {
    expect(mapApifyItem(apifyItems[0])).toEqual({
      source_id: "google:g-001",
      text: "The dan dan noodles are great but skip the dumplings.",
      rating: 4,
      date: "2026-09-14",
      source: "google",
    });
    expect(mapApifyItem(apifyItems[2])).toBeNull(); // rating-only review has no text to quote
    expect(mapApifyItem({ text: "no id" })).toBeNull();
  });

  it("[ai] T2 integration: importing the same batch twice leaves the row count unchanged", async () => {
    const rows = apifyItems.map(mapApifyItem).filter((r) => r !== null);
    await saveReviews(db, "r1", rows);
    expect(count(db)).toBe(3);
    await saveReviews(db, "r1", rows);
    expect(count(db)).toBe(3);
  });

  it("[ai] T3 integration: review count and last-fetched time update after a fetch", async () => {
    const seen: Request[] = [];
    const before = Date.now();
    const result = await fetchReviews({ db, fetch: apifyFetch(apifyItems, seen), apifyToken: "test-token" }, "r1");
    expect(result).toEqual({ fetched: 4, stored: 3, total: 3 });
    const r = (await getRestaurant(db, "r1"))!;
    expect(r.review_count).toBe(3);
    expect(Date.parse(r.reviews_fetched_at!)).toBeGreaterThanOrEqual(before - 1000);
    expect(r.has_reviews).toBe(true);

    expect(seen[0].url).toContain("run-sync-get-dataset-items");
    expect(seen[0].headers.get("authorization")).toBe("Bearer test-token");
    expect(await seen[0].json()).toMatchObject({ startUrls: [{ url: "https://maps.example/place/test-noodle-house" }] });
  });

  it("[ai] fetching needs a token and a maps URL, and reports Apify errors", async () => {
    await expect(fetchReviews({ db, fetch: apifyFetch([]), apifyToken: undefined }, "r1")).rejects.toThrow(/APIFY_TOKEN/);
    await createRestaurant(db, { id: "r2", name: "No Maps", address: "x" });
    await expect(fetchReviews({ db, fetch: apifyFetch([]), apifyToken: "t" }, "r2")).rejects.toThrow(/maps URL/);
    const failing = (async () => new Response("quota", { status: 402 })) as unknown as typeof fetch;
    await expect(fetchReviews({ db, fetch: failing, apifyToken: "t" }, "r1")).rejects.toThrow(/402/);
  });

  it("[ai] AC1 integration: POST /restaurants/:id/reviews/fetch runs the collector", async () => {
    const app = createApp({ db, fetch: apifyFetch(apifyItems), apifyToken: "t" });
    const res = await app.request("/restaurants/r1/reviews/fetch", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fetched: 4, stored: 3, total: 3 });
  });
});
