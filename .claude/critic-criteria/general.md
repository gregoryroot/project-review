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

---

## Cycle-2 additions (2026-09-06)

## C-12 — A fix that supplies a missing definition can narrow past the cases it protected
When a vague threshold is repaired by binding it to a newly written definition, re-test
the definition against the items the threshold existed to catch. Tightening is not free:
a definition requiring a claim to reach an end user will silently exclude obligations the
document places on the BUILDER, which are often the safety-critical ones. Check the
excluded set explicitly, not the included set.

## C-13 — When a global permission and a per-item enumeration conflict, behaviour settles it
A document may say "any lot may read any line" while every lot also lists a narrower
"may read." Do not report this only as ambiguity. Look for whether the author later
granted an explicit exception to one item. A grant is evidence that the enumeration
binds and the global permission is inert — that resolves which reading is operative and
converts a soft inconsistency into a hard scope defect.

## C-14 — Verify both halves of a two-part seam separately
A seam described as "A originates outside B's scope AND its fulfilment lies outside A's
reach" has two independent closures. A revision commonly closes the cheaper half and
reports the seam as fixed. Re-run the ORIGINAL worked trace item by item against the
revision rather than reading the changelog entry.

## C-15 — A role can survive in name and lose its reach
When checking whether an assignment survived a revision, check its scope grants, not
only its title. An accountability that is preserved verbatim while the resources needed
to discharge it are left unextended is worse than a deleted one, because the org chart
shows the question as covered.

## C-16 — Credit the closes explicitly and by re-running the example
Report which prior findings closed and on what evidence, in the same output as the
open ones. Re-running your own earlier worked example against the revision, and stating
the severity it now yields, is the only claim of closure that can be checked. It also
keeps a downgrade honest: a defect that shrank from MAJOR to MINOR should be said to
have shrunk, not re-filed at full weight.

## C-17 — Accounting drifts when scope moves
A change that relocates work between owners must be reflected in whatever load or
sequencing table drives decisions. Recompute the moved quantity. A lot described by a
qualitative label ("document-wide") hides its own growth across revisions; insist on an
exact count once any count is being used to make a scheduling call.

---

## Cycle-3 additions (2026-09-06)

## C-18 — A review step that consumes only "findings" cannot audit a clean verdict
When a checker, second reader, or approval step is fed the OUTPUT of an earlier step,
ask what that earlier step emits when it finds nothing wrong. If a passing verdict emits
no artifact, the downstream check never sees the passes — and a wrongly-clean verdict is
usually the failure the second check existed to catch. Route the full result set, not the
exception list. Tell: the upstream deliverable is a matrix, checklist, or per-unit
verdict, while the handoff is described in terms of "findings" or "issues."

## C-19 — A new rule is inert until it is wired into the step that enforces it
A correctly written control placed in one section does not bind the validation table,
disposition rule, or template in another. Grep the new rule's key phrase across the whole
document: if it appears only where it was authored plus a cross-reference, the enforcing
machinery still runs the old logic. State the wiring, not just the principle.

## C-20 — Check both directions of a verdict, not just the one that failed last time
Controls tend to be repaired asymmetrically: whichever direction produced the last
embarrassment gets fixed. After a fix, ask what protects the OPPOSITE error. A pair where
a false-positive path is guarded and a false-negative path is not (or vice versa) leaves
the verdict unverified overall, even though each direction looks individually addressed.

## C-21 — A fix by enumeration leaves the class unfixed
When a defect is repaired by naming the specific items that triggered it, the general
test above it usually still stands and still excludes structurally identical unnamed
items. Worse, the enumeration and the test now disagree. Prefer, and ask for, a class
rule; when reporting, name one unnamed member of the class to show the hole is real.

## C-22 — A newly introduced term inherits every use of its words elsewhere
Adding an undefined qualifier ("a stated release gate", "a named surface") imports every
place the source document happens to use similar language, including registers and
appendices that were never meant as commitments. Grep the target document for the phrase
family before accepting the term, and check whether the new inclusions collide with an
existing prohibition.

## C-23 — Attribution of findings follows the same rule as attribution of commits
A dispatch or summary that credits you with a finding you did not make is the same defect
class as inferring authorship from history: a real artifact with a wrong pointer on it.
Correct it in the output, sourced to your own prior report, even when the misattribution
is flattering or harmless — an unowned finding propagating into the record corrupts the
evidence trail the same way.

## C-24 — Record why you did NOT escalate
When a generic rule would escalate and a narrower operative rule would not, state the
reasoning in the output rather than silently applying one. A withheld escalation that is
never explained is indistinguishable from an escalation nobody noticed was due.
