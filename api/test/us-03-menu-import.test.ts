import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pickExtractor } from "../src/menu/fetcher";
import { MenuSchema } from "../src/menu/schema";
import { importMenu } from "../src/menu/import";
import { NO_DISHES } from "../src/menu/validate";
import { createRestaurant } from "../src/restaurants/repo";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const html = readFileSync(import.meta.dirname + "/fixtures/menu-easy.html", "utf8");
const URL_EASY = "https://testnoodlehouse.example/menu";

describe("US-03 Import a menu from a restaurant's website", () => {
  it("[ai] T1 unit: fetcher picks the right extractor for HTML, PDF and ordering-page URLs", () => {
    expect(pickExtractor("https://cafe.example/menu", "text/html; charset=utf-8")).toBe("html");
    expect(pickExtractor("https://cafe.example/files/Dinner-Menu.PDF", "application/octet-stream")).toBe("pdf");
    expect(pickExtractor("https://cafe.example/menu", "application/pdf")).toBe("pdf");
    expect(pickExtractor("https://www.toasttab.com/local/order/some-cafe", "text/html")).toBe("ordering-page");
    expect(pickExtractor("https://some-cafe.square.site/", "text/html")).toBe("ordering-page");
    expect(pickExtractor("https://order.chownow.com/order/123/locations/456", "text/html")).toBe("ordering-page");
    expect(pickExtractor("https://cafe.example/menu.jpg", "image/jpeg")).toBe("image");
  });

  it("[ai] T2 unit: schema validator accepts a valid menu fixture and rejects a missing name, a string price, and an unknown tag source", () => {
    expect(MenuSchema.safeParse(easyMenu).success).toBe(true);
    const first = easyMenu.dishes[0];
    const withDish = (d: object) => ({ dishes: [d] });
    const { name: _omit, ...noName } = first;
    expect(MenuSchema.safeParse(withDish(noName)).success).toBe(false);
    expect(MenuSchema.safeParse(withDish({ ...first, price: "14" })).success).toBe(false);
    expect(MenuSchema.safeParse(withDish({ ...first, tags: [{ tag: "pork", source: "guessed" }] })).success).toBe(false);
    expect(MenuSchema.safeParse(withDish({ ...first, price: null, description: null })).success).toBe(true);
  });

  describe("import pipeline", () => {
    let db: ReturnType<typeof testDb>;
    let blobs: ReturnType<typeof memoryBlobs>;
    const fetch = fakeFetch({ [URL_EASY]: { body: html, contentType: "text/html" } });
    beforeEach(async () => {
      db = testDb();
      blobs = memoryBlobs();
      await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    });

    it("[ai] T3 integration: importing a saved HTML fixture (mocked LLM) stores the dishes, source URL and snapshot", async () => {
      const llm = mockLlm([easyMenu]);
      const result = await importMenu({ db, blobs, llm, fetch }, { restaurantId: "r1", url: URL_EASY });
      expect(result.status).toBe("active");

      const menu = db.raw.prepare("SELECT * FROM menus WHERE id = ?").get(result.menuId) as Record<string, string>;
      expect(menu).toMatchObject({ restaurant_id: "r1", source_url: URL_EASY, source_type: "html", status: "active" });
      expect(menu.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const snapshot = await blobs.get(menu.snapshot_key);
      expect(await snapshot!.text()).toBe(html);

      const dishes = db.raw.prepare("SELECT name, section, price, tags FROM dishes WHERE menu_id = ? ORDER BY name").all(result.menuId) as Record<string, unknown>[];
      expect(dishes.map((d) => d.name)).toEqual(["Cumin Lamb Noodles (Spicy)", "Dan Dan Noodles", "Garlic Bok Choy Noodles", "Pork Dumplings", "Vegetable Dumplings"]);
      expect(JSON.parse(String(dishes[1].tags))).toContainEqual({ tag: "peanut", source: "stated" });

      // The model sees the page text, not scripts or styles.
      const sent = JSON.stringify(llm.calls[0].messages);
      expect(sent).toContain("Dan Dan Noodles");
      expect(sent).not.toContain("window.analytics");
    });

    it("[ai] T4 integration: a malformed LLM response triggers a retry instead of being stored", async () => {
      const llm = mockLlm([{ raw: "Sure! Here is the menu: {dishes: [" }, { dishes: [{ section: "Noodles", price: 14 }] }, easyMenu]);
      const result = await importMenu({ db, blobs, llm, fetch }, { restaurantId: "r1", url: URL_EASY });
      expect(llm.calls).toHaveLength(3);
      expect(result.status).toBe("active");
      const count = db.raw.prepare("SELECT COUNT(*) AS n FROM dishes").get() as { n: number };
      expect(count.n).toBe(5);
    });

    describe("a page with no dishes (its menu is loaded by JavaScript)", () => {
      const URL_JS = "https://testnoodlehouse.example/eat";
      const jsPage = `<html><body><h1>The Food</h1><div id="menu"></div><script>loadMenu()</script></body></html>`;
      const pages = fakeFetch({ [URL_EASY]: { body: html, contentType: "text/html" }, [URL_JS]: { body: jsPage, contentType: "text/html" } });
      const statuses = () => db.raw.prepare("SELECT id, status FROM menus ORDER BY created_at, rowid").all() as { id: string; status: string }[];

      it("[ai] zero dishes ends in needs_review and stores nothing", async () => {
        const result = await importMenu({ db, blobs, llm: mockLlm([{ dishes: [] }]), fetch: pages }, { restaurantId: "r1", url: URL_JS });
        expect(result).toMatchObject({ status: "needs_review", dishCount: 0 });
        expect(result.failures.at(-1)).toEqual([NO_DISHES]);
        expect(statuses()).toEqual([{ id: result.menuId, status: "needs_review" }]);
      });

      it("[ai] zero dishes does not replace the restaurant's active menu", async () => {
        const good = await importMenu({ db, blobs, llm: mockLlm([easyMenu]), fetch: pages }, { restaurantId: "r1", url: URL_EASY });
        const empty = await importMenu({ db, blobs, llm: mockLlm([{ dishes: [] }]), fetch: pages }, { restaurantId: "r1", url: URL_JS });
        expect(statuses()).toEqual([
          { id: good.menuId, status: "active" },
          { id: empty.menuId, status: "needs_review" },
        ]);
        const active = db.raw.prepare("SELECT COUNT(*) AS n FROM dishes d JOIN menus m ON m.id = d.menu_id WHERE m.restaurant_id = 'r1' AND m.status = 'active'").get();
        expect(active).toEqual({ n: 5 });
      });

      it("[ai] the model is not asked again, so a retry cannot invent dishes that replace a good menu", async () => {
        const invented = { dishes: [{ name: "Invented Burger", section: "", price: 12, description: null, tags: [] }] };
        const llm = mockLlm([{ dishes: [] }, invented]);
        const result = await importMenu({ db, blobs, llm, fetch: pages }, { restaurantId: "r1", url: URL_JS });
        expect(llm.calls).toHaveLength(1);
        expect(result).toMatchObject({ status: "needs_review", attempts: 1 });
      });

      it("[ai] zero dishes on a page with priced lines is still retried, because the page shows there are dishes", async () => {
        const llm = mockLlm([{ dishes: [] }, easyMenu]);
        const result = await importMenu({ db, blobs, llm, fetch: pages }, { restaurantId: "r1", url: URL_EASY });
        expect(result).toMatchObject({ status: "active", attempts: 2, dishCount: 5 });
      });
    });

    it("[ai] a page that cannot be fetched is reported, not stored", async () => {
      const llm = mockLlm([]);
      await expect(importMenu({ db, blobs, llm, fetch }, { restaurantId: "r1", url: "https://missing.example/" })).rejects.toThrow(/404/);
      expect(llm.calls).toHaveLength(0);
    });
  });
});
