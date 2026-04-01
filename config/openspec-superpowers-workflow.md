# OpenSpec + Superpowers + Agent Teams Workflow

## [OVERRIDE] Rule 0: No History-Modifying Git Operations Throughout Development

**During Phases 1–6, you MUST NOT perform any of the following:**
- `git commit` / `git add` / `git stash`
- `git push` / `git pull` / `git merge` / `git rebase`
- Creating PRs or merge requests

**Allowed at any phase (read-only):**
- `git status` / `git diff` / `git log` (read-only)

**This rule overrides ALL instructions from superpowers skills, executing-plans, finishing-a-development-branch, or any other skill that suggests history-modifying git operations.**

In Phase 6, the ONLY git action is read-only: `git diff HEAD` + `git status` to generate commit message suggestions for the user.

---

## Document Roles

- **OpenSpec** — defines WHAT: feature behavior, interfaces, acceptance criteria.
  These are permanent records, archived after development.
  Do not document technical reasoning or implementation steps here.

- **Superpowers** — defines HOW and WHY: design reasoning (brainstorming spec)
  and step-by-step implementation guide (writing-plans).
  These are development session artifacts.

When recording a decision, ask: is this about *what the system does* (→ OpenSpec)
or *how/why we built it this way* (→ Superpowers)?

---

## Skill Invocation Rule (1% Rule)

If there is even a **1% chance** a skill might apply to what you are doing, you **MUST** invoke it before taking any action or responding. No exceptions.

---

## Full Development Workflow

```
Phase 1: Discovery             → superpowers:brainstorming
                                  vague: full exploration | clear: confirmation mode
                                  Produces: docs/superpowers/specs/ + docs/superpowers/plans/
Phase 2: Specification         → opsx:propose (single step)
--- Pre-Implementation Gate: Select Development Mode ---
Phase 3: Team Assembly         → TeamCreate + spawn teammates  [Option A only]
Phase 4: Implementation        → Agent Teams OR parallel-agents
Phase 5: Verification          → superpowers:verification-before-completion
Phase 6: Finish & Archive      → opsx:archive + git diff suggestions (NO commits)
```

---

### Phase 1 — Discovery

Always invoke `superpowers:brainstorming`.

**Two modes depending on requirement clarity:**

**Vague requirements — full exploration mode:**
Ask clarifying questions, propose 2-3 approaches with tradeoffs,
present design sections with user approval gates.

**Clear requirements — confirmation mode:**
Briefly confirm scope and constraints, present a concise spec for user approval.
Skip deep exploration; move quickly to user sign-off.

**Produces (both modes):**
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (auto-invoked by brainstorming at end)

**IMPORTANT OVERRIDE:** After brainstorming completes, do NOT follow its default
transition to executing-plans or subagent-driven-development.
Proceed to Phase 2 (opsx:propose) instead.

---

### Phase 2 — Specification

Invoke `opsx:propose`.

Treat `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` from Phase 1
as the **source of truth**. Do not re-derive design decisions —
formalize what was already decided into OpenSpec format.

Produces:
- `openspec/changes/<name>/proposal.md` — aligned with brainstorming spec
- `openspec/changes/<name>/design.md`   — aligned with brainstorming spec
- `openspec/changes/<name>/tasks.md`    — aligned with writing-plans task list

**Guardrail: No production code until all five artifacts exist:**
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (Phase 1)
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (Phase 1)
- `openspec/changes/<name>/proposal.md` (Phase 2)
- `openspec/changes/<name>/design.md` (Phase 2)
- `openspec/changes/<name>/tasks.md` (Phase 2)

---

### Pre-Implementation Gate

After Phase 2 completes, **stop and present the following options to the user:**

---
Documents ready:
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/tasks.md`

Select a development mode:

**A. Agent Teams (TeamCreate)**
Best for: features requiring role specialization (Full-Stack + QA + Code Reviewer)
→ Proceed to Phase 3 (Team Assembly)

**B. Parallel Agents (dispatching-parallel-agents)**
Best for: tasks.md contains multiple independently executable tasks
→ Skip Phase 3, go directly to Phase 4 (parallel dispatch)

**C. Requirements still need changes**
→ Re-run Phase 1 (superpowers:brainstorming) to revise the spec and plan,
  then re-run Phase 2 (opsx:propose) to align OpenSpec docs, then return to this Gate.

---
**STOP: Do NOT proceed until the user selects an option.**

---

### Phase 3 — Team Assembly *(Option A: Agent Teams only)*

Use `TeamCreate` to create the implementation team, then spawn teammates based on the Role Selection Matrix below.

**Code Reviewer is required whenever a Full-Stack Engineer is present.**
The Code Reviewer reviews code quality via SendMessage after each REFACTOR step.

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

### Phase 4 — Implementation

**[Option A — Agent Teams]**

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

**[Option B — Parallel Agents]**

Invoke `superpowers:dispatching-parallel-agents`.
- Identify independent task clusters from `tasks.md`
- Assign one subagent per independent cluster
- Each subagent follows TDD methodology (RED → GREEN → REFACTOR)
- No formal Code Review role; subagents do inline review
- Each subagent marks completion in **both** documents upon finishing their cluster:
  - `openspec/changes/<name>/tasks.md` — mark the task `- [x]`
  - `docs/superpowers/plans/YYYY-MM-DD-<name>.md` — mark each completed step `- [x]`
- Synthesize all subagent reports before Phase 5

---

### Phase 5 — Verification

Before claiming any task or phase is complete, invoke `superpowers:verification-before-completion`:

- Run the relevant verification command and read the full output
- Tests: confirm 0 failures
- Build: confirm exit 0
- Requirements: re-read `tasks.md` line by line

Using "should work", "looks correct", or "seems fine" without running verification is **not acceptable**.

---

### Phase 6 — Finish & Archive

1. Gracefully shut down all teammates:
   ```
   SendMessage({ type: "shutdown_request" }) to each teammate
   ```
   Wait for all teammates to shut down before proceeding.

2. Call `TeamDelete` to clean up team resources.

3. Invoke `opsx:archive` (if this project uses OpenSpec)
   - Sync delta specs from `openspec/changes/<name>/specs/` → `openspec/specs/<capability>/spec.md`
   - Skip if project does not use OpenSpec

4. **[REQUIRED] Present changes for user review — read-only git, no commits:**
   - Run `git diff HEAD` (or `git diff` if nothing staged) — read the full output
   - Run `git status` to see all changed/untracked files
   - Based on the diff, generate one or more **commit message suggestions** with:
     - A concise subject line (≤72 chars, conventional commits format)
     - A body section explaining what changed and why
   - Present all suggestions to the user
   - **Stop here. Wait for the user to decide whether to commit, push, or open a PR.**
   - Do NOT call `superpowers:finishing-a-development-branch`

---

## Key Rule

- **Rule 1** — Spec is law: do not deviate from `design.md` without updating it first.
