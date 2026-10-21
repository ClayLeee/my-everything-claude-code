import type { On } from "claude-code";
import { type Engine, expect, mock, test } from "claude-code/testing";

const REPO = "/repo";
const CHECKS = ["pnpm lint", "pnpm test"];

type Repo = {
  headTree: string;
  workTree: string;
  config?: string;
  shell?: string[];
  tools?: string[];
  outcome?: { interrupted?: boolean; backgroundTaskId?: string };
  // Files changed since the upstream; undefined means the branch has no upstream.
  changed?: string[];
  // Uncommitted tracked changes and untracked files, seen only when comparing the working tree.
  uncommitted?: string[];
  untracked?: string[];
};

// Enough of git's glob pathspec for the patterns these tests use.
const globRegExp = (glob: string) =>
  new RegExp(
    `^${glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "\u0000")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, "(?:.*/)?")}$`,
  );

function engine(on: On, repo: Repo) {
  mock.store(on);
  mock.env(on, { OS: "Windows_NT" });
  on("session.cwd", () => ({ value: REPO }));
  on("command.register", ($, event) => ({ value: { command: event.name } }));
  on("fs.read", ($, event) => {
    if (
      repo.config === undefined ||
      !event.path.replace(/\\/g, "/").endsWith(`${REPO}/.claude/push-checks.json`)
    )
      throw new Error(`missing ${event.path}`);
    return { value: repo.config };
  });
  on("process.run", ($, event) => {
    if (event.init?.cwd?.includes("$")) throw new Error(`no such directory ${event.init.cwd}`);
    const args = event.argv.join(" ");
    const ok = (stdout: string) => ({
      value: {
        exitCode: 0,
        stdout,
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    });
    if (args === "git rev-parse --show-toplevel")
      return ok(event.init?.cwd?.startsWith("C:/other") ? "C:/other\n" : `${REPO}\n`);
    if (args === "git stash create") return ok(repo.workTree === repo.headTree ? "" : "stashsha\n");
    if (args === "git rev-parse stashsha^{tree}") return ok(`${repo.workTree}\n`);
    if (args === "git rev-parse HEAD^{tree}") return ok(`${repo.headTree}\n`);
    const excluded = event.argv
      .filter((arg) => arg.startsWith(":(exclude,glob)"))
      .map((arg) => globRegExp(arg.slice(":(exclude,glob)".length)));
    const listed = (files: string[]) =>
      ok(
        files
          .filter((file) => !excluded.some((pattern) => pattern.test(file)))
          .map((file) => `${file}\n`)
          .join(""),
      );
    if (args.startsWith("git diff --name-only @{upstream} ")) {
      if (repo.changed === undefined) throw new Error("no upstream configured");
      const committed = args.startsWith("git diff --name-only @{upstream} HEAD -- . ");
      return listed(committed ? repo.changed : [...repo.changed, ...(repo.uncommitted ?? [])]);
    }
    if (args.startsWith("git ls-files --others --exclude-standard -- . "))
      return listed(repo.untracked ?? []);
    if (event.argv[0] === "cmd") {
      const check = event.argv[event.argv.length - 1] ?? "";
      repo.shell?.push(check);
      if (!check.includes("fail")) return ok("done\n");
      return {
        value: {
          exitCode: 1,
          stdout: "",
          stderr: "1 test failed\n",
          isStdoutTruncated: false,
          isStderrTruncated: false,
        },
      };
    }
    throw new Error(`unexpected ${args}`);
  });
  on("tool.call", ($, event) => {
    const command = "command" in event ? String(event.command) : "";
    repo.tools?.push(command);
    const failed = command.includes("fail-");
    const result = { stdout: "", stderr: "", interrupted: false, ...repo.outcome };
    return failed ? { result, isError: true as const } : { result };
  });

  const screen = { toasts: [] as string[], statuses: [] as (string | undefined)[] };
  let toasted: (() => void) | null = null;
  mock.clock(on);
  on("ui.toast", ($, event) => {
    screen.toasts.push(event.text);
    toasted?.();
    return { value: undefined };
  });
  on("ui.status", ($, event) => {
    screen.statuses.push(event.text);
    return { value: undefined };
  });
  const nextToast = () =>
    new Promise<void>((resolve) => {
      toasted = resolve;
    });
  return { screen, nextToast };
}

const config = JSON.stringify({ checks: CHECKS });

test("a project without push-checks.json pushes freely", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1" });
  const ran = await $.tool.call({ tool: "Bash", command: "git push origin develop" });
  expect(ran.deny).toBeUndefined();
});

test("a push is denied until every check has passed on the pushed tree", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm lint");
  expect(ran.deny).toContain("pnpm test");
});

test("checks run in PowerShell or chained with && count, and the push goes through", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  await $.tool.call({ tool: "PowerShell", command: "pnpm lint && pnpm test" });
  const ran = await $.tool.call({ tool: "Bash", command: "git push origin develop" });
  expect(ran.deny).toBeUndefined();
});

test("a failed or piped check does not count", async ($, on) => {
  engine(on, {
    headTree: "t1",
    workTree: "t1",
    config: JSON.stringify({ checks: ["pnpm fail-lint", "pnpm test"] }),
  });
  await $.tool.call({ tool: "Bash", command: "pnpm fail-lint" });
  await $.tool.call({ tool: "PowerShell", command: "pnpm test 2>&1 | Select-String FAIL" });
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm fail-lint");
  expect(ran.deny).toContain("pnpm test");
});

test("a check piped in Bash counts, run with pipefail so its own exit status decides", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config, tools: [] };
  engine(on, repo);
  await $.tool.call({ tool: "Bash", command: "pnpm lint 2>&1 | tail -20 && pnpm test | head" });
  expect(repo.tools).toEqual(["set -o pipefail; pnpm lint 2>&1 | tail -20 && pnpm test | head"]);
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
});

test("a failed piped check, a check behind || or a check piped into does not count", async ($, on) => {
  engine(on, {
    headTree: "t1",
    workTree: "t1",
    config: JSON.stringify({ checks: ["pnpm fail-lint", "pnpm test", "pnpm lint"] }),
  });
  await $.tool.call({ tool: "Bash", command: "pnpm fail-lint | tail -20" });
  await $.tool.call({ tool: "Bash", command: "pnpm test || true" });
  await $.tool.call({ tool: "Bash", command: "echo x | pnpm lint" });
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm fail-lint");
  expect(ran.deny).toContain("pnpm test");
  expect(ran.deny).toContain("pnpm lint");
});

test("checks that passed on uncommitted work still count once it is committed", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t2", config };
  engine(on, repo);
  await $.tool.call({ tool: "Bash", command: "pnpm lint" });
  await $.tool.call({ tool: "Bash", command: "pnpm test" });
  repo.headTree = "t2";
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
});

test("checks on a working tree with another session's edits count for a commit of only this session's files", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t2", config };
  const { screen } = engine(on, repo);
  await $.tool.call({ tool: "Bash", command: "pnpm lint && pnpm test" });
  // This session commits its own files; the other session's edits stay uncommitted.
  repo.headTree = "t1b";
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
  expect(screen.toasts.at(-1)).toContain("其他未 commit 修改");
  // Any edit after that, by either session, voids the pass.
  repo.workTree = "t4";
  const again = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(again.deny).toContain("pnpm lint");
});

test("an edit after the checks makes the push wait for a fresh run", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config };
  engine(on, repo);
  await $.tool.call({ tool: "Bash", command: "pnpm lint" });
  await $.tool.call({ tool: "Bash", command: "pnpm test" });
  repo.headTree = "t3";
  repo.workTree = "t3";
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm lint");
});

test("a check moved to the background or interrupted does not count, and a toast says so", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config };
  const { screen } = engine(on, repo);
  repo.outcome = { backgroundTaskId: "b1" };
  await $.tool.call({ tool: "Bash", command: "pnpm test 2>&1 | tail -6" });
  repo.outcome = { interrupted: true };
  await $.tool.call({ tool: "PowerShell", command: "pnpm lint" });
  repo.outcome = { backgroundTaskId: "b2" };
  await $.tool.call({ tool: "Bash", command: "pnpm build" });
  expect(screen.toasts).toHaveLength(2);
  expect(screen.toasts[0]).toContain("pnpm test 被移到背景");
  expect(screen.toasts[1]).toContain("pnpm lint 被中斷");
  expect(screen.toasts[0]).toContain("/push-checks run");
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm test");
  expect(ran.deny).toContain("移到背景");
});

const docsConfig = JSON.stringify({
  checks: CHECKS,
  skipWhenOnly: ["openspec/**", "docs/**", "**/*.md"],
});

test("a push whose commits touch only skipWhenOnly paths goes through without checks", async ($, on) => {
  const { screen } = engine(on, {
    headTree: "t1",
    workTree: "t1",
    config: docsConfig,
    changed: ["openspec/changes/a/proposal.md", "docs/superpowers/plans/p.md", "README.md"],
  });
  const ran = await $.tool.call({ tool: "Bash", command: "git push origin develop" });
  expect(ran.deny).toBeUndefined();
  expect(screen.toasts[0]).toContain("skipWhenOnly");
});

test("one file outside skipWhenOnly, or no upstream, still needs the checks", async ($, on) => {
  const repo: Repo = {
    headTree: "t1",
    workTree: "t1",
    config: docsConfig,
    changed: ["openspec/specs/a/spec.md", "src/app.ts"],
  };
  engine(on, repo);
  const code = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(code.deny).toContain("pnpm lint");
  repo.changed = undefined;
  const fresh = await $.tool.call({ tool: "Bash", command: "git push -u origin feature" });
  expect(fresh.deny).toContain("pnpm lint");
});

test("without skipWhenOnly a docs-only push still needs the checks", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config, changed: ["docs/a.md"] });
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm lint");
});

test("git push named inside a string or message is not a push", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const commit = await $.tool.call({ tool: "Bash", command: 'git commit -m "explain git push"' });
  expect(commit.deny).toBeUndefined();
  const echo = await $.tool.call({
    tool: "PowerShell",
    command: "Write-Output 'run git push later'",
  });
  expect(echo.deny).toBeUndefined();
  const chained = await $.tool.call({ tool: "Bash", command: "pnpm lint && git -C /repo push" });
  expect(chained.deny).toContain("pnpm test");
});

test("a -C path that cannot be resolved is not a guarded repo", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const ran = await $.tool.call({
    tool: "PowerShell",
    command: "git -C $repo push origin develop",
  });
  expect(ran.deny).toBeUndefined();
});

test("a push after cd into another repo is judged by that repo", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const away = await $.tool.call({ tool: "Bash", command: "cd /c/other && git push origin main" });
  expect(away.deny).toBeUndefined();
  const back = await $.tool.call({ tool: "Bash", command: "cd /c/other && cd /repo && git push" });
  expect(back.deny).toContain("pnpm lint");
});

const run = ($: Engine, args: string) =>
  $.command.run({
    command: "push-checks",
    args,
    origin: { kind: "composer" },
    presentation: { isFullscreen: false, columns: 100 },
  });

test("/push-checks run answers at once, runs in the background and lets the push through", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config, shell: [] };
  const { screen, nextToast } = engine(on, repo);
  const finished = nextToast();
  const result = await run($, "run");
  expect(result.text).toContain("背景");
  await finished;
  expect(repo.shell).toEqual(["pnpm lint", "pnpm test"]);
  expect(screen.statuses).toEqual([
    "push-checks 1/2 · pnpm lint",
    "push-checks 2/2 · pnpm test",
    undefined,
  ]);
  expect(screen.toasts).toEqual(["✓ push-checks：2 項全部通過"]);
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
  const status = await run($, "");
  expect(status.text).toContain("✓ pnpm test");
  expect(status.text).toContain("上次執行");
});

test("/push-checks run stops at the first failure and keeps its output for /push-checks", async ($, on) => {
  const repo: Repo = {
    headTree: "t1",
    workTree: "t1",
    config: JSON.stringify({ checks: ["pnpm fail-lint", "pnpm test"] }),
    shell: [],
  };
  const { screen, nextToast } = engine(on, repo);
  const finished = nextToast();
  await run($, "run");
  await finished;
  expect(repo.shell).toEqual(["pnpm fail-lint"]);
  expect(screen.toasts[0]).toContain("pnpm fail-lint 失敗");
  const status = await run($, "");
  expect(status.text).toContain("✗ pnpm fail-lint");
  expect(status.text).toContain("1 test failed");
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm fail-lint");
});

test("a second /push-checks run while one is going is refused", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config, shell: [] };
  const { nextToast } = engine(on, repo);
  const finished = nextToast();
  await run($, "run");
  const again = await run($, "run");
  expect(again.text).toContain("已經在執行中");
  await finished;
});

const TOOL = "mcp__claylee-core__push-checks";
const callTool = async ($: Engine, cwd?: string) => {
  const ran = await $.tool.call({ tool: TOOL, ...(cwd ? { cwd } : {}) });
  return String(ran.result ?? ran.deny);
};

test("the model gets a push-checks tool, listed up front", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const registered: { name: string; isDeferred?: boolean }[] = [];
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("tool.register", ($, event) => {
    registered.push(event);
    return { value: { tool: `mcp__claylee-core__${event.name}` } };
  });
  await $.session.start({ cwd: REPO, surface: "terminal", isInteractive: true });
  expect(registered.find((tool) => tool.name === "push-checks")?.isDeferred).toBe(false);
});

test("the push-checks tool waits for every check and then lets the push through", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", config, shell: [] };
  const { screen } = engine(on, repo);
  const denied = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(denied.deny).toContain(TOOL);
  const text = await callTool($);
  expect(repo.shell).toEqual(["pnpm lint", "pnpm test"]);
  expect(text).toContain("2 項全部通過");
  expect(text).toContain("✓ pnpm test");
  expect(screen.statuses.at(-1)).toBeUndefined();
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
});

test("the push-checks tool stops at the first failure and returns its output", async ($, on) => {
  const repo: Repo = {
    headTree: "t1",
    workTree: "t1",
    config: JSON.stringify({ checks: ["pnpm fail-lint", "pnpm test"] }),
    shell: [],
  };
  engine(on, repo);
  const text = await callTool($);
  expect(repo.shell).toEqual(["pnpm fail-lint"]);
  expect(text).toContain("pnpm fail-lint 失敗");
  expect(text).toContain("1 test failed");
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toContain("pnpm fail-lint");
});

test("the push-checks tool, called before the commit, skips work that touches only skipWhenOnly paths", async ($, on) => {
  const repo: Repo = {
    headTree: "t1",
    workTree: "t2",
    config: docsConfig,
    changed: [],
    uncommitted: ["openspec/changes/a/tasks.md"],
    untracked: ["docs/superpowers/plans/new.md"],
    shell: [],
  };
  engine(on, repo);
  expect(await callTool($)).toContain("不需要跑檢查");
  expect(repo.shell).toEqual([]);
});

test("the push-checks tool runs the checks for uncommitted or untracked code", async ($, on) => {
  const repo: Repo = {
    headTree: "t1",
    workTree: "t2",
    config: docsConfig,
    changed: [],
    uncommitted: ["docs/a.md"],
    untracked: ["src/new.ts"],
    shell: [],
  };
  engine(on, repo);
  expect(await callTool($)).toContain("2 項全部通過");
  expect(repo.shell).toEqual(["pnpm lint", "pnpm test"]);
  repo.untracked = [];
  repo.uncommitted = ["src/app.ts"];
  repo.shell = [];
  await callTool($);
  expect(repo.shell).toEqual(["pnpm lint", "pnpm test"]);
});

test("the push-checks tool runs nothing in a repo without push-checks.json", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t1", shell: [] };
  engine(on, repo);
  expect(await callTool($)).toContain("不需要跑檢查");
  expect(repo.shell).toEqual([]);
});

test("the push-checks tool judges the repo its cwd names", async ($, on) => {
  // The session's repo has checks; the worktree named by cwd resolves to one that has none.
  const repo: Repo = { headTree: "t1", workTree: "t1", config, shell: [] };
  engine(on, repo);
  expect(await callTool($, "C:/other/wt")).toContain("不需要跑檢查");
  expect(repo.shell).toEqual([]);
});

test("/push-checks with no argument shows the status", async ($, on) => {
  engine(on, { headTree: "t1", workTree: "t1", config });
  const result = await run($, "");
  expect(result.text).toContain("✗ pnpm lint");
});
