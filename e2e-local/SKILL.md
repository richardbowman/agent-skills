---
name: e2e-local
description: Run Playwright E2E tests locally in whatever repo you are currently in. Use whenever the user asks to run E2E tests, integration tests, or Playwright tests locally. Starts by detecting THIS repo's actual E2E setup (entry points, env file, database) — repos differ, and several have more than one suite — then covers the portable local-run failures (env secrets, dotenv in worktrees, output redirection, schema mismatch).
---

# E2E local test runner

This skill does **not** know your repo's E2E layout. Layouts differ a lot between
projects, and getting this wrong wastes an entire run: you seed the wrong
database, run a suite that asserts nothing and call it green, or fail auth
against a server holding different secrets.

So the order is always:

1. **Step 0 — detect this repo's E2E setup.** Never skip.
2. **Step 1 — line up the environment** the detected entry point actually reads.
3. **Step 2 — run it**, with output redirected to a file in the project dir.

The worked examples near the bottom are *examples*. Do not copy commands out of
them until Step 0 has confirmed they match the repo you are in.

---

## Step 0 — detect this repo's E2E setup (do this first)

**A repo may have more than one E2E suite, with different entry points, different
databases, and different meanings.** "The E2E tests pass" is not a single claim.
One suite may capture screenshots with no assertions at all while another runs
real DB-mutating assertions — running the first and reporting success is a false
green.

Work through these in order. Stop collecting once you can answer the four
questions at the end.

### 0a. Repo-local guidelines are authoritative where they exist

```sh
cat .claude/pr-guidelines.md 2>/dev/null
cat .agents/pr-guidelines.md 2>/dev/null
```

If either exists, it wins over anything in this skill. It normally names each
suite, what it covers, and when a PR is expected to run it.

Treat specific numbers in those docs (ports especially) as possibly stale and
confirm them against `playwright.config.ts` — a hardcoded port in prose tends to
outlive the config change that moved it.

### 0b. Enumerate the E2E entry points in `package.json`

```sh
node -e 'const s=require("./package.json").scripts||{};for(const[k,v]of Object.entries(s))if(/e2e|playwright|test:integration/i.test(k+v))console.log(k.padEnd(28),v)'
```

Every matching script is a candidate entry point. Note which ones shell out to a
wrapper script (`node scripts/<something>.mjs`) rather than calling `playwright`
directly — the wrapper is where env loading, DB preparation, locks, and safety
guards live, and running bare `playwright test` bypasses all of it.

### 0c. Read the wrapper and the Playwright config

```sh
sed -n '1,60p' scripts/<the-wrapper>.mjs   # whatever 0b surfaced
cat playwright.config.ts
```

From these, extract:

- **Which env file is loaded**, if any. Look for `process.loadEnvFile(...)`,
  `dotenv -e <file>`, `dotenv-cli -e <file>`, or a `require("dotenv")` call.
  Common values are `.env.local`, `.env.e2e`, `.env.test` — **do not assume**.
- **Which Playwright projects exist** (`projects: [...]` in the config) and which
  ones each script selects via `--project=`.
- **Whether a `webServer` block starts a server**, and on what port. The port may
  be derived rather than fixed — a repo running many concurrent worktrees may
  hash the cwd into a port so worktrees cannot collide.
- **`reuseExistingServer`** — if this is true locally, Playwright will silently
  attach to any server already on that port, including another worktree's,
  producing failures unrelated to your change.
- **What each project's `baseURL` defaults to.** A suite pointed at a *deployed*
  URL by default needs no local server at all, and running it locally without an
  override tests production, not your branch.

### 0d. Find the database the suite expects

```sh
grep -rniE 'database_url|compass_e2e|_e2e|createdb|db push|prepare.*database' \
  scripts/ playwright.config.ts e2e/ 2>/dev/null | head -20
podman ps --format '{{.Names}} {{.Ports}} {{.Status}}'
```

Some repos put a **guard** in the DB-preparation step that hard-refuses any
target except one specific local database. That guard is a feature: it exists so
a stray `DATABASE_URL` cannot drop or reshape your real dev data. If it throws,
fix the URL — never weaken the guard.

Note also whether the wrapper takes a **machine-wide run lock**. That is a
separate mechanism from the DB guard: it serializes concurrent runs across
worktrees so two agents don't exhaust memory and corrupt each other's fixtures.
If you see "waiting for lock", wait — do not set the bypass env var to jump the
queue.

### 0e. Locate the specs

```sh
ls e2e/ 2>/dev/null; ls tests/ 2>/dev/null; ls playwright/ 2>/dev/null
```

Cross-check against each Playwright project's `testDir` / `testMatch`. A spec
path that isn't inside the selected project's `testDir` will silently match
nothing.

### Before leaving Step 0, you must be able to answer

1. How many E2E suites does this repo have, and what does each one actually
   assert (if anything)?
2. Which command runs the suite the user is asking about?
3. Which env file does that command read, and does it exist in **this worktree**?
4. Which database/server does it target, and is that target running?

If you cannot answer all four, keep reading the repo. Do not start guessing with
commands.

---

## Step 1 — line up the environment

These failures are repo-independent. They are the reason this skill exists.

### Secrets must match the server the browser logs into

If the suite seeds a user directly into the DB and then logs in through the
browser, the **seeding process and the running server must share the same auth
secrets**.

- `AUTH_SECRET` / `NEXTAUTH_SECRET` differing → NextAuth cannot verify the
  session token and login fails with **`CredentialsSignin`**. The browser then
  times out waiting for a post-login route, which reads like a UI bug and is not
  one.
- `ENCRYPTION_KEY` (or equivalent) differing → data encrypted during seeding
  won't decrypt at runtime.

If the suite uses a dedicated env file, derive those values *from* the file the
dev server uses rather than inventing them:

```sh
grep '^AUTH_SECRET=' .env.local | cut -d= -f2- | tr -d '"'
```

If the server is started by Playwright's own `webServer` block, it inherits the
same env the wrapper loaded, so this class of mismatch disappears — one more
reason to use the repo's wrapper rather than bare `playwright test`.

### Local Postgres needs `?sslmode=disable`

Local Podman/Docker Postgres has no SSL configured. Without the suffix, Prisma
throws `The server does not support SSL connections`.

```
postgresql://postgres:postgres@localhost:<port>/<db>?sslmode=disable
```

### Point the server at local Postgres, not a cloud DB

If the dev server is still on the project's cloud database (DSQL, Neon, RDS)
while the suite seeds into local Postgres, the seeded user does not exist when
the browser tries to log in. Same `CredentialsSignin` symptom, different cause.

Check what the running server is actually connected to before blaming the tests:

```sh
nextdev status
nextdev logs -n 20
```

`worktree-bootstrap` handles deps, `.env.local`, the Postgres container, and
`DATABASE_URL` injection in one step if the worktree is cold.

---

## Step 2 — run the tests

### Always redirect output to a file **in the project directory**

Do **not** capture Playwright output as shell/task output, and do **not** write
it to `/tmp`. Playwright output with traces and screenshots can exceed what
`/tmp` holds, producing `ENOSPC: no space left on device` — which surfaces as a
confusing mid-run crash rather than a disk error.

```sh
mkdir -p test-results
<the repo's e2e command> --reporter=line > test-results/pw-run.log 2>&1; echo "exit:$?"
# then Read test-results/pw-run.log
```

`echo "exit:$?"` prints the exit code *after* redirection, so you can still tell
pass from fail.

### `dotenv: command not found` in a worktree — use `npx dotenv-cli`

If the repo's script is shaped like `dotenv -e <file> -- playwright test`, it
will fail in a git worktree: `dotenv` is a dev-dependency binary that pnpm does
not always surface into the worktree's PATH.

```sh
# ❌ dotenv: command not found
pnpm test:e2e

# ✅ installs on demand, always resolves
npx dotenv-cli -e .env.e2e -- npx playwright test --reporter=line
```

This does **not** apply to wrappers that load env in-process (e.g.
`process.loadEnvFile(".env.local")` inside a `.mjs` script) — those have no PATH
dependency, and substituting `npx dotenv-cli` for them skips the wrapper's DB
preparation and locking. Use the repo's own entry point unless it actually
breaks.

### Reading a failure

- `nextdev logs -n 50` — auth errors or DB connection failures during the run
- `CredentialsSignin` — auth secret mismatch, or the server is on a different
  database than the seed (see Step 1)
- `ECONNREFUSED` on the Postgres port — container isn't running; `podman ps -a`
  then `podman start <name>`
- Browser times out waiting for a post-login route — the login failed; read the
  server logs for what the credentials handler returned
- `table X does not exist in current database` — see Schema mismatch below

---

## Schema mismatch — `table X does not exist in current database`

A Playwright `db` fixture that builds a plain Prisma client from `DATABASE_URL`
queries the **`public`** schema unless told otherwise. If the app's migration
runner targets a named schema (`getActiveSchema()`, e.g. `myapp_dev`), newly
migrated tables exist only there — so the fixture looks in `public` and finds
nothing.

**Do NOT fix this by applying DDL to `public`.** That fragments the schema and
creates divergence between local and the deployed database, and the divergence
resurfaces later as a migration that cannot be replayed.

**The correct fix** is in the Prisma client factory — make the local path pass
the same schema as the cloud path:

```ts
// Before (broken for E2E and local dev consistency):
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)           // ← no schema = queries public
  return new PrismaClient({ adapter })
}

// After (correct):
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool, { schema: getActiveSchema() })  // ← same schema everywhere
  return new PrismaClient({ adapter })
}
```

Then apply pending migrations through the app's migration endpoint and the
fixture will find the tables in the schema the server uses.

---

## Example A — a repo with one suite and a dedicated `.env.e2e`

**This is one possible shape, not the default.** It applies to a repo where
Step 0 found: a single `pnpm test:e2e` script of the form
`dotenv -e .env.e2e -- playwright test`, specs under `e2e/tests/`, and a local
Postgres on `:5433/localdb`. Confirm each of those before using these commands.

`.env.e2e` is gitignored, so it will not exist in a fresh worktree. Build it from
`.env.local` so the secrets match the running dev server:

```sh
ls .env.e2e 2>/dev/null && echo "exists" || echo "missing"
```

```sh
AUTH_SECRET=$(grep '^AUTH_SECRET=' .env.local | cut -d= -f2- | tr -d '"')
ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' .env.local | cut -d= -f2- | tr -d '"')

cat > .env.e2e <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/localdb?sslmode=disable

AUTH_SECRET=${AUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

E2E_USER_EMAIL=e2e-test@example.local
E2E_USER_PASSWORD=E2eTestPassword123!

PLAYWRIGHT_BASE_URL=http://localhost:3000

SCREENSHOTS_USER_EMAIL=screenshots@example.local
SCREENSHOTS_USER_PASSWORD=ScreenshotPassword123!
EOF
```

Do not hardcode the port or the base URL if the environment can tell you. Pull
the real dev-server port instead:

```sh
PORT=$(nextdev status | grep 'port:' | awk '{print $2}')
# then set PLAYWRIGHT_BASE_URL=http://localhost:${PORT}
```

Make sure the dev server is on the same local Postgres the seed writes to:

```sh
nextdev restart --cmd "DATABASE_URL=postgresql://postgres:postgres@localhost:5433/localdb?sslmode=disable pnpm dev"
nextdev logs -n 30   # wait for "Ready"
```

Run it:

```sh
mkdir -p test-results
npx dotenv-cli -e .env.e2e -- npx playwright test --reporter=line > test-results/pw-run.log 2>&1; echo "exit:$?"

# subset by file or grep:
npx dotenv-cli -e .env.e2e -- npx playwright test e2e/tests/02-estate.spec.ts --reporter=line > test-results/pw-run.log 2>&1; echo "exit:$?"
npx dotenv-cli -e .env.e2e -- npx playwright test --grep "some test name" --reporter=line > test-results/pw-run.log 2>&1; echo "exit:$?"
```

**Keeping `.env.e2e` in sync:** it is gitignored and does not track `.env.local`.
After a `vercel env pull`, its `AUTH_SECRET` / `ENCRYPTION_KEY` can go stale and
tests start failing with auth errors. Regenerate it with the commands above.

---

## Example B — a repo with several suites, `.env.local`, and a guarded E2E database

**This is the Compass shape** (`~/projects/compass`), verified 2026-09-19. It
looks nothing like Example A, which is the whole point of Step 0.

Step 0 on this repo finds **four** E2E entry points, not one:

| Script | Command | What it means |
|---|---|---|
| `pnpm test:e2e` | `playwright test --project=screenshots` | Docs screenshots. **No assertions.** Green here proves nothing about behavior. |
| `pnpm test:e2e:functional` | `node scripts/run-functional-e2e.mjs functional` | The real suite: assertions, DB mutations. |
| `pnpm test:e2e:roadmap` | `node scripts/run-functional-e2e.mjs roadmap` | Three roadmap/timeline specs only. |
| `pnpm test:e2e:all` | `node scripts/run-functional-e2e.mjs all` | Every Playwright project, screenshots included. |

If the user asks whether "the E2E tests pass", they mean
`pnpm test:e2e:functional`. Reporting `pnpm test:e2e` green is a false green.

**The screenshots suite defaults to production.** Its `baseURL` falls back to
`https://compass.rbcodelabs.com`, so it needs no local server — and run with no
overrides it is testing production, not your branch. To regenerate screenshots
against local dev, override `DOCS_BASE_URL` and supply a captured session; see
`.claude/pr-guidelines.md`, which carries the current recipe.

**Env file: `.env.local`, not `.env.e2e`.** `scripts/run-functional-e2e.mjs`
opens with:

```js
process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
```

That is in-process, so there is no `dotenv` binary and no PATH problem — but the
worktree must have its own `.env.local` with a real `DATABASE_URL`. Use
`worktree-bootstrap` to get one.

**Database: local `compass_e2e` on port 5437**, guarded.
`scripts/prepare-e2e-database.mjs` refuses anything else:

```js
if (!LOCAL_HOSTS.has(target.hostname) || database !== "compass_e2e") {
  throw new Error("Database preparation refuses any target except local compass_e2e");
}
```

Note the two databases on that container are distinct: `compass` is dev data,
`compass_e2e` is the disposable E2E target. Inside `compass_e2e` the suite
pushes the Prisma schema into a `compass_dev` **schema** and drops a sentinel row
in `public.e2e_database_sentinel`. If the guard throws, correct `DATABASE_URL` —
do not edit the guard.

**Separately, a machine-wide run lock.** `run-functional-e2e.mjs` takes a mutex
at `$TMPDIR/compass-e2e-functional.lock` so only one functional run happens per
machine. This is *not* the database guard — it exists because two concurrent
runs in different worktrees each boot a dev server and a browser group, and on
2026-09-17 that drove swap to 8.4 GB of 9.2 GB and took the machine down. Default
behavior is to **wait** (30 min), printing `[e2e-lock] Waiting for…`. Wait it
out. `E2E_SKIP_LOCK=1` exists but bypassing it is what crashed the machine.

**Specs: `e2e/functional/specs/`** (57 files), with `e2e/functional/auth.setup.ts`
as the `functional-setup` project and `e2e/functional/global-setup.ts` /
`global-teardown.ts` doing seed and cleanup.

**Port is derived, not fixed.** `playwright.config.ts` hashes `process.cwd()`
into the range 4100–4899 rather than using a fixed port, precisely so concurrent
worktrees cannot collide. Any doc still saying "port 3002" is stale —
`.claude/pr-guidelines.md` currently does. `E2E_PORT` overrides if set.

Run it:

```sh
mkdir -p test-results
pnpm test:e2e:functional > test-results/pw-run.log 2>&1; echo "exit:$?"

# keep DB state for post-failure inspection:
E2E_SKIP_TEARDOWN=1 pnpm test:e2e:functional > test-results/pw-run.log 2>&1; echo "exit:$?"
```

Use the wrapper, not bare `playwright test` — bypassing it skips database
preparation, the lock, and the `CI=1` / `E2E_FUNCTIONAL=1` /
`E2E_ISOLATED_DATABASE=1` env the config keys off.
