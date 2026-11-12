# Charlottesville restaurant data — handoff

**State (2026-11-12):** 199 restaurants, 91 with active menus (5,821 dishes). Saved reviews + dish mentions loaded for all 10 survey restaurants (2,211 reviews, 1,583 mentions; Crozet Pizza's mentions still pending, menu now loaded). No Apify reviews fetched yet.

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
Done: saved reviews (step 1) and the slow-menu retry (15 of 29 recovered; Toast prerender fix is in `playwrightRender` — `domcontentloaded` + 8s settle, fails fast on HTTP 4xx).
1. Fresh reviews: `npx tsx --env-file-if-exists=.dev.vars scripts/fetch-reviews.ts 40 10 5` (10 workers for mention extraction, 5 concurrent Apify runs = free-plan cap). ~109 restaurants, ~$2.60. Codex bridge with `LLM_BRIDGE_MODEL=gpt-6-luna` worked well.
2. Crozet Pizza: extract mentions now that it has a menu (re-run `scripts/load-saved-reviews.ts`).
3. Retry `Chimm` and `Tubby's` (Codex bridge timed out at 120s) and Pizza Hut (HTTP2 error, blocks headless).
4. Need better menu URLs by hand: Brightside Beach Pub, Rapture, Royalty Eats, Plaza Azteca, Moge Tee, Mochiko, Al Carbon, Mashu Festival, Conmole, Barbie's Burrito Barn (validation 11 vs 22), plus the ~39 earlier "No dishes found" and 57 with no menu link.
5. Re-export `seed.sql` (sqlite3 loop in the PR description) and push.

Production D1 is untouched. To load there: `npx wrangler d1 execute whats-good --remote --file=../data/charlottesville/seed.sql` (only when the team agrees).
