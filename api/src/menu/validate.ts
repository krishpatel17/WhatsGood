import { normalize } from "../text/match";
import { type Dish, MenuSchema } from "./schema";
import type { Validate } from "./import";

export const MAX_PRICE = 500;
export const COUNT_TOLERANCE = 0.15;
export const NO_DISHES = "no dishes found in the source";

export type PriceResult = { ok: true; value: number | null } | { ok: false; error: string };

/** Parse a printed price. "MP"/"market price" is null; several prices ("$9/$14") give the lowest. */
export function parsePrice(text: string): PriceResult {
  const t = text.trim().toLowerCase();
  if (/^(mp|market( price)?|a\.?q\.?)$/.test(t)) return { ok: true, value: null };
  if (/-\s*\$?\d/.test(t)) return { ok: false, error: `negative price "${text}"` };
  const values = [...t.matchAll(/\d+(?:\.\d{1,2})?/g)].map((m) => Number(m[0]));
  if (values.length === 0) return { ok: false, error: `no price in "${text}"` };
  const over = values.find((v) => v > MAX_PRICE);
  if (over !== undefined) return { ok: false, error: `price ${over} is outside $0-$${MAX_PRICE}` };
  return { ok: true, value: Math.min(...values) };
}

const PRICE = /\$\s?\d+(\.\d{1,2})?|\b\d{1,3}\.\d{2}\b/;

/** Non-LLM item count: the number of page lines that carry a price. */
export function layoutItemCount(text: string): number {
  return text.split("\n").filter((line) => PRICE.test(line)).length;
}

/** Null when the extracted count is within ±15% of the layout count (or no layout count exists). */
export function countCheck(extracted: number, layout: number | null): string | null {
  if (!layout) return null;
  const off = Math.abs(extracted - layout) / layout;
  return off > COUNT_TOLERANCE + 1e-9 ? `item count ${extracted} is not within 15% of the page layout count ${layout}` : null;
}

/** One dish per normalized name and section; tags from duplicates are merged. */
export function mergeDuplicates(dishes: Dish[]): Dish[] {
  const byKey = new Map<string, Dish>();
  for (const d of dishes) {
    const key = `${normalize(d.name)}|${normalize(d.section)}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...d, tags: [...d.tags] });
      continue;
    }
    for (const t of d.tags) if (!seen.tags.some((s) => s.tag === t.tag)) seen.tags.push(t);
    seen.price ??= d.price;
    seen.description ??= d.description;
  }
  return [...byKey.values()];
}

/** Full menu validation for one import attempt: schema, duplicates, prices and item count. */
export function validateMenu(layoutCount: number | null): Validate {
  return (data) => {
    const parsed = MenuSchema.safeParse(data);
    if (!parsed.success) {
      if (data === null) return { menu: null, errors: ["output is not valid JSON"] };
      return { menu: null, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "menu"}: ${i.message}`) };
    }
    const dishes = mergeDuplicates(parsed.data.dishes);
    const errors: string[] = [];
    dishes.forEach((d, i) => {
      if (d.price !== null && (d.price < 0 || d.price > MAX_PRICE)) errors.push(`dishes[${i}] "${d.name}": price ${d.price} is outside $0-$${MAX_PRICE}`);
    });
    const count = countCheck(dishes.length, layoutCount);
    if (count) errors.push(count);
    else if (dishes.length === 0) errors.push(NO_DISHES);
    return { menu: { dishes }, errors };
  };
}
