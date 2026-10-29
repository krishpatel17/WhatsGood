# What's Good — project guide

What's Good answers one question: *I'm sitting at this restaurant, what should I order?* The diner picks a restaurant (or scans its menu). The app already knows their allergies, diet, budget and taste. It returns up to three dishes, each with a one-line reason and a real review quote. Code checks every pick against the stored menu and reviews before it is shown. The full pitch is in `readme-startupSelected.md`.

This file holds the Alpha plan (due **Thu Nov 5, 2026, 11:00am**). The user stories live as GitHub issues in this repo under the `Alpha` milestone. This file is the source of truth for scope and the validation plan.

## Stack

- API: Cloudflare Workers. Data: D1 (SQLite). Menu photos and snapshots: R2. Front end: Next.js PWA on Pages.
- LLM: Claude API with vision and JSON output, used for menu import, review dish extraction and the top-3 ranking.
- Reviews: Apify scrapers.
- Deploy: `wrangler deploy`. Keys stored as secrets, never committed.

## What the Alpha is graded on

From the Canvas assignment, "Project Alpha":

- **Activity 1, validation:** run the validation, collect metrics, and decide Validated / Invalidated / Pivot with evidence.
- **Activity 2, requirement decomposition:** user stories ("As a [role], I want [goal], so that [benefit]") with explicit acceptance criteria. Every story is a GitHub issue, and the issues cover all Alpha functionality.
- **Activity 3, AI-assisted TDD:** write the tests for an issue **before** its production code, show them failing, then make them pass.
- **Presentation (8 min):**
  - Hook and validation result (25%)
  - End-to-end demo showing the LLM's central role (40%)
  - Engineering metrics (20%)
  - Stage and next steps (5%)
  - Delivery (10%)
- **Deliverables:** slides (PDF), the Part 1 document (PDF) and the repo link.
  - The Part 1 document needs the names of people involved in validation, the metrics collected and decisions made, and the user stories with their acceptance criteria.

## Validation plan (Activity 1)

Per the professor: **the hypothesis and validation are about the MVP's assumptions, not the whole product.** The highest-risk item is whether we can get dish information from sources we can actually read. Whether picks rate ≥ 4/5 and whether people come back test the whole product, so they move to the **Beta hypothesis**. Say this on the slide, so it doesn't look like we dropped our own KPIs.

**Hypothesis:** for Charlottesville restaurants, the dish information the MVP needs can be read from real sources: (A1) a readable menu source exists, (A2) our LLM import extracts the dishes from it correctly, and (A3) the reviews we can read mention specific dishes often enough to back picks with real quotes.

| # | MVP assumption | Test | Pass threshold | Issue |
|---|---|---|---|---|
| A1 | **Sources exist.** Most target restaurants publish their menu somewhere we can read (own site, PDF, ordering page), not only Instagram stories or an in-store photo. | Survey 30 restaurants on the Corner, Downtown Mall and Barracks Road. Record each one's menu source type and whether it is readable. | ≥ 24 of 30 (80%) | US-23 |
| A2 | **We can extract dishes from those sources.** The LLM import gets dish names and prices right with no manual fixes. | 1 easy demo, then 10 medium-to-hard menus scored against hand-copied menus. | ≥ 8 of 10 import easily, and dish-accuracy 95% lower bound ≥ 90% | US-18, US-19, US-20 |
| A3 | **Reviews mention dishes.** The reviews we can read talk about specific dishes often enough for an evidence-backed top 3. | For the same 10 restaurants, pull reviews and run dish-mention extraction (US-07). Count menu dishes with ≥ 3 matched mentions. | ≥ 8 of 10 restaurants have at least 3 dishes with ≥ 3 mentions each | US-24 |

**Verdict:** all three pass means **Validated**. If any one fails, the pivot follows which one failed:
- A1 fails: make photo scanning (US-04) the main way menus get in.
- A2 fails: narrow import to the source types that passed and move the rest to the Beta.
- A3 fails: rank from the menu plus our own post-meal ratings, and lean on the "few reviews" labels (US-13).

### A1 — source availability survey (US-23)

- The 30 restaurants are listed before anyone looks at their menus: every sit-down restaurant in the three areas, up to 30, in map order.
- Each gets a source type: `html`, `pdf`, `ordering-page`, `image-on-site`, `third-party-only` (e.g. Yelp photos), `social-only`, or `none`.
- **Readable** means `html`, `pdf`, `ordering-page` or `image-on-site`.
- Report the readable count and its exact Clopper-Pearson 95% interval. For example, 24/30 gives [61.4%, 92.3%].
- The 10 benchmark restaurants for A2 are drawn from the readable, medium-to-hard ones.

### A2 — menu import benchmark (US-18 to US-20)

1. **Easy demo.** One restaurant with a clean HTML menu goes through the import live, with the structured dishes shown on screen.
2. **Benchmark set.** 10 restaurants whose online menus are medium-to-hard to read:
   - PDF menus
   - image-only menus
   - JavaScript ordering pages (Toast, Square, ChowNow)
   - long menus with many sections or specials

   Each restaurant's tier, source type and review source is written down **before** anything is imported.
3. **Correct answers.** A team member copies each menu by hand into the schema. A second person spot-checks 20% of the dishes.
4. **"Imported easily" (pass/fail per restaurant)** means, with no manual fixes:
   - at least 95% of dish names and prices correct
   - 0 invented dishes
   - finished in under 2 minutes
5. **Threshold:** at least **8 of 10** restaurants pass.
6. **Supporting statistics** (reported, not used as the pass rule):
   - Restaurant level: exact Clopper-Pearson 95% interval for the pass count. 8/10 gives [44.4%, 97.5%] and 9/10 gives [55.5%, 99.7%]. With n = 10 the normal approximation (CLT) does not hold (np ≥ 10 and n(1−p) ≥ 10 both fail), so exact methods are used. For context, the exact one-sided binomial test against p₀ = 0.6 gives p = 0.167 for 8/10 and p = 0.046 for 9/10.
   - Dish level: 10 menus give hundreds of dishes. Dishes on the same menu fail together, so use a **cluster bootstrap**: resample restaurants with replacement 10,000 times and take the 95% percentile interval of pooled dish accuracy. Target: lower bound at least 90%.
   - Break results down by tier and source type.
7. **Protections against bias:**
   - Tiers are written down before the run.
   - Prompts are frozen at a tagged commit before the benchmark. No tuning on the 10 test restaurants.
   - The person who copied a menu does not do the only check of it.

Photo scanning (US-04) is a product feature but is **out of** the benchmark, because the professor asked us to fetch menus online.

### A3 — review dish coverage (US-24)

- Use the same 10 restaurants as A2, with their reviews pulled through US-06.
- Run US-07 extraction with prompts frozen at the same tag as A2. A mention counts only if it matches a menu dish at ≥ 0.9.
- To check the extraction itself, a team member reads 50 random reviews by hand and marks the dish mentions. Report the extraction's precision and recall against that hand check.
- Per restaurant, report: number of reviews, dishes with ≥ 1 / ≥ 3 / ≥ 10 mentions, and whether it has at least 3 dishes with ≥ 3 mentions ("enough for a full top 3").
- Report the count of 10 that are enough, with its Clopper-Pearson interval.

## User stories (GitHub issues, milestone `Alpha`)

| ID | Story | Labels |
|---|---|---|
| US-01 | Set up my profile once | area:profile |
| US-02 | Pick the restaurant I'm at | area:recommend |
| US-03 | Import a menu from a restaurant's website | area:menu-import, llm |
| US-04 | Scan a menu photo | area:menu-import, llm |
| US-05 | Validate imported menus | area:menu-import |
| US-06 | Collect a restaurant's reviews | area:reviews |
| US-07 | Extract dish mentions and sentiment from reviews | area:reviews, llm |
| US-08 | Get my top 3 dishes | area:recommend, llm |
| US-09 | Guardrail: every dish is on the menu | area:guardrail |
| US-10 | Guardrail: restrictions and budget | area:guardrail |
| US-11 | Guardrail: quotes and counts are real | area:guardrail |
| US-12 | Self-correction loop and fallback ranking | area:guardrail, llm |
| US-13 | Label picks when reviews are thin | area:recommend |
| US-14 | Results screen | area:recommend |
| US-15 | Rate my meal | area:feedback |
| US-16 | Prompt to rate my last meal | area:feedback |
| US-17 | Log usage events | area:validation |
| US-18 | Benchmark restaurant set and correct menus | area:validation, area:menu-import |
| US-19 | Benchmark runner | area:validation, area:menu-import |
| US-20 | Validation scoring and report (A1–A3 verdict) | area:validation |
| US-21 | Audit picks for invented dishes and quotes | area:validation |
| US-22 | Deploy on Cloudflare with CI | area:infra |
| US-23 | Menu source availability survey (A1) | area:validation, area:menu-import |
| US-24 | Review dish-coverage measurement (A3) | area:validation, area:reviews |

The acceptance criteria and the planned tests are in each issue. If scope changes, update the issue **and** this table.

## Workflow rules (TDD and metrics)

- One branch and one PR per issue. Name branches `us-NN-short-name` and reference the issue in the PR (`Closes #N`).
- **Tests first:** the first commit on a branch adds the tests and shows them failing. Production code comes in later commits. Don't squash those two apart from each other, because the history is our TDD evidence.
- **Tag every test's source** in its name or a comment: `[ai]` if AI-generated and kept as-is, `[manual]` if written or substantially changed by a person. This gives the AI-vs-manual ratio on the slides.
- CI runs the full suite on every PR and reports line coverage.
- Metrics to collect for the slides: number of user stories, issues logged vs. closed (from the milestone), total tests, tests per issue, pass rate %, line coverage %, and the AI:manual test ratio.

## Guardrail principles (never break these)

- Never show a dish that isn't on the stored menu for this restaurant.
- Never show a quote that isn't word for word in a stored review, or a count that doesn't match the database.
- Restrictions only remove dishes. Unknown ingredients plus a restriction means "ask your server". Never call a dish "safe" or allergen-free.
- Model output goes through the validator, with up to 3 attempts and the errors fed back. After that, fall back to the plain sentiment ranking with no generated text.
