# What's Good — Alpha validation report

## Verdict: Invalidated

- **A1 Sources exist: PASS** — 25/30 restaurants have a readable menu source (83.3%, 95% CI [0.653, 0.944]); threshold >= 24/30
- **A2 Import works: FAIL** — 3/10 restaurants imported easily (95% CI [0.067, 0.652]); dish-accuracy bootstrap lower bound 60.5%; thresholds >= 8/10 and >= 90%
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

Prompts frozen at `prompts-alpha-v1`. Importer: v2 (JavaScript pages rendered in a local browser before import). Dish-accuracy cluster bootstrap (10,000 resamples of restaurants): 95% interval [60.5%, 99.6%]. Deviation: model calls went through a developer's Claude login with the local bridge rather than the API, so seconds include the CLI's overhead and token costs are not meaningful.

| Restaurant | Tier | Source | Accuracy | Invented | Missed | Seconds | Retries | Pass |
|---|---|---|---|---|---|---|---|---|
| The Virginian | medium | pdf | 100.0% | 0 | 0 | 28.8 | 0 | yes |
| Sedona Taphouse | medium | pdf | 100.0% | 9 | 0 | 66.1 | 0 | no |
| El Puerto Mexican Restaurant | medium | pdf | 77.0% | 108 | 45 | 69.5 | 0 | no |
| Afghan Kabob House | medium | html | 100.0% | 0 | 0 | 74.4 | 0 | yes |
| The Whiskey Jar | medium | html | 100.0% | 0 | 0 | 74.7 | 0 | yes |
| Marco and Luca | hard | image-on-site | 100.0% | 1 | 0 | 24.7 | 0 | no |
| Crozet Pizza at Buddhist Biker Bar | hard | ordering-page | 0.0% | 0 | 74 | 30.1 | 0 | no |
| Boylan Heights | hard | ordering-page | 100.0% | 1 | 0 | 67.3 | 0 | no |
| Revolutionary Soup | hard | ordering-page | 51.4% | 0 | 17 | 30.8 | 0 | no |
| Otto | hard | ordering-page | 98.6% | 13 | 1 | 74.7 | 0 | no |

| Tier | Passed |
|---|---|
| medium | 3/5 |
| hard | 0/5 |

| Source type | Passed |
|---|---|
| pdf | 1/3 |
| html | 2/2 |
| image-on-site | 0/1 |
| ordering-page | 0/4 |

### Invented and missed dishes

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
- El Puerto Mexican Restaurant: invented "1"
- El Puerto Mexican Restaurant: invented "2"
- El Puerto Mexican Restaurant: invented "3"
- El Puerto Mexican Restaurant: invented "4"
- El Puerto Mexican Restaurant: invented "5"
- El Puerto Mexican Restaurant: invented "6"
- El Puerto Mexican Restaurant: invented "7"
- El Puerto Mexican Restaurant: invented "8"
- El Puerto Mexican Restaurant: invented "9"
- El Puerto Mexican Restaurant: invented "10"
- El Puerto Mexican Restaurant: invented "11"
- El Puerto Mexican Restaurant: invented "12"
- El Puerto Mexican Restaurant: invented "13"
- El Puerto Mexican Restaurant: invented "14"
- El Puerto Mexican Restaurant: invented "15"
- El Puerto Mexican Restaurant: invented "16"
- El Puerto Mexican Restaurant: invented "17"
- El Puerto Mexican Restaurant: invented "18"
- El Puerto Mexican Restaurant: invented "19"
- El Puerto Mexican Restaurant: invented "20"
- El Puerto Mexican Restaurant: invented "21"
- El Puerto Mexican Restaurant: invented "22"
- El Puerto Mexican Restaurant: invented "23"
- El Puerto Mexican Restaurant: invented "24"
- El Puerto Mexican Restaurant: invented "25"
- El Puerto Mexican Restaurant: invented "26"
- El Puerto Mexican Restaurant: invented "27"
- El Puerto Mexican Restaurant: invented "28"
- El Puerto Mexican Restaurant: invented "29"
- El Puerto Mexican Restaurant: invented "30"
- El Puerto Mexican Restaurant: invented "31"
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
- El Puerto Mexican Restaurant: invented "Jarritos"
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
- El Puerto Mexican Restaurant: invented "Tequila Shot"
- El Puerto Mexican Restaurant: invented "Aguas Frescas"
- El Puerto Mexican Restaurant: invented "Micheladas"
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
- El Puerto Mexican Restaurant: missed "Combination Dinner #1"
- El Puerto Mexican Restaurant: missed "Combination Dinner #2"
- El Puerto Mexican Restaurant: missed "Combination Dinner #3"
- El Puerto Mexican Restaurant: missed "Combination Dinner #4"
- El Puerto Mexican Restaurant: missed "Combination Dinner #5"
- El Puerto Mexican Restaurant: missed "Combination Dinner #6"
- El Puerto Mexican Restaurant: missed "Combination Dinner #7"
- El Puerto Mexican Restaurant: missed "Combination Dinner #8"
- El Puerto Mexican Restaurant: missed "Combination Dinner #9"
- El Puerto Mexican Restaurant: missed "Combination Dinner #10"
- El Puerto Mexican Restaurant: missed "Combination Dinner #11"
- El Puerto Mexican Restaurant: missed "Combination Dinner #12"
- El Puerto Mexican Restaurant: missed "Combination Dinner #13"
- El Puerto Mexican Restaurant: missed "Combination Dinner #14"
- El Puerto Mexican Restaurant: missed "Combination Dinner #15"
- El Puerto Mexican Restaurant: missed "Combination Dinner #16"
- El Puerto Mexican Restaurant: missed "Combination Dinner #17"
- El Puerto Mexican Restaurant: missed "Combination Dinner #18"
- El Puerto Mexican Restaurant: missed "Combination Dinner #19"
- El Puerto Mexican Restaurant: missed "Combination Dinner #20"
- El Puerto Mexican Restaurant: missed "Combination Dinner #21"
- El Puerto Mexican Restaurant: missed "Combination Dinner #22"
- El Puerto Mexican Restaurant: missed "Combination Dinner #23"
- El Puerto Mexican Restaurant: missed "Combination Dinner #24"
- El Puerto Mexican Restaurant: missed "Combination Dinner #25"
- El Puerto Mexican Restaurant: missed "Combination Dinner #26"
- El Puerto Mexican Restaurant: missed "Combination Dinner #27"
- El Puerto Mexican Restaurant: missed "Combination Dinner #28"
- El Puerto Mexican Restaurant: missed "Combination Dinner #29"
- El Puerto Mexican Restaurant: missed "Combination Dinner #30"
- El Puerto Mexican Restaurant: missed "Combination Dinner #31"
- Marco and Luca: invented "Extra Sauce"
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
- Boylan Heights: invented "Extra sauce"
- Revolutionary Soup: missed "Curried Chicken Salad"
- Revolutionary Soup: missed "Greek Salad"
- Revolutionary Soup: missed "Gulf Coast Salad"
- Revolutionary Soup: missed "House Salad"
- Revolutionary Soup: missed "Caesar Salad"
- Revolutionary Soup: missed "Nak Attack Burger"
- Revolutionary Soup: missed "Classic Burger"
- Revolutionary Soup: missed "Cibo Salutare"
- Revolutionary Soup: missed "Sano Sabor"
- Revolutionary Soup: missed "Buddha Bowl"
- Revolutionary Soup: missed "Classic Quesadilla"
- Revolutionary Soup: missed "Lisa Quesadilla"
- Revolutionary Soup: missed "Kid’s Quesadilla"
- Revolutionary Soup: missed "Classic Combo"
- Revolutionary Soup: missed "Pick Two Combo"
- Revolutionary Soup: missed "Chips on Chips on Chips"
- Revolutionary Soup: missed "Cookies"
- Otto: invented "Vegan Wrap,"
- Otto: invented "Kadayif Tatlisi ( Contains Gluten and Nuts)"
- Otto: invented "Meomi Pinot Noir- California-2021 Doluca Wine-"
- Otto: invented "Shower Pilsner"
- Otto: invented "Villa Doluca White"
- Otto: invented "Vodka Crush"
- Otto: invented "Full Nelson Pale Ale"
- Otto: invented "Gin Lemon Crush"
- Otto: invented "Lamberti Prosecco"
- Otto: invented "Sangria"
- Otto: invented "Sauvignon Blanc – Villa Maria- Marlborough, New Zealand 2021"
- Otto: invented "Missile Ipa"
- Otto: invented "Kavaklidere Turkish White Wine"
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
