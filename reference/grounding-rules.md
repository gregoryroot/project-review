# Grounding rules

Every reviewer reads this file before it reads any source. It defines what
counts as a finding. The merge script enforces the mechanical parts of it; the
parts it cannot enforce are on you.

## The asymmetry

A false finding is not a small cost. It burns a debugging session on a bug that
was never there, and — worse — it discredits every true finding sitting next to
it. Two invented bugs and the report gets closed unread; the real high-severity
item on line 40 dies with it.

A missed finding costs much less. It is one more of the many the team was
already living with, and the next run can still catch it.

So: **precision over recall, always.** When you are unsure, it is not a defect.
Report only what you would defend, out loud, to the person who wrote the line.

This is why padding is worse than silence. A slice with nothing wrong in it
should come back empty. `{"findings": []}` is a good answer and a common one.

## Every finding names a line

A finding without an anchor is an opinion. The schema requires:

```json
"evidence": [{ "file": "src/api/profile.ts", "line": 14, "quote": "const key = process.env.API_KEY || 'sk-test-abc123'" }]
```

- `file` — repo-relative, forward slashes, always.
- `line` — 1-indexed, the line the quote starts on.
- `quote` — a **verbatim substring of that line. Copy it. Do not retype it, do
  not summarize it, do not fix its formatting.**

The merge script re-opens the file and searches for `quote` within `line ± 3`,
whitespace-normalized. If it is not there, **the entire finding is discarded** —
not the evidence item, the finding. One bad quote and the whole thing goes.
That is deliberate: a finding you could not quote correctly is a finding you did
not really read.

Multiple evidence items are welcome when a defect spans files (the handler and
the query it reaches). All of them must verify.

### Findings about an absence

Some real defects are things that are not there: no CI workflow, no
`.env.example`, no test file for an exported module. Cite the search that proves
the absence:

```json
"evidence": [{ "file": ".github/workflows", "line": 0, "quote": "ABSENT: glob '.github/workflows/*.{yml,yaml}' returned 0 files" }]
```

`line: 0` puts the gate into absence mode: it verifies the path genuinely does
not exist, and rejects the finding if it does. Do not use `line: 0` to dodge
quoting something that exists.

## Banned findings

These are the shapes that make a review worthless. Each is banned **as written**
— the right-hand column is the same concern stated so that someone can act on it
this afternoon. If you cannot fill in the right-hand column, you do not have a
finding yet.

| Banned as written | Admissible only as |
|---|---|
| "Add rate limiting" | "`POST /api/profile` (`route.ts:14`) has no limiter; an unauthenticated caller can enumerate profiles by id" |
| "Add input validation" | names the handler, the specific unvalidated parameter, and the query / filesystem call / exec it reaches |
| "Improve error handling" | names the `catch {}` that swallows the error, at its line, and what becomes unobservable because of it |
| "Add tests" | names the untested exported function and the specific uncovered branch |
| "Update dependencies" | names the package, the installed version, and the advisory id from real audit output |
| "Use HTTPS" / "don't log secrets" | names the URL literal or the log call, at its line |
| "Consider adding types" | names the `any` and the call site that would have been caught |
| "This could be refactored for readability" | not admissible in any form — see maintainability guidance in the reviewer files |

The table is not exhaustive. The test it encodes is: **does the finding name a
thing that exists in this repo, at a place, that a reader could go look at?** If
it would read identically pasted into a different project, delete it.

## Confidence

Every finding carries `confidence`:

- `confirmed` — you read the line, or you ran the command and pasted its output
  into `repro`. You are asserting this is true of this code right now.
- `inferred` — the code strongly suggests it, but you did not demonstrate it.
  A path you traced but did not execute. A dependency you believe is reachable.

**An `inferred` finding may not be `high` severity.** `high` is reserved for
what you demonstrated. The merge script downgrades `inferred` + `high` to
`medium` rather than dropping it, and notes the downgrade.

## Severity

Pinned here so four reviewers rank on one scale. Rank the defect, not your
enthusiasm for fixing it.

- **`high`** — exploitable, data-losing, or already broken in production paths.
  A leaked credential in tracked source. Unauthenticated write to user data.
  A test suite that does not run at all. Requires `confidence: confirmed`.
- **`medium`** — a real defect with a bounded blast radius, or a high-severity
  shape that needs a precondition you could not confirm. Missing validation on
  an authenticated-only route. A dependency advisory with no known reachable
  call path.
- **`low`** — correct today, fragile tomorrow. Duplication that has already
  drifted once. A missing test for a branch that handles money.
- **`info`** — worth knowing, not worth scheduling.

If you are choosing between two levels, take the lower one. The report's
credibility is the product's whole value.

## Assumptions go in the assumptions channel

Anything you could not verify — a command you could not run, a config you
inferred, a dependency you could not resolve — goes in `assumptions[]`, never
into `findings[]` as a hedged finding. "It appears that X may not be validated"
is not a finding; it is an assumption, and it belongs where the reader knows to
discount it.

This channel is what lets the findings list stay confident. Use it freely.

## What you never do

- Never edit, create, or delete a file in the repo under review.
- Never install anything, never run a package manager's install/update/tidy, never
  run anything with `--fix`, `--write`, or `--update-snapshots`.
- Never invent a line number to satisfy the schema. An unquotable finding is a
  dropped finding, and dropping it is the correct outcome.
- Never report a suite as passing or failing that you did not run. Report it
  `not-run` with the command that would run it.
