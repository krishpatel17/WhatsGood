# Startup 2: Vouch

Based on: [Simplify](https://www.ycombinator.com/companies/simplify) (YC W21, active)

## What Simplify does

Simplify's Copilot helps people find jobs and autofill applications. Their YC page says over a million job seekers have used it. They also have a resume builder that, according to [their site](https://simplify.jobs/resume-builder), makes an ATS-friendly resume and tailors it to any job description with AI suggestions and keyword matching.

Simplify is built for volume: more jobs, faster applications, more keywords. Nothing on their public pages says the tailored resume is checked against what you actually did. In our experience, generic AI tailoring adds skills and numbers you never had so the keywords line up, and that falls apart the moment an interviewer asks about it. Simplify also does a lot of things at once (job board, tracker, autofill, recruiter tools).

## Our version

Vouch only does the resume, and it can only use facts you've given it.

You build an "experience vault" once by importing your resume, GitHub READMEs and project notes. Each entry is a fact: what you built, what you did, the tech, any metric, and where that fact came from. Then you paste a job link. Vouch picks the most relevant facts, rewrites them in the job's language using the X-Y-Z bullet format, and gives you a one-page PDF where every bullet links back to its source. You also get a short coverage report, like "you match 9 of 11 required skills. Missing: Terraform, Go. We didn't add them because you have nothing in your vault for them."

## The 8 criteria

### 1. Solves one problem extremely well

Turn a job posting and your real history into a truthful, one-page, ATS-ready resume. We're leaving out the job board, auto-apply and cover letters on purpose. We'd measure two things: zero unsupported claims, and callback rate compared to the user's generic resume.

### 2. We know the target customers

We're in the new grad SWE job search right now, along with most of our CS friends. We already built a personal pipeline that finds jobs, tailors resumes and runs ATS checks, and we've used it on real applications. We can reach users through UVA CS clubs, class group chats and friends at other schools. The UVA career center could be an early paying customer.

### 3. We know (or can learn) the infrastructure

- LaTeX compiled with Tectonic for the PDF. We already do this in our pipeline.
- Scrapers for Greenhouse, Lever and Ashby job pages. Already written.
- Cloudflare Workers, D1 and R2 for the backend and file storage. Shipped before.
- Claude API with JSON output.
- `pdftotext` plus our own keyword matcher for the ATS check. Already written.
- Stripe Checkout for payments, which is new but well documented.

### 4. Reimagines the problem space

Most tools, Simplify included, treat a resume as text you tweak until the keywords match. We treat it as a view over a database of things you've verifiably done. Tailoring becomes picking and phrasing the right facts. That has a few effects. A claim can't exist without a source. A job takes about 30 seconds instead of 30 minutes. Every project you add to the vault makes every later resume better. And the coverage report shows the skills you're actually missing instead of hiding them.

### 5. An LLM is core

The model does the language work at each step. It pulls structured facts out of messy READMEs and old resumes. It reads the job posting and separates real requirements from boilerplate. Then it ranks your facts by relevance and rewrites them in the posting's terms without going past what the source says. There's no chat. A job URL goes in and a PDF comes out.

### 6. Validation guardrail

Every resume goes through these checks before the user sees it:

- Every bullet cites at least one vault fact that exists and belongs to this user.
- Every number or percentage in a bullet shows up in the cited fact.
- Every technology, employer, school and job title is in the user's vault, matched against a skills dictionary.
- A second model grades each bullet yes/no on whether its source fact supports it, alongside a text overlap threshold. One "no" fails the bullet.
- The LaTeX compiles, the PDF is exactly one page, and no bullet is longer than two lines.
- Running `pdftotext` on the PDF recovers the section headers, contact info and target keywords.

### 7. Self-correction loop

Failures turn into specific instructions for the next attempt:

```text
VALIDATION FAILED (attempt 1/3):
- bullet[3] contains "40%" but source fact F-112 has no metric. Remove it or use F-112's wording.
- bullet[5] mentions "Kubernetes", which is not in the vault. Remove it.
- PDF is 1.2 pages. Cut about 3 lines, starting with the least relevant bullet.
Return corrected resume JSON. Keep all passing bullets unchanged.
```

Bullets that pass are locked, so only the broken ones get regenerated. If a bullet still fails after three tries, it goes back to the original wording from the vault, which is true by definition.

### 8. Deployability

Pages, Workers, D1 and R2 on Cloudflare, with LaTeX compiling in a small Tectonic container on Cloudflare Containers or Fly.io. Magic link login, and Stripe for payment ($12/month during recruiting season, or a career center license). We've deployed all of this before or it's a standard managed service, so we could have it running for UVA in three or four weeks.

## MVP and what we'd measure

Vault import from a PDF resume and GitHub, job URL to tailored PDF with the retry loop, and the coverage report. Success would be zero unsupported claims when we hand-check 100 resumes, under a minute per resume, and a better callback rate than the user's old resume.

## Risks

Simplify could add a "verified" mode. We think focus is our edge, since for us the vault is the whole product and for them it would be one more feature. Job searching is also seasonal (fall and spring), so we'd sell annual plans and career center licenses to even it out.
