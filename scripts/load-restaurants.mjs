// Loads a list of restaurants into a running API and imports each one's menu.
// Usage: node scripts/load-restaurants.mjs <list.json> [API_URL] [concurrency]
// list.json: [{ name, address, area?, menu_url? }]. Restaurants already in the API
// (same name + address) are not created again; their menu import is retried only
// if they have no menu yet. Reviews are skipped (they need APIFY_TOKEN).
import { readFileSync } from "node:fs";

const [listPath, API = "http://localhost:8787", conc = "2"] = process.argv.slice(2);
const list = JSON.parse(readFileSync(listPath, "utf8"));

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

const key = (r) => `${r.name}|${r.address}`.toLowerCase();
const existing = new Map();
const listed = await call("GET", "/restaurants");
for (const r of listed.json.results ?? listed.json ?? []) existing.set(key(r), r);

const mapsUrl = (r) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${r.name} ${r.address}`).replace(/%20/g, "+");

const summary = { created: 0, menus: 0, menuFailed: 0, noMenuUrl: 0, skipped: 0 };
let next = 0;
async function worker() {
  while (next < list.length) {
    const r = list[next++];
    let row = existing.get(key(r));
    if (!row) {
      const res = await call("POST", "/restaurants", { name: r.name, address: r.address, area: r.area, mapsUrl: mapsUrl(r) });
      if (!res.ok) { console.log(`${r.name}: create failed HTTP ${res.status}`); continue; }
      row = res.json; summary.created++;
    } else if (row.has_menu) { summary.skipped++; console.log(`${r.name}: already loaded`); continue; }
    if (!r.menu_url) { summary.noMenuUrl++; console.log(`${r.name}: added (no menu link)`); continue; }
    const t = Date.now();
    const m = await call("POST", `/restaurants/${row.id}/menu`, { url: r.menu_url });
    const secs = Math.round((Date.now() - t) / 1000);
    if (m.ok) { summary.menus++; console.log(`${r.name}: menu ${m.json.status} (${m.json.dishCount} dishes, ${secs}s)`); }
    else { summary.menuFailed++; console.log(`${r.name}: menu failed HTTP ${m.status} ${m.json.error ?? ""} (${secs}s)`); }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
console.log("SUMMARY", JSON.stringify(summary));
