---
name: proxmox-devbox
description: Recipes for using homelab Proxmox VMs (a shared Postgres VM and a build/test VM) as the default offload capacity for dev work when the homelab is reachable — Postgres for new projects lives on the Postgres VM, and heavy build/test/typecheck/E2E steps default to the build VM. Falls back to local (podman-postgres, running the step on the workstation) automatically when the box is unreachable, e.g. traveling off the home LAN — no need to ask, just note the fallback in the report. Does NOT cover the interactive dev server (it stays on the workstation) and does NOT retroactively migrate existing projects already on local podman-postgres. Deep infra reference (golden-image template, ISO downloads, GPU passthrough, gotchas) lives in references/homelab-infra.md; this skill is the day-to-day recipe layer on top of it.
---

# Proxmox Devbox

Two always-on VMs on a homelab Proxmox host, reachable through SSH aliases you configure once in `~/.ssh/config` (see [references/homelab-infra.md](references/homelab-infra.md) for setup):

- `dev-postgres` — shared Postgres via rootless Podman
- `dev-builder` — build-and-test box (e.g. 6 vCPU / 12 GB), already `gh`-authenticated to GitHub

Substitute your own alias names if you use different ones. Everything below uses aliases only — never hard-code IP addresses in recipes or in project files you commit.

## Standing policy

These VMs are the **default** for two things, whenever reachable:

1. **Postgres for any new project setup.** A brand-new project's local dev DB defaults to `dev-postgres`, not local `podman-postgres`.
2. **Heavy build/test/typecheck/E2E steps.** When a task calls for one of these, run it on `dev-builder` instead of the workstation. This keeps the workstation under its load-average ceiling when many agent sessions run at once.

**What stays local no matter what:**

- The **interactive dev server** (`nextdev` or whatever the project's live rev-loop is). The user watches it in a browser on the workstation — it never moves to `dev-builder`. Only batch/heavy steps offload.
- **Existing projects already running local `podman-postgres`.** The policy is not retroactive — don't migrate a running project's DB unless asked by name. New projects (or an explicit migration request) are the only automatic-default cases.

**Traveling / VM unreachable → fall back to local automatically.** Don't ask first. Check reachability; if the box isn't there, run the local equivalent (the `podman-postgres` skill for the DB, or the step on the workstation) and note in the report that it ran locally because the homelab wasn't reachable. That is expected behavior off the home LAN, not an error.

### Availability check

Cheap and fast — do this before deciding where something runs:

```sh
ssh -o ConnectTimeout=3 -o BatchMode=yes dev-builder 'true' && echo REACHABLE || echo UNREACHABLE
```

Same pattern for `dev-postgres`. A timeout or connection failure means fall back to local — don't retry, don't wait longer, don't ask.

If SSH fails with `sign_and_send_pubkey: signing failed` and you use a password-manager SSH agent, the vault has re-locked. That is not a Proxmox-side problem — unlock the agent and retry once.

## Point a project's local dev DB at dev-postgres

**Default for any brand-new project's first Postgres setup, when reachable.** For an existing project on local `podman-postgres`, only do this if explicitly asked to migrate it.

1. Check whether the project is already opted in: `grep DATABASE_URL .env.local`. A host that is the Postgres VM's address = already opted in; `localhost`/`127.0.0.1` = still on local `podman-postgres`.
2. **Before first use ever on this VM**, confirm linger is enabled for the VM's user (one-time, VM-wide setup, not per-project):
   ```sh
   ssh dev-postgres 'loginctl show-user "$USER" --property=Linger'
   ```
   If it says `Linger=no`, run `ssh dev-postgres 'sudo loginctl enable-linger "$USER"'` first. Skipping this means the Postgres container dies silently the moment the SSH session that started it closes — rootless Podman ties containers to the systemd login session, and the container shows a clean `Exited (0)` with nothing in the logs. **Use `--restart=always`, not `unless-stopped`** — only `always` matches the filter `podman-restart.service` uses to bring containers back after a VM reboot; `unless-stopped` silently never restarts.
3. Create the project's database on `dev-postgres` if it doesn't exist yet (identical to the `podman-postgres` skill's recipe, run over SSH):
   ```sh
   ssh dev-postgres '
   APP=<project>
   podman run -d --name "${APP}-pg" --restart=always \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="${APP}" \
     -p 0.0.0.0:5432:5432 \
     -v "${APP}-pgdata:/var/lib/postgresql/data" \
     docker.io/library/postgres:16
   '
   ```
   Bind to `0.0.0.0`, not bare `-p 5432:5432` — it must be reachable from the workstation, not just loopback on the VM. Use a distinct host port (5433, 5434, …) if another project's container already holds 5432 — check with `ssh dev-postgres 'podman ps'` first.

   The `postgres`/`postgres` credentials are fine for a LAN-only dev box with no project data worth protecting. Do not reuse this pattern for anything reachable from outside the LAN.
4. Update the project's `.env.local` (never committed): change `DATABASE_URL`'s host from `localhost` to the Postgres VM's address (or an `/etc/hosts` / DNS name for it). Same port, user, password and db name as before; nothing else changes.
5. If migrating existing local data (not a fresh DB), dump from the local container and restore into the new one:
   ```sh
   podman exec -i <app>-pg pg_dump -U postgres -d <app> > /tmp/<app>.sql
   psql "postgres://postgres:postgres@<dev-postgres-host>:5432/<app>" < /tmp/<app>.sql
   ```
6. Confirm it works before calling it done: `psql "$DATABASE_URL" -c 'select 1;'` from the workstation, then run the project's normal dev server / test suite against it once.

**If dev-postgres is unreachable:** fall back to the `podman-postgres` skill's local recipe and note the fallback in the report.

To revert a project to local: change the `.env.local` host back to `localhost`. Leave the container running (harmless), or `ssh dev-postgres 'podman stop <app>-pg'` to remove it from play.

## Run a build/test/E2E step on dev-builder instead of the workstation

**Default for build/test/typecheck/E2E steps when reachable.** Does not cover the interactive dev server.

```sh
ssh dev-builder '
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env --use-on-cd)"
mkdir -p ~/projects && cd ~/projects
if [ -d <repo> ]; then cd <repo> && git fetch && git checkout <branch> && git pull; else gh repo clone <org>/<repo> -- --branch <branch> && cd <repo>; fi
pnpm install --frozen-lockfile
pnpm <script>   # test, build, typecheck — whatever the task needs
'
```

**If dev-builder is unreachable:** run the step locally per your normal machine-capacity guidance (check load first, skip the full gate if hot). Note the fallback in the report.

Notes:

- **`fnm` doesn't load from `.bashrc` in a non-interactive SSH command.** Ubuntu's `~/.bashrc` returns immediately for non-interactive shells (the `case $- in *i*)` guard near the top), so anything appended to it is skipped for `ssh host 'cmd'`. Always `eval "$(fnm env --use-on-cd)"` explicitly inside the remote command.
- **GitHub auth is `gh` over HTTPS, not SSH keys**, matching how the workstation authenticates. `gh repo clone` and `git clone https://…` just work. To (re-)authenticate from a workstation where `gh` is already logged in:
  ```sh
  gh auth token | ssh dev-builder 'gh auth login --with-token && gh auth setup-git'
  ```
  This stores a long-lived token on the VM's disk (`~/.config/gh/hosts.yml`) — acceptable for a LAN-only box behind your SSH key, but know it's there. Prefer a fine-grained, least-privilege token if you can.
- **Playwright deps are per-repo, not pre-baked** — repos pin different Playwright versions, so run `npx playwright install --with-deps` inside the specific checkout rather than assuming a system-wide install.
- **Clean up test clones when done** so `~/projects/` on the VM doesn't accumulate stale checkouts: `ssh dev-builder 'rm -rf ~/projects/<repo>'` once you've reported the result.
- Report results the same way you would for a local run — output, pass/fail, timing, and **which box it ran on** (the VM, or the workstation if it fell back). Remote execution should otherwise be invisible.

## Where the deeper material lives

[references/homelab-infra.md](references/homelab-infra.md) covers building and operating the Proxmox side: SSH aliases, the cloud-init golden-image template, cloning VMs, ISO downloads, static-IP and first-boot gotchas, and GPU passthrough for a local-LLM VM (Ollama + Open WebUI). Read it when a VM needs to be created, rebuilt, or debugged — not for day-to-day use of the two VMs above.
