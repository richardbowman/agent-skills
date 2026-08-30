import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import test from "node:test";

const skills = [
  "brain-dump", "brainstorm", "chief-of-staff", "dream", "hiptrip-editor",
  "log-friction", "nextjs-local-dev", "pr-checklist",
  "production-readiness", "rb-personal-assistant", "remotion-video-ads", "stash",
  "verify-before-coding", "video-storyboard", "web-search", "worktree-bootstrap",
];

const docs = new Map(skills.map((name) => [name, readFileSync(`${name}/SKILL.md`, "utf8")]));

test("all portability-target skills have valid identity metadata", () => {
  for (const [name, text] of docs) {
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, `${name}: missing YAML frontmatter`);
    assert.match(frontmatter[1], new RegExp(`^name:\\s*${name}$`, "m"), `${name}: name must match directory`);
    assert.match(frontmatter[1], /^description:\s*\S.+$/m, `${name}: non-empty description required`);
  }
});

test("local Markdown references resolve", () => {
  for (const [name, text] of docs) {
    for (const match of text.matchAll(/\[[^\]]*\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
      const target = match[1].split("#", 1)[0];
      if (target.includes("<") || target.includes(">")) continue;
      if (target.startsWith("/")) continue;
      assert.ok(existsSync(resolve(dirname(`${name}/SKILL.md`), target)), `${name}: missing local reference ${target}`);
    }
  }
});

test("each target documents its harness-neutral execution contract", () => {
  for (const [name, text] of docs) {
    assert.match(text, /^## Harness portability$/m, `${name}: missing harness portability section`);
  }
});

test("portable skills do not prescribe unqualified harness-only tools or homes", () => {
  const combined = [...docs].map(([name, text]) => `\n### ${name}\n${text}`).join("\n");
  for (const [label, pattern] of [
    ["Claude-only skill home", /~\/\.claude\/skills/],
    ["Claude-only project memory", /~\/\.claude\/projects/],
    ["Claude-only Agent subtype", /Agent`? tool[^\n]*subagent_type/],
    ["Claude-only Obsidian MCP identifier", /mcp__obsidian__/],
    ["unqualified Bash tool", /Use `Bash`/],
    ["unqualified WebFetch tool", /`WebFetch`/],
  ]) assert.doesNotMatch(combined, pattern, label);
});

test("representative workflows state native alternatives without weakening behavior", () => {
  const required = {
    "brain-dump": [/transcript export/i, /memory is optional/i],
    brainstorm: [/transcript export/i, /memory is optional/i],
    "chief-of-staff": [/available delegation mechanism/i, /skills and configuration files/i],
    dream: [/CLAUDE\.md.*AGENTS\.md|AGENTS\.md.*CLAUDE\.md/s, /unsupported.*conversation-log/i],
    "log-friction": [/AGENT_STATE_HOME/, /skill directory/i],
    "nextjs-local-dev": [/background execution capability/i],
    "pr-checklist": [/\.claude\/pr-guidelines\.md/, /\.agents\/pr-guidelines\.md/],
    "production-readiness": [/CLAUDE\.md/, /AGENTS\.md/],
    "remotion-video-ads": [/CLAUDE\.md/, /AGENTS\.md/],
    "verify-before-coding": [/web retrieval capability/i],
    "video-storyboard": [/workspace navigation tool/i, /URL scheme/i],
    "web-search": [/shell execution tool/i, /web retrieval tool/i],
    "worktree-bootstrap": [/Claude-specific helper/i, /Codex/i],
  };
  for (const [name, patterns] of Object.entries(required)) {
    for (const pattern of patterns) assert.match(docs.get(name), pattern, `${name}: missing ${pattern}`);
  }
});

test("bundled stateful scripts honor AGENT_STATE_HOME", () => {
  for (const file of ["dream/scan.ts", "log-friction/log.ts"]) {
    const text = readFileSync(file, "utf8");
    assert.match(text, /process\.env\.AGENT_STATE_HOME/, `${file}: state home is hard-coded`);
  }
});
