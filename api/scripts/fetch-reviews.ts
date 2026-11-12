// Local only: fetch recent Google reviews (Apify) for every restaurant that has an active menu
// and no reviews yet, then extract dish mentions. Caps reviews per restaurant to control cost.
//   npx tsx --env-file-if-exists=.dev.vars scripts/fetch-reviews.ts [maxReviews=40] [concurrency=2]
import { getPlatformProxy } from "wrangler";
import type { Env } from "../src/app";
import { selectLlm } from "../src/llm/select";
import { listRestaurants } from "../src/restaurants/repo";
import { APIFY_ACTOR, mapApifyItem, type ReviewRow, saveReviews } from "../src/reviews/collect";
import { extractMentions } from "../src/reviews/mentions";

const [max = "40", conc = "2"] = process.argv.slice(2);
const token = process.env.APIFY_TOKEN;
if (!token) throw new Error("APIFY_TOKEN is not set in .dev.vars");

const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.toml", persist: true });
const db = proxy.env.DB;
const llm = selectLlm({ apiKey: process.env.ANTHROPIC_API_KEY, bridgeUrl: process.env.LLM_BRIDGE_URL, bridgeProvider: process.env.LLM_BRIDGE_PROVIDER, bridgeModel: process.env.LLM_BRIDGE_MODEL });
const todo = (await listRestaurants(db)).filter((r) => r.has_menu && !r.has_reviews);
console.log(`${todo.length} restaurants with a menu and no reviews; up to ${max} reviews each`);

let next = 0, total = 0;
async function worker() {
  while (next < todo.length) {
    const r = todo[next++];
    const place = await db.prepare("SELECT maps_url FROM restaurants WHERE id = ?").bind(r.id).first<{ maps_url: string | null }>();
    if (!place?.maps_url) { console.log(`${r.name}: no maps link`); continue; }
    const t = Date.now();
    try {
      const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url: place.maps_url }], maxReviews: Number(max), reviewsSort: "newest", language: "en" }),
      });
      if (!res.ok) { console.log(`${r.name}: Apify HTTP ${res.status} ${(await res.text()).slice(0, 160)}`); if (res.status === 402) process.exit(1); continue; }
      const rows = ((await res.json()) as Record<string, unknown>[]).map(mapApifyItem).filter((x): x is ReviewRow => x !== null);
      total += rows.length;
      const stored = await saveReviews(db, r.id, rows);
      if (stored === 0) { console.log(`${r.name}: 0 reviews found`); continue; }
      const m = await extractMentions({ db, llm }, r.id);
      console.log(`${r.name}: ${stored} reviews, ${m.matched} dish mentions (${Math.round((Date.now() - t) / 1000)}s)`);
    } catch (e) {
      console.log(`${r.name}: error ${(e as Error).message.slice(0, 160)}`);
    }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
await proxy.dispose();
console.log(`DONE ${total} reviews fetched (~$${((total / 1000) * 0.6).toFixed(2)} of Apify credit)`);
