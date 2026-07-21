---
name: compass-feedback-triage
description: >
  Processes all OPEN feedback items in the Compass workspace and takes real product
  actions on each: dedup/link to an existing opportunity, create a new opportunity with
  a proposed solution and a testable assumption, promote high-vote items to the roadmap,
  or close noise. Keeps the OPEN feedback queue empty and every signal represented in the
  OST. Use for the scheduled Compass Feedback Triage cron job, or manually whenever
  customer feedback has piled up. This is the "intake" half of the Compass automation
  loop — pair with the `compass-resolver` skill (the "implementation" half) which acts on
  whatever this skill prioritizes onto the roadmap.
---

# Compass Feedback Triage

## Setup

1. Invoke the `compass` skill for the MCP tool catalog and data model if not already loaded.
2. `list_workspaces(orgSlug: "rbcodelabs")` → get the workspaceId for the workspace named
   "Compass" (slug `compass`).

## Processing loop

3. `list_feedback(workspaceId, status: "OPEN")` — if empty, report "queue already empty,
   no action taken" and stop. Do not fabricate work.
4. `list_opportunities(workspaceId)` for dedup/linking context.
5. `list_okr_cycles(workspaceId)` → find the `ACTIVE` cycle, then `get_okr_cycle(cycleId)`
   for its objectives/key results (for linking new opportunities to OKRs).

For **each** open feedback item:

a. `get_feedback_item(feedbackId)` for full details.
b. `update_feedback_status(feedbackId, status: "UNDER_REVIEW", note: "Being processed by
   Compass Feedback Triage")`.
c. Reason about it:
   - **Type:** bug report, feature request, UX friction, performance issue, or
     unclear/noise? (`update_feedback_type` can reclassify BUG vs IDEA if the current type
     looks wrong — bugs can go straight to the roadmap via `promote_feedback_to_roadmap`;
     ideas follow the Opportunity → Solution discovery flow.)
   - **Dedup:** does it closely match an existing opportunity?
   - **Urgency:** `voteCount >= 3`, or the description reads urgent/blocking?
d. Act:

   **Matches an existing opportunity:**
   - `link_feedback_to_opportunity(feedbackId, opportunityId)`
   - `update_feedback_status(feedbackId, status: "PLANNED", note: "Linked to existing
     opportunity: [title]")`

   **New and actionable (bug, feature, UX friction, performance):**
   - `create_opportunity` — title synthesized in clear PM phrasing; description:
     "Customer feedback: [original title]. [description summary]. [submitter if
     available]. Feedback ID: [id]."; status `EXPLORING`; link to the most relevant OKR
     key result if one fits.
   - `add_solution` with a concrete proposed solution.
   - `add_assumption` with the highest-risk testable assumption (`riskLevel: "HIGH"`).
   - `link_feedback_to_opportunity` to connect the original feedback to the new opportunity.
   - If `voteCount >= 3`: `promote_to_roadmap(solutionId, horizon: "NEXT")` — leave NOW
     alone; NOW is reserved for items a human or the `compass-resolver` skill has
     deliberately promoted, so triage doesn't flood the top of the kanban unsupervised.
   - `update_feedback_status(feedbackId, status: "PLANNED", note: "New opportunity
     created: [opportunity title]")`.

   **Noise, spam, or unclear:**
   - `update_feedback_status(feedbackId, status: "CLOSED", note: "Closed by feedback
     agent: [brief reason]")`.

Be decisive. If feedback is borderline, lean toward creating an opportunity rather than
closing — the goal is an empty OPEN queue with every real signal represented in the OST.

## Report

After processing all items, report:
- Total items processed.
- Items linked to existing opportunities (list them).
- New opportunities created (list them with titles, and NEXT-horizon promotions).
- Items closed as noise (list them).
- Any items skipped or that errored.

If this run took any real action (not the "queue already empty" no-op), follow the same
outcome-note + daily-note-link convention `compass-resolver` uses (see that skill's Step 9)
so triage runs are visible in the vault too: write a short note to
`~/Documents/Personal/Products/Compass/Runs/<workspace-slug>-YYYY-MM-DD-triage.md` and link
it under today's daily note's `## Claude Sessions` section.

## Pairing with compass-resolver

This skill only triages — it does not implement anything. Schedule it to run shortly
*before* the `compass-resolver` cron job (e.g. an hour earlier) so freshly triaged
NEXT/EXPLORING work has a chance to be manually promoted to NOW, or so `compass-resolver`'s
feedback-fallback tier has fresh, well-formed opportunities to pull from if NOW is empty.

`compass-resolver` now also backfills NOW itself: if NOW is empty when it runs, it scans
the items this skill has already promoted to NEXT and — if any of them are well-defined
enough to implement without a product decision — promotes exactly one to NOW itself (with
a distinct `⬆️` marker, not `🤖`) and stops without implementing, notifying via the vault
note above so a human can glance at it before the next run implements it. That's a
resolver-side decision (see its Step 1 tier 5 and its own well-defined checklist); this
skill's job is unchanged — keep the OPEN queue empty and feed NEXT with well-formed
opportunities, nothing more.
