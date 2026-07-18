# Project review — `demo-profile-service`

*Rendered from [`expected-review.json`](expected-review.json). Every line and
quote below was verified against source by the merge gate before it appeared
here. Reproduce with the command at the bottom.*

**Read-only integrity: passed.** Working tree unchanged outside `.claude/review/`.

---

## Summary

**20 issues from 32 accepted findings; 0 rejected by the grounding gate.**

Six reviewers ran. `accessibility` and `ai-llm` were **not spawned** — this repo
has no user interface and calls no model API, so those areas are *not assessed*
rather than *assessed and clean*.

The shape of this codebase: three unauthenticated HTTP routes over a SQLite
store of personal profiles, with a third-party enrichment call. Both halves of
that sentence are where the high-severity findings are — every route is open,
and the queries behind them are built by string interpolation. A validation
module exists that would have stopped most of it and is imported by nothing.

The suite does not run at all (`npm test` aborts before loading a test file),
and no CI exists to have noticed.

---

## Issues

| | Severity | Conf. | Corrob. | Location | Issue | Standards |
|---|---|---|---|---|---|---|
| I1 | **high** | confirmed | 3 | [routes.js:22](demo-repo/src/routes.js#L22) | `GET /api/profiles` returns every stored profile, unauthenticated | CWE-200 · API3:2023 · ASVS-V14 |
| I2 | **high** | confirmed | 2 | [client.js:3](demo-repo/src/client.js#L3) | Geo API key falls back to a hardcoded literal in tracked source | CWE-798 · ASVS-V13 |
| I3 | **high** | confirmed | 2 | [routes.js:14](demo-repo/src/routes.js#L14) | Request body keys become INSERT column names — injection + mass assignment | CWE-89 · CWE-639 · API3:2023 |
| I4 | **high** | confirmed | 2 | [package.json:11](demo-repo/package.json#L11) | `npm test` aborts before running any test | — |
| I5 | **high** | confirmed | 1 | [routes.js:7](demo-repo/src/routes.js#L7) | SQL injection: `:id` interpolated into a `SELECT` | CWE-89 · ASVS-V1.2 |
| I6 | **high** | confirmed | 1 | [server.js:5](demo-repo/src/server.js#L5) | Every read route reachable unauthenticated | CWE-306 · API1:2023 · ASVS-V8 |
| I7 | **high** | confirmed | 1 | [server.js:8](demo-repo/src/server.js#L8) | `POST /api/profile` writes with no authentication | CWE-306 · CWE-862 · API5:2023 |
| I8 | medium | confirmed | 2 | [client.js:5](demo-repo/src/client.js#L5) | User postcode sent to a third party over cleartext HTTP | CWE-200 · CWE-319 · ASVS-V12 |
| I9 | medium | confirmed | 2 | [client.js:8](demo-repo/src/client.js#L8) | Outbound fetch has no timeout | CWE-770 |
| I10 | medium | confirmed | 2 | [validate.js:5](demo-repo/src/validate.js#L5) | Validation module exists; no handler imports it | CWE-20 · ASVS-V2 |
| I11 | medium | confirmed | 2 | [log.js:2](demo-repo/src/log.js#L2) | Full request body logged; no latency/traffic/error signal at all | CWE-532 · ASVS-V16 |
| I12 | medium | confirmed | 2 | `.github/workflows` *(absent)* | No CI, so the suite gates nothing | Scorecard:CI-Tests |
| I13 | medium | confirmed | 2 | [client.js:16](demo-repo/src/client.js#L16) | `enrich()` swallows every lookup failure in an empty catch | ASVS-V16 |
| I14 | medium | confirmed | 1 | [routes.js:9](demo-repo/src/routes.js#L9) | Driver error text returned verbatim to callers | CWE-209 · API8:2023 |
| I15 | medium | confirmed | 1 | [validate.test.js:3](demo-repo/test/validate.test.js#L3) | Two of three validators are untested | — |
| I16 | medium | confirmed | 1 | `package-lock.json` *(absent)* | No lockfile; transitive tree not reproducible | Scorecard:Pinned-Dependencies |
| I17 | medium | confirmed | 1 | [db.js:27](demo-repo/src/db.js#L27) | Unbounded `SELECT *` serialized to the response | CWE-770 · API4:2023 |
| I18 | low | confirmed | 2 | [server.js:11](demo-repo/src/server.js#L11) | Port and DB path hardcoded, no env override | API8:2023 |
| I19 | low | confirmed | 1 | [db.js:25](demo-repo/src/db.js#L25) | No deletion path exists for stored profiles | ASVS-V14 |
| I20 | low | confirmed | 1 | [package.json:14](demo-repo/package.json#L14) | Stale pins, no dependency-update automation | CWE-1104 · Scorecard:Dependency-Update-Tool |

`Corrob.` is the number of **distinct** reviewer slices that independently cited
the same line. Slices are disjoint, so a reviewer cannot corroborate itself.

## Worked example — I2, and what the gate did with it

```json
{
  "severity": "high",
  "confidence": "confirmed",
  "standard": ["CWE-798", "ASVS-V13"],
  "evidence": [{
    "file": "src/client.js",
    "line": 3,
    "quote": "const GEO_KEY = process.env.GEO_API_KEY || 'sk-demo-2f9a41c07be34d18';"
  }],
  "repro": "$ git log -S 'sk-demo-2f9a41c07be34d18' --oneline\n4204f28 Scaffold repo, ..."
}
```

The merge script reopened `src/client.js`, found that quote at line 3, and kept
the finding. Had the quote not been there, the **whole finding** would have been
discarded — not just the evidence item.

Note what makes it useful rather than boilerplate: not "don't hardcode secrets"
but *this* fallback, at *this* line, plus the consequence a reader would
otherwise miss — the literal is in git history, so deleting the line does not
revoke it and the credential has to be rotated at the provider.

## Tests

| Suite | Command | Status |
|---|---|---|
| unit (node:test) | `npm test` | **fail** — runner aborted, 0 tests executed |
| lint (eslint) | `npm run lint` | **not-run** — bootstrap: `npm install` |
| typecheck | — | **not-run** — no typechecker configured |

`not-run` is reported with the bootstrap command rather than guessed at. The
review never installed anything.

## Remediation plan

Ordered by dependency, not only by severity. `P*` are the diffs in `patches[]`.

1. **Rotate the geo credential at the provider**, then apply `P3`
   (fail closed on missing `GEO_API_KEY`). Rotation first — the key is in git
   history, so the patch alone does not revoke it.
   *Verify:* `git log -S 'sk-demo-' --oneline` and confirm the new key is unset in source.
2. **Fix the test script** (`P5`) before anything else, so every later step has
   a working gate. *Verify:* `npm test` runs and reports 2 passed.
3. **Parameterize both queries** and add a column allowlist (`P1`, `P7`).
   The allowlist must land with the query fix — binding alone cannot secure an
   identifier position. *Verify:* `GET /api/profile/x'%20OR%20'1'='1` returns 404, not a row.
4. **Add authentication and per-object ownership checks** to all three routes.
   No patch offered: this is a design change, not a diff.
   *Verify:* unauthenticated requests to each route return 401.
5. **Wire in the existing validators** (`validate.js`) at the two handlers that
   were written for them. *Verify:* the new tests from step 2 cover both.
6. Then the bounded set: drop the body from logs (`P4`), add a fetch timeout
   (`P8`), add `LIMIT` (`P6`), add CI running `npm test`.

*Proposed only. Nothing here was applied.*

---

```
# reproduce
node scripts/merge-review.mjs \
  --repo examples/demo-repo \
  --in examples/slices \
  --out examples/out
```

`examples/slices/` holds the six reviewers' verbatim JSON from a real run, so
the merge — the part that must be deterministic — is reproducible without
re-running any model.
