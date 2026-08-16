#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write to ~/projects/ when NOT in a linked git worktree.
#
# A linked worktree has a .git FILE at the repo root (pointing back to the main repo).
# The main checkout has a .git DIRECTORY. We allow the former and block the latter.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
  2>/dev/null)

# Nothing to check
[ -z "$FILE_PATH" ] && exit 0

# Expand leading ~
FILE_PATH="${FILE_PATH/#\~/$HOME}"

# Only care about paths inside ~/projects/
[[ "$FILE_PATH" != "$HOME/projects/"* ]] && exit 0

# Find the git root for this file's directory
FILE_DIR=$(dirname "$FILE_PATH")
GIT_ROOT=$(git -C "$FILE_DIR" rev-parse --show-toplevel 2>/dev/null)

# Not a git repo — don't block (could be a new project being set up)
[ -z "$GIT_ROOT" ] && exit 0

# .git is a FILE → we're in a linked worktree → allow
[ -f "$GIT_ROOT/.git" ] && exit 0

# .git is a DIRECTORY → we're in the main checkout → block
python3 -c "
import json, sys
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'deny',
    'permissionDecisionReason': (
      'BLOCKED: You are editing ~/projects/ from the main git checkout, not a worktree.\n\n'
      'Required workflow:\n'
      '  1. State the plan (repo, branch name, 2-3 sentence approach). Wait for confirmation.\n'
      '  2. Create a worktree: git -C ~/projects/<repo> worktree add .claude/worktrees/<branch> -b <branch>\n'
      '  3. EnterWorktree path=~/projects/<repo>/.claude/worktrees/<branch>\n'
      '  4. Then code.\n\n'
      'See Claude/coding-task-workflow.md for full details.'
    )
  }
}))
"
exit 2
