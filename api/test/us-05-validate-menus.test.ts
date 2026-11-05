import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { countCheck, layoutItemCount, mergeDuplicates, NO_DISHES, parsePrice, validateMenu } from "../src/menu/validate";
import { importMenu, retryMessage } from "../src/menu/import";
import { createRestaurant, getRestaurant } from "../src/restaurants/repo";
import type { Dish } from "../src/menu/schema";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const html = readFileSync(import.meta.dirname + "/fixtures/menu-easy.html", "utf8");
const URL_EASY = "https://testnoodlehouse.example/menu";
const dish = (over: Partial<Dish> = {}): Dish => ({ name: "Pork Dumplings", section: "Dumplings", price: 9, description: null, tags: [], ...over });

describe("US-05 Validate imported menus", () => {
  it("[ai] T1 unit: price parser handles '$12', '12.50', 'MP', '$9/$14' and rejects '$900'", () => {
    expect(parsePrice("$12")).toEqual({ ok: true, value: 12 });
    expect(parsePrice("12.50")).toEqual({ ok: true, value: 12.5 });
    expect(parsePrice("MP")).toEqual({ ok: true, value: null });
    expect(parsePrice("Market Price")).toEqual({ ok: true, value: null });
    expect(parsePrice("$9/$14")).toEqual({ ok: true, value: 9 });
    expect(parsePrice("$900").ok).toBe(false);
    expect(parsePrice("-3").ok).toBe(false);
    expect(parsePrice("twelve").ok).toBe(false);
  });

  it("[ai] T2 unit: count check passes at ±15% and fails at ±16%", () => {
    expect(countCheck(85, 100)).toBeNull();
    expect(countCheck(115, 100)).toBeNull();
    expect(countCheck(84, 100)).toMatch(/84.*100/);
    expect(countCheck(116, 100)).toMatch(/116.*100/);
    expect(countCheck(3, null)).toBeNull();
  });

  it("[ai] T2b unit: the layout count counts lines with a price, without the model", () => {
    expect(layoutItemCount("Noodles\nDan Dan $14\nwheat noodles\nLamb $16.50\nTea 4.00")).toBe(3);
  });

  it("[ai] T3 unit: duplicate merge keeps one dish per normalized name and section", () => {
    const merged = mergeDuplicates([
      dish({ tags: [{ tag: "pork", source: "stated" }] }),
      dish({ name: "pork  dumplings!", tags: [{ tag: "soy", source: "inferred" }] }),
      dish({ section: "Lunch Specials" }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe("Pork Dumplings");
    expect(merged[0].tags).toEqual([
      { tag: "pork", source: "stated" },
      { tag: "soy", source: "inferred" },
    ]);
  });

  it("[ai] AC1 unit: validateMenu flags a price outside $0-$500 with the dish index", () => {
    const { errors } = validateMenu(null)({ dishes: [dish(), dish({ name: "Caviar Tower", price: 900 })] });
    expect(errors).toEqual(['dishes[1] "Caviar Tower": price 900 is outside $0-$500']);
  });

  it("[ai] an empty menu fails validation: as no dishes when the page has no layout count, as a count mismatch when it has one", () => {
    expect(validateMenu(null)({ dishes: [] }).errors).toEqual([NO_DISHES]);
    expect(validateMenu(0)({ dishes: [] }).errors).toEqual([NO_DISHES]);
    expect(validateMenu(5)({ dishes: [] }).errors).toEqual(["item count 0 is not within 15% of the page layout count 5"]);
  });

  describe("layout count trust", () => {
    const priced = (n: number) => Array.from({ length: n }, (_, i) => `Dish ${i} $${10 + i}`);
    const dishes = (n: number) => Array.from({ length: n }, (_, i) => dish({ name: `Dish ${i}` }));

    it("[ai] on a page with a reliable count, truncated and far too long menus are rejected and a correct one passes", () => {
      const check = validateMenu(layoutItemCount(priced(40).join("\n")));
      expect(check({ dishes: dishes(40) }).errors).toEqual([]);
      expect(check({ dishes: dishes(10) }).errors).toEqual(["item count 10 is not within 15% of the page layout count 40"]);
      expect(check({ dishes: dishes(120) }).errors).toEqual(["item count 120 is not within 15% of the page layout count 40"]);
    });

    it("[ai] the count is not trusted when prices are bare numbers or split from their dollar sign", () => {
      expect(layoutItemCount("Soup\n8\nStew\n$\n13\nCake\n7\nTea $4.00")).toBeNull();
    });

    it("[ai] the count is not trusted when prices are printed on both sides of each description", () => {
      expect(layoutItemCount("Samosa\n$6.99\nFour pastries\n$6.99\nBolani\n$4.50\nLeek turnover\n$4.50")).toBeNull();
    });

    it("[ai] the count is not trusted when priced lines hold several items or add-ons", () => {
      expect(layoutItemCount("SLAW ($5) • FRIES ($4) • GRITS ($5)\nBEANS ($6) • GREENS ($6)\nBurger $12")).toBeNull();
      expect(layoutItemCount("Burger $12\n+ Add bacon for $2\nAdd cheese $1\nSoup $7")).toBeNull();
    });

    it("[ai] a little noise, under the 15% tolerance, does not lose trust in the count", () => {
      expect(layoutItemCount(["0", ...priced(20)].join("\n"))).toBe(20);
    });

    it("[ai] structured data is not counted, because it is long lines of JSON rather than page layout", () => {
      expect(layoutItemCount(`Menu\nSoup $8\n\nSTRUCTURED DATA:\n{"a":"$9.00"}\n{"b":"$7.00"}`)).toBe(1);
    });

    it("[ai] an untrusted count skips the check, so a full menu is stored on the first attempt", async () => {
      const db = testDb();
      await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
      const body = "<p>Soup</p><p>8</p><p>Stew</p><p>13</p><p>Cake</p><p>7</p><p>Tea $4.00</p>";
      const llm = mockLlm([{ dishes: dishes(58) }]);
      const result = await importMenu({ db, blobs: memoryBlobs(), llm, fetch: fakeFetch({ [URL_EASY]: { body, contentType: "text/html" } }) }, { restaurantId: "r1", url: URL_EASY });
      expect(result).toMatchObject({ status: "active", attempts: 1, dishCount: 58 });
    });
  });

  it("[ai] T5 unit: the retry message lists each failed check", () => {
    const msg = retryMessage(2, ['dishes[1] "Caviar Tower": price 900 is outside $0-$500', "item count 3 is not within 15% of the page layout count 5"]);
    expect(msg).toContain("VALIDATION FAILED (attempt 2/3):");
    expect(msg).toContain('- dishes[1] "Caviar Tower": price 900 is outside $0-$500');
    expect(msg).toContain("- item count 3 is not within 15% of the page layout count 5");
  });

  describe("import with validation", () => {
    let db: ReturnType<typeof testDb>;
    const fetch = fakeFetch({ [URL_EASY]: { body: html, contentType: "text/html" } });
    beforeEach(async () => {
      db = testDb();
      await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    });
    const tooFew = { dishes: easyMenu.dishes.slice(0, 2) };

    it("[ai] T4 integration: 3 failing attempts end in needs_review; a pass on attempt 2 stores the menu", async () => {
      const failing = await importMenu({ db, blobs: memoryBlobs(), llm: mockLlm([tooFew, tooFew, tooFew]), fetch }, { restaurantId: "r1", url: URL_EASY });
      expect(failing).toMatchObject({ status: "needs_review", attempts: 3, dishCount: 0 });
      expect((await getRestaurant(db, "r1"))!.has_menu).toBe(false);

      const llm = mockLlm([tooFew, easyMenu]);
      const passing = await importMenu({ db, blobs: memoryBlobs(), llm, fetch }, { restaurantId: "r1", url: URL_EASY });
      expect(passing).toMatchObject({ status: "active", attempts: 2, dishCount: 5 });
      expect((await getRestaurant(db, "r1"))!.has_menu).toBe(true);
      expect(JSON.stringify(llm.calls[1].messages)).toContain("item count 2 is not within 15% of the page layout count 5");
    });

    it("[ai] AC5 integration: every attempt is logged with its failed checks", async () => {
      await importMenu({ db, blobs: memoryBlobs(), llm: mockLlm([tooFew, easyMenu]), fetch }, { restaurantId: "r1", url: URL_EASY });
      const rows = db.raw.prepare("SELECT attempt, ok, failed_checks FROM menu_import_attempts ORDER BY attempt").all() as { attempt: number; ok: number; failed_checks: string }[];
      expect(rows.map((r) => [r.attempt, r.ok])).toEqual([
        [1, 0],
        [2, 1],
      ]);
      expect(JSON.parse(rows[0].failed_checks)[0]).toMatch(/item count 2/);
      expect(JSON.parse(rows[1].failed_checks)).toEqual([]);
    });
  });
});
