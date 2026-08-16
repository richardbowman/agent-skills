---
name: doc-edit
description: >-
  Edit docs in bridged repos (Agentic PM Playbook, Agent Skills, Claude Config,
  product docs) with proper version control. Creates a worktree so edits land
  on a branch, leverages bridge auto-flip so Obsidian shows the worktree files,
  then pushes and PRs via the bridge. Use whenever asked to update or create docs
  that live in a bridged repo vault folder.
---

# Doc Edit Workflow

Use this skill whenever the target file is inside one of the bridged vault folders
below. Editing on a worktree branch keeps main clean and gives every doc change a
PR for review.

**Vault-native paths** (`Agent How-Tos/`, `Claude/`, `Daily/`, `CLAUDE.md`) are
NOT bridged — edit them directly without this skill.

---

## Bridged Repo Map

| Vault path | Repo path | Bridge name |
|---|---|---|
| `Playbooks/Agentic PM Playbook/` | `~/projects/agent-pm-playbook` | Agentic PM Playbook |
| `Skills/` | `~/projects/agent-skills` | Agent Skills |
| `Config/Claude Code/` | `~/projects/claude-config` | Claude Code Config |
| `Playbooks/Claude Threads/` | `~/projects/obsidian-claude-threads` | Claude Threads Process Docs |
| `Products/Golden Wealth/` | `~/projects/golden-wealth-app` (product/) | Golden Wealth Product Strategy |
| `Products/HipTrip/` | `~/projects/hip-trip-marketing-site` (product/) | HipTrip Product Strategy |
| `Products/Helio/` | `~/projects/helio` (product/) | Helio Product Strategy |
| `Products/Trust & Will Guide/` | `~/projects/trustandwillguide` (product/) | Trust & Will Guide Product Strategy |

---

## Steps

### 1. Enter a worktree for the target repo

Call `mcp__obsidian__enter_worktree` with the repo path and a descriptive branch name.
The `repoPath` parameter is required when the session cwd is the vault:

```
mcp__obsidian__enter_worktree(
  repoPath: "/Users/rickbowman/projects/agent-pm-playbook",
  branch:   "edit-<short-description>"
)
```

This fires `claude-threads:worktree-changed`. The Vault Bridges plugin picks it up
and automatically flips the matching bridge to point at the new worktree. Rick sees
a Notice in Obsidian. The vault folder now reflects the worktree branch.

### 2. Make the edits

**Claude editing:** use Read / Edit / Write on the vault path (e.g.
`~/Documents/Personal/Playbooks/Agentic PM Playbook/...`). Bridge symlinks route
writes into the worktree automatically. Alternatively write directly to the worktree
path returned by `enter_worktree`.

**Rick editing in Obsidian:** tell him the branch name and that the bridge has
flipped. He edits in Obsidian normally. Wait for his confirmation before proceeding.

### 3. Push via bridge command

Look up the push command dynamically — never hardcode the UUID:

```
obsidian_list_commands("Push")
```

Find the entry matching the bridge name (e.g.
`vault-bridges:push-bridge-99c29a43-...` for "Agentic PM Playbook"). Then:

```
obsidian_execute_command("<push-command-id>")
```

The bridge copies vault changes into the worktree, commits them, and pushes the
branch to the remote.

### 4. Open a PR

```sh
gh pr create \
  --repo <owner>/<repo> \
  --base main \
  --head edit-<description> \
  --title "docs: <what changed>"
```

### 5. Exit the worktree

```
mcp__obsidian__exit_worktree()
```

The bridge auto-flips back to main. Obsidian returns to showing main-branch content.

---

## Troubleshooting

**Bridge didn't auto-flip:** `autoFlipWorktrees` may be off in Vault Bridges settings.
Manually flip via Cmd+P: "Vault Bridges: Switch Worktree for [bridge name]".

**Push modal shows dirty-warning:** vault has pre-existing edits. Choose "Push then
Pull" to include them, or "Discard" to drop them.

**Exit blocked on unpushed edits:** run the bridge push command first, then exit.
