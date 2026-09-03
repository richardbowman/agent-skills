---
name: create-pr
description: >-
  Create a pull request for the current branch — commits pending changes if
  needed, catches up with the default branch, pushes, opens a PR via gh with
  a generated title/summary, and surfaces the Vercel preview link if the repo
  deploys there. Use when the user says "create a PR", "open a PR", "ship
  this branch", or similar.
metadata:
  priority: 2
retrieval:
  aliases:
    - open a pr
    - make a pull request
    - ship this branch
    - create pull request
---

# Create PR

Short and mechanical — this skill opens the PR. For the pre-PR definition-of-
done checks (types, tests, docs, screenshots), run `pr-checklist` first if it
hasn't already passed.

## Steps

1. **Survey.** Run in parallel: `git status`, `git diff` (staged + unstaged),
   `git log --oneline -10`, and check whether the branch tracks a remote.
2. **Commit if there are unstaged/staged changes.** Stage specific files
   (never `-A`/`.`), write a 1-2 sentence message focused on *why*, follow
   this repo's commit style from `git log`. Never `--amend` or `--no-verify`
   unless asked.
3. **Catch up with the default branch.** `git fetch origin`, diff against
   `origin/<default-branch>`, rebase/merge if behind, resolve conflicts.
4. **Push.** `git push -u origin <branch>` (or plain `push` if already
   tracked).
5. **Open the PR.**
   ```
   gh pr create --title "<short title, <70 chars>" --body "$(cat <<'EOF'
   ## Summary
   - <1-3 bullets, from the actual diff/commits — not the ask>

   ## Test plan
   - [ ] <how to verify>
   EOF
   )"
   ```
6. **If the repo deploys to Vercel** (`vercel.json`, `.vercel/`, or a known
   Vercel project): use the `vercel-tools` skill's `vercel-wait-deploy`
   against this branch — never a hand-rolled polling loop — and capture the
   preview URL.
7. **Report back** with both links on their own lines: the PR URL and, if
   step 6 applied, the `*.vercel.app` preview URL. If the Vercel build
   failed, say so explicitly instead of omitting the link.

Do not push to `main`/`master`, force-push, or skip hooks unless explicitly
asked.
