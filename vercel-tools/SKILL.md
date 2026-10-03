---
name: vercel-tools
description: >-
  Vercel recipes (MCP-first, no CLI) — env vars, migrations, deployment status, build debugging,
  runtime logs, and secrets workflow. INVOKE PROACTIVELY (do not wait for the
  user to ask) whenever: (1) setting or reading Vercel env vars, (2) a Vercel
  build or deployment has failed, (3) making any curl/fetch call to a *.vercel.app
  URL, (4) running migrations post-deploy, (5) the task involves pushing code
  and checking whether it deployed, (6) any work touches a project that is
  deployed on Vercel — even if the original request was a code task, or (7) after
  ANY git push to a branch with an open PR — always run vercel-wait-deploy and
  surface the preview URL without being asked.
---

# Vercel Tools

## Tooling: MCP first, no `vercel` CLI

The `vercel` CLI is retired for agent use. Use:
- **Vercel MCP** (`mcp__vercel__*`; load schemas with ToolSearch) for deployments (`list_deployments`, `get_deployment`), build logs (`list_deployment_events`), runtime logs, projects/domains, and env var writes (`create_project_env`, `edit_project_env`, `filter_project_envs`). Verify the exact tool names/params via ToolSearch before calling — never guess.
- **`vercel-env-pull`** (this folder) in place of `vercel env pull`: `vercel-env-pull --cwd $MAIN_REPO --environment development --out .env.local --yes`. Writes secrets straight to disk (mode 600), never into the transcript. Sensitive vars come back empty and are listed by name.
- **`vercel-wait-deploy`** for waiting on a deploy (REST API).
- If the MCP fails to connect (401), tell the user to re-authorize it; don't fall back to the CLI silently.

---

## When to invoke (agent-proactive — do not wait to be asked)

Invoke this skill immediately, before attempting any fix, whenever you detect:

| Signal | Action |
|---|---|
| A Vercel build has failed | Read "Debug failed builds" before touching code |
| Setting any env var on a Vercel project | Read "Adding env vars via CLI" — `echo` stores empty strings |
| Making `curl` to a `*.vercel.app` URL | Stop — read "Preview deployments are behind Vercel SSO" first |
| Code task transitions into deployment work | Switch context; treat as a new Vercel task |
| Any mention of Vercel env, deploy, or logs | Read the relevant section; use the Vercel MCP tools, not the `vercel` CLI |
| Adding a new internal/admin API endpoint | Read "Layered auth checklist" below |
| Turbopack build errors referencing generated files | Read "Turbopack + generated artifacts" below |

---

## Auto-wait rule: always surface the preview URL after pushing to an open PR

**After every `git push` to a branch that has an open PR, automatically:**

1. Run `vercel-wait-deploy --cwd $MAIN_REPO --target preview` (do not ask the user first)
2. Post the resulting preview URL to the user as soon as the deployment is ready
3. If the deployment fails, immediately fetch build logs via the Vercel MCP (`list_deployment_events`) and diagnose — do not wait to be asked

This applies whether you pushed a fix, a new feature, or a single-line change. The user should never have to ask "what's the URL?" after a push.

---

## Layered auth checklist (new unprotected endpoints)

When adding any endpoint that must be reachable without a user session, audit **every** layer independently — fixing one does not fix the others:

1. **Vercel deployment protection** — `*.vercel.app` URLs require the `x-vercel-protection-bypass` header (plain `curl`); custom domains may also be protected. Check project settings.
2. **Next.js middleware / proxy** — add `pathname.startsWith("/api/your-endpoint")` to `isPublicPath()` (or equivalent guard function).
3. **Route-level guards** — check the route handler itself for session/auth checks.

All three are independent. A fix at layer 2 does not bypass layer 1.

---

## Turbopack + generated artifacts (e.g. Prisma client)

**Symptom:** `Module not found: Can't resolve '../generated/prisma/index'` in a Turbopack build, even though `@arc/domain:build` (or equivalent) shows as a Turbo cache hit.

**Why it happens:** Turbopack bundles TypeScript source files directly — it does NOT use `tsc` output. So even when the domain package build is cached, Turbopack still needs generated artifacts (Prisma client, codegen output, etc.) to exist in the source tree at bundle time.

**Fix:** Add `prisma generate` (or equivalent) to the workspace root `postinstall` script. This runs after every `pnpm install`, regardless of Turbo cache state:

```json
// package.json (workspace root)
{
  "scripts": {
    "postinstall": "prisma generate --schema=prisma/schema.prisma"
  }
}
```

The domain package `build` script should also run it (for `tsc`), but `postinstall` is what covers Turbopack.

**Related:** `moduleResolution: NodeNext` in tsconfig requires `.js` extensions on imports, which Turbopack cannot resolve to `.ts`. Override in the affected package's tsconfig:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

## Pre-flight: run the build locally before pushing

**Do not push to discover build errors.** Each Vercel deploy cycle is ~60s. A cascade of 5 errors = 5 minutes of avoidable waiting.

Before pushing any fix for a build error:
```bash
# Run the full build locally first
pnpm build --filter @arc/web...
# or
turbo run build --filter @arc/web...
```

Only push when the local build is clean.

---

All commands run from the main repo root. The project cwd flag (`--cwd $HOME/projects/golden-wealth-app`) is required for `vercel` commands when working inside a worktree — the Vercel link only exists in the main checkout.

```bash
MAIN_REPO=$HOME/projects/golden-wealth-app
SECRET=$(grep MIGRATION_SECRET $MAIN_REPO/.env.local | cut -d= -f2 | tr -d '"')
```

---

## Check migration status

```bash
curl -s "<URL>/api/admin/migrate" \
  -H "x-vercel-protection-bypass: $BYPASS_SECRET" \
  -H "x-migration-secret: $SECRET"
```

Response includes `appliedMigrations` (already done) and `scripts` (full manifest). Diff them to find what's pending.

---

## Apply a migration

```bash
curl -s -X POST "<URL>/api/admin/migrate" \
  -H "x-vercel-protection-bypass: $BYPASS_SECRET" \
  -H "Content-Type: application/json" \
  -H "x-migration-secret: $SECRET" \
  -d '{"script":"NNN-name.sql"}'
```

To apply multiple in sequence:

```bash
for script in 009-rbac-slugs.sql 010-estate-role-presets.sql; do
  echo "=== $script ==="
  curl -s -X POST "<URL>/api/admin/migrate" \
    -H "x-vercel-protection-bypass: $BYPASS_SECRET" \
    -H "Content-Type: application/json" \
    -H "x-migration-secret: $SECRET" \
    -d "{\"script\":\"$script\"}" 2>&1 | grep -o '"message":"[^"]*"'
done
```

**Success:** all lines show `✓`. Watch for `✗ Error:` lines — the migration is still recorded as applied even on partial failure, so errors need a follow-up fix migration (not a re-run).

---

## Find a project from a domain

Use the Vercel MCP: look up the domain/alias (project domain tools) or `get_deployment` with the URL. The result shows project name, deployment ID, aliases and team. Works on custom domains, branch aliases, and hash URLs.

---

## Get the latest deployment URL

Use the MCP `list_deployments` for the project, filter by target (preview/production), take the newest READY one. The listed URL is the hash URL; for the production custom domain use `get_deployment` and read its aliases.


---

## Wait for a deployment to go Ready

Use after merging to main (production) or pushing a PR branch (preview). Use the pre-built `vercel-wait-deploy` script — do NOT write an inline polling loop.

```bash
# Wait for production (after merging to main):
vercel-wait-deploy --cwd $MAIN_REPO --target production

# Wait for a preview deployment FROM A WORKTREE:
# --cwd points to main repo (has .vercel/project.json)
# --git-cwd points to the worktree (has the feature branch checked out)
vercel-wait-deploy --cwd $MAIN_REPO --git-cwd $WORKTREE --target preview

# Wait for a preview deployment from the main repo itself:
vercel-wait-deploy --cwd $MAIN_REPO --target preview

# Explicit SHA override when needed:
vercel-wait-deploy --cwd $MAIN_REPO --target production --sha <commit-sha>
```

**Important:** When working in a git worktree, always pass `--git-cwd <worktree-path>`. Without it,
the script resolves the branch from `--cwd` (the main repo, which is on `main`), and looks up
`origin/main`'s SHA instead of the feature branch's SHA.

`--target` is required — omitting it is an error. Without it, a failing deployment in a different
environment (e.g., a preview branch missing env vars) can poison the result for the same SHA.

Options:
- `--cwd <dir>` — Vercel project root containing `.vercel/project.json` (required when in a worktree)
- `--git-cwd <dir>` — git repo for SHA/branch resolution; defaults to `--cwd`. Set to the worktree path when `--cwd` is the main checkout.
- `--target <target>` — `production` or `preview` (**required**)
- `--sha <sha>` — commit SHA override (auto-resolved from target when omitted)
- `--timeout <secs>` — max wait time in seconds (default: 600)

On success, prints the stable **branch alias URL** (e.g. `https://v0-app-git-my-branch-team.vercel.app`) and writes it to `/tmp/vercel_prod_url.txt`. Falls back to the per-deploy hash URL if no alias is found.

**"Auth error (stale token)":** `vercel-wait-deploy` reads the token from `$VERCEL_TOKEN` if set, otherwise from the CLI's `auth.json` (and refreshes it via the CLI). Prefer a stored `VERCEL_TOKEN` so it never depends on the CLI.

---

## Full merge-to-prod workflow

1. `gh pr merge <N> --squash`
2. Wait for deployment (recipe above)
3. Check pending migrations (status recipe above)
4. Apply each pending migration in sequence
5. Verify by re-running status — `appliedMigrations` should match `scripts`

---

## Debug failed builds

When a deployment fails, get the deployment ID (`dpl_…`, from `list_deployments` or the PR check URL) and call the Vercel MCP `list_deployment_events` for the full build output (errors, test failures, dependency issues). Read the **last 50–100 lines** first.

**What this shows:**
- Full build stdout/stderr
- Test failures (unit tests, linting, type errors)
- Dependency installation errors
- Build script failures
- Environment variable issues
- Exact line where build failed

**Getting the deployment ID:** `gh pr checks <PR_NUMBER> | grep Vercel` shows the failing check URL; the `dpl_*` segment is the ID. Or use `list_deployments`.

**Troubleshooting tip:** Scroll to the end of the logs first — the error is usually in the last 50-100 lines. Look for:
- `Error:` or `ERROR` lines
- Test suite failures
- `Command "..." exited with 1`
- Stack traces

---

## Historical logs

Use the Vercel MCP: runtime logs for a deployment (requests, function invocations; filter by status code or search text), and `list_deployment_events` for **build** logs. Check the tool schema via ToolSearch for the filter params.

---

## Secrets workflow: Harness → Password Manager → Vercel

Check harness-injected environment variables before opening a password manager. Harness secrets are the preferred runtime source because they are already scoped to the active agent session and avoid unnecessary credential-store access.

1. Inspect environment variable **names only** to find the project- and environment-specific secret. Never print values. Prefer explicit names such as `COMPASS_PRODUCTION_MIGRATION_SECRET` or `COMPASS_PREVIEW_MIGRATION_SECRET` over a generic `MIGRATION_SECRET`.
2. If the exact required variable exists and is non-empty, use it directly.
3. Only when no suitable harness variable exists, fetch the secret from the project's password manager. Work projects use Keeper; personal projects use 1Password.
4. Do not rely on `.env.local` to decide whether a secret exists; it may be stale or empty for encrypted variables.

Safe discovery example:

```bash
env | cut -d= -f1 | grep -Ei 'project-name|migration|secret' | sort
test -n "${PROJECT_PRODUCTION_MIGRATION_SECRET:-}"
```

The discovery command must output names only. Do not run `env` without removing values.

### Password-manager fallback

**Keeper (work projects):**
```bash
keeper list
keeper search "myproject"
keeper add --title "MyProject MY_SECRET" --pass "$(openssl rand -hex 32)" --notes "MY_SECRET for <project>"
SECRET=$(keeper get <record-uid> --format password)
```

**1Password (personal projects):**
```bash
op item list --vault <vault>
op item get "MyProject MY_SECRET" --fields password
SECRET=$(op item get "MyProject MY_SECRET" --fields password)
```

**Full new-secret workflow:**
1. Generate + store in password manager (commands above)
2. Push to Vercel production: MCP `create_project_env` (key, value, target `production`)
3. Push to Vercel preview: MCP `create_project_env` (target `preview`, optionally a `gitBranch`)
4. Write to `.env.local` (or just run `vercel-env-pull`): `grep -v '^MY_SECRET=' .env.local > /tmp/e && mv /tmp/e .env.local && echo 'MY_SECRET="'"$SECRET"'"' >> .env.local`

**Same value on production + preview:** `create_project_env` accepts multiple targets; verify in the schema. **New env var not live until redeployed** — push a new commit or trigger a redeploy.

---

## Adding env vars: no trailing newline

A trailing newline in a stored value causes `403 Forbidden` at runtime. When passing the value to the MCP, ensure it has no trailing `\n` (trim it).

---

## Deployment Protection Bypass for Automation

When a project has Vercel SSO/deployment protection enabled, agents and CI systems need a bypass secret to reach it without SSO. There are **two separate steps** — both are required.

### Step 1: Register the bypass secret in Project Protection settings

Setting `VERCEL_AUTOMATION_BYPASS_SECRET` as a regular env var does **not** automatically enable the bypass. The secret must be explicitly registered via the Vercel REST API:

```bash
# Get your auth token
TOKEN=$(python3 -c "import json; print(json.load(open('$(python3 -c "import os; print(os.path.expanduser(\"~/Library/Application Support/com.vercel.cli/auth.json\"))")'))['token'])")

PROJECT_ID="prj_..."   # from .vercel/project.json
TEAM_ID="team_..."     # from .vercel/project.json
BYPASS_SECRET="$(openssl rand -hex 16)"  # must be exactly 32 hex chars (alphanumeric)

curl -s -X PATCH \
  "https://api.vercel.com/v1/projects/${PROJECT_ID}/protection-bypass?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"generate\":{\"secret\":\"${BYPASS_SECRET}\",\"note\":\"Agent/CI automation bypass\"}}"
```

The response will include the secret under `protectionBypass`. **The secret must be 32 alphanumeric characters** (`^[a-zA-Z0-9]{32}$`) — hex output from `openssl rand -hex 16` is exactly 32 chars and meets this requirement.

### Step 2: Use the bypass header in requests

Once registered, pass the secret via the `x-vercel-protection-bypass` header on every request:

```bash
curl -s -X POST "https://your-project.vercel.app/api/your-endpoint" \
  -H "x-vercel-protection-bypass: ${BYPASS_SECRET}" \
  -H "Content-Type: application/json" \
  -d '...'
```

### Store the bypass secret in Keeper

```bash
# Store it — the secret is 32 chars, store exactly as-is
keeper shell <<EOF
record-add --record-type login --title "MyProject — Vercel Bypass Secret"
EOF
# Then update with the actual value
BYPASS_UID="..."   # UID from the record-add output
keeper shell <<EOF
record-update -r $BYPASS_UID "password=${BYPASS_SECRET}" "notes=x-vercel-protection-bypass header value. Registered in Vercel project protection settings."
EOF
```

### Verify the bypass is working

A successful bypass returns your API response (not an HTML SSO page). If you still get HTML with `Authentication Required` in the title, the secret is not registered correctly — confirm via:

```bash
curl -s "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d.get('protectionBypass',{}).keys()))"
```

Your 32-char secret should appear as a key in the output.

---

## Common gotchas

- **Env var trailing newline** — trim values before storing; a stored newline causes `403 Forbidden` at runtime
- **Preview deployments are behind Vercel SSO** — plain `curl` gets an HTML login page; always use the protection bypass header (`x-vercel-protection-bypass`)
- **Bypass secret ≠ env var** — setting `VERCEL_AUTOMATION_BYPASS_SECRET` as an env var does NOT enable the bypass; you must register it via the REST API (see "Deployment Protection Bypass" above)
- **Bypass secret must be exactly 32 alphanumeric chars** — use `openssl rand -hex 16` (produces 32 hex chars); longer values will be rejected with a pattern error
- **Migration errors don't block recording** — if a migration has `✗` lines, it's still marked applied; write a follow-up fix migration rather than re-running
- **DSQL: no `ADD COLUMN NOT NULL DEFAULT`** — split into nullable `ADD COLUMN` + `UPDATE ... WHERE col IS NULL` backfill
- **Worktree cwd** — always pass `--cwd $MAIN_REPO` to `vercel-env-pull` / `vercel-wait-deploy` from a worktree
- **Empty/skipped var from `vercel-env-pull` ≠ missing value** — env vars marked as `sensitive` (secret-level) come back empty (the script lists them as skipped); an empty string does NOT mean the value is unset or blank in Vercel. Never assume the value needs to be re-entered based on `vercel-env-pull` output alone.
