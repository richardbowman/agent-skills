---
name: pr-checklist
description: >-
  Run the pre-PR definition-of-done checklist for a feature branch. Ensures
  types, unit tests, E2E tests, docs, and screenshots are all complete before
  opening a PR or marking a Linear issue In Review. Use whenever a development
  task is considered "done" or a PR is about to be opened.
metadata:
  priority: 2
retrieval:
  aliases:
    - definition of done
    - done checklist
    - pr ready
    - before pr
    - ship checklist
    - release checklist
---

# PR Checklist — Definition of Done

A feature is NOT done until every item below passes. Do not open a PR, push to
main, or mark a Linear issue In Review until this checklist is complete.

## Step 1 — Types

Run the TypeScript compiler and fix all errors before anything else:

```bash
pnpm tsc --noEmit --project tsconfig.build.json
```

If the project uses a different tsconfig, check the project CLAUDE.md for the correct command.

## Step 2 — Unit Tests

```bash
pnpm test   # or: npm test / yarn test depending on project
```

**Requirements:**
- All existing tests pass — do not skip or delete tests to force a green suite
- New tests written for every new function, API route, and component
- Minimum coverage: happy path + at least one error/edge case per unit
- Use the project's established mock patterns (check CLAUDE.md)

## Step 3 — E2E Tests

```bash
pnpm test:e2e   # use the e2e-local skill to set up environment first
```

**Requirements:**
- Any new or changed user-facing flow has a corresponding E2E test
- All existing E2E tests still pass

**If the test command crashes before running any tests** (e.g. "Vitest cannot be imported in CommonJS", "command not found", process exits before reporter output): this is a **tooling bug, not a test failure**. Stop and fix the tooling before treating any work as done. Common causes in pnpm monorepos: wrong binary path, missing root `playwright.config.ts`, test runner scanning the wrong directories. See the `playwright-e2e` skill for monorepo gotchas.

## Step 4 — Docs Review

- Read every doc page in `docs/` (or equivalent) related to the changed feature
- Update copy if any user-facing label, flow, or behavior changed
- Add a new doc page if the feature is entirely new to users

## Step 5 — Screenshots

If the project has a screenshot generation script (e.g. `pnpm docs:screenshots`):

```bash
pnpm docs:screenshots
```

- Run after any UI change
- Commit updated screenshots alongside the code change
- Check CLAUDE.md for the exact command and requirements (usually needs dev server + test secret)

## Step 6 — Final PR Checklist

Before opening the PR, confirm every item:

- [ ] TypeScript: `tsc --noEmit` clean
- [ ] Unit tests: passing + new tests written
- [ ] E2E tests: passing + new/updated tests written
- [ ] Docs: reviewed and updated for any changed user-facing behavior
- [ ] Screenshots: regenerated and committed (if project has `docs:screenshots`)
- [ ] Linear issue: moved to **In Review**
- [ ] PR title: concise, describes the change
- [ ] PR description: explains *why* the change was made, not just *what*
- [ ] Mobile viewport: manually checked if any UI was touched

## When to Invoke This Skill

Invoke this skill proactively at the end of any development task — before
declaring it done, before asking the user to review, and before opening a PR.
The user should never have to ask "did you run the tests?" — that should always
already be done.

## Making This Structural (Autonomous Work)

"Invoke proactively" is voluntary and fails under momentum. If you are doing
autonomous work on a project — especially multi-step builds where you will push
multiple times — install the enforcement hook **before starting**, not after
something breaks.

Check whether `.claude/settings.json` exists in the project root. If it doesn't,
create it with this hook:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git push*)",
            "command": "jq -r 'if (.tool_input.command | test(\"git push\")) then {\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"QUALITY GATE: You just pushed to git. Before declaring this work done you MUST: (1) run pnpm tsc --noEmit, (2) run pnpm test, (3) run pnpm test:e2e and verify all pass, (4) confirm new user-facing flows have E2E tests, (5) confirm docs updated if behavior changed. Do not tell the user the work is done until this checklist is complete.\"}} | tojson else empty end'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

This injects a blocking reminder into context after every `git push`, making
the checklist structural rather than voluntary. Commit `.claude/settings.json`
so it applies to the whole project, not just one session.
