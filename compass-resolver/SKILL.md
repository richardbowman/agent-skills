---
name: compass-resolver
description: >
  Autonomous job that finds the single highest-priority unclaimed item in Compass
  (Roadmap NOW horizon first, falling back to the top-voted untriaged feedback item),
  implements a real fix in the compass repo end to end (tests, typecheck, build), opens
  a PR, watches the preview deploy, and updates Compass so the same item is never picked
  up twice. Use when running the scheduled Compass Auto-Resolver cron job, or manually
  to pull and ship the next top-priority item right now.
---

# Compass Auto-Resolver

Turns the top item in the Compass pipeline into a real, reviewable PR — no human has to
manually assign the work. This is the "implementation" half of the loop; the
`compass-feedback-triage` skill is the "intake" half (OPEN feedback → opportunities →
roadmap). Run triage first if it hasn't run recently — this skill only *acts* on items
that are already prioritized (roadmap NOW) or clearly high-signal (voted feedback); it
does not do intake triage itself.

**Repo:** `/Users/rickbowman/projects/compass`
**Compass org/workspace:** `rbcodelabs` / `compass`

## Non-negotiable guardrails

1. **One item per run.** Ship exactly one PR, or zero if nothing is eligible. Never batch
   multiple roadmap items into one run — keeps PR volume reviewable and blast radius small.
2. **PR only. Never merge, never `--force` push, never `git push --force`, never skip
   hooks (`--no-verify`).** A human merges. This is a hard rule, not a default — do not
   escalate to auto-merge even if checks are green.
3. **Never fabricate a fix.** If the top item can't be scoped with reasonable confidence
   after real investigation (ambiguous requirements, needs a product decision, touches
   auth/billing/data-destructive paths), do NOT force a low-quality patch. Skip it, leave
   it unclaimed, and say exactly why in the final report. Move to the next eligible item
   only if this run has budget left — otherwise end the run with zero PRs and report why.
4. **Never touch secrets directly.** If the fix requires a new/rotated secret, stop and
   report — do not guess values or write them to code/env files. Follow CLAUDE.md's
   secret-handling rules (1Password + `vercel env`) or use `request_secret`.
5. **No silent duplicate work.** Always run the claim-check in Step 2 before writing any
   code. If in doubt whether something is already claimed, treat it as claimed and skip it.
6. **Two failures means change strategy.** If the same fix approach fails twice (test
   still red, build still broken), stop, re-read the actual error, form a new hypothesis.
   Do not attempt a third variation of the same broken approach.
7. **Isolate in a worktree.** Never edit the primary checkout at
   `/Users/rickbowman/projects/compass` directly — this session and Rick's own local
   session may both be using it.

## Standing task procedure

This is a substantial, extended autonomous task. Use `TaskCreate` for each requirement
below plus a final "end-to-end verification" item; work one at a time; mark items
`completed` only after observing the result (not assuming it). See the user's global
Task Procedure rules — they apply in full here since this runs unattended.

---

## Step 1 — Resolve workspace and pick the target item

1. Invoke the `compass` skill for the MCP tool catalog and data model if not already loaded.
2. `list_workspaces(orgSlug: "rbcodelabs")` → get the `Compass` workspace's `workspaceId`.
3. `list_roadmap_items(workspaceId, horizon: "NOW")`.
4. **Eligibility filter**, in list order (list order = kanban priority order, top = highest):
   - Skip any item whose `title` already starts with `🤖` — that is the claim marker
     (see Step 2). It means a previous run already opened a PR for this item.
   - For items with a linked `Opportunity`, call `get_opportunity(opportunityId)` and
     skip if its status is already `ACTIVE` (another run/human already claimed it) or if
     any of its solutions is `IN_DELIVERY` / `SHIPPED`.
   - The **first surviving item in list order is the target.**
5. **Fallback tier** — only if Step 4 yields zero eligible NOW items:
   - `list_feedback(workspaceId, status: "OPEN")` and, if empty, also check `status: "PLANNED"`
     items whose linked opportunity is still `EXPLORING`/`VALIDATING` with no roadmap item yet.
   - Rank by `voteCount` descending. Take the top one as the target-to-promote.
   - If it's typed `BUG`: `promote_feedback_to_roadmap(feedbackId, horizon: "NOW")` directly.
   - If it's typed `IDEA` and has no linked opportunity yet: create one (`create_opportunity`
     → `add_solution` → `add_assumption` with the riskiest testable assumption), then
     `promote_to_roadmap(solutionId, horizon: "NOW")`, then `link_feedback_to_opportunity`.
   - Re-fetch the new roadmap item's ID and continue at Step 2 as if it came from Step 4.
   - If **both tiers are empty** (no NOW items, no OPEN/PLANNED feedback with signal): do
     nothing. Report "queue empty, no action taken" and end the run. Do not invent work.

## Step 2 — Claim it before writing any code

Compass's MCP API has a real gap here: there is no `get_roadmap_item` or
`update_opportunity` (non-status) tool, so you cannot safely read-modify-append a
description field. Use only fields you already have and can set outright:

1. **Cross-check GitHub first** in case Compass state drifted from reality: from the repo,
   `gh pr list --state all --search "<first 8 chars of the roadmap item's UUID>"`. If a PR
   already exists (open or merged) referencing this item, treat it as claimed — do not
   duplicate. Fix the Compass claim marker instead (title prefix + opportunity status) and
   move to the next eligible item.
2. Rename the roadmap item using the **exact title you already fetched**, prefixed:
   `update_roadmap_item(itemId, title: "🤖 " + originalTitle)`.
3. If the item has a linked opportunity: `update_opportunity_status(opportunityId, status: "ACTIVE")`.
4. These two calls ARE the claim. They must both succeed before you write a single line of
   code. If either fails, stop and report — do not proceed silently.

## Step 3 — Isolate work in a fresh worktree

Use the `worktree-bootstrap` skill (or `EnterWorktree`) to create an isolated worktree off
`main` — do not edit `/Users/rickbowman/projects/compass` directly. Branch naming per
`.claude/pr-guidelines.md`:

- `fix/<slug>-<first8ofUUID>` for bugs
- `feat/<slug>-<first8ofUUID>` for features
- `chore/<slug>-<first8ofUUID>` for non-user-facing work

Embedding the item's short UUID in the branch name is what makes the Step 2 GitHub
cross-check reliable later.

## Step 4 — Investigate and implement

1. Read the item's full context: `get_opportunity` (if linked) for description, customer
   segment, and existing solutions/assumptions; any linked feedback via
   `get_feedback_item` for the original report/repro details.
2. Actually read the relevant source before editing — grep/Explore the codebase, don't
   guess file locations. Compass conventions: server actions in `<section>/actions.ts`,
   Prisma via `getPrisma()` from `lib/db.ts` (never import `PrismaClient` directly), MCP
   tool handlers extracted into `lib/` for testability.
3. Follow **TDD**: write a failing test first (`__tests__/` for unit/integration), then
   the minimal fix, then confirm green. Use the `test-first` skill if useful.
4. If the fix needs a schema change: use `dsql-migrate` / `dsql-schema` skills — Aurora
   DSQL has no autoincrement/enum/FK support, no `@updatedAt` triggers, indexes are async.
   Any Prisma schema change requires `prisma db push` against dev, confirmed successful,
   before opening the PR.
5. Keep the change scoped to the one item. Resist drive-by refactors — they slow review
   and widen blast radius.

## Step 5 — Verify before opening the PR

Run the full `.claude/pr-guidelines.md` checklist (or invoke the `pr-checklist` skill):
`pnpm test`, `pnpm tsc --noEmit`, `pnpm build`, and E2E screenshots/functional suites if
the change touches a covered journey. All must be observed green — not assumed. New MCP
tools need unit tests in `__tests__/` and a docs update in `docs/content/09-mcp-api.md`
(plus flag if `~/.claude/skills/compass/SKILL.md` needs a matching update).

## Step 6 — Push and open the PR

1. Commit with a message describing the *why*. Push the branch (no force, no skipped hooks).
2. `gh pr create` with:
   - Title mirroring the roadmap item's original title (without the 🤖 prefix).
   - Body: what changed, why, test plan, and — if a data migration script is needed — a
     "Migration required" section (script path, when to run it, one-line rollback).
   - Reference the Compass roadmap item ID and, if applicable, the originating feedback ID
     in the PR body for traceability.

## Step 7 — Watch the deploy and smoke-test (standing approval, no need to ask)

Per the `vercel-tools` skill and the user's standing PR-deploy-monitoring rule: wait for
the Vercel preview deploy, smoke-test the affected flow, note the preview URL in the PR.
Only interrupt/flag to the user if something is actually broken (failed deploy, route
errors, migration needed) — otherwise this is silent, expected background work.

## Step 8 — Update Compass with the outcome

- Append the PR URL to the roadmap item title is already done (Step 2); no further title
  change needed.
- If a new opportunity/solution was created in the fallback tier, leave status `ACTIVE`
  (already set in Step 2) — do not move it to `ARCHIVED`; that's for after merge+ship,
  which is a human/future-run decision, not this run's.
- If the run pulled from the feedback fallback tier, the feedback item is already
  `PLANNED` (via `link_feedback_to_opportunity`/`promote_feedback_to_roadmap`) — no
  further status change needed.

## Step 9 — Report

End every run (including no-op runs) with a short report:
- Item picked (title, ID, source tier: NOW-horizon vs feedback-fallback), or "queue empty."
- What changed (files, approach) and why.
- Verification results actually observed (test/build/tsc, E2E if run).
- PR URL, preview URL, smoke-test result.
- Anything skipped and why (ambiguous scope, needs a secret, needs a product decision).

## Edge cases

- **Roadmap NOW item has no linked opportunity** (e.g. "Marketing Site" — a pure
  execution task, not tied to the OST): still eligible. Skip the opportunity-status claim
  in Step 2 (nothing to update) and rely on the title-prefix marker alone.
- **Ambiguous or too-large item** (e.g. spans multiple files/systems, unclear acceptance
  criteria): do not force it into one PR. Either scope down to the smallest real slice of
  the item and say so explicitly in the report, or skip per guardrail #3.
- **Item requires a design/product decision** (multiple valid UX approaches, no existing
  pattern to follow): skip per guardrail #3 rather than guessing — flag it in the report
  as needing human input, and leave it unclaimed (do not apply the 🤖 marker) so a human
  or a future `EnterPlanMode` session can pick it up properly.
