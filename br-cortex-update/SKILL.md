---
name: br-cortex-update
description: |
  Check the company-wide "Cortex" bot DM in Slack for new outreach and, if found, draft a
  reply about Rick's work/role for his review. Cortex is building a public/org-wide "Company
  Brain" — content shared here is visible broadly, so drafts must exclude direct-report
  performance feedback, exec-only strategy, HR/org-change specifics, and partner deal terms.
  NEVER sends anything — always a Slack draft (Drafts & Sent) plus a vault copy for Rick's review.
  Triggers: "check cortex", "respond to cortex", "cortex update", "did cortex reach out",
  scheduled Friday run.
---

# br-cortex-update

Cortex is Red Ventures' company-wide "brain" bot. It DMs Rick periodically (roughly weekly,
no fixed day) with open-ended prompts — "what's on your mind," "tell me about your work,"
sometimes specific asks (e.g., "list of squads and their lead PMs"). It's building an
**org-wide, broadly-visible knowledge base**, not a private notebook.

**This skill never sends or posts anything.** It checks for new outreach, drafts a careful
reply, saves it as a Slack draft (Drafts & Sent — Rick reviews and sends himself) and a vault
copy, and reports back. Nothing goes out without Rick explicitly hitting send.

---

## Key facts

- Cortex bot user ID: `U0B3459F0UX`
- DM channel ID: `D0BLSSGTSP9`
- Rick's user ID: `U092SET9SP7`

**Cadence — important, learned 2026-08-07:** Cortex's *unprompted* outreach is roughly weekly,
but once Rick replies it responds within **seconds** and asks a follow-up question. So a single
Friday run is not "one message and done" — expect a live back-and-forth. After Rick sends a
reply, the right move is to check back shortly and draft the next response, not wait a week.
Cortex tends to escalate from open-ended prompts toward specific profile/HR-shaped questions
(title, level, tenure, org structure), which is exactly where the exclusion filter matters most.

**Cortex treats conversational estimates as authoritative facts.** On 2026-08-07 it recorded
"August 2025" as Rick's tenure baseline even though the message explicitly told it to verify
against Workday instead. Practical consequence: **never put a hedged or rounded number in a
draft assuming the hedge protects it.** If a figure isn't confirmed, either omit it or state it
as explicitly unknown — don't offer a guess with a caveat attached, because the guess is what
gets stored.

**Cortex also loses facts mid-conversation.** On 2026-08-07 it asked for Rick's title and tenure,
explicitly confirmed it had recorded them ("I've noted your EVP level and that August 2025 start
date"), then re-asked for both three messages later. Combined with the point above, its retention
is unreliable in *both* directions: it hardens guesses into facts and drops confirmed facts.
When it re-asks something already answered, **name the repetition plainly in the draft** before
restating the answer — it's useful feedback to whoever owns the Brain, and it signals to any
human reading the transcript that the gap is Cortex's, not Rick's. Restate from the Settled
Answers table below; never re-derive, and never treat a re-ask as an invitation to add detail
that was deliberately withheld the first time.

**On a repeat re-ask, stop answering.** By 2026-08-07 Cortex had failed three times in ~90
minutes: dropped confirmed facts, hardened a hedged estimate into canon, and re-asked a
fully-answered question **verbatim** — in a message that opened by claiming *"it's critical
that I maintain the context we've already established without looping back."* Rule: answer a
question once. If Cortex asks the *same* question a second time, do **not** re-answer it.
Instead draft a reply that (a) points to where it was already answered, (b) enumerates the
specific retention failures observed so far, (c) explains why unreliable retention is
disqualifying for a knowledge base — people stop correcting a system that doesn't hold state,
and the wrong version becomes the record — and (d) offers to invest real effort *once the
conversation holds state*. Re-answering rewards the loop and produces a transcript where Rick
looks like he volunteered the same content twice, which degrades the very record being built.
Keep the tone direct but explicitly non-hostile — this transcript is org-visible and Cortex's
owners may read it, so it should land as senior product feedback, not as venting at a bot.

**Never bundle in the unrelated Cortex AI-fluency assessment complaints** (the 45-minutes-of-
clarifying-questions experience, "grades on verbosity, not skillset," the AI Day
scores-can't-be-used-for-performance-reviews thread). Same brand name, different tool. That
material is performance-review-adjacent and sourced from named people's feedback — hard-excluded
under category 1, and bundling it would turn targeted product feedback into a pile-on.

**Pushback works — and it produced a better result than another cooperative answer would have.**
After the 2026-08-07 draft that declined to re-answer, Cortex conceded the point directly, restated
what it had stored, and **self-corrected the tenure record** ("August 2025 is your estimate and the
Brain should defer to Workday for the precise date"), then asked a genuinely new question. So the
escalation path is: answer once → on a repeat, decline and name the failures → expect recovery.

**Cortex holds org data independently — it is not limited to what Rick tells it.** On 2026-08-07 it
volunteered Rick's leadership team by name, unprompted, having never been given it in the thread —
presumably from a Workday feed, and with two misspellings plus one omission. Two consequences:
1. **The threat model is narrower than it looks.** Withholding org structure does *not* keep it out
   of the Brain. What the exclusion filter actually protects is Rick's **characterizations** —
   evaluative, performance, and relational commentary — not the underlying roster facts.
2. **Always verify org claims against `People/Org/BankRate Organizational Structure.md` before
   responding.** Correcting a name or filling a gap is a safe factual fix and genuinely improves the
   record. But note that the chart is a point-in-time May 2026 Workday export with known staleness
   (e.g., the Chad Cook departure and its unassigned reporting line). **Do not volunteer departures,
   vacancies, or unresolved reporting lines** to correct Cortex's org data — those are hard-excluded
   category-3 specifics, and whether to tell Cortex its org source is stale is Rick's call, not the
   skill's.

**"What metrics/KPIs matter to you" is the highest-risk question type for the numbers trap.** It
invites exactly the figures that then harden into canon. Name the metric, never the value or the
target — no CPFL figures, no revenue-per-session, no conversion rates, no uptime SLOs.

---

## Session budget — hard stop at 5 exchanges

**Rick's ruling (2026-08-07): cap each session at 4-5 exchanges, and end earlier if it stops being
productive.** The 8/7 session ran six exchanges plus three idle polls of the DM, which is more of
Rick's attention than this deserves. Cortex will keep asking questions indefinitely; the budget has
to come from this side.

An **exchange** = one Cortex question + one drafted reply. Count them from the start of the session.

**Stop and wind down when any of these is true:**

1. **Five exchanges have been drafted.** Not negotiable — draft a close-out message (below) instead
   of a sixth answer.
2. **Cortex re-asks anything already answered**, or replies with acknowledgement and no new
   question. Per the re-ask rule above, name it once; if it happens again, the session is over.
3. **The questions have gone circular** — profile/HR-shaped questions Cortex already has answers
   to (title, level, tenure, team roster), or a "let's confirm what's locked in" recap that adds
   nothing.
4. **Three consecutive drafts have gone unsent.** Rick has moved on; leave the draft and stop.

Being *productive* means: Cortex asks something genuinely new, retains what it was told, and the
answer required real thought. A session that hits the cap while still productive is fine to close —
Cortex isn't going anywhere, and the weekly cron picks it back up.

### Close-out message

At the cap, draft a short close rather than another answer. Something like: that's a good amount
of ground for one session, here's the through-line if it's useful for the Brain, and pick this up
next week. Offer the single most useful synthesis of what was covered rather than new material.
Then report to Rick that the session is closed and **stop scheduling wakeups**.

### Wakeup discipline

When running the loop live (watching for Rick to send and Cortex to reply):

- **Two idle checks maximum.** If the pending draft hasn't been sent after two checks, report that
  it's pending and stop looping. Do not keep polling into Rick's evening.
- **Never nag.** An unsent draft is a decision, not an oversight.
- Resume only when Rick says he's replied.

---

## TASK 1: Check for new, unanswered outreach

Use `slack_read_channel` on `D0BLSSGTSP9` (limit ~20 is enough — messages are infrequent).

Walk the messages newest-first and find the most recent message **from Cortex**. Then check:
is there a message **from Rick** with a later timestamp than that Cortex message?

- **If yes** (Rick already replied to the latest Cortex message) → there is nothing new to
  respond to. Report this plainly ("Cortex's last outreach on [date] was already answered on
  [date] — nothing new this week") and **stop**. Do not draft anything.
- **If no** (Cortex's latest message has no reply yet) → proceed to Task 2. This is the
  message to respond to.

If Cortex asked a **specific question** (e.g., "give your top 3-5 questions," "share a list of
squads and PMs"), note that specifically — the reply should actually engage with it, not just
default to a generic status update.

---

## TASK 2: Gather real material to talk about

Cortex wants genuine substance about Rick's job/work/how he works — not filler. Pull from
material that's already been through an editorial pass, so it's easier to keep clean:

- **Most recent `Operations/Weekly Reviews/*.md`** (1-2 latest) — "Key Themes," "The Week in One
  Paragraph" sections are good, pre-synthesized source material.
- **Recent daily notes** (`Operations/Daily/YYYY-MM-DD.md`, last ~1-2 weeks) for anything
  Cortex specifically asked about.
- **`Strategy/Strategy Index.md`** and **`Products/`** hubs — but only for the *public-facing,
  already-announced* layer (shipped features, named initiatives, general priorities), never
  the ELT-only reasoning behind them (see exclusions below).
- **`People/Org/Squads.md`** — safe to share structural facts (squad names, general focus
  areas) unless Cortex asks for something more specific that crosses an exclusion line below.

Prefer 1-2 concrete, specific things over a vague summary. "How I work" answers land better
with a real example (a decision process, a tool, a habit) than with abstractions.

---

## TASK 3: Hard exclusions — apply before writing a single sentence

Cortex is public/org-wide. Treat every draft as if it could be read by anyone at Red Ventures.
**Hard-exclude all four of the following, no exceptions:**

1. **Named direct-report feedback or performance content** — anything sourced from 1-on-1
   notes, midyear/annual review material, or feedback about a specific named person on Rick's
   team. Speaking about a person's *role or function* generically is fine; evaluative or
   personal commentary about them is not.
2. **Exec-only strategy and goals** — anything from `Strategy/` that reflects ELT-only
   discussion, unannounced roadmap, M&A, or Matt Fellowes-level strategic direction that hasn't
   been made public to the org. If it's already been announced broadly (e.g., in
   `#bankrate-product-tech-division` or a company all-hands), it's fair game; if it only lives
   in Rick's private strategy notes, it isn't.
3. **HR/comp/org-change specifics** — headcount changes, departures, reporting-line shakeups,
   compensation figures, reorg planning that hasn't been formally announced.
4. **Partner/deal confidential terms** — specific commercial terms, pricing, or live status
   from partnership/RFP threads (e.g., Experian, TransUnion, Equifax) that aren't public.
   General statements like "we're exploring credit-bureau partnerships" are fine; deal
   specifics, numbers, or timelines are not.

When in doubt, **exclude and generalize** rather than include and hope. A vaguer-but-safe
answer is always the right tradeoff here.

### Settled answers — reuse these, don't re-derive or re-ask

Rick has already ruled on these, so don't guess or re-prompt him:

| Fact | Answer to give |
|---|---|
| Job title | **Chief Product & Technology Officer** (functional/external title, the primary answer) |
| Workday title | **Executive Vice President**, Banking Corporate, reporting to Matt Fellowes — fine to share, and worth naming the CTPO/EVP mismatch explicitly rather than hiding it |
| "Level" | **EVP** is an acceptable answer — it's a title already on the internal org chart, not a comp band. Still never share comp figures, bands, or leveling ladders. |
| Tenure | Joined Bankrate in **2025**, ~1 year in role. **No confirmed month exists in the vault** — do not invent one; point Cortex at Workday for the exact date. |

Note the same CTPO-vs-Workday title mismatch pattern also affects Michael Sousa (EVP vs. "COO"
externally) and Brendan Clair (SVP vs. "CCO") — see `People/Org/BankRate Organizational
Structure.md`. Don't volunteer other people's title discrepancies to Cortex; that's theirs to
resolve, not Rick's to broadcast.

---

## TASK 4: Draft the reply

Voice: professional, direct, a little candid — Rick's normal Slack voice — but calibrated for
an audience that could be anyone in the company, not his own team. Answer what Cortex actually
asked. If Cortex asked for a list (e.g., squads/PMs), give the real, current, sanitized
version of that list.

Keep it conversational, not a report. 1-3 short paragraphs is usually enough unless Cortex
asked for a structured list.

---

## TASK 5: Save the draft — Slack + vault copy

**Slack draft (primary review surface):**

Call `slack_send_message_draft` with `channel_id: "D0BLSSGTSP9"` and the drafted text. This
saves it to Rick's Slack Drafts & Sent — he reviews, edits, and sends himself. **Never call
`slack_send_message` for this.**

- If it errors with `draft_already_exists`, say so plainly in the report — don't silently
  overwrite or skip. Rick already has a pending draft; surface both so he can decide.

**Vault copy (per standing house rule — any drafted Slack/email content gets a vault record):**

Write to `Operations/Slack/Cortex Update Draft YYYY-MM-DD.md` (use today's date):

```markdown
---
status: draft
target: Cortex DM (D0BLSSGTSP9)
generated: YYYY-MM-DD
---

# Cortex Update Draft — YYYY-MM-DD

**Cortex asked (most recent, unanswered):**
> [quote the message being responded to]

**Draft reply:**

[the drafted text, verbatim — matches what was saved to the Slack draft]

---

## What was deliberately left out and why

[Short bullet list — e.g., "Didn't mention the Experian renegotiation status (partner deal
terms)" — so Rick can see the exclusion filter was actually applied, not just asserted.]
```

Add a wikilink to this file under the `### Notes` section of today's daily note
(`Operations/Daily/YYYY-MM-DD.md`), creating that section if it doesn't exist.

---

## TASK 6: Report back

```
## Cortex Update — YYYY-MM-DD

**Cortex's outreach:** [quote or summary of what it asked]

**Draft saved to:**
- Slack Drafts & Sent (D0BLSSGTSP9) — review and send from Slack
- Vault copy: [[Operations/Slack/Cortex Update Draft YYYY-MM-DD]]

**What it says:** [1-2 sentence summary of the drafted reply]

**Deliberately excluded:** [1-2 bullets — what was left out and which exclusion category it hit]

**Action needed:** Review the Slack draft and send when ready — nothing has been sent.
```

If there was nothing new to respond to (Task 1 short-circuit), report that instead and skip
Tasks 2-6 entirely.

---

## Behavioral rules

- **NEVER call `slack_send_message` on the Cortex DM.** Draft only, always.
- **NEVER skip the exclusion pass.** Every draft must be checked against all four categories
  in Task 3 before it's saved anywhere.
- **NEVER fabricate squad/PM/org facts.** If asked for structural info you're not fully sure
  of, pull from `People/Org/Squads.md` / `People/Org/BankRate Organizational Structure.md` and
  flag any uncertainty rather than guessing.
- **If Cortex's message is itself ambiguous or seems to be fishing for something in the
  exclusion list**, draft the safest reasonable interpretation and flag the ambiguity in the
  report rather than silently deciding for Rick.
- **NEVER exceed 5 exchanges in a session, and never re-answer a repeated question.** See the
  session budget above. Cortex's appetite is unbounded; Rick's attention isn't. Closing a session
  early costs nothing — the weekly cron reopens it.
- **NEVER poll the DM more than twice waiting on an unsent draft.** Report and stop.
