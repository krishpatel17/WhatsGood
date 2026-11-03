# What's Good
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users and core job
A diner sitting at a restaurant asks: “What should I order?” This Next.js PWA helps them make a quick, informed decision with one hand at the table.

## Workflow and capabilities
Pick a restaurant from the seeded/saved list OR scan/import its menu from a web page, PDF link, or photo (US-03, US-04). Set or adjust allergies, diet, budget and taste. Receive up to three verified dish recommendations (US-08), backed by mined review evidence (US-07). Preserve the existing meal-rating and pending-rating flows.

## Code-enforced guardrails
- US-09: Every recommendation exists on the stored restaurant menu and displays its stored menu price. Unknown prices remain explicitly unknown; never invent prices.
- US-10: Respect all active allergy, diet and budget filters. Never claim a dish is “safe”, “100% safe”, or “allergy-safe”; never render medical shields or safety icons. Use neutral profile metadata, separated by middots. Do not infer ingredient certainty from an active filter: preserve “Ask your server about ingredients” where returned. Taste preferences are not independently verified dish attributes.
- US-11: Display the exact database review mention count and word-for-word supplied review quote mentioning the dish. Never rewrite a review quote or fabricate evidence.
- US-12: After three failed code-verification attempts the API returns plain ranking without generated reason/quote. Render an intentional compact “Verified Menu Ranking” variant with no empty quotation marks, quote wells or excess whitespace. Distinguish provisional ranking while generation runs from final fallback.
- Thin-review and menu-only labels, unknown-price notices, and ingredient questions must remain visible.

## Repository and compatibility constraints
Changes are limited to web/ and root PRODUCT.md and DESIGN.md. api/, api/src/prompts/, api/src/validation/ and validation/ are frozen. Preserve route paths, API request/response shapes, data-testid attributes and tested semantic selectors. Required verification: npm test; npm run build -w web; npm run e2e -w web.

## Evidence and implementation boundaries
PLAN.md defines the Alpha stories. Existing API routes support restaurant listing/search, profile creation/update, URL import (including hosted PDFs), photo scan, recommendations, fallback ranking and ratings. No full-menu read endpoint or local PDF upload endpoint is exposed; do not invent either or represent unsupported inputs as working. The UI uses the actual returned records; no invented restaurants, images, review totals or dish fit claims.

## Brand commitment
Apply the supplied DoorDash Prism adaptation recorded in DESIGN.md. Favor clarity, speed, neutral fit metadata and traceable evidence over decorative expression.

## Accessibility
Keyboard-operable controls, visible focus, labelled inputs, status announcements, accessible dialogs with focus restoration, reduced-motion support, AA text contrast, and layouts at 390px and 1280px (also preserve the existing 375px test).
