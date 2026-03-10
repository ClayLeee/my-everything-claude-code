---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  "handle test errors", "retry failed form submission", "classify test failures",
  "test a remote URL", "remote test", "test this URL", "遠端測試", "測試網址",
  or mentions Playwright testing, test maintenance, or test locators.
version: 1.0.1-beta.7
---

# E2E Testing Patterns

Playwright patterns for building stable, fast, and maintainable E2E test suites. Core conventions are inline below; detailed code templates are in `references/`.

## Auth & Login Strategy

Test accounts stored in `.env.test.local` (gitignored). Five roles: sysadmin, orgOwner, projectManager, engineer, qa.

Use `storageState` to skip login — the auth setup project runs once, saves JWT to `.auth/sysadmin.json`, and all subsequent tests start authenticated. No `beforeEach` login needed.

- `.auth/` and `.env.test.local` must be in `.gitignore`
- For full credential format, auth.setup.ts, and multi-role config, see **`references/auth-patterns.md`**

## BasePage Shared Class

All POM classes extend `BasePage` (`tests/e2e/pages/BasePage.ts`) which provides:

- Shared `page`, `toastSuccess`, `toastError` locators (vue-sonner `[data-sonner-toast][data-type="success|error"]`)
- `waitForApi(urlPattern)` — wait for API response
- `waitForNavigation(urlPattern)` — wait for SPA route change
- `getSuccessToast()` / `getErrorToast()` — read toast message text
- Abstract `goto()` — each POM implements its own navigation

For full implementation, see **`references/code-patterns.md`** § BasePage.

## Page Object Model (POM)

One page = one POM class extending `BasePage`. For pages with dialogs/tabs, use nested object structure:

```typescript
readonly createDialog = {
  container: this.page.locator('[data-testid="project-list-create-dialog"]'),
  nameInput: this.page.locator('[data-testid="project-list-create-dialog-name-input"]'),
  submitBtn: this.page.locator('[data-testid="project-list-create-dialog-submit-btn"]'),
}
```

For full POM examples (basic + deep testing), see **`references/code-patterns.md`** § POM Examples.

## No Mock Data

**All E2E tests must hit the real running dev server.** Never use fabricated API responses. This rule is absolute — there are no exceptions.

### Forbidden

- `route.fulfill()` with fabricated response bodies — this is mock data
- `route.abort()` to simulate network failures — use real error conditions instead
- Fake data constants (e.g. `MOCK_AUTH_METHODS_RESPONSE`) in test files
- `page.route()` + `waitForTimeout()` to simulate loading states
- Any test scenario that requires fabricated API responses to function

### What to Do Instead

- **Test against real API** — Hit the actual dev server, assert on real results
- **Trigger real errors** — Use wrong credentials, invalid input, missing fields to produce real API errors
- **Skip untestable states** — If a state (loading spinner, transient button disabled) can only be observed via mocking, it does not belong in E2E tests
- **Use `page.waitForResponse()`** — Waiting for real API responses is fine; intercepting and replacing them is not

## UI-Only Test Data Policy

All test data manipulation MUST go through the UI — no `request` fixture, no API calls in `beforeEach`/`afterEach`. Tests behave exactly like a real user.

### Naming Convention

Use `[E2E]` prefix for test-created data so it's identifiable and cleanable:
- `[E2E] Create Test`
- `[E2E] Delete Target`

### Lifecycle

For **create** tests:
1. Open dialog/form through UI (click add button)
2. Fill all required fields through UI interactions
3. Submit → wait for API response → assert success toast + list update
4. Clean up through UI — search `[E2E]` data → delete via UI delete button

For **edit** tests:
- Use existing data on the page (first row) — do NOT create via API
- Record original values → edit through UI → assert success → restore original values through UI

For **delete** tests:
- Create the delete target through UI first (open create dialog → fill → submit)
- Search for the created data → delete through UI → confirm → assert removal

Use `test.describe.serial` to chain create → verify → delete within one group.

For full lifecycle examples and code patterns, see **`references/test-data-policy.md`**.

### When UI Cleanup Is Not Possible

If no delete UI exists, accept data persistence — use unique identifiers per run (timestamp suffix) to avoid collisions. Do NOT fall back to API cleanup.

## Test Scenario Guidelines

Not every feature requires all scenario types. Use judgement:

- **Happy path** — Always include
- **Invalid input** — When the feature accepts user input
- **Permission / role-based** — When the feature has role-based behavior
- **Empty state** — When the feature displays dynamic data
- **Error response** — When the feature depends on backend API calls. For detailed error classification (recoverable vs non-recoverable) and retry strategy, see **`references/error-discrimination.md`**

## Test Hygiene

- **Isolate tests** — Each test should be independent; no shared mutable state between tests
- **Fail fast** — Use `expect()` assertions at every key step; don't let tests drift after a critical failure
- **Wait for conditions, not time** — `waitForResponse()` > `waitForTimeout()`; never rely on arbitrary delays

## Incremental Test Maintenance

When UI code changes, incrementally update tests — never rebuild from scratch. Key rules:

- **Never** delete and recreate a spec file — always edit in place
- Preserve existing test order, `test.describe` grouping, and flaky markers
- Before modifying any spec, produce a Change Analysis (changed files, affected specs, new/obsolete/modified scenarios)

## Locator Strategy (Priority Order)

1. `[data-testid="..."]` — Preferred, stable across refactors
2. `getByRole()` — Accessible, semantic
3. `getByText()` — For visible text content
4. `getByPlaceholder()` — For form inputs
5. CSS selectors — Last resort only

**Never use**: XPath, auto-generated class names

> **Remote Test Mode exception**: When testing remote URLs without source code access, the priority order is reversed: `getByRole()` > `getByText()` > `getByPlaceholder()` > `getByLabel()` > CSS > `[data-testid]` (only if already present on the remote site). See **`references/remote-testing.md`** § Remote Locator Strategy for the full MCP ARIA → Playwright locator mapping table.

## data-testid Convention

### Naming Format

`{page}-{component}-{element}[-{qualifier}]` — all kebab-case.

### Examples

| data-testid | Description |
|-------------|-------------|
| `project-list-add-btn` | Add button on project list page |
| `project-list-edit-dialog` | Edit dialog on project list |
| `project-list-edit-dialog-tab-members` | Members tab inside edit dialog |
| `login-username-input` | Username input on login page |
| `login-sso-gitlab-btn` | GitLab SSO button on login page |

### Placement Rules

**Add to:** interactive elements (buttons, links, toggles), all form inputs, tab triggers, table wrappers, dialog content wrappers, toast containers.

**Do NOT add to:** purely decorative elements, layout wrappers, elements already uniquely identifiable by role + accessible name.

### Vue Syntax

```vue
<!-- Static -->
<Button data-testid="project-list-add-btn">新增</Button>
<!-- Dynamic -->
<Button :data-testid="`project-list-row-${project.id}-edit-btn`">編輯</Button>
<!-- shadcn-vue pass-through -->
<DialogContent data-testid="project-list-edit-dialog">
```

The POM class itself serves as the registry of all `data-testid` values — no separate mapping file.

## Comprehensive Page Testing (Deep Testing)

### Component Tree Recursive Analysis

1. Read the page's `index.vue` (or main component)
2. Identify all imported child components
3. Recursively read children to find further children
4. Stop at leaf nodes (shadcn-vue primitives, HTML elements)
5. Record all interactive elements at each level
6. For containers with tabs, list every tab panel and its inner components separately in the Coverage Plan — each tab is a sub-page requiring its own analysis

For the full semantic extraction procedure (recursive analysis, SET table, behavior taxonomy), see **`references/semantic-analysis.md`**. For Coverage Plan decomposition rules and validation, see **`references/coverage-checklist.md`**. For MCP browser-driven test discovery (session auth, exploration, form dry-run), see **`references/mcp-discovery.md`**.

> **Remote Test Mode**: When testing remote URLs without local source code, skip file-based component tree analysis entirely. Instead, use MCP browser exploration (`browser_navigate` → `browser_snapshot`) to discover page structure, interactive elements, and form fields. See **`references/remote-testing.md`** § MCP Exploration Workflow for the complete discovery procedure.

### Test Organization

One page = one spec file. Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

### Interaction Depth Checklist

Apply to every container (dialog, tab panel, form) found in the Coverage Plan. Covers four categories: **Container Patterns** (dialog, tabs, popover, accordion), **Data Display** (table, pagination, empty state), **Form Patterns** (fields, validation, submit, select, rich text), and **Action Patterns** (toggle, delete confirm, drag-and-drop, multi-role).

Key mandatory items: every form MUST have a "fill + submit + verify toast" test; every table MUST have row count + per-column-type assertions; every tab panel MUST be treated as a sub-page with its own recursive checklist application.

For the complete checklist with all items and rules, see **`references/coverage-checklist.md`** § Interaction Depth Checklist. For runnable code examples of each pattern, see **`references/ui-patterns.md`**.

## No Manual Screenshots

**Do NOT call `page.screenshot()` in spec files.** Playwright is configured with `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, and `trace: 'on-first-retry'` — all failure artifacts are captured automatically to `playwright/test-results/`.

Manual screenshots create clutter, are not gitignored properly, and duplicate built-in functionality.

## Running Tests

Always use `pnpm` scripts from `app/` directory (not `npx`):

```bash
cd app
# Always set E2E_REPORT_NAME to avoid playwright/reports/latest/ fallback
E2E_REPORT_NAME=project-list pnpm test:e2e -- tests/e2e/projects/project-list.spec.ts
E2E_REPORT_NAME=login pnpm test:e2e -- tests/e2e/auth/login.spec.ts
E2E_REPORT_NAME=project-list pnpm test:e2e -- --headed   # See browser
pnpm test:e2e:ui                                          # Interactive UI (no report)
pnpm test:e2e:report                                      # View HTML report
```

## Dual Test Reports

Every test run produces: (1) HTML report at `playwright/reports/{page-name}/` — requires `E2E_REPORT_NAME={page-name}` env var (otherwise falls back to `playwright/reports/latest/`), (2) Markdown report at `playwright/{page-name}-test-report.md` (no date in filename, overwrites on re-run). Use 繁體中文 for markdown reports, one table per `test.describe` group.

For the full markdown template, see **`references/report-template.md`**.

## Additional References

- **`references/auth-patterns.md`** — Credential format, auth.setup.ts, multi-role storageState
- **`references/code-patterns.md`** — BasePage implementation, POM examples (including tab-internal locators), test structure, flaky patterns, artifact config, codegen workflow
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/coverage-checklist.md`** — Coverage Plan decomposition rules, validation rules, Interaction Depth Checklist details
- **`references/error-discrimination.md`** — Error Discrimination Framework: error classification decision flow, recoverable vs non-recoverable determination, retry strategy, detection code examples
- **`references/mcp-discovery.md`** — MCP-Driven Test Discovery: session auth, page exploration, form dry-run, MCP→Spec translation
- **`references/report-template.md`** — Markdown report template and rules
- **`references/semantic-analysis.md`** — Semantic Analysis: recursive extraction procedure, Semantic Element Table (SET), behavior taxonomy, column assertion rules, worked example
- **`references/test-data-policy.md`** — UI-Only Test Data Policy: forbidden API patterns, lifecycle examples (create with cleanup, edit/delete with setup)
- **`references/remote-testing.md`** — Remote Test Mode: scaffold minimal Playwright project, MCP auth bridging, remote locator strategy, MCP exploration workflow, RemoteBasePage pattern
- **`references/ui-patterns.md`** — UI pattern testing code examples: table, select, form, pagination, nested specs
