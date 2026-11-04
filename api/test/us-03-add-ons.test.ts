import { beforeEach, describe, expect, it } from "vitest";
import { importMenu } from "../src/menu/import";
import { isAddOn } from "../src/menu/add-ons";
import { createRestaurant } from "../src/restaurants/repo";
import { csvToTruth } from "../src/validation/truth-csv";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const PAGE = "https://dumplings.example/menu";
const dish = (name: string, price: number | null) => ({ name, section: "Sides", price, description: null, tags: [] });

describe("US-03 Import a menu: add-ons are not stored as dishes (A2 v3)", () => {
  let db: ReturnType<typeof testDb>;
  beforeEach(async () => {
    db = testDb();
    await createRestaurant(db, { id: "r1", name: "Dumpling Place", address: "1 Main St" });
  });
  const run = (llm: ReturnType<typeof mockLlm>) =>
    importMenu({ db, blobs: memoryBlobs(), llm, fetch: fakeFetch({ [PAGE]: { body: "<p>menu</p>", contentType: "text/html" } }) }, { restaurantId: "r1", url: PAGE }, (data) => ({ menu: data as typeof easyMenu, errors: [] }));

  it("[ai] AC1 unit: add-ons are recognised by the same rule the answer keys use", () => {
    for (const name of ["Extra sauce", "Extra Sauce", "Add Grilled or Fried Chicken to any Salad", "Substitute cheese"]) expect(isAddOn(name)).toBe(true);
    for (const name of ["Extra Feta", "Side of Chicken Curry", "Sesame Noodles", "Chicken Marsala", "Additional Fries"]) expect(isAddOn(name)).toBe(false);
  });

  it("[ai] AC1 unit: the answer-key converter and the importer share one add-on rule", () => {
    const { truth } = csvToTruth("section,name,price\nSides,Extra sauce,0.50\nSides,White Rice,2.00\n", { id: "x", name: "X", tier: "medium", sourceType: "html", url: PAGE } as never);
    expect(truth!.dishes.map((d) => d.name)).toEqual(["White Rice"]);
  });

  it("[ai] AC1 integration: add-ons the model lists are left out of the stored menu", async () => {
    const result = await run(mockLlm([{ dishes: [...easyMenu.dishes, dish("Extra sauce", 0.5), dish("Add chicken to any salad", 5)] }]));
    expect(result).toMatchObject({ status: "active", dishCount: easyMenu.dishes.length });
    const names = (db.raw.prepare("SELECT name FROM dishes").all() as { name: string }[]).map((d) => d.name);
    expect(names).not.toContain("Extra sauce");
    expect(names).toHaveLength(easyMenu.dishes.length);
  });

  it("[ai] AC3 integration: a menu that is only add-ons goes to review", async () => {
    const result = await run(mockLlm([{ dishes: [dish("Extra sauce", 0.5)] }]));
    expect(result).toMatchObject({ status: "needs_review", dishCount: 0 });
  });
});
