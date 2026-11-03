import type { Db } from "../db";
import { listEvents } from "../events/log";
import { type Evidence, loadEvidence } from "../guardrails/evidence";
import { quoteInReview } from "../reviews/mentions";

export type AuditFailure = { recommendationId: string; kind: "dish" | "quote"; detail: string };
export type AuditReport = { recommendations: number; picks: number; quotes: number; inventedDishes: number; inventedQuotes: number; failures: AuditFailure[] };

/** Re-check every logged recommendation against the stored menus and reviews. Target: zero invented. */
export async function auditPicks(db: Db): Promise<AuditReport> {
  const shown = await listEvents(db, "recommendation_shown");
  const report: AuditReport = { recommendations: shown.length, picks: 0, quotes: 0, inventedDishes: 0, inventedQuotes: 0, failures: [] };
  const evidenceCache = new Map<string, Evidence>();

  for (const event of shown) {
    let ev = evidenceCache.get(event.restaurantId);
    if (!ev) {
      ev = await loadEvidence(db, event.restaurantId);
      evidenceCache.set(event.restaurantId, ev);
    }
    for (const pick of event.picks) {
      report.picks += 1;
      const dish = await db
        .prepare("SELECT id FROM dishes WHERE id = ? AND restaurant_id = ? AND name = ?")
        .bind(pick.dishId, event.restaurantId, pick.name)
        .first();
      if (!dish) {
        report.inventedDishes += 1;
        report.failures.push({ recommendationId: event.recommendationId, kind: "dish", detail: pick.name });
      }
      const mentioning = ev.byDish.get(pick.dishId)?.reviewIds ?? new Set<string>();
      for (const quote of pick.quotes) {
        report.quotes += 1;
        const backed = [...mentioning].some((id) => quoteInReview(quote, ev.reviews.get(id) ?? ""));
        if (!backed) {
          report.inventedQuotes += 1;
          report.failures.push({ recommendationId: event.recommendationId, kind: "quote", detail: `${pick.name}: "${quote}"` });
        }
      }
    }
  }
  return report;
}
