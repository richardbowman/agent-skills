---
name: dream
description: Memory consolidation and friction mining. Scans supported conversation logs and agent-reported friction, updates memory files, and keeps the memory index lean.
---

# Dream — Memory Consolidation & Friction Mining

## Harness portability

Set `AGENT_STATE_HOME` to the active harness state directory (Claude: `$HOME/.claude`; Codex: its configured state home) before running commands. Read escalation guidance from `CLAUDE.md` or `AGENTS.md`. The bundled `scan.ts` currently understands Claude Code JSONL only: in a harness with an unsupported conversation-log format, report that limitation and skip only transcript mining; still process agent-reported friction, carryover, memory deduplication, and reporting. Never pretend an unsupported conversation-log source was scanned.

Modeled on Anthropic's unreleased auto-dream feature, extended with a friction-mining phase that mines conversation logs for moments where the user expressed frustration, corrected a mistake, or stated a preference — then turns those signals into new `feedback_*.md` memory files.

**Run time:** ~2-4 minutes. Run all phases in order, never skip.

---

## State files

| Path | Purpose |
|---|---|
| `${AGENT_STATE_HOME}/dream-last-run` | ISO-8601 UTC timestamp of last completed dream |
| `${AGENT_STATE_HOME}/projects/<project-slug>/memory/` | Per-project memory (feedback rules, project context) |
| `<dream-skill-directory>/scan.ts` | Canonical Phase 2 friction/praise scanner (Node/TS — see Phase 2) |
| `${AGENT_STATE_HOME}/friction-log.jsonl` | Agent-self-reported operational friction, appended via the `log-friction` skill — read directly in Phase 2a |
| `~/Documents/Personal/Claude/dream-YYYY-MM-DD.md` | Dated run reports (also the carryover source — see Phase 1) |

---

## Phase 1: ORIENT

Read current state before doing anything else.

```bash
# Last run timestamp
LAST_RUN=$(cat "${AGENT_STATE_HOME}/dream-last-run" 2>/dev/null || echo "never (defaulting to 30 days ago)")
echo "Last dream: $LAST_RUN"

# Count conversation files
find "${AGENT_STATE_HOME}/projects" -name "*.jsonl" | wc -l

# Count agent-reported friction entries waiting to be read (see Phase 2a)
wc -l "${AGENT_STATE_HOME}/friction-log.jsonl" 2>/dev/null || echo "0 (no friction-log.jsonl yet)"

# List existing feedback files across all project memory dirs
find "${AGENT_STATE_HOME}/projects" -path "*/memory/feedback_*.md" 2>/dev/null

# Flag feedback files older than 90 days — archive candidates for Phase 4d.
# This is a real check every run, not a note: don't let files silently age
# past 90 days unreviewed.
echo "--- Feedback files older than 90 days (archive candidates) ---"
find "${AGENT_STATE_HOME}/projects" -path "*/memory/feedback_*.md" -mtime +90 2>/dev/null

# Most recent prior dream report — the carryover source (see below)
ls -t ~/Documents/Personal/Claude/dream-2*.md 2>/dev/null | head -1
```

Read all existing `MEMORY.md` files and `feedback_*.md` files so you know what's already captured before writing anything new.

### 1a. Carryover check — don't drop prior open items

Read the **most recent prior `dream-YYYY-MM-DD.md` report** (the `ls -t ... | head -1` above). Look for anything it flagged as open, unresolved, deferred, or "surface to Rick" — e.g. an `## Open question`, a "not yet archived, pending" note, or a friction signal it logged but didn't act on. Carry those items into this run's consideration so they don't fall off the radar (the review found first-run open items were silently dropped afterward). If a carried-over item is now resolved, note that in this run's report; if still open, re-surface it rather than letting it disappear.

### 1b. Archive age triage — age is necessary but NOT sufficient

If the >90-day list is non-empty, for each file read its `**Why:**` date and any `**Reinforced:**` dates — the *most recent in-file date* (not the file's mtime) is what counts; a file can have an old mtime but a recent `Reinforced:` line, which means it's still active.

**Age alone never justifies archiving.** Most `feedback_*.md` files encode standing rules (technical constraints, tool quirks, process preferences) that stay true indefinitely — a DSQL schema constraint or a Vercel CLI flag doesn't go stale just because it's 90 days old, and archiving it would silently remove a rule Claude still needs every session. Only mark a file as a real archive candidate for Phase 4d if, in addition to being >90 days old, it shows independent evidence of staleness:
- The project/repo/tool it references no longer exists or was replaced
- A newer, contradicting feedback file supersedes it
- It describes a one-time event or a since-fixed bug, not a standing constraint
- Rick explicitly said it's no longer needed

If old but still active, leave it and note "checked, kept" in the report. If unsure on a batch, list them for Rick rather than deciding unilaterally.

---

## Phase 2: FRICTION SCAN

Run the canonical scanner to extract user messages that signal frustration, corrections, or stated preferences. This is the core of what makes this skill different from standard memory consolidation.

```bash
node "<dream-skill-directory>/scan.ts"
```

This is a checked-in Node/TypeScript file (per Rick's global "never use Python for scripts" rule — Node 22.6+ runs `.ts` natively, no build step). Do **not** reimplement this in a Bash/Python heredoc each run — always invoke the canonical script so fixes to the fingerprint lists (see "Known scanner pitfalls") persist across runs instead of being re-derived from memory.

To modify the scanner's filtering, edit `<dream-skill-directory>/scan.ts` and re-run it. It holds the pattern and fingerprint lists that filter synthetic dispatch/relay/cron text logged with `role: "user"`.

---

## Phase 2a: AGENT-REPORTED FRICTION (structured, pre-qualified)

Separate signal source from the transcript scan above: agents can self-report operational friction through the `log-friction` skill, which appends to `${AGENT_STATE_HOME}/friction-log.jsonl`. This is a different signal class than Phase 2's transcript mining—the agent's own account of what went wrong in how it worked, rather than the user's reaction to the result. It skips Phase 2.5 because it was intentionally authored by an agent.

```bash
# No canonical script needed — this file is small enough to read directly.
cat "${AGENT_STATE_HOME}/friction-log.jsonl" 2>/dev/null
```

Each line is one JSON object: `{ts, agent, project, summary, detail, severity, cwd}`. Keep only entries whose `ts` is after `$LAST_RUN` (same cursor as Phase 1). Treat every surviving entry as a **pre-qualified candidate** — skip Phase 2.5 for these, and carry them straight into Phase 3 alongside (not instead of) the transcript-mined hits. If `friction-log.jsonl` doesn't exist yet or has zero new entries, note that in the report and move on — it's expected to be sparse until agents adopt the habit.

---

## Phase 2.5: CLASSIFY SURVIVORS (don't trust the regex alone)

This phase applies only to Phase 2's transcript-mined hits — Phase 2a's agent-reported entries are already pre-qualified and skip straight to Phase 3.

The regex/fingerprint filters in `scan.ts` are a cheap prefilter, not a verdict. They will always lag one step behind new dispatch templates (verified: there is no structural discriminator in the logs — cron dispatches, inter-thread relays, and real human messages all carry identical envelope fields `entrypoint='sdk-ts'` / `promptSource='sdk'` / `userType='external'`, so content is the only signal). Treat every hit the script prints as a **candidate**, not confirmed signal, and apply judgment before Phase 3:

For each friction/praise hit, check it against these tells of Claude-authored (not Rick-authored) text, even if it slipped past the fingerprint lists:
- Third-person references to "Rick" instead of first-person "I"/"me"
- Imperative/instructional phrasing ("Run:", "Step 1 —", "You are the ... monitor")
- File paths, VINs, tracker notes, or other machine-oriented detail no human types conversationally
- Near-identical text recurring across many session IDs on a schedule (daily/weekly/monthly) — a cron/dispatch template, not one-off typing
- Very long, structured, multi-section text with headers — a written brief, not a chat message

Silently drop any hit that fails this check. Don't carry it to Phase 3, and don't flag it to Rick unless it reveals a **new** noise-source pattern worth fixing in `scan.ts`.

If you drop 3+ hits this way in one run, the fingerprint lists have gone stale: update `ORCHESTRATION_MARKERS`/`SYNTHETIC_PREFIXES` in `scan.ts` with the new pattern **before finishing this run**, and log it in "Known scanner pitfalls" with today's date. This keeps the fix in the reusable script instead of being silently re-applied by judgment every run.

---

## Phase 3: PATTERN ANALYSIS

After reading the friction and praise output, reason through it **before** writing any files.

### 3a. Cross-reference against existing feedback — reinforcement is first-class

For **every** surviving friction signal — both the Phase 2.5 survivors and the Phase 2a agent-reported entries — first check: does it match a rule that already exists in a `feedback_*.md`? This is a required step, not optional — a signal that matches an existing rule is a *reinforcement*, not a new rule, and must never spawn a duplicate file.

- **Match found → reinforcement.** The rule exists but was violated again. Note which file; you'll append a `Reinforced:` line in Phase 4b.
- **Escalation trigger:** if a rule already carries **2 or more prior `Reinforced:` lines** (i.e. this run would be the 3rd+ time it's been violated), the rule is not working as passive memory. Flag it in the report for escalation — it should move up to the always-loaded layer (the relevant `CLAUDE.md`, project or global) instead of living only in a `feedback_*.md` that clearly isn't changing behavior. Surface this to Rick; don't just append another Reinforced line and move on.
- **No match → new signal.** Candidate for a new feedback file, subject to 3b and 3c.

### 3b. Quality filter

Discard signals that are:
- One-off or ambiguous (user correcting their own prompt)
- Too vague to produce an actionable rule
- Already well-covered by existing CLAUDE.md instructions

Keep signals that are:
- **Explicit rule declarations** ("from now on", "always", "never") — always keep
- **Repeated** across multiple sessions — strong signal
- **Specific enough** to write a clear How-to-apply

### 3c. Dedup check — do not proliferate near-duplicate rules

Before drafting any new rule, grep the target project's existing `feedback_*.md` files for topic overlap (by keyword: the tool, command, file, or concept the new rule is about). Feedback files accumulate and overlap silently — real examples that already exist and should be merged rather than joined by a third sibling: `feedback_migrations_never_apply_direct.md` vs `feedback_local_schema.md` (both "don't patch schema directly"); `feedback_worktree_commands.md` vs `feedback_vercel_cwd.md` (both worktree-CLI quirks).

Decision order for a would-be new rule:
1. **Same topic as an existing file →** extend/reinforce that file, don't create a new one.
2. **Overlaps 2+ existing files that clearly belong together →** consolidate them into one and fold the new point in (handled in Phase 4d).
3. **Genuinely new topic →** create a new file (Phase 4a).

### 3d. Draft new feedback rules

For each keeper that survived 3a–3c, draft:
- **Slug** — snake_case, e.g. `feedback_dont_ask_before_running_scripts`
- **Name** — short title
- **Rule** — the actionable statement
- **Why** — what the user said / what the pattern showed
- **How to apply** — specific, concrete

---

## Phase 4: MEMORY UPDATE

### 4a. Create new feedback files

Only for signals that cleared the Phase 3c dedup check. Write to `${AGENT_STATE_HOME}/projects/<project-slug>/memory/feedback_<slug>.md`. For cross-project rules, use the corresponding global project directory beneath `${AGENT_STATE_HOME}/projects/`.

Use this exact format:

```markdown
---
name: <Short title, title case>
description: <One sentence>
type: feedback
---

<The rule, plainly stated in 1-3 sentences.>

**Why:** <Direct quote or paraphrase. Include date if possible.>

**How to apply:** <Specific, actionable guidance.>
```

### 4b. Reinforce violated rules

For existing rules matched in 3a, append to the bottom of that file:

```markdown
**Reinforced:** YYYY-MM-DD — still occurring. Example: "<brief quote>"
```

If this is the 3rd+ reinforcement (escalation trigger from 3a), also add the rule to the report's escalation list and propose the concrete `CLAUDE.md` line it should become.

### 4c. Update MEMORY.md

Add a line for each new file:
```
- [<Name>](feedback_<slug>.md) — <one-line summary>
```

Keep MEMORY.md under 200 lines.

### 4d. Memory consolidation & archive actions

- Remove any MEMORY.md entries pointing to missing files; add entries for any orphaned `feedback_*.md` that exist on disk but were never indexed.
- **Merge the overlapping files identified in Phase 3c:** pick the best-titled of the pair as the survivor, fold the other's content in (keep both `Why`/`Reinforced` histories), delete the redundant file, update `MEMORY.md`.
- Resolve contradictions: newer entry wins, old one moves to archive.
- Replace any relative dates with absolute YYYY-MM-DD.
- **Act on the Phase 1b archive candidates** (only those that cleared the staleness gate, not age alone): create `memory/archive/YYYY-MM.md` in that project's memory dir if absent (named for the file's creation month), append the archived file's full content under a `## <original filename>` heading **plus a one-line note on why it was archived** (superseded / project gone / fixed), delete the original, remove its `MEMORY.md` line. Don't leave this as "noted but not done."

---

## Phase 5: OBSIDIAN REPORT

If the user has an Obsidian vault (`~/Documents/Personal/`), write a dated report; otherwise skip this phase.

```bash
DATE=$(date +%Y-%m-%d)
```

Write to: `~/Documents/Personal/Claude/dream-${DATE}.md`

```markdown
# Dream Session — YYYY-MM-DD

## Summary
- Scanned N files across N projects
- Found N friction signals, N praise signals (after Phase 2.5 filtering)
- N agent-reported friction entries processed (Phase 2a)
- Created N new feedback rules, merged N, archived N
- Reinforced N existing rules (N flagged for escalation)

## Carryover From Last Run
<Prior open items and their current status — resolved or still open. "None" if clean.>

## New Feedback Rules Created
## Existing Rules Reinforced
## Escalations — Rules That Should Move to CLAUDE.md
## Consolidations & Archives
## Praise Patterns — Don't Regress These
## Friction Signal Log
## Agent-Reported Friction (Phase 2a)
<Each entry from friction-log.jsonl processed this run, and how it was handled — new rule, reinforcement, or discarded as too vague.>
## Open Items / Carry Forward
<Anything unresolved this run — the NEXT run's carryover reads this section.>

## Insights
```

Add a wikilink in today's daily note at `~/Documents/Personal/Daily/${DATE}.md` under `## Claude Sessions`.

Open in Obsidian with the `obsidian_navigate_to_file` tool (path `Claude/dream-${DATE}`) rather than a shell `open` — the tool is more reliable and avoids a Python one-liner for URL encoding.

---

## Phase 6: STAMP

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > "${AGENT_STATE_HOME}/dream-last-run"
echo "Dream complete. Next scheduled run: Sunday 21:00 (Weekly /dream cron), or sooner if manually invoked."
```

---

## Tips for signal quality

**High-value friction signals:**
- "From now on..." / "Always..." / "Never..." — user explicitly encoding a rule
- Same mistake appearing across multiple sessions (different session IDs, same pattern)
- User had to re-explain something already stated in a prior session
- Explicit frustration ("you keep doing this", "again")

**Low-value noise — discard:**
- "No wait, I meant..." — user correcting their own prompt
- Technical "no" (e.g., "No need to create a test file")
- "Hmm" with no follow-up correction

**When multiple signals cluster into one theme:** write one feedback file covering the theme, not one per signal.

---

## Known scanner pitfalls (keep these in mind if you touch Phase 2 / scan.ts)

- **User message content is usually a list of blocks, not a plain string.** The normal chat-UI format is `content: [{"type": "text", "text": "..."}]`. A filter like `isinstance(content, str)`/`typeof content === 'string'` alone silently discards nearly every real message. Always extract text from both shapes (see `extractText()` in scan.ts).
- **Agent/Workflow dispatch text gets logged with `role: "user"`.** Task briefs Claude writes to spawn an engineer/agent ("You are implementing...", "## Task Procedure", worktree paths), Workflow dispatch lines ("Run the \"...\" workflow"), and internal voter/judge prompts ("## Adversarial Claim Verifier") all show up as user turns but Rick never typed them. Filter by fingerprint (`ORCHESTRATION_MARKERS`/`SYNTHETIC_PREFIXES`) and by a length+header heuristic.
- **Nested subagent transcripts live under `<session>/subagents/*.jsonl`.** The recursive walk picks these up too — Claude-to-Claude, exclude the whole path.
- If a run's friction/praise counts are dominated by task-brief-looking text (long, multi-heading, worktree paths), the filters have gone stale against a new dispatch template — update the fingerprint lists in scan.ts, not the results.
- **(2026-07-26) Recurring cron dispatch prompts read as friction/praise noise.** Standing jobs (Monthly Amazon Data Export, e-tron GT deal monitor) inject a fixed header/persona prompt every run that coincidentally matched friction patterns and dominated one scan (82 of 86 hits). Filtered via `SYNTHETIC_PREFIXES`/`ORCHESTRATION_MARKERS` entries. When a new recurring cron job is added, check its dispatch prompt against these lists.
- **(2026-07-26) Inter-thread relay messages read as Rick's words.** One thread messaging another via `obsidian_send_message_to_thread` logs as `role: "user"` wrapped in "Another Claude session sent a message:\n<agent-message from=...>". Claude-to-Claude, not Rick — filtered via `SYNTHETIC_PREFIXES` + an `<agent-message from=` substring check.
- **(2026-07-28) No structural discriminator exists — content is the only signal.** Verified on real logs: cron dispatches, inter-thread relays, and genuinely human-typed messages all carry identical envelope fields (`entrypoint='sdk-ts'`, `promptSource='sdk'`, `userType='external'`), because the Obsidian plugin routes everything through the same SDK path. Per-file human-turn-count also fails to separate them (the plugin fragments one conversation across many single-turn session files). So the regex prefilter + Phase 2.5 judgment pass is the right design; don't waste time re-attempting an envelope-field or turn-count classifier.
- **(2026-07-28) Phase 2 is a checked-in script, not a heredoc.** Run `<dream-skill-directory>/scan.ts` with `node`. Edit that file directly; don't reintroduce an inline copy.
- **(2026-07-28) Age ≠ staleness — never auto-archive on the 90-day mark alone.** First real run of the age-check found 21 of 33 feedback files already >90 days by mtime, most being still-active standing rules (DSQL constraints, migration policy). Phase 1b/4d require independent evidence of staleness before archiving; surface ambiguous batches to Rick.
- **(2026-08-14) Added Phase 2a — agent-reported friction.** The `log-friction` skill and `${AGENT_STATE_HOME}/friction-log.jsonl` add intentional agent reports alongside transcript mining. These entries skip Phase 2.5 because they are intentionally authored.
