#!/usr/bin/env node
// bootstrap.js — symlink all skills and hooks from this repo into ~/.claude/
// Run from the repo root: node bootstrap.js

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const REPO       = path.dirname(fs.realpathSync(__filename));
const CLAUDE     = path.join(os.homedir(), '.claude');
const SKILLS_DST = path.join(CLAUDE, 'skills');
const HOOKS_DST  = path.join(CLAUDE, 'hooks');

fs.mkdirSync(SKILLS_DST, { recursive: true });
fs.mkdirSync(HOOKS_DST,  { recursive: true });

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
console.log(`==> Done — ${count} skills, ${hookCount} hooks linked into ${CLAUDE}`);
