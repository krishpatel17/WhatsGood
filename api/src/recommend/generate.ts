import type { Llm, LlmContent, LlmMessage, LlmResponse, LlmUsage } from "../llm/types";
import { RECOMMEND_SYSTEM } from "../prompts/recommend";
import { labelsFor, MAX_PICKS } from "./plan";
import { PicksSchema } from "./types";
import { type PickContext, type Recommended, validatePicks } from "./validate";

export const MAX_ATTEMPTS = 3;

export function feedbackMessage(attempt: number, errors: string[]): string {
  return [
    `VALIDATION FAILED (attempt ${attempt}/${MAX_ATTEMPTS}):`,
    ...errors.map((e) => `- ${e}`),
    "Regenerate the full list. Use only dishes from MENU and quotes from REVIEWS.",
  ].join("\n");
}

/**
 * Plain ranking with no generated text: allowed dishes by average sentiment x mention count.
 * Dishes reviewers dislike are left out.
 */
export function fallbackRanking(ctx: PickContext): Recommended[] {
  const limit = Math.min(MAX_PICKS, Math.max(ctx.plan.maxPicks, 0) || MAX_PICKS);
  return ctx.allowed
    .map((d) => {
      const e = ctx.evidence.byDish.get(d.id);
      return { d, count: e?.count ?? 0, score: e ? e.avgSentiment * e.count : 0 };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || b.count - a.count || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map(({ d, count }) => ({
      dishId: d.id,
      name: d.name,
      price: d.price,
      reason: null,
      quotes: [],
      mentionCount: count,
      flags: d.flags,
      labels: labelsFor(count, ctx.plan.mode),
    }));
}

export type OnFailure = (attempt: number, errors: string[]) => Promise<void>;

export type Generated = { mode: "llm" | "fallback"; picks: Recommended[]; attempts: number; usage: LlmUsage };

/** Ask the model for picks, feeding validation errors back up to 3 times, then fall back to the plain ranking. */
export async function generatePicks(deps: { llm: Llm; onFailure: OnFailure }, ctx: PickContext, prompt: LlmContent[]): Promise<Generated> {
  const messages: LlmMessage[] = [{ role: "user", content: prompt }];
  const usage: LlmUsage = { input_tokens: 0, output_tokens: 0 };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: LlmResponse;
    try {
      res = await deps.llm.json({ task: "recommend", system: RECOMMEND_SYSTEM, messages, schema: PicksSchema, effort: "low" });
    } catch (e) {
      // No answer to correct, so retrying can't help: the diner still gets the plain ranking.
      await deps.onFailure(attempt, [`model call failed: ${e instanceof Error ? e.message : String(e)}`]);
      return { mode: "fallback", picks: fallbackRanking(ctx), attempts: attempt, usage };
    }
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const { errors, picks } = validatePicks(res.data, ctx);
    if (errors.length === 0) return { mode: "llm", picks, attempts: attempt, usage };
    await deps.onFailure(attempt, errors);
    messages.push({ role: "assistant", content: res.raw }, { role: "user", content: feedbackMessage(attempt, errors) });
  }
  return { mode: "fallback", picks: fallbackRanking(ctx), attempts: MAX_ATTEMPTS, usage };
}
