---
name: slack-meeting-agenda
description: Generates a structured meeting agenda by reading a Slack channel and synthesizing the past week's activity into Decisions Needed and Updates & Discussion sections. Use this skill whenever someone asks to "generate the [meeting] agenda", "prep for [meeting name]", "refresh the weekly agenda", or "build an agenda from Slack". Requires a meeting config file — the user should provide the path, or it can be inferred from context.
---

# Slack Meeting Agenda Generator

Reads a Slack channel's recent activity and synthesizes a ready-to-run meeting agenda. All meeting-specific details (channel, participants, themes, output path) come from a config file — the skill itself stays generic.

---

## Step 1 — Load the Config

Read the YAML config file the user provides (or that the scheduled task references). It defines everything meeting-specific:

```yaml
channel_id: C0XXXXXXXXX        # Slack channel ID
channel_name: "#channel-name"  # Human-readable name for the footer
meeting_name: "Weekly Sync"    # Used in the agenda header
meeting_day: Monday            # Day the meeting occurs
output_path: /path/to/agenda.md

participants:                  # Real names for resolving Slack user IDs
  - Alice Smith
  - Bob Jones

themes:                        # Strategic topics to watch for when synthesizing
  - Topic A
  - Topic B

target_minutes: 75-90          # Total agenda time target
```

If any required field is missing, stop and ask the user before continuing.

---

## Step 2 — Read the Channel

Call `slack_read_channel` with:
- `channel_id`: from config
- `limit`: 60

This captures roughly one week of activity. Note messages with high reply counts — these signal live decisions or active debates.

---

## Step 3 — Read Key Threads

Identify the top **3–5 threads** worth surfacing. Read each with `slack_read_thread` (same `channel_id`, `thread_ts` from the parent message's `ts`).

A thread is worth reading if it has:
- Multiple replies from different people
- An open question or unresolved outcome
- A decision pending broader alignment
- A risk, blocker, or status change

Skip threads about scheduling logistics, absence notices, or purely social/celebratory messages.

**Resolve Slack user IDs to real names** using the participants list in the config as your primary reference. Call `slack_read_user_profile` if you encounter an ID not in the list.

---

## Step 4 — Synthesize the Agenda

Organize items into two sections:

### Decisions Needed
Things requiring a group call or directional alignment. Each needs an owner and a clear decision question.
- 🔴 High-priority (time-sensitive, blocking, or high-stakes)
- 🟡 Medium-priority (important but not urgent)

### Updates & Discussion
Status checks, FYIs, strategic topics worth shared context. No decision required but valuable to the group.
- 🟣 Discussion item

**For each item:**
- **Title** — verb-first, action-oriented ("Approve X", "Align on Y", "Review Z")
- **Owner** — real name(s) from the participants list
- **Time** — suggested allocation in 5-min increments (5–20 min)
- **Context** — 2–4 bullets drawn from Slack; paraphrase rather than quote verbatim
- **Prompt** — one sentence starting with **Decide:** or **Discuss:**

Use the `themes` list from config as signal amplifiers — if a thread touches a known strategic theme, weight it higher.

Target the `target_minutes` range from config. If items would exceed it, note which ones could be handled async.

If no clear decisions surfaced, say so briefly and weight the agenda toward Discussion.

---

## Step 5 — Write the Agenda

Write to the `output_path` from config, overwriting any previous content.

Compute the coming Monday's date for the header (or use today if today is Monday). The date range in the footer should be the Mon–Fri window that was read.

```markdown
# [meeting_name] — [Month D, YYYY]
*[participants count] attendees · ~[total] min · Generated [date]*

---

## Decisions Needed

### 🔴 [Title] (~X min)
**Owner:** [Name]
**Decide:** [One-sentence decision question]

- [Context bullet 1]
- [Context bullet 2]
- [Context bullet 3]

---

### 🟡 [Title] (~X min)
**Owner:** [Name]
**Decide:** [One-sentence decision question]

- [Context bullet 1]
- [Context bullet 2]

---

## Updates & Discussion

### 🟣 [Title] (~X min)
**Owner:** [Name]
**Discuss:** [One-sentence discussion prompt]

- [Context bullet 1]
- [Context bullet 2]

---

*Generated from [channel_name] · [Mon date] – [Fri date] · Next refresh: [following meeting_day]*
```

---

## Done

Confirm the agenda was written and give a one-line summary of the top 1–2 items.
