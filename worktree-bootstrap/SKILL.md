---
name: worktree
description: Manage git worktrees for local Next.js development — bootstrap a fresh worktree (install deps, copy .env.local, start Postgres, inject DATABASE_URL) and clean up stale worktrees and merged branches. Use when entering a fresh worktree, when `nextdev start` fails, or when asked to tidy up branches after a sprint.
---

# Worktree Management

---

## Bootstrap

Fresh git worktrees miss several pieces the main checkout has:

- **No `node_modules`** — worktrees share git objects but not dependencies.
- **No `.env.local`** — `vercel env pull` only runs against a linked project, and `.vercel/project.json` lives in the main checkout, not the worktree.
- **DSQL credentials won't work locally** — if the project uses AWS Aurora DSQL via the Vercel integration, auth requires a live OIDC token exchange that only runs server-side on Vercel. Locally the SDK times out or throws `MissingSecret`/`UnauthorizedException`.

The `worktree-bootstrap` CLI handles all of this in one command.

### Command

```sh
cd /path/to/worktree
worktree-bootstrap
```

One command, idempotent. Re-running is safe — install and .env.local copy both skip if already done.

### What it does (in order)

1. **Verify worktree** — errors if run from the main checkout.
2. **Staleness check** — warns if behind `origin/main` with commit count. Does not abort.
3. **Install deps** — detects package manager from lockfile and runs a frozen-lockfile install. Always runs.
4. **Copy `.env.local`** from `<mainRepo>/.env.local` to `<worktree>/.env.local`. Skipped if already exists.
5. **Start Podman Postgres** — finds a container matching `*-pg` with a postgres image. `podman start` if stopped.
6. **Derive `DATABASE_URL`** from the container's env and port mapping — `postgres://<user>:<pass>@localhost:<hostPort>/<db>?sslmode=disable`.
7. **Write `DATABASE_URL` to `.env.local`** in the worktree, overwriting any existing line.
8. **Done.** Report what was done. Do not suggest next steps or infer tasks from branch name. Wait for user instructions.

### The prisma.config.ts short-circuit pattern

```ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(process.env.DATABASE_URL
    ? {}
    : {
        adapter: /* dsql adapter with tokenProvider */,
      }),
});
```

`DATABASE_URL` being set is the "local mode" signal — `worktree-bootstrap` always sets it.

### CLI tools in worktrees — always use `npx`

```sh
# ❌ Fails in worktrees
pnpm prisma generate

# ✅ Works
npx prisma generate
```

### Trigger signals

Run `worktree-bootstrap` when:
- User enters a worktree and says "start the dev server" / "get this up and running"
- `nextdev start` exits with: `Cannot find module`, `MissingSecret`, `UnauthorizedException`, `OIDC`, `token expired`, `DsqlSigner`, or `ECONNREFUSED` on `:5432`
- User mentions they just did `git worktree add …`

### Creating worktrees safely

Use `wtadd` instead of bare `git worktree add` — fetches origin and fast-forwards main first:

```sh
wtadd ../feature-x -b feature-x
```

### cmux tab management

- `wtcc` — tags cmux workspace with branch name and worktree path on launch
- `wtcc-status` — list all cmux workspaces with current working directories
- `wtcc-recover` — after a cmux crash, reopen all worktree tabs with Claude launching
- `wtpr` — find open PRs from remote agents and open selected ones as worktrees in CMUX

### After adding a new migration

Apply via `/api/admin/migrate` endpoint (GET to check, POST with `{"script":"your-migration.sql"}`). Do not manually apply DDL to `public`.

### Manual fallback

```sh
pnpm install --frozen-lockfile
cp ../main-repo/.env.local .
podman start myproject-pg
grep -v '^DATABASE_URL=' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
echo 'DATABASE_URL="postgres://postgres:postgres@localhost:5432/myproject?sslmode=disable"' >> .env.local
nextdev start
```

---

## Cleanup

Removes stale local branches and prunable worktrees after confirming their PR status on GitHub.

### Steps

**1. Show current state**
```sh
git worktree list
git branch -a
```

**2. Check PR status**
```sh
gh pr list --state all --base main --limit 100 --json headRefName,state,title,mergedAt \
  | jq -r '.[] | "\(.state)\t\(.headRefName)\t\(.title)"' | sort
```

Categorize: **MERGED** → safe to delete | **CLOSED** → confirm with user | **OPEN** → leave alone | **No PR** → confirm with user

**3. Prune worktrees**
```sh
git worktree prune
```
Safe to run unconditionally — only removes already-prunable worktrees.

**4. Delete merged branches**
```sh
git branch -d <branch1> <branch2> ...          # safe delete
git branch -D <confirmed-merged-branch> ...    # force-delete for squash-merged
```

Do NOT force-delete branches with no PR, CLOSED PRs, or anything unconfirmed.

**5. Report** — summarize what was deleted and flag anything left for user to decide.

### Notes
- Squash-merge workflows often leave branches that `git branch -d` considers unmerged even though GitHub shows MERGED — use `-D` after confirming via `gh pr list`.
- Remote branches are not deleted. Run `git remote prune origin` to also clean stale remote-tracking refs.
