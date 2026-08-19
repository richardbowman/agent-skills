# agent-skills

Agent skill library — hand-authored skills that extend AI coding agents with domain knowledge, recipes, and workflows. Skill content supports Claude Code and Codex where the portability section in that skill's `SKILL.md` says so.

Companion to [claude-config](https://github.com/richardbowman/claude-config) (setup/dotfiles). These are the living, evolving skills; `claude-config` is the one-time machine setup.

## Setup

```sh
git clone https://github.com/richardbowman/agent-skills.git ~/Projects/agent-skills   # or ~/GitHub, ~/code, etc.
node ~/Projects/agent-skills/bootstrap.js
```

This existing bootstrap installs only into Claude Code: it symlinks every skill directory into `~/.claude/skills/` and every hook script in `hooks/` into `~/.claude/hooks/` so Claude Code picks them up automatically. Re-run after pulling to pick up new skills or hooks. Codex installation and discovery are handled by the separate dual-harness configuration workflow in `claude-config`, not by this bootstrap.

> **Note:** `claude-config`'s bootstrap clones this repo as a sibling directory and runs `bootstrap.js` automatically — you only need the above command for standalone setup.

## Skills

| Skill | Purpose |
|---|---|
| `backup-vercel-secrets` | Back up Vercel env vars to 1Password |
| `brain-dump` | Structured knowledge extraction — the assistant interviews you and saves to Obsidian |
| `brainstorm` | Active ideation partner — angles, frameworks, structured Obsidian output |
| `content-marketing` | Content strategy and marketing copy recipes |
| `dream` | Memory consolidation — scans conversation logs and agent-reported friction (see `log-friction`), updates memory files |
| `dsql` | Build with Aurora DSQL — schemas, queries, DSQL-specific patterns |
| `dsql-migrate` | Generate and apply Prisma migrations for Aurora DSQL |
| `dsql-schema` | Validate Prisma schema for DSQL compatibility |
| `dsql-setup` | Bootstrap a new project with Aurora DSQL + Prisma 7 |
| `e2e-local` | Run Playwright E2E tests locally |
| `find-docs` | Fetch up-to-date docs for any library or framework |
| `hiptrip-editor` | HipTrip editorial agent — write trips, curate hip places, publish |
| `log-friction` | Log agent-side operational friction (wrong turns, stale docs, wasted retries) for `dream` to consolidate |
| `nextjs-local-dev` | Run/monitor Next.js dev servers via the `nextdev` CLI |
| `podman-postgres` | Local Postgres via Podman |
| `production-readiness` | Production readiness checklist and review |
| `rb-personal-assistant` | Gmail triage, drafting, newsletters, travel planning |
| `remotion-video-ads` | End-to-end Remotion video production — TTS, Whisper sync, landing page embed |
| `task-triage` | Task and issue triage workflows |
| `vercel-tools` | Vercel CLI recipes — migrations, deployments, logs |
| `verify-before-coding` | Verify fast-moving APIs before writing code |
| `video-storyboard` | Pre-production for Remotion videos — script workshop, scene breakdown, Obsidian storyboard doc |
| `worktree-bootstrap` | Prep a git worktree for local Next.js dev |
| `youtube-watch-history-organizer` | Organize YouTube watch history into Obsidian |

## Hooks

Scripts in `hooks/` are symlinked into `~/.claude/hooks/` by `bootstrap.js`. They fire automatically based on the hook event configured in `~/.claude/settings.json`.

| Hook | Event | Purpose |
|---|---|---|
| `require-worktree.sh` | `PreToolUse` (Edit/Write) | Blocks edits to `~/projects/` unless you're in a linked git worktree |

## Excluding skills on a specific machine

Create a `.exclude` file in the repo root (gitignored — machine-local only). One skill name per line, `#` for comments:

```
# Not relevant on this machine
hiptrip-editor
youtube-watch-history-organizer
backup-vercel-secrets
```

`bootstrap.js` reads this on every run — excluded skills are skipped during linking and any existing symlinks are removed. The skills stay in the repo and are available on other machines.

## Adding a skill

1. Create `<skill-name>/SKILL.md` (or `<skill-name>/README.md`) in this repo
2. Run `node <projects-dir>/agent-skills/bootstrap.js` to symlink it
3. Add the trigger to `~/.claude/CLAUDE.md`
4. Commit and push — other machines pick it up on next bootstrap

## Adding a hook

1. Add the script to `hooks/` in this repo
2. Run `node <projects-dir>/agent-skills/bootstrap.js` to symlink it into `~/.claude/hooks/`
3. Register it in `~/.claude/settings.json` (or `claude-config/settings.json`) under the appropriate `hooks` event
4. Commit and push — other machines get the script on next bootstrap (settings wiring is handled by `claude-config`)
