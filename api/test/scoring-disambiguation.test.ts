import { describe, expect, it } from "vitest";
import { scoreMenu } from "../src/validation/score";
import type { Dish } from "../src/menu/schema";

const dish = (section: string, price: number | null): Dish => ({ name: "Soup", section, price, description: null, tags: [] });
describe("ambiguous benchmark dish names", () => {
  it.each([[0, 1, 2], [2, 1, 0], [1, 2, 0], [0, 2, 1]])("[ai] matches repeated names independent of extraction order %j", (...order) => {
    const truth = [dish("Lunch", 6), dish("Dinner", 12), dish("Specials", null)];
    expect(scoreMenu(order.map((i) => truth[i]), truth)).toMatchObject({ correct: 3, wrongPrice: 0, missed: 0, invented: 0 });
  });
  it("[ai] uses price to disambiguate names when section labels are absent or differ", () => {
    expect(scoreMenu([dish("", 12), dish("", 6)], [dish("Mains", 6), dish("Mains", 12)])).toMatchObject({ correct: 2, wrongPrice: 0 });
  });
  it("[ai] does not hide real price errors by crossing two explicitly matching sections", () => {
    expect(scoreMenu([dish("Dinner", 6), dish("Lunch", 12)], [dish("Lunch", 6), dish("Dinner", 12)])).toMatchObject({ correct: 0, wrongPrice: 2 });
  });
  it("[ai] still consumes a prediction once and reports a genuinely wrong price", () => {
    expect(scoreMenu([dish("", 6)], [dish("", 6), dish("", 6)])).toMatchObject({ correct: 1, missed: 1 });
    expect(scoreMenu([dish("", 12), dish("", 9)], [dish("", 6), dish("", 12)])).toMatchObject({ correct: 1, wrongPrice: 1 });
  });
});
