# Project Context

## Purpose
<!-- auto-detected from README.md + .claude-plugin/plugin.json, verify -->
project-review is a Claude Code skill and plugin that produces a grounded,
repeatable production-readiness review of a whole repository. Several read-only
reviewers work disjoint slices in parallel, and a deterministic script verifies
every finding's quote against source, discarding anything it cannot confirm. It
exists to prevent the standard AI-review failure mode: confident, generic advice
that would read identically about any other project.

## Tech Stack
<!-- auto-detected from scripts/*.mjs + .claude-plugin/plugin.json, verify -->
Markdown-defined skill (SKILL.md, reviewers/*.md, reference/*.md) plus Node.js
ESM tooling (scripts/*.mjs) with node:test unit tests. JSON plugin and
marketplace manifests. Node >= 18 optional but recommended. Zero runtime
dependencies by design. Version 0.3.0.

## Current Goal (last session: 2026-09-06)
Review this entire repository as a collective set of designs for a "mood
tracking" mobile app idea.

CORRECTED 2026-09-06 17:30. An earlier note in this file claimed no mood-tracker
work was ever committed. That was wrong, and it is retracted. The PRD exists.

Commit e8674e3 ("Add v1 product requirements for a mood tracker app", Gregory
Root, 2026-09-05 21:40:05) added `docs/mood-tracker/PRD-v1.md`, 950 lines and
about 8,000 words. At 21:51:08 the branch was reset to origin/main, leaving that
commit unreferenced. It survived as a dangling object and has been recovered to
the working tree; the recovered file's SHA-256 matches the committed blob
exactly.

The PRD specifies a free, local-first, cross-platform mood tracker for someone
living with treatment-resistant depression: a check-in ladder, an adaptive
prompting policy, a clinician-facing appointment report, an optional
support-partner ("ally") channel at trend-band granularity only, plus safety,
privacy, pairing, data-model, platform, and store-compliance requirements. It
has 19 sections plus an appendix of stated uncertainties.

Note recorded in that commit's own message: the PRD is unrelated to the
project-review skill this repository contains. It landed here because the
session was scoped to this repo and branch, and may belong in its own
repository. That relocation is an open decision for the user, not an assumption
for any agent.

Scope for reviewers: the review target is `docs/mood-tracker/PRD-v1.md` as a
product design document. The surrounding repository is project-review v0.3.0,
the review tooling, and is a separate subject. Do not treat
`examples/demo-repo/` as production code; it is a deliberately flawed fixture.

## Constraints
None stated.

## Role Notes
- team-planner:
- team-implementer:
- team-reviewer:
- team-tester:
- team-critic:
