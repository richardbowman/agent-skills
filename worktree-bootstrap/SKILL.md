---
name: worktree-bootstrap
description: Manage git worktrees for local Next.js development — bootstrap a fresh worktree (select the Node version the repo pins, install deps, copy .env.local, verify AUTH_SECRET survived the copy, start Postgres, inject DATABASE_URL) and clean up stale worktrees and merged branches. Use when entering a fresh worktree, when `nextdev start` fails, when an install fails with ERR_PNPM_UNSUPPORTED_ENGINE, when auth fails with MissingSecret, or when asked to tidy up branches after a sprint.
---

# Worktree Management

## Harness portability

The `worktree-bootstrap` command and bootstrap/cleanup workflow are harness-neutral. `wtcc`, `wtcc-recover`, and `wtpr` are Claude-specific helpers because they launch Claude Code; Codex sessions must use their native worktree/session launcher instead. Never invoke a Claude-specific helper from Codex merely to satisfy this skill.

---

## Bootstrap

Fresh git worktrees miss several pieces the main checkout has:

- **No `node_modules`** — worktrees share git objects but not dependencies.
- **No `.env.local`** — `vercel env pull` only runs against a linked project, and `.vercel/project.json` lives in the main checkout, not the worktree. Note that copying the main checkout's file does not guarantee the secrets are there; see "Verify the copied secrets" below.
- **DSQL credentials won't work locally** — if the project uses AWS Aurora DSQL via the Vercel integration, auth requires a live OIDC token exchange that only runs server-side on Vercel. Locally the SDK times out or throws `UnauthorizedException`.
- **Node may be the wrong version** — the machine default is often newer than the repo's `engines.node` pin, which fails the install outright.

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
8. **Verify the copied secrets** — see below. This step is manual; the CLI does not do it.
9. **Done.** Report what was done. Do not suggest next steps or infer tasks from branch name. Wait for user instructions.

### Step 8 — verify the copied `.env.local` actually has the secrets

**The copy is wholesale and unvalidated.** `worktree-bootstrap` does
`fs.copyFileSync(mainRepo/.env.local, worktree/.env.local)` and then injects
`DATABASE_URL`. It never checks what was in the source file. If the main
checkout's `.env.local` is thin — and it often is, because `vercel env pull`
can leave behind little more than a `VERCEL_OIDC_TOKEN` — the worktree inherits
a file that looks populated (it has a `DATABASE_URL` now) but is missing the
auth secrets entirely.

Verified example: on 2026-09-19, `~/projects/compass/.env.local` in the main
checkout contained exactly one variable, `VERCEL_OIDC_TOKEN`. Every worktree
bootstrapped from it got a `.env.local` with no `AUTH_SECRET`.

Always check after bootstrapping:

```sh
for k in AUTH_SECRET DATABASE_URL; do
  grep -q "^${k}=." .env.local && echo "ok   ${k}" || echo "MISSING ${k}"
done
```

Extend the list with whatever else the app requires (`ENCRYPTION_KEY`,
`NEXTAUTH_URL`, `MCP_API_KEY`, …). The `grep` pattern ends in `.` deliberately:
a present-but-empty `AUTH_SECRET=` fails in exactly the same way as an absent
one, and a bare `grep '^AUTH_SECRET='` would call it present.

#### What a missing `AUTH_SECRET` looks like

**It does not look like a missing env var. It looks like a broken app.** Every
auth request fails, so nothing that requires a session renders, and the natural
reading is that the branch's code is broken.

- NextAuth throws **`MissingSecret`** (`[auth][error] MissingSecret: Please
  define a \`secret\``). It may appear only in the server log, not the browser.
- Login POSTs return 500; protected routes bounce or render empty.
- The app is effectively unusable end to end — which is why a QA agent hitting
  this in a fresh Compass worktree spent its time debugging application code.

If you see `MissingSecret`, check `.env.local` **before** reading any source.

Note that this skill's trigger list below also names `MissingSecret` as a signal
for DSQL/OIDC failure. Both causes produce that string. Rule out the empty
`AUTH_SECRET` first — it is cheaper to check and, after a fresh bootstrap, far
more likely.

#### If `AUTH_SECRET` is missing

Prefer copying the value the rest of the team/other worktrees already use, so
sessions and any E2E seeding stay compatible:

```sh
grep -h '^AUTH_SECRET=' ../*/.env.local 2>/dev/null | head -1 >> .env.local
```

If there is genuinely no existing value, generate one:

```sh
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
```

> **Never reuse a locally generated `AUTH_SECRET` in a deployed environment.**
> A dev value that has sat in a worktree, a shell history, or a log is
> compromised by definition. Deployed environments get their own secret, set
> through the platform's env-var UI/CLI (e.g. `vercel env add AUTH_SECRET
> production --sensitive`), and each environment gets a distinct one.
>
> Changing `AUTH_SECRET` invalidates every existing session signed with the old
> value — expected locally, disruptive in production.

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

### Node version — `ERR_PNPM_UNSUPPORTED_ENGINE` on install

Step 3 (install deps) fails outright if the repo pins `engines.node` to a range
the machine's default Node doesn't satisfy. This is common: the shell default
tends to be the newest Node installed, while repos pin an LTS line.

```
ERR_PNPM_UNSUPPORTED_ENGINE  Unsupported environment (bad pnpm and/or Node.js version)
Expected version: 22.x
Got: v26.8.2
```

Check what the repo wants, then what you have:

```sh
node -e 'console.log(require("./package.json").engines)'
node -v
```

**Fix: prepend the matching fnm version dir to `PATH` for the install.** Do not
edit `engines`, and do not reach for `--engine-strict=false` — the pin usually
exists because something in the toolchain genuinely breaks on newer Node.

```sh
# List what fnm has installed
ls ~/.local/share/fnm/node-versions/

# Select the version matching engines.node (22.x -> pick the v22.* entry)
export PATH="$HOME/.local/share/fnm/node-versions/<version>/installation/bin:$PATH"
node -v          # confirm it now satisfies engines.node
pnpm install --frozen-lockfile
```

> **The fnm install dir on this machine is
> `~/.local/share/fnm/node-versions/<version>/installation/bin`.**
> It is *not* `~/Library/Application Support/fnm`, which does not exist here —
> that is the first place an agent tends to look, finds nothing, and wrongly
> concludes fnm isn't installed. If `~/.local/share/fnm` is also absent, check
> `fnm env` or `$FNM_DIR` rather than guessing.

Resolve the version from `engines.node` each time. Don't hardcode a specific
patch release into a script — the installed set changes, and different repos pin
different lines.

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
- `nextdev start` exits with: `Cannot find module`, `MissingSecret`, `UnauthorizedException`, `OIDC`, `token expired`, `DsqlSigner`, `ERR_PNPM_UNSUPPORTED_ENGINE`, or `ECONNREFUSED` on `:5432`
  - `MissingSecret` specifically: check `AUTH_SECRET` in `.env.local` first (see step 8), then DSQL/OIDC
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
