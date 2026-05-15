# Behavioral Contract

These rules apply to every task unless explicitly overridden. Adapted from the 12-rule CLAUDE.md template (Karpathy) — the 8 rules below patch gaps not already covered by OpenSpec / Superpowers / per-project `CLAUDE.md`.

## Rule 1 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 2 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 3 — Use the model only for judgment calls
Use Claude for: classification, drafting, summarization, extraction from unstructured text.
Do NOT use Claude for: routing, retries, status-code handling, deterministic transforms.
If a status code or plain code can answer the question, code answers it — not a model call.

## Rule 4 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 5 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns. (Aligns with the frontend "byte-identical only / intentional drift" policy in `frontend/CLAUDE.md`.)

## Rule 6 — Read before you write
Before adding code in a file, read the file's exports, immediate callers, and obvious shared utilities.
Use the project's accurate search mechanism — `Grep`/`Glob` by default, GitNexus when installed (`graphify-out/` or `mcp__gitnexus__*` present) for symbol-level impact.
"Looks orthogonal" is the most dangerous phrase in this codebase.

## Rule 7 — Checkpoint after every significant step
After completing each step in a multi-step task: summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 8 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
