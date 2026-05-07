# OpenSpec + Superpowers + Agent Teams Workflow

## [OVERRIDE] Rule 0: No History-Modifying Git Operations Throughout Development

**During Phases 1–6, you MUST NOT perform any of the following:**
- `git commit` / `git add` / `git stash`
- `git push` / `git pull` / `git merge` / `git rebase`
- Creating PRs or merge requests

**Allowed at any phase (read-only):**
- `git status` / `git diff` / `git log` (read-only)

**Overrides any skill that suggests history-modifying git ops.** In Phase 6, the ONLY git action is read-only: `git diff HEAD` + `git status` to generate commit message suggestions for the user.

---

## Document Roles

OpenSpec owns **domain knowledge** (permanent, archived). Superpowers owns **code knowledge** (session artifacts, ephemeral). The split:

| Content | Owner | Lives in |
|---------|-------|----------|
| **WHAT** the system does (behavior, interfaces, acceptance criteria) | OpenSpec | `openspec/changes/<name>/specs/<capability>/spec.md` § Requirements |
| **WHY this behavior exists** (product reason, business motivation) | OpenSpec | `openspec/changes/<name>/proposal.md § Why` |
| **WHY this behavior is shaped this way** (domain decisions, behavior alternatives) | OpenSpec | `openspec/changes/<name>/design.md § Context` + `§ Decision` |
| **WHY this code architecture** (library choice, file boundaries, technical patterns) | Superpowers | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| **HOW to build it** (TDD steps, exact code, exact commands) | Superpowers | `docs/superpowers/plans/YYYY-MM-DD-<name>.md` |

---

## Full Development Workflow

```
Phase 0: Domain Triage         → read openspec/specs/, classify code-only/new-feature/spec-patch/spec-rewrite/retro-doc
                                  code-only: skip to Phase 4 (TDD) → Phase 5 (Level 1 only) → Phase 6 (skip archive)
                                  new-feature: full flow Phase 1 → 6
                                  spec-patch: spec patch + Phase 4 → Phase 5 (Level 1 + patched behavior) → Phase 6 (skip archive)
                                  spec-rewrite: full flow with spec rewrite (also: requirement-modification by product)
                                  retro-doc: code-first → D-0/D-1/D-2/D-4 → standard Phase 5/6 (see retro-doc section)
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
   - If `openspec/specs/` does not exist yet: classify as new-feature by default

2. **Classify the request:**

| Path | Criteria | Routing |
|------|----------|---------|
| **code-only** | Behavior unchanged from spec. Internal only: bug fix that doesn't alter user-visible behavior, refactor, dep upgrade, perf, typo. | Skip Phase 1 + 2 + 3 → Phase 4 (TDD) → Phase 5 (Level 1 only) → Phase 6 (skip archive) |
| **new-feature** | New feature OR existing feature behavior change. Existing spec doesn't cover, or needs extension. | Full Phase 1 → 2 → 3 (Gate) → 4 → 5 → 6 |
| **spec-patch** | Bug reveals existing spec is wrong/outdated. Fix scoped within one capability's spec. | Patch `openspec/specs/<cap>/spec.md` (with sub-STOP) → Phase 4 → Phase 5 (Level 1 + patched behavior) → Phase 6 (skip archive) |
| **spec-rewrite** | Spec needs rewrite — either (a) spec **conflicts** with required behavior (bug-driven), OR (b) requirement itself is being **modified by product decision** (intentional behavior change). Rewrite scope non-trivial. | Full flow, but Phase 1 must cite the existing spec being replaced |
| **retro-doc** | **Code already exists** (legacy, hot-fix, merged from elsewhere, prototype-now-document-later) but no `openspec/changes/<name>/` was created. Goal: reverse-engineer docs from code. | retro-doc flow: D-0 → D-1 → D-2 → D-4 → standard Phase 5 → 6 (see retro-doc section below) |

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
       Suggested:     [spec-patch | spec-rewrite | request disclaimer]

     [Conflict #2, #3, ...]

     Proposed routing: Path [code-only | new-feature | spec-patch | spec-rewrite | retro-doc]
     Reasoning:        [2-3 sentences, reference conflict #s if applicable]

   Confirm? (yes / override to [code-only/new-feature/spec-patch/spec-rewrite/retro-doc] / clarify)
   ```

**retro-doc selection rule:** retro-doc is **opt-in only** — LLM does not auto-classify into retro-doc. Choose retro-doc only when the user explicitly states the code already exists and they want documentation generated retroactively. code-only/new-feature/spec-patch/spec-rewrite remain the auto-classification options for forward-direction work.

4. **For spec-patch only — sub-STOP before applying spec patch:**
   - Present diff (before/after) of proposed `openspec/specs/<cap>/spec.md` change
   - Wait for user `apply` / `revise` / `cancel`
   - Do NOT modify spec file until user says `apply`

**Conservative default:** When path is ambiguous (code-only↔new-feature or spec-patch↔spec-rewrite), prefer the more spec-heavy path (new-feature over code-only, spec-rewrite over spec-patch). Better to write extra spec than to silently drift. **retro-doc is orthogonal** (it concerns timing — code-first vs spec-first — not scope) and not subject to conservative defaults.

**Multi-capability rule:** If multiple capabilities are affected, take the most spec-heavy classification across all (e.g., code-only + spec-patch → spec-patch).

**Conflict-but-user-wants-code-only escape hatch:**

If code-only is the proposed routing AND Phase 0 detected a spec conflict, the LLM MUST refuse to proceed as code-only silently.

To override, the user must explicitly state ONE of:
- `Switch to spec-patch` — acknowledge spec needs updating, do it now
- `Switch to spec-rewrite` — full spec rewrite warranted
- `Spec maintenance is my responsibility for this task` — explicit disclaimer

Behavior:
- Without one of these phrases, Phase 0 stays blocked.
- If user invokes the disclaimer, proceed as code-only AND record the deferred conflict. At Phase 6 commit message suggestions, prepend:
  `⚠️ Deferred spec conflict: § <section> of <capability>/spec.md (user accepted responsibility on YYYY-MM-DD).`

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

**Spec → OpenSpec Mapping** (translation by layer — domain only; code-layer content stays in Superpowers and is referenced):

| Source (Phase 1 `design.md` / writing-plans output) | Target (Phase 2 OpenSpec file) | Layer |
|-----------------------------------------------------|--------------------------------|-------|
| Problem statement / what we're solving | `proposal.md` § Why | domain |
| Proposed solution / scope | `proposal.md` § What Changes | domain |
| Out of scope | `proposal.md` § Non-goals | domain |
| Open questions (still unresolved after Phase 1) | `proposal.md` § Open Questions | domain |
| **Domain** decisions (behavior shape, scope choices, user-facing outcomes) | `design.md` § Context + § Decision | domain |
| Behavior alternatives considered (different shapes the feature could take) | `design.md` § Alternatives Considered | domain |
| Acceptance criteria | `openspec/changes/<name>/specs/<capability>/spec.md` § Requirements | domain |
| **Acceptance milestones** (one per user-visible behavior, NOT one per TDD step) | `tasks.md` (milestone-level) | domain |
| **Architecture** decisions (file structure, library choice, technical patterns) | (stays in `docs/superpowers/specs/...-design.md` — reference from OpenSpec `design.md § Context` with one line: *"See `<superpowers path>` § Architecture for code-level design"*) | code |
| TDD steps (RED / GREEN / REFACTOR) | (stays in `docs/superpowers/plans/...` — NEVER copied to OpenSpec) | code |

**Rule 1: Phase 2 is translation, not new design.** If a target field has no source content, return to Phase 1 to fill the gap. Do NOT invent content in Phase 2.

**Rule 2: Phase 2 translates the domain layer only.** Code-layer content (architecture rationale, library choices, file boundaries, TDD steps) stays in Superpowers files. OpenSpec references them with a single line; never duplicates.

**Rule 3: `tasks.md` condense to milestones, not steps.** A plan with 25 TDD steps typically maps to ~5 acceptance milestones. Each milestone must be:
- A user-visible outcome that QA can verify in Phase 5 (e.g., "User can click Export CSV button on user list page")
- NOT a developer-facing action (e.g., "Step 1: Write failing test for ExportButton" — wrong granularity)

**Produces:**
- `openspec/changes/<name>/proposal.md` — aligned with brainstorming spec
- `openspec/changes/<name>/design.md` — aligned with brainstorming spec
- `openspec/changes/<name>/specs/<capability>/spec.md` — acceptance criteria as Requirements (one file per affected capability)
- `openspec/changes/<name>/tasks.md` — aligned with writing-plans task list

**Guardrail: No production code until all six artifacts exist:**
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (Phase 1)
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (Phase 1)
- `openspec/changes/<name>/proposal.md` (Phase 2)
- `openspec/changes/<name>/design.md` (Phase 2)
- `openspec/changes/<name>/specs/<capability>/spec.md` (Phase 2 — at least one capability)
- `openspec/changes/<name>/tasks.md` (Phase 2)

**Block scope:** Guardrail applies **globally** — if multiple `openspec/changes/<name>/` exist and any is incomplete, ALL production code edits are blocked. Close out stale changes via `opsx:archive` before starting new work.

---

### Pre-Implementation Gate

After Phase 2 completes, **STOP and present three options to the user:**

- **A. Agent Teams** (`TeamCreate`) — features needing role specialization (Full-Stack + QA + Code Reviewer) → Phase 3
- **B. Parallel Agents** (`superpowers:dispatching-parallel-agents`) — Phase 1 `plans/...md` Tasks are mostly independent (no shared state, no sequential dependencies between Tasks) → skip Phase 3, go to Phase 4. Note: independence is judged at the `plans/` Task level, NOT the `tasks.md` milestone level (one milestone may require multiple plan Tasks).
- **C. Revise** — re-run Phase 1, then Phase 2, then return here

**STOP: Do NOT proceed until the user selects an option.**

---

### Phase 3 — Team Assembly *(Option A only)*

Use `TeamCreate`, then spawn teammates per the matrix below. **Code Reviewer is required whenever a Full-Stack Engineer is present.** The Code Reviewer reviews via `SendMessage` after each REFACTOR step.

| Task Type | Roles |
|-----------|-------|
| UI feature | Full-Stack + UI/UX + QA + Code Reviewer |
| Backend-only | Full-Stack + QA + Code Reviewer |
| Bug fix (new-feature/spec-rewrite only) | Full-Stack + QA + Code Reviewer |
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

**Path applicability:** Iron Law and TDD loop apply to paths code-only / new-feature / spec-patch / spec-rewrite. code-only and spec-patch skip the `plans/...md` and `tasks.md` rows below (those files don't exist for those paths) — track progress via failing test → passing test transitions only. **retro-doc inverts the Iron Law** (code already exists; tests serve to characterize, not drive) and uses Phase D-4 (Test backfill) instead of standard Phase 4 — see retro-doc section below.

| Step | Option A (Agent Teams) | Option B (Parallel Agents) |
|------|------------------------|----------------------------|
| Dispatch | Claude Code Agent Teams (NOT subagents) | `superpowers:dispatching-parallel-agents` — one subagent per independent cluster |
| RED | Failing test. If fails for *unexpected* reason → invoke `superpowers:systematic-debugging` first (root cause before any fix) | Same |
| GREEN | Minimal code to pass. Nothing extra. | Same |
| REFACTOR | Clean up, tests stay green, no new behavior | Same |
| Code Review | Engineer → `SendMessage` task summary + diff to Code Reviewer (Reviewer does NOT invoke `requesting-code-review`); engineer invokes `superpowers:receiving-code-review` on feedback; verify before implementing suggestions | Inline review by subagent (no formal Code Reviewer role) |
| Mark complete | Mark `plans/YYYY-MM-DD-<name>.md` step `- [x]` immediately after each TDD step verifies. Do **NOT** mark `tasks.md` here — milestones are marked in Phase 5 after acceptance verification. | Same; subagent marks only plan steps. |

For Option B: synthesize all subagent reports before Phase 5.

---

### Phase 5 — Verification

Before claiming any task or phase complete, invoke `superpowers:verification-before-completion`. Verification happens at **two distinct levels**.

**Path applicability:**

| Path | Level 1 (code) | Level 2 (acceptance) |
|------|----------------|----------------------|
| **code-only** | Required | **Skipped** — no domain change to verify against; `git diff` review + manual smoke is sufficient |
| **new-feature / spec-rewrite** | Required | Required — run scenario per `tasks.md` milestone, mark `- [x]`; trace every spec Requirement to a verified milestone |
| **spec-patch** | Required | Required — run scenario for the patched behavior in `openspec/specs/<cap>/spec.md`; no `tasks.md` to mark |
| **retro-doc** | Already satisfied by D-4 (all Requirements have passing tests) | Follow new-feature rules (retro-as-new-feature) or spec-rewrite rules (retro-as-spec-rewrite) per Phase D-0 sub-classification |

**Level 1: Code-level (continuous, during Phase 4) — applies to all paths**

- Tests: run the suite, read full output, confirm 0 failures
- Build: confirm exit 0
- Lint / type-check: confirm clean (if project enforces them)
- (new-feature / spec-rewrite only) All `plans/...md` steps marked `- [x]`

**Level 2: Acceptance-level (gate before Phase 6) — applies to new-feature / spec-patch / spec-rewrite**

For each acceptance unit (new-feature/spec-rewrite: every `tasks.md` milestone; spec-patch: every behavior changed in the spec patch), run the actual user-facing scenario:

- **UI features**: open browser, perform the user action, observe outcome with your own eyes (or via E2E tooling). For this plugin, prefer `e2e:run` if specs exist, or `e2e:create` to scaffold them.
- **Backend / API features**: hit the actual endpoint with realistic inputs (curl / httpie / postman / integration test against running service)
- **Library / utility features**: invoke the function from a fresh REPL or scratch script with the exact inputs a user would use

**Mark + trace (path-specific):**

- *new-feature / C2*: mark `tasks.md` milestone `- [x]` only after the scenario passes. Then re-read `openspec/changes/<name>/specs/<capability>/spec.md` § Requirements line by line — every requirement must trace to a verified milestone. Any orphan requirement = Phase 5 not done.
- *spec-patch*: re-read the patched section of `openspec/specs/<cap>/spec.md` § Requirements — every patched line must trace to a verified scenario.

**Hard rule:** Avoid hand-waving language ("should work", "looks correct", "tests passed so it works") for Level 2 — unit tests prove code does what the test says, not what the user needs. Phase 5 is the only place to catch that gap before Phase 6 archives the spec.

---

### Phase 6 — Finish & Archive

**Path applicability:**

| Step | When it runs | code-only | new-feature | spec-patch | spec-rewrite | retro-doc |
|------|--------------|--------|--------|---------|---------|--------|
| 1. Shutdown teammates | only if Phase 3 ran (Option A) | conditional | conditional | conditional | conditional | **skip** (D never invokes Phase 3) |
| 2. `TeamDelete` | only if Phase 3 ran (Option A) | conditional | conditional | conditional | conditional | **skip** |
| 3. `opsx:archive` | only if `openspec/changes/<name>/` exists | **skip** | run | **skip** | run | **run** |
| 4. Read-only diff + commit suggestions | always | run | run | run | run | run |

**Steps:**

1+2. *(If Phase 3 ran)* `SendMessage({ type: "shutdown_request" })` to each teammate, wait for shutdown, then `TeamDelete`.

3. *(new-feature / spec-rewrite)* Invoke `opsx:archive` — sync delta specs from `openspec/changes/<name>/specs/` → `openspec/specs/<capability>/spec.md`.

4. **[REQUIRED — all paths] Present changes for user review — read-only git, no commits:**
   - Run `git diff HEAD` (or `git diff` if nothing staged) — read the full output
   - Run `git status` to see all changed/untracked files
   - Based on the diff, generate one or more **commit message suggestions** with:
     - A concise subject line (≤72 chars, conventional commits format)
     - A body section explaining what changed and why
     - **Deferred-conflict prefix (from Phase 0 escape hatch):** if the user invoked `Spec maintenance is my responsibility for this task`, prepend the body of every suggestion with: `⚠️ Deferred spec conflict: § <section> of <capability>/spec.md (user accepted responsibility on YYYY-MM-DD).`
   - Present all suggestions to the user
   - **Stop here. Wait for the user to decide whether to commit, push, or open a PR.**
   - Do NOT call `superpowers:finishing-a-development-branch`

---

## retro-doc — Retroactive Documentation (code-first)

Triggered when code is already written/merged without going through Phases 1–2, but documentation is desired retroactively. Common scenarios: legacy code, hot-fix that bypassed flow, work merged from someone else, prototype-now-document-later.

**Critical difference from other paths:** the Iron Law (failing test before code) is **inverted** — code exists, so tests serve to *characterize* and *lock down* existing behavior, not to drive implementation. The discipline floor remains: every Requirement must trace to a passing test.

### Halt rule (read first)

If at any point during D-4 you discover the existing code is buggy (test fails because the code behaves incorrectly, not because the spec inference was wrong), **STOP retro-doc**. Do not write a spec that codifies a bug. Either:

- Restart with **code-only** to fix the bug, then re-enter retro-doc against the fixed code, OR
- Confirm with user that the buggy behavior is actually intended; if so, document it explicitly in `proposal.md § Why` with rationale before continuing

### Phase D-0 — Scan & Classify

1. Identify code scope under review:
   - `git log <range>` or `git diff <ref>..HEAD` for recent merges, OR
   - Explicit file/dir paths supplied by user
2. Read all affected production files in full
3. Read existing tests covering those files
4. Sub-classify:

   | Sub-type | Criteria | Maps to |
   |----------|----------|---------|
   | **retro-as-new-feature** | Code introduces capability with no existing spec | new-feature doc generation |
   | **retro-as-spec-rewrite** | Code modifies behavior covered by existing spec | spec-rewrite doc generation (D-1 must cite the old spec) |

5. 🛑 STOP — present scope and sub-type, await user confirmation

### Phase D-1 — Reverse-engineer Superpowers docs

Read production code; infer architecture-layer decisions:
- Why this file structure / module split?
- Why this library / framework choice?
- What technical patterns are used (and what tradeoffs do they imply)?

📄 produces:
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` — architecture rationale (retroactive); note `reconstructed from <commit-hash> on YYYY-MM-DD` in front matter
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` — task breakdown reflecting what was actually built; mark steps `[x]` for already-done implementation, leave `[ ]` for items D-4 still needs to verify

### Phase D-2 — Reverse-engineer OpenSpec docs

Read code behavior + tests to infer domain-layer:
- What user-visible outcomes does this code produce?
- What acceptance conditions are hidden in tests / branching logic / edge cases?
- What product motivation can be reconstructed (or inferred)?

📄 produces (4 files under `openspec/changes/<name>/`):
- `proposal.md` — § Why = `"Retroactive documentation; no new product decision. Original implementation: <commit-hash> on <date>."` + § What Changes inferred from code
- `design.md` — § Context + § Decision inferred from architecture observations
- `specs/<cap>/spec.md` — Requirements inferred from observed behavior + tests
- `tasks.md` — milestones inferred from user-visible outcomes

**Rule D-2-1:** Every Requirement in `specs/<cap>/spec.md` must trace to (a) a code path that produces that behavior AND (b) at least one test (existing or to-be-written in D-4) that exercises it. Inferences without a code anchor → halt and confirm with user before proceeding.

### Phase D-4 — Test backfill (replaces standard Phase 4)

🔓 **Iron Law inverted:** code exists; tests must capture existing behavior. Discipline floor: every Requirement has a passing characterization test.

For each Requirement in `specs/<cap>/spec.md`:

1. Find existing test covering it. If found and passing → mark plans/tasks `[x]` and continue.
2. If no test exists → write a new characterization test that exercises the Requirement.
3. Run the test. Three outcomes:
   - **Passes** → ✓ test now locks down behavior; mark `[x]`
   - **Fails because spec inference was wrong** → return to Phase D-2; revise Requirement to match actual code; re-derive test
   - **Fails because code is buggy** → trigger **Halt rule** (see top of retro-doc section)
4. After all Requirements have passing tests, run full test suite — must be all green.

### Phase 5 (standard) — Verification

Proceed as new-feature (for retro-as-new-feature) or spec-rewrite (for retro-as-spec-rewrite):
- Level 1 is largely satisfied by D-4 already
- Level 2 (acceptance scenario per milestone or per patched behavior) still applies — actually exercise the user-facing flow, not just rely on tests

### Phase 6 (standard) — Finish & Archive

- Steps 1+2 (Shutdown / TeamDelete) → skip (retro-doc never invokes Phase 3 teams)
- Step 3 → `opsx:archive` runs (retro-doc produces `openspec/changes/<name>/` via D-2)
- Step 4 → read-only `git diff` + commit suggestions

### Guardrail interaction

The 6-artifact guardrail in `check-artifacts.js` blocks production code edits when `openspec/changes/<name>/` is incomplete. For retro-doc this naturally fits:
- D-1 + D-2 are doc-only (hook permits)
- D-4 only edits test files (hook permits — tests aren't on the blocked extension list)
- Production code edits during D-4 should never happen if Halt rule is followed; a real bug requires switching to code-only first (delete the in-progress `openspec/changes/<name>/` to unblock the hook before starting code-only)

---

## Key Rule

- **Rule 1** — Spec is law: do not deviate from `design.md` without updating it first.
