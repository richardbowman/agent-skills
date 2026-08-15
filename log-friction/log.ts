#!/usr/bin/env node
// Agent friction logger — appends a structured JSON line to
// ~/.claude/friction-log.jsonl so the `dream` skill (Phase 2a) can read
// agent-self-reported operational friction directly, instead of relying
// solely on mining transcripts for signals Rick happened to comment on.
//
// Usage:
//   node ~/.claude/skills/log-friction/log.ts \
//     --agent engineer \
//     --project golden-wealth-app \
//     --summary "Retried DSQL migration twice before finding root cause" \
//     --detail "Assumed a FK constraint was the issue; actual cause was a synchronous index. The dsql-migrate docs don't call this failure mode out." \
//     [--severity low|med|high]
//
// Fields written per entry: ts, agent, project, summary, detail, severity, cwd.
// This is a plain append-only log — no dedup, no rotation. dream filters by
// ts against its own last-run cursor, same pattern scan.ts uses for
// conversation transcripts.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOG_FILE = path.join(os.homedir(), ".claude", "friction-log.jsonl");

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!args.summary) {
  console.error("Error: --summary is required (one-line description of the friction).");
  console.error(
    'Usage: node log.ts --agent <role> --project <slug> --summary "..." [--detail "..."] [--severity low|med|high]'
  );
  process.exit(1);
}

const entry = {
  ts: new Date().toISOString(),
  agent: args.agent || "unknown",
  project: args.project || path.basename(process.cwd()),
  summary: args.summary,
  detail: args.detail || "",
  severity: args.severity || "med",
  cwd: process.cwd(),
};

fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");

console.log(`Logged friction entry to ${LOG_FILE}`);
console.log(JSON.stringify(entry, null, 2));
