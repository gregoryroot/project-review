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
