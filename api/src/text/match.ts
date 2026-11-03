// Fuzzy text matching shared by restaurant search, review mention matching
// and the "dish is on the menu" guardrail.

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Optimal string alignment distance (Levenshtein plus adjacent transpositions). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** 1 - edit distance / longer length, in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

// Words that name the same thing on menus and in reviews.
const SYNONYMS: Record<string, string> = { mian: "noodle", mien: "noodle" };

function stem(word: string): string {
  if (SYNONYMS[word]) return SYNONYMS[word];
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function dishTokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean).map(stem);
}

/**
 * Score how likely two strings name the same dish. Ignores word order, spacing
 * ("dan dan" vs "dandan"), plurals and a few known synonyms. A generic word
 * ("noodles") does not match a specific dish ("Dan Dan Noodles").
 */
export function dishScore(a: string, b: string): number {
  // A bracketed note on one side only ("Cumin Lamb Noodles (Spicy)" vs "Cumin Lamb Noodles") is ignored.
  // When both sides have one ("Dumplings (Pork)" vs "Dumplings (Tofu)") it still has to match.
  const paren = /\([^)]*\)/g;
  const pa = paren.test(a);
  const pb = /\([^)]*\)/.test(b);
  if (pa !== pb) return Math.max(rawDishScore(a, b), rawDishScore(a.replace(paren, " "), b.replace(paren, " ")));
  return rawDishScore(a, b);
}

function rawDishScore(a: string, b: string): number {
  const ta = dishTokens(a);
  const tb = dishTokens(b);
  const sortedA = [...ta].sort();
  const sortedB = [...tb].sort();
  return Math.max(
    similarity(sortedA.join(" "), sortedB.join(" ")),
    similarity(sortedA.join(""), sortedB.join("")),
    similarity(ta.join(""), tb.join("")),
  );
}

export const DISH_MATCH_THRESHOLD = 0.9;

/** Best-matching candidate at or above the threshold, or null. */
export function bestDishMatch<T extends { name: string }>(name: string, candidates: T[]): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const item of candidates) {
    const score = dishScore(name, item.name);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= DISH_MATCH_THRESHOLD ? best : null;
}
