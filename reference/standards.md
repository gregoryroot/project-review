# Standards index

The reviewer doctrine files hunt against published standards rather than
against one author's taste. This file is the shared index: what each standard
is, what it is good for, and how to cite it.

**Why cite at all.** A finding that says "this is bad practice" is arguable
forever. A finding that says "missing authorization on an object-scoped route —
CWE-862, API1:2023" is arguable against a published reference, and it gives the
reader somewhere to go that is not this tool. Citations also make it visible
when the tool drifts: if reviewers stop citing, they have stopped hunting to a
checklist and started improvising.

## Freshness

Machine-readable. `scripts/standards-freshness.mjs` parses exactly this table;
keep the column order and the `YYYY-MM-DD` format. `cadence` is how often a new
edition is *expected*, not a promise that one has landed.

| Key | Standard | Edition | Checked | Cadence |
|---|---|---|---|---|
| cwe-top25 | CWE Top 25 | 2025 | 2026-07-18 | annual |
| asvs | OWASP ASVS | 5.0.0 | 2026-07-18 | multi-year |
| api-top10 | OWASP API Security Top 10 | 2023 | 2026-07-18 | multi-year |
| llm-top10 | OWASP Top 10 for LLM Apps | 2025 | 2026-07-18 | annual |
| scorecard | OpenSSF Scorecard | 5.5.0 | 2026-07-18 | continuous |
| slsa | SLSA | v1.0 | 2026-07-18 | multi-year |
| ssdf | NIST SSDF SP 800-218 | 1.1 | 2026-07-18 | rare |
| wcag | W3C WCAG | 2.2 | 2026-07-18 | rare |
| sre | Google SRE golden signals | SRE Book | 2026-07-18 | rare |

Cadence budgets: `continuous` 6 months · `annual` 12 · `multi-year` 36 ·
`rare` 60. Past budget, the review's debug output carries a staleness note —
**a defect report about this tool, aimed at whoever maintains it, never a
finding about the repo under review.**

Refreshing is deliberate and manual: run `node scripts/check-standards.mjs`,
which fetches current editions, diffs them against this table, and **proposes a
patch you approve by hand.** It never runs during a review and never edits this
file itself.

Two reasons it is not automatic. A review that reaches the network is
nondeterministic, and `examples/expected-review.json` stops being a regression
test the moment doctrine drifts with the web. More seriously, doctrine that
updates itself from a remote source is remote-controlled behavior change: an
edit to a page somewhere silently alters what this tool reports in every repo it
runs on. Approve standards changes the same way you approve a new banned-findings
row, and record them in `CHANGELOG.md` — a user whose findings changed is owed
the reason.

**What this file does not claim.** Citations here are accurate *as of the
Checked date*. This tool does not perform live compliance verification, and
neither its output nor its README should imply otherwise. "Grounded in CWE Top
25, 2025 edition, verified 2026-07-18" is defensible. "OWASP compliant" is not.

**Citations do not lower the evidence bar.** A CWE identifier is not a
substitute for a line and a verbatim quote — it is an additional field on a
finding that already passed the grounding gate. Never cite a standard for a
defect you have not demonstrated in this repo. "This project should comply with
ASVS L2" is not a finding; it is an opinion with a footnote.

## The `standard` field

Findings carry an optional `standard[]` of short identifier strings:

```json
"standard": ["CWE-89", "ASVS-V1.2", "API8:2023"]
```

Accepted identifier forms — anything else is dropped by the merge gate:

| Form | Example | Source |
|---|---|---|
| `CWE-<n>` | `CWE-862` | MITRE CWE |
| `ASVS-V<chapter>[.<section>]` | `ASVS-V8.1` | OWASP ASVS 5.0.0 |
| `API<n>:2023` | `API1:2023` | OWASP API Security Top 10 |
| `LLM<nn>:2025` | `LLM01:2025` | OWASP Top 10 for LLM Apps |
| `WCAG-<n.n.n>` | `WCAG-2.4.11` | W3C WCAG 2.2 |
| `Scorecard:<Check-Name>` | `Scorecard:Token-Permissions` | OpenSSF Scorecard |
| `SLSA-Build-L<n>` | `SLSA-Build-L2` | SLSA v1.0 |
| `SSDF-<PP.n.n>` | `SSDF-PW.4.1` | NIST SP 800-218 |

Cite at most three. A finding needing six identifiers is really several
findings, or the citations are decorative.

## CWE Top 25 (2025)

The 25 weaknesses scored most severe-and-frequent across 39,080 CVE records
from June 2024 to June 2025. Use it to calibrate *what actually gets exploited*
— it is the best available answer to "is this class of bug worth a human's
afternoon."

1. CWE-79 Cross-site Scripting · 2. CWE-89 SQL Injection · 3. CWE-352 CSRF ·
4. CWE-862 Missing Authorization · 5. CWE-787 Out-of-bounds Write ·
6. CWE-22 Path Traversal · 7. CWE-416 Use After Free · 8. CWE-125
Out-of-bounds Read · 9. CWE-78 OS Command Injection · 10. CWE-94 Code
Injection · 11. CWE-120 Classic Buffer Overflow · 12. CWE-434 Unrestricted
File Upload · 13. CWE-476 NULL Pointer Dereference · 14. CWE-121 Stack-based
Buffer Overflow · 15. CWE-502 Deserialization of Untrusted Data ·
16. CWE-122 Heap-based Buffer Overflow · 17. CWE-863 Incorrect Authorization ·
18. CWE-20 Improper Input Validation · 19. CWE-284 Improper Access Control ·
20. CWE-200 Sensitive Information Exposure · 21. CWE-306 Missing
Authentication for Critical Function · 22. CWE-918 SSRF · 23. CWE-77 Command
Injection · 24. CWE-639 Authorization Bypass Through User-Controlled Key ·
25. CWE-770 Allocation of Resources Without Limits or Throttling.

**Note what dominates.** Five of the 25 are authorization or access-control
failures (862, 863, 284, 306, 639). That is why `security-authz-identity` is
its own slice rather than a bullet inside a general security review.

Six entries (787, 416, 125, 120, 121, 122, 476) are memory-safety weaknesses
that do not apply to memory-safe languages. Do not manufacture them for a
TypeScript repo; do hunt them in C, C++, and `unsafe` Rust.

Source: <https://cwe.mitre.org/top25/>

## OWASP ASVS 5.0.0 (May 2025)

~350 requirements across 17 chapters, each tagged L1/L2/L3 (cumulative rigour,
not different topics). The most useful property for this tool: it is
**organized by control area**, which makes it a hunting checklist rather than a
ranked risk list.

| | Chapter | Owning slice |
|---|---|---|
| V1 | Encoding and Sanitization | `security-appsec` |
| V2 | Validation and Business Logic | `security-appsec` |
| V3 | Web Frontend Security | `security-appsec` |
| V4 | API and Web Service | `security-appsec` |
| V5 | File Handling | `security-appsec` |
| V6 | Authentication | `security-authz-identity` |
| V7 | Session Management | `security-authz-identity` |
| V8 | Authorization | `security-authz-identity` |
| V9 | Self-contained Tokens | `security-authz-identity` |
| V10 | OAuth and OIDC | `security-authz-identity` |
| V11 | Cryptography | `security-appsec` |
| V12 | Secure Communication | `security-appsec` |
| V13 | Configuration | `security-appsec` / `infra-supplychain` |
| V14 | Data Protection | `privacy-data` |
| V15 | Secure Coding and Architecture | `security-appsec` |
| V16 | Security Logging and Error Handling | `privacy-data` / `performance-observability` |
| V17 | WebRTC | `security-appsec`, only if WebRTC is present |

Cite as `ASVS-V8` for a chapter or `ASVS-V8.1` for a section. Do not invent
requirement numbers to three levels of depth unless you have the document open
— a wrong citation is worse than none, because it looks checkable and is not.

Source: <https://github.com/OWASP/ASVS>

## OWASP API Security Top 10 (2023)

Applies whenever the repo exposes HTTP endpoints. Its central insight is that
authorization fails at **three distinct granularities**, and a review that
checks only one of them misses the other two.

- **API1 Broken Object Level Authorization** — caller may reach *this object*?
  The classic `/api/thing/:id` with no ownership check.
- **API2 Broken Authentication**
- **API3 Broken Object Property Level Authorization** — caller may read/write
  *this field*? Mass assignment; over-broad serialization.
- **API4 Unrestricted Resource Consumption** — no pagination, no rate limit, no
  payload cap. Pairs with CWE-770.
- **API5 Broken Function Level Authorization** — caller may invoke *this
  operation*? Admin routes reachable by ordinary users.
- **API6 Unrestricted Access to Sensitive Business Flows** — the operation is
  authorized but automatable in a way that harms the business.
- **API7 SSRF** — server fetches a user-supplied URI.
- **API8 Security Misconfiguration**
- **API9 Improper Inventory Management** — undocumented or unversioned
  endpoints; old versions still live.
- **API10 Unsafe Consumption of APIs** — trusting a third-party response
  without validating it.

Source: <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>

## OpenSSF Scorecard

20 automated checks over repository and supply-chain health. This is the
checklist `infra-supplychain` hunts against, because it enumerates the things
that are invisible from source alone.

`Binary-Artifacts` · `Branch-Protection` · `CI-Tests` · `CII-Best-Practices` ·
`Code-Review` · `Contributors` · `Dangerous-Workflow` · `Dependency-Update-Tool` ·
`Fuzzing` · `License` · `Maintained` · `Packaging` · `Pinned-Dependencies` ·
`SAST` · `SBOM` · `Security-Policy` · `Signed-Releases` · `Token-Permissions` ·
`Vulnerabilities` · `Webhooks`

Highest-yield for a typical repo: `Dangerous-Workflow` (untrusted checkout,
script injection in Actions), `Token-Permissions` (workflows granted write by
default), `Pinned-Dependencies` (actions on a mutable branch ref),
`Security-Policy` (no SECURITY.md, so nobody knows how to report),
`Dependency-Update-Tool` (no Dependabot/Renovate, so advisories go unnoticed).

**Scorecard scores projects; this tool reviews code.** A low score on
`Contributors` or `CII-Best-Practices` is not a defect in someone's internal
repo — do not report checks whose premise is public open-source distribution
unless the repo is actually distributed that way.

Source: <https://github.com/ossf/scorecard/blob/main/docs/checks.md>

## SLSA v1.0 and NIST SSDF

**SLSA Build levels** describe how trustworthy a build's provenance is.
L0 none · L1 provenance exists and is distributed · L2 hosted build platform,
signed provenance · L3 hermetic builds, unforgeable provenance, isolated
signing keys.

Report against SLSA only for repos that **publish artifacts** — a package, a
container image, a release binary. An internal app that deploys from source has
no provenance story to be missing.

**NIST SP 800-218 (SSDF)** is the practice framework EO 14028 leans on; cite it
(`SSDF-PW.4.1`) when a finding is about process rather than code. Use sparingly
— most findings should cite something more specific.

Sources: <https://slsa.dev/spec/v1.1/faq> · NIST SP 800-218

## W3C WCAG 2.2 (October 2023)

86 success criteria; Level AA (56 criteria, A + AA) is the conformance target
that regulation generally references. The nine criteria added in 2.2 target
low-vision, cognitive, and motor disability, and mobile touch interaction:

2.4.11 Focus Not Obscured (Minimum, AA) · 2.4.12 Focus Not Obscured (Enhanced,
AAA) · 2.4.13 Focus Appearance (AAA) · 2.5.7 Dragging Movements (AA) ·
2.5.8 Target Size Minimum (AA) · 3.2.6 Consistent Help (A) · 3.3.7 Redundant
Entry (A) · 3.3.8 Accessible Authentication Minimum (AA) · 3.3.9 Accessible
Authentication Enhanced (AAA).

Target **AA**. Do not report AAA criteria as defects; note them as `info` at
most. Cite as `WCAG-2.5.8`.

Source: <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>

## OWASP Top 10 for LLM Applications (2025)

Applies only when the repo calls a model API, runs inference, or builds
prompts. LLM01 Prompt Injection · LLM02 Sensitive Information Disclosure ·
LLM03 Supply Chain · LLM04 Data and Model Poisoning · LLM05 Improper Output
Handling · LLM06 Excessive Agency · LLM07 System Prompt Leakage · LLM08 Vector
and Embedding Weaknesses · LLM09 Misinformation · LLM10 Unbounded Consumption.

The two that produce the most real findings in application code: **LLM05
Improper Output Handling** (model output flowing into a shell, a query, an
`eval`, or unescaped HTML — the model is an untrusted source) and **LLM06
Excessive Agency** (a tool-calling agent holding permissions far wider than its
task needs).

Source: <https://genai.owasp.org/llm-top-10/>

## Google SRE — the four golden signals

**Latency, traffic, errors, saturation.** The minimum instrumentation for
knowing whether a service is healthy. `performance-observability` uses this as
its checklist: for each signal, can an operator answer the question *at all*
from what this code emits?

Also from the SRE corpus, and worth hunting: structured logs over plain-text
(queryable vs greppable), health/readiness endpoints distinct from liveness,
graceful shutdown on SIGTERM, and defined SLIs. "If a team cannot describe what
healthy looks like for a service, it is not ready for production" — which is
precisely the question this tool exists to answer.

Source: <https://sre.google/sre-book/monitoring-distributed-systems/>

## Keeping this file honest

These standards get revised. CWE Top 25 is annual; ASVS, WCAG, and the OWASP
lists move on their own schedules. **Every entry above records the version and
date it was taken from.** When a reviewer cites an identifier that no longer
exists in the current edition, that is a defect in this file, not in the repo
under review.

A stale standards index produces findings that cite a retired requirement with
total confidence — the same failure mode the project memory's staleness rules
exist to prevent, one level up. Re-check this file when a new edition lands, and
record the revision in `CHANGELOG.md`, because a changed identifier changes what
users see in their reports.
