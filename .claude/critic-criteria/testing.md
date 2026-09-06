<!-- seeded from project scan -->
# Testing Critic — Project Criteria: project-review v0.3.0

## Stack facts (verified 2026-09-06)
- Runner: `node --test` (node:test). No package.json, no test framework dep, zero runtime deps.
- Assertions: `node:assert` (default import, non-strict). Styles seen: `assert.equal`,
  `assert.deepEqual`, `assert.match`, `assert.doesNotMatch`, `assert.ok`, `assert.throws`.
- Mocking: NONE. No jest.mock/sinon/stub/spy/fake anywhere in scripts/*.test.mjs.
  Isolation is achieved with real temp dirs + real files, and `execFileSync` on real scripts.
- Test location: colocated in `scripts/` as `*.test.mjs` (NOT a `tests/` or `__tests__/` dir).
- Fixture regression: `scripts/assert-fixture.mjs` byte-compares a fresh merge against
  `examples/expected-review.json` over the `examples/demo-repo/` + `examples/slices/` fixture.
- CI: `.github/workflows/test.yml`, matrix os {ubuntu,macos,windows} x node {18,20,22}.
  Runs exactly 4 steps: merge-review.test.mjs, tools.test.mjs, run-timing.test.mjs, fixture regression.
- No coverage tooling, no coverage thresholds configured anywhere.
- `examples/demo-repo/` is a DELIBERATELY FLAWED fixture, not production code. Do not
  report its defects as project defects; do report if it stops exercising a code path.

## Named checks to apply every review
1. `exported-symbol-coverage` — every `export function` in scripts/*.mjs should have a
   named test. Source of truth: `grep -n '^export ' scripts/*.mjs` vs test imports.
   Known state: merge-review.mjs exports 17 functions; tests import only 3 by name in
   tools.test.mjs plus more in merge-review.test.mjs. Verify per review.
2. `orphaned-fixture` — every committed fixture under examples/ must be asserted by CI or
   a test. Known gap: `examples/expected-review-debug.json` has ZERO references repo-wide.
3. `ci-step-parity` — a script with tests that CI never runs is untested in practice.
   Confirm each *.test.mjs has a matching CI step.
4. `untested-script` — scripts with no exports and no unit test. Known: check-encoding.mjs
   is exercised only end-to-end via execFileSync in tools.test.mjs (2 cases, OK-path only).
5. `skip-erosion` — `{ skip: ... }` cases (e.g. symlink containment skips on win32) must be
   covered by at least one CI leg that does not skip. Verify the leg still exists.
6. `assertion-strength` — `assert.match` on console output is weak; check it pins the
   discriminating substring, not just a prefix that a broken run would still print.
7. `grounding-gate-negative-path` — this repo's whole value is DISCARDING unverifiable
   findings. Every accept/reject branch in verifyEvidence/acceptFindings needs a negative
   test, not just an accept test.
8. `markdown-artifact-untestable` — reviewers/*.md, reference/*.md, SKILL.md are prompt
   artifacts with NO automated verification. Any claim they encode (schema keys, domain
   ownership, severity rules) is only tested where a .mjs mirrors it. Flag drift risk.
9. `determinism-under-matrix` — ranking/clustering must be a total order or the fixture
   byte-compare flakes across platforms. Check tiebreaks when ordering logic changes.

## Anti-patterns already avoided here (do not "suggest" these)
- No mocks means no mock/prod divergence in the current suite. Do not invent that finding.
- Fixture compare is byte-for-byte with nothing excluded; that is intentional and strong.
