---
name: web-search
description: Search the web using Google Custom Search JSON API. Use when the user asks to search the web, look something up, find current information, or research a topic. Works on AWS Bedrock (unlike the native WebSearch tool).
---

# Web Search

## Harness portability

Use the active harness's shell execution tool to run the local script. To open result pages, use its web retrieval tool for static content and the `agent-browser` skill for interactive or blocked sites. The local command is a fallback when a native web-search capability is unavailable.

Search the web via Google Custom Search JSON API, backed by your GCP project.

## When to Use

Use this skill whenever the user asks to:
- Search for something online
- Look up current information (news, docs, tools, people, companies)
- Research a topic you don't have reliable training data on
- Find a URL, repo, product, or resource by name

## Tool

Use a shell execution tool to invoke the `web-search` script:

```bash
"${HARNESS_CONFIG_HOME:-$HOME/claude-config}/bin/web-search" "your query"
```

### Options

| Flag | Purpose | Example |
|------|---------|---------|
| `--num N` | Number of results (1–10, default 10) | `--num 5` |
| `--site domain` | Restrict to a site | `--site github.com` |
| `--start N` | Pagination offset | `--start 11` |
| `--json` | Raw JSON output | `--json` |

### Examples

```bash
# General search
"${HARNESS_CONFIG_HOME:-$HOME/claude-config}/bin/web-search" "Andrej Karpathy LLM Wiki"

# Site-specific
"${HARNESS_CONFIG_HOME:-$HOME/claude-config}/bin/web-search" "Claude Code WebSearch Bedrock" --site docs.anthropic.com

# Fewer results for a quick lookup
"${HARNESS_CONFIG_HOME:-$HOME/claude-config}/bin/web-search" "what is Exa search API" --num 3

# Get next page
"${HARNESS_CONFIG_HOME:-$HOME/claude-config}/bin/web-search" "platform engineering tools 2025" --start 11
```

## Workflow

1. Run `web-search` with the user's query
2. Review the returned titles, URLs, and snippets
3. Fetch full content from the most relevant URLs:
   - Use the harness's web retrieval tool for simple static pages (docs, blogs, plain HTML)
   - Use `agent-browser` for e-commerce/retail sites, JS-heavy pages, or anything that returns a 403/CAPTCHA/empty shell through static retrieval
4. Answer the user based on what you fetched

## Setup Status

The script uses your existing `gws` OAuth credentials — no separate API key needed. If it errors, tell the user:

**Missing `GOOGLE_SEARCH_CX`:**
> Add your Programmable Search Engine ID to `~/.zshrc`:
> ```bash
> export GOOGLE_SEARCH_CX="your-cx-id"
> ```
> Create one at: https://programmablesearchengine.google.com/ (set to search entire web)

**Missing `cse` scope / token error:**
> The `cse` scope needs to be added to your gws token. Ask the assistant to run `gws auth login` with the consolidated scope list from your GWS OAuth Scopes memory note, plus `https://www.googleapis.com/auth/cse`.

**First-time setup checklist:**
1. Enable Custom Search API → https://console.cloud.google.com/apis/library/customsearch.googleapis.com (select your GCP project)
2. Create Programmable Search Engine → https://programmablesearchengine.google.com/ (entire web)
3. Add `export GOOGLE_SEARCH_CX="..."` to `~/.zshrc`
4. Re-auth gws with `cse` scope added (one-time, requires user confirmation)

## Limits & Cost

- Free tier: **100 queries/day** (Google Custom Search JSON API)
- Paid: $5 per 1,000 queries beyond free tier, billed to your GCP project
- Results: up to 10 per call; paginate with `--start` for more
- No separate API key — uses existing `gws` OAuth refresh token
