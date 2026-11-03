import { clopperPearson } from "./stats";

export type Judgement = { pass: boolean; summary: string };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ci = (x: number, n: number) => {
  const [lo, hi] = clopperPearson(x, n);
  return `95% CI [${lo.toFixed(3)}, ${hi.toFixed(3)}]`;
};

export const THRESHOLDS = { a1: 0.8, a2Restaurants: 0.8, a2BootstrapLo: 0.9, a3: 0.8 };

export function judgeA1(readable: number, n: number): Judgement {
  return { pass: readable / n >= THRESHOLDS.a1 - 1e-9, summary: `${readable}/${n} restaurants have a readable menu source (${pct(readable / n)}, ${ci(readable, n)}); threshold >= 24/30` };
}

export function judgeA2(r: { passed: number; n: number; bootstrapLo: number }): Judgement {
  const pass = r.passed / r.n >= THRESHOLDS.a2Restaurants - 1e-9 && r.bootstrapLo >= THRESHOLDS.a2BootstrapLo;
  return { pass, summary: `${r.passed}/${r.n} restaurants imported easily (${ci(r.passed, r.n)}); dish-accuracy bootstrap lower bound ${pct(r.bootstrapLo)}; thresholds >= 8/10 and >= 90%` };
}

export function judgeA3(enough: number, n: number): Judgement {
  return { pass: enough / n >= THRESHOLDS.a3 - 1e-9, summary: `${enough}/${n} restaurants have at least 3 dishes with >= 3 matched mentions (${ci(enough, n)}); threshold >= 8/10` };
}

export const PIVOTS = {
  A1: "Make photo scanning (US-04) the main way menus get in.",
  A2: "Narrow import to the source types that passed and move the rest to the Beta.",
  A3: "Rank from the menu plus our own post-meal ratings, and lean on the 'few reviews' labels (US-13).",
};

type Key = keyof typeof PIVOTS;

/** Validated only if A1, A2 and A3 all pass. Any failure invalidates and names its pivot; missing results leave it pending. */
export function verdict(j: Record<"a1" | "a2" | "a3", Judgement | null>) {
  const keys: Key[] = ["A1", "A2", "A3"];
  const get = (k: Key) => j[k.toLowerCase() as "a1" | "a2" | "a3"];
  const failed = keys.filter((k) => get(k)?.pass === false);
  const pending = keys.filter((k) => get(k) === null);
  const outcome = failed.length ? "Invalidated" : pending.length ? "Pending" : "Validated";
  return { outcome, failed, pending, pivots: failed.map((k) => PIVOTS[k]) } as const;
}
