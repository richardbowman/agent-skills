import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const checklist = readFileSync("pr-checklist/SKILL.md", "utf8");
const createPr = readFileSync("create-pr/SKILL.md", "utf8");

test("PR workflows publish one verifiable QA report in the GitHub PR body", () => {
  for (const marker of ["<!-- qa-report:start -->", "<!-- qa-report:end -->"]) {
    assert.ok(checklist.includes(marker), `pr-checklist is missing ${marker}`);
    assert.ok(createPr.includes(marker), `create-pr is missing ${marker}`);
  }

  assert.match(checklist, /Preserve every other part of the PR\s+body verbatim/);
  assert.match(checklist, /Read the PR body back afterward/);
  assert.match(createPr, /read the PR body back with\s+`gh pr view`/);
});
