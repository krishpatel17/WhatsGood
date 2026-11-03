// Loads demo restaurants into a running API: menu import, reviews, dish mentions.
// Usage: node scripts/seed-demo.mjs [API_URL]   (default http://localhost:8787)
// The API needs ANTHROPIC_API_KEY and APIFY_TOKEN set (in api/.dev.vars for local runs).
import { readFileSync } from "node:fs";

const API = process.argv[2] ?? "http://localhost:8787";
const restaurants = JSON.parse(readFileSync(new URL("../validation/demo-restaurants.json", import.meta.url), "utf8"));

async function call(path, body) {
  const res = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${json.error ?? ""}`);
  return json;
}

for (const r of restaurants) {
  process.stdout.write(`${r.name}: `);
  try {
    const { id } = await call("/restaurants", { name: r.name, address: r.address, mapsUrl: r.maps_url });
    const menu = await call(`/restaurants/${id}/menu`, { url: r.menu_url });
    process.stdout.write(`menu ${menu.status} (${menu.dishCount} dishes) · `);
    const reviews = await call(`/restaurants/${id}/reviews/fetch`);
    process.stdout.write(`${reviews.total} reviews · `);
    const mentions = await call(`/restaurants/${id}/reviews/extract`);
    console.log(`${mentions.matched} matched dish mentions`);
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}
