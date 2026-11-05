import { describe, expect, it } from "vitest";
import { importMenu } from "../src/menu/import";
import { localDb } from "../src/validation/localdb";
import { createRestaurant } from "../src/restaurants/repo";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { mockLlm } from "./helpers/llm";
import { layoutItemCount, mergeDuplicates, validateMenu } from "../src/menu/validate";

const dish = (name: string, price: number | null) => ({ name, price, section: "Mains", description: null, tags: [] });
describe("menu price preservation", () => {
  it.each([
    { prices: [12, 6], expected: 6 }, { prices: [6, 12], expected: 6 },
    { prices: [null, 6], expected: 6 }, { prices: [12, null, 6], expected: 6 },
    { prices: [null, null], expected: null }, { prices: [6, 0], expected: 0 },
  ])("[ai] keeps the lowest known size price for $prices", ({ prices, expected }) => {
    const rows = prices.map((price) => dish("Soup", price));
    const original = structuredClone(rows);
    expect(mergeDuplicates(rows)).toMatchObject([{ name: "Soup", price: expected }]);
    expect(rows).toEqual(original);
  });
  it("[ai] does not merge separate lunch/dinner prices into one listing", () => {
    expect(mergeDuplicates([{ ...dish("Soup", 6), section: "Lunch" }, { ...dish("Soup", 12), section: "Dinner" }])).toHaveLength(2);
  });
  it.each(["MP", "M.P.", "MKT", "Market Price", "Price on request", "A.Q."])("[ai] counts a %s item alongside numeric prices", (marker) => {
    const count = layoutItemCount(`Soup $6\nFish ${marker}`);
    expect(count).toBe(2);
    expect(validateMenu(count)({ dishes: [dish("Soup", 6), dish("Fish", null)] }).errors).toEqual([]);
    expect(validateMenu(count)({ dishes: [dish("Soup", 6)] }).errors).toContainEqual(expect.stringMatching(/item count/));
  });
  it("[ai] counts a standalone market-price line but not an explanatory legend", () => {
    expect(layoutItemCount("Soup $6\nFish\nMP")).toBe(2);
    expect(layoutItemCount("Soup $6\nMP = Market Price")).toBe(1);
  });
  it("[ai] keeps an orderable market-price item on an ordering page with its price unknown", async () => {
    const db = localDb();
    await createRestaurant(db, { id: "r1", name: "Cafe", address: "Main" });
    const url = "https://cafe.square.site/menu";
    const result = await importMenu({ db, blobs: memoryBlobs(), llm: mockLlm([{ dishes: [dish("Soup", 6), dish("Tacos", 9), dish("Fish", null)] }]),
      fetch: fakeFetch({ [url]: { body: "<p>Soup $6 | Tacos $9</p><p>Fish — market price</p>", contentType: "text/html" } }),
    }, { restaurantId: "r1", url });
    expect(result).toMatchObject({ status: "active", dishCount: 3 });
    expect(db.raw.prepare("SELECT price FROM dishes WHERE menu_id = ? AND name = 'Fish'").get(result.menuId)).toMatchObject({ price: null });
  });
});
