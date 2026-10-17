import type { EngineInterface } from "claude-code";

import type { Mode, Phase } from "./sim/types";

type $ = EngineInterface;

export const DOC_COUNT = 6;

export function phaseOf(options: { docs: number; done: number; total: number }): Phase {
  if (options.docs < DOC_COUNT) return "dawn";
  if (options.total === 0 || options.done === 0) return "noon";
  if (options.done >= options.total) return "night";
  return options.done / options.total < 0.5 ? "noon" : "dusk";
}

export function countTasks(text: string): { done: number; total: number } {
  const boxes = text.match(/^\s*[-*] \[[ xX]\]/gm) ?? [];
  const done = boxes.filter((box) => /\[[xX]\]/.test(box)).length;
  return { done, total: boxes.length };
}

const PHASE_ORDER: readonly Phase[] = ["dawn", "noon", "dusk", "night"];

export function phaseRank(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

async function listDirs($: $, path: string): Promise<string[]> {
  try {
    return (await $.fs.list(path))
      .filter((entry) => entry.kind === "dir")
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function hasMarkdown($: $, path: string): Promise<boolean> {
  try {
    return (await $.fs.list(path)).some(
      (entry) => entry.kind === "file" && entry.name.endsWith(".md"),
    );
  } catch {
    return false;
  }
}

async function exists($: $, path: string): Promise<boolean> {
  try {
    return await $.fs.exists(path);
  } catch {
    return false;
  }
}

export async function readMode($: $, top: string): Promise<Mode> {
  const changes = (await listDirs($, `${top}/openspec/changes`))
    .filter((name) => name !== "archive")
    .sort();
  const change = changes[0];
  if (!change) return { kind: "free" };

  const base = `${top}/openspec/changes/${change}`;
  let docs = 0;
  for (const file of ["proposal.md", "design.md", "tasks.md"]) {
    if (await exists($, `${base}/${file}`)) docs += 1;
  }
  for (const capability of await listDirs($, `${base}/specs`)) {
    if (await exists($, `${base}/specs/${capability}/spec.md`)) {
      docs += 1;
      break;
    }
  }
  if (await hasMarkdown($, `${top}/docs/superpowers/specs`)) docs += 1;
  if (await hasMarkdown($, `${top}/docs/superpowers/plans`)) docs += 1;

  let tasks = { done: 0, total: 0 };
  try {
    tasks = countTasks(await $.fs.read(`${base}/tasks.md`));
  } catch {
    tasks = { done: 0, total: 0 };
  }
  return {
    kind: "openspec",
    change,
    phase: phaseOf({ docs, ...tasks }),
    docs,
    ...tasks,
  };
}
