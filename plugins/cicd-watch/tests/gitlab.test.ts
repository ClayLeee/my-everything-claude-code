import { expect, test } from "claude-code/testing";

import type { Snapshot } from "../types";

import {
  clip,
  countJobs,
  displayWidth,
  formatRef,
  groupStages,
  jobColor,
  notifyFor,
  packLines,
  parseTarget,
  progressBar,
  pulseColor,
  statusLetter,
  storeKeyFor,
  wrapText,
} from "../hooks/gitlab";

test("keys the watch list by workspace, however its path is written", async () => {
  expect(storeKeyFor("C:/Users/me/repo")).toBe("projects:C:/Users/me/repo");
  expect(storeKeyFor("c:\\Users\\me\\repo\\")).toBe("projects:C:/Users/me/repo");
  expect(storeKeyFor("/home/me/repo/\n")).toBe("projects:/home/me/repo");
  expect(storeKeyFor("/")).toBe("projects:/");
  expect(storeKeyFor("/home/me/a")).not.toBe(storeKeyFor("/home/me/b"));
});

test("parses a full URL with a subgroup", async () => {
  expect(parseTarget("https://git.acme.io/grp/sub/app/")).toEqual({
    id: "git.acme.io/grp/sub/app",
    host: "git.acme.io",
    path: "grp/sub/app",
    ref: undefined,
  });
});

test("parses a full URL with .git and a branch", async () => {
  const p = parseTarget("https://git.acme.io/team/app.git@develop");
  expect(p?.host).toBe("git.acme.io");
  expect(p?.path).toBe("team/app");
  expect(p?.ref).toBe("develop");
  expect(p?.id).toBe("git.acme.io/team/app@develop");
});

test("takes the branch from a /-/tree/ URL", async () => {
  const p = parseTarget("https://git.acme.io/team/app/-/tree/feature/x");
  expect(p?.path).toBe("team/app");
  expect(p?.ref).toBe("feature/x");
});

test("refuses anything that is not a full URL", async () => {
  expect(parseTarget("grp/app")).toBeUndefined();
  expect(parseTarget("git.acme.io/team/app@develop")).toBeUndefined();
  expect(parseTarget("   ")).toBeUndefined();
});

test("refuses a URL without a group", async () => {
  expect(parseTarget("https://git.acme.io/app")).toBeUndefined();
  expect(parseTarget("https://git.acme.io")).toBeUndefined();
});

test("counts finished and running jobs", async () => {
  const jobs = [
    { name: "lint", status: "success" },
    { name: "test", status: "running" },
    { name: "build", status: "created" },
    { name: "deploy", status: "manual" },
  ];
  expect(countJobs(jobs)).toEqual({
    done: 2,
    total: 4,
    running: ["test"],
    jobs: jobs.map((j) => ({ name: j.name, status: j.status })),
  });
});

test("orders jobs by id so each cell matches one pipeline step", async () => {
  const out = countJobs([
    { id: 3, name: "deploy", status: "created" },
    { id: 1, name: "lint", status: "success" },
    { id: 2, name: "test", status: "failed" },
  ]);
  expect(out.jobs.map((j) => j.name)).toEqual(["lint", "test", "deploy"]);
});

test("clips by terminal cells, counting CJK as two", async () => {
  expect(clip("frontpage", 20)).toBe("frontpage");
  expect(clip("sports-donation-frontpage", 10)).toBe("sports-do…");
  expect(clip("修正角色選擇", 7)).toBe("修正角…");
  expect(displayWidth("修正 ab")).toBe(7);
});

test("shows a merge request ref as MR !iid", async () => {
  expect(formatRef("refs/merge-requests/77/head")).toBe("MR !77");
  expect(formatRef("refs/merge-requests/479/merge")).toBe("MR !479");
  expect(formatRef("develop")).toBe("develop");
  expect(formatRef("fix/role-picker")).toBe("fix/role-picker");
});

test("status collapses to its first letter", async () => {
  expect(statusLetter("success")).toBe("S");
  expect(statusLetter("running")).toBe("R");
  expect(statusLetter("failed")).toBe("F");
  expect(statusLetter(undefined)).toBe("-");
});

test("packs running job names into lines that fit", async () => {
  const names = ["pytest::unit-sqlite", "ty", "pytest::integration-postgres", "migration"];
  const lines = packLines(names, 24);
  expect(lines).toEqual([
    "pytest::unit-sqlite, ty,",
    "pytest::integration-post",
    "gres, migration",
  ]);
  for (const l of lines) expect(displayWidth(l)).toBeLessThanOrEqual(24);
  expect(lines.join("").replace(/,/g, "").replace(/ /g, "")).toBe(names.join(""));
});

test("word-wraps a commit title with a shorter first line", async () => {
  const lines = wrapText("fix(register): keep the role when the same category is picked", 20, 30);
  expect(lines).toEqual(["fix(register): keep", "the role when the same", "category is picked"]);
  expect(displayWidth(lines[0] ?? "")).toBeLessThanOrEqual(20);
  for (const l of lines.slice(1)) expect(displayWidth(l)).toBeLessThanOrEqual(30);
});

test("splits a word longer than the line", async () => {
  expect(wrapText("abcdefghij", 4, 4)).toEqual(["abcd", "efgh", "ij"]);
  expect(wrapText("修正角色選擇", 4, 6)).toEqual(["修正", "角色選", "擇"]);
});

const run = (id: number, status: string): Snapshot => ({
  pipeline: { id, status, sha: "abc", url: "", done: 0, total: 0, running: [], jobs: [] },
});

test("announces a pipeline that finished since the last poll", async () => {
  expect(notifyFor("frontpage", run(1, "running"), run(1, "success"))).toBe(
    "✔ frontpage · pipeline #1 success",
  );
  expect(notifyFor("backend", run(1, "pending"), run(1, "failed"))).toBe(
    "✘ backend · pipeline #1 failed",
  );
});

test("announces a new pipeline that started and finished between polls", async () => {
  expect(notifyFor("admin", run(1, "success"), run(2, "failed"))).toBe(
    "✘ admin · pipeline #2 failed",
  );
});

test("stays quiet on the first poll, while running, and when nothing changed", async () => {
  expect(notifyFor("x", undefined, run(1, "failed"))).toBeUndefined();
  expect(notifyFor("x", run(1, "success"), run(2, "running"))).toBeUndefined();
  expect(notifyFor("x", run(1, "pending"), run(1, "running"))).toBeUndefined();
  expect(notifyFor("x", run(1, "failed"), run(1, "failed"))).toBeUndefined();
});

test("only a failed job is red", async () => {
  const red = jobColor("failed");
  for (const s of ["success", "running", "created", "pending", "manual", "skipped", "canceled"]) {
    expect(jobColor(s)).not.toBe(red);
  }
});

test("groups jobs under their stages in pipeline order", async () => {
  const stages = groupStages([
    { name: "oxlint", status: "success", stage: "lint" },
    { name: "format", status: "success", stage: "lint" },
    { name: "unit", status: "failed", stage: "test" },
    { name: "e2e", status: "running", stage: "test" },
    { name: "image", status: "created", stage: "build" },
    { name: "prod", status: "manual", stage: "deploy" },
  ]);
  expect(stages.map((s) => [s.name, s.status, s.done, s.jobs.length])).toEqual([
    ["lint", "success", 2, 2],
    ["test", "failed", 1, 2],
    ["build", "pending", 0, 1],
    ["deploy", "manual", 1, 1],
  ]);
});

test("carries the stage through countJobs", async () => {
  const out = countJobs([{ id: 1, name: "unit", status: "success", stage: "test" }]);
  expect(out.jobs[0]?.stage).toBe("test");
});

test("draws a proportional bar", async () => {
  expect(progressBar(1, 4, 8)).toBe("██░░░░░░");
  expect(progressBar(0, 0, 8)).toBe("");
});

test("pulses from the colour to dim and back", async () => {
  expect(pulseColor("#ff0000", "#000000", 0)).toBe("#ff0000");
  expect(pulseColor("#ff0000", "#000000", 3)).toBe("#000000");
  expect(pulseColor("#ff0000", "#000000", 1)).toBe("#aa0000");
  expect(pulseColor("#ff0000", "#000000", 5)).toBe("#aa0000");
  expect(pulseColor("#ff0000", "#000000", 6)).toBe("#ff0000");
});
