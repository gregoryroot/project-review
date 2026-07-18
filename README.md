# project-review

A Claude Code skill that produces a grounded, repeatable production-readiness
review of a whole repository. Several read-only reviewers work disjoint slices
in parallel, and **a deterministic script verifies every finding's quote against
your source and discards anything it cannot confirm.**

The failure mode this exists to prevent is the one every AI code review has:
confident, generic advice — "add rate limiting", "improve error handling",
"update dependencies" — that nobody can act on and that would read identically
about any other project.

---

## What it looks like

From [`examples/REPORT.md`](examples/REPORT.md), a real run against the
deliberately-flawed fixture in [`examples/demo-repo/`](examples/demo-repo/):

| | Severity | Corrob. | Location | Issue | Standards |
|---|---|---|---|---|---|
| I2 | **high** | 2 | `client.js:3` | Geo API key falls back to a hardcoded literal in tracked source | CWE-798 · ASVS-V13 |
| I3 | **high** | 2 | `routes.js:14` | Request body keys become INSERT column names — injection + mass assignment | CWE-89 · CWE-639 · API3:2023 |
| I6 | **high** | 1 | `server.js:5` | Every read route reachable unauthenticated | CWE-306 · API1:2023 |
| I13 | medium | 2 | `client.js:16` | `enrich()` swallows every lookup failure in an empty catch | ASVS-V16 |

Every row carries a file, a line, and a verbatim quote that was re-checked
against the file before it was allowed into the report. What makes I2 useful is
not "don't hardcode secrets" but the consequence you would otherwise miss: the
literal is in git history, so deleting the line does not revoke it.

## Install

Requires [Claude Code](https://claude.com/claude-code) with subagent support,
and `git`. Node ≥18 is optional but strongly recommended — without it the merge
degrades to a prose merge and says so loudly in the report.

**There is no install step and nothing to `npm install`.** The skill has zero
dependencies, by design: a skill that requires installing three other things
first mostly does not get installed.

```bash
git clone https://github.com/<you>/claude-project-review.git ~/src/claude-project-review

# macOS / Linux
ln -s ~/src/claude-project-review ~/.claude/skills/project-review

# Windows (PowerShell as Administrator)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\project-review" `
         -Target "$HOME\src\claude-project-review"

# Windows without Administrator — a directory junction works identically here
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\project-review" `
         -Target "$HOME\src\claude-project-review"
```

Then, in any repo:

```
/project-review
```

### Options

| Flag | Effect |
|---|---|
| `--deep` | Also run production builds and e2e suites. Off by default; slower and likelier to touch state. |
| `--out <dir>` | Write artifacts somewhere other than `<repo>/.claude/review/` — use this to keep a review entirely out of the repo under review. |
| `--no-memory` | Ignore any existing `PROJECT-REVIEW.md` for this run. |

## What it writes, and what it never writes

This skill executes commands in your repository and reads all of your source.
You should want this section to exist before running it.

**It writes exactly two things:**

- `<repo>/.claude/review/` — `review.json`, a timestamped copy, and
  `review-debug.json`. Redirect with `--out`.
- `<repo>/.claude/review/PROJECT-REVIEW.md` — **only after showing you the diff
  and getting your approval.**

**It never:**

- edits, creates, or deletes any source file;
- installs dependencies or touches a lockfile — a suite needing `npm ci` is
  reported `not-run` with the bootstrap command, never installed;
- runs anything with `--fix`, `--write`, `--update-snapshots`, or `audit fix`;
- runs `git stash`, `checkout`, `reset`, or `clean`;
- sends your code anywhere beyond the model calls Claude Code already makes.

**The artifacts contain verbatim lines from your source.** That is what makes
findings checkable, but it has a consequence worth stating: if a reviewer finds
a credential — including one in a file you deliberately left untracked, like a
local `.env` — that value is quoted into `review.json` and `review-debug.json`
as plaintext, in your working tree, where a later `git add .` would commit it.
Rotating the original does not revoke those copies. Either gitignore
`.claude/review/`, or use `--out` to keep artifacts outside the repository
entirely.

The read-only claim is **audited, not asserted**: the skill snapshots
`git status --porcelain` before the review and diffs it afterward. Any tracked
file that became dirty is reported at the top of the report as a defect *in the
review itself*, naming the command responsible.

### One deliberate trust boundary

Stack detection reads script names out of your `package.json` (or equivalent)
and runs them. That is the intended behavior — it is how the review runs the
same commands your CI does — but it means **reviewing a repository you do not
trust executes code that repository controls.** Review untrusted code in a
sandbox. Nothing from a manifest reaches a shell through string interpolation;
scripts are invoked through the package manager's own runner.

## How grounding works

Reviewers propose findings. A script decides which survive. That split is the
whole design — a model merging its own subagents' output will not delete a
plausible-sounding finding for lacking a valid line number.

Every finding must carry `{file, line, quote}` where `quote` is a **verbatim
substring** of that line. The merge script reopens the file and looks for it
within `line ± 3`, whitespace-normalized. If it is not there, **the entire
finding is discarded** — not the evidence item, the finding.

A finding is also dropped when: it has no evidence; the file does not exist; the
line is past end-of-file; its domain is outside the slice that produced it; or
its evidence path escapes the repository root. An `inferred` finding claiming
`high` severity is **downgraded to medium rather than dropped**.

Everything dropped is written to `review-debug.json` with a reason. Read it. A
zero-length `_rejected` on a real repo means the gate is not running — the skill
says so itself rather than presenting a clean-looking report.

### Precision over recall

A false finding costs a debugging session *and* discredits every true finding
next to it; after two invented bugs the report gets closed unread. A missed
finding is one more the team was already living with. So the doctrine reports
only what it would defend to the person who wrote the line, and
`{"findings": []}` on a clean slice is a good answer.

## The reviewers

Six always run. Two more run only when the repository has the markers for them,
so a backend service pays nothing for the accessibility slice.

| Reviewer | Owns | Hunts against |
|---|---|---|
| `security-appsec` | `security[]` | CWE Top 25 injection/traversal/upload/crypto; ASVS V1–V5, V11–V13 |
| `security-authz-identity` | `security[]` | CWE-862/863/284/306/639; API1/API3/API5; ASVS V6–V10 |
| `privacy-data` | `privacy[]` | CWE-200/532; ASVS V14, V16 |
| `tests-correctness` | `tests[]` | sole runner of your suite |
| `performance-observability` | `performance[]`, `maintainability[]` | CWE-770; SRE four golden signals |
| `infra-supplychain` | `infra[]` | OpenSSF Scorecard; SLSA; NIST SSDF |
| `accessibility` *(conditional)* | `accessibility[]` | WCAG 2.2 Level AA |
| `ai-llm` *(conditional)* | `security[]`, `privacy[]` | OWASP Top 10 for LLM Apps (2025) |

Security is two reviewers because authorization is five of the CWE Top 25 and
three of the ten API risks; folded into a general security slice it reliably
gets one bullet.

Reviewers are built-in `Explore` subagents, which are **harness-restricted to
everything-except-Edit/Write** — read-onlyness is mechanical, not
honor-system — spawned on Opus. They are doctrine files inside the skill
directory rather than registered agents, so the unit travels intact when you
move it to another machine.

## Output

Eleven keys, stable order:

```
summary  issues  tests  security  privacy  accessibility
performance  maintainability  infra  patches  roadmap
```

`issues[]` is the cross-domain ranked list; per-domain arrays carry the detail;
`patches[]` holds copy-paste unified diffs authored by the reviewer that
understood the defect; `roadmap[]` is the top five collapsed so no two entries
touch the same file. Debug channels live in a sibling `review-debug.json` so the
contract stays clean.

**Fixes ship as diffs in `patches[]`. The skill proposes and stops.** It does
not apply anything.

## Standards, and what "grounded in" honestly means

Findings may cite `CWE-89`, `ASVS-V8.1`, `API1:2023`, `LLM01:2025`,
`WCAG-2.5.8`, `Scorecard:Token-Permissions`, `SLSA-Build-L2`, `SSDF-PW.4.1`.
The index and the date each was verified live in
[`reference/standards.md`](reference/standards.md).

**Citations are accurate as of those dates. This tool does not perform live
compliance verification, and you should not describe its output as proving
conformance to anything.** Doctrine hunts defect *shapes*; identifiers are
metadata attached afterward, so when a standard renumbers you lose a footnote,
not a defect.

The index does not update itself — doctrine that rewrites itself from the
network is remote-controlled behavior change, and a review that reaches the
network stops being reproducible. Instead: an offline tripwire notes when a
standard is past its expected revision cadence, and
`node scripts/check-standards.mjs` fetches current editions and **proposes** a
diff for a human to approve.

## Project memory

After the first run the skill offers to write
`<repo>/.claude/review/PROJECT-REVIEW.md` — committed by default, so verdicts
are a team artifact arguable in a pull request.

**It stores calibration and verdicts, never open findings.** A cached finding is
a finding no longer grounded; every finding is re-derived from source every run.
What persists is what is expensive to re-derive and stable between runs: which
commands actually work here, which suites CI really gates, where the
PII-touching modules are, and which findings a human has already decided about.

Reviewers never see the verdicts — a reviewer that reads "we decided X is fine"
stops looking at X. Suppression is applied by the merge script, after the
finding was independently made, and the count appears in `summary`
("3 findings suppressed by prior decisions") with the detail in
`review-debug.json`. Never silent.

Entries carry a date and commit SHA and are validated on load; one naming a file
that no longer exists is flagged stale and not applied. A verdict never
suppresses a `high` finding.

Prefer not to carry the file? Gitignore `.claude/review/` — the skill behaves
correctly and quietly when you do.

## Limitations

- **It reviews source, and mostly does not execute your system.** It runs your
  test suite, lint, typecheck, and dependency audit; it does not exercise
  routes, drive a browser, or test with a screen reader. Accessibility findings
  in particular are static-markup findings — real conformance needs assistive
  technology and a rendered page, and the doctrine says so rather than implying
  otherwise.
- **Recall is deliberately traded for precision.** It will miss real defects. It
  is built so that what it does report is worth reading.
- Findings about repository settings that live in your forge rather than your
  files (branch protection, required reviews) are not assessed, and say so.
- Without Node the merge degrades to prose and the report is stamped
  "merged without deterministic validation."
- One reviewer returning unparseable output does not sink the run — the other
  slices survive and the failure is named in `summary`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Most of it is about doctrine: a new row
in the banned-findings table needs the finding that motivated it and evidence it
does not suppress a real class of bug, because a rule that wrongly withholds a
finding is invisible and permanent.

```bash
node --test scripts/merge-review.test.mjs   # the grounding gate
node scripts/check-standards.mjs            # propose a standards refresh
```

## License

MIT — see [LICENSE](LICENSE).
