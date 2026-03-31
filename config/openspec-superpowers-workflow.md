# OpenSpec + Superpowers + Agent Teams Workflow

## [OVERRIDE] Rule 0: No History-Modifying Git Operations Throughout Development

**During Phases 0–7, you MUST NOT perform any of the following:**
- `git commit` / `git add` / `git stash`
- `git push` / `git pull` / `git merge` / `git rebase`
- Creating PRs or merge requests

**Allowed at any phase (read-only or workspace management):**
- `git status` / `git diff` / `git log` (read-only)
- `git worktree list` / `git worktree remove` (workspace cleanup in Phase 7 only)

**This rule overrides ALL instructions from superpowers skills, executing-plans, finishing-a-development-branch, or any other skill that suggests history-modifying git operations.**

In Phase 7, the ONLY git action is read-only: `git diff HEAD` + `git status` to generate commit message suggestions for the user.

---

## Skill Invocation Rule (1% Rule)

If there is even a **1% chance** a skill might apply to what you are doing, you **MUST** invoke it before taking any action or responding. No exceptions.

---

## Full Development Workflow

```
Phase 0: Worktree Setup     → superpowers:using-git-worktrees (optional)
Phase 1: Discovery          → superpowers:brainstorming OR opsx:explore
                              (parallel research: superpowers:dispatching-parallel-agents)
Phase 2: Specification      → opsx:propose
Phase 3: Detailed Plan      → superpowers:writing-plans
Phase 4: Team Assembly      → TeamCreate + spawn teammates
Phase 5: Implementation     → Agent Teams + TDD + systematic-debugging + code review
Phase 6: Verification       → superpowers:verification-before-completion
Phase 7: Finish & Archive   → opsx:archive + git diff suggestions (NO commits)
```

---

### Phase 0 — Worktree Setup (optional)

Use when working on a feature that needs isolation from current workspace,
or when developing multiple features simultaneously.

Invoke `superpowers:using-git-worktrees`
- Creates an isolated git workspace for this feature branch
- Pairs with Phase 7 cleanup (worktree is removed at the end)
- Skip if the work is minor or isolation is not needed

---

### Phase 1 — Discovery (choose one)

**If the idea is vague or needs design exploration:**
Invoke `superpowers:brainstorming`
- Produces: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- **IMPORTANT OVERRIDE**: Do NOT follow brainstorming's default transition to writing-plans. Proceed to Phase 2 (`opsx:propose`) first, then Phase 3.

**If the problem is technically clear but complex:**
Invoke `opsx:explore`
- No formal artifact output — pure exploratory thinking only.

**If multiple independent hypotheses must be investigated in parallel:**
Invoke `superpowers:dispatching-parallel-agents`
- One subagent per independent problem domain
- Subagents report findings back; synthesize before moving to Phase 2

> Discovery is a thinking-only phase. Regardless of which tool is used, all three OpenSpec documents must still be created at Phase 2.

---

### Phase 2 — Specification (always required)

Invoke `opsx:propose`
- Generates `openspec/changes/<name>/proposal.md` (what & why)
- Generates `openspec/changes/<name>/design.md` (how — architecture, interfaces, data flow)
- Generates `openspec/changes/<name>/tasks.md` (high-level implementation tasks)

**Guardrail: No production code may be written until all three artifacts exist.**

If `brainstorming` was used in Phase 1, the design doc at `docs/superpowers/specs/` should inform the content of `proposal.md` and `design.md`.

---

### Phase 3 — Detailed Implementation Plan

Invoke `superpowers:writing-plans`
- Input: OpenSpec artifacts from Phase 2 (and brainstorming design doc if it exists)
- Output: `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
- Content: exact file paths, failing test code, implementation code, commit steps per task

---

### Phase 4 — Team Assembly

Use `TeamCreate` to create the team, then spawn teammates based on the Role Selection Matrix below.

**Code Reviewer is required whenever a Full-Stack Engineer is present.**
The Code Reviewer reviews code quality via SendMessage after each REFACTOR step.
The Code Reviewer does NOT invoke `superpowers:requesting-code-review` — that skill spawns a nested agent, which is forbidden in Agent Teams.

**Skill invocation rules for teammates:**
- ✅ Safe (methodology only): `superpowers:systematic-debugging`, `superpowers:receiving-code-review`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`
- ❌ Forbidden (spawns nested agents): `superpowers:requesting-code-review`, `superpowers:dispatching-parallel-agents`

| Task Type | Roles |
|-----------|-------|
| UI feature development | Full-Stack + UI/UX + QA + Code Reviewer |
| Backend-only feature | Full-Stack + QA + Code Reviewer |
| Bug fix | Full-Stack + QA + Code Reviewer |
| Large cross-layer feature | PM + UI/UX + Full-Stack + QA + Code Reviewer + Tech Lead |

**QA and Code Reviewer are complementary, not redundant:**
- QA: "Does the software behave correctly?" — browser testing, Playwright, regression checks
- Code Reviewer: "Is the code well-written?" — spec compliance, patterns, architecture

---

### Phase 5 — Implementation

Dispatch tasks from the `writing-plans` output using **Claude Code Agent Teams** (NOT subagents).

**Iron Law: No production code without a failing test first. No exceptions.**

**TDD + Review Cycle per task:**

1. **RED** — Write a failing test. Run it. Confirm it fails because the feature is missing (not due to a typo).
   - If it fails for an **unexpected reason** (not "feature missing"): invoke `superpowers:systematic-debugging` before proposing any fix. Root cause first, no exceptions.
2. **GREEN** — Write the minimal code to make the test pass. Nothing extra.
3. **REFACTOR** — Clean up. Keep tests green. Do not add behavior.
4. **CODE REVIEW** (Code Reviewer is always present when Full-Stack is developing):
   - Engineer sends task summary + diff to Code Reviewer via `SendMessage`
   - Code Reviewer reviews directly (does NOT invoke `requesting-code-review` — that spawns a nested agent)
   - Engineer invokes `superpowers:receiving-code-review` upon receiving feedback (methodology skill, safe)
   - Evaluate feedback technically — verify before implementing suggestions
5. Mark completion in **both** documents:
   - `openspec/changes/<name>/tasks.md` — mark the high-level task `- [x]`
   - `docs/superpowers/plans/YYYY-MM-DD-<name>.md` — mark each completed step `- [x]`
   Move to next task.

---

### Phase 6 — Verification

Before claiming any task or phase is complete, invoke `superpowers:verification-before-completion`:

- Run the relevant verification command and read the full output
- Tests: confirm 0 failures
- Build: confirm exit 0
- Requirements: re-read `tasks.md` line by line

Using "should work", "looks correct", or "seems fine" without running verification is **not acceptable**.

---

### Phase 7 — Finish & Archive

1. Gracefully shut down all teammates:
   ```
   SendMessage({ type: "shutdown_request" }) to each teammate
   ```
   Wait for all teammates to shut down before proceeding.

2. Call `TeamDelete` to clean up team resources.

3. Invoke `opsx:archive` (if this project uses OpenSpec)
   - Sync delta specs from `openspec/changes/<name>/specs/` → `openspec/specs/<capability>/spec.md`
   - Skip if project does not use OpenSpec

4. **Worktree cleanup** (only if Phase 0 was used):
   ```bash
   git worktree list   # confirm which worktree to remove
   git worktree remove <worktree-path>
   ```

5. **[REQUIRED] Present changes for user review — read-only git, no commits:**
   - Run `git diff HEAD` (or `git diff` if nothing staged) — read the full output
   - Run `git status` to see all changed/untracked files
   - Based on the diff, generate one or more **commit message suggestions** with:
     - A concise subject line (≤72 chars, conventional commits format)
     - A body section explaining what changed and why
   - Present all suggestions to the user
   - **Stop here. Wait for the user to decide whether to commit, push, or open a PR.**
   - Do NOT call `superpowers:finishing-a-development-branch`

---

## Key Rules

- **Rule 0** — No history-modifying git operations during Phases 0–6 (overrides all skills)
- **Rule 1** — 1% rule: invoke any possibly-applicable skill before acting or responding
- **Rule 2** — Spec first: no production code without `proposal.md` + `design.md` + `tasks.md`
- **Rule 7** — Spec is law: do not deviate from `design.md` without updating it first
- **Rule 8** — Verify before done: no success claims without running the verification command
- **Rule 9** — Always sync delta specs on archive
