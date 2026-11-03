import type { Dish } from "../menu/schema";
import { DISH_MATCH_THRESHOLD, dishScore } from "../text/match";

export type MenuScore = {
  truthCount: number;
  extractedCount: number;
  correct: number;
  wrongPrice: number;
  invented: number;
  missed: number;
  accuracy: number;
  inventedNames: string[];
  missedNames: string[];
  wrongPriceNames: string[];
};

const samePrice = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.005);

/**
 * Compare an imported menu with the hand-copied correct menu. A dish is correct
 * when its name matches (normalized score >= 0.9) and its price is the same.
 */
export function scoreMenu(extracted: Dish[], truth: Dish[]): MenuScore {
  const unused = new Set(extracted.map((_, i) => i));
  let correct = 0;
  const missedNames: string[] = [];
  const wrongPriceNames: string[] = [];
  for (const t of truth) {
    let best = -1;
    let bestScore = 0;
    for (const i of unused) {
      const s = extracted[i].name === t.name ? 1 : dishScore(extracted[i].name, t.name);
      if (s > bestScore) {
        best = i;
        bestScore = s;
      }
    }
    if (best < 0 || bestScore < DISH_MATCH_THRESHOLD) {
      missedNames.push(t.name);
      continue;
    }
    unused.delete(best);
    if (samePrice(extracted[best].price, t.price)) correct += 1;
    else wrongPriceNames.push(t.name);
  }
  const inventedNames = [...unused].map((i) => extracted[i].name);
  return {
    truthCount: truth.length,
    extractedCount: extracted.length,
    correct,
    wrongPrice: wrongPriceNames.length,
    invented: inventedNames.length,
    missed: missedNames.length,
    accuracy: truth.length ? correct / truth.length : 0,
    inventedNames,
    missedNames,
    wrongPriceNames,
  };
}

export const A2_LIMITS = { minAccuracy: 0.95, maxInvented: 0, maxSeconds: 120 };

/** "Imported easily": >= 95% of names and prices correct, no invented dishes, under 2 minutes, no manual fixes. */
export function a2Passes(r: { accuracy: number; invented: number; seconds: number; manualFixes: number }): boolean {
  return r.accuracy >= A2_LIMITS.minAccuracy - 1e-9 && r.invented <= A2_LIMITS.maxInvented && r.seconds < A2_LIMITS.maxSeconds && r.manualFixes === 0;
}
