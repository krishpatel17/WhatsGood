// Local only: load the Google reviews saved in validation/a3-coverage/reviews into the local D1,
// then extract dish mentions for each restaurant that has an active menu.
//   npx tsx --env-file-if-exists=.dev.vars scripts/load-saved-reviews.ts
import { readdirSync, readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import type { Env } from "../src/app";
import { selectLlm } from "../src/llm/select";
import { listRestaurants } from "../src/restaurants/repo";
import { type ReviewRow, saveReviews } from "../src/reviews/collect";
import { activeMenuDishes, extractMentions } from "../src/reviews/mentions";

const dir = "../validation/a3-coverage/reviews";
// Survey ids -> restaurant name and street address (survey.csv: id,area,name,address,...).
const survey = new Map(
  readFileSync("../validation/a1-survey/survey.csv", "utf8").split("\n").slice(1).filter(Boolean)
    .map((line) => line.match(/^([A-Z]{2}\d{2}),[^,]*,("[^"]*"|[^,]*),("[^"]*"|[^,]*)/)!)
    .map((m) => [m[1].toLowerCase(), { name: m[2].replace(/"/g, ""), address: m[3].replace(/"/g, "") }]),
);

const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.toml", persist: true });
const db = proxy.env.DB;
const llm = selectLlm({ apiKey: process.env.ANTHROPIC_API_KEY, bridgeUrl: process.env.LLM_BRIDGE_URL, bridgeProvider: process.env.LLM_BRIDGE_PROVIDER, bridgeModel: process.env.LLM_BRIDGE_MODEL });
const rows = await listRestaurants(db);

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const s = survey.get(file.replace(".json", ""));
  const r = s && rows.find((x) => x.name === s.name && x.address.startsWith(s.address));
  if (!r) { console.log(`${file}: no matching restaurant (${s?.name ?? "unknown id"})`); continue; }
  const saved = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as { source_id: string; text: string; rating: number | null; date: string | null }[];
  const reviews: ReviewRow[] = saved.filter((x) => x.text?.trim()).map((x) => ({ source_id: x.source_id, text: x.text.trim(), rating: x.rating, date: x.date, source: x.source_id.split(":")[0] || "google" }));
  const total = await saveReviews(db, r.id, reviews);
  if ((await activeMenuDishes(db, r.id)).length === 0) { console.log(`${r.name}: ${total} reviews stored; no menu yet, mentions skipped`); continue; }
  const t = Date.now();
  try {
    const m = await extractMentions({ db, llm }, r.id);
    console.log(`${r.name}: ${total} reviews, ${m.matched} dish mentions matched (${Math.round((Date.now() - t) / 1000)}s)`);
  } catch (e) {
    console.log(`${r.name}: ${total} reviews stored; mention extraction failed: ${(e as Error).message.slice(0, 160)}`);
  }
}
await proxy.dispose();
