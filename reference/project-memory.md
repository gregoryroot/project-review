# Project memory — `.claude/review/PROJECT-REVIEW.md`

A human-readable file, ~100 lines max, that lets each review start where the
last one ended instead of re-deriving the same stack facts and re-raising the
same findings a human already dismissed.

**Committed by default.** Verdicts are a team artifact — arguable in a pull
request, not machine-local trivia. A repo that would rather not carry it can
gitignore `.claude/review/` wholesale; the skill must then behave correctly and
quietly (no warnings, no attempt to un-ignore it, memory simply unavailable that
run).

## The governing rule

**The memory stores calibration and verdicts. It never stores open findings.**

A cached finding is a finding that is no longer grounded. The whole design rests
on every finding being re-derived from source on every run, with a verbatim
quote that verifies today. Persist only what is expensive to re-derive and
stable between runs.

## Format

Five sections, exactly these headings. Anything else is ignored on load.

```markdown
# Project review memory

## Stack
<!-- commands that actually work here, including the non-obvious ones -->
- typecheck: `npx tsc --noEmit` (no npm script exists)
- test: `npm run test:coverage` — v8, thresholds stmts 22 / branches 78 / funcs 65 / lines 22
- e2e: `npm run e2e` — NOT gated in CI, needs an uncommitted dataset
- audit: `npm audit --json --omit=dev`

## Where to look
<!-- the earned map: entry points, PII-touching modules, trust boundaries -->
- third-party fetches: `lib/sources/*`
- user data: localStorage only, via `lib/store.ts`
- no server-side persistence anywhere

## Verdicts
<!-- decided by a human; do not re-raise -->
- 2026-07-18 · a1b2c3d · `lib/fees.ts` · maintainability · fee estimate is approximate: won't fix, no authoritative source exists

## False-positive fixtures
<!-- findings a human rejected as wrong; suppress permanently -->
- 2026-07-18 · a1b2c3d · `lib/catalog.ts` · performance · "unbounded query": the array is a build-time constant of 180 entries

## Run history
<!-- how long this project's reviews actually take; DATE · SHA · DURATION · N slices · MODE -->
- 2026-07-18 · a1b2c3d · 11m42s · 8 slices · standard
- 2026-07-16 · 9f6c312 · 38m10s · 8 slices · deep
```

Every entry in **Verdicts** and **False-positive fixtures** is
`DATE · SHA · FILE · DOMAIN · TEXT`. All five fields required. An entry missing
any of them is malformed: ignore it and list it in `_stale`.

### Run history

The one section that is neither calibration about the code nor a verdict: it
records how long this project's reviews actually take, so the next run can tell
the user when to come back.

`standard` and `deep` runs are tracked separately and never averaged together —
a run that executed a Playwright suite is not evidence about one that skipped
it. The estimate is the **median of the last three same-mode runs**, not the
mean, so one flaky suite or one loaded machine does not distort every future
prediction.

**Keep five entries. Drop the rest.** A duration from twenty commits ago
describes a project that no longer exists, which is the same staleness rule the
rest of this file lives under.

**With no prior run, the answer is "unknown."** There is no generic model of how
long a review should take — a docs repo and a large application differ by hours
— and a fabricated estimate is worse than an absent one, because the user plans
around it. See `scripts/run-timing.mjs`.

## Three rules that make it safe

### 1. Reviewers are blind to it — except Stack and Where-to-look

Pass reviewers the **Stack** and **Where to look** sections only. Never the
verdicts, never the fixtures.

A reviewer that reads "we decided X is fine" stops looking at X — including at
the new bug that appeared next to X last week. Suppression is the merge script's
job, applied after the finding has been independently made and grounded. Same
propose/decide split as everything else here: the agent proposes an instance,
the mechanical layer decides.

Suppression is **visible, never silent**. The count lands in `summary`
("3 findings suppressed by prior decisions") and every suppressed finding is
written to `_suppressed[]` in `review-debug.json` with the entry that matched it.

### 2. Every entry carries a date and a SHA, and is validated on load

On load, for each entry: does the `FILE` it names still exist? For **Stack**
entries, does the command it names still resolve (script present in the
manifest, binary answers `--version`)?

If not, the entry is **flagged stale and not used** — listed in `_stale` with
the reason, and surfaced to the human at the end of the run as a proposed
deletion.

A memory that outlives its subject is worse than no memory: it reports on a
system that no longer exists, with the full confidence of something written
down. Calibration tuned against a file that has since been deleted is exactly
the trap this rule exists to catch.

### 3. Suppression matches on the anchor, not the title

A fixture suppresses a new finding only when **all** hold:

- same `file` (repo-relative, normalized), and
- same `domain`, and
- the file still exists.

Never match on title. Four reviewers write four different titles for one leaked
key; a title match would suppress one wording and let three through, which is
worse than no suppression at all.

Deliberately, a fixture does **not** match on line number. Code moves. But it
also does not match across files: a fixture cannot suppress a finding in code
that has since changed identity.

Nothing here suppresses a `high` severity finding. If a prior verdict covers
something that now comes back `high`, the finding is kept and annotated
`"a prior verdict covers this file; severity increased since"`. A verdict is a
decision about a known risk, not a permanent waiver on a file.

## Writing it is the last step, and requires confirmation

During the review itself **nothing is written at all** — that is what keeps the
git-status integrity proof meaningful.

After the report is rendered and the read-only proof has passed, the skill:

1. Shows the proposed memory diff — new Stack facts learned, stale entries to
   delete, new verdicts recorded from what the human said during this run.
2. Stops and asks.
3. Writes only on approval.

New **verdicts** and **false-positive fixtures** are never authored by the skill
on its own initiative. They record a decision a human made, in this
conversation, in words. The skill may propose one it heard ("you said that lookup table is
fixed at build time — record that as a fixture?"); it may not infer one.

## Global doctrine stays hand-approved

When a lesson generalizes past one repo — the reviewers keep emitting a
boilerplate shape nobody wants — the right fix is a new row in
`reference/grounding-rules.md`, not a per-repo fixture.

The skill **proposes that row as a diff and stops.** It does not apply it.

A bad global rule silently degrades every future review on every repo, and a
wrongly-suppressed finding is invisible and permanent: nobody files a bug about
the defect they were never told about. See `CONTRIBUTING.md` for the bar a new
row has to clear.
