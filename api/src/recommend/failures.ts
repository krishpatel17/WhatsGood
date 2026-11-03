import { type Db, newId, nowIso } from "../db";
import type { OnFailure } from "./generate";

/** Logs one row per failed check so we can see which prompts need fixing. */
export function failureLogger(db: Db, restaurantId: string, task: string): OnFailure {
  return async (attempt, errors) => {
    for (const check of errors) {
      await db
        .prepare("INSERT INTO llm_failures (id, restaurant_id, task, attempt, failed_check, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(newId(), restaurantId, task, attempt, check, nowIso())
        .run();
    }
  };
}
