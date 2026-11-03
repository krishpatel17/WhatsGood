import { z } from "zod";
import type { Dish } from "../menu/schema";

/** A dish on the restaurant's active, stored menu. */
export type MenuDish = Dish & { id: string };

/** What the model returns for one recommended dish. */
export const PickSchema = z.object({
  dish: z.string(),
  reason: z.string(),
  quotes: z.array(z.string()),
  mention_count: z.number().int(),
});
export type Pick = z.infer<typeof PickSchema>;

export const PicksSchema = z.object({ picks: z.array(PickSchema) });
