<!-- seeded from project scan -->
# Performance Critic — Project Criteria: project-review v0.3.0

## Shape of the system
No server, no database, no request path. Node.js ESM CLI tooling (`scripts/*.mjs`),
zero runtime dependencies, Node >= 18. The performance surface is:
1. Parallel reviewer dispatch (subagents over a whole repo).
2. `scripts/merge-review.mjs` — the grounding/verification pass over reviewer output.
3. `scripts/check-standards.mjs` — networked freshness probes.
"Load" here means: repo size (files/LOC), finding count per slice, evidence items
per finding, and project-memory entry count.

## Query/IO layer in use
- Synchronous `node:fs` throughout the merge path: `readFileSync`, `existsSync`,
  `statSync`, `realpathSync`, `readdirSync` (merge-review.mjs:20-22).
- `execSync('git ls-files')` in check-encoding.mjs:36.
- Network only in check-standards.mjs (`fetch`, wrapped in `Promise.all`,
  per-probe timeout) — this is the one place the project already does
  concurrency correctly; treat it as the established async pattern.

## Established caching pattern
NONE in the script layer. Grep for cache/memoize/redis returns only prose in
README.md, reference/*.md and reviewers/performance-observability.md. So a
"missing cache" finding must be justified on first principles (repeated identical
work in one process run), not by pointing at an existing convention.

## Established pagination/bounding conventions
- `cleanStandards` caps `standard[]` at 3 (`value.slice(0, 3)`).
- `QUOTE_WINDOW = 3` bounds the quote-match window.
- `buildRoadmap` caps output at 5 items.
- `estimateDuration` bounds history to the last 3 runs (`pool.slice(-3)`).
Convention: bound at the point of consumption with a named constant. A new
unbounded collection in this codebase is a deviation from house style.

## Known hot paths (check these first)
- `verifyEvidence` (merge-review.mjs:184-233) — runs once per evidence item per
  finding. Does existsSync + realpathSync x2 + statSync + full readFileSync +
  `.split(/\r?\n/)` every call, with no per-file memoization. This is the
  N+1-equivalent for this codebase.
- `acceptFindings` (merge-review.mjs:240-271) — nested loop over findings x
  evidence, calling verifyEvidence in the inner loop.
- `suppress` (merge-review.mjs:346-363) — `liveEntries.find(...)` with a nested
  `f.evidence.some(...)` inside a loop over findings: O(findings x entries x evidence),
  linear scan, no index by (domain, file).
- `clusterFindings` (merge-review.mjs:393-410) — correctly O(n) via a Map; a
  change here to nested scanning is a complexity regression.
- `parseSlice` (merge-review.mjs:143-158) — single char-wise pass over slice text; O(n), fine.
- Parallel dispatch, SKILL.md:107 — "Spawn them all in parallel, in a single
  message"; SKILL.md:162 — only tests-correctness runs the suite, deliberately,
  to avoid two concurrent suite runs.

## Named checks to apply
- `unmemoized-evidence-file-reads`: same file read and split once per citation.
- `unbounded-file-read`: readFileSync with no size cap; a large/minified cited file
  is fully materialized and split into an array of lines per evidence item.
- `repeated-realpath-of-root`: `containsRealPath` realpaths repoRoot on every call.
- `linear-scan-suppression`: no index for memory-entry lookup.
- `serial-dispatch-regression`: any change that serializes the parallel reviewer spawn.
- `bound-at-consumption`: new collections must carry a named cap, per house style.
- `no-fabricated-hot-path`: this repo has no request path; reject findings phrased
  as request/RPS degradation. Scale is repo size and finding count.
- `demo-repo-excluded`: examples/demo-repo/ is intentional bad code, not production.

---

## PRD / design-document feasibility criteria (appended — durable)

When the artifact under review is a design document or a review plan rather than
running code, "performance" reframes to FEASIBILITY, OPERATING COST, DEVICE RESOURCE
BUDGET, and REVIEW THROUGHPUT. The runtime checks above do not apply. Named checks:

- `no-fabricated-hot-path` (already binding): a local-first, one-user-per-device app has
  no request path. Index/cache/pagination findings against it are the generic-review
  failure this repo exists to defeat. Reject them.
- `fixed-annual-floor-vs-zero-revenue`: a free product still carries costs that do not
  shrink at one user — store developer accounts, code signing, domain, push
  infrastructure minimums. Cost a design against its stated distribution scale, and if
  the document states no scale, the missing scale is the finding.
- `os-background-execution-permit-vs-assume`: any adaptive/scheduled/background policy
  must be judged against what iOS and Android background execution policy will PERMIT,
  not what the policy assumes it can schedule. A policy assuming wakeups the OS will not
  grant is a correctness defect wearing a performance costume.
- `time-to-first-input-as-latency`: for products whose users face a motivation barrier,
  cold start to first interactive control is the real latency metric. Steps added to the
  shortest path are performance defects.
- `stated-uncertainty-is-not-a-defect`: grep the document's own out-of-scope, open-
  decisions, risks and uncertainty sections BEFORE filing any gap. An author-flagged
  unknown is a NOTE at most. An UNSTATED one is the finding, and its unstated status
  must be said explicitly.
- `cost-driver-vs-cost-section-boundary`: cost lives where the FEATURES are, not only
  where the pricing section is. A review scope that confines cost analysis to the
  monetization section cannot detect a cost driver introduced by a feature list. Check
  that the feature enumeration is inside some cost-bearing lot's read range.

### Review-plan (work-partition) criteria
When critiquing a review plan, partition, or dispatch ledger, throughput is the metric:
- `concurrency-unit-is-the-agent`: lots are parallel only if their OWNERS differ. N
  disjoint lots held by one owner run serially. Any "runs fully in parallel" claim must
  be re-derived per owner, not per lot.
- `last-starting-largest-lot`: identify the lot with the most dependencies AND the
  largest surface. That lot, not the one the plan names, is usually the critical path.
- `load-table-must-sum`: per-owner line and lot totals must sum to the whole artifact. A
  distribution table that oversums is unchecked arithmetic and its risk register is
  reasoning from a number nobody verified.
- `mitigation-must-enumerate-the-real-load`: an "accept and monitor" on overload is only
  supported if the mitigation names every lot the owner holds. Omitting the biggest one
  makes the acceptance unsupported rather than dishonest.
- `read-grant-asymmetry`: when sibling lots carry explicit "may read" grants and one does
  not, the one without is usually unanswerable as written. The asymmetry is the evidence.
- `convergence-needs-a-merge-rule`: if two owners hold different questions over the same
  lines, there must be an adjudication rule for a converged finding. A merge rule naming
  only one pair of domains leaves every other pair unhandled.
