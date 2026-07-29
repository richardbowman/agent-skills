#!/usr/bin/env tsx
/**
 * vercel-wait-deploy — wait for the Vercel deployment for a given commit SHA
 * to reach READY or ERROR state, polling the Vercel REST API directly.
 *
 * Usage:
 *   vercel-wait-deploy --cwd <dir> --target production|preview [options]
 *
 * Options:
 *   --cwd <dir>       Vercel project dir containing .vercel/project.json (default: $PWD)
 *   --git-cwd <dir>   Git repo for SHA/branch resolution (default: --cwd)
 *   --sha <sha>       Commit SHA override (auto-resolved from git when omitted)
 *   --target <env>    "production" or "preview" (required)
 *   --timeout <secs>  Max wait time in seconds (default: 600)
 *
 * SHA resolution:
 *   --target production → origin/main
 *   --target preview    → remote tracking branch of current HEAD in --git-cwd
 *
 * Outputs the stable production alias URL (or hash URL as fallback).
 * Writes the URL to /tmp/vercel_prod_url.txt on success.
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const cwd = getArg("--cwd") ?? process.cwd();
const gitCwd = getArg("--git-cwd") ?? cwd;
const shaOverride = getArg("--sha");
const target = getArg("--target");
const timeoutSecs = parseInt(getArg("--timeout") ?? "600", 10);

if (!target) {
  console.error("Error: --target is required. Use --target production or --target preview.");
  process.exit(1);
}

// ── Read Vercel project config ───────────────────────────────────────────────

interface VercelProjectJson {
  projectId: string;
  orgId: string;
}

function readVercelProject(): VercelProjectJson {
  const path = join(cwd, ".vercel", "project.json");
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as VercelProjectJson;
  } catch {
    console.error(`Error: could not read ${path}. Run 'vercel link' in --cwd first.`);
    process.exit(1);
  }
}

// ── Vercel auth (with automatic refresh) ─────────────────────────────────────
//
// The Vercel CLI (v40+) uses short-lived OAuth access tokens plus a
// refreshToken and expiresAt (unix seconds), stored in auth.json. Any `vercel`
// CLI invocation (e.g. `vercel whoami`, `vercel ls`) transparently refreshes
// an expired/near-expired token and rewrites auth.json. This script used to
// read the token out of auth.json once and hold onto it for the whole poll
// (up to --timeout, default 600s) — bypassing that refresh entirely. That's
// why the CLI itself works fine (`vercel whoami`/`vercel ls`) while this
// script fails with a stale/expired token. Fix: force a refresh through the
// CLI (which owns the refresh-token exchange) whenever the cached token is
// near expiry or gets rejected, then re-read the file.

interface VercelAuth {
  token: string;
  refreshToken?: string;
  expiresAt?: number; // unix seconds
}

const AUTH_PATH = join(
  process.env.HOME ?? "",
  "Library/Application Support/com.vercel.cli/auth.json"
);

function loadVercelAuth(): VercelAuth {
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as VercelAuth;
  } catch {
    console.error("Error: could not read Vercel auth token. Run 'vercel login' first.");
    process.exit(1);
  }
}

function refreshVercelAuth(): VercelAuth {
  const result = spawnSync("vercel", ["whoami"], { encoding: "utf-8" });
  if (result.status !== 0) {
    console.error("Error: Vercel CLI re-authentication failed. Run 'vercel login' first.");
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
    process.exit(1);
  }
  return loadVercelAuth();
}

const TOKEN_REFRESH_BUFFER_SECS = 120;

class VercelTokenManager {
  private auth: VercelAuth;

  constructor() {
    this.auth = loadVercelAuth();
    this.refreshIfNearExpiry();
  }

  private refreshIfNearExpiry() {
    const { expiresAt } = this.auth;
    if (!expiresAt) return;
    const nowSecs = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSecs <= TOKEN_REFRESH_BUFFER_SECS) {
      console.log("Vercel CLI token expiring/expired — refreshing via `vercel whoami`...");
      this.auth = refreshVercelAuth();
    }
  }

  get(): string {
    return this.auth.token;
  }

  /** Force a refresh (e.g. after a 401/403 mid-poll) and return the new token. */
  forceRefresh(): string {
    console.log("Vercel API rejected the current token — refreshing via `vercel whoami`...");
    this.auth = refreshVercelAuth();
    return this.auth.token;
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function git(args: string, cwd: string): string {
  try {
    return execSync(`git -C "${cwd}" ${args}`, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function resolvesha(): string {
  if (shaOverride) {
    const resolved = git(`rev-parse ${shaOverride}`, gitCwd);
    return resolved || shaOverride;
  }

  git("fetch origin --quiet", gitCwd);

  const targetLc = target!.toLowerCase();
  if (targetLc === "production") {
    const sha =
      git("rev-parse origin/main", gitCwd) ||
      git("rev-parse origin/HEAD", gitCwd) ||
      git("rev-parse HEAD", gitCwd);
    if (!sha) {
      console.error("Error: could not resolve production SHA from origin/main.");
      process.exit(1);
    }
    console.log("Resolved production SHA from origin/main");
    return sha;
  }

  // Preview: use remote tracking branch
  const localBranch = git("rev-parse --abbrev-ref HEAD", gitCwd);
  if (localBranch && localBranch !== "HEAD") {
    const sha = git(`rev-parse origin/${localBranch}`, gitCwd);
    if (sha) {
      console.log(`Resolved preview SHA from origin/${localBranch}`);
      return sha;
    }
  }

  const fallback = git("rev-parse HEAD", gitCwd);
  if (!fallback) {
    console.error("Error: could not resolve SHA.");
    process.exit(1);
  }
  console.warn("Warning: no remote tracking branch found, using local HEAD");
  return fallback;
}

// ── Vercel REST API ──────────────────────────────────────────────────────────

interface VercelDeployment {
  uid: string;
  // v6 list uses "state"; v13 single-deployment uses "readyState" (and also "status")
  state?: string;
  readyState?: string;
  status?: string;
  target: string | null;
  url: string;
  aliasAssigned?: boolean;
  alias?: string[];
  meta?: {
    githubCommitSha?: string;
    [key: string]: unknown;
  };
  createdAt: number;
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
}

async function fetchVercel<T>(
  path: string,
  tokenManager: VercelTokenManager,
  teamId: string
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${sep}teamId=${teamId}`;
  const doFetch = (token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  let res = await doFetch(tokenManager.get());
  if (res.status === 401 || res.status === 403) {
    // Cached token was rejected (e.g. expired mid-poll) — refresh through the
    // CLI (which owns the refresh-token exchange) and retry once.
    const freshToken = tokenManager.forceRefresh();
    res = await doFetch(freshToken);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vercel API ${res.status} — ${path}\n${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function findDeployment(
  projectId: string,
  teamId: string,
  tokenManager: VercelTokenManager,
  sha: string,
  targetEnv: string
): Promise<VercelDeployment | null> {
  const data = await fetchVercel<VercelDeploymentsResponse>(
    `/v6/deployments?projectId=${projectId}&limit=20`,
    tokenManager,
    teamId
  );

  const targetLc = targetEnv.toLowerCase();
  for (const dep of data.deployments) {
    const depSha = dep.meta?.githubCommitSha ?? "";
    const depTarget = (dep.target ?? "").toLowerCase();
    const shaMatch = depSha.startsWith(sha) || sha.startsWith(depSha);
    const targetMatch = depTarget.includes(targetLc) || targetLc.includes(depTarget);
    if (shaMatch && targetMatch) return dep;
  }
  return null;
}

async function getDeployment(
  deploymentId: string,
  teamId: string,
  tokenManager: VercelTokenManager
): Promise<VercelDeployment> {
  return fetchVercel<VercelDeployment>(`/v13/deployments/${deploymentId}`, tokenManager, teamId);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { projectId, orgId: teamId } = readVercelProject();
  const tokenManager = new VercelTokenManager();
  const sha = resolvesha();

  console.log(`Waiting for deployment of ${sha.slice(0, 8)} in project ${projectId} (target: ${target}) ...`);

  const deadline = Date.now() + timeoutSecs * 1000;

  // Step 1: wait for the deployment record to appear
  let deployment: VercelDeployment | null = null;
  while (true) {
    deployment = await findDeployment(projectId, teamId, tokenManager, sha, target!);
    if (deployment) {
      console.log(`Found deployment: ${deployment.uid} (${deployment.state})`);
      break;
    }

    if (Date.now() >= deadline) {
      console.error(`Timeout: no deployment found for SHA ${sha.slice(0, 8)} after ${timeoutSecs}s.`);
      process.exit(1);
    }
    console.log("  deployment not yet registered, retrying in 10s...");
    await new Promise((r) => setTimeout(r, 10_000));
  }

  // Step 2: poll until READY or ERROR
  while (true) {
    const dep = await getDeployment(deployment.uid, teamId, tokenManager);
    // v13 single-deployment endpoint uses readyState (state is absent)
    const depState = dep.readyState ?? dep.state ?? dep.status ?? "unknown";
    console.log(`  status: ${depState}`);

    if (depState === "READY") {
      // Prefer the stable production alias; fall back to hash URL
      let outputUrl = `https://${dep.url}`;

      if (dep.alias && dep.alias.length > 0) {
        // Pick shortest alias (most stable, usually the project-name.vercel.app one)
        const sorted = [...dep.alias].sort((a, b) => a.length - b.length);
        outputUrl = `https://${sorted[0]}`;
      }

      console.log(`Deployment ready: ${outputUrl}`);
      writeFileSync("/tmp/vercel_prod_url.txt", outputUrl);
      process.exit(0);
    }

    if (depState === "ERROR" || depState === "CANCELED") {
      console.error(`Deployment failed with state: ${depState}`);
      process.exit(1);
    }

    if (Date.now() >= deadline) {
      console.error(`Timeout waiting for deployment (last state: ${dep.state}).`);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 10_000));
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
