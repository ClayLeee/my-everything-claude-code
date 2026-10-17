import type { EngineInterface, Register, ToolCallResult } from "claude-code";

type $ = EngineInterface;
type Passed = Record<string, string>;
type Denied = { deny: string };

const CONFIG = ".claude/push-checks.json";
const PUSH = /\bgit\b(?:\s+-C\s+("[^"]+"|'[^']+'|\S+))?\s+push\b/;

async function git($: $, cwd: string, args: string[]): Promise<string | null> {
  const ran = await $.process.run(["git", ...args], { cwd });
  return ran.exitCode === 0 ? ran.stdout.trim() : null;
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

function ranChecks(command: string, checks: string[]): string[] {
  if (/[|;]/.test(command)) return [];
  const parts = command.split("&&").map((part) => part.trim().replace(/\s+/g, " "));
  return checks.filter((check) => parts.includes(check));
}

function unquote(path: string): string {
  return path.replace(/^["']|["']$/g, "");
}

async function missingFor($: $, top: string, checks: string[]): Promise<string[]> {
  const head = await git($, top, ["rev-parse", "HEAD^{tree}"]);
  const passed = await passedOf($, top);
  return checks.filter((check) => head === null || passed[check] !== head);
}

async function guard<R extends ToolCallResult<string>>(
  $: $,
  command: string,
  run: () => Promise<R>,
): Promise<R | Denied> {
  const push = PUSH.exec(command);

  if (push) {
    const dir = push[1] ? unquote(push[1]) : await $.session.cwd();
    const top = await git($, dir, ["rev-parse", "--show-toplevel"]);
    const checks = top ? await checksOf($, top) : null;
    if (top && checks) {
      const missing = await missingFor($, top, checks);
      if (missing.length > 0) {
        return {
          deny: [
            `push-guard: ${CONFIG} requires these checks to pass on the commit being pushed:`,
            ...missing.map((check) => `  - ${check}`),
            "Run each as its own command (chaining with && is fine; no pipes or ;), then push again.",
          ].join("\n"),
        };
      }
    }
    return run();
  }

  const ran = await run();
  if (ran.deny !== undefined || ran.isError === true) return ran;
  const result = ran.result as { interrupted?: boolean; backgroundTaskId?: string } | undefined;
  if (result?.interrupted || result?.backgroundTaskId) return ran;

  const top = await git($, await $.session.cwd(), ["rev-parse", "--show-toplevel"]);
  const checks = top ? await checksOf($, top) : null;
  if (!top || !checks) return ran;
  const done = ranChecks(command, checks);
  if (done.length === 0) return ran;

  const tree = await workTree($, top);
  if (tree) {
    const passed = await passedOf($, top);
    for (const check of done) passed[check] = tree;
    await $.store.set(storeKey(top), passed);
  }
  return ran;
}

const failed: Denied = { deny: "push-guard: the guard failed, so the push was not let through." };

export const register: Register = (on) => {
  on("tool.call", { tool: "Bash" }, ($, e, next) => guard($, e.command, () => next(e))).catch(
    ($, e, next) => (next.called ? next(e) : failed),
  );

  on("tool.call", { tool: "PowerShell" }, ($, e, next) => guard($, e.command, () => next(e))).catch(
    ($, e, next) => (next.called ? next(e) : failed),
  );

  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "push-checks",
      description: "Show which push checks have passed on HEAD",
    });
    return next(e);
  });

  on("command.run", { command: "push-checks" }, async ($) => {
    const cwd = await $.session.cwd();
    const top = await git($, cwd, ["rev-parse", "--show-toplevel"]);
    const checks = top ? await checksOf($, top) : null;
    if (!top || !checks) return { text: `No ${CONFIG} in this project; pushes are not guarded.` };
    const missing = await missingFor($, top, checks);
    return {
      text: checks.map((check) => `${missing.includes(check) ? "✗" : "✓"} ${check}`).join("\n"),
    };
  });
};
