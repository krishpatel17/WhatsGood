import type { Dish } from "../menu/schema";
import { DISH_MATCH_THRESHOLD, dishScore, normalize } from "../text/match";

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
  const candidates = truth.map((t) => {
    const matches = extracted.map((d, i) => ({ i, score: d.name === t.name ? 1 : dishScore(d.name, t.name) }))
      .filter((m) => m.score >= DISH_MATCH_THRESHOLD).sort((a, b) => b.score - a.score);
    // Identical names at lunch and dinner are different listings when both headings are known.
    const section = normalize(t.section);
    const contextual = section ? matches.filter((m) => m.score === matches[0]?.score && normalize(extracted[m.i].section) === section) : [];
    return (contextual.length ? contextual : matches).map((m) => m.i);
  });
  const owners = new Map<number, number>();
  const locked = new Set<number>();
  const assign = (t: number, seen: Set<number>, priced: boolean): boolean => {
    for (const i of candidates[t]) {
      if (seen.has(i) || (priced && !samePrice(extracted[i].price, truth[t].price))) continue;
      seen.add(i);
      const owner = owners.get(i);
      if (owner !== undefined && locked.has(owner)) continue;
      if (owner === undefined || assign(owner, seen, priced)) { owners.set(i, t); return true; }
    }
    return false;
  };
  // Match correct prices first using augmenting paths, so an unmatched row cannot steal
  // a prediction needed by another row. Keep those matches while assigning wrong-price rows.
  truth.forEach((_, t) => assign(t, new Set(), true));
  for (const t of owners.values()) locked.add(t);
  truth.forEach((_, t) => { if (!locked.has(t)) assign(t, new Set(), false); });
  const byTruth = new Map([...owners].map(([i, t]) => [t, i]));
  const unused = new Set(extracted.map((_, i) => i));
  let correct = 0;
  const missedNames: string[] = [];
  const wrongPriceNames: string[] = [];
  for (const [index, t] of truth.entries()) {
    const best = byTruth.get(index);
    if (best === undefined) {
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
