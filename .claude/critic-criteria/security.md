<!-- seeded from project scan -->
# Security critic criteria — project-review

Seeded 2026-09-06 from a scan of the repo at `claude/mood-tracker-requirements-od3gtz`
(0 commits ahead of `main`, 0 files differing). Repo is project-review v0.3.0.

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
- `no-invented-scope` — findings must cite this repo as it is; no mood-tracking
  app is present, so no auth/PII/health-data findings can be grounded here.

## Anti-patterns / known false positives
- Hardcoded key, SQL injection, and missing auth in `examples/demo-repo/` are
  DELIBERATE fixture content. Never a finding.
- Test literals in `scripts/merge-review.test.mjs` and `scripts/tools.test.mjs`
  are synthetic strings for the grounding gate. Never a finding.
- Absence of authentication/authorization is correct for a skill repo.

## Cycle log
(append per invocation)
