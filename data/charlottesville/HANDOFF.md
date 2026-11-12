# Charlottesville restaurant data — handoff

**State (2026-11-12, merged):** 199 restaurants, 92 with active menus (5,951 dishes), 67 with reviews (3,779 reviews, 2,955 dish mentions). Saved repo reviews for all 10 survey restaurants (mentions done, incl. Crozet Pizza); 57 more restaurants got 35 recent Google reviews each via Apify (~$0.94 of credit used). Combines krishpatel17's menu retries (Bodo's Bagels, Mellow Mushroom, El Tio) with ll739's Apify reviews.

Note: export `seed.sql` with an sqlite3 that does not emit `unistr(...)` (sqlite3 >= 3.48 does for newlines), or loading into D1 fails on those rows. Check with `grep -c unistr data/charlottesville/seed.sql` (should be 0).

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
Done: saved reviews + mentions (all 10), slow-menu retry with the Toast prerender fix, Apify reviews for 57 restaurants.
1. Apify reviews still missing for ~25 restaurants with menus (most hit Node's 5-minute timeout on Apify's sync endpoint — "fetch failed" — e.g. Mockingbird, C&O, Michie Tavern, Lampo, Texas Roadhouse; plus Noodles & Company 408, Oakhurst Inn no maps link). Rerun `npx tsx --env-file-if-exists=.dev.vars scripts/fetch-reviews.ts 35 4 2`; it only picks restaurants with a menu and no reviews.
2. Retry `Chimm` and `Tubby's` if still missing; Pizza Hut blocks headless browsers.
3. Need better menu URLs by hand: Brightside Beach Pub, Rapture, Royalty Eats, Plaza Azteca, Moge Tee, Mochiko, Al Carbon, Mashu Festival, Conmole, Barbie's Burrito Barn, plus the ~39 earlier "No dishes found" and 57 with no menu link.
4. Re-export `seed.sql` (sqlite3 loop in the PR description) and push.

Production D1 is untouched. To load there: `npx wrangler d1 execute whats-good --remote --file=../data/charlottesville/seed.sql` (only when the team agrees).
