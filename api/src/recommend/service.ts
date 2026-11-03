import { type Db, newId, nowIso } from "../db";
import { logEvent } from "../events/log";
import type { Llm } from "../llm/types";
import type { Profile } from "../profile/schema";
import { buildPrompt, loadContext, type RecommendContext } from "./context";
import { failureLogger } from "./failures";
import { fallbackRanking, generatePicks } from "./generate";
import type { Recommended } from "./validate";

export type Recommendation = {
  recommendationId: string;
  mode: "llm" | "fallback" | "none";
  picks: Recommended[];
  explanation: string | null;
  attempts: number;
};

/** Stores the recommendation and logs exactly what was shown, so US-21 can audit it later. */
async function store(db: Db, profileId: string, ctx: RecommendContext, rec: Omit<Recommendation, "recommendationId">): Promise<string> {
  const id = newId();
  await db
    .prepare("INSERT INTO recommendations (id, profile_id, restaurant_id, mode, picks, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, profileId, ctx.restaurantId, rec.mode, JSON.stringify(rec.picks), rec.explanation, nowIso())
    .run();
  await logEvent(db, {
    type: "recommendation_shown",
    profileId,
    restaurantId: ctx.restaurantId,
    recommendationId: id,
    mode: rec.mode,
    picks: rec.picks.map((p) => ({ dishId: p.dishId, name: p.name, quotes: p.quotes })),
  });
  return id;
}

/** One tap: up to three validated picks for this diner at this restaurant. Nothing unvalidated is returned. */
export async function recommend(deps: { db: Db; llm: Llm }, restaurantId: string, profileId: string, profile: Profile): Promise<Recommendation> {
  const ctx = await loadContext(deps.db, restaurantId, profile);
  const explanation = ctx.plan.explanation;
  if (ctx.plan.maxPicks === 0) {
    const rec = { mode: "none" as const, picks: [], explanation, attempts: 0 };
    return { recommendationId: await store(deps.db, profileId, ctx, rec), ...rec };
  }
  const out = await generatePicks({ llm: deps.llm, onFailure: failureLogger(deps.db, restaurantId, "recommend") }, ctx, buildPrompt(ctx));
  const rec = { mode: out.mode, picks: out.picks, explanation, attempts: out.attempts };
  return { recommendationId: await store(deps.db, profileId, ctx, rec), ...rec };
}

/** The plain ranking only, for showing something instantly while the model works. */
export async function quickFallback(db: Db, restaurantId: string, profile: Profile) {
  const ctx = await loadContext(db, restaurantId, profile);
  return { mode: "fallback" as const, picks: fallbackRanking(ctx), explanation: ctx.plan.explanation };
}
