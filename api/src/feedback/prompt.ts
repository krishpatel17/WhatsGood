import { type Db, nowIso } from "../db";
import { getRecommendation, type StoredRecommendation } from "./rating";

export const PROMPT_AFTER_MS = 60 * 60 * 1000;

type PromptState = { createdAt: string; rated: boolean; dismissedAt: string | null; promptedAt: string | null; picks: number };

/** Ask once, more than an hour after picks were shown, unless already rated or dismissed. */
export function shouldPrompt(r: PromptState, now: Date): boolean {
  if (r.rated || r.dismissedAt || r.promptedAt || r.picks === 0) return false;
  return now.getTime() - Date.parse(r.createdAt) > PROMPT_AFTER_MS;
}

/** The diner's latest recommendation that is due a rating prompt, marked as prompted so it is asked only once. */
export async function pendingRating(db: Db, profileId: string, now = new Date()): Promise<StoredRecommendation | null> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.created_at, r.dismissed_at, r.prompted_at, json_array_length(r.picks) AS picks,
         EXISTS (SELECT 1 FROM ratings x WHERE x.recommendation_id = r.id) AS rated
       FROM recommendations r WHERE r.profile_id = ? ORDER BY r.created_at DESC LIMIT 5`,
    )
    .bind(profileId)
    .all<{ id: string; created_at: string; dismissed_at: string | null; prompted_at: string | null; picks: number; rated: number }>();
  const due = results.find((r) =>
    shouldPrompt({ createdAt: r.created_at, rated: !!r.rated, dismissedAt: r.dismissed_at, promptedAt: r.prompted_at, picks: r.picks }, now),
  );
  if (!due) return null;
  await db.prepare("UPDATE recommendations SET prompted_at = ? WHERE id = ?").bind(nowIso(), due.id).run();
  return getRecommendation(db, due.id);
}

export async function dismissPrompt(db: Db, recommendationId: string): Promise<boolean> {
  if (!(await getRecommendation(db, recommendationId))) return false;
  await db.prepare("UPDATE recommendations SET dismissed_at = ? WHERE id = ?").bind(nowIso(), recommendationId).run();
  return true;
}
