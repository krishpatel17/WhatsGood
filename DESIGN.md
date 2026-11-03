# What's Good — DoorDash Prism adaptation

## Direction and surface
The web/ diner flow operates in Impeccable Operate mode. The task is choosing dinner at the table. Scanability, consistent controls and native expectations outrank expression. A white canvas, dark typography, red conversion pills and teal evidence signals carry the identity. At least 90% of the viewport stays neutral. The user-supplied reference is locked; do not introduce an alternate visual world.

## Semantic tokens
| Token | Value | Role and constraint |
| --- | --- | --- |
| color-bg-primary | #FFFFFF | Main viewport, restaurant/dish cards and modal surfaces; never tint the primary canvas |
| color-bg-elevated | #F7F7F7 | Chips, search fields, review wells and segmented tracks; use surface tint instead of shadow |
| color-text-primary | #191919 | Headings, dish names, prices, labels, selected chips and icons; never pure black |
| color-text-secondary | #606060 | Metadata, quotes and descriptions; AA on both surfaces |
| color-text-muted | #767676 | Disabled controls and tertiary text; never prices or required labels; placeholders on elevated surfaces use secondary ink to retain AA |
| color-border-hairline | #E7E7E7 | 1px card borders, section and modal dividers; never heavy card outlines |
| color-brand-primary | #EB1700 | Primary clickable actions and #1/#2/#3 Pick badges only; no decorative fills, navigation or inactive tabs |
| color-brand-hover | #D91400 | Primary action pointer hover only |
| color-brand-active | #B71000 | Primary action pressed state, scale(.99) |
| color-accent-verified | #00838A | Code-checked menu/review evidence only |
| color-status-warning | #FFF0ED | Required/unmet status fill; pair with bold primary ink |

## Typography
Font stack: "DD Norms", "TT Norms Pro", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif. Do not claim proprietary fonts are bundled. Prices, budgets and mention counts use tabular-nums.

| Role | Size / line height | Weight / tracking |
| --- | --- | --- |
| Search display | 56px / 1.04 desktop; 40px / 44px mobile | 900 / -.035em |
| Restaurant page title | 40px / 44px desktop; 28px / 34px mobile | 900 / -.02em |
| Section H2 | 24px / 28px | 700 / -.01em |
| Modal/dish H3 | 20px / 24px | 700 / -.01em |
| Card title / price | 16px / 22px | 700 / 0 |
| Body / CTA | 16px / 22px | 500 / 0 |
| Metadata / quote | 14px / 20px | 400 / 0 |
| Badge / microcopy | 12px / 16px | 700 / .01em |

## Layout, geometry and elevation
Use an 8px base grid and 4px inline sub-grid: 4, 8, 12, 16, 24, 32, 48px. A 64px sticky top bar (z-index 40) houses the WHAT'S GOOD wordmark, source segmented control, active restaurant and profile summary. On phones the source controls move to a secondary sticky row to preserve readable controls. Main canvas: max-width 1024px centered, 16px mobile and 24px desktop horizontal padding. Recommendation pages use an 808px outer width for comfortable reading. The preference strip scrolls with the document; only the navigation stays sticky.

All buttons, chips, segmented controls, search inputs, budget inputs/steppers and badges use 9999px full-pill corners. Cards, upload zones and quote wells use 12px. Dialogs use 16px, max-width 560px, max-height 90vh, sticky header and action footer.

Restaurant rows have no shadow, with hairline separators between entries. A compact neutral initial identifies the restaurant without implying food photography. Dish cards and menu items have 1px #E7E7E7 borders, #CCCCCC on hover, no shadow. Shadows are reserved for sticky floating bars (0 2px 8px rgba(25,25,25,.08)) and dialogs (0 16px 40px rgba(25,25,25,.18)). Dialog scrim: rgba(25,25,25,.5).

## Screen anatomy
1. Source segmented control: Pick Restaurant / Scan Menu. Selected state is #191919 on #F7F7F7 track with white text.
2. Profile filter bar: horizontally scrollable Allergies, Diet, Max Budget and Taste pills; inactive elevated fill, active primary-ink fill/white text. Open Profile Configurator for immediate editing.
3. Profile/scanner dialogs: grouped fields with hairline dividers, Required / Optional / Active status pills, scrollable middle and sticky red action footer. Profile CTA reflects budget. Retain standalone /setup/ and /scan/ routes.
4. Verified dish card: left rank pill + teal “✦ Mentioned in X reviews”, right tabular price; 20px bold dish title; a single scannable middot metadata line when supported by returned data; one-line reason; 12px elevated well containing the exact review quote and teal verified-review footer. Preserve ingredient/price/thin-review warnings. Legacy tested mention-count wording remains accessible.
5. Plain ranking: omit generated reason and quote entirely; compact hairline footer “Ranked by menu match & review sentiment • ✦ Verified on menu”. Final heading “Verified Menu Ranking”. Never keep a final fallback in a loading state.

## Atomic state matrix
| Component | Default | Hover | Selected / pressed | Disabled | Loading |
| --- | --- | --- | --- | --- | --- |
| Primary pill | Red/white, full pill | #D91400 | #B71000, scale(.99) | Elevated/muted, not-allowed | Red with 18px white spinner |
| Filter chip | Elevated, primary ink | Hairline fill | Primary ink/white | Elevated, 40% opacity | 88×36px neutral pulse |
| Restaurant | White, 12px header and metadata | Elevated surface | Open restaurant recommendations | Muted and No menu loaded; opens scanner for that existing restaurant | Neutral block + 70%/45% bars |
| Dish card | White, 1px hairline, 12px | #CCCCCC border | Existing navigation behavior; no fake selection | 50% and Filtered out by profile if exposed | Outline, three lines and neutral quote well |
| Group status | Required: warning; Optional: elevated | Unchanged | ✓ Active: elevated/primary ink | Hidden if inactive | 64×20px neutral pill |

Keyboard focus uses a visible primary-ink outline. Motion conveys state only, 150–200ms; neutral pulse skeletons honor reduced motion. Text alignment is left throughout cards with prices right aligned.

## Reference lock and anti-pattern ledger
- Preserve full-pill controls, bordered 12px dish cards, nested #F7F7F7 quote wells, inline middot fit metadata, surface tint over elevation, and compact first-class fallback.
- No cart counters, delivery fee calculators, address pins or checkout drawers.
- No card glassmorphism, backdrop blur or translucent borders.
- No purple, indigo or multi-stop gradients on buttons, headers or badges.
- No centered text in restaurant/dish cards.
- No “safe”, “allergy-safe” or other medical certainty claims, or shield icons in rendered UI. Never fabricate allergy-free or diet-fit metadata from unavailable ingredient data.
- No fabricated food photography, counts, menus, endorsements or matching attributes.

## Verification
Audit against this document at 390px and 1280px, including dialogs, loading/error/empty states and final fallback. Preserve all original tests and selectors. Test new modal interactions, imports, profile refresh and fallback completion where behavior changes.

## Documented adaptation
A restaurant without a menu is labelled “No menu loaded” and opens the scanner with its existing identity. This provides an actionable recovery while preventing a duplicate restaurant. Dish fit metadata currently exposes only observable budget matches; API-returned ingredient warnings take precedence over any assumption about allergy/diet certainty.

### Implementation snapshot — 2026-11-03

These observations record the delivered web implementation; they do not replace or relax the reference above.

- `web/app/globals.css` implements the semantic color and radius tokens. The font stack is a fallback stack, not a bundled proprietary font. Restaurant identifiers are neutral initials taken from returned names rather than invented food photography.
- Restaurant lists use two columns above 760px and one below, with compact initial, name, address, evidence and a trailing chevron. No large placeholder artwork. At the 760px breakpoint the sticky header becomes 120px tall, placing the source selector on its second row; the filter bar remains in document flow. Dish padding changes from 24px to 16px on phones.
- Profile and scanner dialogs share their form components with the standalone routes. Native modal dialogs restore focus on close; scroll padding keeps focused fields clear of the sticky header and footer. Photo controls expose keyboard focus through their containing pill. Search text reserves space for its leading icon.
- Saving a profile refreshes the filter summary and recommendations. Existing-restaurant scanning keeps the returned restaurant ID and a read-only name, and blocks submission if that identity cannot load. Photo and public web/PDF URL import are implemented. Local PDF upload and a full-menu browser remain unavailable under the frozen API contract.
- Dish cards show the returned mention count, stored price or explicit unknown-price notice, and supplied warning labels. The quote well appears only when both a generated reason and a quote are present outside fallback mode. Plain ranking has no quote well; its temporary generation notice disappears when recommendation generation finishes. Budget is the only currently observable dish-fit attribute; this is not evidence of ingredient, diet or taste suitability.
- Verification reported for this implementation: 148 unit tests, production web build and 10 Edge E2E tests passed. Captures under `web/test-results/` cover restaurant, profile, scanner and result screens at 390px and 1280px, plus compact final fallback at 390px. This records that run, not a substitute for rerunning required checks after future changes.

### Prism layout polish — 2026-11-03

- Preserve the user-confirmed Prism identity. Search leads the desktop viewport with a 56px heading and outlined 56px search field; a 280px neutral import panel contains the red scan action. On phones the panel becomes a compact horizontal prompt below search.
- Header, preference strip and content share the same desktop alignment. The preference label supports the controls; it is omitted on phones, where the controls scroll horizontally.
- Restaurant rows group identity, location and actual menu/review availability. The compact layout replaces repetitive empty plate illustrations. Skeletons follow the row geometry.
- Results use a narrower reading column, a smaller mobile restaurant title, and inline rank/review metadata when it fits. Existing exact quotes, stored prices, warnings, fallback behavior, dialogs, and routes remain intact.
- Validation for this pass: 148 unit tests, production build through the E2E setup, and all 10 Edge E2E tests passed. Desktop and mobile captures were inspected; live API data was unavailable in the local development screen, so populated-state checks use the existing mocked API fixtures.
