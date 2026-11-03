# A2 — Menu import benchmark (US-18, US-19)

`manifest.json` fixes 1 easy and 10 medium-to-hard restaurants, their tier, source type and review source. It was committed **before any import was run**, and CI (US-18 T4) checks that its commit is older than the first `results/` file.

## Team tasks before running the benchmark

1. **Copy each menu by hand (AC4).** For each restaurant in `manifest.json`, open its `menu_url` and copy every orderable dish into `truth/<id>.json`, using `truth/_template.json` as the format: name exactly as printed, section, and price (lowest if several sizes, `null` for market price). Don't use the app or any AI tool for this step, because the copy is the correct answer the AI is graded against.
2. **Spot-check (AC5).** A second team member checks a random 20% of each copied menu against the source and records it in `truth/spot-checks.csv` (`restaurant_id,checked_by,dishes_checked,errors_found,errors_fixed`).
3. **Freeze the prompts.** Run `git tag prompts-alpha-v1` on the commit you benchmark. The runner refuses to run if `api/src/prompts/` differs from that tag.
4. **Run it.** `ANTHROPIC_API_KEY=... npm run benchmark -w api` (US-19). This writes `results/<timestamp>.json`.

Tier rule: easy is a clean HTML menu with prices; medium is a text PDF or a long (60+ item) HTML menu; hard is an image-only menu or a JavaScript ordering page.
