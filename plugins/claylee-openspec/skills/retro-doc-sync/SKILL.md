---
name: retro-doc-sync
description: Backfill OpenSpec specs, Superpowers docs and tests for code someone else already merged or pushed (a GitLab MR, a branch, or a commit range), without changing production code. Use when the user asks to align, backfill or sync docs/specs/tests for an MR, a teammate's commits, or new commits after a pull, in a project that has an openspec/ directory.
argument-hint: "<!MR-number | branch | git-range>"
---

# retro-doc-sync

Runs the workflow's **retro-doc** path (Phases D-0 → D-1 → D-2 → D-4 → 5 → 6 in the injected OpenSpec + Superpowers workflow) over code that already exists. Production code is never edited: only `openspec/`, `docs/superpowers/` and test files.

## 1. Resolve the range

| Argument | Range |
|---|---|
| `!85` (GitLab MR) | `git fetch origin merge-requests/85/head`, then `$(git merge-base origin/<target> FETCH_HEAD)..FETCH_HEAD` (target is usually `develop`; ask if unsure) |
| a branch | `$(git merge-base origin/<target> <branch>)..<branch>` |
| a range (`a..b`) | as given |
| nothing | `ORIG_HEAD..HEAD` (what the last pull brought in) |

## 2. Triage with the script, not by reading

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/retro-doc-sync/scripts/triage.mjs" "<range>" "<repo dir>"
```

It prints JSON: each commit with its Conventional Commit `type` and files (`docs/test/chore/style/ci/build` are `skipped`), `specFlag` (feature or user-facing source changed without any `openspec/` change), `specTouched`, and `testGaps` (source files with no sibling test touched or present). If `needsReview` is false, report that nothing needs backfilling and stop.

## 3. Judge, then STOP

Read the diff of the flagged source files and the related `openspec/specs/<capability>/spec.md`. Group by capability, not by commit. For each group classify as in workflow Phase 0 (code-only → tests only; spec-patch; new-feature; spec-rewrite) and drop false flags from step 2 (a test under another name, a pure refactor).

Present one table — capability, commits, what to add (spec / docs / tests), why — and **stop for the user's confirmation**. Do nothing else until they confirm.

## 4. Backfill in an isolated worktree

- Create a worktree on a new branch `docs/align-<mr-or-short-sha>` from the range's head. On Windows keep the worktree path short (OpenSpec archive paths can exceed MAX_PATH). Never link `node_modules` into it with a junction; install or run tests from the main checkout's tooling instead.
- Follow D-1 (Superpowers docs, `reconstructed from <sha>`), D-2 (OpenSpec change: proposal / design / specs / tasks), D-4 (characterization tests). Put tests where the project's CLAUDE.md says (test-runner project lists, file naming).
- **Buggy-code halt:** if a characterization test fails because the code is wrong, stop and report it. Do not write a spec that codifies a bug.
- **Code-anchor halt:** a requirement with no code that produces it is not written; ask.
- Write only `openspec/**`, `docs/superpowers/**` and test files. If a production file seems to need a change, stop and report instead.

## 5. Verify and hand over

- `openspec validate <change> --strict` (a requirement's SHALL/MUST must be on its first line), and the project's test command for the new tests.
- Archive the change (Phase 6) so the specs land in `openspec/specs/`.
- Show `git diff --stat` and a Conventional Commit message (`docs(openspec): align specs and tests for !85`). Commit, push or open an MR only when the user asks; the MR is where the original author confirms the specs describe intended behavior.
