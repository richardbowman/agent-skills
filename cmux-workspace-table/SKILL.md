---
name: cmux-workspace-table
description: Show a table of all workspaces in the current CMUX window with their task titles, working directories, and worktree paths.
---

# CMUX Workspace Table

Display a table of all workspaces in the current CMUX window.

## Steps

**1. Find the current window.**

Do NOT use `cmux current-window` — it returns the focused window, not this session's window.

Instead run `cmux identify` and extract `caller.workspace_ref` (e.g. `workspace:25`).

Then run `cmux tree --workspace <ref>` and extract the `window window:N` line to get the window ref.

**2. List workspaces in that window.**

```
cmux list-workspaces --window <window-uuid>
```

Use the UUID from `cmux list-windows` that matches the window ref, not the numeric index.

**3. For each workspace, get its tree.**

```
cmux tree --workspace workspace:N
```

Extract the tty for each terminal surface.

**4. For each tty, get the working directory.**

```
pid=$(lsof -t /dev/<tty> 2>/dev/null | head -1)
lsof -p $pid -a -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//'
```

**5. Check for git worktrees.**

If a cwd is inside a repo, run:
```
git -C <repo-root> worktree list
```
to find the worktree branch for each path.

**6. Render the table.**

| Workspace | Name | Task | Worktree Path |
|---|---|---|---|
| workspace:N | name | active claude task title | path or — |

- Task title comes from the surface name in `cmux tree` output (the quoted string after `[terminal]`)
- Worktree path is the full path if it's a worktree, `—` if it's the main checkout or unknown
