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

- WHAT (behavior, interfaces, acceptance criteria — permanent, archived) → **OpenSpec**
- HOW + WHY (design reasoning, implementation steps — session artifacts) → **Superpowers**

When recording a decision, ask: *what the system does* (→ OpenSpec) or *how/why we built it this way* (→ Superpowers).

---

## Skill Invocation Rule (1% Rule)

If there is even a **1% chance** a skill might apply, you **MUST** invoke it before any action or response.

---

## Full Development Workflow

```
Phase 0: Domain Triage         → read openspec/specs/, classify A/B/C1/C2
                                  Path A: skip to Phase 4 (TDD only)
                                  Path B: full flow Phase 1 → 6
                                  Path C1: spec patch + Phase 4
                                  Path C2: full flow with spec rewrite
                                  STOP: confirm routing with user
Phase 1: Discovery             → superpowers:brainstorming
                                  vague: full exploration | clear: confirmation mode
                                  Produces: docs/superpowers/specs/ + docs/superpowers/plans/
Phase 2: Specification         → opsx:propose
--- Pre-Implementation Gate: Select Development Mode ---
Phase 3: Team Assembly         → TeamCreate + spawn teammates  [Option A only]
Phase 4: Implementation        → Agent Teams OR parallel-agents
Phase 5: Verification          → superpowers:verification-before-completion
Phase 6: Finish & Archive      → opsx:archive + git diff suggestions (NO commits)
```

---

### Phase 0 — Domain Triage

**Runs before every task. Determines whether/how OpenSpec applies.**

1. **Read existing domain context:**
   - `ls openspec/specs/` — list all capabilities
   - For each capability whose name relates to the request: read `openspec/specs/<capability>/spec.md` in full
   - If `openspec/specs/` does not exist yet: classify as Path B by default

2. **Classify the request:**

| Path | Criteria | Routing |
|------|----------|---------|
| **A — Non-domain** | Behavior unchanged from spec. Internal only: bug fix that doesn't alter user-visible behavior, refactor, dep upgrade, perf, typo. | Skip Phase 1 + 2 + 3 → Phase 4 (TDD) |
| **B — New/changed domain** | New feature OR existing feature behavior change. Existing spec doesn't cover, or needs extension. | Full Phase 1 → 2 → 3 (Gate) → 4 → 5 → 6 |
| **C1 — Spec inline patch** | Bug reveals existing spec is wrong/outdated. Fix scoped within one capability's spec. | Patch `openspec/specs/<cap>/spec.md` (with sub-STOP) → Phase 4 |
| **C2 — Spec rewrite** | Spec conflicts with required behavior. Rewrite scope non-trivial. | Full flow, but Phase 1 must cite the existing spec being replaced |

3. **STOP — present routing decision to the user:**

   ```
   Phase 0 Triage Result:
     Request type:     [bug fix / feature / refactor / dep upgrade / etc]
     Specs consulted:  [list of openspec/specs/*/spec.md read]
     Conflicts:        [N detected | none]

     [Conflict #1] (if any)
       File:          openspec/specs/<capability>/spec.md
       Section:       ## <section name>  (lines X–Y)
       Spec says:     "<verbatim quote of the spec text>"
       Code behavior: "<description of what code currently does>"
       Difference:    <one-sentence explanation of divergence>
       Suggested:     [C1 inline patch | C2 rewrite | request disclaimer]

     [Conflict #2, #3, ...]

     Proposed routing: Path [A | B | C1 | C2]
     Reasoning:        [2-3 sentences, reference conflict #s if applicable]

   Confirm? (yes / override to [A/B/C1/C2] / clarify)
   ```

4. **STOP: Do NOT proceed until the user confirms or overrides.**

5. **For Path C1 only — sub-STOP before applying spec patch:**
   - Present diff (before/after) of proposed `openspec/specs/<cap>/spec.md` change
   - Wait for user `apply` / `revise` / `cancel`
   - Do NOT modify spec file until user says `apply`

**Conservative default:** When path is ambiguous (A↔B or C1↔C2), prefer the more spec-heavy path (B over A, C2 over C1). Better to write extra spec than to silently drift.

**Multi-capability rule:** If multiple capabilities are affected, take the most spec-heavy classification across all (e.g., A + C1 → C1).

**Conflict-but-user-wants-Path-A escape hatch:**

If Path A is the proposed routing AND Phase 0 detected a spec conflict, the LLM MUST refuse to proceed as Path A silently.

To override, the user must explicitly state ONE of:
- `Switch to Path C1` — acknowledge spec needs updating, do it now
- `Switch to Path C2` — full spec rewrite warranted
- `Spec maintenance is my responsibility for this task` — explicit disclaimer

Behavior:
- Without one of these phrases, Phase 0 stays blocked.
- If user invokes the disclaimer, proceed as Path A AND record the deferred conflict. At Phase 6 commit message suggestions, prepend:
  `⚠️ Deferred spec conflict: § <section> of <capability>/spec.md (user accepted responsibility on YYYY-MM-DD).`

**Phase 1/B/C2 requirement:** Phase 1 brainstorming must read all consulted specs and reference them in the design doc. No "blank canvas" design when relevant specs exist.

---

### Phase 1 — Discovery

Always invoke `superpowers:brainstorming`.

- **Vague requirements** — full exploration: clarifying questions, 2–3 approaches with tradeoffs, design sections with user approval gates.
- **Clear requirements** — confirmation: confirm scope/constraints, present concise spec for sign-off, skip deep exploration.

**Produces (both modes):**
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (auto-invoked at brainstorming end)

**[OVERRIDE]** Do NOT follow brainstorming's default transition to executing-plans or subagent-driven-development. Proceed to Phase 2.

---

### Phase 2 — Specification

Invoke `opsx:propose`.

Treat the Phase 1 `design.md` as **source of truth**. Do not re-derive design decisions — formalize what was already decided into OpenSpec format.

**Spec → OpenSpec Mapping** (mechanical translation, no new decisions):

| Source (Phase 1 `design.md` / writing-plans output) | Target (Phase 2 OpenSpec file) |
|-----------------------------------------------------|--------------------------------|
| Problem statement / what we're solving | `proposal.md` § Why |
| Proposed solution / scope | `proposal.md` § What Changes |
| Out of scope | `proposal.md` § Non-goals |
| Open questions (still unresolved after Phase 1) | `proposal.md` § Open Questions |
| Design decisions / context | `design.md` § Context + § Decision |
| Tradeoffs / alternatives considered | `design.md` § Alternatives Considered |
| Acceptance criteria | `openspec/changes/<name>/specs/<capability>/spec.md` § Requirements |
| Implementation phases (writing-plans) | `tasks.md` (1:1, numbered) |

**Rule: Phase 2 is translation, not design.** If a target field has no source content, return to Phase 1 to fill the gap. Do NOT invent content in Phase 2.

**Produces:**
- `openspec/changes/<name>/proposal.md` — aligned with brainstorming spec
- `openspec/changes/<name>/design.md` — aligned with brainstorming spec
- `openspec/changes/<name>/tasks.md` — aligned with writing-plans task list

**Guardrail: No production code until all five artifacts exist:**
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (Phase 1)
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (Phase 1)
- `openspec/changes/<name>/proposal.md` (Phase 2)
- `openspec/changes/<name>/design.md` (Phase 2)
- `openspec/changes/<name>/tasks.md` (Phase 2)

---

### Pre-Implementation Gate

After Phase 2 completes, **STOP and present three options to the user:**

- **A. Agent Teams** (`TeamCreate`) — features needing role specialization (Full-Stack + QA + Code Reviewer) → Phase 3
- **B. Parallel Agents** (`superpowers:dispatching-parallel-agents`) — `tasks.md` has independent clusters → skip Phase 3, go to Phase 4
- **C. Revise** — re-run Phase 1, then Phase 2, then return here

**STOP: Do NOT proceed until the user selects an option.**

---

### Phase 3 — Team Assembly *(Option A only)*

Use `TeamCreate`, then spawn teammates per the matrix below. **Code Reviewer is required whenever a Full-Stack Engineer is present.** The Code Reviewer reviews via `SendMessage` after each REFACTOR step.

| Task Type | Roles |
|-----------|-------|
| UI feature | Full-Stack + UI/UX + QA + Code Reviewer |
| Backend-only | Full-Stack + QA + Code Reviewer |
| Bug fix (Path B/C2 only) | Full-Stack + QA + Code Reviewer |
| Large cross-layer | PM + UI/UX + Full-Stack + QA + Code Reviewer + Tech Lead |

**Teammate skill rules:**
- ✅ Safe (methodology only): `systematic-debugging`, `receiving-code-review`, `test-driven-development`, `verification-before-completion`
- ❌ Forbidden (spawns nested agents): `requesting-code-review`, `dispatching-parallel-agents`

**QA vs Code Reviewer (complementary, not redundant):**
- QA — *behavior*: browser tests, Playwright, regressions
- Code Reviewer — *code quality*: spec compliance, patterns, architecture

---

### Phase 4 — Implementation

**Iron Law: No production code without a failing test first. No exceptions.**

| Step | Option A (Agent Teams) | Option B (Parallel Agents) |
|------|------------------------|----------------------------|
| Dispatch | Claude Code Agent Teams (NOT subagents) | `superpowers:dispatching-parallel-agents` — one subagent per independent cluster |
| RED | Failing test. If fails for *unexpected* reason → invoke `superpowers:systematic-debugging` first (root cause before any fix) | Same |
| GREEN | Minimal code to pass. Nothing extra. | Same |
| REFACTOR | Clean up, tests stay green, no new behavior | Same |
| Code Review | Engineer → `SendMessage` task summary + diff to Code Reviewer (Reviewer does NOT invoke `requesting-code-review`); engineer invokes `superpowers:receiving-code-review` on feedback; verify before implementing suggestions | Inline review by subagent (no formal Code Reviewer role) |
| Mark complete | `tasks.md` task `- [x]` **AND** `plans/YYYY-MM-DD-<name>.md` step `- [x]` | Same; subagent marks both upon cluster done |

For Option B: synthesize all subagent reports before Phase 5.

---

### Phase 5 — Verification

Before claiming any task or phase complete, invoke `superpowers:verification-before-completion`:

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
