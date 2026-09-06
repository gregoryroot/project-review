# Architecture Critic — Project Criteria

<!-- seeded from project scan -->
Project: project-review v0.3.0 (Claude Code skill/plugin). Scanned 2026-09-06.

## Layer model

This repo has no runtime application layers. It has four artifact layers, and
the boundaries between them are the architecture:

1. **Orchestration prose** — `SKILL.md` (359 lines). Numbered steps 0-9. Owns
   spawn decisions, slice-count, conditional-slice markers, and the order of
   script invocations. Not executable; enforced only by a model reading it.
2. **Reviewer prompts** — `reviewers/*.md` (8 files). Probabilistic. Each
   declares an owned output array and an explicit non-ownership disclaimer
   pointing at its neighbours. Must return one JSON object and nothing else.
3. **Shared contract docs** — `reference/*.md` (5 files):
   `grounding-rules.md`, `output-schema.md`, `standards.md`,
   `stack-detection.md`, `project-memory.md`. Every reviewer is told to read
   grounding-rules + standards + output-schema first. These are the interface
   definition; reviewers are implementations of it.
4. **Deterministic tooling** — `scripts/*.mjs`, Node ESM, node:test, zero
   runtime deps. `merge-review.mjs` (682 lines) is the verifier/adjudicator.
   Support: `run-timing.mjs`, `check-standards.mjs`, `standards-freshness.mjs`,
   `check-encoding.mjs`, `assert-fixture.mjs`.

Non-production: `examples/demo-repo/` is fixture input, `examples/slices/*.json`
and `examples/expected-review*.json` are golden fixtures. Do not critique these
as production code; DO critique whether they still pin the contract.

## Dependency direction rules

- Allowed: scripts -> node: builtins only. `merge-review.mjs` -> `standards-freshness.mjs`;
  `check-standards.mjs` -> `standards-freshness.mjs`. `standards-freshness.mjs` is
  the shared leaf and must import no sibling. Any sibling import added to it is a cycle.
- Tests (`*.test.mjs`) import from scripts; scripts must never import from tests.
  `tools.test.mjs` cross-imports two modules (`check-standards.mjs`,
  `merge-review.mjs`) — a change to either module's export surface breaks a test
  that does not name it.
- Prompt layer must never depend on script internals by restating them. Any
  constant duplicated between `reference/*.md` prose and `merge-review.mjs` code
  is a drift hazard, not a convenience.
- Zero third-party runtime dependencies is a hard architectural constraint
  (stated in the plugin's value proposition). Any new import outside `node:` is
  a boundary violation.

## WAT separation contract (the core architectural claim)

Stated premise: "The model proposes, the script decides." Concretely:
- **Probabilistic (Agents):** reviewer subagents produce candidate findings with
  verbatim quotes. Spawned as built-in `Explore` subagents so read-onlyness is
  harness-enforced rather than honor-system.
- **Deterministic (Tools):** `merge-review.mjs` re-reads source, verifies each
  quote (`verifyEvidence`), drops unconfirmed findings (`acceptFindings`),
  enforces slice ownership (`SLICE_DOMAINS`), sanitizes citations
  (`cleanStandards`), resolves paths (`safeResolve`, `containsRealPath`),
  then clusters/ranks/roadmaps (`clusterFindings`, `rankIssues`, `buildRoadmap`).
- **Workflow:** `SKILL.md` steps 0-9.

Named checks to run every cycle:
- **WAT-leak-into-prose** — any decision that must be deterministic (accept/
  reject, suppression, severity, ownership) described only in `SKILL.md` or a
  reviewer prompt with no corresponding code in `merge-review.mjs`.
- **WAT-leak-into-code** — any judgement requiring semantics baked into a regex
  or table where a wrong entry silently discards real findings.
- **Verification-bypass** — any path by which a finding reaches `review.json`
  without passing `acceptFindings`.
- **Suppression-ordering** — memory suppression must apply AFTER independent
  grounding (SKILL.md step 2 is explicit). Reviewers get only `## Stack` and
  `## Where to look`; never verdicts or false-positive fixtures. An architecture
  change that hands reviewers more of the memory inverts this.

## Slice disjointness contract

Ownership is declared in TWO places and must agree:
- Code: `SLICE_DOMAINS` in `merge-review.mjs:32-43`.
- Prose: each `reviewers/*.md` header.

Known overlaps that are intentional but load-bearing:
- `security-appsec` and `security-authz-identity` BOTH emit `security[]`, split
  by ASVS chapter (V1-V5,V11-V13,V15 vs V6-V10) — a prose-only boundary that
  `SLICE_DOMAINS` cannot enforce.
- `ai-llm` emits into `security[]` AND `privacy[]`, overlapping three other
  slices. Conditional, so overlap is intermittent.
- `performance-observability` owns two domains (`performance`,
  `maintainability`).
- Exclusive resource: `tests-correctness` is the SOLE test-suite runner; two
  other reviewers restate "do not run the test suite". This is a mutual-
  exclusion invariant enforced only by prose in three separate files.

**Disjointness check:** any new or edited slice must (a) appear in
`SLICE_DOMAINS`, (b) state what it does NOT own, (c) name the sibling that owns
it, and (d) not acquire the test-runner role.

## Established abstraction patterns (do not duplicate)

- Reviewer prompt shape: owned array -> non-ownership -> read-the-three-refs ->
  return one JSON object.
- Conditional slice shape: spawn marker + "if you were spawned and find nothing,
  return `{findings: [], assumptions: [...]}` and stop" (accessibility, ai-llm).
  A new conditional slice that invents a different empty-result protocol is a
  duplicate abstraction.
- Fixture-pinned contract: `examples/slices/*.json` in, `examples/expected-review*.json`
  out, checked by `assert-fixture.mjs`. A new verification mechanism that
  bypasses this duplicates it.
- Citation validation via `STANDARD_PATTERNS` regex table; a malformed citation
  is dropped without failing the finding.
- Output contract is the eleven-key `review.json` (see `reference/output-schema.md`).
  Adding a domain touches: `SLICE_DOMAINS`, `DOMAIN_PRIORITY`, output-schema.md,
  the fixtures, and a reviewer file. Any change touching fewer is incomplete.

## Boundary enforcement present

- `.github/workflows/test.yml` (CI), `node:test` suites, `check-encoding.mjs`,
  `check-standards.mjs` + `standards-freshness.mjs` (standards-edition drift),
  `assert-fixture.mjs` (golden output). No linter/module-boundary tooling — layer
  rules are conventions, so drift is caught only by review.
- Read-only enforcement is delegated to the harness (`Explore` subagent
  restriction) plus an auditable `git status --porcelain` baseline in step 0.

## Session-specific note

CORRECTED 2026-09-06. The previous text of this section claimed: "no mood/wellbeing/
journal/mental-health content exists in this repo; branch
`claude/mood-tracker-requirements-od3gtz` is 0 commits ahead of `main`." Both claims
are false and are retracted.

`docs/mood-tracker/PRD-v1.md` exists: 950 lines, 49,398 bytes, sha256
a01140bd...79b5, committed at 646e00d, working tree clean. It is a v1 product
requirements document for a local-first mood tracker (19 sections plus Appendix A).

Two distinct subjects live in this repo and must not be conflated. The criteria
above describe project-review v0.3.0, the review TOOLING. The PRD is a separate
product design document. When the PRD is the review target, judge it as a design:
findings are gaps or contradictions in the specified architecture, cited by verbatim
quote and line number, not defects in shipped code.

## Anti-patterns discovered

(append below after each cycle)
