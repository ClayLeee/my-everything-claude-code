# Behavioral Contract

These rules apply to every task unless explicitly overridden. Adapted from the 12-rule CLAUDE.md template (Karpathy) — the 5 rules below patch gaps not already covered by OpenSpec / Superpowers / per-project `CLAUDE.md`.

## Rule 1 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 2 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 3 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 4 — Read before you write
Before adding code in a file, read the file's exports, immediate callers, and obvious shared utilities.
Use the search tools this environment provides: lean-ctx (`ctx_search`, `ctx_glob`, `ctx_read`) when its MCP tools are present, Claude Code's own `Grep`/`Glob` otherwise, and GitNexus when installed (`.gitnexus/` or `mcp__gitnexus__*` present) for symbol-level impact.
"Looks orthogonal" is the most dangerous phrase in this codebase.

## Rule 5 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
