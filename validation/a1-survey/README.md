# A1 — Menu source availability survey (US-23)

**Question:** do most target restaurants publish their menu somewhere we can read?
**Pass threshold:** at least 24 of 30 restaurants (80%) have a readable source.

## Sampling frame (fixed before any menu was looked at)

The list was drawn from OpenStreetMap on 2026-11-03 with the Overpass API, so anyone can reproduce it. Each area's query was `nwr["amenity"="restaurant"](bbox)`:

| Area | Bounding box (S, W, N, E) | Raw result |
|---|---|---|
| The Corner | 38.0325, -78.5015, 38.0370, -78.4950 | `corner.json` |
| Downtown Mall | 38.0290, -78.4835, 38.0325, -78.4740 | `downtown.json` |
| Barracks Road | 38.0455, -78.5110, 38.0535, -78.4985 | `barracks.json` |

Rules, applied mechanically (`frame.csv` shows every restaurant and why it is in or out):

1. **Sit-down only.** OSM tags fast food separately (`amenity=fast_food`), so it is not in the frame. Places whose primary cuisine is dessert or bubble tea are excluded.
2. **Map order.** Restaurants are sorted west to east by longitude within each area.
3. **Sample.** The first 12 on the Corner, the first 12 on the Downtown Mall and all 6 mapped at Barracks Road: 30 in total. OSM has few Barracks Road restaurants mapped, which is why the split is uneven.
4. **Closed restaurants** are marked in `notes` and replaced by the next `backup` restaurant in map order for the same area.

`survey.csv` was committed with the names only and the source columns empty. CI (US-23 T3) checks that this commit is older than the one that filled the columns in.

## Coding each restaurant

For each restaurant, find the menu starting from its own website. If it has none, use a Google search for "<name> Charlottesville menu". Record the **best** source found:

| source_type | Meaning | Readable? |
|---|---|---|
| `html` | Menu as text on the restaurant's own site | yes |
| `pdf` | Menu as a PDF linked from its own site | yes |
| `ordering-page` | Toast, Square, ChowNow or similar online ordering page with the full menu | yes |
| `image-on-site` | Menu only as a photo or image on its own site | yes |
| `third-party-only` | Menu only on Yelp, Google or a delivery app (e.g. photos) | no |
| `social-only` | Menu only on Instagram or Facebook | no |
| `none` | No menu found online | no |

`url` is the link to the source. It is required for every readable type.
