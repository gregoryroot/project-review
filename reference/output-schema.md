# Output schema

Two shapes live here: what a **reviewer returns** (a slice), and what the
**merge script emits** (`review.json`). They are different on purpose — the
reviewer proposes findings, the orchestrator and script decide ranking,
identifiers, and cross-domain structure.

## What a reviewer returns

A reviewer returns **one JSON object and nothing else**. No prose before it, no
explanation after it. Fenced in ```json is tolerated; anything else risks the
whole slice being unparseable.

```json
{
  "slice": "security-privacy",
  "findings": [
    {
      "domain": "security",
      "title": "API key falls back to a hardcoded literal",
      "severity": "high",
      "confidence": "confirmed",
      "detail": "When API_KEY is unset the client silently uses a committed test key rather than failing. The key is in tracked source and in git history.",
      "impact": "Anyone with repo read access holds a working credential; rotation does not revoke this copy.",
      "evidence": [
        { "file": "src/client.ts", "line": 12, "quote": "process.env.API_KEY || 'sk-test-abc123'" }
      ],
      "repro": "git log -S 'sk-test-abc123' --oneline\n8f2a1cd initial import",
      "patch": "--- a/src/client.ts\n+++ b/src/client.ts\n@@\n-const key = process.env.API_KEY || 'sk-test-abc123'\n+const key = process.env.API_KEY\n+if (!key) throw new Error('API_KEY is required')\n"
    }
  ],
  "tests": [],
  "assumptions": [
    "Could not determine whether the committed key is still live; not tested."
  ]
}
```

Field rules:

- `slice` — must match the reviewer's own name. The gate drops findings whose
  `domain` is outside the slice that produced them:

  | Slice | May emit | Spawned |
  |---|---|---|
  | `security-appsec` | `security` | always |
  | `security-authz-identity` | `security` | always |
  | `privacy-data` | `privacy` | always |
  | `tests-correctness` | `tests` | always |
  | `performance-observability` | `performance`, `maintainability` | always |
  | `infra-supplychain` | `infra` | always |
  | `accessibility` | `accessibility` | only with UI markers |
  | `ai-llm` | `security`, `privacy` | only with model-API markers |

- `domain` — one of `security`, `privacy`, `tests`, `accessibility`,
  `performance`, `maintainability`, `infra`.
- `standard` — optional array of up to three published identifiers
  (`["CWE-862", "API1:2023"]`). See `reference/standards.md` for the accepted
  forms. A malformed identifier is dropped and the finding survives: a bad
  footnote is noise, but the grounded defect under it is still real. **A
  citation never substitutes for evidence** — never cite a standard for a defect
  you have not demonstrated at a line in this repo.
- `severity` — `high` | `medium` | `low` | `info`. Definitions are pinned in
  `grounding-rules.md`; do not re-invent them.
- `confidence` — `confirmed` | `inferred`. `inferred` + `high` is downgraded to
  `medium` by the script.
- `detail` — what is wrong, in the specific. Not what category of thing it is.
- `impact` — who gets hurt and how. If you cannot write this without generalities,
  reconsider whether the finding is real.
- `evidence[]` — required, non-empty. `{file, line, quote}`. See
  `grounding-rules.md`; a quote that does not verify kills the finding.
- `repro` — optional but strongly preferred. **Pasted real output**, not a
  description of what output would look like. This is what makes a finding
  `confirmed`.
- `patch` — optional unified diff. Written by the reviewer that understands the
  defect. The merge script hoists it into `patches[]` and assigns an id; do not
  assign one yourself. Must apply against the file as it exists now.
- `tests[]` — only `tests-correctness` populates this; see below. Other
  reviewers return `[]`.
- `assumptions[]` — everything you could not verify. Never a hedged finding.

### `tests[]` entries

```json
{
  "name": "unit (vitest)",
  "command": "npm run test:coverage",
  "status": "pass",
  "summary": "146 passed, 0 failed, 3 skipped in 21.4s",
  "output": "  Test Files  38 passed (38)\n       Tests  146 passed | 3 skipped (149)",
  "coverage": { "statements": 24.1, "branches": 79.0, "functions": 66.2, "lines": 24.1 }
}
```

`status` is `pass` | `fail` | `not-run`. **`not-run` requires
`bootstrap`** — the exact command a human would run first (`npm ci`, `uv sync`).
Never report `pass` or `fail` for a suite you did not execute; that is the
single most damaging thing this tool could get wrong.

## What the merge script emits — `review.json`

Exactly eleven keys, in this order. No twelfth key, ever — debug channels go to
`review-debug.json`.

```json
{
  "summary": "string",
  "issues": [],
  "tests": [],
  "security": [],
  "privacy": [],
  "accessibility": [],
  "performance": [],
  "maintainability": [],
  "infra": [],
  "patches": [],
  "roadmap": []
}
```

`accessibility[]` is a key rather than a fold into `maintainability[]` because
WCAG findings carry regulatory weight and burying them next to duplicated
helpers would be the wrong signal. It is empty — not absent — on repos with no
user interface.

- **`summary`** — prose, non-empty. Written by the orchestrator, then the script
  appends machine-generated sentences: findings accepted / rejected counts, the
  suppression count (`"3 findings suppressed by prior decisions"`), the read-only
  integrity result, and a labeled **Assumptions** paragraph collecting every
  reviewer's `assumptions[]`. If the merge ran without Node, it also carries
  `"merged without deterministic validation."`
- **`issues[]`** — the cross-domain ranked list, synthesized by the orchestrator
  from everything that survived the gate. Each entry carries `id` (`I1..In`),
  `title`, `severity`, `confidence`, `domains[]`, `evidence[]`, `corroboration`
  (count of distinct slices that found it), and `patchIds[]`.
- **`security[]` `privacy[]` `performance[]` `maintainability[]` `infra[]`** —
  the surviving findings, per domain, in the reviewer's shape plus an assigned
  `id` and a back-link to any `issues[]` entry that absorbed it.
- **`tests[]`** — verbatim from `tests-correctness`, ungated (a test result is
  its own evidence).
- **`patches[]`** — hoisted from findings. `{ id: "P1", sourceIssueId, file,
  diff, rationale }`. Byte-identical duplicates dropped.
- **`roadmap[]`** — top 5, collapsed so no two entries touch the same file, with
  any `high` security or privacy issue force-ranked in. Each entry:
  `{ order, issueIds[], action, verify }` where `verify` is the command that
  demonstrates the fix landed.

## `review-debug.json`

Not part of the contract, always written beside `review.json`:

```json
{
  "_rejected": [{ "finding": {}, "reason": "quote not found within line ±3" }],
  "_suppressed": [{ "finding": {}, "matchedEntry": "2026-07-18 · a1b2c3d · lib/catalog.ts · performance · fixed at build time: won't fix" }],
  "_assumptions": [{ "slice": "infra-supplychain", "text": "..." }],
  "_stale": [{ "entry": "...", "reason": "names lib/catalog.ts which no longer exists" }],
  "_integrity": { "baseline": [], "after": [], "newlyDirty": [] }
}
```

`_rejected` is the file to read when the review feels thin. A zero-length
`_rejected` on a real repo means the gate is not running.
