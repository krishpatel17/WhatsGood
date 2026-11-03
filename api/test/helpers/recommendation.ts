// A stored recommendation with two picks at a seeded restaurant.
import { recommend } from "../../src/recommend/service";
import { ProfileSchema } from "../../src/profile/schema";
import { createProfile } from "../../src/profile/repo";
import { mockLlm } from "./llm";
import { seedRestaurant } from "./seed";
import type { testDb } from "./db";

export async function seedRecommendation(db: ReturnType<typeof testDb>) {
  const seed = await seedRestaurant(db);
  const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, 'r1', ?, ?, 'x', ?, ?, 1)");
  insert.run("m1", seed.reviewId("google:3"), seed.dishId("Dan Dan Noodles"), 1, "Best dan dan noodles in town");
  insert.run("m2", seed.reviewId("google:2"), seed.dishId("Cumin Lamb Noodles (Spicy)"), 0.9, "Cumin lamb noodles were spicy and perfect.");
  const profileId = await createProfile(db, ProfileSchema.parse({}));
  const llm = mockLlm([
    {
      picks: [
        { dish: "Dan Dan Noodles", reason: "Most loved.", quotes: ["Best dan dan noodles in town"], mention_count: 1 },
        { dish: "Cumin Lamb Noodles (Spicy)", reason: "Spicy favorite.", quotes: ["Cumin lamb noodles were spicy and perfect."], mention_count: 1 },
      ],
    },
  ]);
  const rec = await recommend({ db, llm }, "r1", profileId, ProfileSchema.parse({}));
  return { ...seed, profileId, recommendationId: rec.recommendationId };
}
