import { beforeEach, describe, expect, it } from "vitest";
import { pickExtractor } from "../src/menu/fetcher";
import { importMenu } from "../src/menu/import";
import { type Scroller, scrollUntilEnd } from "../src/menu/scroll";
import { createRestaurant } from "../src/restaurants/repo";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";

const dish = (name: string, price: number | null) => ({ name, section: "Mains", price, description: null, tags: [] });

/** A page that loads another screenful each time the reader reaches the bottom, `loads` times. */
function lazyPage(opts: { viewport: number; height: number; loads: number; grow: number }) {
  let y = 0;
  let height = opts.height;
  let loads = opts.loads;
  const atBottom = () => y + opts.viewport >= height;
  const page: Scroller & { steps: number; height: () => number } = {
    steps: 0,
    height: () => height,
    scrollBy: async () => {
      page.steps++;
      y = Math.min(y + opts.viewport * 0.8, height - opts.viewport);
    },
    atBottom: async () => atBottom(),
    wait: async () => {
      if (atBottom() && loads > 0) {
        loads--;
        height += opts.grow;
      }
    },
  };
  return page;
}

describe("US-03 Import a menu: long ordering pages (A2 v4)", () => {
  it("[ai] AC1 unit: scrolling goes one screen at a time until the page stops growing", async () => {
    const page = lazyPage({ viewport: 700, height: 3800, loads: 3, grow: 600 });
    await scrollUntilEnd(page, { pauseMs: 0, settleMs: 0 });
    expect(page.height()).toBe(3800 + 3 * 600); // every lazy section loaded
    expect(await page.atBottom()).toBe(true);
  });

  it("[ai] AC1 unit: a page that never stops growing is cut off after a fixed number of steps", async () => {
    const page = lazyPage({ viewport: 700, height: 3800, loads: Infinity, grow: 600 });
    await scrollUntilEnd(page, { pauseMs: 0, settleMs: 0, maxSteps: 25 });
    expect(page.steps).toBe(25);
  });

  it("[ai] AC1 unit: Clover online ordering is an ordering page", () => {
    expect(pickExtractor("https://www.clover.com/online-ordering/otto-eats-catering-cville", "text/html")).toBe("ordering-page");
  });
});

describe("US-03 Import a menu: unpriced items on ordering pages (A2 v4)", () => {
  let db: ReturnType<typeof testDb>;
  beforeEach(async () => {
    db = testDb();
    await createRestaurant(db, { id: "r1", name: "Soup Place", address: "1 Main St" });
  });
  const run = (url: string, llm: ReturnType<typeof mockLlm>) =>
    importMenu({ db, blobs: memoryBlobs(), llm, fetch: fakeFetch({ [url]: { body: "<p>menu</p>", contentType: "text/html" } }) }, { restaurantId: "r1", url }, (data) => ({ menu: data as never, errors: [] }));
  const names = () => (db.raw.prepare("SELECT name FROM dishes").all() as { name: string }[]).map((d) => d.name);
  const answer = { dishes: [dish("Beef Chili", 7.5), dish("Shower Pilsner", null), dish("Greek Salad", 11)] };

  it("[ai] AC1 integration: an ordering-page item with no price (sold out) is left out", async () => {
    const result = await run("https://revsoupmenu.square.site/", mockLlm([answer]));
    expect(result).toMatchObject({ status: "active", dishCount: 2 });
    expect(names()).not.toContain("Shower Pilsner");
  });

  it("[ai] AC1 integration: a restaurant's own menu page keeps dishes printed without a price", async () => {
    const result = await run("https://whiskeyjar.example/menu", mockLlm([answer]));
    expect(result).toMatchObject({ status: "active", dishCount: 3 });
    expect(names()).toContain("Shower Pilsner");
  });
});
