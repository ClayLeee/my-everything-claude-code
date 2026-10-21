#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const SKIP_TYPES = new Set(["docs", "test", "chore", "style", "ci", "build"]);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|go|rs|java|kt|swift|rb|cs|php|c|cpp|h|dart|ex|exs)$/;
const TEST = /(\.|_)(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|(^|\/)(__tests__|tests?)\//;
const USER_FACING = /(^|\/)(locales?|i18n|routes?|router|pages?|views|api|controllers?|handlers?|cmd)\//i;

const [range, cwd = process.cwd()] = process.argv.slice(2);
if (!range) {
  console.error("usage: triage.mjs <git-range> [repo-dir]");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const top = git("rev-parse", "--show-toplevel");
const shas = git("rev-list", "--reverse", "--no-merges", range).split("\n").filter(Boolean);

const stem = (name) =>
  name
    .replace(/^test_/, "")
    .replace(/(\.|_)(test|spec)$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^use/, "");

function testsIn(dir) {
  const full = path.join(top, dir);
  const onDisk = existsSync(full) ? readdirSync(full).filter((f) => TEST.test(f)) : [];
  const touched = [...touchedTests]
    .filter((t) => path.posix.dirname(t) === dir)
    .map((t) => path.posix.basename(t));
  return [...new Set([...onDisk, ...touched])].map((f) => stem(path.parse(f).name));
}

function hasTest(file) {
  const { dir, name } = path.parse(file);
  const own = stem(name);
  return testsIn(dir).some((t) => t.length > 0 && (own.includes(t) || t.includes(own)));
}

const commits = shas.map((sha) => {
  const subject = git("show", "-s", "--format=%s", sha);
  const type = /^(\w+)(\(.+?\))?!?:/.exec(subject)?.[1]?.toLowerCase() ?? null;
  const files = git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean);
  return { sha: sha.slice(0, 8), subject, type, files };
});

const files = [...new Set(commits.flatMap((c) => c.files))];
const touchedSpec = files.some((f) => f.startsWith("openspec/"));
const touchedTests = new Set(files.filter((f) => TEST.test(f)));
const source = files.filter((f) => CODE.test(f) && !TEST.test(f) && !/^(openspec|docs)\//.test(f));

const counted = commits.filter((c) => !SKIP_TYPES.has(c.type ?? ""));
const report = {
  range,
  commits: commits.map((c) => ({ ...c, skipped: SKIP_TYPES.has(c.type ?? "") })),
  needsReview: counted.length > 0 && source.length > 0,
  specFlag:
    !touchedSpec &&
    counted.length > 0 &&
    source.some((f) => USER_FACING.test(f) || counted.some((c) => c.type === "feat")),
  specTouched: touchedSpec,
  testGaps: source.filter((f) => !hasTest(f)),
  sourceFiles: source,
};

console.log(JSON.stringify(report, null, 2));
