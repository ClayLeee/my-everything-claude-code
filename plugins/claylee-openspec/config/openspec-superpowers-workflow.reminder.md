⚠️ OpenSpec + Superpowers workflow ACTIVE. Overrides superpowers/opsx defaults where conflicting.

1. **Phase 0 Triage REQUIRED before any task.** Read `openspec/specs/<cap>/spec.md`, classify code-only/new-feature/spec-patch/spec-rewrite (or retro-doc if user explicitly says code already exists — retro-doc is opt-in, never auto). STOP for user. Ambiguous → spec-heavy (new-feature>code-only, spec-rewrite>spec-patch). Conflict+code-only → REFUSE; user must say `Switch to spec-patch`/`Switch to spec-rewrite`/`Spec maintenance is my responsibility for this task` (disclaimer logs deferral at Phase 6).
2. **NO history-modifying git during Phases 1–6:** commit/add/stash/push/pull/merge/rebase. Read-only status/diff/log OK.
3. **No prod code until 6 artifacts exist (new-feature/spec-rewrite):** `docs/superpowers/{specs,plans}/<date>-*.md` + `openspec/changes/<name>/{proposal,design,tasks}.md` + `openspec/changes/<name>/specs/<cap>/spec.md`. Block applies globally — close out stale changes via `opsx:archive` before starting new ones.
4. **Pre-Impl Gate after Phase 2:** Default B (parallel-agents); proceed unless user explicitly requests A (Agent Teams) or C (revise).
5. **Iron Law (Phase 4):** failing test before any production code. No exceptions.
6. **Phase 5 verification:** run actual user scenario, read full output, confirm exit 0. No "should work" / "looks correct" / "tests passed so it works".
7. **Phase 6:** read-only `git diff` + commit message suggestions only. NO commits.
8. **Skill 1% rule:** even 1% chance a skill applies → invoke before any action.

Full workflow doc was injected at SessionStart — refer to it for phase details.
