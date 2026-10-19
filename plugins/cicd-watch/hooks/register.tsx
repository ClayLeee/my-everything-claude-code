import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { CommitInfo, PipelineInfo, Snapshot, WatchedProject } from "../types";
import {
  ACTIVE,
  ago,
  chunk,
  clip,
  countJobs,
  displayWidth,
  formatRef,
  groupStages,
  jobColor,
  jobGlyph,
  notifyFor,
  parseTarget,
  PULSE_STEPS,
  pulseColor,
  shortName,
  statusLook,
  wrapText,
} from "./gitlab";

const PANE = "cicd";
const STORE_KEY = "projects";
const PANE_COLUMNS = 46;
const PRIMARY = "#f3ae35";
const RED = "#f38ba8";
const DIM = "#6c7086";
const BADGE_TEXT = "#1e1e2e";
const CAP_LEFT = "\u{E0B6}";
const CAP_RIGHT = "\u{E0B4}";
const CELL_ON = "\u{F089A}";
const CELL_OFF = "\u{F10CB}";
const FINISHED = ["success", "failed", "canceled", "skipped"];
const projects = atom({ plugin: "cicd-watch", key: "projects" } as const, []);
const snaps = atom({ plugin: "cicd-watch", key: "snaps" } as const, {});
const checkedAt = atom({ plugin: "cicd-watch", key: "checkedAt" } as const, 0);
const flashes = atom({ plugin: "cicd-watch", key: "flashes" } as const, {});
const tick = atom({ plugin: "cicd-watch", key: "tick" } as const, 0);
const FLASHES = 3;
const FLASH_FRAMES = FLASHES * PULSE_STEPS * 2;
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPIN_MS = 250;

type $ = EngineInterface;

let defaultHost = "";
let pollMs = 20000;
const tokens = new Map<string, string | null>();
let polling = false;
let timer: { cancel: () => void } | null = null;
let spinner: { cancel: () => void } | null = null;
let activeCount = 0;

function glyph(status: string, frame: number): string {
  return status === "running" ? SPIN[frame % SPIN.length]! : jobGlyph(status);
}

function isActive(s: Snapshot | undefined): boolean {
  return Boolean(s?.pipeline && ACTIVE.includes(s.pipeline.status));
}

function statusLine(frame: number): string | undefined {
  return activeCount ? `CI ${SPIN[frame % SPIN.length]} ${activeCount} running` : undefined;
}

async function step($: $) {
  const t = await update($, tick, (n) => n + 1);
  if (activeCount) $.ui.status(statusLine(t));
  const left = await update($, flashes, (f) =>
    Object.fromEntries(Object.entries(f).filter(([, start]) => t - start < FLASH_FRAMES)),
  );
  if (activeCount === 0 && Object.keys(left).length === 0) {
    spinner?.cancel();
    spinner = null;
  }
}

function animate($: $) {
  spinner ??= $.clock.every(SPIN_MS, () => void step($));
}

async function tokenFor($: $, host: string): Promise<string | null> {
  if (tokens.has(host)) return tokens.get(host) ?? null;
  let token: string | null = null;
  try {
    const r = await $.process.run(["git", "credential", "fill"], {
      stdin: `protocol=https\nhost=${host}\n\n`,
      env: { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
      timeoutMs: 15000,
    });
    const line = r.stdout.split("\n").find((l) => l.startsWith("password="));
    token = line ? line.slice("password=".length).trim() : null;
  } catch {
    token = null;
  }
  tokens.set(host, token);
  return token;
}

async function api<T>($: $, p: WatchedProject, path: string): Promise<T> {
  const token = await tokenFor($, p.host);
  if (!token) throw new Error(`no git credential for ${p.host}`);
  const url = `https://${p.host}/api/v4/projects/${encodeURIComponent(p.path)}${path}`;
  const res = await $.http.fetch(url, { headers: { "PRIVATE-TOKEN": token } });
  if (res.status === 401) tokens.delete(p.host);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path.split("?")[0] || "/"}`);
  return JSON.parse(res.text) as T;
}

async function check($: $, p: WatchedProject, prev: Snapshot | undefined): Promise<Snapshot> {
  try {
    type RawCommit = { id: string; title: string; author_name: string; created_at: string };
    const pipelines = await api<
      { id: number; status: string; sha: string; ref: string; web_url: string }[]
    >($, p, `/pipelines?per_page=1${p.ref ? `&ref=${encodeURIComponent(p.ref)}` : ""}`);
    const pl = pipelines[0];
    const ref = p.ref ?? pl?.ref;
    let commit: CommitInfo | undefined;
    if (!p.ref && pl && prev?.commit?.sha === pl.sha) {
      commit = prev.commit;
    } else {
      const c = p.ref
        ? (
            await api<RawCommit[]>(
              $,
              p,
              `/repository/commits?ref_name=${encodeURIComponent(p.ref)}&per_page=1`,
            )
          )[0]
        : pl
          ? await api<RawCommit>($, p, `/repository/commits/${pl.sha}`)
          : undefined;
      commit = c && { sha: c.id, title: c.title, author: c.author_name, at: c.created_at };
    }
    let pipeline: PipelineInfo | undefined;
    if (pl) {
      const reuse =
        prev?.pipeline?.id === pl.id &&
        !ACTIVE.includes(pl.status) &&
        !ACTIVE.includes(prev.pipeline.status) &&
        Array.isArray(prev.pipeline.jobs) &&
        prev.pipeline.jobs.every((j) => j.stage);
      const jobs = reuse
        ? prev!.pipeline!
        : countJobs(
            await api<{ id: number; status: string; name: string; stage: string }[]>(
              $,
              p,
              `/pipelines/${pl.id}/jobs?per_page=100&include_retried=false`,
            ),
          );
      pipeline = {
        id: pl.id,
        status: pl.status,
        sha: pl.sha,
        url: pl.web_url,
        done: jobs.done,
        total: jobs.total,
        running: jobs.running,
        jobs: jobs.jobs,
      };
    }
    return { ref, commit, pipeline };
  } catch (err) {
    return {
      ...prev,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function flash($: $, id: string) {
  const t = await read($, tick);
  await update($, flashes, (f) => ({ ...f, [id]: t }));
  animate($);
}

async function pollAll($: $) {
  if (polling) return;
  polling = true;
  try {
    const list = await read($, projects);
    const before = await read($, snaps);
    const results = await Promise.all(list.map((p) => check($, p, before[p.id])));
    const next: Record<string, Snapshot> = {};
    list.forEach((p, i) => {
      const snap = results[i];
      if (!snap) return;
      next[p.id] = snap;
      const msg = notifyFor(shortName(p), before[p.id], snap);
      if (msg) {
        $.ui.toast(msg);
        void flash($, p.id);
      }
    });
    await update($, snaps, () => next);
    const running = list.filter((p) => isActive(next[p.id]));
    const reordered = [...running, ...list.filter((p) => !running.includes(p))];
    if (reordered.some((p, i) => p !== list[i])) await save($, reordered);
    await update($, checkedAt, () => Date.now());
    const active = results.filter((s) => s.pipeline && ACTIVE.includes(s.pipeline.status)).length;
    activeCount = active;
    $.ui.status(statusLine(await read($, tick)));
    if (active) animate($);
  } finally {
    polling = false;
  }
}

async function boot($: $): Promise<number> {
  const stored = await $.store.get(STORE_KEY);
  const list = Array.isArray(stored) ? (stored as WatchedProject[]) : [];
  await update($, projects, () => list);
  timer?.cancel();
  timer = $.clock.every(pollMs, () => void pollAll($));
  await pollAll($);
  return list.length;
}

async function start($: $) {
  await $.command.register({
    name: "cicd",
    description: "Watch GitLab commits and pipelines (/cicd help for all subcommands)",
    argumentHint: "[help | add | rm | list | refresh | reload | close]",
  });
  void boot($);
}

async function save($: $, list: WatchedProject[]) {
  await update($, projects, () => list);
  await $.store.set(STORE_KEY, list);
}

async function add($: $, input: string): Promise<string> {
  const p = parseTarget(input, defaultHost);
  if (!p)
    return defaultHost
      ? `看不懂「${input}」：請輸入 group/project、host/group/project 或專案 URL，可加 @branch`
      : `看不懂「${input}」：還沒設定預設 GitLab host，請輸入 host/group/project 或專案 URL，可加 @branch`;
  const list = await read($, projects);
  if (list.some((x) => x.id === p.id)) return `${p.id} 已在清單中`;
  await save($, [...list, p]);
  void pollAll($);
  return `已加入 ${p.id}`;
}

async function remove($: $, target: string): Promise<string> {
  const list = await read($, projects);
  const keep = list.filter((x) => x.id !== target && shortName(x) !== target);
  if (keep.length === list.length) return `找不到 ${target}`;
  await save($, keep);
  await update($, snaps, (s) =>
    Object.fromEntries(Object.entries(s).filter(([k]) => keep.some((p) => p.id === k))),
  );
  return `已移除 ${target}`;
}

const HELP = [
  "/cicd                     開啟 CI/CD pane",
  "/cicd close               關閉 pane",
  "/cicd add <project>       加入專案（group/project、host/group/project 或 URL）",
  "                          不加 @branch：盯全專案最新 1 條 pipeline；加 @branch：只看該分支",
  "/cicd rm <project>        移除專案（完整 id 或專案短名）",
  "/cicd list                列出觀察中的專案",
  "/cicd refresh             立即重新檢查",
  "/cicd reload              從 store 讀回專案並重啟輪詢（/clear 後卡片消失時用）",
  "/cicd help                顯示這份說明",
].join("\n");

export const register: Register = (on, options) => {
  defaultHost = String(options.defaultHost ?? "").trim();
  pollMs = Math.max(5, Number(options.pollSeconds ?? 20)) * 1000;
  polling = false;
  timer = null;
  spinner = null;
  activeCount = 0;

  on("session.start", async ($, e, next) => {
    await start($);
    return next(e);
  });

  on("classic.SessionStart", async ($, e, next) => {
    if (e.source === "clear") await start($);
    return next(e);
  });

  on("command.run", { command: "cicd" }, async ($, e) => {
    const [verb = "", ...rest] = e.args.trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (verb) {
      case "":
      case "open":
        await $.ui.open({ id: PANE, title: "CI/CD", columns: PANE_COLUMNS });
        void boot($);
        return { text: "CI/CD pane opened." };
      case "close":
        await $.ui.close({ id: PANE });
        return { text: "CI/CD pane closed." };
      case "add":
        return { text: arg ? await add($, arg) : HELP };
      case "rm":
      case "remove":
        return { text: arg ? await remove($, arg) : HELP };
      case "list": {
        const list = await read($, projects);
        return {
          text: list.length ? list.map((p) => `- ${p.id}`).join("\n") : "尚未觀察任何專案",
        };
      }
      case "reload":
        return { text: `已從 store 讀回 ${await boot($)} 個專案並重啟輪詢` };
      case "refresh":
        await pollAll($);
        return { text: "已重新檢查所有專案" };
      default:
        return { text: HELP };
    }
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const list = await read($, projects);
    const all = await read($, snaps);
    await read($, checkedAt);
    const pulsing = await read($, flashes);
    const frameNo = await read($, tick);
    const now = await $.clock.now();
    const w = Math.max(28, e.props.bodyColumns ?? PANE_COLUMNS);
    const iw = w - 4;

    return (
      <Box flexDirection="column">
        {list.length === 0 && (
          <Text color={DIM} wrap="wrap">
            NO SIGNAL · /cicd add &lt;project&gt;
          </Text>
        )}
        {list.map((p) => {
          const s = all[p.id];
          const pl = s?.pipeline;
          const look = statusLook(pl?.status);
          const label = pl ? pl.status.toUpperCase() : "IDLE";
          const start = pulsing[p.id];
          const frame =
            pl && start !== undefined
              ? pulseColor(look.color, DIM, frameNo - start)
              : pl
                ? look.color
                : DIM;
          const name = clip(shortName(p).toUpperCase(), iw - displayWidth(label) - 5);
          const ref = formatRef(s?.ref ?? p.ref ?? "…");
          const stale = Boolean(s?.commit && pl && pl.sha !== s.commit.sha);
          const jobs = pl?.jobs ?? [];
          const count = pl ? `${pl.done}/${pl.total}` : "";
          const rows = chunk(jobs, Math.max(1, Math.floor((iw - 2 - displayWidth(count)) / 2)));
          return (
            <Box
              key={p.id}
              flexDirection="column"
              borderStyle="round"
              borderColor={frame}
              paddingX={1}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <Text color={PRIMARY} bold>
                  {name}
                </Text>
                <Text>
                  <Text color={frame}>{CAP_LEFT}</Text>
                  <Text color={BADGE_TEXT} backgroundColor={frame} bold>
                    {label}
                  </Text>
                  <Text color={frame}>{CAP_RIGHT}</Text>
                </Text>
              </Box>
              <Text color={DIM} wrap="truncate-end">
                {clip(`⎇ ${ref}${pl ? ` · #${pl.id}` : ""}${stale ? " · OLDER" : ""}`, iw)}
              </Text>
              {s?.error &&
                wrapText(s.error, iw - 2, iw - 2).map((line, i) => (
                  <Text
                    key={`err:${p.id}:${i}`}
                    color={RED}
                  >{`${i === 0 ? "⚠ " : "  "}${line}`}</Text>
                ))}
              {s?.commit &&
                wrapText(s.commit.title, iw - 10, iw - 2).map((line, i) =>
                  i === 0 ? (
                    <Text key={`title:${p.id}:0`}>
                      <Text color={DIM}>{"\u{F417}"} </Text>
                      <Text color={PRIMARY}>{s.commit!.sha.slice(0, 7)}</Text>
                      <Text>{` ${line}`}</Text>
                    </Text>
                  ) : (
                    <Text key={`title:${p.id}:${i}`}>{`  ${line}`}</Text>
                  ),
                )}
              {s?.commit && (
                <Text color={DIM} wrap="truncate-end">
                  {clip(`◷ ${s.commit.author} · T-${ago(s.commit.at, now)}`, iw)}
                </Text>
              )}
              {rows.map((row, i) => (
                <Text key={`jobs:${p.id}:${i}`}>
                  <Text color={DIM}>{i === 0 ? "⌁ " : "  "}</Text>
                  {row.map((j) => (
                    <Text
                      color={
                        j.status === "running"
                          ? pulseColor(jobColor(j.status), DIM, frameNo)
                          : jobColor(j.status)
                      }
                    >
                      {FINISHED.includes(j.status) || j.status === "running"
                        ? CELL_ON
                        : CELL_OFF}{" "}
                    </Text>
                  ))}
                  {i === 0 && (
                    <Text color={frame} bold>
                      {count}
                    </Text>
                  )}
                </Text>
              ))}
              {groupStages(jobs).map((st, si, all) => {
                const lastStage = si === all.length - 1;
                const color = jobColor(st.status);
                const tally = `${st.done}/${st.jobs.length}`;
                return (
                  <Box key={`stage:${p.id}:${st.name}`} flexDirection="column">
                    <Box flexDirection="row" justifyContent="space-between">
                      <Text>
                        <Text color={DIM}>{lastStage ? "└ " : "├ "}</Text>
                        <Text color={color} bold>
                          {`${glyph(st.status, frameNo)} ${clip(st.name.toUpperCase(), iw - displayWidth(tally) - 5)}`}
                        </Text>
                      </Text>
                      <Text color={color}>{tally}</Text>
                    </Box>
                    {st.status !== "success" &&
                      st.jobs.map((j, ji) => (
                        <Text key={`job:${p.id}:${st.name}:${ji}`} wrap="truncate-end">
                          <Text color={DIM}>
                            {`${lastStage ? "  " : "│ "}${ji === st.jobs.length - 1 ? "└ " : "├ "}`}
                          </Text>
                          <Text color={jobColor(j.status)}>
                            {`${glyph(j.status, frameNo)} ${clip(j.name, iw - 6)}`}
                          </Text>
                        </Text>
                      ))}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    );
  });
};
