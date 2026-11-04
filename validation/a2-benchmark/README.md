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
