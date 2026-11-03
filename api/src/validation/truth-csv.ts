// Hand-copied menus as spreadsheets (section,name,price) -> answer-key menus for the A2 benchmark.
import { parsePrice } from "../menu/validate";
import type { Truth } from "./benchmark-set";
import { parseCsv } from "./csv";
import { mulberry32 } from "./stats";

type Meta = Omit<Truth, "dishes">;
type TruthDish = Truth["dishes"][number];

/** A blank price cell means the menu shows no price; anything else must read as a price. */
export function csvToTruth(csv: string, meta: Meta): { truth: Truth | null; errors: string[] } {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { truth: null, errors: ["no dishes copied yet"] };
  const errors: string[] = [];
  const dishes: TruthDish[] = [];
  rows.forEach((r, i) => {
    const row = i + 2; // spreadsheet row: the header is row 1
    const name = (r.name ?? "").trim();
    const priceText = (r.price ?? "").trim();
    if (!name) {
      errors.push(`row ${row}: name is empty`);
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
    dishes.push({ section: (r.section ?? "").trim(), name, price });
  });
  return errors.length ? { truth: null, errors } : { truth: { ...meta, dishes }, errors };
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
