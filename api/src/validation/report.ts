import type { MenuScore } from "./score";
import { judgeA1, judgeA2, judgeA3, type Judgement, verdict } from "./verdict";

export type A1Input = { readable: number; n: number; bySourceType: Record<string, number> };
export type A2Restaurant = { id: string; name: string; tier: string; sourceType: string; seconds: number; retries: number; manualFixes: number; score: MenuScore; pass: boolean };
const IMPORTERS: Record<string, string> = {
  v1: "v1 (plain download)",
  "v2-render": "v2 (JavaScript pages rendered in a local browser before import)",
  v3: 'v3 (v2 plus add-ons such as "Extra sauce" left out, by the answer keys\' rule)',
  v4: "v4 (v3 plus pages scrolled a screen at a time, and unpriced ordering-site items left out)",
};

export type A2Input = { promptTag: string; llmPath?: string; importer?: string; restaurants: A2Restaurant[]; foodOnly?: A2Restaurant[]; bootstrap: { lo: number; hi: number } };
export type A3Restaurant = { id: string; name: string; reviews: number; atLeast1: number; atLeast3: number; atLeast10: number; enough: boolean };
export type A3Input = { promptTag?: string; llmPath?: string; restaurants: A3Restaurant[]; precision: number | null; recall: number | null };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const line = (name: string, j: Judgement | null) => `- **${name}: ${j === null ? "NOT RUN YET" : j.pass ? "PASS" : "FAIL"}**${j ? ` — ${j.summary}` : ""}`;

function groupRate(rows: A2Restaurant[], key: "tier" | "sourceType") {
  const groups = new Map<string, { pass: number; n: number }>();
  for (const r of rows) {
    const g = groups.get(r[key]) ?? { pass: 0, n: 0 };
    g.n += 1;
    if (r.pass) g.pass += 1;
    groups.set(r[key], g);
  }
  return [...groups].map(([k, g]) => `| ${k} | ${g.pass}/${g.n} |`).join("\n");
}

/** Markdown report of the three MVP assumptions and the overall verdict, for the slides and the Part 1 document. */
export function buildReport(input: { a1: A1Input | null; a2: A2Input | null; a3: A3Input | null }): string {
  const a1 = input.a1 ? judgeA1(input.a1.readable, input.a1.n) : null;
  const a2 = input.a2 ? judgeA2({ passed: input.a2.restaurants.filter((r) => r.pass).length, n: input.a2.restaurants.length, bootstrapLo: input.a2.bootstrap.lo }) : null;
  const a3 = input.a3 ? judgeA3(input.a3.restaurants.filter((r) => r.enough).length, input.a3.restaurants.length) : null;
  const v = verdict({ a1, a2, a3 });

  const out: string[] = [
    "# What's Good — Alpha validation report",
    "",
    `## Verdict: ${v.outcome}`,
    "",
    line("A1 Sources exist", a1),
    line("A2 Import works", a2),
    line("A3 Reviews mention dishes", a3),
    "",
  ];
  if (v.failed.length) out.push("### Pivot", "", ...v.failed.map((k, i) => `- ${k} failed: ${v.pivots[i]}`), "");
  if (v.pending.length) out.push(`Still to run: ${v.pending.join(", ")}. The verdict is final only when all three have results.`, "");

  if (input.a1) {
    out.push("## A1 — Menu source availability", "", "| Source type | Restaurants |", "|---|---|");
    for (const [k, n] of Object.entries(input.a1.bySourceType)) out.push(`| ${k} | ${n} |`);
    out.push("");
  }
  if (input.a2) {
    const rows = input.a2.restaurants;
    out.push(
      "## A2 — Menu import benchmark",
      "",
      `Prompts frozen at \`${input.a2.promptTag}\`. Importer: ${IMPORTERS[input.a2.importer ?? "v1"] ?? IMPORTERS.v1}. Dish-accuracy cluster bootstrap (10,000 resamples of restaurants): 95% interval [${pct(input.a2.bootstrap.lo)}, ${pct(input.a2.bootstrap.hi)}].${input.a2.llmPath === "claude-login-bridge" ? " Deviation: model calls went through a developer's Claude login with the local bridge rather than the API, so seconds include the CLI's overhead and token costs are not meaningful." : ""}`,
      "",
      "| Restaurant | Tier | Source | Accuracy | Invented | Missed | Seconds | Retries | Pass |",
      "|---|---|---|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.name} | ${r.tier} | ${r.sourceType} | ${pct(r.score.accuracy)} | ${r.score.invented} | ${r.score.missed} | ${r.seconds.toFixed(1)} | ${r.retries} | ${r.pass ? "yes" : "no"} |`),
      "",
      "| Tier | Passed |",
      "|---|---|",
      groupRate(rows, "tier"),
      "",
      "| Source type | Passed |",
      "|---|---|",
      groupRate(rows, "sourceType"),
      "",
      "### Invented and missed dishes",
      "",
      ...rows.flatMap((r) => [...r.score.inventedNames.map((n) => `- ${r.name}: invented "${n}"`), ...r.score.missedNames.map((n) => `- ${r.name}: missed "${n}"`)]),
      "",
    );
    const food = input.a2.foodOnly;
    if (food?.length) {
      out.push(
        "### Exploratory, not the pre-registered test: food dishes only",
        "",
        `Added after the v4 run, so it does not change the A2 result or the verdict. The MVP ranks food dishes, so this view leaves drinks, sauces and toppings out of both the answer key and the import (generic section and name words, src/validation/food-only.ts). ${food.filter((r) => r.pass).length}/${food.length} restaurants pass when drinks, sauces and toppings are left out. A pre-registered Beta test on new restaurants is needed before this counts.`,
        "",
        "| Restaurant | Accuracy | Invented | Missed | Pass |",
        "|---|---|---|---|---|",
        ...food.map((r) => `| ${r.name} | ${pct(r.score.accuracy)} | ${r.score.invented} | ${r.score.missed} | ${r.pass ? "yes" : "no"} |`),
        "",
        ...food.flatMap((r) => [...r.score.inventedNames.map((n) => `- ${r.name}: invented "${n}"`), ...r.score.missedNames.map((n) => `- ${r.name}: missed "${n}"`)]),
        "",
      );
    }
  }
  if (input.a3) {
    out.push(
      "## A3 — Review dish coverage",
      "",
      `Prompts frozen at \`${input.a3.promptTag ?? "unknown"}\`.${input.a3.llmPath === "claude-login-bridge" ? " Deviation: extraction used a developer's Claude login via the local bridge; token costs are not meaningful as API billing estimates." : ""}`,
      "",
      `Extraction against the hand-labeled sample: precision ${input.a3.precision === null ? "not measured yet" : pct(input.a3.precision)}, recall ${input.a3.recall === null ? "not measured yet" : pct(input.a3.recall)}.`,
      "",
      "| Restaurant | Reviews | Dishes >=1 | >=3 | >=10 | Enough for top 3 |",
      "|---|---|---|---|---|---|",
      ...input.a3.restaurants.map((r) => `| ${r.name} | ${r.reviews} | ${r.atLeast1} | ${r.atLeast3} | ${r.atLeast10} | ${r.enough ? "yes" : "no"} |`),
      "",
    );
  }
  return out.join("\n");
}
