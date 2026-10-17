import type { On } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

const REPO = "/repo";
const CHECKS = ["pnpm lint", "pnpm test"];

type Repo = { headTree: string; workTree: string; config?: string };

function engine(on: On, repo: Repo) {
  mock.store(on);
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
    if (args === "git rev-parse --show-toplevel") return ok(`${REPO}\n`);
    if (args === "git stash create") return ok(repo.workTree === repo.headTree ? "" : "stashsha\n");
    if (args === "git rev-parse stashsha^{tree}") return ok(`${repo.workTree}\n`);
    if (args === "git rev-parse HEAD^{tree}") return ok(`${repo.headTree}\n`);
    throw new Error(`unexpected ${args}`);
  });
  on("tool.call", ($, event) => {
    const command = "command" in event ? String(event.command) : "";
    const failed = command.includes("fail");
    const result = { stdout: "", stderr: "", interrupted: false };
    return failed ? { result, isError: true as const } : { result };
  });
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

test("checks that passed on uncommitted work still count once it is committed", async ($, on) => {
  const repo: Repo = { headTree: "t1", workTree: "t2", config };
  engine(on, repo);
  await $.tool.call({ tool: "Bash", command: "pnpm lint" });
  await $.tool.call({ tool: "Bash", command: "pnpm test" });
  repo.headTree = "t2";
  const ran = await $.tool.call({ tool: "Bash", command: "git push" });
  expect(ran.deny).toBeUndefined();
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
