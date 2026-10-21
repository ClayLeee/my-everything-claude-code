# OpenSpec + Superpowers Workflow

## [OVERRIDE] Rule 0: No Commit Until the User Approves the Push

**Read-only git (`status` / `diff` / `log` / `show`) is allowed at any phase.**

**History-modifying git** (`add` / `commit` / `push` / `merge` / `rebase` / `pull` / `stash` / PRs) is forbidden in every phase, for code and docs alike: no commit of the change docs after Phase 2, no commit of a finished step, no "checkpoint" commit. It happens only after the user, in this session, has looked at the Phase 6 report and explicitly approved pushing this work. A project's CLAUDE.md, a skill, or an earlier approval for other work does not count. Once approved, commit and push in one go:
- Stage only what this session changed: `git add <paths>`, never `git add -A` / `git add .`. In a file another session also edits, stage only this session's hunks. Never revert, discard or stash away changes this session did not make.
- Order: push-checks → commit → push. If the project has `.claude/push-checks.json`, call the push-checks tool first; it compares the working tree with the upstream and says no checks are needed when only the project's `skipWhenOnly` paths differ. Fix any failure before committing. Then commit, naming the OpenSpec work in the body (`OpenSpec: <change-name>`), and `git push`.

Do NOT call `superpowers:finishing-a-development-branch`. **Overrides any skill that suggests history-modifying git ops.**

---

## Document Roles

OpenSpec owns **domain knowledge** (permanent, archived). Superpowers owns **code knowledge** (session artifacts, ephemeral). The split:

**Main specs (`openspec/specs/`) are never edited by hand.** They change only through `opsx:archive` of a change. Every spec edit goes into an unarchived `openspec/changes/<name>/`: an existing one that is related to the code change (see Phase 0 step 1), or a new one.

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
                                  code-only: Phase 4 (TDD) → Phase 5 (Level 1 only) → Phase 6 (align, no archive)
                                  new-feature: full flow Phase 1 → 6
                                  spec-patch: patch the related unarchived change, or open a new full change + Phase 4 → Phase 5 (Level 1 + patched behavior) → Phase 6
                                  spec-rewrite: full flow with spec rewrite (also: requirement-modification by product)
                                  retro-doc: code-first → D-0/D-1/D-2/D-4 → standard Phase 5/6 (see retro-doc section)
                                  STOP only where Phase 0 step 3 says so
Phase 1: Discovery             → superpowers:brainstorming
                                  vague: full exploration | clear: confirmation mode
                                  Produces: docs/superpowers/specs/ + docs/superpowers/plans/
Phase 2: Specification         → opsx:propose
Phase 4: Implementation        → TDD, parallel agents where plan tasks are independent
Phase 5: Verification          → superpowers:verification-before-completion
Phase 6: Align & Finish        → drift check (all paths) + opsx:archive (only if a change exists) + report
```

---

### Phase 0 — Domain Triage

**Runs before every task. Determines whether/how OpenSpec applies.**

1. **Read existing domain context:**
   - `ls openspec/specs/` — list all capabilities
   - For each capability whose name relates to the request: read `openspec/specs/<capability>/spec.md` in full
   - If `openspec/specs/` does not exist yet: classify as new-feature by default
   - List the unarchived changes (`openspec/changes/*`, excluding `archive/`) and decide which, if any, is **related** to this code change: its delta specs cover the Requirements this code change affects, or this code change is part of that change's own work (its proposal / tasks). Sharing a capability is not enough on its own. A change that is unrelated (another feature, another session's work) is never edited. If more than one could be related, or it is unclear, ask.
   - A related change whose files are untracked or modified in `git status` and that this session did not create is probably another session's work in progress (nothing is committed before the push, Rule 0). Ask before editing it: two sessions writing the same change overwrite each other. A related change already committed is earlier work and may be edited.

2. **Classify the request:**

| Path | Criteria | Routing |
|------|----------|---------|
| **code-only** | Behavior unchanged from spec. Internal only: bug fix that doesn't alter user-visible behavior, refactor, dep upgrade, perf, typo, test-only. See *No-doc exemption*. | Phase 4 (TDD) → Phase 5 (Level 1 only) → Phase 6 (align, no archive) |
| **new-feature** | New feature OR existing feature behavior change. Existing spec doesn't cover, or needs extension. | Full Phase 1 → 2 → 4 → 5 → 6 |
| **spec-patch** | The spec **describes** the intended behavior wrongly, out of date, or incompletely, and the intended behavior itself is not changing (the spec misstated it, or left out an edge case that was always intended). Scoped to one capability. | **Related unarchived change exists** → edit that change's files directly, no new change. **None** → open a new change with the full OpenSpec set: `proposal.md` (§ Why: what the spec got wrong), `design.md`, delta spec, `tasks.md`. No Superpowers docs (no Phase 1). Either way with sub-STOP → Phase 4 → Phase 5 (Level 1 + patched behavior) → Phase 6 |
| **spec-rewrite** | Spec needs rewrite — either (a) spec **conflicts** with required behavior (bug-driven), OR (b) requirement itself is being **modified by product decision** (intentional behavior change). Rewrite scope non-trivial. | Full flow, but Phase 1 must cite the existing spec being replaced |
| **retro-doc** | **Code already exists** (legacy, hot-fix, merged from elsewhere, prototype-now-document-later) but no `openspec/changes/<name>/` was created. Goal: reverse-engineer docs from code. | retro-doc flow: D-0 → D-1 → D-2 → D-4 → standard Phase 5 → 6 (see retro-doc section below) |

**spec-patch vs behavior change:** if users will see the system behave differently from before (new rule, new field, changed limit, changed flow), it is new-feature or spec-rewrite, even when the spec edit would be small. spec-patch never carries a behavior change.

3. **Announce the routing; STOP only where it matters:**

| Situation | What to do |
|-----------|------------|
| code-only, no spec conflict | One line (`Phase 0: code-only — <reason>`), then proceed. No STOP. |
| spec-patch | One line with the routing, then the sub-STOP in step 4 (one stop, not two). |
| new-feature / spec-rewrite / retro-doc, or **any spec conflict** | STOP with the triage result below. When the task also has design questions, ask them in the same `AskUserQuestion` (routing as the first question) instead of stopping twice. |

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
       Suggested:     [spec-patch | spec-rewrite]

     Proposed routing: Path [new-feature | spec-patch | spec-rewrite | retro-doc]
     Reasoning:        [2-3 sentences, reference conflict #s if applicable]
   ```

**Reading the reply:** any plain go-ahead (繼續 / ok / 好 / yes / answering the attached design question) confirms the proposed routing. The routing changes only when the user names another path or rejects this one. Never ask the user to type an exact phrase.

**retro-doc selection rule:** retro-doc is **opt-in only** — LLM does not auto-classify into retro-doc. Choose retro-doc only when the user explicitly states the code already exists and they want documentation generated retroactively. code-only/new-feature/spec-patch/spec-rewrite remain the auto-classification options for forward-direction work.

4. **For spec-patch only — sub-STOP before applying spec patch:**
   - Say which change it goes into (the related unarchived change and why it is related, or a new change)
   - Present diff (before/after) of the proposed edit
   - Wait for the user to accept (any go-ahead), revise, or cancel
   - Do NOT modify any OpenSpec file before that
   - After editing: `openspec validate <change> --strict` must pass

**Conservative default:** When path is ambiguous (code-only↔new-feature or spec-patch↔spec-rewrite), prefer the more spec-heavy path (new-feature over code-only, spec-rewrite over spec-patch). Better to write extra spec than to silently drift. **retro-doc is orthogonal** (it concerns timing — code-first vs spec-first — not scope) and not subject to conservative defaults.

**No-doc exemption (overrides the conservative default):** copy/text edits, styling and layout, no-behavior refactors, dependency bumps and test-only changes are code-only — no change, no spec edit — unless the spec quotes the text or layout being changed verbatim, in which case it is spec-patch.

**Multi-capability rule:** If multiple capabilities are affected, take the most spec-heavy classification across all (e.g., code-only + spec-patch → spec-patch).

**A spec conflict is never code-only:** code that conflicts with the spec means the docs and tests get aligned in the same task. Route it to spec-patch or spec-rewrite; there is no option to leave the conflict for later.

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

**Rule 4: No `## RENAMED Requirements` in delta specs.** Archive drops them silently. Express a rename as `## REMOVED Requirements` (old name) + `## ADDED Requirements` (new name).

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

**Block scope:** the guardrail applies to **this task's change only** — the one this session created, or the related change it is working in (Phase 0 step 1). Other unarchived changes are normal when several sessions work in the same checkout: they never block this task, and this session never edits, completes or archives them. If one looks abandoned, mention it in the Phase 6 report and leave it. A new spec-patch change is complete with its four OpenSpec files (`proposal.md`, `design.md`, delta spec, `tasks.md`); it needs no Superpowers docs.

---

### Phase 4 — Implementation

**Iron Law: No production code without a failing test first. No exceptions.**

**Path applicability:** Iron Law and TDD loop apply to paths code-only / new-feature / spec-patch / spec-rewrite. code-only and spec-patch have no `plans/...md` — track progress via failing test → passing test transitions; a spec-patch marks its change's `tasks.md` in Phase 5. **retro-doc inverts the Iron Law** (code already exists; tests serve to characterize, not drive) and uses Phase D-4 (Test backfill) instead of standard Phase 4 — see retro-doc section below.

**Dispatch:** when the `plans/...md` Tasks are mostly independent (no shared state, no sequential dependencies), use `superpowers:dispatching-parallel-agents`, one subagent per independent cluster, and synthesize all subagent reports before Phase 5. Otherwise implement inline. Independence is judged at the `plans/` Task level, NOT the `tasks.md` milestone level (one milestone may require multiple plan Tasks).

| Step | What happens |
|------|--------------|
| RED | Failing test. If fails for *unexpected* reason → invoke `superpowers:systematic-debugging` first (root cause before any fix) |
| GREEN | Minimal code to pass. Nothing extra. |
| REFACTOR | Clean up, tests stay green, no new behavior |
| Review | Inline review of the diff before moving on |
| Marks | Marking `plans/...md` steps `- [x]` is optional — the plan is a working aid, not a gate. Do **NOT** mark `tasks.md` here — milestones are marked in Phase 5 after acceptance verification. |

---

### Phase 5 — Verification

Before claiming any task or phase complete, invoke `superpowers:verification-before-completion`. Verification happens at **two distinct levels**.

**Path applicability:**

| Path | Level 1 (code) | Level 2 (acceptance) |
|------|----------------|----------------------|
| **code-only** | Required | **Skipped** — no domain change to verify against; `git diff` review + manual smoke is sufficient |
| **new-feature / spec-rewrite** | Required | Required — run scenario per `tasks.md` milestone, mark `- [x]`; trace every spec Requirement to a verified milestone |
| **spec-patch** | Required | Required — run scenario for the patched behavior in the change's delta spec; mark the change's `tasks.md` |
| **retro-doc** | Already satisfied by D-4 (all Requirements have passing tests) | Follow new-feature rules (retro-as-new-feature) or spec-rewrite rules (retro-as-spec-rewrite) per Phase D-0 sub-classification |

**Level 1: Code-level (continuous, during Phase 4) — applies to all paths**

> **Note:** Level 1 is satisfied by the final suite run at Phase 4 completion — the last TDD REFACTOR step already runs the full suite. If Phase 4 ended with 0 failures and a clean build, Level 1 is done; proceed directly to Level 2 (or Phase 6 for code-only).

| Check | Pass criteria | Path scope |
|-------|---------------|------------|
| Tests | Run the suite, read full output, confirm 0 failures | all |
| Build | Confirm exit 0 | all |
| Lint / type-check | Confirm clean (if project enforces them) | all |

**Level 2: Acceptance-level (gate before Phase 6) — applies to new-feature / spec-patch / spec-rewrite**

For each acceptance unit (new-feature/spec-rewrite: every `tasks.md` milestone; spec-patch: every behavior changed in the spec patch), run the actual user-facing scenario:

| Feature kind | Scenario action |
|--------------|-----------------|
| **UI** | Test with Playwright: drive the real page in the Playwright browser (MCP), or run the project's E2E specs (`e2e:run` if they exist, `e2e:create` to scaffold them). Check the outcome with assertions on the page snapshot (text, element state) and on the intercepted requests/responses. Screenshots only when the point is visual — at most one per scenario, never one per step. |
| **Backend / API** | Hit the actual endpoint with realistic inputs (curl / httpie / postman / integration test against running service) |
| **Library / utility** | Invoke the function from a fresh REPL or scratch script with the exact inputs a user would use |

**When a scenario needs a signed-in user:** open the sign-in page in the Playwright browser and stop. Tell the user what account the scenario needs: if the spec or the scenario depends on a particular role or permission, name it and say why; otherwise any account that can reach the page will do. Continue once they say they are signed in. Never ask for, store or type a password.

**When a scenario still cannot be run** (backend not deployed, third-party service, the user cannot sign in now): do not skip it silently and do not mark it `- [x]`. Mark the milestone `- [ ] … DEFERRED(L2: <reason>)`, run the closest automated substitute you can (test against a mocked response, DOM check on a local build), and list it in the Phase 6 report under **L2 未驗** with the reason and the exact steps for the user to verify it by hand.

**Mark + trace (path-specific):**

| Path | Mark | Trace |
|------|------|-------|
| *new-feature / spec-rewrite* | `tasks.md` milestone `- [x]` only after the scenario passes | Re-read `openspec/changes/<name>/specs/<capability>/spec.md` § Requirements line by line — every requirement must trace to a verified milestone. Any orphan requirement = Phase 5 not done. |
| *spec-patch* | The change's `tasks.md` milestone for the patched behavior `- [x]` only after the scenario passes | Re-read the patched section of `openspec/changes/<name>/specs/<cap>/spec.md` § Requirements — every patched line must trace to a verified scenario. |

**Hard rule:** Avoid hand-waving language ("should work", "looks correct", "tests passed so it works") for Level 2 — unit tests prove code does what the test says, not what the user needs. Phase 5 is the only place to catch that gap before Phase 6 archives the spec.

---

### Phase 6 — Align & Finish

Runs for every path. When the user asks to "align docs and tests and archive" (對齊文件/測試並 archive), this phase is what they mean: align always, archive only when a change exists. **Never create a change just so there is something to archive.**

**Path applicability:**

| Step | code-only | new-feature | spec-patch | spec-rewrite | retro-doc |
|------|--------|--------|---------|---------|--------|
| 1. Drift check | run | run | run | run | run |
| 2. `opsx:archive` + checklist | **skip** | run | run | run | run |
| 3. Report | run | run | run | run | run |

A patched existing change is archived only when its own work is finished; if it still has open work, leave it unarchived and say so in the report.

**1. Drift check.** Read the final diff against the Requirements of every capability it touches.
- Docs and tests match the code → continue.
- code-only, but the diff turns out to change what the specs say → stop and say so. Within one capability and the spec only misdescribed it → switch to spec-patch (sub-STOP with the diff). Otherwise propose a change for it (retro-doc style: the code exists, the docs follow), or update the related unarchived change.
- A Requirement no longer has a test, or a test asserts behavior the spec does not describe → fix the test or the spec before finishing.

**2. Archive (only if this task's `openspec/changes/<name>/` exists; never another session's).** Before `opsx:archive`:
- Every `tasks.md` item is `- [x]` or annotated `DEFERRED(<reason>)`; no bare unchecked items.
- No `## RENAMED Requirements` blocks in the delta specs (see Phase 2 Rule 4).

After it:
- Open each affected `openspec/specs/<cap>/spec.md` and confirm the delta landed. If the sync step did not run (its skill may be missing), apply the archived change's delta by hand — the one hand edit of `openspec/specs/` allowed, since it completes the archive and copies only what the delta says.
- The capability's `## Purpose` is a real sentence, not `TBD`.
- `openspec validate --specs --strict` passes.
- If the CLI fails or is blocked, report that; do not claim the archive is done.

**3. Report.**
- Run `git status` and `git diff HEAD`, read the full output.
- Summarize what changed; list **L2 未驗** items from Phase 5, if any.
- Give commit message suggestions: subject ≤72 chars in conventional commits format, a body saying what changed and why, and the `OpenSpec:` line from Rule 0.
- **Stop here.** Commit and push only after the user approves the push (Rule 0).

---

## retro-doc — Retroactive Documentation (code-first)

Triggered when code is already written/merged without going through Phases 1–2, but documentation is desired retroactively. Common scenarios: legacy code, hot-fix that bypassed flow, work merged from someone else, prototype-now-document-later, and e.g. a `feat`/`fix` commit that landed without its docs follow-up (such as a `docs(openspec)` commit). For an MR, a branch or a commit range, use the `retro-doc-sync` skill.

**Critical difference from other paths:** the Iron Law (failing test before code) is **inverted** — code exists, so tests serve to *characterize* and *lock down* existing behavior, not to drive implementation. The discipline floor remains: every Requirement must trace to a passing test.

### Trace & halt invariant (read first)

Every Requirement in `specs/<cap>/spec.md` must trace to (a) a code path that produces the behavior AND (b) at least one passing test that exercises it. Two halt conditions enforce this invariant — read both before D-2 and D-4:

- **Code-anchor halt (during D-2):** Requirement inferred without an identifiable code anchor → halt and confirm with user before proceeding.
- **Buggy-code halt (during D-4):** A characterization test fails because the code behaves incorrectly, not because the spec inference was wrong → **STOP retro-doc**. Do not write a spec that codifies a bug. Either:
  - Restart with **code-only** to fix the bug, then re-enter retro-doc against the fixed code, OR
  - Confirm with user that the buggy behavior is actually intended; if so, document it explicitly in `proposal.md § Why` with rationale before continuing.

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

If an unarchived change related to this code (Phase 0 step 1) already exists, update its files instead of opening a new one. Otherwise:

📄 produces (4 files under `openspec/changes/<name>/`):
- `proposal.md` — § Why **must open with** `"Retroactive documentation; no new product decision. Original implementation: <commit-hash> on <date>."` + § What Changes inferred from code
- `design.md` — § Context + § Decision inferred from architecture observations
- `specs/<cap>/spec.md` — Requirements inferred from observed behavior + tests
- `tasks.md` — milestones inferred from user-visible outcomes

**Rule D-2-1:** See *Trace & halt invariant* — Requirements without a code anchor invoke **Code-anchor halt** at this phase. Requirements must also bind to at least one test (existing or to-be-written in D-4); the binding is verified end-to-end in D-4.

### Phase D-4 — Test backfill (replaces standard Phase 4)

🔓 **Iron Law inverted:** code exists; tests must capture existing behavior. Discipline floor: every Requirement has a passing characterization test.

For each Requirement in `specs/<cap>/spec.md`:

1. Find existing test covering it. If found and passing → mark plans/tasks `[x]` and continue.
2. If no test exists → write a new characterization test that exercises the Requirement.
3. Run the test. Three outcomes:
   - **Passes** → ✓ test now locks down behavior; mark `[x]`
   - **Fails because spec inference was wrong** → return to Phase D-2; revise Requirement to match actual code; re-derive test
   - **Fails because code is buggy** → trigger **Buggy-code halt** (see *Trace & halt invariant*)
4. After all Requirements have passing tests, run full test suite — must be all green.

### Phase 5 (standard) — Verification

Proceed as new-feature (for retro-as-new-feature) or spec-rewrite (for retro-as-spec-rewrite):
- Level 1 is largely satisfied by D-4 already
- Level 2 (acceptance scenario per milestone or per patched behavior) still applies — actually exercise the user-facing flow, not just rely on tests

### Phase 6 (standard) — Align & Finish

- Step 1 → drift check
- Step 2 → `opsx:archive` with its checklist (retro-doc produces `openspec/changes/<name>/` via D-2)
- Step 3 → report

### Guardrail interaction

The 6-artifact guardrail (no production code edits while this task's `openspec/changes/<name>/` is incomplete) is a rule you follow, not a hook that enforces it. For retro-doc this naturally fits:
- D-1 + D-2 are doc-only (the guardrail permits them)
- D-4 only edits test files (the guardrail permits them)
- Production code edits during D-4 should never happen if **Buggy-code halt** is followed; a real bug requires switching to code-only first (delete the in-progress `openspec/changes/<name>/` before starting code-only)

---

## Key Rule

- **Rule 1** — Spec is law: do not deviate from `design.md` without updating it first.
