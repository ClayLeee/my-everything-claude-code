import type { EngineInterface, Register, ToolCallResult } from "claude-code";

type $ = EngineInterface;
type Passed = Record<string, string>;
type Denied = { deny: string };

const CONFIG = ".claude/push-checks.json";
const PUSH = /(?:^|[;&|(\n])\s*git(?:\s+-C\s+("[^"]+"|'[^']+'|\S+))?\s+push\b/;
const RUN_TIMEOUT_MS = 600_000;
const TAIL_LINES = 15;

async function git($: $, cwd: string, args: string[]): Promise<string | null> {
  try {
    const ran = await $.process.run(["git", ...args], { cwd });
    return ran.exitCode === 0 ? ran.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function checksOf($: $, top: string): Promise<string[] | null> {
  try {
    const parsed = JSON.parse(await $.fs.read(`${top}/${CONFIG}`)) as { checks?: unknown };
    return Array.isArray(parsed.checks) ? parsed.checks.map(String) : null;
  } catch {
    return null;
  }
}

async function workTree($: $, top: string): Promise<string | null> {
  const stash = await git($, top, ["stash", "create"]);
  return git($, top, ["rev-parse", `${stash || "HEAD"}^{tree}`]);
}

const storeKey = (top: string) => `passed:${top}`;

async function passedOf($: $, top: string): Promise<Passed> {
  return ((await $.store.get(storeKey(top))) as Passed | undefined) ?? {};
}

// A check counts as a whole && part, or (where pipefail can be set) as the first stage of a pipe.
function ranChecks(command: string, checks: string[], pipes: boolean): string[] {
  if (/;|\|\|/.test(command) || (!pipes && command.includes("|"))) return [];
  const parts = command.split("&&").map((part) =>
    (part.split("|")[0] ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/ 2>&1$/, ""),
  );
  return checks.filter((check) => parts.includes(check));
}

function unquote(path: string): string {
  return path
    .replace(/^["']|["']$/g, "")
    .replace(/^\/([a-zA-Z])\//, (_, drive: string) => `${drive.toUpperCase()}:/`);
}

function lastCd(text: string): string | null {
  const moves = [
    ...text.matchAll(/(?:^|[;&|(\n])\s*(?:cd|Set-Location|pushd)\s+("[^"]+"|'[^']+'|[^\s;&|)]+)/g),
  ];
  const target = moves[moves.length - 1]?.[1];
  return target ? unquote(target) : null;
}

async function dirOf($: $, command: string, upTo: number): Promise<string> {
  return lastCd(command.slice(0, upTo)) ?? (await $.session.cwd());
}

async function missingFor($: $, top: string, checks: string[]): Promise<string[]> {
  const head = await git($, top, ["rev-parse", "HEAD^{tree}"]);
  const passed = await passedOf($, top);
  return checks.filter((check) => head === null || passed[check] !== head);
}

async function guard<R extends ToolCallResult<string>>(
  $: $,
  command: string,
  pipes: boolean,
  run: (command: string) => Promise<R>,
): Promise<R | Denied> {
  const push = PUSH.exec(command);

  if (push) {
    const dir = push[1] ? unquote(push[1]) : await dirOf($, command, push.index);
    const top = await git($, dir, ["rev-parse", "--show-toplevel"]);
    const checks = top ? await checksOf($, top) : null;
    if (top && checks) {
      const missing = await missingFor($, top, checks);
      if (missing.length > 0) {
        return {
          deny: [
            `push-guard：${CONFIG} 規定這些檢查要在這次 push 的內容上通過：`,
            ...missing.map((check) => `  - ${check}`),
            "執行 /push-checks run，或把每項檢查單獨執行（可以用 && 串接；Bash 可以接 pipe，PowerShell 不行；不能用 || 或 ;），再重新 push。",
          ].join("\n"),
        };
      }
    }
    return run(command);
  }

  const top = await git($, await dirOf($, command, command.length), [
    "rev-parse",
    "--show-toplevel",
  ]);
  const checks = top ? await checksOf($, top) : null;
  const done = top && checks ? ranChecks(command, checks, pipes) : [];
  // Without pipefail a piped check exits with the last stage's status, not its own.
  const piped = done.length > 0 && command.includes("|");
  const ran = await run(piped ? `set -o pipefail; ${command}` : command);
  if (!top || done.length === 0) return ran;
  if (ran.deny !== undefined || ran.isError === true) return ran;
  const result = ran.result as { interrupted?: boolean; backgroundTaskId?: string } | undefined;
  if (result?.interrupted || result?.backgroundTaskId) return ran;

  const tree = await workTree($, top);
  if (tree) {
    const passed = await passedOf($, top);
    for (const check of done) passed[check] = tree;
    await $.store.set(storeKey(top), passed);
  }
  return ran;
}

async function shellArgv($: $, command: string): Promise<string[]> {
  return (await $.env.get("OS")) === "Windows_NT"
    ? ["cmd", "/d", "/s", "/c", command]
    : ["sh", "-c", command];
}

function tail(text: string): string {
  return text.trimEnd().split("\n").slice(-TAIL_LINES).join("\n");
}

type CheckResult = { check: string; ok: boolean; seconds: number; exitCode: number };
type LastRun = { finishedAt: number; results: CheckResult[]; tail?: string };

const lastRunKey = (top: string) => `lastRun:${top}`;
let running: string | null = null;

async function runChecks($: $, top: string, checks: string[]): Promise<LastRun> {
  const results: CheckResult[] = [];
  let failureTail: string | undefined;
  for (const [index, check] of checks.entries()) {
    $.ui.status(`push-checks ${index + 1}/${checks.length} · ${check}`);
    const start = await $.clock.now();
    const ran = await $.process.run(await shellArgv($, check), {
      cwd: top,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    const ok = ran.exitCode === 0;
    const seconds = Math.round(((await $.clock.now()) - start) / 1000);
    results.push({ check, ok, seconds, exitCode: ran.exitCode });
    if (!ok) {
      failureTail = tail(`${ran.stdout}\n${ran.stderr}`);
      break;
    }
  }
  const passedChecks = results.filter((result) => result.ok).map((result) => result.check);
  const tree = passedChecks.length > 0 ? await workTree($, top) : null;
  if (tree) {
    const passed = await passedOf($, top);
    for (const check of passedChecks) passed[check] = tree;
    await $.store.set(storeKey(top), passed);
  }
  const lastRun: LastRun = { finishedAt: await $.clock.now(), results };
  if (failureTail) lastRun.tail = failureTail;
  await $.store.set(lastRunKey(top), lastRun);
  return lastRun;
}

async function runInBackground($: $, top: string, checks: string[]): Promise<void> {
  running = top;
  try {
    const lastRun = await runChecks($, top, checks);
    const failure = lastRun.results.find((result) => !result.ok);
    $.ui.toast(
      failure
        ? `✗ push-checks：${failure.check} 失敗（exit ${failure.exitCode}），用 /push-checks 看輸出`
        : `✓ push-checks：${lastRun.results.length} 項全部通過`,
    );
  } catch (error) {
    $.ui.toast(`✗ push-checks 執行中斷：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    $.ui.status(undefined);
    running = null;
  }
}

function ago(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "剛剛";
  return minutes < 60 ? `${minutes} 分鐘前` : `${Math.round(minutes / 60)} 小時前`;
}

async function statusText($: $, top: string, checks: string[]): Promise<string> {
  const missing = await missingFor($, top, checks);
  const lines = checks.map((check) => `${missing.includes(check) ? "✗" : "✓"} ${check}`);
  if (running === top) lines.push("", "執行中，進度看狀態列");
  const lastRun = (await $.store.get(lastRunKey(top))) as LastRun | undefined;
  if (lastRun) {
    lines.push("", `上次執行：${ago((await $.clock.now()) - lastRun.finishedAt)}`);
    for (const result of lastRun.results) {
      const exit = result.ok ? "" : `（exit ${result.exitCode}）`;
      lines.push(`  ${result.ok ? "✓" : "✗"} ${result.check}  ${result.seconds}s${exit}`);
    }
    if (lastRun.tail) lines.push("", lastRun.tail);
  }
  return lines.join("\n");
}

const failed: Denied = { deny: "push-guard：檢查程式本身出錯，這次 push 沒有放行。" };

export const register: Register = (on) => {
  on("tool.call", { tool: "Bash" }, ($, e, next) =>
    guard($, e.command, true, (command) => next({ ...e, command })),
  ).catch(
    ($, e, next) => (next.called ? next(e) : failed),
  );

  on("tool.call", { tool: "PowerShell" }, ($, e, next) =>
    guard($, e.command, false, (command) => next({ ...e, command })),
  ).catch(
    ($, e, next) => (next.called ? next(e) : failed),
  );

  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "push-checks",
      description: "顯示 push 前檢查的狀態；加上 run 會在背景執行檢查",
      argumentHint: "[run]",
    });
    return next(e);
  });

  on("command.run", { command: "push-checks" }, async ($, e) => {
    const cwd = await $.session.cwd();
    const top = await git($, cwd, ["rev-parse", "--show-toplevel"]);
    const checks = top ? await checksOf($, top) : null;
    if (!top || !checks) return { text: `這個專案沒有 ${CONFIG}，push 不受保護。` };
    if (e.args.trim() === "run") {
      if (running) return { text: "push-checks 已經在執行中，進度看狀態列。" };
      void runInBackground($, top, checks);
      return {
        text: `已在背景開始執行 ${checks.length} 項檢查，進度看狀態列，完成時會跳通知。`,
      };
    }
    return { text: await statusText($, top, checks) };
  });
};
