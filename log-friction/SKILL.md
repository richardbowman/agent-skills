---
name: log-friction
description: Log a piece of agent-side operational friction (a wrong turn, wasted retry, stale doc, tool that didn't behave as documented, dead end, or missing capability) hit during any task. INVOKE PROACTIVELY the moment you hit friction worth remembering — don't wait for your final report, and don't wait to be asked. Feeds the separately installed `agent-dream` skill's Phase 2a directly, so consolidation runs work from known problems instead of mining conversation transcripts for signals. Not for user-facing bugs or product issues — those go through normal reporting/Linear.
---

# Log Friction

## Harness portability

Set `AGENT_STATE_HOME` to the active harness state directory. Resolve `log.ts` relative to this skill directory rather than a Claude-only installation path; both Claude Code and Codex can execute the Node script through their shell tools. The append-only, non-blocking behavior is unchanged.

A one-line tool: append a structured entry to `${AGENT_STATE_HOME}/friction-log.jsonl` describing something that went wrong in *how you worked*, not what the user asked for.

## When to invoke

Any of these, the moment it happens — not retroactively at the end of a task:

- You tried an approach, it failed, and you had to change strategy (the "two failures means change strategy" rule from the Task Procedure).
- A tool, CLI, or API behaved differently than its docs said it would.
- A skill's instructions were wrong, stale, or missing a step you had to work around.
- You wasted a non-trivial amount of time (multiple tool calls / a full retry cycle) before finding the real root cause.
- You hit a missing capability and had to improvise a workaround.

Skip it for: routine debugging with no real dead end, user preference corrections (the separately installed `agent-dream` skill's transcript mining already catches those), and anything already covered by an existing `feedback_*.md` memory file you're already aware of.

## How to invoke

```bash
node "<log-friction-skill-directory>/log.ts" \
  --agent <role, e.g. engineer|qa|reviewer|architect|main> \
  --project <repo or project slug, e.g. golden-wealth-app> \
  --summary "<one sentence — what went wrong>" \
  --detail "<what you tried, what the actual cause was, what you'd do differently>" \
  --severity low|med|high
```

Only `--summary` is required. Omit `--project` and it falls back to the current directory's basename; omit `--severity` and it defaults to `med`.

This never blocks or asks for confirmation — it's a pure append, safe to call mid-task. If the command itself errors (e.g. disk full), don't treat that as fatal to your task; just continue and mention it in your final report.

## What happens to logged entries

The separately installed [`agent-dream`](https://github.com/richardbowman/agent-dream) skill (run weekly or on demand) reads `${AGENT_STATE_HOME}/friction-log.jsonl` in Phase 2a, treats every entry as a pre-qualified signal, and folds it into the same pattern-analysis, deduplication, and feedback-file pipeline as transcript-mined signals. Repeated friction becomes a feedback rule or is escalated toward harness-level guidance.

## Design notes

- Single global JSONL (`${AGENT_STATE_HOME}/friction-log.jsonl`), not per-project—every agent appends here regardless of repo. The `project` field supports later filtering.
- Append-only, no rotation. `agent-dream` filters by `ts` against its own last-run cursor, so old entries simply age out of future runs without needing to be deleted.
