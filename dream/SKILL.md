---
name: dream
description: Memory consolidation + friction mining for Claude Code. Scans recent conversation logs to surface feedback opportunities, updates memory files, and keeps MEMORY.md lean. Run when the user invokes /dream or after a Stop hook flags 24h since last run.
---

# Dream — Memory Consolidation & Friction Mining

Modeled on Anthropic's unreleased auto-dream feature, extended with a friction-mining phase that mines conversation logs for moments where the user expressed frustration, corrected a mistake, or stated a preference — then turns those signals into new `feedback_*.md` memory files.

**Run time:** ~2-4 minutes. Run all phases in order, never skip.

---

## State files

| Path | Purpose |
|---|---|
| `~/.claude/dream-last-run` | ISO-8601 UTC timestamp of last completed dream |
| `~/.claude/projects/<project-slug>/memory/` | Per-project memory (feedback rules, project context) |

---

## Phase 1: ORIENT

Read current state before doing anything else.

```bash
# Last run timestamp
LAST_RUN=$(cat ~/.claude/dream-last-run 2>/dev/null || echo "never (defaulting to 30 days ago)")
echo "Last dream: $LAST_RUN"

# Count conversation files
find ~/.claude/projects -name "*.jsonl" | wc -l

# List existing feedback files across all project memory dirs
find ~/.claude/projects -path "*/memory/feedback_*.md" 2>/dev/null
```

Read all existing `MEMORY.md` files and `feedback_*.md` files so you know what's already captured before writing anything new.

---

## Phase 2: FRICTION SCAN

Run this Python script via Bash to extract user messages that signal frustration, corrections, or stated preferences. This is the core of what makes this skill different from standard memory consolidation.

```bash
python3 << 'PYEOF'
import json, glob, os, re
from datetime import datetime, timezone, timedelta

LAST_RUN_FILE = os.path.expanduser("~/.claude/dream-last-run")
LOGS_DIR = os.path.expanduser("~/.claude/projects")

# Determine scan window
try:
    with open(LAST_RUN_FILE) as f:
        raw = f.read().strip()
    last_run = datetime.fromisoformat(raw.replace('Z', '+00:00'))
except Exception:
    last_run = datetime.now(timezone.utc) - timedelta(days=30)

print(f"Scanning logs since: {last_run.isoformat()}\n")

# --- Friction signal patterns ---
FRICTION_PATTERNS = [
    # Direct corrections
    r"\bno[,\.!]\s", r"\bnope\b", r"\bwrong\b", r"\bincorrect\b",
    r"\bactually[,\.]", r"\bwait[,\.]", r"\bhold on\b",
    r"that'?s not", r"not what i", r"didn'?t want", r"don'?t want",
    r"why did you", r"why are you",
    r"doesn'?t (seem|look|feel) right", r"this (is|isn'?t) (weird|off|odd|broken)",
    r"not quite", r"close,? but", r"still (not|doesn'?t|isn'?t|wrong)",
    r"that'?s backwards", r"undo (that|this)", r"put (it|that) back",
    # Frustration
    r"\bugh\b", r"\bargh\b", r"\bffs\b", r"[\U0001F604-\U0001FAFF]",
    r"you keep", r"again you", r"i (told|said|asked) you( already)?",
    r"for the (second|third|\d+)(nd|rd|th)? time",
    # Redirects
    r"\bstop (doing|that|this)\b", r"never mind", r"nevermind",
    r"forget (it|that|this)", r"revert (that|this|it)",
    r"please don'?t", r"don'?t do that", r"try again",
    # Explicit rule declarations (high-value signals)
    r"from now on", r"always\b.{0,30}(do|use|run|check|make)",
    r"\bnever\b.{0,30}(do|use|run|add|create)",
    r"remember (to|that)\b", r"don'?t forget",
    r"i (prefer|want|need|like) you to",
    r"going forward", r"in the future",
]

# --- Praise patterns (to capture what's working) ---
# NOTE: bare words like "exactly" or "perfect" are too common in ordinary
# technical writing ("not exactly", "exactly the same bug") to use alone —
# anchor them to an affirmation construction instead.
PRAISE_PATTERNS = [
    r"that'?s (exactly|perfect|it|right)\b", r"exactly (right|what i (wanted|needed|meant))",
    r"^exactly[.!]?$", r"\bperfect[.!]", r"love (it|this|that)",
    r"(nice|great|good|awesome|fantastic) (job|work|call|catch|one)",
    r"that (works|worked|did it)", r"nailed it",
    r"\byes!?\b.{0,20}(that|this|perfect|exactly)",
]

# --- Fingerprints of Claude-authored dispatch text (NOT the user's own words) ---
# These show up as role:"user" in logs — Agent-tool task briefs, Workflow/skill
# dispatch messages, subagent voter prompts — but Rick never typed them.
ORCHESTRATION_MARKERS = [
    "## task procedure", "you are implementing", "you're implementing",
    "you are executing", "you're executing", "you are working in the git worktree",
    "the worktree is already set up at", "git worktree at `",
    "working directory (the git worktree)", "use todowrite to create a task list",
    "use taskcreate to create a task list", "end-to-end verification of every requirement",
]
SYNTHETIC_PREFIXES = [
    "Summarize this conversation",
    "This session is being continued",
    "Summary:\n",
    "The conversation above",
    "<task-notification>",
    "## Adversarial Claim Verifier",
    "## Synthesis:",
    "## Judge",
    'Run the "',  # Workflow/skill dispatch, e.g. Run the "deep-research" workflow.
    "You are updating an existing conversation summary with new messages.",
    "Below is a conversation transcript",  # tab-title / metadata generation prompts
    "You are helping fork a conversation into a new, self-contained thread",
]

def extract_text(content):
    """User message content can be a plain string OR a list of content blocks
    (the normal chat-UI format is a list). Pull text out of either shape —
    missing the list case silently drops the vast majority of real messages."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return ""

friction_compiled = [(re.compile(p, re.IGNORECASE), p) for p in FRICTION_PATTERNS]
praise_compiled = [(re.compile(p, re.IGNORECASE), p) for p in PRAISE_PATTERNS]

friction_hits = []
praise_hits = []
files_scanned = 0

for path in sorted(glob.glob(f"{LOGS_DIR}/**/*.jsonl", recursive=True)):
    # Nested subagent transcripts are Claude-to-Claude, never Rick — skip entirely.
    if "/subagents/" in path:
        continue
    try:
        mtime = os.path.getmtime(path)
        if mtime < last_run.timestamp():
            continue
        files_scanned += 1

        rel = path.replace(LOGS_DIR + "/", "")
        project = rel.split("/")[0]

        with open(path) as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            try:
                obj = json.loads(line)
                if obj.get("type") != "user":
                    continue
                content = extract_text(obj.get("message", {}).get("content"))
                if len(content.strip()) < 8:
                    continue
                # Skip pure tool result / JSON payload messages
                if content.startswith("{") or content.startswith("["):
                    continue
                # Skip system-injected and workflow/agent-dispatch messages —
                # these are Claude's own words routed through a user-role turn.
                if any(content.startswith(prefix) for prefix in SYNTHETIC_PREFIXES):
                    continue
                content_lower = content.lower()
                if any(marker in content_lower for marker in ORCHESTRATION_MARKERS):
                    continue
                # Catch-all: long, multi-section text reads as a written brief,
                # not something Rick typed in chat.
                if len(content) > 600 and content.count("\n## ") >= 2:
                    continue

                ts = obj.get("timestamp", "")[:10]
                session_id = obj.get("sessionId", "")[:8]

                # Look back for assistant context (what did Claude do just before?)
                prior_assistant = ""
                for j in range(max(0, i - 8), i):
                    try:
                        prev = json.loads(lines[j])
                        role = prev.get("message", {}).get("role", "")
                        if role != "assistant":
                            continue
                        c = prev.get("message", {}).get("content", "")
                        if isinstance(c, list):
                            for block in c:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    prior_assistant = block.get("text", "")[:200]
                                    break
                        elif isinstance(c, str):
                            prior_assistant = c[:200]
                        if prior_assistant:
                            break
                    except Exception:
                        pass

                entry = {
                    "ts": ts,
                    "session": session_id,
                    "project": project,
                    "text": content[:400],
                    "prior_assistant": prior_assistant,
                }

                for compiled, pattern in friction_compiled:
                    if compiled.search(content):
                        entry["matched_pattern"] = pattern
                        friction_hits.append(entry)
                        break

                for compiled, pattern in praise_compiled:
                    if compiled.search(content):
                        entry["matched_pattern"] = pattern
                        praise_hits.append(entry)
                        break

            except Exception:
                pass
    except Exception:
        pass

print(f"Files scanned: {files_scanned}")
print(f"Friction signals: {len(friction_hits)}")
print(f"Praise signals:   {len(praise_hits)}")
print()

print("=" * 60)
print("FRICTION SIGNALS")
print("=" * 60)
for h in friction_hits:
    print(f"\n[{h['ts']}] project={h['project'][:40]} session={h['session']}")
    if h.get("prior_assistant"):
        print(f"  Claude said: {h['prior_assistant'][:120]}...")
    print(f"  User said:   {h['text'][:300]}")
    print(f"  Pattern:     {h['matched_pattern']}")

print()
print("=" * 60)
print("PRAISE SIGNALS")
print("=" * 60)
for h in praise_hits[:15]:
    print(f"\n[{h['ts']}] project={h['project'][:40]}")
    print(f"  User said:   {h['text'][:200]}")
PYEOF
```

---

## Phase 3: PATTERN ANALYSIS

After reading the friction and praise output, reason through it **before** writing any files:

### 3a. Cross-reference against existing feedback

For each friction signal, check: does this match a rule already in `feedback_*.md`?

- **If yes → reinforcement.** Rule exists but was still violated. Note which file. Don't create a duplicate.
- **If no → new signal.** Candidate for a new feedback file.

### 3b. Quality filter

Discard signals that are:
- One-off or ambiguous (user correcting their own prompt)
- Too vague to produce an actionable rule
- Already well-covered by existing CLAUDE.md instructions

Keep signals that are:
- **Explicit rule declarations** ("from now on", "always", "never") — always keep
- **Repeated** across multiple sessions — strong signal
- **Specific enough** to write a clear How-to-apply

### 3c. Draft new feedback rules

For each keeper, draft:
- **Slug** — snake_case, e.g. `feedback_dont_ask_before_running_scripts`
- **Name** — short title
- **Rule** — the actionable statement
- **Why** — what the user said / what the pattern showed
- **How to apply** — specific, concrete

---

## Phase 4: MEMORY UPDATE

### 4a. Create new feedback files

Write to the appropriate project memory dir: `~/.claude/projects/<project-slug>/memory/feedback_<slug>.md`

For cross-project rules (communication style, tool habits), use the global project dir: `~/.claude/projects/-Users-<username>/memory/`

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

For existing rules still being violated, append to the bottom of that file:

```markdown
**Reinforced:** YYYY-MM-DD — still occurring. Example: "<brief quote>"
```

### 4c. Update MEMORY.md

Add a line for each new file:
```
- [<Name>](feedback_<slug>.md) — <one-line summary>
```

Keep MEMORY.md under 200 lines. Archive entries older than 90 days to `memory/archive/YYYY-MM.md` if needed.

### 4d. Memory consolidation

- Remove any MEMORY.md entries pointing to missing files
- Resolve contradictions: newer entry wins, old one moves to `memory/archive/`
- Replace any relative dates with absolute YYYY-MM-DD

---

## Phase 5: OBSIDIAN REPORT

If the user has an Obsidian vault, write a dated report. Check for a vault at `~/Documents/Personal/` or skip this phase if none exists.

```bash
DATE=$(date +%Y-%m-%d)
```

Write to: `~/Documents/Personal/Claude/dream-${DATE}.md`

```markdown
# Dream Session — YYYY-MM-DD

## Summary
- Scanned N files across N projects
- Found N friction signals, N praise signals
- Created N new feedback rules
- Reinforced N existing rules

## New Feedback Rules Created
## Existing Rules Reinforced
## Praise Patterns — Don't Regress These
## Friction Signal Log
## Insights
```

Add a wikilink in today's daily note at `~/Documents/Personal/Daily/${DATE}.md` under `## Claude Sessions`.

Open in Obsidian:
```bash
DATE=$(date +%Y-%m-%d)
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Claude/dream-${DATE}'))")
open "obsidian://open?vault=Personal&file=${ENCODED}"
```

---

## Phase 6: STAMP

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > ~/.claude/dream-last-run
echo "Dream complete. Next run in ~24h."
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

## Known scanner pitfalls (fixed 2026-07-01 — keep these in mind if you touch Phase 2)

- **User message content is usually a list of blocks, not a plain string.** The normal chat-UI format is `content: [{"type": "text", "text": "..."}]`. A filter like `isinstance(content, str)` silently discards nearly every real message and leaves only the rare plain-string ones — which are almost always Claude-authored dispatch text, not Rick's words. Always extract text from both shapes (see `extract_text()`).
- **Agent/Workflow dispatch text gets logged with `role: "user"`.** Task briefs Claude writes to spawn an engineer/agent ("You are implementing...", "## Task Procedure", worktree paths), Workflow-tool dispatch lines ("Run the \"...\" workflow"), and internal voter/judge prompts ("## Adversarial Claim Verifier") all show up as user turns in the JSONL but Rick never typed them. Filter these out by fingerprint (`ORCHESTRATION_MARKERS`/`SYNTHETIC_PREFIXES`) and by a length+header heuristic, or they'll dominate the friction/praise output and drown out real signal.
- **Nested subagent transcripts live under `<session>/subagents/*.jsonl`.** The recursive glob picks these up too — they're Claude-to-Claude, exclude the whole path.
- If a dream run's friction/praise counts are dominated by task-brief-looking text (long, multi-heading, worktree paths), that's a sign the filters above have gone stale against a new dispatch template — update the fingerprint lists rather than the results.
