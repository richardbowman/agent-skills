---
name: podcast-summarize
description: >-
  Fetches a transcript from a YouTube podcast or video URL and writes a
  structured summary into an Obsidian note. Use when the user wants to
  summarize a podcast, capture key takeaways, or prepare a team-shareable
  write-up from a YouTube link.

  Trigger on: "summarize this podcast", "get a transcript", "write a summary
  for the team", "add notes to my podcast note", or any request involving a
  YouTube URL and a podcast/video.
---

# Podcast Summarize

Fetches a YouTube transcript and writes a structured summary — either into an
existing Obsidian note (if one is linked) or as a new note in the vault.

## Dependencies

Requires `youtube-transcript-api` Python package. Install once if missing:

```bash
pip3 install youtube-transcript-api
```

## Workflow

### Step 1 — Find the YouTube URL

Check for the URL in order:
1. The user's message directly
2. The linked Obsidian note (look for a `▶️ [YouTube](...)` line)
3. The daily note for today or yesterday if the user references "the podcast I was listening to"

Extract the 11-character video ID from any of these URL forms:
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID`

### Step 2 — Fetch the transcript

```python
python3 - <<'EOF'
import warnings
warnings.filterwarnings("ignore")
from youtube_transcript_api import YouTubeTranscriptApi

api = YouTubeTranscriptApi()
transcript = api.fetch("VIDEO_ID")
snippets = list(transcript)
text = " ".join([t.text for t in snippets])

with open("/tmp/yt_transcript.txt", "w") as f:
    f.write(text)

print(f"Done — {len(snippets)} segments, {len(text)} chars")
EOF
```

If `YouTubeTranscriptApi` has no `get_transcript` method, use the instance
pattern above (`api = YouTubeTranscriptApi(); api.fetch(...)`).

If the transcript is unavailable (private video, no captions), inform the user
and suggest the Lenny's Newsletter paid transcript as a fallback.

### Step 3 — Read and synthesize

Read `/tmp/yt_transcript.txt` in full. Synthesize a structured summary
(see **Summary Format** below). Do not quote large transcript blocks verbatim —
distill and paraphrase.

### Step 4 — Write the summary

**If an existing Obsidian note exists for this podcast:**
Append a `## Team Summary` section to that note, just before the
`## Where to Find` section (or at the end if none exists).

**If no note exists:**
Create a new note at `Podcasts/<Show> - <Episode Title> (<Guest>).md` using
the **Note Template** below.

---

## Summary Format

Write a `## Team Summary` section structured as follows:

```markdown
## Team Summary (for Slack / internal share)

> **"Episode Title"** — Guest Name on Show Name
> 🎧 [YouTube](URL) · ~Xh Ym

One-sentence framing of why this episode is relevant.

**The core argument in plain English.**
2–3 sentences summarizing the central thesis.

**Key predictions and observations:**
- Bullet 1
- Bullet 2
- Bullet 3 (aim for 4–7 bullets, each concrete and quotable)

**The insight that matters most.**
1–2 paragraphs on the most surprising or actionable takeaway.

**Most relevant to us:**
- How does this connect to our team's current work, strategy, or challenges?
- Draw explicit links — don't leave it abstract.

**Where to follow [Guest]:**
- Links from the episode (newsletter, community, X/LinkedIn)
```

Keep it scannable and opinionated. Write for a team of product + engineering
leaders who are busy. Lead with the "so what."

---

## Note Template (new notes)

```markdown
# <Episode Title> | <Guest Name> (<Affiliation>)

**Podcast:** <Show Name>
**Guest:** <Guest Name> — <role / affiliation>
**Published:** <date if known> · <duration if known>
**Shared by:** <person if known>

## Links

- 🎧 [Apple Podcasts](<url if known>)
- ▶️ [YouTube](<url>)
- 🎵 [Spotify](<url if known>)

## Summary

<2–3 sentence overview>

## Topics Covered

1. Topic one
2. Topic two
...

## Team Summary (for Slack / internal share)

<generated summary — see Summary Format above>

## Where to Find <Guest>

- <links from episode>
```

---

## Cleanup

After writing, delete the temp file:

```bash
rm -f /tmp/yt_transcript.txt
```

---

## Notes

- The `youtube-transcript-api` v1.2+ uses an instance pattern: `YouTubeTranscriptApi().fetch(video_id)` — not the old class-method `YouTubeTranscriptApi.get_transcript()`
- Auto-generated captions are usually available even without a PO token; manually uploaded transcripts may require one
- If `yt-dlp` is available it can also fetch subtitles: `yt-dlp --write-auto-sub --sub-lang en --skip-download -o /tmp/transcript "URL"` — but `youtube-transcript-api` is faster for this use case
- Lenny's Newsletter episodes often have paid transcripts at `lennysnewsletter.com` as a fallback
