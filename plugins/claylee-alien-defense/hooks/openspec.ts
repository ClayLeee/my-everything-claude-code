import type { EngineInterface } from "claude-code";

import type { Mode, Phase } from "./sim/types";

type $ = EngineInterface;

// The change's four OpenSpec files. Superpowers docs do not count: a spec-patch has none, and a
// new feature writes them before the change folder exists.
export const DOC_COUNT = 4;

// Follows the workflow: dawn while the docs are written (Phases 0–2), noon while building
// (Phase 4; boxes are only ticked after acceptance), dusk once acceptance has begun (Phase 5),
// night when every box is done and only archiving is left (Phase 6).
export function phaseOf(options: { docs: number; done: number; total: number }): Phase {
  if (options.docs < DOC_COUNT) return "dawn";
  if (options.total === 0 || options.done === 0) return "noon";
  return options.done >= options.total ? "night" : "dusk";
}

// A box left open but marked DEFERRED(<reason>) has been dealt with, so it counts as done.
export function countTasks(text: string): { done: number; total: number } {
  const boxes = text.match(/^\s*[-*] \[[ xX]\].*$/gm) ?? [];
  const done = boxes.filter((box) => /\[[xX]\]|DEFERRED\(/.test(box)).length;
  return { done, total: boxes.length };
}

export const PHASE_ORDER: readonly Phase[] = ["dawn", "noon", "dusk", "night"];

export function phaseRank(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function pickChange(
  changes: readonly { name: string; touchedMs: number }[],
): string | undefined {
  return [...changes].sort(
    (first, second) => second.touchedMs - first.touchedMs || first.name.localeCompare(second.name),
  )[0]?.name;
}

async function listEntries($: $, path: string): Promise<Awaited<ReturnType<$["fs"]["list"]>>> {
  try {
    return await $.fs.list(path);
  } catch {
    return [];
  }
}

async function listDirs($: $, path: string): Promise<string[]> {
  return (await listEntries($, path))
    .filter((entry) => entry.kind === "dir")
    .map((entry) => entry.name);
}

async function exists($: $, path: string): Promise<boolean> {
  try {
    return await $.fs.exists(path);
  } catch {
    return false;
  }
}

// Keeps following `current` while it is active, so editing two changes in turn does not
// read as one finishing; otherwise follows the change touched last.
export async function readMode($: $, top: string, current?: string): Promise<Mode> {
  const root = `${top}/openspec/changes`;
  const changes = (await listDirs($, root)).filter((name) => name !== "archive");
  const change =
    current !== undefined && changes.includes(current)
      ? current
      : pickChange(
          await Promise.all(
            changes.map(async (name) => ({
              name,
              touchedMs: Math.max(
                0,
                ...(await listEntries($, `${root}/${name}`)).map((entry) => entry.mtimeMs),
              ),
            })),
          ),
        );
  if (!change) return { kind: "free" };

  const base = `${root}/${change}`;
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
    others: changes.length - 1,
  };
}
