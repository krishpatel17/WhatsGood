import { describe, expect, it } from "vitest";
import { checkOnMenu } from "../src/guardrails/menu";
import type { MenuDish } from "../src/recommend/types";

const dish = (id: string, name: string): MenuDish => ({ id, name, section: "Mains", price: 15, description: null, tags: [] });
const thisMenu = [dish("d1", "Cumin Lamb Noodles (Spicy)"), dish("d2", "Pork Dumplings"), dish("d3", "Garlic Bok Choy Noodles")];
const pick = (name: string) => ({ dish: name, reason: "Popular.", quotes: [], mention_count: 0 });

describe("US-09 Guardrail: every dish is on the menu", () => {
  it("[ai] T1 unit: exact match passes and resolves to the stored dish", () => {
    const { errors, resolved } = checkOnMenu([pick("Pork Dumplings")], thisMenu);
    expect(errors).toEqual([]);
    expect(resolved[0]?.id).toBe("d2");
  });

  it("[ai] T2 unit: 'Spicy Cumin Lamb Noodles' vs stored 'Cumin Lamb Noodles (Spicy)' passes", () => {
    const { errors, resolved } = checkOnMenu([pick("Spicy Cumin Lamb Noodles")], thisMenu);
    expect(errors).toEqual([]);
    expect(resolved[0]?.id).toBe("d1");
  });

  it("[ai] T3 unit: a dish from a different restaurant's menu fails", () => {
    const { errors, resolved } = checkOnMenu([pick("Pork Dumplings"), pick("Margherita Pizza")], thisMenu);
    expect(errors).toHaveLength(1);
    expect(resolved).toEqual([thisMenu[1], null]);
  });

  it("[ai] T4 unit: the failure message names the offending dish and its index", () => {
    const { errors } = checkOnMenu([pick("Pork Dumplings"), pick("Margherita Pizza")], thisMenu);
    expect(errors[0]).toBe('item[1] "Margherita Pizza" is not on this restaurant\'s menu');
  });

  it("[ai] AC1 unit: the same menu dish picked twice is rejected", () => {
    const { errors } = checkOnMenu([pick("Pork Dumplings"), pick("pork dumpling")], thisMenu);
    expect(errors).toEqual(['item[1] "pork dumpling" repeats item[0]']);
  });

  it("[ai] T5 unit: one dish listed in two sections under different spellings is a repeat", () => {
    const menu = [{ ...dish("a", "Pad Thai"), section: "Dinner" }, { ...dish("b", "Pad Thai (Lunch)"), section: "Lunch" }];
    const { errors } = checkOnMenu([pick("Pad Thai"), pick("Pad Thai (Lunch)")], menu);
    expect(errors).toEqual(['item[1] "Pad Thai (Lunch)" repeats item[0]']);
  });

  it("[ai] T6 unit: dishes with similar names are not repeats", () => {
    const names = ["Dumplings (Pork)", "Dumplings (Tofu)", "Spicy Chicken Sandwich #1", "Spicy Chicken Sandwich #2", "宫保鸡丁", "麻婆豆腐"];
    const menu = names.map((n, i) => dish(`s${i}`, n));
    const { errors, resolved } = checkOnMenu(names.map(pick), menu);
    expect(errors).toEqual([]);
    expect(resolved.map((d) => d?.id)).toEqual(menu.map((d) => d.id));
  });
});
