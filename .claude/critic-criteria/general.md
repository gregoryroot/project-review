# General Critic — Project Criteria Memory

Domain: general (coherence, problem-statement integrity, user-model fit, honesty
about the unknown). Owner: team-critic. This is the only file this critic writes.

**Provenance rule (learned 2026-09-06, cycle 1).** Sibling criteria files in this
directory have carried stale or retracted premises (`security.md` and
`architecture.md` both asserted that no mood-tracker content existed in this repo;
`security.md` additionally carried a rule forbidding health-data findings, which
would have suppressed a later-mandated safety read). Never import another domain's
criteria file as general criteria. Date and re-verify any criterion before reuse.

---

## C-1 — A stated uncertainty is not a defect; an unstated one is
Before filing any "X is missing / unresolved" finding against a design document,
read the document's own uncertainty registers. Filing an item the author already
flagged is a false positive and, when the reader is the author, an active failure.
Corollary (C-1a): the uncertainty register is not always one section. Authors state
uncertainty inline ("in my assessment", "I have flagged where I am uncertain",
"TBD"). A gate that defines "stated" as a fixed set of line ranges manufactures
false "unstated" findings for every hedge outside those ranges.

## C-2 — Check whether a charge can fail before critiquing what it found
A review lot, acceptance criterion, or test whose framing makes a negative result
unreachable produces guaranteed-pass output. The tell is two rules in the same
charge that classify the same evidence oppositely: one says a class of defect
"is NOT a showstopper," another defines the showstopper clause so that the same
evidence is exactly what triggers it. Resolve the collision or the lot's verdict
is predetermined.

## C-3 — Partitions leak at the exclusion boundary, not in the middle
When work is split as "A owns X, B owns everything except X," test the seam in
both directions: a claim ORIGINATING in X whose fulfilment lives outside X is owned
by neither, because A's read scope stops at X's edge and B excluded X as a source.
Enumerate two or three concrete cross-references that cross the boundary. Coverage
of lines is not coverage of relationships.

## C-4 — Verify the arithmetic in any "mechanical check"
A table offered as a reviewer's verification aid earns no trust for being labelled
mechanical. Recompute it. In this project a load-distribution row summed to 984
against a 950-line target while the contiguity check beside it was exactly right —
correct structure, wrong totals, and the totals were what a risk decision rested on.

## C-5 — "Mechanical, not analysis" is a load-estimate red flag
A step described as a grep is analysis whenever it requires deciding that a
candidate finding and a stated caveat are the SAME concern. String search cannot do
semantic matching. Re-price any workload whose mitigation depends on this claim.

## C-6 — A mitigation must name an artifact that exists
When a risk register says "mitigated by the warning in <lot>'s charge," locate the
warning. Absent text is an unmitigated risk wearing a mitigation label. Also test
FIT: a gate that filters gap-type findings does not mitigate a risk that produces
disagreement-type findings.

## C-7 — Read-scope must be stated once
If a global rule grants "may read any line" and per-lot entries enumerate a
narrower "may read" list, scope is indeterminate and the severity of every seam
depends on which reading wins. Two readers will pick differently.

## C-8 — Critical path is the terminal join, not the loudest lot
A lot gated on ALL other lots completing is the schedule's real end point, whatever
the plan labels critical. Check the dependency list against the critical-path claim.

## C-9 — Assignments carry no question unless one is written
Listing an owner and a line range is not a charge. Where lots inherit only a generic
charge, two owners can converge on one lens without the plan ever declaring the
overlap — the declared-overlap discipline only protects lots that stated a question.

## C-10 — Sensitivity, for this project
The mood-tracker PRD designs for a person living with treatment-resistant
depression. Critique the DESIGN — triggers, failure modes, degraded paths,
promise-vs-delivery. Never the author's circumstances. Clinical adequacy is outside
this critic's competence and is forbidden. Where safety design is weak, say exactly
which promise is unbacked and where; do not speculate about any real person.

## C-11 — Standing scope for this repo
`examples/demo-repo/` is a deliberately flawed fixture; its flaws are never
findings. The project-review skill itself (`SKILL.md`, `scripts/`, `reviewers/`,
`reference/`) is a separate subject. Relocation of the PRD to its own repository is
an open user decision — never assume it, recommend it as settled, or act on it.
