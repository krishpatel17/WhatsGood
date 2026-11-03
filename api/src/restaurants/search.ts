import { normalize, similarity } from "../text/match";

export type RestaurantRow = { id: string; name: string; address: string; has_menu: boolean; has_reviews: boolean };

const MIN_SCORE = 0.75;

function tokenScore(q: string, nameTokens: string[]): number {
  let best = 0;
  for (const t of nameTokens) {
    if (q.length >= 3 && t.startsWith(q)) return 1;
    best = Math.max(best, similarity(q, t));
  }
  return best;
}

/** Restaurants whose name matches the query, ignoring case and tolerating typos. Best match first. */
export function searchRestaurants<T extends { name: string }>(rows: T[], query: string): T[] {
  const qTokens = normalize(query).split(" ").filter(Boolean);
  if (qTokens.length === 0) return [];
  return rows
    .map((row) => {
      const nameTokens = normalize(row.name).split(" ").filter(Boolean);
      const perToken = qTokens.reduce((sum, q) => sum + tokenScore(q, nameTokens), 0) / qTokens.length;
      const whole = similarity(qTokens.join(" "), nameTokens.join(" "));
      return { row, score: Math.max(perToken, whole) };
    })
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.row);
}
