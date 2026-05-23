---
name: vercel-tools
description: >-
  Vercel CLI recipes — env vars, migrations, deployment status, build debugging,
  runtime logs, and secrets workflow. INVOKE PROACTIVELY (do not wait for the
  user to ask) whenever: (1) setting or reading Vercel env vars, (2) a Vercel
  build or deployment has failed, (3) making any curl/fetch call to a *.vercel.app
  URL, (4) running migrations post-deploy, (5) the task involves pushing code
  and checking whether it deployed, or (6) any work touches a project that is
  deployed on Vercel — even if the original request was a code task.
---

# Vercel Tools

## When to invoke (agent-proactive — do not wait to be asked)

Invoke this skill immediately, before attempting any fix, whenever you detect:

| Signal | Action |
|---|---|
| A Vercel build has failed | Read "Debug failed builds" before touching code |
| Setting any env var on a Vercel project | Read "Adding env vars via CLI" — `echo` stores empty strings |
| Making `curl` to a `*.vercel.app` URL | Stop — read "Preview deployments are behind Vercel SSO" first |
| Code task transitions into deployment work | Switch context; treat as a new Vercel task |
| Any mention of `vercel env`, `vercel deploy`, `vercel logs` | Read the relevant section before running the command |
| Adding a new internal/admin API endpoint | Read "Layered auth checklist" below |
| Turbopack build errors referencing generated files | Read "Turbopack + generated artifacts" below |

---

## Layered auth checklist (new unprotected endpoints)

When adding any endpoint that must be reachable without a user session, audit **every** layer independently — fixing one does not fix the others:

1. **Vercel deployment protection** — `*.vercel.app` URLs require `vercel curl --deployment`; custom domains may also be protected. Check project settings.
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
vercel curl /api/admin/migrate \
  --deployment <URL> \
  --cwd $MAIN_REPO \
  -- --header "x-migration-secret: $SECRET"
```

Response includes `appliedMigrations` (already done) and `scripts` (full manifest). Diff them to find what's pending.

---

## Apply a migration

```bash
vercel curl /api/admin/migrate \
  --deployment <URL> \
  --cwd $MAIN_REPO \
  -- --request POST \
     --header "Content-Type: application/json" \
     --header "x-migration-secret: $SECRET" \
     --data '{"script":"NNN-name.sql"}'
```

To apply multiple in sequence:

```bash
for script in 009-rbac-slugs.sql 010-estate-role-presets.sql; do
  echo "=== $script ==="
  vercel curl /api/admin/migrate \
    --deployment <URL> \
    --cwd $MAIN_REPO \
    -- --request POST \
       --header "Content-Type: application/json" \
       --header "x-migration-secret: $SECRET" \
       --data "{\"script\":\"$script\"}" 2>&1 | grep -o '"message":"[^"]*"'
done
```

**Success:** all lines show `✓`. Watch for `✗ Error:` lines — the migration is still recorded as applied even on partial failure, so errors need a follow-up fix migration (not a re-run).

---

## Get the latest deployment URL

```bash
# Latest preview:
vercel ls --cwd $MAIN_REPO 2>&1 | grep "Preview" | head -1 | awk '{print $3}'

# Latest production:
vercel ls --cwd $MAIN_REPO 2>&1 | grep "Production" | head -1 | awk '{print $3}'
```

---

## Wait for a deployment to go Ready

Use after merging to main (production) or pushing a PR branch (preview). Use the pre-built `vercel-wait-deploy` script — do NOT write an inline polling loop.

```bash
# Wait for production (after merging to main):
vercel-wait-deploy --cwd $MAIN_REPO --target production

# Wait for a preview deployment:
vercel-wait-deploy --cwd $MAIN_REPO --target preview

# Explicit SHA override when needed:
vercel-wait-deploy --cwd $MAIN_REPO --target production --sha <commit-sha>
```

`--target` is required — omitting it is an error. Without it, a failing deployment in a different
environment (e.g., a preview branch missing env vars) can poison the result for the same SHA.

Options:
- `--cwd <dir>` — project root containing `.vercel/project.json` (required when in a worktree)
- `--target <target>` — `production` or `preview` (**required**)
- `--sha <sha>` — commit SHA override (auto-resolved from target when omitted)
- `--timeout <secs>` — max wait time in seconds (default: 600)

On success, prints the stable **branch alias URL** (e.g. `https://v0-app-git-my-branch-team.vercel.app`) and writes it to `/tmp/vercel_prod_url.txt`. Falls back to the per-deploy hash URL if no alias is found.

---

## Full merge-to-prod workflow

1. `gh pr merge <N> --squash`
2. Wait for deployment (recipe above)
3. Check pending migrations (status recipe above)
4. Apply each pending migration in sequence
5. Verify by re-running status — `appliedMigrations` should match `scripts`

---

## Debug failed builds

When a deployment fails, use `vercel inspect` with `--logs` to see the full build output including errors, test failures, and dependency issues:

```bash
# From GitHub PR checks or Vercel dashboard, get the deployment ID (starts with dpl_)
# Then inspect with logs:
npx vercel inspect dpl_<DEPLOYMENT_ID> --logs --scope <SCOPE_NAME>

# Example:
npx vercel inspect dpl_Aix3L5sBTVQMRt3qM9wKkEbtYLUD --logs --scope rv-bankrate-projects

# Pipe to tail for last N lines (error usually at the end):
npx vercel inspect dpl_<ID> --logs --scope <SCOPE> 2>&1 | tail -100
```

**What this shows:**
- Full build stdout/stderr
- Test failures (unit tests, linting, type errors)
- Dependency installation errors
- Build script failures
- Environment variable issues
- Exact line where build failed

**Getting the deployment ID:**

From GitHub PR:
```bash
gh pr checks <PR_NUMBER> | grep "Vercel.*fail"  # Shows failing check with URL
# Extract dpl_* from the URL
```

From Vercel dashboard URL:
```
https://vercel.com/.../dpl_Aix3L5sBTVQMRt3qM9wKkEbtYLUD
                        ^-- deployment ID starts here
```

**Troubleshooting tip:** Scroll to the end of the logs first — the error is usually in the last 50-100 lines. Look for:
- `Error:` or `ERROR` lines
- Test suite failures
- `Command "..." exited with 1`
- Stack traces

---

## Historical logs

```bash
# Get deployment ID from URL
vercel inspect <URL> | grep '^\s*id'  # → dpl_abc123

# Pull runtime logs (after deployment is live)
vercel logs dpl_abc123 --no-follow                    # all recent
vercel logs dpl_abc123 --no-follow --status-code 500  # errors only
vercel logs dpl_abc123 --no-follow --query "error"    # substring filter
vercel logs dpl_abc123 --no-follow --json | jq '.message'
```

**Note:** `vercel logs` shows **runtime logs** (requests, function invocations). For **build logs**, use `vercel inspect --logs` (see "Debug failed builds" above).

`--no-follow` is required — without it, `vercel logs` tails forever and blocks the shell.

| Flag | Purpose |
|---|---|
| `--no-follow` | One-shot historical lookup |
| `--status-code <N>` | Filter by HTTP status (`500`, `4xx`) |
| `--query <str>` | Substring filter |
| `--json` | Machine-readable; pipe to `jq` |
| `--since <duration>` | e.g. `--since 1h` or `--since 2024-01-15` |

---

## Secrets workflow: Password Manager → Vercel

Always fetch secrets from the project's password manager rather than guessing or relying on `.env.local` (which may be stale or empty for encrypted vars). Check project memory for which password manager applies — work projects use Keeper, personal projects use 1Password.

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
2. Push to Vercel production: `vercel env add MY_SECRET production --value "$SECRET" --yes --cwd $MAIN_REPO`
3. Push to Vercel preview branch: `vercel env add MY_SECRET preview <branch> --value "$SECRET" --yes --cwd $MAIN_REPO`
4. Write to `.env.local`: `grep -v '^MY_SECRET=' .env.local > /tmp/e && mv /tmp/e .env.local && echo 'MY_SECRET="'"$SECRET"'"' >> .env.local`

**Setting same value on production + preview:** CLI requires two calls — no "all environments" shorthand in non-interactive mode. For preview, a branch name is required with `--yes`; omit `--yes` to apply to all preview branches interactively. Add `--force` to overwrite existing values.

**New env var not live until redeployed** — existing deployments don't pick up new env vars; `vercel redeploy <url> --cwd $MAIN_REPO` or push a new commit.

---

## Adding env vars via CLI

Use `printf '%s'` instead of `echo` to avoid a trailing newline being stored in the value — a newline in the value causes `403 Forbidden` errors at runtime:

```bash
# Correct — no trailing newline:
printf '%s' "$MY_SECRET" | vercel env add MY_SECRET production

# Wrong — echo appends \n which gets stored in the value:
echo "$MY_SECRET" | vercel env add MY_SECRET production
```

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

Or with `vercel curl`:

```bash
vercel curl /api/your-endpoint \
  --deployment "https://your-project.vercel.app" \
  --protection-bypass "$BYPASS_SECRET" \
  -- --request POST \
     --header "Content-Type: application/json" \
     --data '...'
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

- **`vercel ls` output goes to stderr** — always use `2>&1`
- **Env var trailing newline** — always use `printf '%s'` (not `echo`) when piping values to `vercel env add`; a stored newline causes `403 Forbidden` at runtime
- **Preview deployments are behind Vercel SSO** — plain `curl` gets an HTML login page; always use `vercel curl --deployment` or the protection bypass header
- **Bypass secret ≠ env var** — setting `VERCEL_AUTOMATION_BYPASS_SECRET` as an env var does NOT enable the bypass; you must register it via the REST API (see "Deployment Protection Bypass" above)
- **Bypass secret must be exactly 32 alphanumeric chars** — use `openssl rand -hex 16` (produces 32 hex chars); longer values will be rejected with a pattern error
- **Migration errors don't block recording** — if a migration has `✗` lines, it's still marked applied; write a follow-up fix migration rather than re-running
- **DSQL: no `ADD COLUMN NOT NULL DEFAULT`** — split into nullable `ADD COLUMN` + `UPDATE ... WHERE col IS NULL` backfill
- **Worktree cwd** — always pass `--cwd $MAIN_REPO` when running Vercel CLI from a worktree
- **`--level error` doesn't exist** — use `--status-code 500` or `--query "error"` instead
