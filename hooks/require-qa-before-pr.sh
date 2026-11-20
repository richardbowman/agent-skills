#!/usr/bin/env bash
# PreToolUse hook (Bash): refuse `gh pr create` until full QA is on record for the branch.
#
# Compass projects (repo has pm-config.md naming Compass): the QA report lives in Compass and the
# gate is satisfied by a local receipt, ~/.claude/qa-gates/<branch with / as __>.gate (override the
# dir with QA_GATE_DIR), modified in the last 24h, containing ONE line:
#   QA-GATE: PASS branch=<branch> task=TASK-<n> report=<https url of the Compass QA doc>
# Write it ONLY after the QA report was posted to Compass and linked to the Compass Task.
# Vault fallback: if Compass was unreachable, a vault run note (Products/*/Runs/*.md, modified in
# the last 24h) with both  `QA-GATE: PASS branch=<branch>`  and  `COMPASS-UNAVAILABLE: <reason>`.
# Non-Compass repos: the vault note with the PASS line alone is enough (original behaviour).
# Write any of these ONLY after the repo's pr-checklist, a local-server qa run with desktop+mobile
# screenshots, and any required functional E2E all actually passed this session. Repos declaring
# `Repo mode: prototype` in CLAUDE.md/AGENTS.md are exempt. Override the vault with VAULT_ROOT.

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
VAULT="${VAULT_ROOT:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/Personal}"

IS_COMPASS=0
grep -qsi 'compass' "$ROOT/pm-config.md" && IS_COMPASS=1

if [ "$IS_COMPASS" = 1 ]; then
  GATE_DIR="${QA_GATE_DIR:-$HOME/.claude/qa-gates}"
  RECEIPT="$GATE_DIR/$(printf '%s' "$BRANCH" | sed 's#[/ ]#__#g').gate"
  if [ -f "$RECEIPT" ] && [ -n "$(find "$RECEIPT" -mtime -1 2>/dev/null)" ] \
     && grep -qF "QA-GATE: PASS branch=$BRANCH " "$RECEIPT" \
     && grep -qE ' task=TASK-[0-9]+( |$)' "$RECEIPT" \
     && grep -qE ' report=https://[^ ]+' "$RECEIPT"; then
    exit 0
  fi
  # Fallback: Compass was unavailable, so the report is in the vault and says why.
  if find "$VAULT/Products" -path '*/Runs/*.md' -mtime -1 -print0 2>/dev/null \
     | xargs -0 grep -lsF "QA-GATE: PASS branch=$BRANCH" 2>/dev/null \
     | xargs grep -lsE '^COMPASS-UNAVAILABLE: .+' 2>/dev/null | grep -q .; then
    exit 0
  fi
elif find "$VAULT/Products" -path '*/Runs/*.md' -mtime -1 -print0 2>/dev/null \
   | xargs -0 grep -lsF "QA-GATE: PASS branch=$BRANCH" 2>/dev/null | grep -q .; then
  exit 0
fi

if [ "$IS_COMPASS" = 1 ]; then
cat >&2 <<MSG
BLOCKED: no QA on record for branch '$BRANCH' (Compass project). Do not open the PR yet.
Required first (non-prototype repo):
  1. pr-checklist skill passes (tsc, full tests, build, docs, migration through the runner).
  2. Local dev server (or dev-builder) + the 'qa' subagent drives the UI; desktop 1280x800 AND mobile 390x844 screenshots, viewed.
  3. New user-facing flow => functional E2E spec added and passing.
  4. Compass: a Compass Task exists for this work (create or find it), the QA report is posted as a Compass Doc
     and linked to that Task (pr-checklist Step 4). Screenshots stay in the vault: Attachments/QA/<Project>/.
  5. Write the receipt  $HOME/.claude/qa-gates/$(printf '%s' "$BRANCH" | sed 's#[/ ]#__#g').gate  with one line:
       QA-GATE: PASS branch=$BRANCH task=TASK-<n> report=<Compass doc URL>
  If Compass is unreachable (tool errors, not just slow), write the report to the vault instead
  (Products/<Project>/Runs/<slug>-<date>-<topic>.md) with both lines:
       QA-GATE: PASS branch=$BRANCH
       COMPASS-UNAVAILABLE: <the actual error>
  and back-fill the Compass doc/task when it returns.
Machine load never replaces this gate: wait for load to drop, then run it in full.
MSG
else
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
fi
exit 2
