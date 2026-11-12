// Local only: bulk-load restaurants and import their menus straight into the local D1/R2,
// rendering JavaScript menu pages (Toast, Square, ChowNow...) in a headless browser first.
// Stop `npm run dev` before running so only one process writes the local database.
//   npx tsx --env-file-if-exists=.dev.vars scripts/bulk-import.ts <list.json> [concurrency]
// list.json: [{ name, address, area?, menu_url? }]. Existing restaurants (same name + address)
// are reused; restaurants that already have an active menu are skipped.
import { readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import type { Env } from "../src/app";
import { selectLlm } from "../src/llm/select";
import { importFailureMessage, importMenu } from "../src/menu/import";
import { withSourceUrl } from "../src/menu/fetcher";
import { renderingFetch } from "../src/menu/render";
import { createRestaurant, listRestaurants } from "../src/restaurants/repo";
import { playwrightRender } from "../src/validation/playwright-render";

type Item = { name: string; address: string; area?: string; menu_url?: string };
const [listPath, conc = "3"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const list: Item[] = JSON.parse(readFileSync(listPath, "utf8"));

const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.toml", persist: true });
const { DB: db, BUCKET: blobs } = proxy.env;
const llm = selectLlm({ apiKey: process.env.ANTHROPIC_API_KEY, bridgeUrl: process.env.LLM_BRIDGE_URL, bridgeProvider: process.env.LLM_BRIDGE_PROVIDER, bridgeModel: process.env.LLM_BRIDGE_MODEL });
const render = playwrightRender({ timeoutMs: 45_000 });
// --prerender: render each menu page up front (outside the importer's 15s source timeout)
// and serve that HTML to the importer, for slow JavaScript ordering pages.
const prerender = process.argv.includes("--prerender");
const rendered = new Map<string, { html: string; finalUrl: string }>();
const baseFetch: typeof fetch = (i, init) => {
  const hit = rendered.get(String(i instanceof Request ? i.url : i));
  if (hit) return Promise.resolve(withSourceUrl(new Response(hit.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }), hit.finalUrl));
  return fetch(i, init);
};
const fetcher = prerender ? baseFetch : renderingFetch(baseFetch, render);

const key = (r: { name: string; address: string }) => `${r.name}|${r.address}`.toLowerCase();
const existing = new Map((await listRestaurants(db)).map((r) => [key(r), r]));
const mapsUrl = (r: Item) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${r.name} ${r.address}`).replace(/%20/g, "+");

const summary = { created: 0, menus: 0, menuFailed: 0, noMenuUrl: 0, skipped: 0 };
let next = 0;
async function worker() {
  while (next < list.length) {
    const r = list[next++];
    const row = existing.get(key(r));
    if (row?.has_menu) { summary.skipped++; console.log(`${r.name}: already has a menu`); continue; }
    const id = row?.id ?? (await createRestaurant(db, { name: r.name, address: r.address, area: r.area, mapsUrl: mapsUrl(r) }));
    if (!row) { summary.created++; existing.set(key(r), { id, name: r.name, address: r.address, has_menu: false, has_reviews: false } as never); }
    if (!r.menu_url) { summary.noMenuUrl++; console.log(`${r.name}: added (no menu link)`); continue; }
    const t = Date.now();
    try {
      if (prerender && !/\.pdf($|\?)/i.test(r.menu_url)) {
        try { rendered.set(r.menu_url, await render(r.menu_url)); } catch (e) { console.log(`${r.name}: render failed (${(e as Error).message.slice(0, 80)}), trying plain download`); }
      }
      const res = await importMenu({ db, blobs, llm, fetch: fetcher }, { restaurantId: id, url: r.menu_url });
      const secs = Math.round((Date.now() - t) / 1000);
      if (res.status === "needs_review") { summary.menuFailed++; console.log(`${r.name}: menu failed: ${importFailureMessage(res.failures)} (${secs}s)`); }
      else { summary.menus++; console.log(`${r.name}: menu ${res.status} (${res.dishCount} dishes, ${secs}s)`); }
    } catch (e) {
      summary.menuFailed++;
      console.log(`${r.name}: menu error: ${(e as Error).message.slice(0, 160)}`);
    }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
await render.close();
await proxy.dispose();
console.log("SUMMARY", JSON.stringify(summary));
