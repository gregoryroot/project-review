<!-- seeded from project scan -->
# Security critic criteria — project-review

Seeded 2026-09-06 from a scan of the repo at `claude/mood-tracker-requirements-od3gtz`.
Repo is project-review v0.3.0. CORRECTED 2026-09-06: the original seeding said the
branch was "0 commits ahead of `main`, 0 files differing". That was wrong. The branch
carries `docs/mood-tracker/PRD-v1.md` (committed at 646e00d, sha256 a01140bd...79b5).
The criteria below describe the project-review TOOLING only, which is a separate
subject from the PRD.

## What this project actually is
A Claude Code skill/plugin. There is **no running service, no network listener,
no user auth, no database**. Deliverable is Markdown doctrine (`SKILL.md`,
`reviewers/*.md`, `reference/*.md`) plus zero-dependency Node ESM tooling
(`scripts/*.mjs`, node:test). Classic OWASP web categories (A01 broken access
control, A03 SQLi, A07 auth failures) mostly do **not** apply directly; the real
threat model is **untrusted-input processing inside a developer's shell**.

## Authentication mechanism in use
None. No sessions, tokens, JWTs, roles, or permission checks exist anywhere in
this repository. Absence of auth is **not** a finding here. Do not open findings
that presuppose a web app.

## Trust boundaries (the things that actually matter)
1. **Model output -> filesystem.** `evidence[].file` in reviewer JSON is
   attacker/hallucination-controlled string data fed toward `readFileSync`.
   Gate: `safeResolve()` (merge-review.mjs:101) — rejects non-strings, empty,
   NUL bytes, absolute paths, Windows drive paths, and lexical `..` escapes;
   plus `containsRealPath()` (merge-review.mjs:117) — realpath re-check that
   closes the in-repo-symlink bypass. Any change that weakens, reorders, or
   short-circuits these two is a **showstopper (CWE-22 / CWE-59)**.
2. **Untrusted repo content -> reviewer agent context.** Reviewers read arbitrary
   third-party source. Prompt injection in a reviewed repo (LLM01) could try to
   make a reviewer emit crafted `evidence[].file` paths or suppress findings.
   The grounding gate is the compensating control.
3. **Target repo manifest -> command execution.** Stack detection runs script
   names from the reviewed repo's manifest. Documented and intentional per
   `PROJECT-REVIEW.md`; treat expansion of this surface as a finding.
4. **Review artifacts -> disk/VCS.** `review.json` / `review-debug.json` embed
   verbatim quoted source **including any credential a reviewer found**
   (SKILL.md:185-195). Controls: `git check-ignore` warning in SKILL.md, and
   `.gitignore` ignoring `.claude/review/*.json` and `*.md` with an allowlist
   for `PROJECT-REVIEW.md`. Weakening either is CWE-532/CWE-538.

## Input validation approach
- `parseSlice()` (merge-review.mjs:133) hand-walks brace depth with string/escape
  tracking before `JSON.parse` on a bounded slice. No `eval`, no `new Function`,
  no dynamic `import()` anywhere in `scripts/`.
- `verifyEvidence()` (merge-review.mjs:184) validates line is a non-negative
  integer, rejects directories, rejects past-EOF, requires non-empty quote,
  requires `ABSENT:` prefix for line-0 absence claims.
- `check-encoding.mjs:36` uses `execSync('git ls-files')` — a **constant** string
  with no interpolation. Not command injection. Filenames flow into `readFileSync`
  only, never back into a shell.
- `check-standards.mjs` fetches seven fixed URLs, no caller input. Prior verdict:
  no SSRF surface, won't fix. Do not re-litigate without a code change.

## Pre-existing controls to confirm still hold
- `permissions: contents: read` in `.github/workflows/test.yml`.
- GitHub Actions pinned to full SHAs, not floating tags (supply chain / CWE-1357).
- Zero runtime dependencies; no `package.json` at root; no install step in CI.
- Reviewers are read-only (`Explore`), cannot write files (SKILL.md:165).
- `SECURITY.md` exists at root.

## Named checks to apply every cycle
- `path-containment-intact` — safeResolve + containsRealPath unmodified/unbypassed.
- `no-shell-interpolation` — no user/model string reaches execSync/spawn.
- `no-dynamic-eval` — no eval/new Function/dynamic import in scripts/.
- `artifact-leak-warning` — check-ignore warning and gitignore rules present.
- `ci-least-privilege` — workflow permissions read-only, actions SHA-pinned.
- `fixture-not-a-finding` — `examples/demo-repo/` and `*.test.mjs` literals
  (`sk-demo-abc`, `API_KEY`, `BEGIN RSA PRIVATE KEY`) are synthetic. Reporting
  them as real vulnerabilities is itself a defect.
- `no-invented-scope` — findings must cite an artifact that actually exists and
  quote it. Do not infer a running service, database, or auth layer for the
  project-review tooling, which has none.

RETRACTED 2026-09-06: an earlier version of `no-invented-scope` stated that "no
mood-tracking app is present, so no auth/PII/health-data findings can be grounded
here." That is false. `docs/mood-tracker/PRD-v1.md` is present and committed, and
auth, PII, and health-data findings against that document ARE grounded and are in
scope whenever it is the review target. Note the distinction: the PRD is a design
document, so a finding is a flaw in the DESIGN, not a live vulnerability.

## Anti-patterns / known false positives
- Hardcoded key, SQL injection, and missing auth in `examples/demo-repo/` are
  DELIBERATE fixture content. Never a finding.
- Test literals in `scripts/merge-review.test.mjs` and `scripts/tools.test.mjs`
  are synthetic strings for the grounding gate. Never a finding.
- Absence of authentication/authorization is correct for a skill repo.

## Cycle log
(append per invocation)

---

## PRD / design-document review — durable criteria (added 2026-09-06)

Applies whenever the review target is a DESIGN DOCUMENT rather than code, and especially a
local-first app handling health or mental-health data. A finding here is a flaw in the DESIGN, not a
live vulnerability. Severity language should say "if built."

### Named checks
- `clinical-vs-design-boundary` — the sorting axis is MECHANISM vs PSYCHOLOGY, not real-person vs
  hypothetical-person. A design finding traces a mechanism: data reaches a party the design said it
  would not; a promised control does not take effect; state persists after a transition that claims
  to clear it. A clinical finding predicts how a person will think, feel, or respond. Real-vs-
  hypothetical fails to sort, because a clinical generalization about a real POPULATION names no
  individual and reads as hypothetical-user analysis. Test any safety finding with one question:
  what mechanism does this trace? If it cannot answer, it is clinical — strike it yourself.
- `ally-as-adversary` — any support-partner, caregiver, or sharing feature is modeled with the
  paired party as a potential adversary, including coercion and intimate-partner abuse. Restriction
  to coarse granularity (bands, summaries, trends) does not by itself bound disclosure: check timing,
  cadence, absence/non-response, band-transition latency, edit and backfill visibility, and inference
  from repeated low-entropy observations. Coarse data observed often is not coarse.
- `revocation-expressiveness` — for every promised revocation, unpair, delete, or export control, ask
  whether the DATA MODEL can represent it and what remains observable to a formerly-authorized party
  after the transition. Cached, mirrored, and already-delivered data are the usual gap. A revocation
  the model cannot express is a promise the design cannot keep.
- `promise-vs-delivery` — trace user-facing promises to the section that delivers them. A promise
  made in a summary, principles, or anti-goals section and delivered nowhere is the highest-severity
  class in a design review. Anti-goals are promises when they reach a user surface.
- `absence-claims-are-first-class` — an adequacy or completeness finding is an ABSENCE claim. Cite it
  as `ABSENT: <element> — containing requirement: "<verbatim quote>" (L<n>) — searched <range>,
  <search performed>`. An absence claim carries full severity; a review process that caps absence
  findings below its top tier cannot report an underspecified safety section, which is the failure
  mode adequacy review exists to catch.
- `presence-is-not-adequacy` — a verdict scheme with only SPECIFIED/ABSENT lets a presence check
  discharge an adequacy charge. Require a third value (specified-but-insufficient) and require each
  SPECIFIED verdict to tie its quote to the named promise the element serves.
- `stated-uncertainty-is-not-a-defect` — before filing "X is missing," search the WHOLE document, not
  a list of ranges. Authors hedge inline. If the search was partial, write "not found in <ranges
  searched>" — a statement about the search — never "unstated," which is a statement about the author.

### Anti-patterns specific to design-document review
- Filing an uncertainty the author already registered in an open-decisions, risks, or appendix
  section. Check those first; it is the highest false-positive surface in any PRD.
- Re-arguing a scoping decision the author explicitly deferred to their own knowledge. Deference to a
  ship/defer decision does NOT exempt that feature's design from review — separate the two, and frame
  design findings "if built."
- Reporting a review-process metric (citation drift, coverage rate) as if it were a finding about the
  document. The error is the reviewer's; keep it structurally separate in any report.
- Classic OWASP web categories against a local-first design with no server. Absence of auth is not
  automatically a finding; re-identification and unwanted disclosure are the harms that matter.

### Amendment to `clinical-vs-design-boundary` — the coercion carve-out (2026-09-06)

The mechanism/psychology axis as first written bars "predicts how a person responds." Applied
unqualified, that bars COERCION findings, because coercion is by definition realized through a
person's response to pressure — and coercion modeling is mandatory wherever a sharing, ally, or
caregiver feature exists. The axis must therefore carry its qualifier or it disables the threat class
it was written to protect:

> Barred: a claim about how a person responds **as a matter of their condition**.
> In scope: a claim about how a person responds **as a consequence of a mechanism the design creates**
> — observability, pressure, dependency, or the removal of an exit.

Test for the hard case: name the mechanism first. "The ally can observe non-response" is a mechanism.
"A controlling ally can use that observability to compel logging" is its consequence and is in scope.
"Someone with depression will feel guilty about a gap" is a condition claim and is out. If the finding
cannot name the mechanism before it names the feeling, it is clinical.

Corollary for review-process design: any rule that states the bar in two places must state the
qualifier in both. A qualified statement plus an unqualified restatement, with precedence given to
the restatement, silently deletes the carve-out.
