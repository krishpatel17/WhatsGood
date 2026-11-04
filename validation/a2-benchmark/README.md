# A2 — Menu import benchmark (US-18, US-19)

`manifest.json` fixes 1 easy and 10 medium-to-hard restaurants, their tier, source type and review source. It was committed **before any import was run**, and CI (US-18 T4) checks that its commit is older than the first `results/` file.

Tier rule: easy is a clean HTML menu with prices; medium is a text PDF or a long (60+ item) HTML menu; hard is an image-only menu or a JavaScript ordering page.

## Step 1 — Copy the menus by hand (AC4)

`assignments.csv` says who copies each menu and who checks it. Change names there if you split the work differently, but never let someone check a menu they copied.

For each restaurant assigned to you:

1. Open its `menu_url` from `assignments.csv`.
2. Open `truth/sheets/<restaurant_id>.csv` in Excel, Numbers or Google Sheets. It has three columns: `section,name,price`.
3. Add one row per orderable dish, in menu order:
   - **section**: the menu heading it sits under, e.g. "Starters". Leave it blank if there is none.
   - **name**: exactly as printed, with the same spelling and capitalization.
   - **price**: as printed, e.g. `12`, `$12.50` or `MP`. If there are several sizes, enter the lowest. Leave it blank if no price is shown.
   - Skip drinks without prices, sauces and add-ons, and anything that isn't a dish.
4. Save it as **CSV**, keeping the same file name.
5. In `assignments.csv`, put the date in `copied_on`.

**Don't use the app, Claude or any other AI tool for this step.** The copy is the answer key the AI is graded against.

Tips by source type:
- **PDF:** copy from the PDF itself, not a cached web version.
- **Image (Marco and Luca):** zoom into the menu image on their site.
- **Ordering page (Toast, ChowNow, Square, Clover):** pick the location, then open every category tab. Prices are on the item cards.
- **Long menus (Afghan Kabob House, The Whiskey Jar):** about an hour each. Do these first.

## Step 2 — Turn the sheets into answer keys

```bash
npm run truth -w api
```

This checks every sheet. It lists rows to fix by spreadsheet row number, and shows which menus aren't started. For each finished menu it writes `truth/<id>.json` (the answer key) and `truth/spot-check/<id>.csv`, a random 20% of its dishes for the checker. Run it again after any fix.

## Step 3 — Spot-check (AC5)

**Deviation from the plan:** AC5 called for a second team member. For the Alpha, Lara Mahajan copied all 11 menus and also did the spot-checks, so they are self-checks, which are weaker than an independent check. `npm run truth` flags this, and the validation report states it.

The checker opens `truth/spot-check/<id>.csv` beside the menu source:
- Put `yes` or `no` in `correct` for each row.
- For a `no`, write the right value in `fix`, then correct the row in `truth/sheets/<id>.csv`.

When a menu is done, add a line to `truth/spot-checks.csv` (`restaurant_id,checked_by,dishes_checked,errors_found,errors_fixed`), then run `npm run truth -w api` once more.

## Step 4 — Run the benchmark (US-19)

1. Freeze the prompts: `git tag prompts-alpha-v1` on the commit you benchmark. The runner refuses to run if `api/src/prompts/` differs from that tag.
2. Put `ANTHROPIC_API_KEY` in `api/.dev.vars` and run `npm run benchmark -w api`. This writes `results/<timestamp>.json`. To use a Claude login instead, set `LLM_BRIDGE_URL` there and keep `npm run bridge -w api` running; the report states this as a deviation.
3. Run `npm run validation:report -w api` to score the import against your copies and update `validation/REPORT.md`.

## Correction: answer keys after the v1 run

The v1 import of The Virginian, Afghan Kabob House and The Whiskey Jar returned 32 items that were not in the hand-copied keys. The copying rule only skipped drinks *without* prices, so Lara Mahajan checked each item against the source. She checked The Virginian against `snapshots/co04.pdf`, the exact PDF the benchmark read, and typed every price herself rather than taking it from the model's output. She added 30 priced drinks and wines (23 at The Virginian, 7 at Afghan Kabob House). At The Whiskey Jar she added French Fries and Grits with a blank price: they are listed under Vegetarian Sides with no price printed, and the copying rule keeps orderable dishes with a blank price. `truth/corrections.csv` logs this.

Because this correction came after seeing the v1 output, the report states both scores. Against the original keys v1 scored 0/10; against the corrected keys it scores 3/10. Either way A2 fails.

## Deviation: the demo restaurants

`manifest.json` names Miller's Downtown (`do12`) as the easy demo restaurant. Its menu loads with JavaScript, and it imported 0 dishes in the benchmark. The manifest stays as it was committed before any run. For the live demo, `validation/demo-restaurants.json` uses The Alley Light (`do05`) instead, plus four menus that are text or PDF: Afghan Kabob House, The Whiskey Jar, The Virginian and The Bebedero. The Alley Light and The Bebedero are not among the 10 scored restaurants. Bodo's Bagels was dropped because its link pointed only at a cream-cheese sub-page.

## A2 v2: importer fixes (2026-11-04)

After v1, the importer got three general fixes, all with prompts unchanged at `prompts-alpha-v1`:
- JavaScript ordering pages are rendered in a local browser before import.
- Long PDFs are read page by page. Sedona's malformed PDF is sent whole once per page with "list only the dishes printed on page i of n".
- Image-only pages send their largest images to the vision model.

`npm run benchmark -w api -- --render` ran all 11 menus. **Result: 2/10 imported easily (FAIL).**

- **Every menu except Crozet Pizza imported** (Toast still blocks the browser, HTTP 403). In v1 only 3 did.
- Afghan Kabob House and The Whiskey Jar pass.
- Sedona (100% of its key), Boylan Heights (100%) and Otto (97.7%) fail only because the model also listed items that aren't in the hand-copied key: 69, 9 and 42 items, which look like a second PDF page and drinks.
- The Virginian falls to 88.7%. Reading page by page found bar specials not in the key, and listed the wines with their winery ("VIOGNIER - Eastwood Farm and Winery"), which the name matcher does not equate with "VIOGNIER".
- El Puerto: 77.0%, with many naming differences across 200 dishes.
- Revolutionary Soup: 51.4%; only part of the rendered page was read.
- Marco and Luca: 0%. The image the benchmark reads has no prices, but its key was copied with prices from another source.

Nobody has checked these extra items against the sources yet. The pass rule and thresholds were not changed.

## Correction: answer keys after the v2 run (2026-11-04)

This correction was made **after** the v2 results were seen, so it is post-hoc. The v2 results file was re-scored. The importer was not run again and no model was called.

Lara Mahajan checked the 138 items the v2 run listed beyond the keys for The Virginian, Sedona, Boylan Heights and Otto. She checked each item against the restaurant's own menu (`truth/extras-v2-to-check.xlsx`):
- 116 were on the menu and were added with the menu's price and section:
  - Sedona: 60
  - Otto: 29
  - The Virginian: 11 bar specials
  - Boylan Heights: 9
- The Virginian's 7 wine names were changed to the full printed name, which includes the winery.
- 22 were not on the menu and stay counted as invented (Sedona 9, Otto 13).
- Marco and Luca's key was re-copied from the menu image the restaurant's site shows. That image prints no prices, so its prices are blank.

Every change is logged in `truth/corrections.csv`. The pass rule and thresholds were not changed.

**Re-scored result: 3/10 imported easily (still FAIL).**
- The Virginian, Afghan Kabob House and The Whiskey Jar pass.
- Marco and Luca and Boylan Heights are 100% accurate. Each fails on one item, "Extra sauce", an add-on that the copying rule leaves out of the key.
- Sedona (9) and Otto (13 + 1 missed) fail on items Lara confirmed are not on the menu.
- El Puerto (77.0%), Revolutionary Soup (51.4%) and Crozet Pizza (blocked) are unchanged.

Score history:

| Run | Score |
|---|---|
| v1 | 0/10 |
| v1 after the first key correction | 3/10 |
| v2 | 2/10 |
| v2 after this correction | 3/10 |

## A2 v3: add-ons left out (2026-11-04)

After the corrected v2 score, the only error left on Marco and Luca and Boylan Heights was "Extra sauce". The copying rules leave add-ons out of the answer keys, and the converter has done that with one rule since US-18. The importer never applied that rule.

v3 moves the rule to `api/src/menu/add-ons.ts` and uses it in both places. The rule itself is unchanged: we did not widen it to catch Sedona's toppings, because that would also remove real dishes from the keys. Prompts are unchanged at `prompts-alpha-v1`.

This fix was chosen after seeing the v2 results. It is a general importer change, but it is still post-hoc.

`npm run benchmark -w api -- --render` re-ran all 11 menus with fresh model calls. The answer keys are the same as for the corrected v2 score. **Result: 5/10 imported easily (still FAIL).**

- **Pass:** The Virginian, Afghan Kabob House, The Whiskey Jar, Marco and Luca, Boylan Heights.
- **Sedona (96.9%):** still lists its 8 sauce and butter toppings and "Seasonal Catch". This run also merged four wines into one line.
- **Otto (98.6%):** still lists 13 drinks Lara confirmed are not on its menu.
- **Unchanged:** El Puerto (77.0%), Revolutionary Soup (51.4%) and Crozet Pizza (Toast blocks it, HTTP 403).

Score history:

| Run | Score |
|---|---|
| v1 | 0/10 |
| v1 after the first key correction | 3/10 |
| v2 | 2/10 |
| v2 after the second key correction | 3/10 |
| v3 | 5/10 |

The pass rule and thresholds were never changed.

## A2 v4: full ordering pages, unpriced ordering items left out (2026-11-04)

v4 adds two general importer fixes. Both were chosen after seeing v3, so they are post-hoc. Prompts are unchanged.

1. **Scrolling.** The renderer scrolls one screen at a time until the page stops growing. Before, it made 8 big jumps that skipped lazy sections; Revolutionary Soup's salads, burgers, bowls, quesadillas, combos and drinks never loaded. See `api/src/menu/scroll.ts`.
2. **Unpriced items on ordering sites.** On an ordering site every orderable item shows a price, so an item with no price is sold out or unavailable and is left out. All 13 of Otto's "invented" items were marked Sold Out with no price. Clover, Otto's ordering site, was added to the list of ordering sites; the A1 survey already classed Otto as an ordering page. No ordering-page answer key has an unpriced item.

`npm run benchmark -w api -- --render` re-ran all 11 menus with fresh model calls, against the same keys as v3. **Result: 5/10 imported easily (still FAIL).**

- **Pass:** Afghan Kabob House, The Whiskey Jar, Marco and Luca, Boylan Heights, Otto (98.6%, 0 invented).
- **Revolutionary Soup:** went from 51.4% to 100% of its key. It fails on 7 items the old page never showed and the key does not have: six priced drinks and "Dressing and sauces 2oz". Nobody has checked these against the menu.
- **The Virginian** passed in v3 and fails in v4 (89.0%):
  - This run named the wines without their winery ("VIOGNIER"). v2 named them with it, and the key now does too, so the name matcher misses them.
  - This run also split "Juices" into four flavours.
  - This is run-to-run variation in the model's output, not a change in the importer.
- **Sedona** (100% of its key, 9 toppings), **El Puerto** (92.5%, up from 77.0%) and **Crozet Pizza** (blocked) still fail.

Score history:

| Run | Score |
|---|---|
| v1 | 0/10 |
| v1 after the first key correction | 3/10 |
| v2 | 2/10 |
| v2 after the second key correction | 3/10 |
| v3 | 5/10 |
| v4 | 5/10 |

Seven different menus have passed in at least one of v3 and v4, but never more than five in one run. The pass rule and thresholds were never changed.

## Exploratory: food dishes only (2026-11-04, after v4)

This is **not** the pre-registered test. It does not change the A2 result (5/10, FAIL) or the verdict.

The MVP ranks food dishes, and most of v3's and v4's errors were drinks, sauces and toppings. So the report now also scores the v4 results with those left out of both the answer key and the import. The rule (`api/src/validation/food-only.ts`) was written down before the score was computed:
- An item is left out if its section contains a generic drink, sauce or topping word: wine, whites, reds, rosé, sparkling, beer, draft, drink, beverage, cocktail, spirit, liquor, bar, happy hour, juice, soda, soft drink, coffee, tea, topping, sauce, dressing, condiment, add-on or extra.
- An item is also left out if its own name contains wine, beer, juice, soda, beverage, sauce, dressing or topping.
- No restaurant-specific words were added.

The rule was chosen after seeing the results. No model was called again.

**Exploratory result: 6/10.** The Virginian passes in this view.
- Revolutionary Soup still lists two drinks whose names have no generic drink word ("Dasani", "Maine Root").
- Sedona lists "Seasonal Catch", which is not in its key.
- El Puerto and Crozet Pizza are unchanged.

A narrower "food dishes only" hypothesis is a candidate for the Beta. It would need to be pre-registered and tested on new restaurants before it counts.
