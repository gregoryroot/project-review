# Security policy

## Reporting a vulnerability

Report security issues **privately**, via GitHub's private vulnerability
reporting (the **Security** tab → **Report a vulnerability**), not in a public
issue.

## What matters most here

This skill runs commands inside other people's repositories and reads all of
their source, so the interesting bugs are about containment rather than about
this repository's own data.

**`safeResolve` in `scripts/merge-review.mjs` is the primary boundary.** It is
the only thing between a model-supplied `evidence[].file` string and
`readFileSync`. A containment bypass there turns the grounding gate — which
exists to *stop* hallucination — into an arbitrary-file-read primitive against
whatever repository is being reviewed. Treat any bypass as high severity,
including indirect ones (symlinks, junctions, case-insensitive path collisions,
Unicode normalization).

Also in scope:

- **Command construction from repo-controlled data.** Stack detection reads
  script names out of a target repo's manifest and runs them. That is intended
  and documented, but anything that lets manifest content reach a shell through
  string interpolation rather than the package manager's own script runner is a
  vulnerability.
- **Artifact contents.** `review.json` and `review-debug.json` embed verbatim
  quoted lines from the reviewed source. A path that causes material from
  outside the repository — or from files the owner deliberately kept untracked —
  to be copied into those artifacts is in scope.
- **Anything that causes a write outside `.claude/review/`** (or `--out`).

Out of scope: findings this tool produces about *your* code (that is the tool
working), and the deliberate defects in `examples/demo-repo/`, which are fixture
content.

## Dependencies

This project has zero runtime dependencies and no manifest, so there is no
dependency-advisory surface. GitHub Actions are pinned to commit SHAs and
tracked by Dependabot.
