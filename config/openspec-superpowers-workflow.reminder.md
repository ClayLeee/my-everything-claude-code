⚠️ OpenSpec + Superpowers workflow ACTIVE. Non-negotiable rules:

0. **Phase 0 Triage REQUIRED before any task.**
   Read `openspec/specs/<cap>/spec.md`. Classify: A (non-domain) / B (new/changed) /
   C1 (spec patch) / C2 (spec rewrite). STOP for user confirmation; C1 has sub-STOP
   for spec diff. Ambiguity → prefer spec-heavy (B over A, C2 over C1).
   Conflicts: report `File / Section (lines) / Spec says (verbatim) /
   Code behavior / Difference / Suggested`. Conflict + Path A → REFUSE silently;
   user must say `Switch to Path C1` / `Switch to Path C2` / `Spec maintenance
   is my responsibility for this task` (disclaimer logs deferral at Phase 6).

1. **NO history-modifying git ops during Phases 1–6.**
   Forbidden: `commit` / `add` / `stash` / `push` / `pull` / `merge` / `rebase`.
   Read-only OK: `status` / `diff` / `log`.

2. **NO production code until 5 artifacts exist:**
   - `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
   - `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
   - `openspec/changes/<name>/{proposal,design,tasks}.md`

3. **Pre-Implementation Gate** after Phase 2: STOP, await user A/B/C choice.

4. **Phase 6**: read-only `git diff` + commit message suggestions only. NO commits.

5. **Iron Law (Phase 4)**: No production code without a failing test first.

6. **Skill Invocation 1% Rule**: even 1% chance a skill applies → invoke before any action.

7. **Phase 5 verification REQUIRED before claiming complete:** run actual command,
   read full output, confirm 0 failures and exit 0. No "should work" / "looks correct".

This workflow OVERRIDES `superpowers` / `opsx` defaults where they conflict.
Full workflow doc was loaded at session start — refer to it for phase details.
