import { checkEvidence, type Evidence } from "../guardrails/evidence";
import { checkOnMenu } from "../guardrails/menu";
import { checkRestrictions, type Flag } from "../guardrails/restrictions";
import type { Profile } from "../profile/schema";
import { type Label, labelsFor, type Plan } from "./plan";
import { type MenuDish, PicksSchema } from "./types";

export type PickContext = {
  restaurantId: string;
  profile: Profile;
  /** The full active menu. */
  menu: MenuDish[];
  /** The menu after restriction and budget filtering, with flags. */
  allowed: (MenuDish & { flags: Flag[] })[];
  evidence: Evidence;
  plan: Plan;
};

/** A pick that passed every guardrail, as shown to the diner. reason is null for fallback picks. */
export type Recommended = {
  dishId: string;
  name: string;
  price: number | null;
  reason: string | null;
  quotes: string[];
  mentionCount: number;
  flags: Flag[];
  labels: Label[];
};

/** Run every guardrail over a model response. Picks are returned only when there are no errors. */
export function validatePicks(data: unknown, ctx: PickContext): { errors: string[]; picks: Recommended[] } {
  if (data === null) return { errors: ["output is not valid JSON"], picks: [] };
  const parsed = PicksSchema.safeParse(data);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join(".") || "output"}: ${i.message}`), picks: [] };
  const picks = parsed.data.picks;

  const errors: string[] = [];
  if (picks.length < 1 || picks.length > ctx.plan.maxPicks) errors.push(`returned ${picks.length} picks; expected 1 to ${ctx.plan.maxPicks}`);
  // A name listed twice resolves to the listing the model was offered, whose price and evidence it saw.
  const offeredFirst = [...ctx.menu].sort((a, b) => Number(ctx.plan.candidates.includes(b.id)) - Number(ctx.plan.candidates.includes(a.id)));
  const { errors: menuErrors, resolved } = checkOnMenu(picks, offeredFirst);
  errors.push(...menuErrors);
  resolved.forEach((dish, i) => {
    const allowed = dish && ctx.allowed.some((a) => a.id === dish.id);
    if (allowed && !ctx.plan.candidates.includes(dish.id)) errors.push(`item[${i}] "${picks[i].dish}" has no positive reviews; pick a dish with review evidence`);
  });
  errors.push(...checkRestrictions(picks, resolved, ctx.profile));
  errors.push(...checkEvidence(picks, resolved, ctx.evidence));
  if (errors.length) return { errors, picks: [] };

  return {
    errors,
    picks: picks.map((p, i) => {
      const dish = resolved[i]!;
      const allowed = ctx.allowed.find((a) => a.id === dish.id)!;
      return {
        dishId: dish.id,
        name: dish.name,
        price: dish.price,
        reason: p.reason,
        quotes: p.quotes,
        mentionCount: p.mention_count,
        flags: allowed.flags,
        labels: labelsFor(p.mention_count, ctx.plan.mode),
      };
    }),
  };
}
