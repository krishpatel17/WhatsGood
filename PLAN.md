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

Per the professor, the Alpha validates **menu import**. Week-2 return and rating KPIs from the MVP pitch are **not** part of Alpha validation. Say this on the slide, so it doesn't look like we dropped our own KPIs.

**Hypothesis:** our LLM import turns real, messy restaurant menus fetched online into accurate structured dish data with no manual fixes.

1. **Easy demo.** One restaurant with a clean HTML menu goes through the import live, with the structured dishes shown on screen.
2. **Benchmark set.** 10 Charlottesville restaurants whose online menus are medium-to-hard to read:
   - PDF menus
   - image-only menus
   - JavaScript ordering pages (Toast, Square, ChowNow)
   - long menus with many sections or specials

   Each restaurant's tier and source type is written down **before** anything is imported.
3. **Correct answers.** A team member copies each menu by hand into the schema. A second person spot-checks 20% of the dishes.
4. **"Imported easily" (pass/fail per restaurant)** means, with no manual fixes:
   - at least 95% of dish names and prices correct
   - 0 invented dishes
   - finished in under 2 minutes
5. **Threshold:** at least **8 of 10** restaurants pass means **Validated**.
6. **Supporting statistics** (reported, not used as the pass rule):
   - Restaurant level: exact Clopper-Pearson 95% interval for the pass count. 8/10 gives [44.4%, 97.5%] and 9/10 gives [55.5%, 99.7%]. With n = 10 the normal approximation (CLT) does not hold (np ≥ 10 and n(1−p) ≥ 10 both fail), so exact methods are used. For context, the exact one-sided binomial test against p₀ = 0.6 gives p = 0.167 for 8/10 and p = 0.046 for 9/10.
   - Dish level: 10 menus give hundreds of dishes. Dishes on the same menu fail together, so use a **cluster bootstrap**: resample restaurants with replacement 10,000 times and take the 95% percentile interval of pooled dish accuracy. Target: lower bound at least 90%.
   - Break results down by tier and source type.
7. **Protections against bias:**
   - Tiers are written down before the run.
   - Prompts are frozen at a tagged commit before the benchmark. No tuning on the 10 test restaurants.
   - The person who copied a menu does not do the only check of it.
8. **If it fails:** the pivot follows whichever source type failed. For example, ship website and HTML import only, and move PDF and photo menus to the Beta.

Photo scanning (US-04) is a product feature but is **out of** the benchmark, because the professor asked us to fetch menus online.

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
| US-20 | Benchmark scoring and statistics report | area:validation |
| US-21 | Audit picks for invented dishes and quotes | area:validation |
| US-22 | Deploy on Cloudflare with CI | area:infra |

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
