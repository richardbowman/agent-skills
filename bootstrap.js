#!/usr/bin/env node
// bootstrap.js — symlink all skills, hooks, and CLI tools from this repo
// into ~/.claude/ and ~/.local/bin/. Run from the repo root: node bootstrap.js
//
// Idempotent. Also registers .githooks/ as this repo's git hooksPath so a
// post-merge hook re-runs bootstrap after every pull — new or renamed skills
// and tools are linked without anyone having to remember this script exists.

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const { execSync } = require('node:child_process');

const REPO       = path.dirname(fs.realpathSync(__filename));
const CLAUDE     = path.join(os.homedir(), '.claude');
const SKILLS_DST = path.join(CLAUDE, 'skills');
const HOOKS_DST  = path.join(CLAUDE, 'hooks');
const BIN_DST    = path.join(os.homedir(), '.local', 'bin');

// CLI tools to expose on PATH, repo-relative. Entry-point wrappers only —
// implementation files they resolve themselves (e.g. *.ts) don't belong here.
const BIN_TOOLS = [
  'nextjs-local-dev/nextdev',
  'vercel-tools/vercel-wait-deploy',
  'worktree-bootstrap/worktree-bootstrap',
  'worktree-bootstrap/wtadd',
  'worktree-bootstrap/wtcc',
  'worktree-bootstrap/wtcc-recover',
  'worktree-bootstrap/wtcc-status',
  'worktree-bootstrap/wtpr',
];

fs.mkdirSync(SKILLS_DST, { recursive: true });
fs.mkdirSync(HOOKS_DST,  { recursive: true });
fs.mkdirSync(BIN_DST,    { recursive: true });

function link(src, dst) {
  let existing = null;
  try { existing = fs.lstatSync(dst); } catch { /* ENOENT */ }

  if (existing) {
    if (existing.isSymbolicLink()) {
      const cur = fs.readlinkSync(dst);
      if (cur === src) { console.log(`  ok     ${path.basename(dst)}`); return; }
      console.log(`  relink ${path.basename(dst)}  (was -> ${cur})`);
      fs.unlinkSync(dst);
    } else {
      const backup = `${dst}.backup.${Date.now()}`;
      console.log(`  backup ${dst} -> ${backup}`);
      fs.renameSync(dst, backup);
    }
  }

  const type = fs.statSync(src).isDirectory() ? 'dir' : 'file';
  fs.symlinkSync(src, dst, type);
  console.log(`  link   ${path.basename(dst)}`);
}

// Load excluded skills from optional .exclude file (machine-local, gitignored)
const EXCLUDE_FILE = path.join(REPO, '.exclude');
const excluded = new Set();
if (fs.existsSync(EXCLUDE_FILE)) {
  for (const line of fs.readFileSync(EXCLUDE_FILE, 'utf8').split('\n')) {
    const name = line.trim();
    if (name && !name.startsWith('#')) excluded.add(name);
  }
}

console.log('==> claude-skills bootstrap');
console.log(`    repo:   ${REPO}`);
console.log(`    target: ${SKILLS_DST}`);
if (excluded.size) console.log(`    excluded (${excluded.size}): ${[...excluded].join(', ')}`);
console.log('');

// Link every directory (skill) and .md flat files in the repo root
let count = 0;
for (const name of fs.readdirSync(REPO).sort()) {
  if (name.startsWith('.') || name === 'bootstrap.js' || name === 'README.md' || name === 'hooks') continue;
  if (excluded.has(name)) { console.log(`  skip   ${name}  (excluded)`); continue; }
  const src = path.join(REPO, name);
  const st  = fs.statSync(src);
  if (!st.isDirectory() && !name.endsWith('.md')) continue;
  link(src, path.join(SKILLS_DST, name));
  count++;
}

// Link every script in hooks/ into ~/.claude/hooks/
console.log('');
console.log(`==> hooks → ${HOOKS_DST}`);
const HOOKS_SRC = path.join(REPO, 'hooks');
let hookCount = 0;
if (fs.existsSync(HOOKS_SRC)) {
  for (const name of fs.readdirSync(HOOKS_SRC).sort()) {
    const src = path.join(HOOKS_SRC, name);
    if (!fs.statSync(src).isFile()) continue;
    // Ensure the hook is executable
    fs.chmodSync(src, 0o755);
    link(src, path.join(HOOKS_DST, name));
    hookCount++;
  }
}
if (hookCount === 0) console.log('  (none)');

// Link CLI tools into ~/.local/bin
console.log('');
console.log(`==> bin tools → ${BIN_DST}`);
let binCount = 0;
for (const rel of BIN_TOOLS) {
  const src = path.join(REPO, rel);
  if (!fs.existsSync(src)) { console.log(`  miss   ${rel}  (not in repo — update BIN_TOOLS?)`); continue; }
  fs.chmodSync(src, 0o755);
  link(src, path.join(BIN_DST, path.basename(rel)));
  binCount++;
}

// Prune stale bin symlinks pointing into this repo (renamed/deleted tools)
const binNames = new Set(BIN_TOOLS.map(rel => path.basename(rel)));
for (const name of fs.readdirSync(BIN_DST)) {
  const dst = path.join(BIN_DST, name);
  let st;
  try { st = fs.lstatSync(dst); } catch { continue; }
  if (!st.isSymbolicLink()) continue;
  const target = fs.readlinkSync(dst);
  if (!target.startsWith(REPO + path.sep)) continue;
  if (!fs.existsSync(target) || !binNames.has(name)) {
    console.log(`  prune  ${name}  (-> ${target})`);
    fs.unlinkSync(dst);
  }
}

// Register .githooks/ so post-merge re-runs bootstrap after every pull
try {
  execSync('git config core.hooksPath .githooks', { cwd: REPO, stdio: 'pipe' });
  console.log('');
  console.log('==> git core.hooksPath = .githooks (bootstrap re-runs on every pull)');
} catch {
  console.log('');
  console.log('==> skipped git hooksPath setup (not a git checkout?)');
}

// Prune stale symlinks that pointed into this repo but were renamed/deleted or excluded
console.log('');
for (const name of fs.readdirSync(SKILLS_DST)) {
  const dst = path.join(SKILLS_DST, name);
  let st;
  try { st = fs.lstatSync(dst); } catch { continue; }
  if (!st.isSymbolicLink()) continue;
  const target = fs.readlinkSync(dst);
  if (!target.startsWith(REPO + path.sep)) continue;
  if (!fs.existsSync(target)) {
    console.log(`  prune  ${name}  (dangling -> ${target})`);
    fs.unlinkSync(dst);
  } else if (excluded.has(name)) {
    console.log(`  prune  ${name}  (excluded)`);
    fs.unlinkSync(dst);
  }
}

console.log('');
console.log(`==> Done — ${count} skills, ${hookCount} hooks, ${binCount} bin tools linked`);
