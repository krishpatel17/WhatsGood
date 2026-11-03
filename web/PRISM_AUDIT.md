# Prism implementation audit

Date: 2026-11-03. Scope: web/; product and design records at the repository root.

## Verification

- `npm test`: 148 tests passed (138 API, 10 web). API tests were run without changing API source.
- `npm run build -w web`: production static export and TypeScript passed. The E2E runner also rebuilt the final functional changes successfully.
- `npm run e2e -w web`: 10 tests passed in Microsoft Edge. Includes every original test, 375px overflow, 390px/1280px flows, Escape/focus restoration, focused budget visibility above the sticky footer, profile save/refetch, hosted PDF URL import, existing restaurant ID reuse, and final fallback completion.
- Impeccable detector: no findings. Raw output is in ignored `test-results/prism-detector.json`.
- `git diff --check`: passed.
- Edge extension manual check: profile dialog opens; Escape closes it and restores focus to its trigger. Temporary tab closed afterward.

## Visual review

Screenshots in ignored `test-results/` use the existing synthetic E2E restaurant/dish fixtures. They cover restaurant search, recommendation cards, profile and scanner dialogs at 390px and 1280px, plus final fallback at 390px. Real restaurant records replace the fixtures when connected to the deployed API.

The first inspection found search-icon overlap, a focused mobile budget field obscured by the sticky footer, and scanner recovery losing the existing restaurant ID. One correction batch fixed all three; a second screenshot round and regression tests confirmed the corrections. The independent Impeccable reviewer returned **ship**, specifically scoring all three findings resolved. No claim of full production integration testing is made.

## Guardrail preservation

- Existing routes and request/response contracts retained; existing tests and required selectors preserved.
- Exact supplied review quotes and counts are rendered without rewriting. Zero counts remain visible. Existing warning flags and thin-review labels remain intact.
- Final fallback suppresses reason/quote even if an unexpected response contains them; it is no longer announced as still generating.
- Profile changes rerun recommendations; active filters are presented in the shared pill bar.
- Budget-fit copy is derived from the returned menu price and profile budget. No ingredient certainty, allergy-free claims or medical shields are added.
- Core semantic colors, typography, white canvas, pill controls, bordered dish cards and neutral quote wells are centralized in CSS tokens.

## Intentional limits

- Hosted PDF and webpage links use the existing URL import endpoint; photo files use the existing scan endpoint. Local PDF-file upload has no existing API endpoint and was not fabricated.
- The API exposes no full-menu read endpoint; no invented full-menu grid is rendered.
- No per-dish allergy/diet/taste match attributes are supplied. Only observable budget fit appears on cards; filter summaries and server ingredient notices retain the remaining context.
- E2E uses mocked API responses. Live LLM generation, camera hardware, HEIC support and external menu fetches were not integration-tested. Loading/error/empty/photo states were inspected in source; the saved visual set does not cover every such state.
- Microsoft Edge must be installed to run the configured local E2E suite.
