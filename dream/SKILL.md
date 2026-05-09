---
name: dream
description: Memory consolidation + friction mining for Claude Code. Scans recent conversation logs to surface feedback opportunities, updates memory files, and keeps MEMORY.md lean. Run when the user invokes /dream or after a Stop hook flags 24h since last run.
---

# Dream — Memory Consolidation & Friction Mining

Modeled on Anthropic's unreleased auto-dream feature, extended with a friction-mining phase that mines conversation logs for moments where Rick expressed frustration, corrected a mistake, or stated a preference — then turns those signals into new `feedback_*.md` memory files.

**Run time:** ~2-4 minutes. Run all phases in order, never skip.

---

## State files

| Path | Purpose |
|---|---|
| `~/.claude/dream-last-run` | ISO-8601 UTC timestamp of last completed dream |
| `~/.claude/projects/-Users-rickbowman-projects-golden-wealth-app/memory/` | Golden Wealth project memory |
| `~/.claude/projects/-Users-rickbowman/memory/` | Global (cross-project) memory |

---

## Phase 1: ORIENT

Read current state before doing anything else.

```bash
# Last run timestamp
LAST_RUN=$(cat ~/.claude/dream-last-run 2>/dev/null || echo "never (defaulting to 30 days ago)")
echo "Last dream: $LAST_RUN"

# Count conversation files
find ~/.claude/projects -name "*.jsonl" | wc -l

# List existing feedback files
echo "=== GW project feedback ===" && ls ~/.claude/projects/-Users-rickbowman-projects-golden-wealth-app/memory/feedback_*.md 2>/dev/null
echo "=== Global feedback ===" && ls ~/.claude/projects/-Users-rickbowman/memory/feedback_*.md 2>/dev/null
```

Read all existing MEMORY.md files so you know what's already captured:
- `~/.claude/projects/-Users-rickbowman-projects-golden-wealth-app/memory/MEMORY.md`
- `~/.claude/projects/-Users-rickbowman/memory/MEMORY.md`

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
    # Frustration
    r"\bugh\b", r"\bargh\b", r"\bffs\b",
    r"you keep", r"again you", r"still (doing|not|wrong)",
    r"i (told|said|asked) you",
    # Redirects
    r"\bstop (doing|that|this)\b", r"never mind", r"nevermind",
    r"forget (it|that|this)", r"revert (that|this|it)",
    r"please don'?t", r"don'?t do that",
    # Explicit rule declarations (high-value signals)
    r"from now on", r"always\b.{0,30}(do|use|run|check|make)",
    r"\bnever\b.{0,30}(do|use|run|add|create)",
    r"remember (to|that)\b", r"don'?t forget",
    r"i (prefer|want|need|like) you to",
    r"going forward", r"in the future",
]

# --- Praise patterns (to capture what's working) ---
PRAISE_PATTERNS = [
    r"\bperfect\b", r"\bexactly\b", r"love (it|this|that)",
    r"that'?s (exactly|what i wanted|right|it|perfect)",
    r"(nice|great|good) (job|work|call|catch|one)",
    r"that (works|worked|did it)",
    r"\byes!?\b.{0,20}(that|this|perfect|exactly)",
]

friction_compiled = [(re.compile(p, re.IGNORECASE), p) for p in FRICTION_PATTERNS]
praise_compiled = [(re.compile(p, re.IGNORECASE), p) for p in PRAISE_PATTERNS]

friction_hits = []
praise_hits = []
files_scanned = 0

for path in sorted(glob.glob(f"{LOGS_DIR}/**/*.jsonl", recursive=True)):
    try:
        mtime = os.path.getmtime(path)
        if mtime < last_run.timestamp():
            continue
        files_scanned += 1

        # Extract project slug from path
        rel = path.replace(LOGS_DIR + "/", "")
        project = rel.split("/")[0]
        session_file = rel.split("/")[-1].replace(".jsonl", "")[:8]

        with open(path) as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            try:
                obj = json.loads(line)
                if obj.get("type") != "user":
                    continue
                content = obj.get("message", {}).get("content", "")
                if not isinstance(content, str) or len(content.strip()) < 8:
                    continue
                # Skip pure tool result messages
                if content.startswith("{") or content.startswith("["):
                    continue
                # Skip system-injected messages (hook summaries, context continuations)
                if any(content.startswith(prefix) for prefix in [
                    "Summarize this conversation",
                    "This session is being continued",
                    "Summary:\n",
                    "The conversation above",
                ]):
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

After reading the friction and praise output, do this reasoning step **before** writing any files:

### 3a. Cross-reference against existing feedback

For each friction signal, check: does this match a rule already captured in `feedback_*.md`?

- **If yes → reinforcement.** The rule exists but Claude violated it. Note which existing file covers it. Don't create a duplicate.
- **If no → new signal.** Candidate for a new feedback file.

### 3b. Quality filter

Discard signals that are:
- One-off or ambiguous ("no," followed by user correcting their own prompt)
- Too vague to produce an actionable rule
- Already well-covered by existing CLAUDE.md global instructions

Keep signals that are:
- **Explicit rule declarations** ("from now on", "always", "never") — always keep these
- **Repeated** across multiple sessions — strong signal
- **Specific enough** to write a clear How-to-apply

### 3c. Draft new feedback rules

For each keeper, draft:
- **Slug** — snake_case, e.g. `feedback_dont_ask_before_running_scripts`
- **Name** — short title
- **Description** — one sentence
- **Rule** — the actionable statement
- **Why** — what Rick said / what pattern showed it
- **How to apply** — specific, concrete

### 3d. Identify praise patterns

Praise signals tell you what's working — don't accidentally regress those behaviors. Note them in the Obsidian report but don't create feedback files for praise.

---

## Phase 4: MEMORY UPDATE

### 4a. Create new feedback files

For each new feedback rule, write a file to the appropriate memory dir.

Use **GW project memory** (`~/.claude/projects/-Users-rickbowman-projects-golden-wealth-app/memory/`) for rules specific to that codebase (Vercel, DSQL, migrations, worktrees).

Use **global memory** (`~/.claude/projects/-Users-rickbowman/memory/`) for rules that apply everywhere (communication style, workflow habits, tool usage patterns).

Format — must match existing files exactly:

```markdown
---
name: <Short title, title case>
description: <One sentence describing the rule>
type: feedback
---

<The rule, plainly stated in 1-3 sentences.>

**Why:** <Direct quote or paraphrase of what Rick said, or description of the pattern found. Include date if possible.>

**How to apply:** <Specific, actionable guidance. Tell Claude exactly what to do differently.>
```

### 4b. Reinforce violated rules

For each **existing** rule that was still being violated, append to the bottom of that file:

```markdown
**Reinforced:** YYYY-MM-DD — still occurring. Example: "<brief quote from signal>"
```

### 4c. Update MEMORY.md index

For each new file, add a line to the appropriate `MEMORY.md`:

```
- [<Name>](feedback_<slug>.md) — <one-line summary>
```

Keep MEMORY.md under 200 lines. If it grows beyond that, archive entries older than 90 days to `memory/archive/YYYY-MM.md`.

### 4d. Memory consolidation (standard)

- Remove any entries from MEMORY.md that reference deleted or missing files
- Resolve contradictions: newer entry wins, move old one to `memory/archive/`
- Convert any relative dates to absolute YYYY-MM-DD in all memory files

---

## Phase 5: OBSIDIAN REPORT

Write a dream session note to the vault.

```bash
DATE=$(date +%Y-%m-%d)
```

Write to: `~/Documents/Personal/Claude/dream-${DATE}.md`

Structure:

```markdown
# Dream Session — YYYY-MM-DD

## Summary
- Scanned N files across N projects
- Found N friction signals, N praise signals
- Created N new feedback rules (list them)
- Reinforced N existing rules (list them)
- Memory consolidation: removed N stale entries, resolved N contradictions

## New Feedback Rules Created
<!-- For each new file: - `feedback_slug.md` — what it captures -->

## Existing Rules Reinforced
<!-- Rules that are still being violated — these need extra attention -->

## Praise Patterns — Don't Regress These
<!-- What's working well -->

## Friction Signal Log
<!-- Full list of friction hits for audit, grouped by project -->

## Insights
<!-- Anything that stood out — patterns across projects, systemic issues, etc. -->
```

After writing, add a wikilink to today's daily note at `~/Documents/Personal/Daily/${DATE}.md` under `## Claude Sessions`. Create the section if it doesn't exist.

Open the report in Obsidian:

```bash
DATE=$(date +%Y-%m-%d)
ENCODED_DATE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Claude/dream-${DATE}'))")
open "obsidian://open?vault=Personal&file=${ENCODED_DATE}"
```

---

## Phase 6: STAMP

Mark completion:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > ~/.claude/dream-last-run
echo "Dream complete. Next run in ~24h."
```

---

## Tips for signal quality

**High-value friction signals:**
- "From now on..." / "Always..." / "Never..." — user is explicitly encoding a rule
- Same mistake appearing across multiple sessions (different session IDs, same pattern)
- User had to re-explain something they already said in a prior session
- Explicit frustration ("you keep doing this", "again")

**Low-value noise (discard):**
- "No wait, I meant..." — user correcting their own prompt
- "Hmm" with no follow-up correction
- Technical "no" (e.g., "No need to create a test file")
- Praise-then-correction ("Great work! Oh wait, one thing...")

**When multiple signals cluster into one theme:** write one feedback file covering the theme, not one file per signal. Quality over quantity.
