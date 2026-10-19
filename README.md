# my-everything-claude-code

Personal Claude Code plugin — shared hooks, skills, commands, and agents for all projects.

## Install

This repo is a **Claude Code marketplace** with 7 plugins. Install only the ones you need.

```bash
# Add marketplace
/plugin marketplace add ClayLeee/my-everything-claude-code

# Install plugins individually (pick any subset)
/plugin install claylee-core@ClayLeee-my-everything-claude-code
/plugin install claylee-e2e-testing@ClayLeee-my-everything-claude-code
/plugin install claylee-code-quality-agents@ClayLeee-my-everything-claude-code
/plugin install claylee-openspec@ClayLeee-my-everything-claude-code
/plugin install claylee-alien-defense@ClayLeee-my-everything-claude-code
/plugin install cicd-watch@ClayLeee-my-everything-claude-code
/plugin install prompt-nav@ClayLeee-my-everything-claude-code
```

## Plugins

| Plugin | What it provides | When to install |
|---|---|---|
| **claylee-core** | Behavioral contract rule + a Stop hook that flags `console.log` in git-changed files + a push-guard mod (opt-in per project) | Always — basic quality safety net |
| **claylee-e2e-testing** | Playwright E2E skill + 7 `/e2e:*` commands (no hooks, on-demand only) | Writing Playwright E2E tests |
| **claylee-code-quality-agents** | 4 sub-agents (code-review, build-error-resolver, security-reviewer, refactor-cleaner) | Want specialist agents for code review/cleanup |
| **claylee-openspec** | OpenSpec workflow injection (conditional — only fires when project has `openspec/` dir or `.claude/openspec-enabled` marker) + `retro-doc-sync` skill | Working with OpenSpec-style projects |
| **claylee-alien-defense** | Pixel-art pane: an alien lasers down a creature per tool call; in OpenSpec projects the sky runs dawn → night with the change's stage and a boss appears at each stage change. `/alien` toggles it | Want a game to watch while Claude works |
| **cicd-watch** | Pane: the latest commit and pipeline progress of the GitLab projects you add with `/cicd add`. Give each project as its full URL (`https://host/group/project`, optional `@branch`) | Want to watch CI without leaving Claude Code |
| **prompt-nav** | Pane to search and jump to the prompts you sent (ones sent while Claude was working too), and a band naming the prompt the transcript is at. `/prompts` toggles it | Long sessions where you scroll back to earlier asks |

## Structure

```
.claude-plugin/
└── marketplace.json              # Lists all 7 plugins
plugins/
├── claylee-core/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json          # Stop hook + push-guard.ts module
│   ├── rules/behavioral-contract.md
│   ├── scripts/hooks/            # console.log check
│   └── tests/                    # push-guard tests (claude plugin test)
├── claylee-e2e-testing/
│   ├── .claude-plugin/plugin.json
│   ├── commands/e2e/             # 7 /e2e:* commands
│   └── skills/e2e-testing/
├── claylee-code-quality-agents/
│   ├── .claude-plugin/plugin.json
│   └── agents/                   # 4 agents
├── claylee-openspec/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── config/                   # OpenSpec workflow docs
│   ├── scripts/hooks/            # 2 OpenSpec hooks
│   └── skills/retro-doc-sync/    # backfill specs/docs/tests for merged code
├── claylee-alien-defense/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/                    # register.tsx, sim/, draw/, art/, shared/ (pixel engine, MIT)
│   └── tests/                    # claude plugin test
├── cicd-watch/
│   ├── .claude-plugin/plugin.json  # userConfig: pollSeconds
│   ├── hooks/                    # register.tsx, gitlab.ts
│   ├── types/                    # $.state contract
│   └── tests/
└── prompt-nav/
    ├── .claude-plugin/plugin.json
    ├── hooks/                    # register.tsx, prompts.ts, transcript.py
    ├── types/                    # $.state contract
    └── tests/
```

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Development Workflow                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Development Loop                                                            │
│                                                                              │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │    Write / Edit      │───▶│  ● console.log check   at end of turn    │   │
│  │        Code          │    │                                          │   │
│  └──────────────────────┘    └──────────────────────────────────────────┘   │
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
                           └──────────────────────┘
```

## What's Included

### Hooks

| Event | Hook | Description |
|-------|------|-------------|
| Stop | global console.log check | Scan all git-changed files |
| tool.call (mod) | push guard | Deny `git push` until the checks in `.claude/push-checks.json` passed on the pushed tree; `/push-checks` shows status, `/push-checks run` runs them |

### Rules

Global rule installed to `~/.claude/rules/` for automatic enforcement (provided by **claylee-core**):

- **behavioral-contract** — 8 universal behavioral norms (Simplicity First, Surgical Changes, Read before Write, Fail Loud, etc.) adapted from Karpathy's CLAUDE.md template

### Skills

- **retro-doc-sync** — Backfill OpenSpec specs, Superpowers docs and tests for an MR, branch or commit range someone already merged, without touching production code
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

The pixel engine in `plugins/claylee-alien-defense/hooks/shared/` (bitmap, sprite, cells, colors, stage) comes from samurai-dojo in [theonly1me/claude-code-mods](https://github.com/theonly1me/claude-code-mods) (MIT License, Copyright (c) 2026 Atchyut); its license is kept beside it.
