# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**my-everything-claude-code** is a Claude Code **marketplace** containing 7 separately-installable plugins. It is NOT a typical application — it is a plugin distribution repository.

The 7 plugins:
- **claylee-core** — behavioral contract rule + console.log check + push-guard mod
- **claylee-e2e-testing** — Playwright E2E skill + `/e2e:*` commands
- **claylee-code-quality-agents** — 4 sub-agents for code review / build fixes / security / dead code
- **claylee-openspec** — OpenSpec workflow injection (conditional on `openspec/` dir) + `retro-doc-sync` skill
- **claylee-alien-defense** — pixel-art pane mod (`/alien`): alien vs creatures, OpenSpec stage as the planet's day
- **cicd-watch** — GitLab commit + pipeline pane mod (`/cicd`)
- **prompt-nav** — prompt history pane + band mod (`/prompts`)

Install (pick any subset):
```bash
/plugin marketplace add ClayLeee/my-everything-claude-code
/plugin install claylee-core@ClayLeee-my-everything-claude-code
/plugin install claylee-e2e-testing@ClayLeee-my-everything-claude-code
/plugin install claylee-code-quality-agents@ClayLeee-my-everything-claude-code
/plugin install claylee-openspec@ClayLeee-my-everything-claude-code
/plugin install claylee-alien-defense@ClayLeee-my-everything-claude-code
/plugin install cicd-watch@ClayLeee-my-everything-claude-code
/plugin install prompt-nav@ClayLeee-my-everything-claude-code
```

## Architecture

### Marketplace + Plugin Structure

The repo is a Claude Code marketplace defined by `.claude-plugin/marketplace.json`, which lists 7 plugins under `plugins/`. Each plugin has its own `.claude-plugin/plugin.json` manifest, and (where applicable) its own `hooks/hooks.json` for event-driven automation. Component directories (`commands/`, `agents/`, `skills/`, `rules/`, `scripts/`) live inside each plugin.

Hook conventions (same across plugins):
- **Matchers** use expressions like `tool == "Bash" && tool_input.command matches "git push"` and `*` for catch-all
- **Handlers** are `node` scripts receiving JSON via stdin and outputting JSON via stdout
- Hooks must never throw — they gracefully degrade and pass through original data on error

### Hook Scripts (distributed across plugins)

All hook scripts are Node.js (pure stdlib, no npm dependencies) under `plugins/<plugin>/scripts/hooks/`:

**claylee-core** (1 script):
- **check-console-log.js** — scans all git-changed files for `console.log` (Stop)

### Mods (function-hook modules)

A plugin's `hooks/hooks.json` can name a TypeScript module under `modules` next to its classic `hooks`. Test with `claude plugin test <plugin dir>` and check with `claude plugin validate <plugin dir>`.

**claylee-core** — `hooks/push-guard.ts`: in a project that has `.claude/push-checks.json` (`{ "checks": ["pnpm lint", ...] }`), denies a Bash or PowerShell `git push` until every listed check has passed on the tree being pushed. A check counts when it runs as its own command (`&&` chains allowed, no `||` or `;`) and succeeds; in Bash it may also be the first stage of a pipe (`pnpm test 2>&1 | tail -20`), and the guard then runs the command with `set -o pipefail;` in front so the check's own exit status decides (PowerShell pipes still don't count); it records the working tree's git tree hash (`git stash create`), so committing the checked work keeps the pass and any later edit voids it. A check that is interrupted or moved to the background does not count, and a toast says so at once. Projects without the file are untouched. Only a `git` at a command position counts as a push (start of a line, or after `&&`, `||`, `;`, `|`, `(`), so `git push` inside a string or commit message is not one. The repo is the `-C` path, else the last `cd`/`Set-Location`/`pushd` before the push in the same command (`/c/...` read as `C:/...`), else the session's directory; a path git cannot resolve (an unexpanded `$var`) counts as an unguarded repo. `/push-checks` shows which checks have passed on `HEAD`; `/push-checks run` answers at once and runs them in the background, in order through the shell (`cmd /c` on Windows, `sh -c` elsewhere, 10-minute cap each): the plugin's status line shows `push-checks 3/4 · <check>`, a toast reports the result, and a second `run` while one is going is refused. It stops at the first failure and records the passes. Only the latest run is kept, in `$.store` (per-check durations and the failing check's last 15 lines), and `/push-checks` shows it; nothing is written to disk. User-facing text is 繁體中文.

**claylee-alien-defense** — `hooks/register.tsx`: a pane drawn with the samurai-dojo pixel engine copied into `hooks/shared/` (MIT, license kept there; do not edit it beyond what the game needs). `sim/world.ts` is the game state (alien state machine, monsters, boss, effects); `draw/` paints it; `art/` holds the sprites as character maps. Each tool call spawns a creature that dies when the call ends (a failed call costs a second shot). `openspec.ts` polls `openspec/changes/` every 3 s: no active change is free mode (night patrol); otherwise docs < 6 is dawn, tasks under half done is noon, at least half is dusk, all checked is night. Moving forward a stage, or archiving, summons a boss. With nothing to fight the alien sleeps in a sleeping bag (rising Z's, snot bubble), lifts a barbell (sweat flies off at the top) or flexes; idle poses need a prop or a silhouette that reads at this size. The pane is 8 rows like dojo above the prompt and 14 rows when docked with room (`tallRows` in the copied `stage.tsx`); sprites are at most 14 px tall so both fit, and the tall layout spends its extra height on sky and scenery (`floorOf(height)` puts the ground). Sprites use a dark outline plus light/base/dark tones. The line under the scene wraps rather than truncates (the pane asks for one spare row inline, and docked the log gives up rows to it); it starts with what the alien is doing now (`world.action()`: asleep, lifting, flexing, fighting n creatures, the boss fight with its HP, cheering, on guard), and the log records each event as it happens: the alien getting up to fight, every kill with the tool that brought it, failures, bosses, stage changes. To check colors, dump `world.frame()` pixels from a throwaway test and convert them to PNG outside the repo. `/alien on|off|stats`; it shares `~/.claude/mods/active-game` with samurai-dojo, so only one of the two panes shows at a time.

**cicd-watch** — `hooks/register.tsx` + `hooks/gitlab.ts`: a pane of GitLab projects added with `/cicd add <url>` (the full `https://host/group/project` URL only, optional `@branch`), each card the latest commit and pipeline progress, polled every `pollSeconds`. The API token comes from `git credential fill` for the host, never from config. There is no default host: anything but a full URL is refused, so no host lives in config. Keeps the project list in `$.store`; its `$.state` contract is `types/index.d.ts`. Keep company hosts out of the repo.

**prompt-nav** — `hooks/register.tsx` + `hooks/prompts.ts`: a `/prompts` pane to search and jump to the prompts sent, and an `AbovePrompt` band naming the prompt the transcript is at. The list is built from `$.session.messages()`; `typedPrompt()` drops rows the person did not type (commands, reminders, interruptions). A prompt sent while Claude was working is no user row of its own: it rides in the next tool-result message as a "new message while you were working" notice (door `attachment` in `session.append`), and `midTurnPrompts()` takes it from there, and only there, from such messages. Row ids for jumping come from `UserMessage` renders, `session.append`, and `hooks/transcript.py` (reads the transcript JSONL, `queued_command` attachments included) on session start and `/prompts reload`.

**claylee-openspec** (2 scripts):
- **inject-openspec.js** — dual-mode workflow injector (SessionStart = full, UserPromptSubmit = compressed reminder)
- **clear-reminder-marker.js** — clears per-session reminder dedup marker on PreCompact

### E2E Testing Scripts (in `claylee-e2e-testing`)

Under `plugins/claylee-e2e-testing/skills/e2e-testing/scripts/`, same convention as hook scripts (stdin JSON → stdout JSON, pure stdlib):
- **scaffold.js** — reads templates from `../templates/`, replaces `{{VAR}}` placeholders, writes to target project paths
- **generate-report.js** — calculates test summary stats, generates 繁體中文 markdown report

## Code Conventions

### Script Requirements
- All scripts are self-contained Node.js or Python — **no external npm/pip packages**
- Cross-platform: use `path.join()`, `os.homedir()`, detect platform via `process.platform`
- Error handling: try-catch with silent failures, never crash the plugin
- File I/O: synchronous, check existence before operations, ensure directories exist before writing
- Hook scripts read JSON from stdin and write JSON to stdout; diagnostic output goes to stderr

### Command Frontmatter
Per official Claude Code docs, valid fields: `name`, `description`, `argument-hint`, `model`, `context`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `agent`, `hooks`. Do NOT use: `category`, `tags`, `args`, `skills` (these have no effect in command frontmatter).

### Hook Matchers and Exit Codes
A hook's `matcher` filters on tool name only (`Write`, `Edit|Write`, `*`); conditions on `tool_input` belong in the script or in the handler's `if` field (one permission rule, e.g. `Bash(git push*)`). A PreToolUse hook blocks only by exiting 2 or by printing a `permissionDecision: "deny"` JSON; exit 1 is a non-blocking error and the tool call goes ahead.

### Commit Convention
Conventional Commits format. All AI-assisted commits include:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Git Branching
- `main` — production
- `develop` — development (current active branch)

## Language

- Code and comments: English
- User-facing output (code-review agent, command descriptions): 繁體中文
- Skill YAML frontmatter: English

## Key Components

### Rules (in `claylee-core`)

Global rule installed to `~/.claude/rules/` for automatic enforcement:
- **behavioral-contract** — 8 universal behavioral norms (Simplicity First, Surgical Changes, Fail Loud, etc.) adapted from Karpathy's CLAUDE.md template

### Agents (in `claylee-code-quality-agents`)

All agents output in 繁體中文.

- **code-review** — Reviews code quality across four pillars: duplicate elimination, code optimization, project standard compliance, comment hygiene
- **build-error-resolver** — Fixes build/type errors with minimal changes. No refactoring — just get the build passing
- **security-reviewer** — Frontend security audit: XSS (`v-html`, `innerHTML`), token handling, input validation, dependency vulnerabilities, secrets detection
- **refactor-cleaner** — Dead code cleanup using `knip`/`depcheck`/`ts-prune`. Categorizes findings by risk (SAFE/CAREFUL/RISKY), removes in safe order with verification after each batch

### Skills

- **retro-doc-sync** (in `claylee-openspec`) — backfills OpenSpec specs, Superpowers docs and characterization tests for code already merged or pushed (an MR, a branch, a range), without touching production code. `scripts/triage.mjs <range> [repo]` does the deterministic first pass (commit types, `specFlag`, `testGaps`) so the model only judges what it flags; judge per range, not per commit, since a `feat:` is often followed by its `docs(openspec):` commit
- **e2e-testing** (in `claylee-e2e-testing`) — Playwright E2E testing patterns with 3-level progressive disclosure: SKILL.md (core conventions, ~310 lines) → references/ (12 judgment-based guides) → templates/ (8 deterministic code files) + scripts/ (scaffold.js, generate-report.js). Commands resolve `$SKILL_DIR` via Glob and load only the references they need

### Commands

E2E Testing (in `claylee-e2e-testing`, all 7 commands):
- `/e2e:analyze` — analyze page structure and build Semantic Element Table
- `/e2e:plan` — generate coverage plan from analysis artifact
- `/e2e:create` — create POM + spec, MCP pre-validation, run tests, MCP debug loop on failure, dual reports
- `/e2e:maintain` — incrementally update tests, run tests, MCP debug loop on failure, dual reports
- `/e2e:run` — run existing tests, classify failures by type (LOCATOR_MISMATCH/TIMING/ENVIRONMENT/NON-RECOVERABLE), suggest next command
- `/e2e:remote` — scaffold Playwright project, MCP explore + auth, run tests, MCP debug loop on failure, dual reports
- `/e2e:record` — record browser actions via codegen, convert to POM + spec, MCP debug loop on failure

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **my-everything-claude-code** (688 symbols, 1106 relationships, 56 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/my-everything-claude-code/context` | Codebase overview, check index freshness |
| `gitnexus://repo/my-everything-claude-code/clusters` | All functional areas |
| `gitnexus://repo/my-everything-claude-code/processes` | All execution flows |
| `gitnexus://repo/my-everything-claude-code/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
