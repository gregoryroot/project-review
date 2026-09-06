# Mood tracker for treatment-resistant depression: Product Requirements, v1

Status: draft for review
Author: drafted with Claude Code, 2026-09-05
Working name: TBD (see Open Decisions, D8)

---

## 0. Summary

A free, cross-platform, local-first app that lets a person living with
treatment-resistant depression record how they are doing in under five seconds,
from a home screen widget or a notification, without opening the app; that turns
those records into a one-page summary they can hand to their psychiatrist; and
that optionally keeps one trusted support person informed at the level of a
trend band, never raw scores, with concrete guidance on what to actually do.

Three claims shape everything below.

1. **The product is not the logging. It is the output.** Logging is the cost the
   user pays. The value is a legible answer to "is this treatment working" at
   the next appointment, and a support person who knows when and how to show up.
   A v1 that ships logging without an output is a v1 that gets deleted in three
   weeks.
2. **Depression alone is the wrong measurement model for this population.**
   See section 3.
3. **The support-partner feature is the highest-risk thing in the product**, not
   the nicest. See section 8.

---

## 1. Where I push back on the brief

You asked to be challenged. These are ordered by how much they change the build.

### 1.1 "Tie it into the PHQ-9" is right as an anchor and wrong as a cadence

PHQ-9 is a **two-week recall** instrument. Administering it daily is
psychometrically meaningless: consecutive administrations share almost their
entire recall window, so day-over-day change is noise, and the nine-item burden
is exactly the burden a depressed person cannot pay. Standard practice in
measurement-based care is every two to four weeks.

More importantly: **PHQ-9 item 9 asks about thoughts of being better off dead or
of self-harm.** You cannot ship a question like that and have nothing happen when
the answer is not zero. Before that item exists in your app, the response path
has to exist (section 9). This is the single hardest requirement in the document
and it is easy to skip.

Design: momentary check-ins are a separate, unvalidated, ultra-light instrument.
PHQ-9 (or QIDS-SR16, see D1) runs every 14 days as the validated anchor that the
psychiatrist recognizes.

### 1.2 "Prompt more when the trend goes down" is backwards on burden

Your instinct is correct about information value: data matters most when things
are changing. But capacity to respond moves in the opposite direction. Depression
degrades initiation, concentration, and decision-making. Increasing prompt
frequency during a downturn increases the chance the person stops responding
entirely, and then you lose the interval you most wanted to see.

Invert the knob: **hold frequency roughly constant and vary depth and friction.**
When the trend goes down, the prompt gets *shorter*, the response set gets
*larger and simpler* (three big targets instead of seven), and follow-up
questions are suppressed. Escalate depth only after the person has answered a few
in a row, which is evidence of capacity. See section 6 for the exact policy.

The one legitimate reason to *add* a prompt is a suspected activation switch
(mood and energy both rising fast), because that window is short and clinically
urgent. That is a different rule from "they are getting worse."

### 1.3 Non-response is data, and must never be punished

Missed check-ins correlate with worsening in ecological momentary assessment
research. Treat a run of silence as a signal in its own right, surfaced neutrally
("no entries since Tuesday"), never as "you broke your streak."

**Hard anti-requirement: no streaks, no badges, no completion percentages shown
to the user, no red for low mood, no guilt copy.** A broken streak reads to a
depressed person as one more failure, and the app becomes another thing they are
failing at. This is the most common way mood trackers do net harm.

### 1.4 A UUID is not privacy, and it is not recoverable

Your instinct to avoid identifying information is right and should be kept. But
a bare UUID as the only credential fails three ways:

- It is a permanent bearer token. Anyone who ever sees the string has permanent
  access. There is no revocation story unless you design one.
- Lose the phone, lose everything. No email means no reset.
- It does not make the person anonymous *to their support partner*, who knows
  exactly who they are. It only makes them anonymous to **you**, the operator.
  That is genuinely worth having (you cannot leak what you never held), but name
  it honestly in the privacy policy rather than promising "anonymous."

Design instead: no account at all for solo use, data local and encrypted; pairing
via a **short-lived, single-use, human-readable invite code** delivered
out-of-band (they text it) that performs a key exchange; the server thereafter
stores only a pairing ID, push tokens, and ciphertext. Revocation rotates keys
and invalidates the pairing server-side. Recovery is an optional recovery phrase
plus platform-native encrypted backup, with a blunt warning that no phrase means
no recovery. Section 10.

### 1.5 The support-partner feature can be used against the person

The intended user is a caring friend or partner. Some fraction of real support
partners are the source of the stress, or become controlling with new
information, or panic and escalate in ways that make the person hide their data.
This is well documented in the safety-technology literature and it is the reason
several mood apps have quietly removed sharing.

Requirements that follow from this: sharing is **band-level, not numeric**;
**instantly revocable** from a place that is easy to reach; **pausable**;
free-text notes and the safety plan are **never** shared by default; alerts to
the partner carry a **delay window with a cancel action** on the tracked person's
side; the partner is told in onboarding, and must acknowledge, that this is not
monitoring and confers no ability to intervene. See section 8.

### 1.6 Measuring mood changes mood

Repeated self-focused attention can amplify rumination in depression. Mitigations
are cheap and should be requirements, not polish: neutral, non-evaluative wording
on the logging surface; no interpretation shown at the moment of logging (no
"that's lower than yesterday"); free-text is optional and never prompted with
"why do you feel this way?", which is an invitation to ruminate. Ask "anything
you want to note?" if you ask at all.

### 1.7 Without a treatment timeline, the mood curve is uninterpretable

This is the biggest gap in the brief. In treatment-resistant depression the whole
question is *which intervention did what*: a new agent, a dose change, an
augmentation, an esketamine or ketamine series, a TMS course, ECT, therapy
starting or stopping, a sleep change, a life event. A mood chart with no event
markers cannot answer that question, and the psychiatrist cannot use it.

**Requirement: a lightweight event timeline overlaid on the mood chart, with
one-tap event types and a free-text label.** This is v1, not v2. It is also what
makes the appointment report worth printing.

### 1.8 Sleep is the highest-yield variable that is not mood

Sleep change is a leading indicator both of depressive worsening and of a
hypomanic or mixed switch, and it is the variable clinicians act on fastest. Pull
it passively from HealthKit / Health Connect where available; ask one question
where not. Do not build anything else passive in v1.

### 1.9 Free plus donations: the cost is real but small, and the placement matters

Recurring infrastructure can be near zero if a solo user with no partner never
touches your server (local-first makes this true). Realistic year-one cash: Apple
Developer Program 99 USD/yr, Google Play 25 USD one-time, domain ~12 USD/yr,
backend on a free tier. Call it ~140 USD.

On the donation ask: see section 14. Short version: keep it entirely on the
website, disclose plainly that it goes to a personal college fund and is not
tax-deductible, and put no donation surface anywhere inside the app, especially
not near a low-mood entry.

### 1.10 You are building for one person, which is a strength and a trap

Building for one named user is the best possible starting constraint. The trap is
n-of-1 design decisions that do not generalize, and, more seriously, deploying an
untested tool into someone's active care without their clinician knowing. Two
requirements: your friend is a design partner with veto power, and the appointment
report is reviewed by their psychiatrist before you rely on it.

### 1.11 What happens when you stop maintaining it

If this becomes load-bearing for someone's care, an abandoned app is a harm. Plan
for it now: local-first data plus a plain-format export means the data survives
the app. Consider open-sourcing from day one, and say in the about screen what
happens if development stops.

---

## 2. Users, roles, and the job to be done

**Tracker** (primary): an adult with a diagnosis of major depressive disorder
that has not responded adequately to two or more adequate trials. Characteristics
that drive design: low initiation energy, variable concentration, frequent
appointments with clinicians who ask "how have the last few weeks been?" and get
a shrug, a history of trying and abandoning tracking tools, and elevated baseline
risk.

**Ally** (secondary, optional): one trusted person, chosen by the tracker.
Motivated, not clinically trained, prone to either over-reacting or to
"let me know if you need anything," which is the least useful sentence in
mental health support.

**Clinician** (tertiary, not a user in v1): receives a piece of paper or a PDF.
Never gets an account, never gets a login, never gets a portal in v1.

Jobs to be done, in priority order:

1. Tracker: "Tell my psychiatrist what the last month was actually like, without
   having to remember it."
2. Tracker: "Notice a slide early enough to do something about it."
3. Ally: "Know when to reach out, and know what to say that helps."
4. Tracker: "Have a record that a treatment did or did not work, so I do not
   re-litigate it from memory in six months."

---

## 3. What to measure: is depression the only mood that matters?

**No. For this population specifically, depression-only tracking is a design
error.** Three reasons, in order of importance.

### 3.1 Apparent treatment resistance is sometimes unrecognized bipolarity

One of the recognized contributors to "nothing works" in depression is an
undetected bipolar-spectrum course, where antidepressant monotherapy underperforms
or destabilizes. A tracker that only asks "how depressed are you, 0 to 3" is
structurally incapable of surfacing the pattern that would change the diagnosis.
Capturing **energy and activation alongside mood** costs one extra tap and makes
the switch visible.

This is not a claim that your friend has bipolar disorder, and the app must never
suggest a diagnosis. It is a claim that the data model should not be blind to it.

### 3.2 Low mood and low energy dissociate, and the difference is clinically loud

The two-dimensional circumplex (valence by arousal) separates states that a
single "mood 1 to 10" collapses:

| | Low energy | High energy |
|---|---|---|
| **Unpleasant** | classic retarded depression, anhedonia, "flat" | agitated / mixed state, anxiety, irritability. **Higher acute risk.** |
| **Pleasant** | calm, recovering, "quiet good day" | euthymic and engaged, or activated / hypomanic |

Unpleasant-plus-high-energy is the quadrant most associated with acute risk and
the one most likely to be missed by a depression scale. Getting this for one
extra tap is the best return in the whole measurement model.

### 3.3 Anxiety, irritability, anhedonia and function carry the rest of the signal

- **Anxiety**: comorbid with depression in roughly half of cases and often the
  symptom that moves first under treatment.
- **Irritability**: under-asked, high signal for mixed features, and often the
  thing an ally notices before the tracker does.
- **Anhedonia**: the core dimension in treatment-resistant depression and the one
  most sensitive to rapid-acting treatments. "Was anything enjoyable today?" is a
  one-item probe worth its cost.
- **Function**: what patients actually care about, and what clinicians
  under-measure. "Did you do the things you needed to do today?" predicts
  quality of life better than symptom counts.

### 3.4 Recommended measurement model

**Core momentary (Tier 1, one tap):** valence, 7 points, unpleasant to pleasant.
Align the scale and vocabulary with Apple's Health "State of Mind" model so the
data can be written to HealthKit and read by anything else the person uses.

**Core daily (Tier 2, three to six taps):** valence, energy/activation, anxiety,
sleep hours and quality, plus one rotating probe from {anhedonia, irritability,
function}. Rotation keeps daily burden at four questions while covering six
dimensions across a week.

**Weekly (Tier 3):** the rotating probes all at once, plus a single free-text
"anything worth remembering about this week?" (optional, skippable, never
required).

**Anchors (Tier 4):**

| Instrument | Items | Cadence | Purpose | Licensing note |
|---|---|---|---|---|
| PHQ-9 | 9 | every 14 days | severity anchor the clinician already reads | free to reproduce; verify current terms |
| ASRM (Altman Self-Rating Mania Scale) | 5 | every 30 days, or triggered | activation / hypomania screen | free; verify |
| GAD-7 | 7 | every 30 days | anxiety anchor | free to reproduce; verify |
| WHO-5 | 5 | every 14 days | positively-framed wellbeing counterweight | free with attribution; verify |
| QIDS-SR16 | 16 | alternative to PHQ-9 | better change sensitivity, bidirectional sleep/appetite/weight, and it is the instrument from the STAR*D treatment-resistance literature | public domain; verify |

**Confidence note:** the licensing column reflects the general position of these
instruments as freely usable self-report scales, but I have not verified current
terms and you should confirm each one in writing before shipping. Do not treat
this table as a license.

Deliberately excluded from v1: PANAS (too long), SHAPS full form (14 items, use
the one-item probe instead), Sheehan Disability Scale (licensing friction; use a
plain function question), C-SSRS full version (see section 9 for why the
screener-style path is the right shape and why the full instrument is not).

---

## 4. Design principles and anti-goals

**Principles**

1. **Five seconds or it did not happen.** Time from notification arrival to
   logged entry must be under five seconds with no app launch.
2. **The app gets simpler when the person gets worse**, never louder.
3. **Every question earns its place.** If an item does not change what the
   tracker, the ally, or the clinician does, cut it.
4. **Local by default.** Nothing leaves the device unless the tracker turned on a
   specific sharing feature.
5. **Neutral at the point of logging, interpretive only where invited.** Charts
   and summaries live behind a deliberate tap.
6. **The tracker owns the data and the relationship.** Every sharing control is
   theirs, revocable, and reachable in two taps.

**Anti-goals (explicit non-features for v1)**

- No streaks, badges, points, leaderboards, or adherence scores shown to the user.
- No red or alarm colors for low mood. No frowning faces. Use a neutral sequential
  ramp.
- No social feed, no community, no comparison to other users.
- No AI chat companion. In a suicide-adjacent context this adds meaningful risk,
  meaningful cost, and does not serve any of the four jobs to be done.
- No medication reminders in v1 (different product, different compliance surface,
  and adherence nagging conflicts with principle 2). Medication *events* on the
  timeline are in scope; medication *reminders* are not.
- No prediction of future episodes. You do not have the data, and a false
  prediction in either direction is harmful.
- No ads, ever, and no third-party analytics or attribution SDKs.

---

## 5. The check-in ladder

| Tier | Trigger | Content | Surface | Target time |
|---|---|---|---|---|
| 0 | passive | sleep duration, optionally steps | HealthKit / Health Connect | 0s |
| 1 | scheduled prompt | valence only | notification action or widget button | under 5s |
| 2 | once daily, or after a Tier-1 tap if capacity is good | valence, energy, anxiety, sleep, one rotating probe | expanded notification or in-app | under 30s |
| 3 | weekly | all rotating probes plus optional free text | in-app | under 90s |
| 4 | every 14 or 30 days | PHQ-9, WHO-5, GAD-7, ASRM | in-app, with a safety path | under 3 min |

Rules that hold across tiers:

- Any tier can be answered partially. A partial entry is saved, not discarded.
- Any tier can be dismissed without consequence and without a follow-up nag.
- Tier 1 from the widget must work with the app never having been foregrounded
  that day, and must work offline.
- A Tier-1 tap may optionally expand into Tier 2 ("want to add a bit more?") but
  only when the recent response rate is at or above 70 percent, and never twice
  in a row.

---

## 6. Adaptive prompting policy

Inputs, computed locally, no server involvement:

- `v7` = 7-day rolling mean of valence
- `slope7` = least-squares slope of valence over 7 days
- `rr7` = response rate over the last 7 days (responded prompts / delivered prompts)
- `sd7` = standard deviation of valence over 7 days
- `e7` = 7-day rolling mean of energy
- `gap` = days since last entry of any tier

Baseline: two Tier-1 prompts per day at user-chosen anchor times, plus or minus
15 minutes of jitter, defaulting to midday and early evening. User-configurable
from one to four. Quiet hours enforced.

Policy rules, evaluated nightly, in precedence order:

| # | Condition | Action |
|---|---|---|
| R1 | `gap >= 4` | Drop to one prompt/day, Tier 1 only, change the copy to a lower-demand variant. Never send a "you have missed N days" message. |
| R2 | `rr7 < 0.5` | Reduce prompts by one per day, floor of one. Suppress all Tier-2 expansions. |
| R3 | `e7` rising sharply **and** `v7` rising sharply **and** sleep duration falling | Schedule an ASRM within 48 hours. This is the only rule permitted to add a prompt. |
| R4 | `v7` below the low threshold, sustained 5+ days | Enter **low-capacity mode**: one prompt/day, three response targets only (rough / ok / good), no expansions, no weekly, safety plan and "what helps me" card promoted on the home screen. Tier 4 instruments are postponed, not cancelled, unless already due. |
| R5 | `slope7` strongly negative and `rr7 >= 0.7` | Keep frequency. Add one optional evening Tier-1 only if the user has opted into "check on me more when things dip" during onboarding. Default off. |
| R6 | `v7` stable and above threshold for 14 days, `rr7 >= 0.7` | Taper toward one prompt/day, then every other day. Tell the user why. Stability is rewarded with less burden. |
| R7 | `sd7` high (volatility) regardless of level | Keep frequency, but shift one prompt to a different time of day to sample a different part of the diurnal curve. |

Hard limits that override every rule: maximum 4 prompts/day; minimum 90 minutes
between prompts; never re-prompt a missed slot more than once; never any prompt
during quiet hours; a global snooze of 1/3/7 days that is always one tap away
from any prompt.

**Explainability requirement:** a settings screen shows in plain language why the
current cadence is what it is ("You are getting one check-in a day right now
because things have been steady for two weeks. Change this any time.") and lets
the user override the policy entirely with a fixed schedule. The adaptive system
must always be defeatable.

---

## 7. Feature requirements, v1

Each requirement has an acceptance criterion. Anything without one is not a
requirement, it is a wish.

### F1. One-tap logging from a home screen widget
The tracker can record valence without launching the app.
*Accept:* on iOS 17+, a small WidgetKit widget with four App Intent buttons
records an entry and refreshes in place, app never foregrounded. On Android, a
Glance app widget does the same. Verified with the app force-stopped beforehand
on Android and after a device reboot on both.

### F2. One-tap logging from a notification
*Accept:* Android notification exposes three direct-tap actions on the collapsed
notification and records without opening the app. iOS notification exposes four
actions on long-press expand and records via a background notification action
handler. Both work with the device locked, subject to platform policy, and both
dismiss cleanly.

### F3. Tier 2 daily check-in
*Accept:* five questions, thumb-reachable targets, no scrolling on a 5.4-inch
screen, completes in under 30 seconds in usability testing, partial answers
persist.

### F4. Validated instrument scheduling
*Accept:* PHQ-9 delivered every 14 days with a 3-day flexible window; ASRM every
30 days or on R3 trigger; scores stored with instrument version and date;
severity band displayed as the instrument's own published band with a citation,
with no added interpretation of what the person should do.

### F5. Treatment and life event timeline
*Accept:* the tracker can add an event in under 10 seconds from the chart screen.
Preset types: medication started, medication stopped, dose changed, therapy
session, procedure or infusion (ketamine, esketamine, TMS, ECT), physical
illness, major life event, travel or schedule disruption, substance change.
Optional free-text label. Events render as vertical markers on every chart and as
a list in the appointment report.

### F6. Trends view
*Accept:* one screen shows valence and energy over a selectable window (14 / 30 /
90 / 365 days) with event markers, sleep as a secondary axis, and instrument
scores as discrete points. No predictive lines. No "your mood is down 12%"
headline. Sparse data renders as gaps, never as interpolation.

### F7. Appointment report
The highest-value single feature in the product.
*Accept:* one tap produces a one-page PDF and a plain-text version covering a
user-selected period, containing: the mood and energy chart with event markers,
PHQ-9 (or QIDS) scores with dates, sleep summary, the event list, the count of
days logged versus days in period (so the clinician can judge completeness), and
the tracker's optional free-text notes if they choose to include them. It is
shareable via the OS share sheet, printable, and generated fully on-device with
no network call. Reviewed by at least one practicing psychiatrist before v1 ships.

### F8. Safety plan
*Accept:* a six-section safety plan following the Stanley-Brown structure
(warning signs; internal coping; people and places for distraction; people to ask
for help; professionals and agencies; making the environment safer), editable,
stored locally, reachable in two taps from the home screen and one tap from the
low-capacity home screen and from any Tier 4 flow. Not shared with the ally
unless the tracker explicitly shares specific rows.

### F9. Crisis resources
*Accept:* a locale-configurable resource list, always reachable including offline,
with tap-to-call and tap-to-text. US defaults: 988 Suicide and Crisis Lifeline
(call and text), Crisis Text Line (text HOME to 741741), 911. The list is
reachable from the check-in flow itself, not only from a settings menu.

### F10. Adaptive cadence with override
*Accept:* section 6 implemented, explainable in plain language, fully defeatable
by a manual fixed schedule.

### F11. Local-first encrypted storage
*Accept:* SQLite (or SQLCipher) on-device, encrypted at rest with a key in
Keychain / Android Keystore, no network dependency for any solo feature, app
fully functional in airplane mode.

### F12. Export and delete
*Accept:* full export as CSV and JSON including every entry, event, and
instrument score. Delete-everything wipes local data and, if paired, invalidates
the pairing server-side and confirms it did.

### F13. Ally pairing (see section 8 for the full spec)
*Accept:* pairing completes with no email, phone number, or name transmitted;
invite code expires in 10 minutes and is single-use; revocation takes effect
within 60 seconds and the server retains no readable content after it.

### F14. Onboarding that sets expectations
*Accept:* three screens maximum before the first check-in is possible. One of
them states, in plain language, what the app cannot do: it is not monitoring, it
does not contact anyone automatically, it is not a medical device, it does not
diagnose, and it is not a substitute for care. Acknowledged, not just displayed.

### F15. Accessibility
*Accept:* full VoiceOver and TalkBack labeling on every logging surface including
widgets and notification actions; Dynamic Type and Android font scaling up to
200 percent without clipping; all interactive targets at least 44 by 44 points;
color never the sole carrier of meaning; reduced-motion respected. This is not
optional polish. Cognitive impairment is a symptom of the condition the app
exists for.

---

## 8. Ally (support partner) specification

### 8.1 What the ally sees

By default, one thing: a **band**, not a number.

| Band | Meaning shown to the ally |
|---|---|
| Steady | "Things have been fairly level lately." |
| Drifting down | "The last week has been trending lower than the week before." |
| Low | "It has been a hard stretch." |
| Lifting | "Things have been trending better." |
| Quiet | "No check-ins for a while." (only if the tracker enabled it) |
| Paused | "Sharing is paused right now." |

Never shared by default: numeric scores, instrument results, free text, event
timeline, safety plan contents, individual entries, times of day.

The tracker can optionally upgrade sharing to include the trend chart shape
(no numbers) or specific event types. Every upgrade is a separate explicit toggle
and every one is separately revocable.

### 8.2 What the ally receives

- **A weekly digest** at a fixed time: the band, whether it changed, and one
  concrete suggested action.
- **Change alerts**, opt-in by the tracker, when the band worsens. Delivered on a
  **delay of 12 to 24 hours** with a "hold off, I am okay" cancel action on the
  tracker's device that stops delivery. This preserves the tracker's agency and
  prevents an alert firing off a single bad evening.
- **The tracker's "what helps me" card** (see 8.3).
- **A resource library**: short, concrete, low-pressure guidance. Written from
  behavioral-activation principles and from the substantial literature on what
  unhelpful support looks like. The core content is the difference between
  "let me know if you need anything" (places the burden on the person with the
  least capacity) and "I am going to the store at 4, want to come?" (specific,
  low-cost to decline, no explanation required).

### 8.3 The "what helps me" card

This is the feature that makes ally support actually work, and I have not seen it
done well anywhere.

The tracker writes it **when they are well**, in their own words, as advance
instructions to their future ally:

- What helps when I am low
- What does not help, even though people mean well
- How to tell if I am worse than I am saying
- What I want you to do if you have not heard from me in a week
- What I do not want you to do

It is a personal advance directive for support, in the spirit of a crisis or
wellness plan, and it converts generic advice into instructions the specific
person actually endorsed. The app prompts to write it during a "lifting" or
"steady" period, never during a low one, and prompts a review every 90 days.

### 8.4 Controls the tracker always holds

- **Revoke** from a two-tap path. Takes effect within 60 seconds. Server pairing
  destroyed, keys rotated.
- **Pause** for a chosen number of days. The ally is shown "sharing is paused"
  rather than nothing, and the tracker is told that is what the ally will see.
  Silence would be read as crisis; ambiguity here is worse than disclosure.
- **Cancel a pending alert** during the delay window.
- **History is not retroactive.** The ally never sees anything from before pairing.
- **The ally cannot export**, screenshot-proofing is impossible so do not pretend,
  but the ally-side app holds no historical store beyond the current band and the
  last four weekly digests.

### 8.5 Ally onboarding requirements

The ally must acknowledge, before pairing completes:

1. This is not monitoring. There is no guarantee of delivery, and no alert means
   nothing is wrong.
2. This is not an emergency service. If you are worried about immediate safety,
   call emergency services or a crisis line, do not wait for the app.
3. You are seeing a summary the person chose to share. It is not their medical
   record and it is not the whole picture.
4. They can pause or stop sharing at any time and that is their right, not a
   warning sign to confront them about.

Point 4 is load-bearing. Without it, revocation itself becomes a source of
conflict, and the tracker will stop using the app rather than face that.

### 8.6 Limits for v1

One ally. Design the data model for N, ship 1. Two allies doubles the consent
surface and the "who saw what" question with no evidence yet that anyone wants it.

---

## 9. Safety requirements

This section is non-negotiable and gates release.

**S1. The app never claims to monitor.** Onboarding, the ally acknowledgment, the
website, and the store listing all state that no one is watching and no alert is
guaranteed.

**S2. Nothing is ever sent to anyone automatically without prior explicit,
specific, revocable consent configured in advance by the tracker.** No exceptions,
including for high scores.

**S3. PHQ-9 item 9 response path.** When the response is greater than zero, the
flow, in order: acknowledge plainly and without alarm; do not block the app or
throw up a modal that punishes an honest answer; surface the safety plan and the
crisis resources inline; offer, as a choice the person makes, to notify the ally
or to call or text a crisis line; record the response locally. The response must
be identical in tone for a score of 1 and a score of 3, because a flow that
escalates visibly at higher scores teaches people to under-report.

**S4. Never gate care behind the app.** Crisis resources are reachable when
offline, when the tracker has not logged in weeks, and from the low-capacity home
screen.

**S5. No self-harm method information, ever**, including in any user-generated
free text that could be shared. Free text is never shared with the ally by
default; this is one of the reasons why.

**S6. Do not ask risk questions you cannot follow up.** This is why the full
C-SSRS is out of scope: it is a clinician-administered structured interview whose
value depends on a person on the other end. The PHQ-9 item 9 path above is the
appropriate ceiling for a consumer app with no clinical staff.

**S7. Clinical review before release.** At least one licensed mental health
clinician reviews the instrument set, the item-9 path, the ally alert copy, and
the appointment report. Document the review.

---

## 10. Privacy, identity, and pairing architecture

### 10.1 Identity

- No account, no email, no phone number, no name, no third-party sign-in for
  solo use. The app is fully functional with zero server contact.
- A locally generated device key pair exists from first launch. It is not
  transmitted anywhere until the tracker chooses to pair.

### 10.2 Pairing protocol

1. Tracker taps "invite a support person." The app generates a short,
   human-readable, single-use code (for example 8 characters from an unambiguous
   alphabet) with a 10-minute expiry, and posts a pairing offer containing the
   tracker's public key to the server, keyed by a hash of the code.
2. The tracker delivers the code out of band. The app does not send it. This
   matters: it means the server never sees a channel that identifies either party.
3. Ally enters the code, retrieves the offer, generates their own key pair, and
   posts their public key. Both sides derive a shared pairing.
4. The server stores: `pairing_id`, two public keys, two push tokens, ciphertext
   payloads, and timestamps. It stores no plaintext content, no identifiers, and
   no way to link the two devices to any person.
5. Payloads (band updates, digests, the "what helps me" card) are end-to-end
   encrypted client-side.

### 10.3 Revocation and rotation

Revocation deletes the pairing record server-side, rotates the tracker's key, and
is confirmed in the UI with what actually happened. The ally's app shows
"sharing ended" and clears its local cache.

### 10.4 Recovery

Optional and clearly explained: a recovery phrase, plus platform-native encrypted
backup (iCloud Keychain / Android Backup) as the default. The trade-off is stated
plainly rather than buried: no phrase and no backup means a lost phone is lost
data, and that is the price of holding no account.

### 10.5 Data handling commitments

- No third-party analytics SDK. No attribution SDK. No ad SDK. If any usage
  telemetry exists at all it is opt-in, aggregate, contains no health data, and
  is first-party.
- Crash reporting opt-in only, with health data scrubbed from payloads.
- Server retention: encrypted payloads expire after 30 days. Pairing records
  expire after 180 days of inactivity with warning.
- The privacy policy states honestly that the operator cannot read the data and
  also that the ally knows who the tracker is, so "anonymous" is scoped to the
  operator, not to the relationship.

---

## 11. Data model (sketch)

```
entry            id, ts, tz, tier, valence, energy, anxiety, irritability,
                 anhedonia, function, sleep_hours, sleep_quality,
                 source (widget|notification|app|passive), partial (bool)
event            id, ts, type, label, dose_note, ended_ts
instrument_score id, ts, instrument, version, item_responses[], total,
                 band, flagged_items[]
safety_plan      section, ordered rows, updated_at
helps_card       section, rows, updated_at, last_reviewed
pairing          pairing_id, role, their_pubkey, created_at, scopes[],
                 paused_until, revoked_at
prompt_log       scheduled_ts, delivered_ts, responded_ts, tier, surface,
                 outcome (responded|dismissed|expired|snoozed)
policy_state     computed metrics, current cadence, last_rule_fired, overridden
```

`prompt_log` is what makes section 6 possible and is also the honest record of
whether the app is asking too much. Keep it even though it is not user-visible.

---

## 12. Platform requirements

### iOS

- **Minimum iOS 17.** Required for interactive widgets via App Intents, which is
  the primary logging surface on iOS, and for HealthKit State of Mind. iOS 18
  additionally offers Control Center controls, which is a cheap bonus surface.
- **Widget:** WidgetKit, small and medium sizes, App Intent buttons that record
  without launching the app. The small widget carries four valence targets; the
  medium carries valence plus an "add more" affordance. Lock Screen widgets are
  not interactive and are display-only.
- **Notifications:** `UNNotificationCategory` with up to four actions, visible on
  long-press expand. Note the real constraint: **iOS does not show action buttons
  on a collapsed banner**, so notification-first logging is inherently worse on
  iOS than on Android. Plan accordingly; the widget carries iOS.
- **Time Sensitive** interruption level for check-in prompts so they surface
  through Focus modes when the user permits it. Never use Critical alerts.
- **HealthKit:** read sleep analysis; write State of Mind so entries appear in the
  Health app and remain portable if the user leaves.
- **watchOS:** Smart Stack widget and a complication as the fastest possible
  surface. High value, moderate cost. Candidate for v1.1.

### Android

- **Minimum API 26, target latest.**
- **Notifications:** up to three direct-tap actions on the notification itself,
  handled by a `BroadcastReceiver` that writes the entry without starting an
  activity. This is the best logging surface on either platform; make it the
  Android default.
- **Widget:** Glance / RemoteViews app widget with direct-tap actions.
- **Quick Settings tile:** `TileService` as a secondary surface. Limited
  interaction model; treat as a bonus, not a requirement.
- **Wear OS tile**: same value proposition as watchOS. v1.1.
- **Health Connect:** read sleep.
- **Scheduling reality:** `POST_NOTIFICATIONS` runtime permission on 13+;
  `setExactAndAllowWhileIdle` is restricted on 12+; Doze and, worse, aggressive
  OEM battery managers (several major manufacturers) will silently kill scheduled
  work. Requirement: a "notifications are not arriving" diagnostic screen that
  detects the likely cause and links to the OEM-specific settings page. Every
  reminder app that skips this gets one-star reviews it cannot answer.

### Cross-platform stack

The shared surface (data model, scoring, cadence policy, charts, report
generation) is roughly 55 to 65 percent of the code. The rest is unavoidably
native: widgets, notification categories, tiles, HealthKit and Health Connect.

Recommendation, with the caveat that your existing familiarity should probably
win: **Kotlin Multiplatform** for the shared core with native SwiftUI and Compose
UI, because the platform-specific surface is unusually large here and the app's
own UI is small. **Flutter** is the reasonable alternative if you want one UI
codebase quickly and accept writing two native widget extensions anyway.
**React Native** is the weakest fit for this particular app because of the widget
and notification-action requirements.

---

## 13. Regulatory and store compliance

Not legal advice. These are the surfaces you need to look at, and I have flagged
where I am uncertain.

### 13.1 FDA posture

Position the app as **general wellness / low risk**: it records what the user
reports and helps them share it. Avoid device-claim language: no "detects
depression," no "diagnoses," no "tells you when your treatment is failing," no
"predicts episodes." Displaying an instrument's own published severity band with
attribution is common practice in consumer apps, but it is the closest the app
gets to the line; keep it descriptive and never pair it with a recommendation to
change treatment.

### 13.2 US privacy law

- **FTC Health Breach Notification Rule** applies to non-HIPAA health apps,
  including those drawing data from sources like HealthKit. Local-first plus
  end-to-end encryption materially reduces exposure because a server breach
  yields ciphertext.
- **Washington My Health My Data Act** is, in my assessment, your largest legal
  exposure as a free solo project. It covers consumer health data broadly,
  requires a separate consumer health data privacy policy, requires consent for
  collection and a separate authorization for sharing, and carries a private
  right of action. Budget real time for this. **Nevada SB 370** is similar.
  Several state comprehensive privacy laws add sensitive-data consent rules.
- **HIPAA does not apply** to you unless you act as a business associate of a
  covered entity. Do not claim HIPAA compliance; it would be both false and a
  signal you have not read it.
- **COPPA**: set a minimum age. Recommend 18+, or 16+ with the ally feature
  disabled below 18.

### 13.3 Outside the US

GDPR treats mental health data as special category data under Article 9,
requiring explicit consent and a lawful basis, and brings DPA, DSR, and
representative obligations. **Recommendation: restrict v1 availability to the US
and Canada**, and expand deliberately. This is a legitimate scope cut, not a
cop-out.

### 13.4 App stores

- **Apple:** Guideline 1.4.1 (medical apps, accuracy and disclaimers), 5.1.1 and
  5.1.3 (health data; may not be used for advertising or shared with third
  parties except for health purposes), privacy nutrition labels, and the account
  deletion requirement if accounts exist (local-only avoids it entirely).
- **Google Play:** Health apps declaration, Sensitive Data policy, Data Safety
  section, and Health Content policies.
- Both stores review mental-health apps more closely than average and both expect
  crisis resources to be present. Section 9 covers this.
- Expect at least one rejection round. Build two weeks of slack into the schedule.

---

## 14. Free, with donations

### 14.1 Cost model

Year one cash: Apple Developer Program 99 USD/yr, Google Play 25 USD one-time,
domain ~12 USD/yr, backend on a free tier (Cloudflare Workers plus D1, or
Supabase). Roughly **140 USD to launch, under 20 USD/yr thereafter** if the
solo-use path never touches your server, which the local-first architecture
guarantees. Push notification delivery via APNs and FCM is free.

### 14.2 Where the donation ask goes

**Website only. No donation surface inside the app.** Reasons, in order:

1. **Store policy risk.** Apple restricts in-app donation collection and treats
   charitable flows as a special case tied to approved nonprofits; a personal
   college fund is not a nonprofit. Play similarly ties non-IAP donation
   collection to registered nonprofits. I am not certain how a reviewer would
   treat a plain outbound link in an About screen, and recent changes to external
   link rules in the US storefront make the answer storefront-dependent. The
   cost of finding out is a rejection cycle on an app someone is waiting for.
2. **Trust.** A donation ask inside a mental health app is a different thing from
   a donation ask on a website. Inside the app, at any point in a check-in flow or
   near a low-mood entry, it is indefensible. Keeping it out entirely removes the
   question.

### 14.3 Disclosure requirements for the website

State plainly, without euphemism, in the same visual weight as the ask:

- The app is free, with no ads, no paid tier, and no data sold or shared.
- Donations go to the developer's daughter's college fund.
- Donations are **not tax-deductible** and this is **not a charity**.
- Donations do not affect the app, buy features, or fund development.

That is a completely legitimate thing to do and it stays legitimate as long as it
is stated exactly that plainly. Ambiguity is the only thing that would make it
look bad. Route payment through a platform that does not require you to publish a
home address (Ko-fi, Buy Me a Coffee, GitHub Sponsors, or a Stripe payment link),
and be aware that personal gifts through some processors can generate tax
paperwork above certain thresholds; check with an accountant if it becomes
non-trivial.

---

## 15. Success metrics

The only metric that matters for v1: **your friend is still using it at week 12,
and one psychiatry appointment went measurably better because of it.** Everything
else is instrumentation for that.

| Metric | Target at week 12 | Why |
|---|---|---|
| Days with at least one Tier-1 entry, rolling 28 days | 60% or better | EMA adherence in depression research typically starts at 60-80% and decays; sustaining 60% at three months is a real result |
| Median time from prompt tap to saved entry | under 5 seconds | the core design bet |
| Share of entries made without opening the app | over 70% | if this is low, the widget and notification work failed |
| Appointments preceded by a generated report | over 80% | the value loop closed |
| Weekly digest opened by the ally | over 70% | the ally feature is alive |
| Ally-initiated contact within 48h of a "drifting down" band | any nonzero, tracked qualitatively | the ally feature is working |

**Anti-metrics, watched as warnings:**

- Prompts dismissed without action, rising: the cadence policy is wrong.
- Uninstall or long silence following a low period: the app got heavier when it
  should have got lighter.
- Sharing paused or revoked: the ally feature is misfiring. Ask, do not assume.
- Free-text entries getting longer and more negative over time: possible
  rumination amplification. Investigate.

---

## 16. Explicitly out of scope for v1

Multiple allies; a clinician portal or login; passive sensing beyond sleep
(location, screen time, typing dynamics, voice); any machine-learning prediction;
an AI chat companion; medication reminders; journaling with guided prompts;
community or social features; a web app; Android Auto or CarPlay; internationalization
beyond US English; anything that requires a user account.

---

## 17. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | PHQ-9 or QIDS-SR16 as the severity anchor | PHQ-9 by default because it is what the clinician reads without explanation; offer QIDS-SR16 as an option, since it has better change sensitivity and bidirectional sleep and appetite items that matter in treatment resistance |
| D2 | Multidimensional (valence + energy + anxiety) or depression-only | Multidimensional. Section 3. |
| D3 | Ally feature in v1 or v2 | **v2.** It is roughly half the engineering and nearly all the risk. Ship solo tracking to your friend in weeks, learn, then build the ally on evidence rather than on assumption. This is the recommendation I am least certain about, because the ally idea may be the reason your friend engages at all. |
| D4 | Which platform first | Whichever your friend uses. Do not build both at once. |
| D5 | Stack: Kotlin Multiplatform or Flutter | KMP if you are comfortable in Kotlin, Flutter if you want one UI fast. Section 12. |
| D6 | Geography | US and Canada only for v1. Section 13.3. |
| D7 | Open source | Yes, from day one. It is the answer to "what if you stop maintaining it," and it makes the privacy claims auditable rather than promised. |
| D8 | Name | Avoid clinical words and avoid cheerful ones. Something short and neutral. |

---

## 18. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Prompt fatigue leads to abandonment by week 4 | high | section 6 policy; taper on stability; no guilt copy; five-second logging |
| Ally feature used coercively or triggers conflict | high | section 8 controls; band-only sharing; delayed alerts with cancel; explicit ally acknowledgment |
| False reassurance: "no alert, so they must be fine" | high | S1, repeated in ally onboarding and in every digest footer |
| Item-9 disclosure with no adequate response path | high | S3, gates release |
| Data loss from local-first with no account | medium | platform-native encrypted backup on by default, recovery phrase optional, honest warning |
| Store rejection delays a launch someone is waiting on | medium | section 13; two weeks of schedule slack; no donation UI in-app |
| Washington MHMD or similar exposure | medium | local-first, E2E, separate consumer health data policy, US and Canada only |
| Measurement reactivity increases rumination | medium | neutral copy, no "why" prompts, watch the anti-metric |
| Solo maintainer stops; app becomes abandonware in someone's care | medium | open source, plain-format export, stated in the about screen |
| Built for one person, does not generalize | low for v1 | it is supposed to be built for one person; generalize later or not at all |

---

## 19. Build sequence

| Milestone | Content | Rough size |
|---|---|---|
| M0 | Design partner conversations: your friend, and if possible their psychiatrist. Validate the appointment report format before building it. | 1 week |
| M1 | Local-only logger: Tier 1 and 2, storage, trends, export. Ship to your friend via TestFlight or Play internal testing. | 3-4 weeks |
| M2 | Widget and notification surfaces, adaptive cadence policy, sleep integration | 2-3 weeks |
| M3 | Instruments, safety plan, crisis resources, appointment report, clinical review | 2-3 weeks |
| M4 | Ally: pairing, E2E, bands, digest, "what helps me" card, ally onboarding | 3-4 weeks |
| M5 | Policies, store compliance, listings, website, submission | 2 weeks plus rejection slack |

M1 is deliberately shippable on its own. If nothing after M1 ever gets built, your
friend still has a tool that works.

---

## Appendix A: things I am uncertain about

Stated explicitly so they get verified rather than inherited.

1. **Instrument licensing.** The table in 3.4 reflects the general standing of
   these scales as freely usable, but terms change and some have
   non-commercial-only conditions. Verify each in writing before shipping.
2. **Apple's current treatment of an outbound donation link** in a free app,
   particularly after recent US storefront changes to external link rules. Section
   14 routes around the question rather than answering it.
3. **Whether the ally feature belongs in v1** (D3). My recommendation to defer is
   an engineering-risk judgment, and it may be wrong if the ally relationship is
   what actually drives your friend's engagement. This is the one decision where I
   would weight your knowledge of the specific person over my general reasoning.
4. **The exact thresholds in section 6.** They are placeholders with defensible
   shapes. They need tuning against real data from one real person, which is
   another argument for shipping M1 early.
5. **Whether writing to HealthKit State of Mind** creates any additional
   obligation under Apple's health data guidelines beyond reading. Worth checking
   before committing to it.
