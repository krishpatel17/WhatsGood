# Startup 1: What's Good

Based on: [Simmer](https://www.ycombinator.com/companies/simmer) (YC W19, now inactive)

## What Simmer did

Simmer pulled dish reviews from blogs, social media and newspapers, ran sentiment analysis on them, and showed the best-reviewed dishes in a city. You picked a dish, ordered it through a delivery app, and Simmer took an affiliate cut.

We think it had two problems. "What's the best dish in my city?" is a question Yelp, Google and TikTok already fight over. And the affiliate fee from delivery apps is small, and those apps control the whole funnel.

## Our version

We answer a smaller question that comes up way more often: I'm sitting at this restaurant, what should I order?

You pick the restaurant (or scan the menu with your camera). The app already knows your allergies, diet, budget and taste from your profile. It gives you three dishes, each with a one-line reason and the actual review quotes behind it. Something like: "Get the cumin lamb noodles. 41 reviewers mention them and they fit your spicy, no pork profile." After the meal it asks if the dish was better or worse than your last pick, which takes about five seconds. Those ratings slowly build a dish-level dataset that nobody else has.

## The 8 criteria

### 1. Solves one problem extremely well

The app decides which dish to order at one specific restaurant, and that's it. It doesn't pick restaurants, book tables or deliver food. We judge it by one number: how users rate the dish we told them to get.

### 2. We know the target customers

We're the customers. We're UVA students who eat on the Corner, the Downtown Mall and Barracks Road every week, and so do our friends. Our first couple hundred users can come from dorms, clubs and group chats, and we can watch people use it at an actual table. The restaurants are walking distance away if we want to talk to owners.

### 3. We know (or can learn) the infrastructure

- Cloudflare Workers for the API, D1 (SQLite) for data, R2 for menu photos. We've shipped apps on all three.
- Claude API with vision and JSON output for reading menus and ranking dishes.
- Apify scrapers for reviews. We already run scraping pipelines.
- A Next.js PWA for the front end.

The new piece is matching dish names that are written differently ("dan dan noodles" vs "dandan mian"). That's a normal fuzzy matching problem.

### 4. Reimagines the problem space

Review sites rate restaurants, but people order dishes. A 4.2 star place can have one amazing dish and four forgettable ones. We change what gets reviewed (the dish, not the restaurant) and who it's for (you, not the average reviewer). Today you spend ten minutes scrolling reviews and still guess. With us it's a few seconds, and every post-meal rating makes the next recommendation better for everyone.

### 5. An LLM is core

Without the model there's no product. It does three things that rules can't do well:

1. Reads a photo of any menu (including handwritten specials boards) and turns it into structured dishes, prices and likely ingredients.
2. Pulls dish mentions and sentiment out of thousands of messy reviews, like "the noodles are great but skip the dumplings."
3. Combines the menu, the dish sentiment and your profile into a ranked top three with reasons.

There's no chat box. You tap once and get an answer.

### 6. Validation guardrail

Nothing the model writes is shown until code checks it:

- The output parses as JSON with exactly three recommendations and all required fields.
- Each dish matches a real item on this restaurant's parsed menu (exact or normalized match of 0.9 or higher). It can't invent dishes.
- No dish conflicts with the user's allergies or diet, based on ingredient tags. If we don't know the ingredients and the user has a restriction, the dish gets an "ask your server" flag.
- The price is under the user's budget if they set one.
- Every review quote appears word for word in our stored reviews for this restaurant and mentions the dish. Every number like "41 reviewers" has to match our database count.
- For scanned menus, prices have to parse as money and the item count has to roughly match a separate layout-based count.

### 7. Self-correction loop

When a check fails, the validator writes out what went wrong and that gets sent back to the model on the next try:

```text
VALIDATION FAILED (attempt 1/3):
- item[1] "Spicy Pork Dumplings" conflicts with user diet: no_pork
- item[2].evidence[0] quote not found in reviews for restaurant_id=812
Regenerate the full list. Use only dishes from MENU and quotes from REVIEWS.
```

We allow three attempts. If all three fail, the user gets a plain ranking computed from the sentiment scores we already validated, filtered by their restrictions, with no generated text at all. We log every failure so we can see which prompts need fixing.

### 8. Deployability

Everything runs on Cloudflare and deploys with `wrangler deploy`: Workers, D1, R2 and Pages for the PWA, with LLM calls going to the Claude API. For a pilot of around 1,000 users we expect hosting plus LLM costs under $50 a month, especially since we cache each restaurant's review analysis. We've deployed on this exact stack before, and since it's a PWA we don't have to wait on App Store review.

## MVP and what we'd measure

Four weeks: 150 Charlottesville restaurants with menus and reviews loaded ahead of time, a 60-second profile setup, top-three recommendations with the retry loop, and the post-meal rating. We'd call it working if recommended dishes average 4/5 or better, 40% of users come back in week two, and at least 30% of recommendations get rated.

## Risks

The obvious one is "why not just ask ChatGPT?" Our answer is the checked, real-dish data and a taste profile that learns over time, which a general chatbot doesn't have. Small restaurants will have thin review data at first, so we'll label those picks as based on fewer reviews and let our own ratings fill the gap. Allergies are a liability, so we never say a dish is safe. Restrictions only remove dishes, and anything unknown gets flagged.
