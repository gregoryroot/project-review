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

---

## PRD-scoped criteria (design documents, not code)

Added 2026-09-06. Applies when the review target is a product design document or a
review *plan* over one. The repo-internal criteria above (layer model, SLICE_DOMAINS,
merge-review.mjs, reviewer prompt shape) are NOT applied to such targets.

### Judging a design document
- Bar must be stated before findings: "complete enough to DECIDE TO BUILD" vs
  "complete enough to implement from." Underspecified implementation detail is a
  finding, never a showstopper, under the former.
- A stated uncertainty is not a defect; an unstated one is. Locate the document's
  own uncertainty registers (out-of-scope / open-decisions / risks / appendix) and
  grep them BEFORE filing any gap-type finding. Filing something the author already
  flagged is the characteristic failure of design-doc review.
- Evidence for a design doc = verbatim quoted substring + line range + section id,
  resolving by grep against a content-pinned artifact. Where the finding claims a
  contradiction, BOTH sides must be quoted; a one-sided quote cannot establish one.
- Freeze on content (sha256 / blob), never on HEAD. A moving HEAD is not a violation.
- Data-model sketches are judged against their CONSUMERS, one consumer at a time.
  Enumerate every section that reads the model, then check each for a field or
  relation the model lacks. A model reviewed in isolation always passes.

### Judging a coverage ledger / partition plan as architecture
A review plan that partitions a document is itself an architecture: lots are modules,
ownership is dependency direction, cross-cutting lots are the seams. Named checks:

- **Contiguity check.** Recompute every range: each starts at prev_end+1, first=1,
  last=EOF. Then verify each boundary against the real section headings in the target,
  not against the plan's own prose. A plan can be internally contiguous and still
  mis-cut the document.
- **Distribution-arithmetic check.** Any per-owner line-count summary offered as a
  mechanical check must sum to the document length. Summaries that do not sum teach
  the adjudicator to distrust the check that actually works.
- **Two-layer ownership.** "One primary owner per line" plus "one accountable owner
  per cross-cutting question" is a sound partition scheme. Deliberate re-reading of
  owned lines by a cross-cutting lot is BY DESIGN and is not an overlap defect. The
  real defects are: an unowned line, an unowned QUESTION, an undeclared overlap, or
  two owners sharing one lens.
- **One-lens test.** Two lots differ only in framing words if they resolve to the same
  mechanical check over the same artifact. Ask: what concrete field or clause would
  each inspect? Identical answers mean one lens, two owners, regardless of how the
  questions are worded.
- **Disjointness-vs-merge contradiction.** A plan that asserts question-disjointness
  AND ships a merge rule for two owners converging on one defect has already predicted
  its own collision. The merge rule is correct; the disjointness claim is the defect.
- **Cross-agent dependency realizability.** THE high-yield check. For every stated
  "X runs after Y," ask whether X's owner and Y's owner are the same agent. Cross-agent
  arrows are only realizable if the schedule has more than one round AND a defined
  artifact handoff. Under a single parallel dispatch where sibling agents cannot address
  each other, cross-agent arrows are unimplementable and must be restated as
  "re-read the lines yourself," not as ordering.
- **Answerability.** A lot whose charge cannot return "no" is decoration. Mandatory
  lots must specify what SILENCE means; the strong form is "an unanswered lot is itself
  a finding at adjudication."
- **Contradiction rule, not just convergence.** Merge rules cover two owners finding the
  same defect. Plans routinely omit the harder case: two owners reaching OPPOSITE
  verdicts on the same lines through different lenses. Absent a rule, the adjudicator
  invents one.
- **Mitigation-points-at-nothing.** Every risk-register mitigation must name a control
  that exists elsewhere in the same document, with matching scope. Check the cited
  control's actual line ranges against the risk's subject; mitigations frequently cite
  a gate that excludes the very range it is claimed to protect.
- **Write-discipline coherence.** A plan that both forbids all agent writes and permits
  critics to append to their own memory files contradicts itself. Resolve explicitly:
  criteria memory is the only durable control across sessions, so an absolute
  read-only clause silently disables it.

### Anti-patterns discovered (ledger review, cycle 1)
- Ordering sections that read as a dependency DAG but encode reading order within a
  single agent. Acyclic, so no deadlock, but ambiguous enough that some owners stall
  waiting for outputs that will never arrive separately.
- Cross-cutting lots clustered on the privacy/identity pair while the same artifact's
  measurement and prompting consumers get none. Symptom: the domain owner is given
  narrow base lots "with weight in the cross-cutting layer," and the cross-cutting
  layer then covers a minority of that domain's real seams.
- Owner-distribution summaries that are exact for four owners and wrong for the fifth
  (the residual owner absorbing front matter and short tail sections).

### Attribution of a contradiction: audit the source, not just the artifact
Confirmed 2026-09-06 by outcome. A contradiction found inside a plan is not evidence that
the plan's author drafted badly. Plans faithfully propagate contradictions present in the
rulings, briefs, or specs they were drafted from. Before attributing an inconsistency to the
artifact under review, ask which upstream instruction each half restates — the two halves
often trace to two different authorities that were scoping different things and never
reconciled. The finding stands either way; the REMEDY differs completely. Fixing the artifact
leaves the upstream contradiction to re-emerge in the next artifact drafted from it.

Corollary, observed: where a governing document contradicts itself about what agents may do,
independent agents resolve it differently and silently, and the divergence is visible only by
comparing their behaviour after the fact. Self-contradictory permissions do not produce
errors; they produce inconsistent compliance. Predicting which way each agent will resolve it
is not possible, so the check is to find the contradiction, not to model the outcome.

### Deletion residue: a removed block is not a self-contained edit
Confirmed twice, 2026-09-06, on two different artifacts. When a module, lot, section, or rule is
retired, merged, or folded, the deletion almost never removes the references TO it. Grep for the
retired identifier across the whole artifact rather than re-reading the region that changed; the
dangerous residue is always outside it — a live read order pointing at a deleted block, a cross-
reference to a folded item, a numbered list with a hole. Two verified instances: a retired lot left
a live dependency arrow, and a folded charge required a cross-reference sweep (headings renumbered,
every surviving pointer resolved) to confirm no orphan.
Generalisation worth more than the check: **a fix routinely meets text the fix did not touch.** Every
edit that changes a rule creates a second edit's worth of obligation in the rationales, summaries,
counts, and cross-references that quoted the old rule. Rationales are the usual survivors, and a
stale rationale is worse than a stale rule because it argues for the wrong behaviour rather than
merely stating it. After any rule change, search for prose that explains WHY the old rule existed.

### Losing a finding is worse than misattributing one
A misattributed finding leaves a trace that can be corrected. A dropped finding leaves nothing, so
nobody can detect the loss from the record. Any process that adjudicates findings from multiple
sources needs an explicit completeness check — every filed item appears somewhere in the disposition,
including as an explicit rejection — not merely an accuracy check on the items that survived.
Corollary for the reviewer: keep your own list of what you filed, because you are the only party
positioned to notice your finding vanished.

### A residual neutralised in conduct is not closed
Ruled 2026-09-06. When a known defect is mitigated by an agent agreeing to behave carefully rather
than by changing the artifact, the mitigation is a property of that agent's intention, not of the
system. It evaporates on a lapse of attention, on a long pass, or on any re-run by an agent that
never received the instruction. Record such a mitigation in three parts — the residual, the
mitigation, and the explicit statement that the mitigation is not a property of the artifact —
because a reader seeing only the first two concludes it was fixed.
This is the general case of why rules get written into documents at all: a written rule makes the
error impossible, a briefed one makes it merely detectable. Applies symmetrically to the reviewer's
own promises. If the only thing standing between a design and a known failure is that someone
intends to be careful, the design has not addressed it, and "the team is aware of this" is not a
mitigation in a design document either.
