#!/usr/bin/env node
/**
 * vercel-env-pull — drop-in replacement for `vercel env pull`, using the REST API.
 * Secrets go straight to disk (mode 600) and are never printed.
 *
 * Usage: vercel-env-pull [--cwd <dir>] [--environment development|preview|production]
 *                        [--git-branch <branch>] [--out <file>] [--yes]
 *
 * Auth: $VERCEL_TOKEN, else the token in the Vercel CLI's auth.json.
 * Project: <cwd>/.vercel/project.json (projectId, orgId).
 * Note: variables flagged "Sensitive" are write-only and come back empty; they are
 * skipped and listed by name so you know what to fill in by hand.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (f: string) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : undefined; };
const cwd = resolve(arg("--cwd") ?? process.cwd());
const env = arg("--environment") ?? "development";
const branch = arg("--git-branch");
const out = resolve(cwd, arg("--out") ?? ".env.local");
const yes = args.includes("--yes");
if (!["development", "preview", "production"].includes(env)) {
  console.error("Error: --environment must be development, preview or production."); process.exit(1);
}

let proj: { projectId: string; orgId: string };
try { proj = JSON.parse(readFileSync(join(cwd, ".vercel", "project.json"), "utf-8")); }
catch { console.error(`Error: no ${join(cwd, ".vercel/project.json")} (project not linked).`); process.exit(1); }

function token(): string {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const p = join(process.env.HOME ?? "", "Library/Application Support/com.vercel.cli/auth.json");
  try { return JSON.parse(readFileSync(p, "utf-8")).token; }
  catch { console.error("Error: set VERCEL_TOKEN or sign in once via the Vercel CLI."); process.exit(1); }
}

const isTeam = proj.orgId.startsWith("team_");
const q = new URLSearchParams({ decrypt: "true", ...(isTeam ? { teamId: proj.orgId } : {}) });
const res = await fetch(`https://api.vercel.com/v10/projects/${proj.projectId}/env?${q}`, {
  headers: { Authorization: `Bearer ${token()}` },
});
if (!res.ok) { console.error(`Error: Vercel API ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
const { envs } = (await res.json()) as { envs: Array<{ key: string; value?: string; type: string; target?: string[] | string; gitBranch?: string }> };

const vars = new Map<string, string>();
const empty: string[] = [];
for (const e of envs) {
  const targets = Array.isArray(e.target) ? e.target : e.target ? [e.target] : [];
  if (!targets.includes(env)) continue;
  if (env === "preview" && e.gitBranch && e.gitBranch !== branch) continue;
  // branch-specific preview values override generic ones
  if (e.type === "sensitive" || e.value === undefined || e.value === "") { empty.push(e.key); continue; }
  if (e.gitBranch || !vars.has(e.key)) vars.set(e.key, e.value);
}

if (existsSync(out) && !yes) {
  console.error(`Refusing to overwrite ${out} — pass --yes.`); process.exit(1);
}
const body = [`# Created by vercel-env-pull (${env}) at ${new Date().toISOString()}`,
  ...[...vars].map(([k, v]) => `${k}=${JSON.stringify(v)}`)].join("\n") + "\n";
writeFileSync(out, body, { mode: 0o600 });
chmodSync(out, 0o600);
console.log(`Wrote ${vars.size} ${env} variables to ${out}`);
if (empty.length) console.log(`Sensitive/empty (not written, fill manually): ${[...new Set(empty)].join(", ")}`);
