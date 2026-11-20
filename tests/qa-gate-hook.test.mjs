import assert from "node:assert/strict";
import {spawnSync, execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, utimesSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";

const HOOK = resolve("hooks/require-qa-before-pr.sh");
const BRANCH = "feat/demo";

function setup({compass}) {
  const root = mkdtempSync(join(tmpdir(), "qagate-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q", "-b", BRANCH, repo]);
  if (compass) writeFileSync(join(repo, "pm-config.md"), "Provider: Compass workspace demo\n");
  const vault = join(root, "vault");
  mkdirSync(join(vault, "Products/Demo/Runs"), {recursive: true});
  const gates = join(root, "gates");
  mkdirSync(gates);
  return {repo, vault, gates};
}

function run(env, repo) {
  const input = JSON.stringify({tool_input: {command: "gh pr create --title x"}, cwd: repo});
  return spawnSync("bash", [HOOK], {input, env: {...process.env, VAULT_ROOT: env.vault, QA_GATE_DIR: env.gates}, encoding: "utf8"});
}

const receipt = (e, line) => writeFileSync(join(e.gates, "feat__demo.gate"), line + "\n");
const note = (e, text) => writeFileSync(join(e.vault, "Products/Demo/Runs/n.md"), text);

test("Compass repo: blocked with no receipt, message points at Compass", () => {
  const e = setup({compass: true});
  const r = run(e, e.repo);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Compass project/);
});

test("Compass repo: receipt with task and report passes", () => {
  const e = setup({compass: true});
  receipt(e, `QA-GATE: PASS branch=${BRANCH} task=TASK-85 report=https://compass.example/doc/1`);
  assert.equal(run(e, e.repo).status, 0);
});

test("Compass repo: receipt missing task or report is rejected", () => {
  const e = setup({compass: true});
  receipt(e, `QA-GATE: PASS branch=${BRANCH} report=https://compass.example/doc/1`);
  assert.equal(run(e, e.repo).status, 2);
  receipt(e, `QA-GATE: PASS branch=${BRANCH} task=TASK-85`);
  assert.equal(run(e, e.repo).status, 2);
});

test("Compass repo: receipt for a different branch or older than 24h is rejected", () => {
  const e = setup({compass: true});
  receipt(e, `QA-GATE: PASS branch=feat/demo-2 task=TASK-1 report=https://x/y`);
  assert.equal(run(e, e.repo).status, 2);
  receipt(e, `QA-GATE: PASS branch=${BRANCH} task=TASK-1 report=https://x/y`);
  const old = new Date(Date.now() - 3 * 86400e3);
  utimesSync(join(e.gates, "feat__demo.gate"), old, old);
  assert.equal(run(e, e.repo).status, 2);
});

test("Compass repo: vault note alone is rejected, with COMPASS-UNAVAILABLE it passes", () => {
  const e = setup({compass: true});
  note(e, `QA-GATE: PASS branch=${BRANCH}\n`);
  assert.equal(run(e, e.repo).status, 2);
  note(e, `QA-GATE: PASS branch=${BRANCH}\nCOMPASS-UNAVAILABLE: ECONNREFUSED\n`);
  assert.equal(run(e, e.repo).status, 0);
});

test("non-Compass repo: vault note with PASS line is enough (original behaviour)", () => {
  const e = setup({compass: false});
  assert.equal(run(e, e.repo).status, 2);
  note(e, `QA-GATE: PASS branch=${BRANCH}\n`);
  assert.equal(run(e, e.repo).status, 0);
});

test("prototype repos and non-PR commands are exempt", () => {
  const e = setup({compass: true});
  writeFileSync(join(e.repo, "CLAUDE.md"), "Repo mode: prototype\n");
  assert.equal(run(e, e.repo).status, 0);
  const input = JSON.stringify({tool_input: {command: "git status"}, cwd: e.repo});
  assert.equal(spawnSync("bash", [HOOK], {input, encoding: "utf8"}).status, 0);
});

test("pr-checklist documents the Compass receipt and the vault fallback in the hook's exact format", async () => {
  const {readFileSync} = await import("node:fs");
  const skill = readFileSync("pr-checklist/SKILL.md", "utf8");
  assert.match(skill, /QA-GATE: PASS branch=<branch> task=TASK-<n> report=<Compass doc URL>/);
  assert.match(skill, /COMPASS-UNAVAILABLE: <the actual error text>/);
  assert.match(skill, /kind: "QA_REPORT"/);
});
