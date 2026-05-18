# my-everything-claude-code

Personal Claude Code plugin — shared hooks, skills, commands, and agents for all projects.

## Install

This repo is a **Claude Code marketplace** with 5 plugins. Install only the ones you need.

```bash
# Add marketplace
/plugin marketplace add ClayLeee/my-everything-claude-code

# Install plugins individually (pick any subset)
/plugin install claylee-core@ClayLeee-my-everything-claude-code
/plugin install claylee-continuous-learning@ClayLeee-my-everything-claude-code
/plugin install claylee-e2e-testing@ClayLeee-my-everything-claude-code
/plugin install claylee-code-quality-agents@ClayLeee-my-everything-claude-code
/plugin install claylee-openspec@ClayLeee-my-everything-claude-code
```

## Plugins

| Plugin | What it provides | When to install |
|---|---|---|
| **claylee-core** | Behavioral contract rule + 5 protection hooks (git push warning, doc blocker, console.log detection, build artifact check) | Always — basic quality safety net |
| **claylee-continuous-learning** | Instinct-based learning skill + 9 `/cl:*` commands + 7 observation/session hooks | Want session-to-session learning system |
| **claylee-e2e-testing** | Playwright E2E skill + 7 `/e2e:*` commands (no hooks, on-demand only) | Writing Playwright E2E tests |
| **claylee-code-quality-agents** | 4 sub-agents (code-review, build-error-resolver, security-reviewer, refactor-cleaner) | Want specialist agents for code review/cleanup |
| **claylee-openspec** | OpenSpec workflow injection (conditional — only fires when project has `openspec/` dir or `.claude/openspec-enabled` marker) | Working with OpenSpec-style projects |

## Structure

```
.claude-plugin/
└── marketplace.json              # Lists all 5 plugins
plugins/
├── claylee-core/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── rules/behavioral-contract.md
│   └── scripts/hooks/            # 5 protection hooks
├── claylee-continuous-learning/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── commands/cl/              # 9 /cl:* commands
│   ├── skills/continuous-learning-v2/
│   └── scripts/
│       ├── hooks/                # 7 observation/session hooks
│       └── lib/                  # 4 shared utilities
├── claylee-e2e-testing/
│   ├── .claude-plugin/plugin.json
│   ├── commands/e2e/             # 7 /e2e:* commands
│   └── skills/e2e-testing/
├── claylee-code-quality-agents/
│   ├── .claude-plugin/plugin.json
│   └── agents/                   # 4 agents
└── claylee-openspec/
    ├── .claude-plugin/plugin.json
    ├── hooks/hooks.json
    ├── config/                   # OpenSpec workflow docs
    └── scripts/hooks/            # 2 OpenSpec hooks
```

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Development Workflow                              │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌──────────────────────┐
                           │    Session Start      │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌───────────────────────────────────────┐
                           │  load context hook                    │
                           │  restore previous session summary     │
                           └──────────────┬────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Development Loop                                                            │
│                                                                              │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │    Write / Edit      │───▶│  ● observe hook        capture tool usage│   │
│  │        Code          │───▶│  ● console.log warning  flag debug stmts │   │
│  │                      │───▶│  ● suggest /compact     after 50+ edits  │   │
│  └──────────────────────┘───▶│  ● block random .md     prevent extra docs│  │
│                               └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │              │              │              │             │
    need quality    build broken  security concern  cleanup     need E2E
         ▼              ▼              ▼              ▼             ▼
   ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  code-   │  │  build-    │  │security- │  │ refactor-│  │  /e2e:*  │
   │  review  │  │  error-    │  │ reviewer │  │  cleaner │  │ commands │
   │  agent   │  │  resolver  │  │  agent   │  │  agent   │  │          │
   └────┬─────┘  └─────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
        └───────────────┴──────────────┴─────────────┴─────────────┘
                                       │ (back to Development Loop)
                                       ▼
                           ┌──────────────────────┐
                           │  git commit + push   │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌───────────────────────────────────────┐
                           │  git push reminder hook               │
                           │  review before pushing                │
                           └──────────────┬────────────────────────┘
                                          │
                                          ▼
                           ┌──────────────────────┐
                           │    Session End        │
                           └──────────┬───────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
  ┌──────────────────┐     ┌────────────────────┐     ┌──────────────────┐
  │  session record  │     │   auto-analyze     │     │  auto-summarize  │
  │  + evaluate      │     │  extract instincts │     │  session summary │
  └──────────────────┘     └────────┬───────────┘     └──────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │  instincts/personal │
                           └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Learning Cycle  (async)                                                     │
│                                                                              │
│  instincts/personal ──/cl:evolve──────────▶  evolved commands               │
│                                              skills · agents                │
│                                                                              │
│  instincts/personal ──/cl:instinct-export──▶  share with teammates          │
│                       ◀──/cl:instinct-import──                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What's Included

### Hooks

| Event | Hook | Description |
|-------|------|-------------|
| PreToolUse | git push reminder | Warn before pushing |
| PreToolUse | block random .md | Prevent unnecessary doc files |
| PreToolUse | suggest compact | Remind `/compact` after 50 edits |
| PreToolUse | observe (pre) | Collect tool usage observations |
| PostToolUse | console.log warning | Flag `console.log` in edited code |
| PostToolUse | observe (post) | Collect tool results |
| PreCompact | compaction log | Record compaction events |
| PreCompact | auto-analyze | Extract instincts from observations |
| SessionStart | load context | Load previous session summary |
| Stop | global console.log check | Scan all git-changed files |
| SessionEnd | session record | Save session metadata |
| SessionEnd | evaluate session | Log session length |
| SessionEnd | auto-analyze | Extract instincts from observations |
| SessionEnd | auto-summarize | Generate session summary |

### Rules

Global rule installed to `~/.claude/rules/` for automatic enforcement (provided by **claylee-core**):

- **behavioral-contract** — 8 universal behavioral norms (Simplicity First, Surgical Changes, Read before Write, Fail Loud, etc.) adapted from Karpathy's CLAUDE.md template

### Skills

- **continuous-learning-v2** — Instinct-based learning from session observations
- **e2e-testing** — Playwright E2E testing patterns, POM examples, flaky test strategies, multi-role auth. Includes scaffold script (BasePage, config, auth, error-utils templates) and report generator script for automated markdown reports

### Agents

- **code-review** — Code quality review (duplicates, optimization, standards, comments, i18n)
- **build-error-resolver** — Fix build/type errors with minimal changes, no refactoring
- **security-reviewer** — Frontend security audit (XSS, auth, input validation, dependencies, secrets)
- **refactor-cleaner** — Dead code detection, unused dependency removal, duplicate consolidation
### Commands

- `/e2e:analyze` — Analyze page structure and build Semantic Element Table
- `/e2e:plan` — Generate coverage plan from analysis artifact
- `/e2e:create` — Create POM + spec, MCP pre-validation, run tests, MCP debug loop on failure, generate dual reports
- `/e2e:maintain` — Incrementally update tests from code changes, run tests, MCP debug loop on failure, generate reports
- `/e2e:run` — Run existing tests with error classification, failure-type summary, and next-step suggestions
- `/e2e:remote` — Scaffold Playwright project, explore remote URL via MCP, create and run tests, MCP debug loop on failure
- `/e2e:record` — Record browser actions with Playwright codegen, convert to POM + spec, MCP debug loop on failure
- `/cl:status` — Show learned instincts with confidence scores
- `/cl:analyze` — Manually trigger observation analysis
- `/cl:log` — Show recent observer log entries
- `/cl:sync` — Update instincts.md from current instincts
- `/cl:evolve` — Cluster related instincts into commands/skills/agents
- `/cl:instinct-export` — Export instincts to shareable YAML format
- `/cl:instinct-import` — Import instincts with conflict detection
- `/cl:learn-eval` — Extract session patterns with quality self-evaluation
- `/cl:skill-create` — Analyze git history to generate SKILL.md files

## E2E Testing Workflow

### Mode Overview

| Trigger | Mode | Pipeline |
|---------|------|----------|
| New page needs tests / deep test | **Create** | analyze → plan → create (MCP pre-validation + test run + MCP debug loop) |
| Code changed, update existing tests | **Maintain** | maintain (test run + MCP debug loop) |
| Run existing tests | **Run** | run (classify + suggest next command) |
| Test a remote URL | **Remote** | remote (MCP explore + test run + MCP debug loop) |
| Record browser actions | **Record** | record (codegen → POM + spec + MCP debug loop) |

### Error Handling — MCP Debug Loop

When tests fail with element interaction errors (not found, timeout), commands with code-modification scope use Playwright MCP to diagnose:

```
Test fails → browser_navigate → browser_snapshot → compare locator vs ARIA tree → fix POM/source → retry (max 1)
```

| Error Type | Action | Commands |
|------------|--------|----------|
| LOCATOR_MISMATCH | MCP snapshot → fix data-testid or POM locator → retry | create, maintain, record, remote |
| TIMING | MCP snapshot → add waitFor → retry | create, maintain, record, remote |
| ENVIRONMENT | MCP UI → fix entity state → retry | all (including run) |
| RECOVERABLE | Fix test data → retry | all |
| NON-RECOVERABLE | Report FAIL | all |

`/e2e:run` only classifies and reports — it suggests `/e2e:maintain` for LOCATOR_MISMATCH/TIMING fixes.

### Create Mode — Build New Tests

Step-by-step control (inspect output between steps):

```bash
# Step 1: Analyze page structure, produce Semantic Element Table
/e2e:analyze src/views/projects/ProjectList.vue

# Step 2: Generate coverage plan from analysis artifact
/e2e:plan

# Step 3: Build POM + spec, run tests, generate dual reports
/e2e:create
```

Or let the `e2e-testing` skill auto-dispatch all three commands when you ask Claude to write tests for a page.

### Maintain Mode — Update Existing Tests

```bash
# Auto-detect git diff changes, incrementally update POM + spec
/e2e:maintain

# Or describe changes verbally for the agent to handle
# "I changed the create dialog in ProjectList, update the tests"
```

### Run Mode — Execute Existing Tests

```bash
# Specify a spec file
/e2e:run tests/e2e/projects/project-list.spec.ts

# No argument — lists available specs to choose from
/e2e:run
```

### Remote Mode — Test a Remote URL

```bash
/e2e:remote https://staging.example.com/dashboard
```

### Record Mode — Record Browser Actions

```bash
# Record with codegen, then auto-convert to POM + spec
/e2e:record http://localhost:5173/projects

# Phase 1: Browser opens → user records actions → closes browser
# Phase 2: Auto-assignment → locator transform → code generation → test run → report
```

### Manual Test Execution & Reports

All `/e2e:*` commands set `E2E_REPORT_NAME` automatically. When running tests manually, set it yourself:

```bash
cd app

# Set E2E_REPORT_NAME to generate named reports
E2E_REPORT_NAME=project-list pnpm test:e2e -- tests/e2e/projects/project-list.spec.ts

# Other run options
E2E_REPORT_NAME=project-list pnpm test:e2e -- --headed      # Open browser
pnpm test:e2e:ui                                             # Interactive UI (no report)
pnpm test:e2e:report                                         # View HTML report
```

**Report output paths:**

| Type | Path | Notes |
|------|------|-------|
| Analysis | `playwright/{page-name}/analysis.md` | Page structure analysis from `/e2e:analyze` |
| Coverage Plan | `playwright/{page-name}/coverage-plan.md` | Test coverage plan from `/e2e:plan` |
| HTML Report | `playwright/reports/{page-name}/` | Auto-generated by Playwright; requires `E2E_REPORT_NAME` |
| Markdown Report | `playwright/reports/{page-name}/test-report.md` | Generated by `generate-report.js` in Traditional Chinese |
| Fallback HTML | `playwright/reports/latest/` | Default when `E2E_REPORT_NAME` is not set |

> All paths are relative to the `package.json` directory.

## Credits

Hooks system adapted from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License).
