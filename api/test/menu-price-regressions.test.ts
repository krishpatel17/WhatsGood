import { describe, expect, it } from "vitest";
import { importMenu } from "../src/menu/import";
import { localDb } from "../src/validation/localdb";
import { createRestaurant } from "../src/restaurants/repo";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { mockLlm } from "./helpers/llm";

const dish = (name: string, price: number | null) => ({ name, price, section: "Mains", description: null, tags: [] });
describe("menu price preservation", () => {
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
