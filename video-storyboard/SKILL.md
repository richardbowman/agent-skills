---
name: video-storyboard
description: Pre-production workflow for Remotion social videos. Creates a storyboard doc in Obsidian, workshops the script, and locks scene breakdown before any code is written. Always run this before remotion-video-ads on a NEW video.
---

# Video Storyboard — Pre-Production Skill

## Harness portability

Create/edit the storyboard with the harness's vault or filesystem tools. Open it with an available workspace navigation tool; if none exists, use the Obsidian URL scheme only after obtaining approval for GUI execution when required. The storyboard gate and user-approval steps are identical in Claude Code and Codex.

Use this skill at the START of any new Remotion video. The rule is: **storyboard before code**. No TTS, no Whisper, no composition until the script and scene plan are agreed on in Obsidian.

---

## When to invoke

- User wants to make a new video / ad
- Starting a new Remotion composition from scratch
- Reworking a video concept, not just tweaking timing

**Do NOT invoke** for timing updates, re-renders, or minor copy changes on an existing video — those go straight to `remotion-video-ads`.

---

## Step 1 — Name the video and create the storyboard doc

Create a new Obsidian doc at:
```
~/Documents/BankRate/Claude/<kebab-name>-storyboard.md
```

Use the template below. Open it in Obsidian using the MCP tool (preferred) — fall back to the URL scheme only if MCP is unavailable:

**Preferred:** use the harness's workspace navigation tool for `Claude/<kebab-name>-storyboard.md`.

**Fallback — URL scheme (may not work in all contexts):**
```bash
open "obsidian://open?vault=BankRate&file=Claude%2F<kebab-name>-storyboard"
```

Add a wikilink to today's daily note under `## Claude Sessions`.

---

## Step 2 — Fill the Brief section (ask Rick these questions)

Don't assume — ask before writing anything:

1. **Platform** — LinkedIn (16:9), Instagram/TikTok (9:16), or both?
2. **Duration target** — 15s, 30s, 60s?
3. **Core idea** — What's the one thing someone should take away?
4. **Tone** — Demo-style? Personal story? Educational? Punchy/hype?
5. **CTA** — What do you want people to do after watching?

---

## Step 3 — Script workshop

Write 3–4 script proposals in the doc, each with:
- The full script text
- Approximate duration (estimate ~2.5 words/second for natural speech)
- A brief note on what angle/tone it takes

**Rick's voice notes:**
- Natural, conversational — not sentence fragments
- First-person, says "I" — gives it a human voice
- Avoids robotic command framing ("Say:") — prefers "Ask it to" / "Tell it to"
- Strong opening word — avoid weak articles ("The", "A") as the first word since ElevenLabs voice clone cold-starts slowly on them

Wait for Rick to react and iterate before moving on. Don't proceed to the scene breakdown until a script is chosen and finalized.

---

## Step 4 — Scene breakdown

Once the script is locked, break it into scenes in the storyboard doc. For each scene:

| Field | What to write |
|---|---|
| **Scene name** | Short label (hook, plugin-reveal, synthesis, ost, cta, etc.) |
| **Script segment** | The exact words spoken in this scene |
| **Estimated frames** | Word count × 2.5 words/sec × 30fps — rough cut points |
| **Visual concept** | What's on screen — UI mockup, text animation, diagram, etc. |
| **Key animation** | What moves and how (fade up, spring pop, typewriter, etc.) |
| **Claude Code panel** | What's showing in the right panel (for dual-pane layouts) |

The frame estimates are rough — Whisper will give exact numbers after TTS. But having estimates helps Rick visualize the pacing before any audio is generated.

---

## Step 5 — Visual direction

Add a section to the doc for:

- **Color palette** — Confirm hex tokens to use. For agentic PM / product videos: Catppuccin Mocha for Obsidian pane, GitHub Dark for Claude Code pane, deep purple desktop gradient.
- **Layout** — Window chrome? Split pane? Full bleed? Phone mockup?
- **Mood** — What's the vibe? (Clean demo, cinematic, fast-cut hype, calm walkthrough)

---

## Step 6 — Pre-production gate

Before handing off to `remotion-video-ads`, confirm all of these in the doc:

- [ ] Script finalized (Rick approved)
- [ ] Scene count and rough frame estimates documented
- [ ] Visual direction agreed
- [ ] Platform(s) confirmed (aspect ratio locked)
- [ ] CTA copy confirmed

Only after all boxes are checked → invoke `remotion-video-ads` to generate TTS, run Whisper, and build the composition.

---

## Storyboard doc template

Use this as the starting template when creating the Obsidian doc:

```markdown
# <Video Title> — Storyboard

## Brief

| | |
|---|---|
| **Platform** | LinkedIn 16:9 / Instagram 9:16 / Both |
| **Duration target** | ~Xs |
| **Core idea** | |
| **Tone** | |
| **CTA** | |

---

## Script Workshop

### Current / Working Draft

> (paste script here)

**~Xs** | Notes:

---

### Proposed v1 — <angle>

> (script)

**~Xs** | Notes:

---

### Proposed v2 — <angle>

> (script)

**~Xs** | Notes:

---

## Scene Breakdown

*(Fill in once script is locked)*

| Scene | Script segment | Est. frames | Visual concept | Animation |
|---|---|---|---|---|
| hook | | 0–Xf | | |
| | | | | |

---

## Visual Direction

- **Colors:**
- **Layout:**
- **Mood:**

---

## Pre-Production Gate

- [ ] Script finalized
- [ ] Scene breakdown documented
- [ ] Visual direction agreed
- [ ] Platform / aspect ratio confirmed
- [ ] CTA copy confirmed

→ Hand off to `remotion-video-ads` once all checked.
```

---

## Key principle

The storyboard conversation IS the work. Rushing past it to code is how you end up re-rendering 4 times because the script felt wrong. The Obsidian doc is the source of truth — it lives past the conversation and can be revisited for future videos of the same type.
