import { describe, expect, it } from "vitest";
import { feedbackMessage, fallbackRanking, generatePicks } from "../src/recommend/generate";
import { planPicks } from "../src/recommend/plan";
import { validatePicks } from "../src/recommend/validate";
import { mockLlm } from "./helpers/llm";
import { context, evidence, goodPicks, menu } from "./fixtures/recommend-context";

const prompt = [{ type: "text" as const, text: "MENU: ..." }];
const inventedDish = { picks: [{ ...goodPicks.picks[0], dish: "Kung Pao Chicken" }] };
const fakeQuote = { picks: [{ ...goodPicks.picks[0], quotes: ["Best dan dan noodles in America"] }] };

// Dan Dan Noodles is also listed in a second section, under a slightly different name, with reviews of its own.
const twin = { ...menu[0], id: "d1-lunch", name: "Dan Dan Noodles (Lunch)", section: "Lunch" };
function twinContext() {
  const ctx = context();
  const ev = { ...evidence, byDish: new Map([...evidence.byDish, [twin.id, { count: 2, avgSentiment: 0.9, reviewIds: new Set(["rv3", "rv4"]) }]]) };
  const allowed = [...ctx.allowed, { ...twin, flags: [] }];
  return { ...ctx, menu: [...ctx.menu, twin], allowed, evidence: ev, plan: planPicks(allowed, ev) };
}
const repeated = {
  picks: [goodPicks.picks[0], { dish: twin.name, reason: "Also great.", quotes: ["Loved the dan dan noodles."], mention_count: 2 }],
};
// d3 passes the no-pork filter, but its reason names bacon.
const noPork = { diets: ["no_pork" as const] };
const namesBacon = { picks: [{ ...goodPicks.picks[2], reason: "Better with bacon on top." }] };

describe("US-12 Self-correction loop and fallback ranking", () => {
  it("[ai] T1 unit: feedback message lists every failed check with the item index", () => {
    const { errors } = validatePicks(
      { picks: [{ ...goodPicks.picks[0], dish: "Kung Pao Chicken" }, { ...goodPicks.picks[1], mention_count: 9 }] },
      context(),
    );
    const msg = feedbackMessage(1, errors);
    expect(msg.split("\n")).toEqual([
      "VALIDATION FAILED (attempt 1/3):",
      '- item[0] "Kung Pao Chicken" is not on this restaurant\'s menu',
      '- item[1] "Cumin Lamb Noodles (Spicy)" mention_count 9 does not match database count 2',
      "Regenerate the full list. Use only dishes from MENU and quotes from REVIEWS.",
    ]);
  });

  it("[ai] T2 integration: fail, fail, pass returns the third answer", async () => {
    const llm = mockLlm([inventedDish, fakeQuote, goodPicks]);
    const failures: { attempt: number; errors: string[] }[] = [];
    const out = await generatePicks({ llm, onFailure: async (attempt, errors) => void failures.push({ attempt, errors }) }, context(), prompt);
    expect(out.mode).toBe("llm");
    expect(out.attempts).toBe(3);
    expect(out.picks.map((p) => p.name)).toEqual(["Dan Dan Noodles", "Cumin Lamb Noodles (Spicy)", "Garlic Bok Choy Noodles"]);
    expect(out.picks[0]).toMatchObject({ dishId: "d1", reason: goodPicks.picks[0].reason, mentionCount: 3, labels: [] });
    expect(out.picks[1].labels).toEqual(["few_reviews"]);
    // The third request carries the second attempt's feedback.
    expect(JSON.stringify(llm.calls[2].messages)).toContain("VALIDATION FAILED (attempt 2/3)");
    expect(failures.map((f) => f.attempt)).toEqual([1, 2]);
  });

  it("[ai] T3 integration: fail x3 returns the fallback ranking with no generated text", async () => {
    const llm = mockLlm([inventedDish, inventedDish, { raw: "not json" }]);
    const failures: number[] = [];
    const out = await generatePicks({ llm, onFailure: async (a) => void failures.push(a) }, context(), prompt);
    expect(out.mode).toBe("fallback");
    expect(failures).toEqual([1, 2, 3]);
    expect(out.picks.every((p) => p.reason === null)).toBe(true);
    expect(out.picks.map((p) => p.dishId)).toEqual(["d1", "d2", "d3"]);
    expect(out.picks[0].quotes).toEqual([]);
  });

  it("[ai] T4 unit: fallback ranking respects restriction filters and sorts by sentiment x mentions", () => {
    // d1: 0.8 x 3 = 2.4, d2: 0.95 x 2 = 1.9, d3: 0.6 x 1 = 0.6, d4: -0.7, d5: no mentions.
    expect(fallbackRanking(context()).map((p) => p.dishId)).toEqual(["d1", "d2", "d3"]);
    // Peanut allergy removes Dan Dan Noodles, leaving 2 positively reviewed dishes, so the plan (US-13) caps it at 2.
    expect(fallbackRanking(context({ allergies: ["peanut"] })).map((p) => p.dishId)).toEqual(["d2", "d3"]);
    // No pork removes Dan Dan Noodles and the pork dumplings; the budget removes the lamb noodles.
    const ranked = fallbackRanking(context({ diets: ["no_pork"], budget: 15 }));
    expect(ranked.map((p) => p.dishId)).toEqual(["d3", "d5"]);
    expect(ranked[0]).toMatchObject({ reason: null, quotes: [], mentionCount: 1, labels: ["few_reviews"] });
  });

  it("[ai] T8 integration: a repeated dish goes through the retry loop", async () => {
    const llm = mockLlm([repeated, goodPicks]);
    const out = await generatePicks({ llm, onFailure: async () => {} }, twinContext(), prompt);
    expect(out.mode).toBe("llm");
    expect(out.attempts).toBe(2);
    expect(JSON.stringify(llm.calls[1].messages)).toContain('item[1] \\"Dan Dan Noodles (Lunch)\\" repeats item[0]');
  });

  it("[ai] T9 integration: repeats x3 fall back to a ranking that shows the dish once", async () => {
    const llm = mockLlm([repeated, repeated, repeated]);
    const out = await generatePicks({ llm, onFailure: async () => {} }, twinContext(), prompt);
    expect(out.mode).toBe("fallback");
    expect(out.picks.map((p) => p.dishId)).toEqual(["d1", "d2", "d3"]);
    expect(out.picks.every((p) => p.reason === null)).toBe(true);
  });

  it("[ai] T10 unit: fallback keeps the listing with the reviews, so a disliked dish can't return through its twin", () => {
    // d4 Pork Dumplings has a negative score, and its twin has no mentions of its own.
    const dup = { ...menu[3], id: "d4-lunch", section: "Lunch", flags: [] };
    const ctx = context();
    const ranked = fallbackRanking({ ...ctx, allowed: [dup, ...ctx.allowed.filter((d) => d.id === "d4" || d.id === "d5")] });
    expect(ranked.map((p) => p.name)).toEqual(["Vegetable Dumplings"]);
  });

  it("[ai] T11 unit: a pick resolves to the listing that was offered, not an earlier one the diner can't have", () => {
    const dinner = { ...menu[2], id: "d3-dinner", section: "Dinner", price: 40 };
    const base = context({ budget: 20 });
    const out = validatePicks({ picks: [goodPicks.picks[2]] }, { ...base, menu: [dinner, ...base.menu] });
    expect(out.errors).toEqual([]);
    expect(out.picks[0].dishId).toBe("d3");
  });

  it("[ai] T12 integration: a reason naming a conflicting ingredient goes through the retry loop", async () => {
    const clean = { picks: [goodPicks.picks[2]] };
    const llm = mockLlm([namesBacon, clean]);
    const failures: string[][] = [];
    const out = await generatePicks({ llm, onFailure: async (_, errors) => void failures.push(errors) }, context(noPork), prompt);
    expect(out.mode).toBe("llm");
    expect(out.attempts).toBe(2);
    expect(out.picks[0].reason).toBe(goodPicks.picks[2].reason);
    expect(failures).toEqual([['item[0] "Garlic Bok Choy Noodles" reason names "bacon", which conflicts with user diet: no_pork. If the dish contains it, pick another dish']]);
    expect(JSON.stringify(llm.calls[1].messages)).toContain("VALIDATION FAILED (attempt 1/3)");
  });

  it("[ai] T13 integration: a conflicting reason x3 falls back with no generated text", async () => {
    const llm = mockLlm([namesBacon, namesBacon, namesBacon]);
    const out = await generatePicks({ llm, onFailure: async () => {} }, context(noPork), prompt);
    expect(out.mode).toBe("fallback");
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.picks.every((p) => p.reason === null && p.quotes.length === 0)).toBe(true);
    expect(JSON.stringify(out.picks)).not.toContain("bacon");
  });

  // Human-specified: US-08 owns global 1..3 bounds; this test owns plan-specific limits.
  it.each([1, 2])("[manual] US12-R01 honors a plan allowing at most %s picks", maxPicks => {
    const ctx = context(); ctx.plan = {...ctx.plan,maxPicks};
    expect(validatePicks({picks:goodPicks.picks.slice(0,maxPicks)},ctx).errors).toEqual([]);
    expect(validatePicks({picks:goodPicks.picks.slice(0,maxPicks+1)},ctx).errors).toContain(`returned ${maxPicks+1} picks; expected 1 to ${maxPicks}`);
    expect(validatePicks({picks:[]},ctx).errors).toContain(`returned 0 picks; expected 1 to ${maxPicks}`);
  });
});

describe("US-12 failure log", () => {
  it("[ai] AC3 integration: every failure is logged with attempt number, failed check and restaurant ID", async () => {
    const { testDb } = await import("./helpers/db");
    const { failureLogger } = await import("../src/recommend/failures");
    const db = testDb();
    const llm = mockLlm([inventedDish, goodPicks]);
    await generatePicks({ llm, onFailure: failureLogger(db, "r1", "recommend") }, context(), prompt);
    const rows = db.raw.prepare("SELECT restaurant_id, task, attempt, failed_check FROM llm_failures").all();
    expect(rows).toEqual([{ restaurant_id: "r1", task: "recommend", attempt: 1, failed_check: 'item[0] "Kung Pao Chicken" is not on this restaurant\'s menu' }]);
  });

  it("[ai] T7 integration: a failed model call returns the fallback ranking and logs the failure", async () => {
    let calls = 0;
    const llm = {
      json: async () => {
        calls++;
        throw new Error("401 Invalid bearer token");
      },
    };
    const failures: { attempt: number; errors: string[] }[] = [];
    const out = await generatePicks({ llm, onFailure: async (attempt, errors) => void failures.push({ attempt, errors }) }, context(), prompt);
    expect(calls).toBe(1);
    expect(out.mode).toBe("fallback");
    expect(out.attempts).toBe(1);
    expect(out.picks.map((p) => p.dishId)).toEqual(["d1", "d2", "d3"]);
    expect(out.picks.every((p) => p.reason === null)).toBe(true);
    expect(failures).toEqual([{ attempt: 1, errors: ["model call failed: 401 Invalid bearer token"] }]);
  });
});
