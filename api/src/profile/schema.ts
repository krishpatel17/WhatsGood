import { z } from "zod";

export const ALLERGIES = ["peanut", "tree_nut", "shellfish", "fish", "egg", "dairy", "gluten", "soy", "sesame"] as const;
export const DIETS = ["vegetarian", "vegan", "pescatarian", "no_pork", "no_beef", "halal", "kosher", "gluten_free", "dairy_free"] as const;
export const TASTES = ["spicy", "mild", "sweet", "savory", "light", "hearty", "adventurous", "comfort"] as const;

const fields = {
  allergies: z.array(z.enum(ALLERGIES)),
  diets: z.array(z.enum(DIETS)),
  budget: z.number().nonnegative().nullable(),
  tastes: z.array(z.enum(TASTES)),
  notes: z.string().max(280),
};

export const ProfileSchema = z.object({
  allergies: fields.allergies.default([]),
  diets: fields.diets.default([]),
  budget: fields.budget.default(null),
  tastes: fields.tastes.default([]),
  notes: fields.notes.default(""),
});

// No defaults here: a PATCH must only touch the fields it sends.
export const ProfilePatchSchema = z.object(fields).partial();

export type Profile = z.infer<typeof ProfileSchema>;
export type Allergy = (typeof ALLERGIES)[number];
export type Diet = (typeof DIETS)[number];

/** The restriction tags that remove dishes. Budget and tastes never remove anything here. */
export function restrictionFilters(p: Profile): Set<Allergy | Diet> {
  return new Set<Allergy | Diet>([...p.allergies, ...p.diets]);
}
