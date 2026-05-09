#!/usr/bin/env node
// bootstrap.js — symlink all skills from this repo into ~/.claude/skills/
// Run from the repo root: node bootstrap.js

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const REPO       = path.dirname(fs.realpathSync(__filename));
const CLAUDE     = path.join(os.homedir(), '.claude');
const SKILLS_DST = path.join(CLAUDE, 'skills');

fs.mkdirSync(SKILLS_DST, { recursive: true });

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

console.log('==> claude-skills bootstrap');
console.log(`    repo:   ${REPO}`);
console.log(`    target: ${SKILLS_DST}`);
console.log('');

// Link every directory (skill) and .md flat files in the repo root
let count = 0;
for (const name of fs.readdirSync(REPO).sort()) {
  if (name.startsWith('.') || name === 'bootstrap.js' || name === 'README.md') continue;
  const src = path.join(REPO, name);
  const st  = fs.statSync(src);
  if (!st.isDirectory() && !name.endsWith('.md')) continue;
  link(src, path.join(SKILLS_DST, name));
  count++;
}

// Prune stale symlinks that pointed into this repo but were renamed/deleted
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
  }
}

console.log('');
console.log(`==> Done — ${count} skills linked into ${SKILLS_DST}`);
