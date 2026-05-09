# agent-skills

Agent skill library — hand-authored skills that extend AI coding agents (Claude Code, and compatible tools) with domain knowledge, recipes, and workflows.

Companion to [claude-config](https://github.com/richardbowman/claude-config) (setup/dotfiles). These are the living, evolving skills; `claude-config` is the one-time machine setup.

## Setup

```sh
git clone https://github.com/richardbowman/agent-skills.git ~/agent-skills
node ~/agent-skills/bootstrap.js
```

This symlinks every skill directory into `~/.claude/skills/` so Claude Code picks them up automatically. Re-run after pulling to pick up new skills.

> **Note:** `claude-config`'s bootstrap clones this repo and runs `bootstrap.js` automatically — you only need the above command for standalone setup.

## Skills

| Skill | Purpose |
|---|---|
| `backup-vercel-secrets` | Back up Vercel env vars to 1Password |
| `brain-dump` | Structured knowledge extraction — Claude interviews you and saves to Obsidian |
| `brainstorm` | Active ideation partner — angles, frameworks, structured Obsidian output |
| `content-marketing` | Content strategy and marketing copy recipes |
| `dream` | Memory consolidation — scans conversation logs, updates memory files, mines friction |
| `dsql` | Build with Aurora DSQL — schemas, queries, DSQL-specific patterns |
| `dsql-migrate` | Generate and apply Prisma migrations for Aurora DSQL |
| `dsql-schema` | Validate Prisma schema for DSQL compatibility |
| `dsql-setup` | Bootstrap a new project with Aurora DSQL + Prisma 7 |
| `e2e-local` | Run Playwright E2E tests locally |
| `find-docs` | Fetch up-to-date docs for any library or framework |
| `hiptrip-editor` | HipTrip editorial agent — write trips, curate hip places, publish |
| `nextjs-local-dev` | Run/monitor Next.js dev servers via the `nextdev` CLI |
| `podman-postgres` | Local Postgres via Podman |
| `production-readiness` | Production readiness checklist and review |
| `rb-personal-assistant` | Gmail triage, drafting, newsletters, travel planning |
| `remotion-video-ads` | End-to-end Remotion video production — TTS, Whisper sync, landing page embed |
| `roadmap-ship` | Mark roadmap items as shipped after merging |
| `task-triage` | Task and issue triage workflows |
| `vercel-tools` | Vercel CLI recipes — migrations, deployments, logs |
| `verify-before-coding` | Verify fast-moving APIs before writing code |
| `video-storyboard` | Pre-production for Remotion videos — script workshop, scene breakdown, Obsidian storyboard doc |
| `worktree-bootstrap` | Prep a git worktree for local Next.js dev |
| `youtube-watch-history-organizer` | Organize YouTube watch history into Obsidian |

## Adding a skill

1. Create `<skill-name>/SKILL.md` (or `<skill-name>/README.md`) in this repo
2. Run `node ~/agent-skills/bootstrap.js` to symlink it
3. Add the trigger to `~/.claude/CLAUDE.md`
4. Commit and push — other machines pick it up on next bootstrap
