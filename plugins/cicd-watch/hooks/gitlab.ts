import type { JobInfo, PipelineInfo, Snapshot, StageInfo, WatchedProject } from "../types";

export const ACTIVE = ["created", "waiting_for_resource", "preparing", "pending", "running"];
const FINISHED_JOB = ["success", "failed", "canceled", "skipped", "manual"];

export function parseTarget(input: string): WatchedProject | undefined {
  let text = input.trim();
  if (!/^https?:\/\//.test(text)) return undefined;
  let ref: string | undefined;
  const at = text.lastIndexOf("@");
  if (at > 0) {
    ref = text.slice(at + 1).trim() || undefined;
    text = text.slice(0, at);
  }
  text = text
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const tree = text.indexOf("/-/");
  if (tree >= 0) {
    const rest = text.slice(tree + 3);
    if (!ref && rest.startsWith("tree/")) ref = rest.slice(5) || undefined;
    text = text.slice(0, tree);
  }
  const [host = "", ...segments] = text.split("/").filter(Boolean);
  const path = segments.join("/");
  if (!host || !path.includes("/")) return undefined;
  return { id: `${host}/${path}${ref ? `@${ref}` : ""}`, host, path, ref };
}

// Each workspace (git repo root, else the session's directory) keeps its own watch list.
// Slashes are unified, the drive letter upper-cased and a trailing slash dropped, so the
// same folder always lands on the same key.
export function storeKeyFor(root: string): string {
  const folder = root
    .trim()
    .replace(/\\/g, "/")
    .replace(/^([a-z]):/i, (_, drive: string) => `${drive.toUpperCase()}:`)
    .replace(/(.)\/+$/, "$1");
  return `projects:${folder}`;
}

export function shortName(p: WatchedProject): string {
  return p.path.split("/").pop() ?? p.path;
}

export function statusLook(status: string | undefined): { glyph: string; color: string } {
  switch (status) {
    case "success":
      return { glyph: "", color: "#a6e3a1" };
    case "failed":
      return { glyph: "", color: "#f38ba8" };
    case "canceled":
    case "skipped":
      return { glyph: "", color: "#6c7086" };
    case "manual":
      return { glyph: "", color: "#89b4fa" };
    case undefined:
      return { glyph: "", color: "#6c7086" };
    default:
      return { glyph: "", color: "#f9e2af" };
  }
}

export function statusLetter(status: string | undefined): string {
  return status ? status.charAt(0).toUpperCase() : "-";
}

export function formatRef(ref: string): string {
  const prefix = "refs/merge-requests/";
  if (!ref.startsWith(prefix)) return ref;
  const iid = ref.slice(prefix.length).split("/")[0];
  return iid ? `MR !${iid}` : ref;
}

export function progressBar(done: number, total: number, width: number): string {
  if (total <= 0 || width <= 0) return "";
  const filled = Math.round((done / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function countJobs(
  raw: { id?: number; status: string; name: string; stage?: string }[],
): Pick<PipelineInfo, "done" | "total" | "running" | "jobs"> {
  const jobs = [...raw]
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((j) => ({ name: j.name, status: j.status, ...(j.stage ? { stage: j.stage } : {}) }));
  return {
    done: jobs.filter((j) => FINISHED_JOB.includes(j.status)).length,
    total: jobs.length,
    running: jobs.filter((j) => j.status === "running").map((j) => j.name),
    jobs,
  };
}

export function groupStages(jobs: JobInfo[]): StageInfo[] {
  const stages: StageInfo[] = [];
  for (const j of jobs) {
    const name = j.stage ?? "jobs";
    let s = stages.find((x) => x.name === name);
    if (!s) {
      s = { name, status: "", done: 0, jobs: [] };
      stages.push(s);
    }
    s.jobs.push(j);
  }
  for (const s of stages) {
    const st = s.jobs.map((j) => j.status);
    s.done = st.filter((x) => FINISHED_JOB.includes(x)).length;
    s.status = st.includes("failed")
      ? "failed"
      : st.includes("running")
        ? "running"
        : st.some((x) => ACTIVE.includes(x))
          ? "pending"
          : st.includes("manual")
            ? "manual"
            : st.every((x) => x === "skipped" || x === "canceled")
              ? "skipped"
              : "success";
  }
  return stages;
}

export function jobGlyph(status: string): string {
  switch (status) {
    case "success":
      return "✔";
    case "failed":
      return "✘";
    case "running":
      return "◐";
    case "manual":
      return "▶";
    case "skipped":
    case "canceled":
      return "⊘";
    default:
      return "○";
  }
}

export function jobColor(status: string): string {
  switch (status) {
    case "success":
      return "#a6e3a1";
    case "failed":
      return "#f38ba8";
    case "running":
      return "#f9e2af";
    case "manual":
      return "#89b4fa";
    default:
      return "#6c7086";
  }
}

function cellWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  const wide =
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60);
  return wide ? 2 : 1;
}

export function displayWidth(s: string): number {
  let n = 0;
  for (const ch of s) n += cellWidth(ch);
  return n;
}

export function clip(s: string, max: number): string {
  if (max <= 0) return "";
  if (displayWidth(s) <= max) return s;
  let out = "";
  let n = 0;
  for (const ch of s) {
    const w = cellWidth(ch);
    if (n + w > max - 1) break;
    out += ch;
    n += w;
  }
  return `${out}…`;
}

export function packLines(items: string[], width: number): string[] {
  return wrapText(items.join(", "), width, width);
}

export function wrapText(s: string, first: number, rest: number): string[] {
  const lines: string[] = [];
  let line = "";
  const room = () => (lines.length === 0 ? first : rest);
  for (const word of s.split(" ").filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (displayWidth(next) <= room()) {
      line = next;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    const pieces = wrapCells(word, room());
    while (pieces.length > 1) {
      lines.push(pieces.shift() ?? "");
      const tail = pieces.join("");
      pieces.splice(0, pieces.length, ...wrapCells(tail, room()));
    }
    line = pieces[0] ?? "";
  }
  if (line) lines.push(line);
  return lines;
}

function wrapCells(s: string, width: number): string[] {
  if (width <= 0 || displayWidth(s) <= width) return [s];
  const out: string[] = [];
  let cur = "";
  let n = 0;
  for (const ch of s) {
    const w = cellWidth(ch);
    if (n + w > width) {
      out.push(cur);
      cur = "";
      n = 0;
    }
    cur += ch;
    n += w;
  }
  if (cur) out.push(cur);
  return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) out.push(items.slice(i, i + size));
  return out;
}

// Decides what (if anything) to announce when a project's snapshot changes.
// Returns the toast text, or undefined to stay quiet.
export function notifyFor(
  name: string,
  prev: Snapshot | undefined,
  next: Snapshot,
): string | undefined {
  const before = prev?.pipeline;
  const after = next.pipeline;
  if (!before || !after || ACTIVE.includes(after.status)) return undefined;
  const sameRun = before.id === after.id;
  if (sameRun && !ACTIVE.includes(before.status)) return undefined;
  const mark = after.status === "success" ? "✔" : after.status === "failed" ? "✘" : "•";
  return `${mark} ${name} · pipeline #${after.id} ${after.status}`;
}

export const PULSE_STEPS = 3;

// Triangle wave between `color` and `dim`: frame 0 is `color`, frame PULSE_STEPS is `dim`.
export function pulseColor(color: string, dim: string, frame: number): string {
  const period = PULSE_STEPS * 2;
  const f = ((frame % period) + period) % period;
  const t = (f <= PULSE_STEPS ? f : period - f) / PULSE_STEPS;
  const rgb = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(rgb(color, i) + (rgb(dim, i) - rgb(color, i)) * t))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}
