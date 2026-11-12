# Charlottesville restaurant data — handoff

**State (2026-11-11):** 199 restaurants, ~76 with menus. Saved repo reviews loaded for some of the 10 survey restaurants (Sedona, El Puerto, Marco and Luca done; rest pending). No Apify reviews fetched yet.

## Files
- `seed.sql` — restaurants, menus, dishes, reviews, mentions exported from local D1 (idempotent `INSERT OR IGNORE`).
- `restaurants.json` — 198 restaurants (30 from the A1 survey + OpenStreetMap, Charlottesville bbox) with menu links where found.
- `retry-timeouts.json` — 29 menus that failed on timeout/validation.
- `api/scripts/bulk-import.ts` — creates restaurants + imports menus straight into local D1, rendering JS pages. `--prerender` renders first.
- `api/scripts/load-saved-reviews.ts` — loads `validation/a3-coverage/reviews/*.json` and extracts dish mentions.
- `api/scripts/fetch-reviews.ts` — Apify reviews (default 40/restaurant) for restaurants with menus and no reviews, then mentions.

## Load it
```bash
npm ci
cd api && cp .dev.vars.example .dev.vars   # set ANTHROPIC_API_KEY (or LLM_BRIDGE_*) and APIFY_TOKEN
npx wrangler d1 migrations apply whats-good --local
npx wrangler d1 execute whats-good --local --file=../data/charlottesville/seed.sql
```

## Remaining work (run from api/, with `npm run dev` stopped so one process writes D1)
1. Finish saved reviews: `npx tsx --env-file-if-exists=.dev.vars scripts/load-saved-reviews.ts` (re-running is safe; mentions are replaced).
2. Retry slow menus: `npx tsx --env-file-if-exists=.dev.vars scripts/bulk-import.ts ../data/charlottesville/retry-timeouts.json 2 --prerender`.
   Known issue: Toast pages never reach "network idle", so `playwrightRender` times out. Fix: in the prerender path use `waitUntil: "domcontentloaded"` + ~8s wait + scroll. Toast may still return 403 to headless browsers; skip those.
3. Fresh reviews: `npx tsx --env-file-if-exists=.dev.vars scripts/fetch-reviews.ts 40 2` (~$0.60 per 1,000 reviews; Apify free tier had ~$2.11 left).
4. Re-export `seed.sql` (see the sqlite3 loop in the PR description) and push.
5. ~39 restaurants failed with "No dishes found" and 57 have no menu link: these need better menu URLs by hand.

Production D1 is untouched. To load there: `npx wrangler d1 execute whats-good --remote --file=../data/charlottesville/seed.sql` (only when the team agrees).
