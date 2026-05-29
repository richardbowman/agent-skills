---
name: worktree-cleanup
description: Clean up stale local git worktrees and merged/closed branches. Use when the user asks to tidy up branches, prune worktrees, or clean up after a sprint. Checks GitHub PR state to confirm which branches are safe to delete, then prunes prunable worktrees and removes local branches.
---

# Worktree & branch cleanup

Removes stale local branches and prunable worktrees after confirming their PR status on GitHub.

## Steps

### 1. Show current state

```sh
git worktree list
git branch -a
```

### 2. Check PR status for all local branches

```sh
gh pr list --state all --base main --limit 100 --json headRefName,state,title,mergedAt \
  | jq -r '.[] | "\(.state)\t\(.headRefName)\t\(.title)"' | sort
```

Cross-reference to categorize each local branch:
- **MERGED** — safe to delete
- **CLOSED** (not merged) — confirm with user before deleting
- **OPEN** — leave alone
- **No PR** — confirm with user before deleting

### 3. Prune worktrees

```sh
git worktree prune
```

This only removes worktrees already marked as prunable (no linked directory). Safe to run unconditionally.

### 4. Delete merged branches

Try safe delete first (`-d`), force-delete (`-D`) only for branches confirmed merged via GitHub but not recognized as merged locally (common with squash merges):

```sh
# Safe delete (git-merged ones)
git branch -d <branch1> <branch2> ...

# Force-delete confirmed-merged-on-GitHub branches that git doesn't recognize
git branch -D <branch1> <branch2> ...
```

Do NOT force-delete:
- Branches with no PR
- CLOSED (not merged) PRs — ask the user first
- Any branch the user hasn't confirmed

### 5. Report

Summarize what was deleted and flag anything left for the user to decide on.

## Notes

- Worktrees flagged as `prunable` in `git worktree list` are safe to prune — they have no uncommitted changes and their directory is gone or detached.
- Squash-merge workflows often leave branches that `git branch -d` considers unmerged even though GitHub shows MERGED. Use `-D` for those after confirming via `gh pr list`.
- Remote branches (`origin/...`) are not deleted — only local tracking refs. Run `git remote prune origin` if you also want to clean up stale remote-tracking refs.
