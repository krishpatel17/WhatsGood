import { describe, expect, it } from "vitest";
import { csvToTruth, spotCheckSample, validateAssignments } from "../src/validation/truth-csv";
import { TruthSchema } from "../src/validation/benchmark-set";

const meta = { restaurant_id: "co04", copied_by: "Lara Mahajan", copied_on: "2026-11-04", source_url: "https://example.com/menu.pdf" };

describe("US-18 hand-copied menus from spreadsheets (AC4, AC5)", () => {
  it("[ai] AC4 unit: a filled sheet becomes a valid answer-key menu", () => {
    const csv = "section,name,price\nStarters,French Onion Soup,$8\nMains,Stumble Down Mac N' Cheese,15.50\nMains,Catch of the Day,MP\n,Side Salad,\n";
    const { truth, errors } = csvToTruth(csv, meta);
    expect(errors).toEqual([]);
    expect(TruthSchema.safeParse(truth).success).toBe(true);
    expect(truth!.dishes).toEqual([
      { section: "Starters", name: "French Onion Soup", price: 8 },
      { section: "Mains", name: "Stumble Down Mac N' Cheese", price: 15.5 },
      { section: "Mains", name: "Catch of the Day", price: null },
      { section: "", name: "Side Salad", price: null },
    ]);
  });

  it("[ai] AC4 unit: rows with a missing name or an unreadable price are reported by row number", () => {
    const { truth, errors } = csvToTruth("section,name,price\nMains,,12\nMains,Burger,twelve\nMains,Fries,4\n", meta);
    expect(truth).toBeNull();
    expect(errors).toEqual(["row 2: name is empty", 'row 3: price "twelve": no price in "twelve"']);
  });

  it("[ai] AC4 unit: an empty sheet is not an answer key", () => {
    expect(csvToTruth("section,name,price\n", meta).errors).toEqual(["no dishes copied yet"]);
  });

  it("[ai] AC5 unit: the spot-check sample is a seeded 20% of dishes (at least 1)", () => {
    const dishes = Array.from({ length: 23 }, (_, i) => ({ section: "", name: `Dish ${i}`, price: i }));
    const a = spotCheckSample(dishes, "co04");
    expect(a).toHaveLength(5); // ceil(23 * 0.2)
    expect(spotCheckSample(dishes, "co04")).toEqual(a);
    expect(spotCheckSample(dishes, "do02")).not.toEqual(a);
    expect(spotCheckSample(dishes.slice(0, 2), "co04")).toHaveLength(1);
  });

  it("[ai] AC5 unit: nobody spot-checks a menu they copied, and every restaurant is assigned", () => {
    const ok = [
      { restaurant_id: "co04", copied_by: "Lara Mahajan", checked_by: "Krish Patel" },
      { restaurant_id: "do02", copied_by: "Krish Patel", checked_by: "Shaunak Sinha" },
    ];
    expect(validateAssignments(ok, ["co04", "do02"])).toEqual([]);
    expect(validateAssignments([{ ...ok[0], checked_by: "Lara Mahajan" }], ["co04", "do02"])).toEqual([
      "co04: copied and checked by the same person",
      "do02: not assigned",
    ]);
  });
});

describe("US-18 copying rules applied to the sheets", () => {
  it("[ai] AC4 unit: the same dish listed in several sizes becomes one dish at the lowest price", () => {
    const csv = "section,name,price\nSoups,Peanut Tofu Soup,5.50\nSoups,Peanut Tofu Soup,15.00\nA La Carte,Tostadas,8.99\nA La Carte,tostadas,4.75\nMains,Tostadas,12\n";
    const { truth, notes } = csvToTruth(csv, meta);
    expect(truth!.dishes).toEqual([
      { section: "Soups", name: "Peanut Tofu Soup", price: 5.5 },
      { section: "A La Carte", name: "Tostadas", price: 4.75 },
      { section: "Mains", name: "Tostadas", price: 12 },
    ]);
    expect(notes).toEqual(['row 3: "Peanut Tofu Soup" is another size of row 2; kept the lowest price', 'row 5: "tostadas" is another size of row 4; kept the lowest price']);
  });

  it("[ai] AC4 unit: add-ons and extras are left out of the answer key", () => {
    const csv = "section,name,price\nSalads,Cobb,11\nSalads,Add Grilled or Fried Chicken to any Salad,5\nOther,Extra Toping,0.75\nMains,Extra Large Burger,14\n";
    const { truth, notes } = csvToTruth(csv, meta);
    expect(truth!.dishes.map((d) => d.name)).toEqual(["Cobb", "Extra Large Burger"]);
    expect(notes).toEqual(['row 3: "Add Grilled or Fried Chicken to any Salad" is an add-on; left out', 'row 4: "Extra Toping" is an add-on; left out']);
  });
});
