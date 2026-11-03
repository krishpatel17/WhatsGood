// Hand-copied menus as spreadsheets (section,name,price) -> answer-key menus for the A2 benchmark.
import { parsePrice } from "../menu/validate";
import type { Truth } from "./benchmark-set";
import { parseCsv } from "./csv";
import { mulberry32 } from "./stats";
import { normalize } from "../text/match";

type Meta = Omit<Truth, "dishes">;
type TruthDish = Truth["dishes"][number];

// Add-ons are not dishes you order on their own: "Add chicken to any salad", "Extra topping".
const ADD_ON = /^add\b|^(extra|sub(stitute)?)\b.*\b(topp?ings?|cheese|sauces?|dressings?|proteins?|chicken|meat|shots?|eggs?|avocado|bacon)\b/i;

/**
 * A blank price cell means the menu shows no price; anything else must read as a price.
 * The copying rules are applied here: one row per dish at its lowest size price, no add-ons.
 */
export function csvToTruth(csv: string, meta: Meta): { truth: Truth | null; errors: string[]; notes: string[] } {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { truth: null, errors: ["no dishes copied yet"], notes: [] };
  const errors: string[] = [];
  const notes: string[] = [];
  const dishes: TruthDish[] = [];
  const seen = new Map<string, { dish: TruthDish; row: number }>();
  rows.forEach((r, i) => {
    const row = i + 2; // spreadsheet row: the header is row 1
    const name = (r.name ?? "").trim();
    const priceText = (r.price ?? "").trim();
    if (!name) {
      errors.push(`row ${row}: name is empty`);
      return;
    }
    if (ADD_ON.test(name)) {
      notes.push(`row ${row}: "${name}" is an add-on; left out`);
      return;
    }
    let price: number | null = null;
    if (priceText) {
      const p = parsePrice(priceText);
      if (!p.ok) {
        errors.push(`row ${row}: price "${priceText}": ${p.error}`);
        return;
      }
      price = p.value;
    }
    const section = (r.section ?? "").trim();
    const key = `${normalize(section)}|${normalize(name)}`;
    const first = seen.get(key);
    if (first) {
      if (price !== null && (first.dish.price === null || price < first.dish.price)) first.dish.price = price;
      notes.push(`row ${row}: "${name}" is another size of row ${first.row}; kept the lowest price`);
      return;
    }
    const dish = { section, name, price };
    seen.set(key, { dish, row });
    dishes.push(dish);
  });
  return errors.length ? { truth: null, errors, notes } : { truth: { ...meta, dishes }, errors, notes };
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The random 20% of dishes (at least one) a second teammate re-checks against the source. Same id, same sample. */
export function spotCheckSample<T>(dishes: T[], restaurantId: string): T[] {
  const k = Math.max(1, Math.ceil(dishes.length * 0.2));
  const rand = mulberry32(seedOf(restaurantId));
  const idx = dishes.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx
    .slice(0, k)
    .sort((a, b) => a - b)
    .map((i) => dishes[i]);
}

export function validateAssignments(rows: { restaurant_id: string; copied_by: string; checked_by: string }[], ids: string[]): string[] {
  const errors: string[] = [];
  for (const r of rows) {
    if (r.copied_by.trim() && r.copied_by.trim() === r.checked_by.trim()) errors.push(`${r.restaurant_id}: copied and checked by the same person`);
  }
  for (const id of ids) if (!rows.some((r) => r.restaurant_id === id)) errors.push(`${id}: not assigned`);
  return errors;
}
