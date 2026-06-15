---
name: vault-bridge
description: >-
  Sync files between the Obsidian vault and their backing git repos using the
  Vault Bridges plugin. Use whenever writing a new file to the vault that
  belongs to a bridged repo, or pulling repo changes into the vault. Never
  manually cp between vault and repo — always use bridge commands.
retrieval:
  aliases:
    - vault bridge
    - bridge push
    - bridge pull
    - sync vault
    - push to git from vault
    - pull from git to vault
  intents:
    - commit and push the vault file
    - sync this to the repo
    - push the playbook
    - push the vault changes
---

# Vault Bridge Workflow

The Vault Bridges plugin maintains live links between vault folders and git
repos. Never `cp` or manually sync files between them — use the bridge
commands instead.

---

## Step 1 — Discover available bridges

```
obsidian_list_commands(query: "vault bridge")
```

This returns all registered bridge commands. Look for:
- `vault-bridges:push-bridge-<id>` — push vault → git repo (commit + push)
- `vault-bridges:pull-bridge-<id>` — pull git repo → vault (overwrite vault copy)
- `vault-bridges:sync-all-bridges` — pull all bridges at once
- `vault-bridges:push-all-bridges` — push all bridges at once

Match the bridge name in the command label (e.g. `"Push \"Agentic PM Playbook\""`)
to the folder you just wrote to.

---

## Step 2 — Choose direction

| You did this | Run this |
|---|---|
| Wrote or edited a file **in the vault** | `push-bridge-<id>` for that bridge |
| Someone committed directly to the **git repo** | `pull-bridge-<id>` for that bridge |
| Multiple bridges changed | `push-all-bridges` or `sync-all-bridges` |

---

## Step 3 — Execute

```
obsidian_execute_command(commandId: "vault-bridges:push-bridge-<id>")
```

The command commits and pushes to the remote. No separate `git add` / `git commit` / `git push` needed — the bridge handles it.

---

## When to invoke this skill

- After writing any new file to a vault folder that is backed by a git repo
- After editing an existing bridged file in the vault
- Before telling the user a vault change has been committed/pushed
- When asked to "push the playbook", "sync the vault", or "commit this to the repo"

**The failure mode this prevents:** writing to the vault, then manually `cp`-ing
to the git repo and pushing with `git` — which duplicates work and risks the
vault and repo drifting out of sync.
