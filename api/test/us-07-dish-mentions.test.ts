import { beforeEach, describe, expect, it } from "vitest";
import { aggregateMentions, extractMentions, matchMention, quoteInReview } from "../src/reviews/mentions";
import { dishStats } from "../src/reviews/stats";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { seedRestaurant } from "./helpers/seed";
import type { LlmRequest } from "../src/llm/types";

const menu = [
  { id: "d1", name: "Dandan Mian" },
  { id: "d2", name: "Pork Dumplings" },
];

/** Answers each extraction call using the review ids the prompt actually contains. */
function respond(byText: Record<string, { dish: string; sentiment: number; quote: string }[]>) {
  return (req: LlmRequest) => {
    const prompt = JSON.stringify(req.messages);
    const reviews = [...prompt.matchAll(/\[review ([\w-]+)\] ([^\\]*)/g)].map((m) => ({ id: m[1], text: m[2] }));
    return {
      mentions: reviews.flatMap((r) =>
        Object.entries(byText)
          .filter(([needle]) => r.text.includes(needle))
          .flatMap(([, ms]) => ms.map((m) => ({ review_id: r.id, ...m }))),
      ),
    };
  };
}

describe("US-07 Extract dish mentions and sentiment from reviews", () => {
  it("[ai] T1 unit: matcher scores 'dan dan noodles' vs 'Dandan Mian' at >= 0.9 and 'noodles' vs 'Dumplings' below it", () => {
    expect(matchMention("dan dan noodles", menu)).toMatchObject({ dishId: "d1" });
    expect(matchMention("dan dan noodles", menu)!.score).toBeGreaterThanOrEqual(0.9);
    expect(matchMention("noodles", [{ id: "d3", name: "Dumplings" }])).toBeNull();
  });

  it("[ai] T2 unit: quote-span checker rejects a span not found verbatim", () => {
    const review = "The dan dan noodles are great but skip the pork dumplings.";
    expect(quoteInReview("dan dan noodles are great", review)).toBe(true);
    expect(quoteInReview("dan dan noodles were great", review)).toBe(false);
    expect(quoteInReview("", review)).toBe(false);
  });

  describe("extraction", () => {
    let db: ReturnType<typeof testDb>;
    let seed: Awaited<ReturnType<typeof seedRestaurant>>;
    beforeEach(async () => {
      db = testDb();
      seed = await seedRestaurant(db);
    });

    it("[ai] T3 integration: a mixed review fixture (mocked LLM) yields one positive and one negative mention", async () => {
      const llm = mockLlm([
        respond({
          "skip the pork dumplings": [
            { dish: "Dan Dan Noodles", sentiment: 0.8, quote: "The dan dan noodles are great" },
            { dish: "Pork Dumplings", sentiment: -0.7, quote: "skip the pork dumplings, they were soggy" },
          ],
        }),
      ]);
      const result = await extractMentions({ db, llm }, "r1");
      expect(result).toMatchObject({ reviews: 5, mentions: 2, matched: 2, rejectedQuotes: 0 });
      const rows = db.raw.prepare("SELECT dish_id, sentiment, quote FROM mentions ORDER BY sentiment").all() as { dish_id: string; sentiment: number }[];
      expect(rows).toEqual([
        expect.objectContaining({ dish_id: seed.dishId("Pork Dumplings"), sentiment: -0.7 }),
        expect.objectContaining({ dish_id: seed.dishId("Dan Dan Noodles"), sentiment: 0.8 }),
      ]);
      // The model is given the menu and only this restaurant's reviews.
      const prompt = JSON.stringify(llm.calls[0].messages);
      expect(prompt).toContain("Cumin Lamb Noodles (Spicy)");
      expect(prompt).toContain("Nice patio");
    });

    it("[ai] AC2/AC3 integration: invented quotes are dropped and low-scoring dishes are stored as unmatched", async () => {
      const llm = mockLlm([
        respond({
          "Best dan dan": [{ dish: "Dan Dan Noodles", sentiment: 0.9, quote: "best noodles I have ever had" }],
          "Nice patio": [{ dish: "patio", sentiment: 0.5, quote: "Nice patio" }],
        }),
      ]);
      const result = await extractMentions({ db, llm }, "r1");
      expect(result).toMatchObject({ mentions: 1, matched: 0, rejectedQuotes: 1 });
      expect(db.raw.prepare("SELECT dish_id, mention FROM mentions").all()).toEqual([{ dish_id: null, mention: "patio" }]);
    });

    it("[ai] AC1 integration: sentiment outside -1..1 is rejected and re-running replaces old mentions", async () => {
      const once = respond({ "Loved the dan dan": [{ dish: "Dan Dan Noodles", sentiment: 3, quote: "Loved the dan dan noodles" }] });
      await extractMentions({ db, llm: mockLlm([once]) }, "r1");
      expect(db.raw.prepare("SELECT COUNT(*) AS n FROM mentions").get()).toEqual({ n: 0 });
      const ok = respond({ "Loved the dan dan": [{ dish: "Dan Dan Noodles", sentiment: 0.9, quote: "Loved the dan dan noodles" }] });
      await extractMentions({ db, llm: mockLlm([ok]) }, "r1");
      await extractMentions({ db, llm: mockLlm([ok]) }, "r1");
      expect(db.raw.prepare("SELECT COUNT(*) AS n FROM mentions").get()).toEqual({ n: 1 });
    });

    it("[ai] T4 unit: aggregation computes mention count and mean sentiment per dish", async () => {
      expect(
        aggregateMentions([
          { dish_id: "a", sentiment: 1 },
          { dish_id: "a", sentiment: 0 },
          { dish_id: "b", sentiment: -0.5 },
          { dish_id: null, sentiment: 1 },
        ]),
      ).toEqual(
        new Map([
          ["a", { mentions: 2, avgSentiment: 0.5 }],
          ["b", { mentions: 1, avgSentiment: -0.5 }],
        ]),
      );

      const llm = mockLlm([
        respond({
          "skip the pork": [
            { dish: "Dan Dan Noodles", sentiment: 0.8, quote: "dan dan noodles are great" },
            { dish: "Pork Dumplings", sentiment: -0.6, quote: "skip the pork dumplings" },
          ],
          "Best dan dan": [{ dish: "Dan Dan Noodles", sentiment: 1, quote: "Best dan dan noodles in town" }],
          "Loved the dan dan": [{ dish: "Dan Dan Noodles", sentiment: 0.6, quote: "Loved the dan dan noodles" }],
        }),
      ]);
      await extractMentions({ db, llm }, "r1");
      const stats = await dishStats(db, "r1");
      expect(stats.get(seed.dishId("Dan Dan Noodles"))).toEqual({ mentions: 3, avgSentiment: 0.8 });
      expect(stats.get(seed.dishId("Pork Dumplings"))).toEqual({ mentions: 1, avgSentiment: -0.6 });
    });
  });
});
