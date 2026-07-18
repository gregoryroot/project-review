---
name: project-review
description: Comprehensive, grounded production-readiness review of a whole repo. Six read-only reviewers run in parallel over disjoint slices - plus accessibility and AI/LLM slices when the repo warrants them - hunting against CWE Top 25, OWASP ASVS, the OWASP API and LLM Top 10s, OpenSSF Scorecard and WCAG 2.2. A deterministic script verifies every finding's quote against source and discards what it cannot confirm. Output is eleven sections of JSON plus a remediation plan. Use when asked to review a project, audit a codebase, assess production readiness, or find security, privacy, test, accessibility, performance, maintainability, or infrastructure problems across a repo rather than in a single diff.
---

# Project review

Produce a grounded, repeatable production-readiness review of an entire repo.

This skill is **read-only**. It never edits source, never installs anything,
never sends anything anywhere. Its only writes are under `.claude/review/`, and
one file — `PROJECT-REVIEW.md` — that it writes solely after you approve it.

The design premise: an AI code review fails by being confidently generic. "Add
rate limiting", "improve error handling", "update dependencies" — advice nobody
can act on, indistinguishable from advice about any other repo. Every mechanism
below exists to prevent that. Reviewers propose findings with verbatim quotes; a
deterministic script verifies each quote against the file and **discards any
finding it cannot confirm.** The model proposes, the script decides.

## Arguments

- `--deep` — additionally run production builds and e2e suites. Off by default;
  these are slow and more likely to touch state.
- `--out <dir>` — write artifacts somewhere other than `<repo>/.claude/review/`.
  Use this to keep a review entirely out of the repo under review.
- `--no-memory` — ignore any existing `PROJECT-REVIEW.md` for this run.

## Step 0 — orient

1. Resolve the repo root (`git rev-parse --show-toplevel`). If not a git repo,
   say so and continue with the current directory; the integrity proof in step 4
   will be unavailable, and you must say that in the summary rather than
   silently skipping it.
2. Locate this skill's own directory — you need `reference/` and `reviewers/`
   from it. It is the directory containing this SKILL.md.
3. **Capture the read-only baseline:**
   ```
   git status --porcelain > <out>/baseline.txt
   ```
   Do this before anything else runs. It is what makes the read-only claim
   auditable rather than asserted.

## Step 1 — detect the stack

Follow `reference/stack-detection.md`. Resolve the concrete commands for lint,
typecheck, test, and audit. Prefer scripts defined in the manifest; probe each
tool with `--version` before relying on it.

No recognized stack is a valid outcome: skip command-running, and still produce
a complete ten-key `review.json` with empty finding sets.

## Step 2 — load project memory

If `<repo>/.claude/review/PROJECT-REVIEW.md` exists and `--no-memory` was not
passed, load it per `reference/project-memory.md`.

**Pass reviewers only the `## Stack` and `## Where to look` sections.** Never
the verdicts, never the false-positive fixtures. A reviewer that reads "we
decided X is fine" stops looking at X, including at the bug that appeared next
to X last week. Suppression is the merge script's job, applied *after* a finding
has been independently made and grounded.

## Step 2b — decide the conditional slices

Six reviewers always run. Two more run only when the repo has the markers for
them, because a slice with nothing to review either returns empty (wasted) or
reaches for something to say (worse).

**`accessibility`** — spawn when the repo has a user interface:
`.jsx/.tsx/.vue/.svelte/.astro`, `.html` templates (Jinja, ERB, Blade, Handlebars),
a `components/` tree, or a UI framework in the manifest (React, Vue, Svelte,
Angular, SwiftUI, Compose).

**`ai-llm`** — spawn when the repo talks to a model: an SDK in the manifest
(`@anthropic-ai/sdk`, `openai`, `google-genai`, `langchain`, `llamaindex`,
`transformers`, `ollama`), a call to a model HTTP endpoint, a vector store
client, or files that assemble prompts.

Record which conditional slices you spawned and why in `summary`. A reader
needs to know accessibility was *not assessed* rather than *assessed and clean*
— those are very different reports, and conflating them is exactly the kind of
false reassurance this tool is built to avoid.

## Step 3 — fan out to the reviewers

Spawn them all **in parallel, in a single message** — they are independent, and
serializing them multiplies wall-clock time for no benefit.

Each is a built-in `Explore` subagent. `Explore` is harness-restricted to
everything-except-Edit/Write, which makes read-onlyness **mechanical rather than
honor-system** — a custom agent's read-onlyness is one frontmatter edit away
from silently dying.

**Spawn every reviewer with `model: "opus"`, including the conditional ones.** This is not a default to leave to
chance. The whole value proposition is precision under a doctrine that tells the
agent to return nothing when it has nothing — resisting the pull to pad a clean
slice, copying a quote verbatim instead of paraphrasing it, tracing a parameter
through three files to the query it reaches. Those are exactly the behaviors
that degrade first on a cheaper model, and two of the failures are invisible in
the output: a boilerplate finding that quotes correctly still passes the gate.
The gate catches fabrication, not vacuousness. Only the reviewer can prevent
vacuousness, so it gets the strongest model. Four parallel read-only agents is a
bounded cost; a discredited report is not.

Give each the same prompt skeleton, varying only the doctrine file:

> Read these four files in full before anything else:
> - `<skill-dir>/reference/grounding-rules.md`
> - `<skill-dir>/reference/standards.md`
> - `<skill-dir>/reference/output-schema.md`
> - `<skill-dir>/reviewers/<slice>.md`
>
> Then review the repo at `<repo-root>` according to your doctrine file.
>
> Repo facts already established: `<stack detection results>`
> `<the Stack and Where-to-look sections from project memory, if any>`
> `<--deep is / is not enabled>`
>
> Return **one JSON object and nothing else**, in the shape
> `reference/output-schema.md` specifies. No prose before or after it. An empty
> `findings` array is a good answer on a clean slice — do not pad.

The slices, their doctrine files, and their standards checklists:

| Reviewer | Owns | Hunts against | Runs |
|---|---|---|---|
| `security-appsec` | `security[]` | CWE Top 25 injection/traversal/upload; ASVS V1–V5, V11–V13, V15 | secret greps, `gitleaks` if present, `git log -S` |
| `security-authz-identity` | `security[]` | CWE-862/863/284/306/639; API1/API3/API5; ASVS V6–V10 | route enumeration |
| `privacy-data` | `privacy[]` | CWE-200/532; ASVS V14, V16 | egress and log tracing |
| `tests-correctness` | `tests[]` | — | **sole runner of the suite**, plus typecheck |
| `performance-observability` | `performance[]`, `maintainability[]` | CWE-770; SRE four golden signals | lint only — never the suite |
| `infra-supplychain` | `infra[]` | OpenSSF Scorecard; SLSA; NIST SSDF | dependency audit, CI config, env inventory |
| `accessibility` *(conditional)* | `accessibility[]` | WCAG 2.2 Level AA | static markup review |
| `ai-llm` *(conditional)* | `security[]`, `privacy[]` | OWASP LLM Top 10 (2025) | prompt and tool tracing |

Security is two reviewers, not one, because authorization is the largest real
category in both the CWE Top 25 (five entries) and the API Top 10 (three), and
folded into a general security slice it reliably gets one bullet. Splitting it
is the single highest-value change to the roster.

Only `tests-correctness` runs the suite. Two agents running it concurrently
produces interleaved output and doubled side effects.

**Reviewers cannot write files** — that is the point of using `Explore`. Take
each agent's returned text and write it yourself to
`<out>/slices/<slice-name>.json`, verbatim, without cleaning it up. If a
reviewer returned prose, write the prose: the merge script is built to tolerate
one bad slice and will report the failure explicitly. Do not "fix" a slice by
rewriting it into JSON yourself; that would put you back in the business of
authoring findings, which is the split this design exists to maintain.

## Step 4 — prove nothing was mutated

```
git status --porcelain > <out>/after.txt
```

Compare against the baseline. Any newly-dirty tracked file outside
`.claude/review/` is reported at the top of the report as a **defect in the
review itself**, naming the command that caused it. Do not clean it up — do not
`git checkout` anything. Report it and let the human decide.

## Step 5 — merge

```
node <skill-dir>/scripts/merge-review.mjs \
  --repo <repo-root> \
  --in <out>/slices \
  --out <out> \
  --memory <repo-root>/.claude/review/PROJECT-REVIEW.md \
  --summary <out>/summary.txt \
  --baseline <out>/baseline.txt \
  --after <out>/after.txt
```

The script emits **eleven** keys — the ten in the original contract plus
`accessibility[]`, which is a key rather than a fold into `maintainability[]`
because WCAG findings carry regulatory weight.

Write your cross-domain summary prose to `<out>/summary.txt` first; the script
appends the machine-generated accounting (accepted/rejected counts, suppression
count, integrity result, assumptions) to it.

The script produces `review.json` (the ten-key contract), a timestamped sibling,
and `review-debug.json` (`_rejected`, `_suppressed`, `_assumptions`, `_stale`).

**If Node is unavailable** (a Go or Rust repo with no Node installed): merge in
prose against the checklist in `reference/output-schema.md`, verifying every
quote by reading the file yourself, and stamp the summary with
`"merged without deterministic validation."` Loud, never silent — a reader must
never mistake a hand-merged report for a gated one.

## Step 6 — read `_rejected` before you trust the output

Open `review-debug.json`.

- **Zero rejections on a real repo means the gate is not running.** Investigate
  before presenting anything.
- **A rejection rate above ~50% means the doctrine is too weak** — reviewers are
  guessing at line numbers. That is a doctrine bug worth reporting to the user,
  not something to paper over.

Then spot-check: pick **5 accepted findings at random**, open each `file:line`,
and confirm the quote is really there. Any miss is a merge-gate bug and must be
surfaced, not quietly dropped.

Also check `_standardsFreshness`. If it carries a `note`, one of the standards
in `reference/standards.md` is past the point where a new edition was expected.
**Report it to the user as a maintenance note about this skill — never as a
finding about their repo.** They can run `node scripts/check-standards.mjs` to
see what actually changed. Citations in this report are accurate as of the dates
in that file; do not describe the review as verifying current compliance.

## Step 7 — render the report

Render to the transcript from `review.json` — never from your memory of what the
reviewers said. Order: integrity result, then summary, then `issues[]` ranked,
then per-domain sections, then tests, then patches.

Use clickable `path:line` references. Show severity and confidence on every
issue; `inferred` findings must be visibly marked as such, including the ones
that were downgraded from `high`.

## Step 8 — the remediation plan

A **separate artifact**, derived from `roadmap[]` and `patches[]` — not an
eleventh key in the JSON.

Present it as an ordered sequence. For each step: what to change, which patch
ids apply, what it depends on, and **the command that verifies it landed**.
Order by dependency, not just severity: a patch that changes a function's
signature has to precede the patches that call it.

**Propose and stop.** Do not apply patches. The user asked for a review; if they
want the fixes applied, they will say so, and that is a separate action with a
separate confirmation.

## Step 9 — propose the memory update, then ask

Only now, after the read-only proof has passed, propose the diff to
`<repo>/.claude/review/PROJECT-REVIEW.md`:

- New **Stack** facts learned this run (commands that worked, the non-obvious
  ones especially, and which suites CI actually gates).
- New **Where to look** entries — entry points, PII-touching modules.
- **Stale entries to delete**, from `_stale`.
- **Verdicts and false-positive fixtures only from what the user said in this
  conversation.** You may propose one you heard ("you said that lookup table is
  fixed at build time — record that as a fixture?"). You may never infer one. These suppress
  future findings permanently, and a wrongly-suppressed finding is invisible
  forever.

Show the diff. Stop. Write only on explicit approval.

If `.claude/review/` is gitignored in this repo, that is a supported choice:
write the file if approved, say nothing about the ignore, and never propose
un-ignoring it.

## Step 10 — global doctrine stays hand-approved

If the reviewers kept emitting a boilerplate shape that no repo would want, the
fix is a new row in `reference/grounding-rules.md`'s banned-findings table — not
a per-repo fixture.

**Propose that row as a diff and stop.** Never apply it. A bad global rule
degrades every future review on every repo, silently, and the bar it must clear
is in `CONTRIBUTING.md`: the finding that motivated it, plus evidence it does
not suppress a real class of bug.

## What this skill never does

State this plainly if asked, because anyone sensible will want to know before
running it on their own code:

- Never edits, creates, or deletes source files.
- Never installs dependencies or modifies a lockfile. A suite that needs
  `npm ci` is reported `not-run` with the bootstrap command.
- Never runs `--fix`, `--write`, `--update-snapshots`, `audit fix`.
- Never runs `git stash`, `checkout`, `reset`, or `clean`.
- Never sends repo contents anywhere.
- Writes only `.claude/review/` (or `--out`), plus `PROJECT-REVIEW.md` on
  explicit approval.

**One deliberate trust boundary:** stack detection reads script names out of the
repo's own `package.json` (or equivalent) and runs them. That is the intended
behavior of a review tool — it is how the review runs the same commands CI does
— but it means reviewing a repo you do not trust executes code that repo
controls. Review untrusted code in a sandbox. Nothing from a manifest may reach
a shell through string interpolation; invoke through the package manager's own
script runner.
