# Startup 3: Dry Run

Based on: [Alice](https://www.ycombinator.com/companies/alice-tech) (alice.tech, YC W25, active)

## What Alice does

Alice turns your course materials into summaries, flashcards, multiple choice questions and full exam simulations with grading. Their YC page reports $20k MRR growing about 10% a week, and links a Business Insider article about a $4.8M raise. Other YC companies in this space include [YouLearn](https://www.ycombinator.com/companies/youlearn), an AI tutor that also makes personalized tests, and Miyagi Labs (W25), which does SAT and ACT prep.

[Alice's site](https://alice.tech) says nothing about whether its answers are correct or whether the exams look like your professor's. It's a broad study app with chat, flashcards, summaries and leaderboards. AI-generated practice questions fail in familiar ways: the answer key is wrong, the code doesn't run, or two multiple choice options are both right. And a generic exam doesn't test things the way your professor does.

## Our version

Dry Run makes one thing, a practice exam for your course's next exam, and checks every answer by actually computing it.

You upload the syllabus, slides, homework and any past exams. Dry Run builds a style profile for the course: question types, point split, timing, notation, and the traps your professor likes. Then it writes a new exam as a blank PDF and a separate key with worked solutions. Later, you'll be able to upload a photo of your attempt and get it graded.

## The 8 criteria

### 1. Solves one problem extremely well

A realistic, correct practice exam for a specific course's next exam. Flashcards, summaries and tutor chat are what everyone else builds, so we don't. We'd measure the answer key error rate (target: zero) and whether students say it felt like the real exam.

### 2. We know the target customers

We take these courses at UVA. Intro and core lectures have 200+ students who already share study material in group chats. We've also built practice exam generators for two of our own classes, a statistics course in R and a software testing course, and we used them to study. So we know what "realistic" means for a specific professor and where generated exams go wrong.

### 3. We know (or can learn) the infrastructure

- PDF text and image extraction, which we did for our course generators.
- LaTeX and R Markdown for rendering exams. Already built.
- Containers that run Python, R and Java with no network access and CPU/time limits. We've used Docker; locking it down for production is new work.
- SymPy and R for checking math. Quick to pick up.
- Cloudflare Workers, D1 and R2 for the backend.
- Claude API, with vision for reading handwritten answers.

### 4. Reimagines the problem space

Right now practice material is either authentic and rare (real past exams) or plentiful and generic (Alice, question banks, chatbots). Dry Run is plentiful and authentic. Every exam is new and matches the professor's style, and the key has been computed instead of just written. Practice exams stop being something you hoard and become something you generate whenever you want. As far as we can tell, none of the AI study apps claim their answers are verified.

### 5. An LLM is core

The model reads past exams and builds the style profile. It writes new questions in that style, including data tables, code snippets and graphs. It writes worked solutions in the course's notation, and later it'll read handwritten answers from photos and grade them against a rubric. The output is a printable exam and key, not a conversation.

### 6. Validation guardrail

Every question and its answer are checked before the PDF gets built:

- Code questions: the reference solution runs in the sandbox and has to produce exactly the output in the key. For "what does this print?" questions, we get the answer by running the code.
- Math questions: numeric and algebraic answers are recomputed in SymPy or R and have to match within tolerance.
- Multiple choice: a separate solver with no access to the key has to pick the keyed answer, and the wrong options have to actually be wrong.
- Coverage: each question is tagged to a syllabus topic inside the exam's range, and the points add up to the target.
- Format: the LaTeX compiles, and length and estimated time are within 10% of the real exam.
- Leakage: no question is too similar (embedding similarity above 0.92) to a real past exam question the professor might reuse.

### 7. Self-correction loop

A failing question goes back to the model with the evidence:

```text
VALIDATION FAILED: Q4 (attempt 1/3)
- Key says mean(x) = 12.4; sandbox computed 12.35. Fix the key or the data.
- Independent solver chose (B); key says (C). B and C are both correct when n is even.
  Rewrite the distractor.
Regenerate Q4 only. Keep its topic and point value.
```

We check questions one at a time, so one bad question doesn't hold up the whole exam. If a question fails three times, we throw it out and write a new one on the same topic. A question that never passed never ships.

### 8. Deployability

Cloudflare Pages, Workers, D1 and R2, with code execution and LaTeX compilation in locked-down containers on Cloudflare Containers or Fly.io Machines. Claude API for generation, and Stripe for billing ($5 for five exams). We've deployed most of these before, and the rest are managed services with good docs.

## MVP and what we'd measure

Three UVA courses with style profiles, and exam plus key generation with the full validation loop. Photo grading comes second. We'd pay students $5 for every key error they find and aim for zero, and we want at least half of users to generate a second exam.

## Risks

Alice or someone like them could add verification. They're a broad study suite, though, and for us verification and style matching are the whole product. Academic integrity is the other worry. We only generate new practice material and never answer live assignments, and we'd give professors a free dashboard to see and curate what gets generated for their course.
