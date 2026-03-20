# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**my-everything-claude-code** is a Claude Code plugin that distributes shared hooks, skills, commands, and agents across all projects. It is NOT a typical application — it is a plugin distribution repository installed via the Claude Code marketplace.

Install:
```bash
/plugin marketplace add ClayLeee/my-everything-claude-code
/plugin install my-everything-claude-code@ClayLeee-my-everything-claude-code
```

## Architecture

### Plugin System

All components are registered through `.claude-plugin/plugin.json`. The hooks system (`hooks/hooks.json`) defines event-driven automation with matchers and handlers:

- **Matchers** use expressions like `tool == "Bash" && tool_input.command matches "git push"` and `*` for catch-all
- **Handlers** are `node` scripts receiving JSON via stdin and outputting JSON via stdout
- Hooks must never throw — they gracefully degrade and pass through original data on error

### Continuous Learning (Core System)

The instinct-based learning system (`skills/continuous-learning-v2/`) captures tool usage during sessions, detects patterns via a background Haiku observer, and creates atomic "instincts" (YAML files with confidence scoring 0.3–0.9). The full lifecycle:

1. **Observe** — hooks capture tool usage to `observations.jsonl`
2. **Analyze** — observer agent detects patterns and creates instincts (`/cl:analyze` or auto at session end and pre-compact)
3. **Evolve** — cluster related instincts into commands/skills/agents (`/evolve`)
4. **Share** — export/import instincts across teammates and projects (`/instinct-export`, `/instinct-import`)
5. **Create** — extract patterns from git history into SKILL.md files (`/skill-create`)

Data lives in `~/.claude/homunculus/`:
- `observations.jsonl` — captured tool usage (auto-archives at 10MB)
- `instincts/personal/` — auto-learned instincts
- `instincts/inherited/` — imported from others
- `evolved/` — generated skills/commands/agents

Disable observation by creating `~/.claude/homunculus/disabled`.

### Hook Scripts

All under `scripts/hooks/`, written in Node.js (pure stdlib, no npm dependencies):
- **observe.js** — captures tool usage to observations.jsonl
- **start-observer.js** — launches background Haiku agent for pattern analysis (triggered at session end and pre-compact)
- **session-start.js / session-end.js** — session lifecycle management
- **summarize-session.js** — AI-powered session summaries
- **evaluate-session.js** — session quality scoring
- **check-console-log.js** — scans all git-changed files for console.log (Stop event)
- **detect-console-log.js** — warns about console.log in just-edited files (PostToolUse event)
- **warn-git-push.js** — reminder before git push
- **block-docs.js** — blocks creation of unnecessary .md/.txt files

### Shared Utilities

`scripts/lib/` provides cross-platform helpers:
- **utils.js** — path handling, file ops, git integration (handles Windows/macOS/Linux)
- **session-manager.js** — session CRUD and stats
- **package-manager.js** — auto-detects npm/pnpm/yarn/bun
- **session-aliases.js** — session aliasing system

### E2E Testing Scripts

Under `skills/e2e-testing/scripts/`, same convention as hook scripts (stdin JSON → stdout JSON, pure stdlib):
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

### Allowed Documentation Files
The hook system blocks creation of `.md` files except: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SKILL.md`, `MEMORY.md`, `HOOKS.md`, and any `.md` files under `playwright/` directories (E2E analysis/plan/report artifacts).

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
- Instinct/skill YAML frontmatter: English

## Key Components

### Rules (`rules/`)

Global rules installed to `~/.claude/rules/` for automatic enforcement:
- **coding-style** — Immutability, file/function size limits, Vue/TS conventions
- **performance** — Model selection strategy, context window management
- **security** — XSS prevention, input validation, secret management for frontend

### Agents (`agents/`)

All agents output in 繁體中文.

- **code-review** — Reviews code quality across four pillars: duplicate elimination, code optimization, project standard compliance, comment hygiene
- **build-error-resolver** — Fixes build/type errors with minimal changes. No refactoring — just get the build passing
- **security-reviewer** — Frontend security audit: XSS (`v-html`, `innerHTML`), token handling, input validation, dependency vulnerabilities, secrets detection
- **refactor-cleaner** — Dead code cleanup using `knip`/`depcheck`/`ts-prune`. Categorizes findings by risk (SAFE/CAREFUL/RISKY), removes in safe order with verification after each batch

### Skills (`skills/`)

- **continuous-learning-v2** — Instinct-based learning from session observations (core system, see above)
- **e2e-testing** — Playwright E2E testing patterns with 3-level progressive disclosure: SKILL.md (core conventions, ~310 lines) → references/ (12 judgment-based guides) → templates/ (8 deterministic code files) + scripts/ (scaffold.js, generate-report.js). Commands resolve `$SKILL_DIR` via Glob and load only the references they need

### Commands

Continuous Learning (`commands/cl/`):
- `/cl:status` — show instincts with confidence scores
- `/cl:analyze` — manually trigger observation analysis
- `/cl:log` — show recent observer log
- `/cl:sync` — update instincts.md without re-analyzing

E2E Testing (`commands/e2e/`):
- `/e2e:analyze` — analyze page structure and build Semantic Element Table
- `/e2e:plan` — generate coverage plan from analysis artifact
- `/e2e:create` — create POM + spec, MCP pre-validation, run tests, MCP debug loop on failure, dual reports
- `/e2e:maintain` — incrementally update tests, run tests, MCP debug loop on failure, dual reports
- `/e2e:run` — run existing tests, classify failures by type (LOCATOR_MISMATCH/TIMING/ENVIRONMENT/NON-RECOVERABLE), suggest next command
- `/e2e:remote` — scaffold Playwright project, MCP explore + auth, run tests, MCP debug loop on failure, dual reports
- `/e2e:record` — record browser actions via codegen, convert to POM + spec, MCP debug loop on failure

Workflow (`commands/`):
- `/before-commit` — run `pnpm before-commit` (type check + lint), then invoke `git-commit` skill to generate commit message
Instinct Management (`commands/`):
- `/evolve` — cluster related instincts into commands/skills/agents (default: preview, use `--execute` to create)
- `/instinct-export` — export instincts to shareable YAML (strips sensitive data)
- `/instinct-import` — import instincts with duplicate/conflict detection and merge strategies
- `/learn-eval` — extract session patterns with quality self-evaluation (scores 1–5 across 5 dimensions, all must be ≥3)
- `/skill-create` — analyze local git history to generate SKILL.md files (optionally generates instincts with `--instincts`)
