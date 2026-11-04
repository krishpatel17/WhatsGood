# What's Good

*I'm sitting at this restaurant. What should I order?* Pick the restaurant or scan its menu, and What's Good returns up to three dishes that fit your allergies, diet, budget and taste. Each pick comes with a one-line reason and a real review quote. Code checks every dish, quote and count against the stored menu and reviews before anything is shown.

- Pitch: [`readme-startupSelected.md`](readme-startupSelected.md)
- Alpha plan, validation design and story index: [`PLAN.md`](PLAN.md)
- Validation results: [`validation/REPORT.md`](validation/REPORT.md)
- Engineering metrics: [`docs/metrics.md`](docs/metrics.md)

## Layout

| Path | What it is |
|---|---|
| `api/` | Cloudflare Worker (Hono, D1, R2) with the menu import, review mining, recommendation, guardrails and feedback |
| `api/src/prompts/` | Every prompt sent to Claude, frozen for the benchmark |
| `api/src/validation/` | A1–A3 validation tooling: survey, benchmark runner, coverage, statistics, report |
| `web/` | Next.js PWA (static export for Cloudflare Pages) |
| `validation/` | Validation data: A1 survey, A2 benchmark set, A3 coverage, the generated report |

## How the AI is used, and checked

1. **Menu import (US-03, US-04).** Claude reads a menu page, PDF or photo and returns dishes as structured JSON.
2. **Review mining (US-07).** Claude finds each dish mention in reviews, with its sentiment and a quote.
3. **Top 3 (US-08).** Claude ranks dishes from this restaurant's menu, its review evidence and your profile.

Nothing the model writes is shown until code checks it:
- **US-09:** every dish is on the menu.
- **US-10:** allergies, diet and budget are respected, and the app never claims a dish is "safe".
- **US-11:** every quote is word for word from a review that mentions the dish, and every count matches the database.

Failures go back to the model with the errors listed, for up to 3 attempts (US-12). After that the app falls back to a plain ranking with no generated text.

## Run it locally

```bash
npm install
```

```bash
npm test
```

```bash
npm run e2e -w web
```

To run the full app locally you need an Anthropic API key, plus an Apify token for reviews. No Cloudflare account is needed: `wrangler dev` emulates D1 and R2.

```bash
cp api/.dev.vars.example api/.dev.vars
```

Put your keys in `api/.dev.vars`, then create the local database and start the API:

```bash
cd api && npx wrangler d1 migrations apply whats-good --local && npx wrangler dev
```

In another terminal, load the demo restaurants and start the web app:

```bash
node scripts/seed-demo.mjs http://localhost:8787
```

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev -w web
```

### Try it with your own Claude login (optional)

To try the app by yourself on your own machine without an API key, log in with `claude` and run the bridge in its own terminal:

```bash
npm run bridge -w api
```

Then add `LLM_BRIDGE_URL=http://127.0.0.1:8790` to `api/.dev.vars` and restart `wrangler dev`. Calls count against your own plan's limits. This is for one developer only: use an API key for anything deployed or shared with other people. The A2 and A3 commands use the bridge too when `LLM_BRIDGE_URL` is set, and their results and report say so. Reviews still need `APIFY_TOKEN`.

## Deploy (US-22)

```bash
cd api && npx wrangler d1 create whats-good
```

Put the printed `database_id` in `api/wrangler.toml`, then:

```bash
cd api && npx wrangler r2 bucket create whats-good-menus && npx wrangler d1 migrations apply whats-good --remote && npx wrangler secret put ANTHROPIC_API_KEY && npx wrangler secret put APIFY_TOKEN && npx wrangler deploy
```

Build the web app against the deployed API and publish it to Pages:

```bash
cd web && NEXT_PUBLIC_API_URL=https://whats-good-api.<your-account>.workers.dev npm run build && npx wrangler pages deploy out --project-name whats-good
```

Smoke test:

```bash
node scripts/smoke.mjs https://whats-good-api.<your-account>.workers.dev
```

## Validation runs (need keys and team data)

See `validation/a2-benchmark/README.md`. In short: hand-copy the 10 menus, tag the prompts, then run `npm run benchmark -w api`, `npm run coverage:a3 -w api`, label `to-label.csv`, and finally `npm run validation:report -w api`.

## Workflow

One branch and PR per issue. The first commit adds failing tests, and later commits make them pass. Each test is tagged `[ai]` or `[manual]`. CI runs everything on every push and uploads coverage.
