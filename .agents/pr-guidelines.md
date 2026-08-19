# PR Guidelines — Agent Skills

These guidelines define the merge gate for this repository in Claude Code and
Codex. Update them when the repository gains a package-level build or test
runner.

## Commands

| Task | Command |
|---|---|
| Portability and metadata tests | `node --test tests/*.test.mjs` |
| TypeScript syntax | `node --check dream/scan.ts && node --check log-friction/log.ts` |
| Node helper syntax | `node --check worktree-bootstrap/worktree-bootstrap && node --check nextjs-local-dev/nextdev` |
| Shell helper syntax | `for f in worktree-bootstrap/wtcc worktree-bootstrap/wtcc-status worktree-bootstrap/wtpr worktree-bootstrap/wtadd worktree-bootstrap/wtcc-recover rb-personal-assistant/scripts/jarvis-daily-triage-openclaw.sh rb-personal-assistant/scripts/jarvis-daily-triage.sh; do bash -n "$f" || exit 1; done` |
| Diff hygiene | `git diff --check` |

## Coverage Requirements

- Every changed skill must retain valid frontmatter and a non-empty description.
- Local Markdown references must resolve.
- Harness-portability changes must test both the neutral contract and any
  intentionally harness-specific boundary.
- Stateful helper scripts must test configurable state paths without writing to
  live Claude or Codex configuration.

## Visual Verification

Not applicable. This repository contains skill documentation and command-line
helpers, not a browser UI.

## Documentation

User-facing documentation lives in the root `README.md` and each skill's
`SKILL.md`. Review both when changing installation, invocation, or discovery
behavior.

## Project-Specific Gates

- Run commands with the interpreter declared by each helper's shebang.
- Preserve behavioral and safety requirements when neutralizing harness names;
  lexical portability alone is insufficient.
- Document unsupported harness behavior explicitly instead of claiming parity.
- Run a manual state-root smoke test for changes to stateful helpers.
- Confirm `git diff --check` is clean.
- Confirm no live configuration, generated installation, or user state changed.

## Pull Request

- No issue-tracker transition is required unless the work is linked to an issue.
- Use a concise title and explain the motivation, behavioral guarantees, tested
  boundaries, and remaining harness-specific limitations in the description.
