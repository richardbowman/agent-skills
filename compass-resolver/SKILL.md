---
name: compass-resolver
description: >
  Autonomous job that finds the single highest-priority unclaimed item in Compass
  (Roadmap NOW horizon first, falling back to a well-defined NEXT item promoted into NOW,
  falling back to the top-voted untriaged feedback item), implements a real fix in the
  compass repo end to end (tests, typecheck, build), opens a PR, watches the preview
  deploy, and updates Compass so the same item is never picked up twice. Use when running
  the scheduled Compass Auto-Resolver cron job, or manually to pull and ship the next
  top-priority item right now.
---

# Compass Auto-Resolver

Turns the top item in the Compass pipeline into a real, reviewable PR — no human has to
manually assign the work. This is the "implementation" half of the loop; the
`compass-feedback-triage` skill is the "intake" half (OPEN feedback → opportunities →
roadmap). Run triage first if it hasn't run recently — this skill only *acts* on items
that are already prioritized (roadmap NOW), clearly well-defined (NEXT, backfilled into
NOW by this skill), or clearly high-signal (voted feedback); it does not do intake
triage itself.

Note: this skill file is shared across every Compass workspace's resolver cron (Compass,
Helio, HipTrip, Golden Wealth, FamilyLedger, ...). The org slug, workspace slug, and repo
path are passed in via the invocation's ARGUMENTS/prompt — do not hardcode a single
workspace's behavior into this file.

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
   auth/billing/data-destructive paths), do NOT force a low-quality patch. Skip it, mark
   it `⚠️ ` + originalTitle via `update_roadmap_item` (not `🤖` — this isn't a claim, it's
   a "needs human input" flag, and it keeps the eligibility filter in Step 1 from silently
   re-attempting the same item every run), and say exactly why in the final report. Move
   to the next eligible item only if this run has budget left — otherwise end the run with
   zero PRs and report why.
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
   - Skip any item whose `title` already starts with `🤖` (claimed — see Step 2) or `⚠️`
     (previously attempted and skipped as unsuitable — see Edge cases). Both mean a
     previous run already made a final call on this item; don't re-litigate it silently
     every run.
   - For items with a linked `Opportunity`, call `get_opportunity(opportunityId)` and
     skip if its status is already `ACTIVE` (another run/human already claimed it) or if
     any of its solutions is `IN_DELIVERY` / `SHIPPED`.
   - The **first surviving item in list order is the target.**
5. **NEXT-promotion tier** — only if Step 4 yields zero eligible NOW items. Backfills NOW
   from the NEXT horizon instead of leaving it empty, without flooding NOW unsupervised:
   - `list_roadmap_items(workspaceId, horizon: "NEXT")`, walk it top to bottom (list order
     = kanban priority order, same as Step 4).
   - Skip any item whose title already starts with `🤖` or `⬆️` (already claimed or
     already promoted by a prior run). For items with a linked `Opportunity`, skip if its
     status is `ACTIVE` or any solution is `IN_DELIVERY`/`SHIPPED` — same check as Step 4.
   - **Well-defined checklist** — for each surviving item (in order), promote the first
     one where ALL of these are true; otherwise move to the next item:
     - Title + description alone specify the current-wrong-behavior and the correct-
       behavior, with one reasonable implementation approach — not "audit X" or
       "redesign Y".
     - Scoped to a single subsystem/file area, not multi-system.
     - Does NOT require provisioning, rotating, or handling a live secret or credential
       (e.g. "Rotate all production secrets" never qualifies — leave it in NEXT for a
       human).
     - Does NOT require a product/UX decision among multiple valid designs (e.g. a vague
       discoverability or IA item — leave it in NEXT).
     - Is code work, not a documentation/design/strategy deliverable.
   - If an item passes: `update_roadmap_item(itemId, horizon: "NOW", title: "⬆️ " +
     originalTitle)`. The `⬆️` marker means "promoted, not yet claimed" — distinct from
     the `🤖` claim marker in Step 2. **Do not proceed to Step 2 or beyond in this run.**
     This tier only promotes; it does not implement. Skip straight to Step 9 and report
     the promotion (source tier: `NEXT-promoted`) so a human sees what's about to be
     picked up. The *next* scheduled resolver run will find this item via the normal
     Step 4 NOW eligibility filter (its `⬆️` title doesn't match the `🤖` skip pattern)
     and claim/implement it exactly like any human-curated NOW item — see the marker
     note in Step 2 for how the rename is handled then.
   - If nothing in NEXT clears the checklist, fall through to the feedback fallback tier
     (Step 6).
6. **Feedback fallback tier** — only if Steps 4 and 5 yield zero eligible items:
   - `list_feedback(workspaceId, status: "OPEN")` and, if empty, also check `status: "PLANNED"`
     items whose linked opportunity is still `EXPLORING`/`VALIDATING` with no roadmap item yet.
   - Rank by `voteCount` descending. Take the top one as the target-to-promote.
   - If it's typed `BUG`: `promote_feedback_to_roadmap(feedbackId, horizon: "NOW")` directly.
   - If it's typed `IDEA` and has no linked opportunity yet: create one (`create_opportunity`
     → `add_solution` → `add_assumption` with the riskiest testable assumption), then
     `promote_to_roadmap(solutionId, horizon: "NOW")`, then `link_feedback_to_opportunity`.
   - Re-fetch the new roadmap item's ID and continue at Step 2 as if it came from Step 4.
   - If **all three tiers are empty** (no NOW items, no promotable NEXT item, no OPEN/PLANNED
     feedback with signal): do nothing. Report "queue empty, no action taken" and end the
     run. Do not invent work.

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
   `update_roadmap_item(itemId, title: "🤖 " + originalTitle)`. If the fetched title already
   starts with `⬆️ ` (this item was promoted from NEXT by a prior Step 1.5 run — see Step 1
   tier 5), strip that marker first so the final title is `"🤖 " + originalTitle` without a
   leftover `⬆️`, not a double-marked title.
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

## Step 9 — Report and notify

End every run with a short report:
- Item picked (title, ID, source tier: `NOW` / `NEXT-promoted` / `feedback-fallback`), or
  "queue empty."
- What changed (files, approach) and why. For a `NEXT-promoted` run: which item passed the
  well-defined checklist and why, plus which NEXT items (if any) were passed over and why
  they didn't qualify.
- Verification results actually observed (test/build/tsc, E2E if run).
- PR URL, preview URL, smoke-test result.
- Anything skipped and why (ambiguous scope, needs a secret, needs a product decision).

**Notification is Compass itself plus a vault note — there is no separate push
notification for this skill.** Compass's roadmap board is the primary signal (item sitting
in NOW with a `⬆️` or `🤖` marker tells you exactly what state it's in at a glance). On top
of that, for any run that *did* something (PR opened, item promoted, or an item explicitly
skipped with a reason) — but NOT for a pure "queue empty, zero action" no-op — also apply
the user's standing Obsidian Daily Note Rule:

1. Write a short outcome note to
   `~/Documents/Personal/Products/Compass/Runs/<workspace-slug>-YYYY-MM-DD-resolver.md`
   (use the actual run date; if a note already exists at that path for today from an
   earlier run this same day, append to it rather than overwriting). Content: item
   title/ID, source tier, outcome (promoted-only / PR opened / skipped-with-reason), and
   any PR/preview links.
2. Add a wikilink to that note under today's daily note
   (`~/Documents/Personal/Daily/YYYY-MM-DD.md`) in its `## Claude Sessions` section
   (create the section, or the whole daily note from the weekday template, if missing) —
   e.g. `- [[Products/Compass/Runs/golden-wealth-2026-07-21-resolver|Compass Resolver —
   Golden Wealth: promoted "Fix layout width mismatch" to NOW]]`.

This is how a `NEXT-promoted` run gets surfaced to a human before the following day's run
implements it — there is no approval gate beyond this visibility; if the promotion looks
wrong, pull the item back to NEXT (or reject the eventual PR) before/after the next run.

## Edge cases

- **Roadmap NOW item has no linked opportunity** (e.g. "Marketing Site" — a pure
  execution task, not tied to the OST): still eligible. Skip the opportunity-status claim
  in Step 2 (nothing to update) and rely on the title-prefix marker alone.
- **Ambiguous or too-large item** (e.g. spans multiple files/systems, unclear acceptance
  criteria): do not force it into one PR. Either scope down to the smallest real slice of
  the item and say so explicitly in the report, or skip per guardrail #3.
- **Item requires a design/product decision** (multiple valid UX approaches, no existing
  pattern to follow): skip per guardrail #3 rather than guessing — flag it in the report
  as needing human input, and apply the `⚠️` marker (not `🤖`) so a human or a future
  `EnterPlanMode` session can pick it up properly, and future runs don't re-attempt it.
- **A `⬆️`-marked NOW item turns out to be unsuitable on the next run** (e.g. deeper
  investigation in Step 4 reveals it's actually ambiguous or touches a secret): this is
  expected — the well-defined checklist in Step 1 tier 5 is a lightweight pre-filter, not
  a guarantee. Treat it exactly like any other NOW item that fails guardrail #3: skip it,
  report why, and relabel it `⚠️` (replacing the `⬆️`) rather than silently demoting it
  back to NEXT — a human should make that call on where it belongs.
- **Two resolver runs for different workspaces race on the same day**: not a conflict —
  each workspace has its own `workspaceId` and its own roadmap/feedback data, so tiers are
  evaluated independently per workspace. The shared vault note path is namespaced by
  `<workspace-slug>` for the same reason.
