# A3 — Review dish coverage (US-24)

**Result: PASS, 9 of 10 restaurants** have at least 3 dishes that are each mentioned in 3 or more reviews (threshold ≥ 8/10; exact 95% CI 0.555–0.997). Crozet Pizza is the one that falls short. Full table: `validation/REPORT.md`.

## How it was run

- `npm run coverage:a3 -w api` on 2026-11-04, with prompts frozen at tag `prompts-alpha-v1` (fdcbe23), the same tag as A2.
- Reviews: Google Maps reviews via Apify (`compass~google-maps-reviews-scraper`), up to 300 per restaurant, 2,211 in total. Raw reviews are in `reviews/<id>.json`.
- Dish matching ran against the hand-copied answer-key menus (`validation/a2-benchmark/truth/`).
- **Deviation:** the model calls went through a developer's Claude login with the local bridge (`api/scripts/subscription-bridge.ts`), not the API.

## Hand check of the extraction (AC3)

- `to-label.csv` is a seeded random sample of 50 reviews. Shaunak Sinha labelled the dishes each one mentions, by hand and without seeing the model's output. His labels are in `labels.csv`.
- Against those labels the model's extraction had **precision 78.9%** and **recall 71.4%**.
- Hand work for the Alpha: Krish Patel copied the A2 menus, Shaunak Sinha spot-checked them and labelled these reviews, and Lara Mahajan checked the answer-key corrections. The team worked on one laptop, so the commits show a single account.
