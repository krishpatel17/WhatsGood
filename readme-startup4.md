# Startup 4: Leasewise

Based on: [Cribspot](https://www.ycombinator.com/companies/cribspot) (YC W15, inactive)

## What Cribspot did

Cribspot was an online platform for college students and property managers to find and lease off-campus housing. Their YC page says the team joined Apartment List in 2018. Similar companies include [LoftSmart](https://dealroom.co/companies/loftsmart/), a marketplace for off-campus student housing, and [Rent College Pads](https://app.dealroom.co/companies/rent_college_pads).

Cribspot and LoftSmart were listing marketplaces. They helped students find apartments, which is crowded (Zillow, Apartments.com, Facebook groups, friends), and they needed students and landlords to sign up at the same time. YC doesn't say why Cribspot shut down, but our guess is that a two-sided marketplace is hard to win against the big rental sites. They also didn't help with the part where students actually get burned, which is the lease itself.

## Our version

We skip the marketplace. Students already find apartments through friends and listings. Leasewise helps when you're about to sign.

You upload the lease (a PDF or phone photos), or up to three leases to compare. You get a one-page brief with rent, deposit, every fee, the true 12-month cost, key dates, renewal terms, who's liable for what, and subletting and move-out rules. Red flags quote the exact clause with its page number, explain it in plain English, and point to the relevant part of Virginia's landlord-tenant law when there is one. You also get a list of questions to send the landlord and calendar reminders for things like the renewal notice deadline. Since only renters use it, there's no chicken-and-egg problem.

## The 8 criteria

### 1. Solves one problem extremely well

Make a lease understandable and its risks obvious before you sign. We don't list apartments, match roommates or act as anyone's lawyer. After signing, we'd ask one question: did anything in your lease surprise you later? We want the answer to be no.

### 2. We know the target customers

We're UVA students who have signed or will sign leases in Charlottesville, like most of our friends. Signing season happens every fall on our campus, so our first users are a group chat away, and their parents (who usually co-sign) are reachable through them. A handful of property managers in Charlottesville use the same lease template across lots of units, so our first 50 or so leases would cover a big part of the local market.

### 3. We know (or can learn) the infrastructure

- Cloudflare R2 for uploads, encrypted and set to expire. Shipped before.
- PDF text extraction, plus Claude vision for phone photos.
- Cloudflare Workers and D1 for the backend.
- A table in D1 of provisions from the Virginia Residential Landlord and Tenant Act (Va. Code Title 55.1, Chapter 12). Building it is new, but it's a limited research job, and we'd have a UVA Law student review it.
- `.ics` files for calendar reminders, which are simple.
- Claude API with long context and JSON output.

### 4. Reimagines the problem space

Cribspot asked where you should live and competed with every listing site. We ask what you're agreeing to, which today only a lawyer answers. Once the lease is structured data, a few new things become possible. You read one page instead of 30. You can compare apartments by what they really cost with fees included, not the advertised rent. Deadlines go on your calendar instead of getting forgotten. And because many students sign the same templates, we can say "14 other students flagged this clause from this property manager."

### 5. An LLM is core

Leases are long contracts with no standard format, which is where an LLM does better than regexes. The model pulls out every amount, date and obligation into a fixed schema. It sorts clauses by type (renewal, liability, fees, landlord entry, subletting, repairs). It explains each flagged clause in plain English for this specific lease, and matches clauses to entries in our statute table. The output is a brief, flags and calendar events, not a chat.

### 6. Validation guardrail

- Every quoted clause has to be an exact substring of the lease text (ignoring whitespace), and the page number has to match where it appears.
- Every dollar amount and date has to appear in the lease. Totals like the move-in cost are added up in code from the extracted line items. We never use a total the model wrote.
- Legal references can only use IDs from our reviewed statute table. Any other citation fails.
- Rent, lease dates, deposit and parties have to be filled in, or marked "not found in lease," which becomes a flag on its own.
- A rule-based filter blocks phrases like "this is illegal" or "don't sign," so everything stays informational and doesn't read as legal advice.

### 7. Self-correction loop

The validator sends back the closest real text and the right numbers, which makes the retry easy:

```text
VALIDATION FAILED (attempt 1/3):
- flag[2].quote not found verbatim. Closest match on page 14:
  "Tenant shall provide sixty (60) days written notice..." Use the exact text.
- brief.security_deposit = $1,800 but lease text contains "$1,850.00". Re-extract.
- flag[5] cites "Va. Code 55.1-9999", which is not in STATUTE_TABLE. Use a table ID or leave it out.
Return corrected JSON.
```

Usually it passes on the second try. Anything that still fails after three attempts gets left out of the brief and marked "couldn't verify." We never show it unchecked.

### 8. Deployability

All serverless on Cloudflare: Pages for the site, Workers for the API, R2 for lease files (encrypted, deleted after 30 days unless the user saves them), and D1 for briefs and the statute table. Claude API for the model and Stripe for one-time payments ($9 per lease, $19 to compare up to three). There are no servers to babysit, and we could launch before next fall's signing season.

## MVP and what we'd measure

The lease brief, red flags and calendar reminders for PDF leases, with a statute table covering about 25 of the provisions that matter most. Success would be 100% quote accuracy when we hand-check 50 leases, and at least 30% of users referring a roommate, since a whole group usually signs one lease.

## Risks

We have to stay on the right side of unauthorized practice of law. We quote, explain and suggest questions, and we never tell anyone to sign or not sign. We'd partner with tenant rights groups so we can refer people who need a real lawyer. Leases also contain personal info, so we keep them for a short time by default, encrypt them, and never train on them.
