# Changelog

Semver applies to the skill as a whole. **Doctrine changes are user-visible
changes** — they alter what gets reported, so anyone whose findings shift
between versions should be able to read here why.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Run timestamps and a duration estimate.** The skill now prints when a review
  started and when it is expected to finish, then prints the finish time and
  elapsed duration when it completes. The estimate is the median of the last
  three same-mode runs recorded in the project memory's new `## Run history`
  section — `standard` and `deep` runs are tracked separately and never
  averaged, since a run that executed a Playwright suite is not evidence about
  one that skipped it. **With no prior run the answer is "unknown"**: there is
  no generic model of how long a review should take, and a fabricated estimate
  is worse than an absent one because the user plans around it.
- `scripts/check-encoding.mjs`, in CI. Catches UTF-8-read-as-ANSI mojibake and
  literal `\r\n` escapes in tracked text — damage that is nearly invisible in a
  diff and lands in doctrine that both humans and models read.

### Changed

- **Reviewer output now lands in a per-run `runs/<timestamp>/` folder** rather
  than a shared `slices/`. Artifacts were already isolated between projects
  (every path derives from the repo root), but two reviews of the *same* repo at
  once shared one slice directory, and the merge globs it — so one run could
  merge the other's output and produce a report describing two different moments
  of the codebase.

## [0.1.0] — 2026-07-18

First working version.

### Added

- **The grounding gate** (`scripts/merge-review.mjs`). Reviewers propose
  findings; a deterministic script decides which survive. A finding whose
  verbatim quote cannot be located in the cited file within `line ± 3` is
  discarded entirely. Also drops findings with no evidence, a line past EOF, a
  domain outside the producing slice, or an evidence path that escapes the
  repository root. `inferred` + `high` is downgraded to `medium` rather than
  dropped. Everything dropped is recorded with a reason in
  `review-debug.json`.
- **Eight reviewers**, six always spawned and two conditional:
  `security-appsec`, `security-authz-identity`, `privacy-data`,
  `tests-correctness`, `performance-observability`, `infra-supplychain`, plus
  `accessibility` (on UI markers) and `ai-llm` (on model-API markers). All
  spawn as read-only `Explore` subagents on Opus.
- **Standards grounding** (`reference/standards.md`) against CWE Top 25 (2025),
  OWASP ASVS 5.0.0, OWASP API Security Top 10 (2023), OWASP Top 10 for LLM
  Applications (2025), OpenSSF Scorecard 5.5.0, SLSA v1.0, NIST SSDF, WCAG 2.2,
  and the Google SRE golden signals. Findings carry an optional `standard[]`
  of up to three identifiers; a malformed identifier is stripped and the
  finding survives.
- **Standards staleness tripwire** (`scripts/standards-freshness.mjs`) —
  offline, no network. Compares each standard against its expected revision
  cadence and emits a maintenance note in `review-debug.json`. It is a note
  about this skill, never a finding about the repository under review.
- **Opt-in standards refresh** (`scripts/check-standards.mjs`) — fetches
  current editions and proposes a diff for hand approval. Never runs during a
  review and never edits anything itself.
- **Project memory** (`.claude/review/PROJECT-REVIEW.md`) storing calibration
  and verdicts, never open findings. Reviewers are blind to the verdicts;
  suppression is applied by the merge script, counted in `summary`, and
  itemized in `review-debug.json`. Entries are date- and SHA-stamped and
  validated on load; a verdict never suppresses a `high` finding.
- **Read-only integrity proof.** `git status --porcelain` is captured before
  the review and diffed afterward; any newly-dirty tracked file is reported as
  a defect in the review itself, naming the responsible command.
- `examples/demo-repo/` — an eight-file deliberately-flawed fixture, its six
  reviewer slices from a real run, the `expected-review.json` they produce, and
  a rendered `REPORT.md`.
- CI across ubuntu/macos/windows on Node 18/20/22, running the gate's unit
  tests and asserting the demo fixture reproduces byte-for-byte.

### Notes on decisions that shaped the output

- **Security is two reviewers, not one.** Authorization is five of the 2025 CWE
  Top 25 (862, 863, 284, 306, 639) and three of the ten API risks (object,
  property, and function level). Inside a general security slice it reliably
  received one bullet. Splitting it was the single highest-value change to the
  roster.
- **The output contract is eleven keys, not the ten originally planned.**
  `accessibility[]` was added rather than folding WCAG findings into
  `maintainability[]`, which would have buried the findings that carry
  regulatory weight next to notes about duplicated helpers.
- **Clustering is exact-line, not a five-line bucket.** The original bucketing
  merged distinct defects that merely shared a neighborhood: in a nineteen-line
  module, a hardcoded credential, a plaintext base URL, and a missing fetch
  timeout collapsed into one issue that inherited the worst severity and the
  union of citations — producing a credential finding tagged CWE-770.
  Over-merging is the worse failure. Two entries for one defect is untidy; one
  entry misdescribing three defects is wrong as stated, and discredits the
  report the way an invented finding would.
- **The standards index does not update itself.** Doctrine that rewrites itself
  from the network is remote-controlled behavior change, and a review that
  reaches the network stops being reproducible — which would also retire
  `expected-review.json` as a regression test.
