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

---

## PRD / design-doc testability criteria (added 2026-09-06, cycle 1)

Applies when the review subject is a PROSE DESIGN DOCUMENT rather than code. Checks 1-7
and 9 above target `scripts/` and DO NOT apply; only `markdown-artifact-untestable`
transfers. Report that honestly in `criteria_applied` instead of padding the list.

### D1 `falsifiability-classification`
Classify each requirement as: (a) falsifiable — observable input/output or state pair with
a stated bound; (b) falsifiable-but-unbounded — testable verb, missing threshold; (c)
unfalsifiable as written — evaluative adjective, no observable, or self-referential.
For (b) and (c) name the concrete regression that ships green. A requirement no
implementation could fail is the design-doc analogue of a vacuously passing test.

### D2 `countable-unit` (strongest single predictor of a dischargeable charge)
A charge or requirement is verifiable when it names a COUNTABLE unit and a per-unit
verdict ("each of F1-F15", "each of 6 milestones"). Charges phrased as open questions
("what does X cost", "does X serve the users") cannot fail: any answer discharges them.
Fix form: bind to an enumeration + require one verdict per element.

### D3 `assertion-without-minimum`
An "explicit assertion required, silence is a finding" construction fixes the
FALSE-NEGATIVE-by-omission failure only. Without a stated minimum (per-element verdicts,
required citation count) it stays dischargeable by one vague sentence. Presence is
checkable; sufficiency is not. Always ask: what is the thinnest output that passes?

### D4 `stated-vs-unstated-uncertainty gate`
A stated uncertainty is not a defect; an unstated one is. Two failure directions, both real:
- UNDER-SCOPE (false positives pass): the gate enumerates specific ranges (an open-questions
  section, an appendix) but authors also flag uncertainty INLINE elsewhere. Grep the whole
  document for hedges, not just the register sections.
- OVER-SUPPRESSION (false negatives struck): a subject-level "already stated" strike kills
  legitimate findings that assert MORE than the author's flag. Correct key is "the finding
  asserts nothing beyond what the flag states," not "same subject."
Process instructions of the form "consult X before filing" are UNVERIFIABLE BY INSPECTION.
Convert to output-checkable: require each gap-type finding to carry an explicit
not-stated-in-<ranges> token with grep evidence; a missing token is mechanically strikeable.

### D5 `one-lens-two-owners`
In a multi-reviewer partition, the real defects are an unowned line, an UNDECLARED overlap,
and two owners on one lens. Deliberate re-reading of shared lines is NOT a defect. Test for
one-lens-two-owners on the QUESTION TEXT, not the annotation: if two charges share their
operative verb and object ("can the data model represent/express revocation"), the framing
labels attached in prose do not separate them. A merge rule that preserves one half is
evidence the collision was anticipated rather than resolved, and it silently drops the
other half.

### D6 `exclusion-clause-holes`
Document-wide lots carved with "EXCLUDING lines A-B, which is lot Z's" create holes when
lot Z's question is narrower than the excluded range or its second reader is scoped to part
of it. Always re-intersect: excluded range minus what Z actually asks = unowned lens.

### D7 `id-namespace-collision`
Where a citation scheme mandates "section id" but the document reuses the same token space
for sub-items (e.g. sections S0-S19 while a safety section numbers its own requirements
S1-S7), cross-references become ambiguous and merge/adjudication keys collide. Make the
line range the primary key; require qualified ids for sub-items.

### D8 `measurability-under-privacy-constraint`
For any local-first / telemetry-free design that also states success metrics, check that
SOME lot owns the intersection. By-section slicing structurally drops it: the metrics
section and the privacy/data-model sections have different owners, and the question
"who computes this, from what data, on whose device" belongs to neither alone.

### D9 `arithmetic-in-plans`
Recompute every stated total, distribution, and contiguity claim in a plan. Contiguity
(each range starts at prev_end+1, first=1, last=N) is cheap to verify programmatically
and is worth confirming explicitly when it holds, not only when it fails.

### Calibration
Confirm what verifies clean, with the arithmetic shown. A critic that reports only
negatives cannot be distinguished from one that manufactures them.
