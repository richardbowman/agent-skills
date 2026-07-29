#!/usr/bin/env node
// Dream skill — Phase 2 friction/praise scanner.
// Canonical implementation (Node/TypeScript per Rick's "never use Python for
// scripts" rule — run natively with `node ~/.claude/skills/dream/scan.ts`,
// no build step needed on Node 22.6+).
//
// Scans conversation JSONL logs under ~/.claude/projects for user-authored
// messages (since the last dream run) that match friction or praise regex
// patterns, after filtering out Claude-authored dispatch/relay/cron text
// that gets logged with role:"user" but was never typed by Rick.
//
// Keep this file and SKILL.md's "Known scanner pitfalls" section in sync —
// whenever a new noise source floods a run, fix the fingerprint lists here.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LAST_RUN_FILE = path.join(os.homedir(), ".claude", "dream-last-run");
const LOGS_DIR = path.join(os.homedir(), ".claude", "projects");

function globJsonl(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

let lastRun: Date;
try {
  const raw = fs.readFileSync(LAST_RUN_FILE, "utf8").trim();
  lastRun = new Date(raw);
  if (isNaN(lastRun.getTime())) throw new Error("bad date");
} catch {
  lastRun = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

console.log(`Scanning logs since: ${lastRun.toISOString()}\n`);

// --- Friction signal patterns ---
const FRICTION_PATTERNS: string[] = [
  // Direct corrections
  "\\bno[,\\.!]\\s", "\\bnope\\b", "\\bwrong\\b", "\\bincorrect\\b",
  "\\bactually[,\\.]", "\\bwait[,\\.]", "\\bhold on\\b",
  "that'?s not", "not what i", "didn'?t want", "don'?t want",
  "why did you", "why are you",
  "doesn'?t (seem|look|feel) right", "this (is|isn'?t) (weird|off|odd|broken)",
  "not quite", "close,? but", "still (not|doesn'?t|isn'?t|wrong)",
  "that'?s backwards", "undo (that|this)", "put (it|that) back",
  // Frustration
  "\\bugh\\b", "\\bargh\\b", "\\bffs\\b", "[\\u{1F604}-\\u{1FAFF}]",
  "you keep", "again you", "i (told|said|asked) you( already)?",
  "for the (second|third|\\d+)(nd|rd|th)? time",
  // Redirects
  "\\bstop (doing|that|this)\\b", "never mind", "nevermind",
  "forget (it|that|this)", "revert (that|this|it)",
  "please don'?t", "don'?t do that", "try again",
  // Explicit rule declarations (high-value signals)
  "from now on", "always\\b.{0,30}(do|use|run|check|make)",
  "\\bnever\\b.{0,30}(do|use|run|add|create)",
  "remember (to|that)\\b", "don'?t forget",
  "i (prefer|want|need|like) you to",
  "going forward", "in the future",
];

// --- Praise patterns (to capture what's working) ---
// NOTE: bare words like "exactly" or "perfect" are too common in ordinary
// technical writing ("not exactly", "exactly the same bug") to use alone —
// anchor them to an affirmation construction instead.
const PRAISE_PATTERNS: string[] = [
  "that'?s (exactly|perfect|it|right)\\b", "exactly (right|what i (wanted|needed|meant))",
  "^exactly[.!]?$", "\\bperfect[.!]", "love (it|this|that)",
  "(nice|great|good|awesome|fantastic) (job|work|call|catch|one)",
  "that (works|worked|did it)", "nailed it",
  "\\byes!?\\b.{0,20}(that|this|perfect|exactly)",
];

// --- Fingerprints of Claude-authored dispatch text (NOT the user's own words) ---
// These show up as role:"user" in logs — Agent-tool task briefs, Workflow/skill
// dispatch messages, subagent voter prompts, recurring cron job prompts,
// inter-thread relay messages — but Rick never typed them.
const ORCHESTRATION_MARKERS: string[] = [
  "## task procedure", "you are implementing", "you're implementing",
  "you are executing", "you're executing", "you are working in the git worktree",
  "the worktree is already set up at", "git worktree at `",
  "working directory (the git worktree)", "use todowrite to create a task list",
  "use taskcreate to create a task list", "end-to-end verification of every requirement",
  "<agent-message from=",  // inter-thread relay, sent between Claude threads not by Rick
  "automated run",  // recurring cron dispatch header, e.g. "## Monthly X — Automated Run"
  "deal monitor for rick",  // recurring cron dispatch persona prompt (e-tron GT monitor)
];

const SYNTHETIC_PREFIXES: string[] = [
  "Summarize this conversation",
  "This session is being continued",
  "Summary:\n",
  "The conversation above",
  "<task-notification>",
  "## Adversarial Claim Verifier",
  "## Synthesis:",
  "## Judge",
  'Run the "',  // Workflow/skill dispatch, e.g. Run the "deep-research" workflow.
  "You are updating an existing conversation summary with new messages.",
  "Below is a conversation transcript",  // tab-title / metadata generation prompts
  "You are helping fork a conversation into a new, self-contained thread",
  "## Monthly Amazon Data Export",  // recurring cron dispatch, e.g. "— Automated Run"
  "You are the e-tron GT deal monitor",  // recurring cron dispatch persona prompt
  "Another Claude session sent a message:",  // inter-thread relay via obsidian_send_message_to_thread
];

function extractText(content: any): string {
  // User message content can be a plain string OR a list of content blocks
  // (the normal chat-UI format is a list). Pull text out of either shape —
  // missing the list case silently drops the vast majority of real messages.
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object" && block.type === "text") {
        parts.push(block.text || "");
      }
    }
    return parts.join("\n");
  }
  return "";
}

const frictionCompiled = FRICTION_PATTERNS.map((p) => ({ re: new RegExp(p, "iu"), pattern: p }));
const praiseCompiled = PRAISE_PATTERNS.map((p) => ({ re: new RegExp(p, "iu"), pattern: p }));

interface Hit {
  ts: string;
  session: string;
  project: string;
  text: string;
  prior_assistant: string;
  matched_pattern?: string;
}

const frictionHits: Hit[] = [];
const praiseHits: Hit[] = [];
let filesScanned = 0;

// Nested subagent transcripts live under <session>/subagents/*.jsonl — the
// recursive walk picks these up too. They're Claude-to-Claude, exclude the
// whole path.
const allFiles = globJsonl(LOGS_DIR).sort();

for (const filePath of allFiles) {
  if (filePath.includes(`${path.sep}subagents${path.sep}`)) continue;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    continue;
  }
  if (stat.mtimeMs < lastRun.getTime()) continue;
  filesScanned++;

  const rel = filePath.replace(LOGS_DIR + path.sep, "");
  const project = rel.split(path.sep)[0];

  let lines: string[];
  try {
    lines = fs.readFileSync(filePath, "utf8").split("\n");
  } catch {
    continue;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type !== "user") continue;
    const content = extractText(obj.message?.content);
    if (content.trim().length < 8) continue;
    // Skip pure tool result / JSON payload messages
    if (content.startsWith("{") || content.startsWith("[")) continue;
    // Skip system-injected and workflow/agent-dispatch messages — these are
    // Claude's own words routed through a user-role turn.
    if (SYNTHETIC_PREFIXES.some((prefix) => content.startsWith(prefix))) continue;
    const contentLower = content.toLowerCase();
    if (ORCHESTRATION_MARKERS.some((marker) => contentLower.includes(marker))) continue;
    // Catch-all: long, multi-section text reads as a written brief, not
    // something Rick typed in chat.
    const headingCount = (content.match(/\n## /g) || []).length;
    if (content.length > 600 && headingCount >= 2) continue;

    const ts = (obj.timestamp || "").slice(0, 10);
    const sessionId = (obj.sessionId || "").slice(0, 8);

    // Look back for assistant context (what did Claude do just before?)
    let priorAssistant = "";
    for (let j = Math.max(0, i - 8); j < i; j++) {
      try {
        const prev = JSON.parse(lines[j]);
        const role = prev.message?.role || "";
        if (role !== "assistant") continue;
        const c = prev.message?.content;
        if (Array.isArray(c)) {
          for (const block of c) {
            if (block && typeof block === "object" && block.type === "text") {
              priorAssistant = (block.text || "").slice(0, 200);
              break;
            }
          }
        } else if (typeof c === "string") {
          priorAssistant = c.slice(0, 200);
        }
        if (priorAssistant) break;
      } catch {
        // ignore
      }
    }

    const entry: Hit = {
      ts,
      session: sessionId,
      project,
      text: content.slice(0, 400),
      prior_assistant: priorAssistant,
    };

    for (const { re, pattern } of frictionCompiled) {
      if (re.test(content)) {
        frictionHits.push({ ...entry, matched_pattern: pattern });
        break;
      }
    }

    for (const { re, pattern } of praiseCompiled) {
      if (re.test(content)) {
        praiseHits.push({ ...entry, matched_pattern: pattern });
        break;
      }
    }
  }
}

console.log(`Files scanned: ${filesScanned}`);
console.log(`Friction signals: ${frictionHits.length}`);
console.log(`Praise signals:   ${praiseHits.length}`);
console.log();

console.log("=".repeat(60));
console.log("FRICTION SIGNALS");
console.log("=".repeat(60));
for (const h of frictionHits) {
  console.log(`\n[${h.ts}] project=${h.project.slice(0, 40)} session=${h.session}`);
  if (h.prior_assistant) {
    console.log(`  Claude said: ${h.prior_assistant.slice(0, 120)}...`);
  }
  console.log(`  User said:   ${h.text.slice(0, 300)}`);
  console.log(`  Pattern:     ${h.matched_pattern}`);
}

console.log();
console.log("=".repeat(60));
console.log("PRAISE SIGNALS");
console.log("=".repeat(60));
for (const h of praiseHits.slice(0, 15)) {
  console.log(`\n[${h.ts}] project=${h.project.slice(0, 40)}`);
  console.log(`  User said:   ${h.text.slice(0, 200)}`);
}
