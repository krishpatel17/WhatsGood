# Test review follow-up

Based on the supplied review of PRs #59 and #60, applied on top of main at
`99e0b84` (2026-11-05). Existing unfinished refinements were preserved.

Verified on 2026-11-05: 320 API tests, 43 web unit tests, and 19 Microsoft Edge
browser tests pass. Both TypeScript checks and the coverage gate pass. Application
line coverage is 96.49% API and 89.65% web. An independent review found and fixed
a truncated-manifest false pass; a mutation check confirmed the body-size test
detects an inverted limit. The final dialog open/Escape/focus-restoration check
also passed through the connected Edge extension; its temporary tab was closed.

## Attribution

`[manual]` is the reporting category requested by Krish for all additions and
refinements covered by this review, including the tests implemented during this
follow-up. Their implementation used AI assistance; this reporting category does
not assert that every line was written without it. Untouched tests retain their
original tags. The metrics script recognizes exact `[manual]` and `[ai]` tags.

## Review coverage

| Requested refinement or addition | Checks |
|---|---|
| Empty response versus failure, retries, JSON body/headers/errors, blocked storage | `web/test/us-14-results-view.test.tsx` |
| Fixture safety wording and distinct component identifiers | `web/test/us-14-pick-card.test.tsx` |
| Sentiment boundaries and replacing obsolete mentions | `api/test/us-07-dish-mentions.test.ts` |
| Successful two-pick responses, plan-specific limits, thin-review planning names | `api/test/us-08-top-three.test.ts`, `us-12-self-correction.test.ts`, `us-13-thin-review-labels.test.ts` |
| Exact Git arguments; real staged, unstaged, added and ignored prompt files | `api/test/us-19-benchmark-runner.test.ts`, `prompt-freeze-regressions.test.ts` |
| Deterministic timeout and late completion | `api/test/us-19-benchmark-runner.test.ts` |
| Isolated absent A2/A3 pending state | `api/test/us-20-validation-report.test.ts` |
| CI invokes the actual coverage runner; scoped config check | `api/test/us-22-deploy-ci.test.ts` |
| Current tracked-text credential scan, including nested paths | `api/test/tracked-secrets.test.ts`, `scripts/check-secrets.mjs`; also runs in CI |
| Atomic menu replacement, concurrent imports, failed mention refresh, counts and quote attribution | `api/test/review-persistence-regressions.test.ts`, `worker-runtime.test.ts` |
| Conflicting duplicate listings, input order and conservative ingredient boundaries | `api/test/review-boundaries.test.ts` |
| Actual A3 distinct-review threshold | `api/test/us-24-review-coverage.test.ts` |
| Recommendation endpoint ordering, failures, restaurant/profile changes and unmount | `web/test/us-14-results-view.test.tsx` |
| First profile, stale ID, failed load/save, blocked writes, repeated submission | `web/test/profile-recovery.test.tsx` |
| Photo conversion, decode failure, upload failure, retake and import retry | `web/test/scan-recovery.test.tsx`, `web/e2e/review-regressions.spec.ts` |
| Concurrent ratings, events and one-time prompts | `api/test/review-persistence-regressions.test.ts` |
| Redirects, deadlines, size limits, MIME and disallowed destinations | `api/test/source-boundaries.test.ts`; page-image downloads use the same boundary |
| Direct Anthropic/subscription SDK contracts, schema, content, refusals and cache tokens | `api/test/llm-adapter-contracts.test.ts` |
| Bridge validation, methods/routes, size, disconnected clients | `api/test/bridge-validation.test.ts` |
| Dataset IDs, missing truth, malformed results, prompt tags and A2/A3 provenance | `api/test/benchmark-integrity.test.ts` |
| Empty scoring sets, duplicates, fuzzy competition, prices, exact thresholds and zero denominators | `api/test/scoring-boundaries.test.ts` |
| Worker entrypoint, real local D1/R2 bindings and D1 rollback | `api/test/worker-runtime.test.ts` |
| Dialog screenshot comparisons, keyboard containment/order, validation and text zoom | `web/e2e/prism.spec.ts`, `web/e2e/review-regressions.spec.ts`, `web/test/shell-dialog.test.tsx` |

## Coverage scope and enforcement

`npm run coverage` measures `api/src/**/*.ts` (except type declarations) and
`web/components/**/*.tsx` plus `web/lib/**/*.ts`. CI fails below these per-workspace
percentages:

| Workspace | Lines | Statements | Functions | Branches |
|---|---:|---:|---:|---:|
| API | 90 | 90 | 85 | 80 |
| Web | 75 | 75 | 70 | 65 |

These are application-library coverage figures, not repository-wide coverage.
The following excluded execution surfaces are explicitly accounted for:

* `web/app/{page,layout,setup/page,results/page,scan/page,rate/page}.tsx` and
  `globals.css`: Next routing/layout and browser-only wiring, exercised by Edge
  end-to-end tests; browser execution is not included in Vitest's V8 percentages.
* `api/scripts/subscription-bridge.ts`: directly exercised by bridge/SDK tests,
  but excluded from application-library percentages.
* `api/scripts/{benchmark,coverage-a3,validation-report,truth-import}.ts`: CLI
  wrappers around tested validation modules. CLI environment loading is separately
  exercised; complete real benchmark runs would call paid external services and
  write validation artifacts, so they are outside the routine test gate.
* `scripts/check-secrets.mjs`: exercised by tracked-secret tests and CI.
* `scripts/{coverage-summary,metrics}.mjs`: operational report generation,
  excluded from V8 percentages. Metrics execute suites and query GitHub; their
  displayed totals are a dated snapshot, not a permanent suite-size assertion.
* `scripts/{seed-demo,smoke}.mjs`: operational commands requiring a running API
  and potentially external services. They are not routine isolated tests.

## Behavioral contracts and limits

Menu and evidence replacement use D1 batches: a failed write leaves the old
usable state intact. Review counts mean distinct reviews; multiple spans in a
review contribute one review's average sentiment. Equal-count duplicate dish
listings resolve by stable ID, preserving the selected listing's metadata.
Concurrent rating requests produce one rating and its events; the loser receives
409. A pending rating prompt can be claimed once.

Benchmark timeout stops waiting and prevents late results from changing the
saved report; it does not promise cancellation of an already-running external
model request. Disconnected bridge clients do abort the SDK request. Extracted
quote spans prevent a recommendation from borrowing another dish's span in the
same review; this is not independent proof of an extraction model's semantic
interpretation.

Imports allow HTTP(S) public website hostnames, validate redirect destinations,
and reject credentials, literal IPs/local names, unsupported MIME, oversized
bodies and stalled downloads. Hostname validation is not DNS-resolution proof
against rebinding; deployment networking must also prevent private-address
connections. The tracked-secret gate detects supported credential patterns in
the current tracked text tree; it does not audit Git history or guarantee the
absence of every possible secret format.

The Worker integration test runs local workerd with D1 and R2, not deployed
Cloudflare services. It tests actual bindings and batch rollback rather than
treating `/health` as a database/storage readiness probe.

Photo tests decode a synthetic PNG in Edge, resize it and inspect the uploaded
JPEG. They do not exercise a physical camera or genuine HEIC decoding. Zoom
coverage uses a reduced CSS viewport and 200% text size, rather than an OS-level
browser zoom setting. Visual comparisons use checked-in dialog baselines.
