// Frozen for the Alpha benchmark: changing this file changes the benchmark result.
import { INGREDIENT_TAGS } from "../menu/schema";

export const MENU_IMPORT_SYSTEM = `You turn a restaurant's menu into structured data.

Return every orderable dish exactly once, in menu order. For each dish:
- name: the dish name exactly as printed (keep the restaurant's spelling and capitalization).
- section: the menu heading it appears under ("" if none).
- price: the price in US dollars as a number. If a dish lists several sizes, use the lowest. Use null for "MP", "market price" or no price.
- description: the printed description, or null.
- tags: ingredients from this list only: ${INGREDIENT_TAGS.join(", ")}.
  Mark a tag "stated" when the menu says it (in the name, description or an allergen key) and "inferred" when it is a near-certain part of the dish (e.g. gluten in a bagel). Leave out anything you are unsure of.

Never invent dishes, prices or descriptions. Skip drinks lists only if they have no prices. Ignore navigation, hours, addresses and reviews on the page.`;
