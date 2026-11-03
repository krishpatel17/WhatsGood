import type { Db } from "../db";
import { loadEvidence } from "../guardrails/evidence";
import { filterForProfile } from "../guardrails/restrictions";
import type { LlmContent } from "../llm/types";
import type { Profile } from "../profile/schema";
import { activeMenuDishes } from "../reviews/mentions";
import { planPicks } from "./plan";
import type { MenuDish } from "./types";
import type { PickContext } from "./validate";

export const QUOTES_PER_DISH = 3;

export type RecommendContext = PickContext & { quotes: Map<string, string[]> };

/** Everything one recommendation may use: this restaurant's menu, its review evidence and the diner's profile. */
export async function loadContext(db: Db, restaurantId: string, profile: Profile): Promise<RecommendContext> {
  const menu: MenuDish[] = (await activeMenuDishes(db, restaurantId)).map((d) => ({ ...d, tags: JSON.parse(d.tags) }));
  const evidence = await loadEvidence(db, restaurantId);
  const { allowed } = filterForProfile(menu, profile);
  const plan = planPicks(allowed, evidence);

  const { results } = await db
    .prepare("SELECT dish_id, quote FROM mentions WHERE restaurant_id = ? AND dish_id IS NOT NULL AND sentiment > 0 ORDER BY sentiment DESC, id")
    .bind(restaurantId)
    .all<{ dish_id: string; quote: string }>();
  const quotes = new Map<string, string[]>();
  for (const r of results) {
    const list = quotes.get(r.dish_id) ?? [];
    if (list.length < QUOTES_PER_DISH) list.push(r.quote);
    quotes.set(r.dish_id, list);
  }
  return { restaurantId, profile, menu, allowed, evidence, plan, quotes };
}

const money = (n: number | null) => (n === null ? "price unknown" : `$${n.toFixed(2)}`);

export function buildPrompt(ctx: RecommendContext): LlmContent[] {
  const offered = ctx.allowed.filter((d) => ctx.plan.candidates.includes(d.id));
  const menu = offered.map((d) => `- ${d.name} (${d.section || "menu"}, ${money(d.price)})${d.description ? `: ${d.description}` : ""}`).join("\n");
  const evidence = offered
    .map((d) => {
      const e = ctx.evidence.byDish.get(d.id);
      if (!e) return `- ${d.name}: mentions: 0`;
      const quotes = (ctx.quotes.get(d.id) ?? []).map((q) => `    "${q}"`).join("\n");
      return `- ${d.name}: mentions: ${e.count}, average sentiment: ${e.avgSentiment}${quotes ? `\n${quotes}` : ""}`;
    })
    .join("\n");
  const p = ctx.profile;
  const profile = [
    `tastes: ${p.tastes.join(", ") || "none given"}`,
    `budget per dish: ${p.budget === null ? "none" : money(p.budget)}`,
    `notes: ${p.notes || "none"}`,
  ].join("\n");
  return [
    {
      type: "text",
      text: `Pick up to ${ctx.plan.maxPicks} dishes.\n\nMENU:\n${menu}\n\nREVIEW EVIDENCE:\n${evidence}\n\nPROFILE:\n${profile}`,
    },
  ];
}
