# Contributing

Most of this repository is doctrine, not code. The bar for changing doctrine is
higher than the bar for changing the script, because doctrine changes what every
future review on every repository reports, silently, and nobody files a bug
about a finding they were never shown.

## Running things

```bash
node --test scripts/merge-review.test.mjs   # the grounding gate
node scripts/assert-fixture.mjs <(node scripts/merge-review.mjs \
  --repo examples/demo-repo --in examples/slices --out /tmp/out; \
  cat /tmp/out/review.json) examples/expected-review.json
node scripts/check-standards.mjs            # propose a standards refresh
```

No dependencies, no build. Keep it that way — the zero-install property is a
feature, and adding one dependency to a review tool costs every user more than
it saves us.

## Changing the merge script

The gate is the one component whose failure is **invisible in the output**: if
it stops verifying quotes, every review still looks fine. Every change to
`acceptFindings`, `verifyEvidence`, `clusterFindings`, or `suppress` needs a
test, and the test must be able to fail.

Two properties are load-bearing and must not regress:

- **Path containment.** `evidence[].file` comes from model output.
  `safeResolve` is the only thing between that string and `readFileSync`. The
  gate that exists to stop hallucination must never become an arbitrary-file-read
  primitive.
- **A total order in ranking.** `rankIssues` tiebreaks down to path and line so
  the same input always produces identical output. `examples/expected-review.json`
  is asserted byte-for-byte in CI across three platforms; a nondeterministic
  ranking would flake it.

If your change alters the output, re-run the merge, commit the new
`examples/expected-review.json`, and **say in the commit message what changed
about the output and why.** A fixture updated silently is a fixture that has
stopped testing anything.

## Adding a row to the banned-findings table

`reference/grounding-rules.md` carries the table of finding shapes that are
rejected as written. It is the highest-leverage file here, and the most
dangerous to edit.

A pull request adding a row must include:

1. **The finding that motivated it.** A real, verbatim example the reviewers
   actually emitted — not a hypothetical. Rules written against imagined output
   suppress imagined problems.
2. **The admissible form.** What the same concern looks like when it is
   actionable. If you cannot write the right-hand column, the shape is not
   banned, it is just under-specified — and the fix is guidance, not a ban.
3. **Evidence it does not over-suppress.** Show that the row would not have
   withheld a real defect. This is the part people skip and it is the reason the
   requirement exists: a false positive in a *rule* is invisible and permanent.
   Nobody reports the finding they never saw.

The asymmetry that governs findings governs rules too, one level up. A rule that
wrongly withholds costs more than a rule that lets some noise through, because
noise is visible and fixable.

## Changing reviewer doctrine

Each `reviewers/*.md` carries a "do not report" section. **Treat it as equal in
importance to the hunting order** — most of the precision in this tool comes
from what reviewers decline to say. When you add a hunting item, ask what
false positive it invites and write that down too.

Doctrine files carry **no frontmatter**, deliberately, so they can never be
mistaken for installable agents.

Changing a reviewer's slice boundaries means changing `SLICE_DOMAINS` in the
merge script, the table in `reference/output-schema.md`, the table in
`SKILL.md`, and the one in `README.md`. All four, or the gate starts silently
dropping findings as off-slice.

## Adding a reviewer

Justify it against the alternative of deepening an existing one. The argument
that carried `security-authz-identity` was measurable: authorization is five of
the 2025 CWE Top 25 and three of the ten API risks, and inside a general
security slice it got one bullet.

If the slice is only relevant to some repositories, make it **conditional** —
spawned on markers, like `accessibility` and `ai-llm`. A slice with nothing to
review either returns empty, which wastes a model call, or reaches for something
to say, which is worse.

## Updating standards

Run `node scripts/check-standards.mjs`. It proposes; you decide.

Never wire this into a review, into CI as an auto-commit, or into anything that
applies its output automatically. Doctrine that updates itself from a remote
source means an edit to a page somewhere changes what this tool reports in every
repository it runs on.

When you accept a standards change: update the prose section (identifiers get
renumbered, added, and retired), check whether any reviewer's hunting order
should change, update the Edition and Checked cells in the Freshness table, and
**add a CHANGELOG entry** — a user whose findings changed is owed the reason.

## Commit and PR conventions

Explain the *why* in the body, especially the tradeoff you chose against. The
commit history here is meant to be readable as a design record; several
decisions in this repo are only defensible with their reasoning attached, and
the next person to touch them will need it.

Semver applies to the skill as a whole. Doctrine changes are user-visible
changes.
