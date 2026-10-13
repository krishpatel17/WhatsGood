# Startup 5: Spotter

Based on: [Overfit](https://www.ycombinator.com/companies/overfit) (YC S20, inactive)

## What Overfit did

Overfit's YC listing describes it as a "human coach for accountability + AI for personalized workouts." [FitnessAI](https://www.ycombinator.com/companies/fitnessai) (YC W20, later acquired) was similar: AI workout plans with access to coaches. [TechCrunch reported](https://techcrunch.com/?p=1958865) it passed $1M ARR around Demo Day. A newer one, HYBRD (YC F2024, on [YC's fitness page](https://www.ycombinator.com/companies/industry/Fitness)), builds programs from wearable data for hybrid athletes.

Overfit and FitnessAI both put a human coach next to the AI, and the human was what made the plans trustworthy. Our read is that every new customer then needs more coach time, so you either charge a lot or coaching gets worse. Overfit is now inactive. Meanwhile the apps lifters actually log in, like Hevy and Strong, record everything but don't tell you what to do next. And if you ask ChatGPT for a program, it ignores your logs, gives you exercises you don't have equipment for, and can ramp volume too fast.

## Our version

Spotter replaces the human check with a rules engine. The AI writes your next week of training from your real logs, and code checks it against your equipment, your injuries and hard limits on progression and volume before you see it.

You import your Hevy or Strong history (or log in Spotter). You set a goal, days per week, session length, equipment for each day, injuries, and exercises you like or hate. Every week Spotter writes the next week's program with exercises, sets, reps, loads and RPE, based on missed reps, PRs, skipped sessions and notes like "knee felt off." Each change has a short reason, like "Bench stays at 185 because you missed reps on the last set two weeks in a row. Adding paused bench to work the sticking point."

## The 8 criteria

### 1. Solves one problem extremely well

Decide your next week of training from your own logs. Nutrition, social features and form checks can wait. We'd measure progression (estimated one rep max going up) and adherence (sessions done as written).

### 2. We know the target customers

We lift and log every session in Hevy, and so do a lot of our friends at UVA's gyms (AFC, North Grounds, Slaughter). We already built a Hevy-style logging app and imported years of our own Hevy data into it, so we know the export format and the real problem: nice charts, no plan. We can recruit at the gyms, club barbell and powerlifting, and through group chats.

### 3. We know (or can learn) the infrastructure

- Expo / React Native with on-device SQLite. We've built a lifting app on this stack.
- Hevy and Strong CSV parsers, already written for our own data.
- Cloudflare Workers, D1 and Cron Triggers for sync and weekly generation.
- A TypeScript rules engine for the checks, which is straightforward.
- Claude API with JSON output.
- EAS Build to TestFlight, the App Store and Play Store, which we've used with Expo.

### 4. Reimagines the problem space

Fitness apps fall into three groups today. Loggers like Hevy and Strong record but don't decide. Template programs decide but don't adapt to you. AI plus human coach products like Overfit and FitnessAI adapt but depend on paid human time. Spotter adapts using only software: you log, it adjusts, you log again. The validator does the safety job the human coach used to do, so it can cost what an app costs. Your training log stops being a diary and becomes the input for next week.

### 5. An LLM is core

Coaching mixes numbers with judgment. A missed rep after a bad night of sleep isn't a plateau, and "shoulder pinched on incline" matters. The model reads your logs and free-text notes to spot stalls, fatigue and pain. It writes the next week as structured JSON, and it explains each change in normal coaching language. A quick note like "hotel gym Thursday" becomes a constraint for that day.

### 6. Validation guardrail

Every program goes through the rules engine before the user sees it:

- Valid JSON with the right number of training days, and every set has reps and either a load or an RPE.
- Every exercise exists in our catalog, and its equipment is available on that day.
- No exercise uses a movement pattern that conflicts with a reported injury.
- Load goes up at most 5% per lift per week (10% for beginners), and no target goes above the estimated max for that RPE.
- Weekly hard sets per muscle stay within the set range (for example 8 to 22) and don't jump more than 20% from last week.
- No heavy compound lift for the same muscle on back-to-back days, and each session fits the user's time limit.
- Anything the explanation cites, like "missed reps two weeks in a row," has to match the actual logs.

### 7. Self-correction loop

Violations go back to the model as specific fixes:

```text
VALIDATION FAILED (attempt 1/3):
- day[2] "Barbell Back Squat": Thursday equipment = hotel_gym (no barbell). Substitute.
- Quads weekly hard sets = 26 (max 22). Reduce by at least 4.
- day[4] "Overhead Press" conflicts with injury flag shoulder_left. Replace.
- explanation[1] says "3 missed sessions"; log shows 1.
Return the corrected full program JSON.
```

If all three attempts fail, the user gets last week's program with a simple rule-based bump (2.5% more load on lifts they completed). That fallback goes through the same validator, so nothing unchecked reaches the user.

### 8. Deployability

The app is Expo, built with EAS and shipped through TestFlight to the App Store and Play Store. Logging works offline with on-device SQLite. Sync and weekly generation run on Cloudflare Workers and D1 with a cron job per user, calling the Claude API. Subscriptions go through RevenueCat or Stripe at $6 a month, which is a lot cheaper than a human coach. We've already built a React Native lifting app on this stack, so we know how to deploy it.

## MVP and what we'd measure

Hevy/Strong import, onboarding for goals and equipment, weekly generation with the full validation loop, and in-app logging. We'd want at least 70% of planned sessions completed, estimated maxes going up for at least 60% of users over eight weeks, and at least half of users still around in month two.

## Risks

Injury is the big one. The progression limits live in the validator, not the prompt. Pain notes remove exercises and suggest seeing a professional, and we don't give medical advice. Hevy or Strong could also add AI programming. We'd import from them instead of competing on logging, and bet that a checked, adaptive plan based on your own logs is hard to bolt on.
