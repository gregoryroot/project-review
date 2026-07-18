# Project review memory

## Stack
- test (gate): `node --test scripts/merge-review.test.mjs` — 50 tests, no runner script exists
- test (tools): `node --test scripts/tools.test.mjs` — symlink cases skip on Windows, run on ubuntu/macos
- regression: `node scripts/merge-review.mjs --repo examples/demo-repo --in examples/slices --out <tmp>` then `node scripts/assert-fixture.mjs <tmp>/review.json examples/expected-review.json`
- encoding: `node scripts/check-encoding.mjs`
- standards refresh: `node scripts/check-standards.mjs` — network, manual only, never during a review
- no package.json, no lint, no typecheck, zero dependencies — all deliberate
- CI gates all four checks on ubuntu/macos/windows x Node 18/20/22

## Where to look
- trust boundary: `safeResolve` + `containsRealPath` in `scripts/merge-review.mjs` — the only containment between model-supplied `evidence[].file` and `readFileSync`
- second boundary: stack detection runs script names from a target repo's manifest (documented, intentional)
- artifacts embed verbatim source quotes: `review.json`, `review-debug.json`
- doctrine that changes output: `reference/grounding-rules.md`, `reference/standards.md`, `reviewers/*.md`
- `examples/demo-repo/` is a deliberately flawed fixture — never review it as source

## Verdicts
- 2026-07-18 · 9f6c312 · scripts/check-standards.mjs · infra · outbound fetch to seven fixed URLs is intended and cannot take caller input: no SSRF surface, won't fix
- 2026-07-18 · 9f6c312 · scripts/merge-review.mjs · performance · verifyEvidence re-reads a file per evidence item with no cache: accepted, input is bounded by reviewer output and the sibling step is eight parallel Opus agents

## False-positive fixtures
- 2026-07-18 · 9f6c312 · scripts/merge-review.test.mjs · security · "hardcoded credential": the API_KEY and sk-demo literals are synthetic fixtures feeding the grounding gate, not real secrets
