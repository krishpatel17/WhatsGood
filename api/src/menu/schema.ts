import { z } from "zod";
import { ALLERGIES } from "../profile/schema";

/** Ingredient tags the model may attach to a dish: allergens plus what diets care about. */
export const INGREDIENT_TAGS = [...ALLERGIES, "pork", "beef", "lamb", "poultry", "meat", "alcohol", "spicy"] as const;

export const TagSchema = z.object({
  tag: z.enum(INGREDIENT_TAGS),
  source: z.enum(["stated", "inferred"]),
});

export const DishSchema = z.object({
  name: z.string().min(1),
  section: z.string(),
  price: z.number().nullable(),
  description: z.string().nullable(),
  tags: z.array(TagSchema),
});

export const MenuSchema = z.object({ dishes: z.array(DishSchema) });

export type Dish = z.infer<typeof DishSchema>;
export type Menu = z.infer<typeof MenuSchema>;
export type IngredientTag = (typeof INGREDIENT_TAGS)[number];
