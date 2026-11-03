import { beforeEach, describe, expect, it } from "vitest";
import { searchRestaurants } from "../src/restaurants/search";
import { createRestaurant, setReviewStats } from "../src/restaurants/repo";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";

const restaurants = [
  { id: "r1", name: "Bodo's Bagels", address: "1418 N Emmet St" },
  { id: "r2", name: "Marco & Luca", address: "112 W Main St" },
  { id: "r3", name: "Citizen Burger Bar", address: "212 E Main St" },
];

describe("US-02 Pick the restaurant I'm at", () => {
  it("[ai] T1 unit: fuzzy search returns the expected restaurant for case and typo variants", () => {
    const rows = restaurants.map((r) => ({ ...r, has_menu: false, has_reviews: false }));
    for (const q of ["bodos", "BODO'S", "bodo", "bodso bagel", "Bodos Bagles"]) {
      expect(searchRestaurants(rows, q)[0]?.id, q).toBe("r1");
    }
    expect(searchRestaurants(rows, "marco luca")[0]?.id).toBe("r2");
    expect(searchRestaurants(rows, "citizen")[0]?.id).toBe("r3");
    expect(searchRestaurants(rows, "zzzz")).toEqual([]);
  });

  describe("with a database", () => {
    let db: ReturnType<typeof testDb>;
    let app: ReturnType<typeof createApp>;
    beforeEach(async () => {
      db = testDb();
      app = createApp({ db });
      for (const r of restaurants) await createRestaurant(db, r);
    });

    it("[ai] T2 unit: results carry has_menu and has_reviews flags", async () => {
      await setReviewStats(db, "r1", 12);
      db.raw.exec("INSERT INTO menus (id, restaurant_id, source_url, source_type, status, created_at) VALUES ('m1','r1','https://x','html','active','2026-11-01')");
      const res = await app.request("/restaurants?q=bodos");
      const body = (await res.json()) as { results: { id: string; has_menu: boolean; has_reviews: boolean; address: string }[] };
      expect(body.results[0]).toMatchObject({ id: "r1", address: "1418 N Emmet St", has_menu: true, has_reviews: true });
      const other = (await (await app.request("/restaurants?q=citizen")).json()) as typeof body;
      expect(other.results[0]).toMatchObject({ id: "r3", has_menu: false, has_reviews: false });
    });

    it("[ai] T3 integration: searching for an unknown name offers the scan-menu option", async () => {
      const body = (await (await app.request("/restaurants?q=nonexistent+diner")).json()) as { results: unknown[]; suggest?: string };
      expect(body.results).toEqual([]);
      expect(body.suggest).toBe("scan_menu");
    });

    it("[ai] a needs_review menu does not count as a loaded menu", async () => {
      db.raw.exec("INSERT INTO menus (id, restaurant_id, source_url, source_type, status, created_at) VALUES ('m2','r2','https://x','pdf','needs_review','2026-11-01')");
      const body = (await (await app.request("/restaurants?q=marco")).json()) as { results: { has_menu: boolean }[] };
      expect(body.results[0].has_menu).toBe(false);
    });
  });
});
