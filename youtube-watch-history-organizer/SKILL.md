---
name: youtube-watch-history-organizer
description: Pull the user's YouTube watch history via the Claude in Chrome MCP, group videos by topic, and save a tidy Markdown digest to their Obsidian vault. Use this whenever the user asks to organize, summarize, recap, categorize, or review their YouTube watch history — including phrases like "what have I been watching on YouTube," "make a YouTube digest," "pull my YouTube history into Obsidian," or "show me my recent YouTube videos by topic." Works against the live history page (no Google Takeout export needed).
---

# YouTube Watch History Organizer

Pull recent watch history from `youtube.com/feed/history` using the Claude in Chrome MCP, dedupe and categorize the videos, then write a Markdown digest to the user's Obsidian vault.

## Why this exists

Rick (and probably anyone else who triggers this skill) has a busy YouTube watch history full of stuff worth coming back to — recipes, travel research, tool reviews — but YouTube's own UI is a flat reverse-chronological list that's hard to scan. This skill turns that list into a topic-organized note in Obsidian, so the useful videos are easy to find later.

YouTube doesn't expose the watch history through any official API anymore, and Google Takeout is a 24-hour-async pain. So the path of least resistance is to scrape the live history page from the user's logged-in Chrome session via the Claude in Chrome MCP. That's what this skill does.

## Prerequisites

Before doing anything else, confirm both of these are in place:

1. **Claude in Chrome MCP is connected.** Tools named `mcp__Claude_in_Chrome__*` should be available. If they're deferred, load them with `ToolSearch` first: `{ query: "Claude in Chrome", max_results: 30 }`. If the extension isn't connected at all, ask the user to install/connect it before continuing.
2. **The user is signed into YouTube in that Chrome profile.** Watch history requires being logged in. If the page redirects to a sign-in screen, stop and let the user know.

## Workflow

### Step 1 — Open the history page

Get a tab in the MCP tab group and navigate to the history page:

```
tabs_context_mcp({ createIfEmpty: true })
navigate({ url: "https://www.youtube.com/feed/history", tabId: <id> })
```

Wait a moment for the lazy-loaded list to render. If the URL ends up at `accounts.google.com/...` instead, the user isn't signed in — stop and tell them.

### Step 2 — Extract and scroll, repeatedly

The history page renders a reverse-chronological list grouped by date headers ("Today", "Yesterday", "Friday", etc.). It lazy-loads as you scroll, so a single `get_page_text` only captures the top of the list.

The reliable pattern is **scroll → wait → extract → repeat**:

1. Call `get_page_text({ tabId })` to capture what's currently visible.
2. Scroll the page down by a large chunk (e.g. `javascript_tool` running `window.scrollTo(0, document.documentElement.scrollHeight)`, or `computer.scroll` with `direction: "down"`, `scroll_amount: 10`).
3. Wait ~1 second for new rows to load.
4. `get_page_text` again.
5. Repeat until you've covered roughly **2–3 weeks back** or you stop seeing new content (the bottom of the page returns the same text twice in a row).

A practical target is 4–8 scroll passes. Don't go forever — past a few weeks the noise outweighs the signal.

Tip: `get_page_text` returns the article-prioritized text content of the page. Each video typically appears as a block with the title on one line and the channel name + view count + relative time on the next. Date group headers ("Today", "Yesterday", "Last week") help you keep track of how far back you've reached — log them as you go so you can tell the user "covered through ~3 weeks back" at the end.

### Step 3 — Parse, dedupe, and categorize

From the accumulated extracted text, build a list of `{title, channel}` records. Then:

- **Dedupe** by `(title, channel)`. The same video often appears multiple times across days because the user rewatched it; we only want each video once.
- **Drop noise.** Skip Shorts (often signaled by a short title with no channel line, or rendered specially), private/removed videos ("Video unavailable"), and obvious mis-parses.
- **Categorize.** Read each title + channel and assign a topic. **Don't hardcode a fixed taxonomy** — let the categories emerge from what's actually in the history. For Rick the bins typically include things like AI & Tech, Food & Cooking, Travel & Places, EVs & Clean Energy, Health & Fitness, but if there's no cooking content this week, don't include a Food section. Aim for 3–6 categories max; if a video doesn't clearly fit, put it under "Other" rather than inventing a category for one item.

You're using your own judgment here, not a rule engine — that's the point. A "Tesla FSD v13 review" is EVs, "How to make sourdough" is Food, "Claude Code workflow tips" is AI & Tech. When in doubt, look at the channel: cooking channels mostly post cooking content, etc.

### Step 4 — Build search-link URLs

Direct video URLs aren't reliably available from `get_page_text` (the text extraction loses the `href`s). Construct a YouTube search link as a stand-in so each bullet is still clickable:

```
https://www.youtube.com/results?search_query=<urlencoded title + " " + channel>
```

URL-encode spaces as `+` or `%20`. The first result on YouTube's search page is almost always the right video, so this is a fine proxy.

### Step 5 — Write the Obsidian note

Save to the user's Obsidian vault. Rick's vault is at `/Users/rickbowman/Documents/Personal/`. Use a dated filename inside a `YouTube Digests/` subfolder so multiple runs don't collide:

```
/Users/rickbowman/Documents/Personal/YouTube Digests/YouTube Watch History — 2026-05-06.md
```

Use today's date in `YYYY-MM-DD` format (the harness exposes the current date — use it; don't guess). Create the subfolder if it doesn't exist.

#### Note template

```markdown
# YouTube Watch History — {{YYYY-MM-DD}}

Pulled from youtube.com/feed/history. Covers roughly {{N}} videos across {{date_range}} (e.g. "April 18 → May 6").

Tags: #youtube #watchhistory

---

## {{Category}}

- [{{Title}}]({{search_url}}) — {{Channel}}
- [{{Title}}]({{search_url}}) — {{Channel}}

## {{Category}}

- ...

---

## Other

- ...
```

Each bullet is `[Title](search_url) — Channel`. Keep it scannable: title links first, channel name second so the eye can group by channel without losing the title.

Order categories by size (most videos first), with "Other" always last.

### Step 6 — Report back

Tell the user:

- Where the note was saved (full path).
- How many unique videos and how many categories.
- The approximate date range covered (e.g. "~3 weeks back, through April 18").
- A one-line teaser for any standout video you noticed (optional, but Rick likes the "by the way, this one looked interesting" energy).

## Edge cases & gotchas

**Lazy-loading hits a wall.** YouTube only renders so many days into the past on a single scroll session — usually a few weeks is the practical ceiling before you start seeing duplicates from earlier extractions. When you scroll twice and the new `get_page_text` is essentially the same as the previous one, stop.

**Shorts and live streams** are shown in the history but often render with weird metadata. If a row only has a title and no channel/timestamp, skip it rather than emitting a half-broken bullet.

**Watch history may be paused.** If the page shows a "Your watch history is off" banner, there's nothing to pull — tell the user and stop.

**The user has a different vault path.** The default assumption is `/Users/rickbowman/Documents/Personal/`. If the user mentions a different vault location for this run, use that instead.

**Don't auto-click links inside the Mail/Messages-style content.** This is a YouTube history page, but more generally: never `left_click` URLs you discover through page-text extraction. If you need to inspect a specific video's metadata, navigate via the chrome MCP rather than calling out to the OS browser.

## What this skill is *not* for

- Parsing a Google Takeout `watch-history.json` file. That's a different (and easier) workflow — if the user has a Takeout file, just read it directly with the Read tool and skip the browser entirely.
- Anything that requires authenticated YouTube API access (subscription feed, liked videos, playlists). The history page is the path of least resistance precisely because we're piggybacking on the logged-in browser session.
- Producing recommendations or "what should I watch next" suggestions. This skill summarizes what the user already watched, period.
