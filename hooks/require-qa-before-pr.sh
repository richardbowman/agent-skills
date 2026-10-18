#!/usr/bin/env bash
# PreToolUse hook (Bash): refuse `gh pr create` until full QA is on record for the branch.
#
# Satisfied only by a line  `QA-GATE: PASS branch=<branch>`  in a vault run note
# (Products/*/Runs/*.md) modified in the last 24h. Write that line ONLY after the repo's
# pr-checklist, a local-server qa run with desktop+mobile screenshots, and any required
# functional E2E all actually passed this session. Repos declaring `Repo mode: prototype`
# in CLAUDE.md/AGENTS.md are exempt. Override the vault with VAULT_ROOT.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
# Also gate the REST route to opening a PR (gh api repos/<o>/<r>/pulls with POST fields),
# which would otherwise bypass this hook entirely.
IS_CREATE=0
echo "$CMD" | grep -qE '(^|[;&| ]|\s)gh +pr +create' && IS_CREATE=1
if echo "$CMD" | grep -qE '(^|[;&| ]|\s)gh +api ' \
   && echo "$CMD" | grep -qE 'repos/[^ ]+/pulls( |$|")' \
   && echo "$CMD" | grep -qE '(-X|--method)[ =]+POST|(-f|-F|--field|--raw-field) +(title|head)='; then IS_CREATE=1; fi
[ "$IS_CREATE" = 1 ] || exit 0

CWD=$(echo "$INPUT" | jq -r '.cwd // ""'); [ -z "$CWD" ] && CWD=$PWD
# The session cwd is often the main checkout while the work lives in a worktree, reached via
# "cd <dir> && ..." or "git -C <dir>". Resolve the directory the command actually targets so
# the gate checks the branch being shipped, not the session's checkout.
TARGET=$(echo "$CMD" | sed -nE 's/(^|.*[;&|] *)cd +("([^"]+)"|([^ ;&|]+)).*/\3\4/p' | head -1)
[ -z "$TARGET" ] && TARGET=$(echo "$CMD" | sed -nE 's/.*git +-C +("([^"]+)"|([^ ;&|]+)).*/\2\3/p' | head -1)
TARGET="${TARGET/#\~/$HOME}"
[ -n "$TARGET" ] && [ -d "$TARGET" ] && CWD=$TARGET
# An explicit --head <branch> (or head=<branch> field) wins when present.
HEAD_ARG=$(echo "$CMD" | sed -nE 's/.*--head[ =]+([^ ]+).*/\1/p' | head -1)
[ -z "$HEAD_ARG" ] && HEAD_ARG=$(echo "$CMD" | sed -nE 's/.*-[fF] +head=([^ ]+).*/\1/p' | head -1)
ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
for f in CLAUDE.md AGENTS.md; do
  grep -qs '^Repo mode: prototype' "$ROOT/$f" && exit 0
done
BRANCH=$(git -C "$CWD" branch --show-current)
[ -n "$HEAD_ARG" ] && BRANCH="${HEAD_ARG#*:}"
VAULT="${VAULT_ROOT:-}"
if [ -z "$VAULT" ]; then
  for cand in "$HOME/Documents/Personal" "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/Personal"; do
    [ -d "$cand/Products" ] && { VAULT="$cand"; break; }
  done
fi

if find "$VAULT/Products" -path '*/Runs/*.md' -mtime -1 -print0 2>/dev/null \
   | xargs -0 grep -lsF "QA-GATE: PASS branch=$BRANCH" 2>/dev/null | grep -q .; then
  exit 0
fi

cat >&2 <<MSG
BLOCKED: no QA on record for branch '$BRANCH'. Do not open the PR yet.
Required first (non-prototype repo):
  1. pr-checklist skill passes (tsc, full tests, build, docs, migration through the runner).
  2. Local dev server + the 'qa' subagent drives the UI; desktop 1280x800 AND mobile 390x844 screenshots, viewed.
  3. New user-facing flow => functional E2E spec added and passing.
  4. QA report written to the vault: Products/<Project>/Runs/<slug>-<date>-<topic>.md
When ALL pass, add the exact line to that note:  QA-GATE: PASS branch=$BRANCH
Machine load never replaces this gate: wait for load to drop, then run it in full.
MSG
exit 2
