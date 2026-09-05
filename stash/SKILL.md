---
name: stash
description: Park the current work by writing a compact resumable handoff note to the vault and linking it from today's daily note.
---

# stash

## Harness portability

Read the current conversation through the harness's available message history and use its vault/file tools to write the note. A resume prompt must brief any new assistant session, not assume Claude-specific state or commands. Preserve existing vault folder and heading names for compatibility.

Wrap up the current conversation — summarize what was accomplished, capture the context needed to resume, write a stash note to the vault, and link it from today's daily note. Run at end of a session when you want to park the work cleanly.

## Overview

When a working session is winding down (context getting long, switching tasks, end of day), `/stash` produces a compact handoff note so the work can be picked up later without re-reading the full conversation. It captures what was done, what's in flight, and exactly what to run or say to get back up to speed.

The stash note is written to `Operations/Stash/` and linked from the `### Notes` section of today's daily note.

## Step-by-Step Process

### 1. Review the conversation

Scan the full conversation history and identify:

- **What was accomplished** — completed tasks, decisions made, artifacts created (files written, PRs opened, queries run, etc.)
- **What is in flight** — anything started but not finished, pending responses, open questions
- **Blockers or dependencies** — anything waiting on another person, system, or input
- **Key context** — repo paths, file paths, environment state, commands that were working, relevant IDs or URLs

### 2. Draft the stash note

Create a new file at:

```
Operations/Stash/YYYY-MM-DD - [topic-slug].md
```

Use today's date and a short 2–5 word kebab-case slug describing the session topic (e.g., `2026-05-29 - new-relic-audit.md`, `2026-05-29 - ia-nav-prototype.md`).

**Note format:**

```markdown
---
date: YYYY-MM-DD
topic: [human-readable topic name]
status: parked
---

# [Topic Name] — Session Stash

**Session:** YYYY-MM-DD · [rough time range if known]

## What Was Done

- [Completed task 1]
- [Completed task 2]
- [Artifact: [[path/to/file]] or URL]

## In Flight

- [Task started but not finished — include last known state]
- [Pending: waiting on X]

## To Resume

> Paste this to pick up where you left off:

```
[Resume prompt — a self-contained 2–4 sentence prompt that gives the next assistant enough context to continue. Include key file paths, what was being worked on, and what to do next. Write it in second person.]
```

## Key References

| Item | Path / URL |
|---|---|
| [file or resource name] | [vault path or URL] |

## Open Questions

- [Anything unresolved that needs a decision before resuming]
```

### 3. Write the file

Write the stash note to this vault-relative path:

```
Operations/Stash/YYYY-MM-DD - [topic-slug].md
```

**Resolve it against the actual vault root before writing.** If the harness exposes
vault-relative tools, prefer those. If writing via a filesystem tool that needs an
absolute path, confirm the vault root first — a path that merely *looks* like the
vault (e.g. `~/Documents/<VaultName>`) may be a different directory, and writing
there silently creates a shadow tree that masks the real vault. Verify the file
landed where you intended, and match the existing filename convention in the folder.

### 4. Link from daily note

Append to today's daily note, under the heading that vault already uses for session
links (commonly `### Notes` or `## Claude Sessions` — match what is there, do not add
a new heading). Locate the daily note first; the folder is commonly `Daily/` or
`Operations/Daily/`:

```markdown
- Stashed session: [[Operations/Stash/YYYY-MM-DD - [topic-slug]|[Topic Name] stash]]
```

If the daily note has a `- [ ]` task associated with the stashed work, do NOT remove it — the stash note is context, not task completion.

### 5. Confirm to user

Report back:
- The vault path of the stash note
- A one-sentence summary of what was captured
- The resume prompt (so they can copy it immediately if needed)

## File Locations

All paths are **vault-relative** — resolve them against the current vault root, which
the harness provides. Never hardcode an absolute path or a machine-specific home
directory; the same skill runs against different vaults on different machines.

- Stash notes: `Operations/Stash/`
- Daily notes: locate the vault's daily-note folder before writing — it is commonly
  `Daily/YYYY-MM-DD.md` or `Operations/Daily/YYYY-MM-DD.md`. Check which exists and
  match it rather than assuming, and append under the vault's existing daily-note
  heading for session links (commonly `### Notes` or `## Claude Sessions`) rather
  than creating a new one.

## Notes

- Keep the resume prompt tight — it should fit in one message. Don't try to summarize everything; just include what Claude needs to orient quickly and know what to do next.
- If multiple distinct topics were covered in the session, create one stash note per topic.
- `status: parked` means the work is paused. Change to `status: done` when the work is fully complete and archived.
- If a stash note already exists for this date + topic (re-stashing the same session), update the existing file rather than creating a duplicate.
