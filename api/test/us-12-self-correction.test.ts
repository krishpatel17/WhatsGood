import { describe, expect, it } from "vitest";
import { feedbackMessage, fallbackRanking, generatePicks } from "../src/recommend/generate";
import { validatePicks } from "../src/recommend/validate";
import { mockLlm } from "./helpers/llm";
import { context, goodPicks } from "./fixtures/recommend-context";

const prompt = [{ type: "text" as const, text: "MENU: ..." }];
const inventedDish = { picks: [{ ...goodPicks.picks[0], dish: "Kung Pao Chicken" }] };
const fakeQuote = { picks: [{ ...goodPicks.picks[0], quotes: ["Best dan dan noodles in America"] }] };

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

  it("[ai] AC2 unit: the parser accepts 1-3 picks and rejects more than the plan allows", () => {
    expect(validatePicks(goodPicks, context()).errors).toEqual([]);
    const four = { picks: [...goodPicks.picks, { ...goodPicks.picks[0], dish: "Vegetable Dumplings", quotes: [], mention_count: 0 }] };
    expect(validatePicks(four, context()).errors).toContain("returned 4 picks; expected 1 to 3");
    expect(validatePicks({ picks: [] }, context()).errors).toContain("returned 0 picks; expected 1 to 3");
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
