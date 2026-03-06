---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, MCP browser validation, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  "MCP browser dry-run", "validate form via browser", "semantic analysis", "produce SET",
  or mentions Playwright testing, test maintenance, or test locators.
version: 1.1.0
---

# E2E Testing Patterns

Playwright patterns for building stable, fast, and maintainable E2E test suites.

## Core Principles

- **No Mock Data** — All tests hit the real running dev server. Never use `route.fulfill()`, `route.abort()`, or fabricated API responses. Use `page.waitForResponse()` to observe real API calls.
- **UI-Only Test Data** — Never use `request` fixture or direct API calls for setup, cleanup, or any data operation. All data manipulation goes through the UI. See **`references/test-data-policy.md`** for lifecycle patterns.
- **Recursive Depth** — Every tab panel, nested dialog, and child component receives full semantic analysis and test coverage. Shallow tab switching is an anti-pattern.

## Auth & Login Strategy

Store test accounts in `.env.test.local` (gitignored). Use `storageState` to skip login — the auth setup project runs once, saves JWT, and all subsequent tests start authenticated.

For credential format, `auth.setup.ts`, and multi-role config, see **`references/auth-patterns.md`**.

## Page Object Model

One page = one POM class extending `BasePage`. Initialize nested dialog/tab locators inside the `constructor` (not as class field initializers) to avoid TypeScript inheritance issues. Include locators for content within each tab panel, not just tab triggers.

For BasePage implementation, POM examples, and test structure templates, see **`references/code-patterns.md`**.

## Semantic Analysis

Before producing a Coverage Plan, perform structured semantic extraction from each Vue component. This replaces guesswork with evidence-based test strategy.

### Extraction Process

1. **Read template** — List interactive elements: `@click`, icons, `v-if`, `:disabled`, form inputs
2. **Serena `get_symbols_overview`** — Scan script skeleton: functions, refs, computed, emits
3. **Serena `find_symbol(handlerName, include_body=true)`** — Read handler implementation
4. **Serena `find_referencing_symbols`** — Trace handler to API module endpoint
5. **Serena `search_for_pattern`** — Find validation schema (Zod rules, required fields)
6. **Merge template + script** — Produce the Semantic Element Table (SET)

For small files (<100 lines), `Read` may be faster than Serena for steps 2–5.

### Mandatory Recursive Analysis

Semantic analysis MUST be performed recursively on the full component tree — not just the top-level page. Each tab panel's content component is a SEPARATE analysis target requiring its own Serena pass.

For the complete recursive procedure, Serena workflow per component, SET format with Container column, extraction clues table, behavior taxonomy, and a worked example, see **`references/semantic-analysis.md`**.

### SET → Coverage Plan

The Coverage Plan is mechanically derived from the SET:

1. Group SET rows by container (page, dialog, tab panel)
2. Each group = one Coverage Plan row
3. Every `form-submit` row → "fill + submit + toast + data update" scenario
4. Every `delete-confirm` row → "trigger + confirm + removal" scenario
5. Every table → per-column-type assertions
6. Every tab panel with interactive elements → its own Coverage Plan row(s)

For validation rules and decomposition details, see **`references/coverage-checklist.md`**.

## Anti-Patterns — Never Do These

- **`request` fixture / API calls** — Forbidden for any purpose. See § UI-Only Test Data.
- **Shallow tab/dialog testing** — Each tab is a sub-page requiring full Interaction Depth Checklist coverage.
- **Missing form submit test** — Every form MUST have a happy-path submit test.
- **Visibility-only assertions** — Assert row count and cell content, not just "element is visible."
- **Top-level-only Serena analysis** — Every child component (especially tab content) MUST be analyzed.
- **Preemptive skip/fixme** — Extend timeout with `test.setTimeout()` instead of skipping.
- **Skipping after failed MCP dry-run** — Investigate and fix, never skip or fall back to API calls.

## data-testid Convention

Format: `{page}-{component}-{element}[-{qualifier}]` — all kebab-case.

Add to: interactive elements, form inputs, tab triggers, table wrappers, dialog content wrappers.
Do NOT add to: decorative elements, layout wrappers, elements identifiable by role + accessible name.

```vue
<Button data-testid="project-list-add-btn">新增</Button>
<Button :data-testid="`project-list-row-${project.id}-edit-btn`">編輯</Button>
<DialogContent data-testid="project-list-edit-dialog">
```

## Locator Strategy (Priority Order)

1. `[data-testid="..."]` — Preferred
2. `getByRole()` — Semantic
3. `getByText()` — Visible text
4. `getByPlaceholder()` — Form inputs
5. CSS selectors — Last resort

Never use XPath or auto-generated class names.

## Incremental Test Maintenance

When UI code changes, update tests incrementally — never rebuild from scratch. Use `git diff --name-only` to detect changes, classify deltas, and apply Spec Modification Rules:

- Never delete and recreate a spec file — edit in place
- Add new tests at end of relevant `test.describe` block
- Remove tests only when corresponding UI is confirmed deleted

Before modifying any spec, produce a Change Analysis:

```
## Change Analysis
- Changed files: [list]
- Existing specs affected: [list]
- New / Obsolete / Modified scenarios: [lists with reasons]
```

## Running Tests

Always use `pnpm` scripts from `app/` directory:

```bash
cd app
E2E_REPORT_NAME=project-list pnpm test:e2e -- tests/e2e/projects/project-list.spec.ts
E2E_REPORT_NAME=login pnpm test:e2e -- --headed
pnpm test:e2e:ui        # Interactive UI (no report)
pnpm test:e2e:report    # View HTML report
```

Always set `E2E_REPORT_NAME` to avoid `playwright/reports/latest/` fallback. Do NOT call `page.screenshot()` in specs — Playwright captures failure artifacts automatically.

## Dual Test Reports

Every test run produces: (1) HTML report at `playwright/reports/{page-name}/`, (2) Markdown report at `playwright/{page-name}-test-report.md` (overwrites on re-run). Use 繁體中文 for markdown reports. See **`references/report-template.md`**.

## References

- **`references/auth-patterns.md`** — Credential format, auth.setup.ts, multi-role storageState
- **`references/code-patterns.md`** — BasePage, POM examples, test structure, flaky patterns, artifact management
- **`references/semantic-analysis.md`** — SET format, Serena recursive workflow, extraction rules, behavior taxonomy, column assertions, worked example
- **`references/coverage-checklist.md`** — Coverage Plan rules, validation rules, Interaction Depth Checklist
- **`references/test-data-policy.md`** — UI-Only lifecycle patterns, CRUD ordering, cleanup strategies
- **`references/mcp-discovery.md`** — MCP session auth, interactive exploration, form dry-run, MCP→Spec translation
- **`references/ui-patterns.md`** — Table, select/dropdown, form, pagination, nested spec code examples
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/report-template.md`** — Markdown report template and rules
