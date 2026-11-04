# What's Good — Alpha validation report

## Verdict: Invalidated

- **A1 Sources exist: PASS** — 25/30 restaurants have a readable menu source (83.3%, 95% CI [0.653, 0.944]); threshold >= 24/30
- **A2 Import works: FAIL** — 5/10 restaurants imported easily (95% CI [0.187, 0.813]); dish-accuracy bootstrap lower bound 64.8%; thresholds >= 8/10 and >= 90%
- **A3 Reviews mention dishes: PASS** — 9/10 restaurants have at least 3 dishes with >= 3 matched mentions (95% CI [0.555, 0.997]); threshold >= 8/10

### Pivot

- A2 failed: Narrow import to the source types that passed and move the rest to the Beta.

## A1 — Menu source availability

| Source type | Restaurants |
|---|---|
| html | 9 |
| image-on-site | 1 |
| ordering-page | 12 |
| pdf | 3 |
| third-party-only | 5 |

## A2 — Menu import benchmark

Prompts frozen at `prompts-alpha-v1`. Importer: v4 (v3 plus pages scrolled a screen at a time, and unpriced ordering-site items left out). Dish-accuracy cluster bootstrap (10,000 resamples of restaurants): 95% interval [64.8%, 99.5%]. Deviation: model calls went through a developer's Claude login with the local bridge rather than the API, so seconds include the CLI's overhead and token costs are not meaningful.

| Restaurant | Tier | Source | Accuracy | Invented | Missed | Seconds | Retries | Pass |
|---|---|---|---|---|---|---|---|---|
| The Virginian | medium | pdf | 89.0% | 11 | 8 | 32.5 | 0 | no |
| Sedona Taphouse | medium | pdf | 100.0% | 9 | 0 | 64.5 | 0 | no |
| El Puerto Mexican Restaurant | medium | pdf | 92.5% | 77 | 14 | 71.1 | 0 | no |
| Afghan Kabob House | medium | html | 100.0% | 0 | 0 | 67.6 | 0 | yes |
| The Whiskey Jar | medium | html | 100.0% | 0 | 0 | 67.1 | 0 | yes |
| Marco and Luca | hard | image-on-site | 100.0% | 0 | 0 | 24.8 | 0 | yes |
| Crozet Pizza at Buddhist Biker Bar | hard | ordering-page | 0.0% | 0 | 74 | 30.2 | 0 | no |
| Boylan Heights | hard | ordering-page | 100.0% | 0 | 0 | 53.8 | 0 | yes |
| Revolutionary Soup | hard | ordering-page | 100.0% | 7 | 0 | 54.5 | 0 | no |
| Otto | hard | ordering-page | 98.6% | 0 | 1 | 73.2 | 0 | yes |

| Tier | Passed |
|---|---|
| medium | 2/5 |
| hard | 3/5 |

| Source type | Passed |
|---|---|
| pdf | 0/3 |
| html | 2/2 |
| image-on-site | 1/1 |
| ordering-page | 2/4 |

### Invented and missed dishes

- The Virginian: invented "Orange"
- The Virginian: invented "Cranberry"
- The Virginian: invented "Grapefruit"
- The Virginian: invented "Pineapple"
- The Virginian: invented "VIOGNIER"
- The Virginian: invented "VERMENTINO"
- The Virginian: invented "CHARDONNAY"
- The Virginian: invented "BARBERA RESERVE"
- The Virginian: invented "ROTUNDA RED"
- The Virginian: invented "MERITAGE"
- The Virginian: invented "SHY OX ROSÉ"
- The Virginian: missed "Juices"
- The Virginian: missed "VIOGNIER - Eastwood Farm and Winery"
- The Virginian: missed "VERMENTINO - Barboursville Vineyards"
- The Virginian: missed "CHARDONNAY - Barboursville Vineyards"
- The Virginian: missed "BARBERA RESERVE - Barboursville Vineyards"
- The Virginian: missed "ROTUNDA RED - Lovingston Winery"
- The Virginian: missed "MERITAGE - Rappahannock Cellars"
- The Virginian: missed "SHY OX ROSÉ - Ox-Eye Vineyards"
- Sedona Taphouse: invented "Seasonal Catch"
- Sedona Taphouse: invented "Seasoned Butter"
- Sedona Taphouse: invented "Herb Butter"
- Sedona Taphouse: invented "Pineapple-Mango Salsa"
- Sedona Taphouse: invented "Chimichurri"
- Sedona Taphouse: invented "Lemon Butter"
- Sedona Taphouse: invented "Marsala"
- Sedona Taphouse: invented "Wild Man"
- Sedona Taphouse: invented "Citrus Tomato Garlic Sauce"
- El Puerto Mexican Restaurant: invented "Soft Shell"
- El Puerto Mexican Restaurant: invented "Hard Shell"
- El Puerto Mexican Restaurant: invented "Beef"
- El Puerto Mexican Restaurant: invented "Cheese"
- El Puerto Mexican Restaurant: invented "Chicken"
- El Puerto Mexican Restaurant: invented "Beef"
- El Puerto Mexican Restaurant: invented "Cheese"
- El Puerto Mexican Restaurant: invented "Chicken"
- El Puerto Mexican Restaurant: invented "Bean"
- El Puerto Mexican Restaurant: invented "Corn"
- El Puerto Mexican Restaurant: invented "Flour"
- El Puerto Mexican Restaurant: invented "Cheese"
- El Puerto Mexican Restaurant: invented "Chicken"
- El Puerto Mexican Restaurant: invented "Beans"
- El Puerto Mexican Restaurant: invented "Jumbo Texas Margarita 27 oz."
- El Puerto Mexican Restaurant: invented "Jumbo Margarita 27 oz."
- El Puerto Mexican Restaurant: invented "Texas Margarita 16 oz."
- El Puerto Mexican Restaurant: invented "Regular Margarita16 oz."
- El Puerto Mexican Restaurant: invented "Strawberry Margarita16 oz."
- El Puerto Mexican Restaurant: invented "Peach Margarita16 oz."
- El Puerto Mexican Restaurant: invented "Blue Margarita16 oz."
- El Puerto Mexican Restaurant: invented "Raspberry Margarita16 oz."
- El Puerto Mexican Restaurant: invented "Lime Mini Margarita 8 oz."
- El Puerto Mexican Restaurant: invented "Non-Alcoholic Margarita 16 oz."
- El Puerto Mexican Restaurant: invented "Jarritos"
- El Puerto Mexican Restaurant: invented "Tequila Shot"
- El Puerto Mexican Restaurant: invented "Pepsi"
- El Puerto Mexican Restaurant: invented "Pepsi Zero"
- El Puerto Mexican Restaurant: invented "Mountain Dew"
- El Puerto Mexican Restaurant: invented "Dr. Pepper"
- El Puerto Mexican Restaurant: invented "Diet Pepsi"
- El Puerto Mexican Restaurant: invented "Starry"
- El Puerto Mexican Restaurant: invented "Iced Tea"
- El Puerto Mexican Restaurant: invented "Milk"
- El Puerto Mexican Restaurant: invented "Coffee"
- El Puerto Mexican Restaurant: invented "Orange Juice"
- El Puerto Mexican Restaurant: invented "Apple Juice"
- El Puerto Mexican Restaurant: invented "Pineapple Juice"
- El Puerto Mexican Restaurant: invented "Pitcher of Soft Drink"
- El Puerto Mexican Restaurant: invented "Aguas Frescas"
- El Puerto Mexican Restaurant: invented "Micheladas"
- El Puerto Mexican Restaurant: invented "Mexican Beer"
- El Puerto Mexican Restaurant: invented "American Beer"
- El Puerto Mexican Restaurant: invented "Imported Beer"
- El Puerto Mexican Restaurant: invented "Cabernet Sauvignon"
- El Puerto Mexican Restaurant: invented "Malbec"
- El Puerto Mexican Restaurant: invented "Merlot"
- El Puerto Mexican Restaurant: invented "Chardonnay"
- El Puerto Mexican Restaurant: invented "Sauvignon Blanc"
- El Puerto Mexican Restaurant: invented "Pinot Grigio"
- El Puerto Mexican Restaurant: invented "Sangria"
- El Puerto Mexican Restaurant: invented "Chablis"
- El Puerto Mexican Restaurant: invented "Rose"
- El Puerto Mexican Restaurant: invented "Burgundy"
- El Puerto Mexican Restaurant: invented "Special Puerto"
- El Puerto Mexican Restaurant: invented "Vodka Tonic"
- El Puerto Mexican Restaurant: invented "Gin Tonic"
- El Puerto Mexican Restaurant: invented "Screwdriver"
- El Puerto Mexican Restaurant: invented "Jim Beam"
- El Puerto Mexican Restaurant: invented "Amaretto Sour"
- El Puerto Mexican Restaurant: invented "Sea Breeze"
- El Puerto Mexican Restaurant: invented "Tom Collins"
- El Puerto Mexican Restaurant: invented "Vodka Collins"
- El Puerto Mexican Restaurant: invented "Rum & Coke"
- El Puerto Mexican Restaurant: invented "Long Island Iced Tea"
- El Puerto Mexican Restaurant: invented "Zombie"
- El Puerto Mexican Restaurant: invented "Electric Lemonade"
- El Puerto Mexican Restaurant: invented "Tequila Sunrise"
- El Puerto Mexican Restaurant: invented "Strawberry Colada"
- El Puerto Mexican Restaurant: invented "Peach Colada"
- El Puerto Mexican Restaurant: invented "Strawberry Daiquiri"
- El Puerto Mexican Restaurant: invented "Peach Daiquiri"
- El Puerto Mexican Restaurant: invented "Pina Colada"
- El Puerto Mexican Restaurant: invented "Blue Hawaii"
- El Puerto Mexican Restaurant: invented "Sex on the Beach"
- El Puerto Mexican Restaurant: invented "Bloody Mary"
- El Puerto Mexican Restaurant: invented "Jack Daniel's & Coke"
- El Puerto Mexican Restaurant: missed "Soft Shell Taco"
- El Puerto Mexican Restaurant: missed "Hard Shell Taco"
- El Puerto Mexican Restaurant: missed "Beef Burrito"
- El Puerto Mexican Restaurant: missed "Bean Burrito"
- El Puerto Mexican Restaurant: missed "Cheese Burrito"
- El Puerto Mexican Restaurant: missed "Chicken Burrito"
- El Puerto Mexican Restaurant: missed "Beef Enchilada"
- El Puerto Mexican Restaurant: missed "Cheese Enchilada"
- El Puerto Mexican Restaurant: missed "Chicken Enchilada"
- El Puerto Mexican Restaurant: missed "Bean Enchilada"
- El Puerto Mexican Restaurant: missed "Corn Tortillas"
- El Puerto Mexican Restaurant: missed "Flour Tortillas"
- El Puerto Mexican Restaurant: missed "Cheese Quesadilla"
- El Puerto Mexican Restaurant: missed "Chicken Quesadilla"
- Crozet Pizza at Buddhist Biker Bar: missed "Garlic Knots"
- Crozet Pizza at Buddhist Biker Bar: missed "Buddha Belly"
- Crozet Pizza at Buddhist Biker Bar: missed "Hummus Plate"
- Crozet Pizza at Buddhist Biker Bar: missed "Focaccia + Beer Cheese"
- Crozet Pizza at Buddhist Biker Bar: missed "Spinach Artichoke Dip"
- Crozet Pizza at Buddhist Biker Bar: missed "8 PC Wings"
- Crozet Pizza at Buddhist Biker Bar: missed "20 PC Wings"
- Crozet Pizza at Buddhist Biker Bar: missed "Veghead"
- Crozet Pizza at Buddhist Biker Bar: missed "Meathead"
- Crozet Pizza at Buddhist Biker Bar: missed "747 Calzone"
- Crozet Pizza at Buddhist Biker Bar: missed "Cheese Calzone"
- Crozet Pizza at Buddhist Biker Bar: missed "Buffalo Chicken Calzone"
- Crozet Pizza at Buddhist Biker Bar: missed "Meatball Parm"
- Crozet Pizza at Buddhist Biker Bar: missed "Chicken Parm"
- Crozet Pizza at Buddhist Biker Bar: missed "Veggie Parm"
- Crozet Pizza at Buddhist Biker Bar: missed "Yummus"
- Crozet Pizza at Buddhist Biker Bar: missed "BBQ Chicken"
- Crozet Pizza at Buddhist Biker Bar: missed "Buffalo Chicken"
- Crozet Pizza at Buddhist Biker Bar: missed "Pizza Hoagie"
- Crozet Pizza at Buddhist Biker Bar: missed "Big Tony"
- Crozet Pizza at Buddhist Biker Bar: missed "Caesar"
- Crozet Pizza at Buddhist Biker Bar: missed "Greek"
- Crozet Pizza at Buddhist Biker Bar: missed "Side Salad"
- Crozet Pizza at Buddhist Biker Bar: missed "Dipping Sauce"
- Crozet Pizza at Buddhist Biker Bar: missed "Beer Cheese"
- Crozet Pizza at Buddhist Biker Bar: missed "Cinnamon Buddha Bites"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Create Your Own"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Cheese"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Pepperoni"
- Crozet Pizza at Buddhist Biker Bar: missed "SML 747"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Big Yang"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Buddhist"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Capone"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Carnivore"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Emerald"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Feisty Italian"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Fun Guy"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Maui"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Outlaw"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Southern Thing"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Special"
- Crozet Pizza at Buddhist Biker Bar: missed "SML Veggie"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Create Your Own"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Cheese"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Pepperoni"
- Crozet Pizza at Buddhist Biker Bar: missed "MED 747"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Big Yang"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Buddhist"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Capone"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Carnivore"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Emerald"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Feisty Italian"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Fun Guy"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Maui"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Outlaw"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Southern Thing"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Special"
- Crozet Pizza at Buddhist Biker Bar: missed "MED Veggie"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Create Your Own"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Cheese"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Pepperoni"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG 747"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Big Yang"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Buddhist"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Capone"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Carnivore"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Emerald"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Feisty Italian"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Fun Guy"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Maui"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Outlaw"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Southern Thing"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Special"
- Crozet Pizza at Buddhist Biker Bar: missed "LRG Veggie"
- Revolutionary Soup: invented "Dasani"
- Revolutionary Soup: invented "Sparkling Beverages"
- Revolutionary Soup: invented "Vit Hit Anti Oxident Juices"
- Revolutionary Soup: invented "Minute Maid Juice"
- Revolutionary Soup: invented "Maine Root"
- Revolutionary Soup: invented "Wine"
- Revolutionary Soup: invented "Dressing and sauces 2oz"
- Otto: missed "Lemon Pepper Grilled Chicken"

## A3 — Review dish coverage

Extraction against the hand-labeled sample: precision 78.9%, recall 71.4%.

| Restaurant | Reviews | Dishes >=1 | >=3 | >=10 | Enough for top 3 |
|---|---|---|---|---|---|
| The Virginian | 202 | 30 | 13 | 2 | yes |
| Sedona Taphouse | 210 | 42 | 13 | 0 | yes |
| El Puerto Mexican Restaurant | 186 | 27 | 3 | 0 | yes |
| Afghan Kabob House | 228 | 42 | 15 | 2 | yes |
| The Whiskey Jar | 212 | 40 | 19 | 0 | yes |
| Marco and Luca | 424 | 18 | 10 | 5 | yes |
| Crozet Pizza at Buddhist Biker Bar | 147 | 12 | 1 | 0 | no |
| Boylan Heights | 166 | 12 | 5 | 0 | yes |
| Revolutionary Soup | 201 | 25 | 14 | 1 | yes |
| Otto | 235 | 26 | 12 | 1 | yes |
