// Intercepts calls to the API host so browser tests run without a backend.
import type { Page, Route } from "@playwright/test";

export const API = "http://api.test";

export const fallback = {
  mode: "fallback",
  explanation: null,
  picks: [
    { dishId: "d1", name: "Dan Dan Noodles", price: 14, reason: null, quotes: [], mentionCount: 3, flags: [], labels: [] },
    { dishId: "d2", name: "Cumin Lamb Noodles (Spicy)", price: 16.5, reason: null, quotes: [], mentionCount: 2, flags: [], labels: ["few_reviews"] },
  ],
};

export const llmPicks = {
  recommendationId: "rec1",
  mode: "llm",
  attempts: 1,
  explanation: null,
  picks: [
    { dishId: "d1", name: "Dan Dan Noodles", price: 14, reason: "The most-praised dish here, and you like it spicy.", quotes: ["Best dan dan noodles in town"], mentionCount: 3, flags: [], labels: [] },
    { dishId: "d2", name: "Cumin Lamb Noodles (Spicy)", price: 16.5, reason: "Reviewers call it the best thing on the menu.", quotes: ["The cumin lamb noodles are the best thing on the menu."], mentionCount: 2, flags: ["ask_server"], labels: ["few_reviews"] },
  ],
};

type Handlers = { recommendDelayMs?: number; onRating?: (body: unknown) => void };

export async function mockApi(page: Page, opts: Handlers = {}) {
  await page.addInitScript(() => localStorage.setItem("wg.profileId", "p1"));
  await page.route(`${API}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/profiles/p1") return json({ id: "p1", allergies: [], diets: [], budget: 25, tastes: ["spicy"], notes: "" });
    if (url.pathname === "/profiles/p1/pending-rating") return json({ recommendation: null });
    if (url.pathname === "/restaurants" && url.searchParams.get("q")?.toLowerCase().includes("noodle")) {
      return json({ results: [{ id: "r1", name: "Test Noodle House", address: "1 Main St", has_menu: true, has_reviews: true }] });
    }
    if (url.pathname === "/restaurants") return json({ results: [], suggest: "scan_menu" });
    if (url.pathname === "/restaurants/r1") return json({ id: "r1", name: "Test Noodle House", address: "1 Main St", has_menu: true, has_reviews: true });
    if (url.pathname === "/restaurants/r1/fallback") return json(fallback);
    if (url.pathname === "/restaurants/r1/recommend" && method === "POST") {
      await new Promise((r) => setTimeout(r, opts.recommendDelayMs ?? 0));
      return json(llmPicks);
    }
    if (url.pathname === "/recommendations/rec1") return json({ id: "rec1", restaurantId: "r1", picks: llmPicks.picks, rated: false });
    if (url.pathname === "/recommendations/rec1/rating" && method === "POST") {
      opts.onRating?.(route.request().postDataJSON());
      return json({ ratingId: "rt1" }, 201);
    }
    return json({ error: `unmocked ${method} ${url.pathname}` }, 404);
  });
}
