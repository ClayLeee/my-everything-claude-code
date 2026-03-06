---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, MCP browser validation, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  "MCP browser dry-run", "validate form via browser", "semantic analysis", "produce SET",
  or mentions Playwright testing, test maintenance, or test locators.
version: 1.0.1-beta.1
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

- Shared `page`, `toastSuccess`, `toastError` locators
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

## Real API Test Data Policy

Since tests hit the real API, destructive tests (create/edit/delete) must follow this policy to remain idempotent:

### Naming Convention

Use `[E2E]` prefix for test-created data so it's identifiable and cleanable:
- `[E2E] Create Test`
- `[E2E] Delete Target`

### Lifecycle

For **create** tests:
1. Open dialog/form **through the UI** (click add button)
2. Fill all required fields **through UI interactions** (locator.fill, locator.click, select options, pick dates)
3. Click submit button → wait for API response → assert success toast + list update
4. Clean up in `test.afterEach` or `test.afterAll` via `request` fixture (API delete)

⚠️ The test body MUST exercise the UI form — never use `request.post()` to create the entity in the test body itself. The `request` fixture is ONLY for cleanup and setup.

For **edit/delete** tests:
- Create dedicated test data in `test.beforeEach` via API (`request` fixture) — this is the ONLY place API creation is allowed
- Perform the edit/delete action **through the UI**
- Clean up if needed

For full lifecycle examples (create with cleanup, edit/delete with setup), see **`references/code-patterns.md`** § Real API Test Data Examples.

### When to Skip

If cleanup API doesn't exist for an entity type, use `test.skip(true, 'reason')` — don't silently omit the test.

## Test Scenario Guidelines

Not every feature requires all scenario types. Use judgement:

- **Happy path** — Always include
- **Invalid input** — When the feature accepts user input
- **Permission / role-based** — When the feature has role-based behavior
- **Empty state** — When the feature displays dynamic data
- **Error response** — When the feature depends on backend API calls

## Semantic Analysis

Before producing a Coverage Plan, perform structured semantic extraction from each Vue component to understand what every interactive element actually does. This replaces guesswork with evidence-based test strategy.

### Extraction Process

1. **Read template** — List interactive elements: `@click`, icons, `v-if`, `:disabled`, form inputs
2. **Serena `get_symbols_overview`** — Scan script skeleton: functions, refs, computed, emits
3. **Serena `find_symbol(handlerName, include_body=true)`** — Get handler implementation
4. **Serena `find_referencing_symbols`** — Trace handler to API module endpoint
5. **Serena `search_for_pattern`** — Find validation schema (Zod rules, required fields)
6. **Merge template + script analysis** — Produce the Semantic Element Table (SET)

For small files (<100 lines), `Read` may be faster than Serena for steps 2-5.

### Semantic Element Table (SET)

Each interactive element gets one row:

| # | Element | Type | Semantic | Handler/Event | API Call | Behavior | Test Strategy |
|---|---------|------|----------|---------------|----------|----------|---------------|
| 1 | Add Member button | button | add-member | `handleAddMember` | `POST /members` | form-submit | open → fill ALL fields → submit → waitForResponse → toast → table update → cleanup |
| 2 | Delete icon (Trash2) | icon-button | delete | `handleDelete` | `DELETE /members/:id` | delete-confirm | click → AlertDialog → confirm input → submit → waitForResponse → removal |

For the complete extraction clues table (handler names, icon names, i18n keys, emit events, API calls, UI patterns → behavior mapping), see **`references/code-patterns.md`** § Semantic Extraction Rules.

### Behavior Taxonomy

Each behavior (form-submit, delete-confirm, toggle, inline-edit, navigation, sort, filter, pagination, drag-reorder, static-display) maps to minimum required test steps, plus required error/boundary scenarios (empty fields, invalid input, cancel/close state cleanup, disabled states).

**Boundary principle**: Only test errors a user can trigger in normal operation. Do NOT mock network/server errors — violates No Mock Data principle. Derive specific error scenarios from Vue component's validation rules, disabled computed, and error handling code.

For the complete behavior → test steps mapping, error scenarios per behavior, and code examples, see **`references/code-patterns.md`** § Behavior Taxonomy.

### Table Column Assertion Rules

Replace generic "one cell non-empty" with type-specific assertions per column type (pure text, badge/status, progress, date, link/button, action column). Detect column type from Vue template (`<Badge>`, `<Progress>`, `formatDate()`, etc.) and apply matching assertion patterns.

For the complete column type → assertion mapping and code examples, see **`references/code-patterns.md`** § Table Column Assertion Rules.

### SET → Coverage Plan Derivation

The Coverage Plan is mechanically derived from the SET — not manually judged:

1. Group SET rows by container (page, dialog, tab panel)
2. Each group = one Coverage Plan row
3. Test Scenarios = union of all Test Strategy entries in that group
4. Every `form-submit` row MUST produce a "fill + submit + toast + data update" scenario
5. Every `delete-confirm` row MUST produce a "trigger + confirm + removal" scenario
6. Every table MUST have per-column-type assertions

For a complete worked example (component tree → SET → Coverage Plan → test.describe blocks), see **`references/code-patterns.md`** § Worked Example.

## Test Hygiene

- **Isolate tests** — Each test should be independent; no shared mutable state between tests
- **Fail fast** — Use `expect()` assertions at every key step; don't let tests drift after a critical failure
- **Wait for conditions, not time** — `waitForResponse()` > `waitForTimeout()`; never rely on arbitrary delays

## Anti-Patterns — Never Do These

- **Preemptive skip/fixme** — Do NOT mark tests as `test.fixme` or `test.skip` based on *assumptions* about speed or reliability. Always write and execute the full flow first. Only mark as `test.fixme` after the test actually fails on execution. For known slow operations (e.g. backend provisioning), extend the timeout with `test.setTimeout(120000)` instead of skipping.
- **Shallow tab/dialog testing** — Switching tabs and verifying they render is NOT sufficient coverage. Each tab panel is a sub-page — apply the full Interaction Depth Checklist to its content (tables, forms, dialogs inside the tab).
- **Missing form submit test** — Every form (create dialog, edit dialog, inline form) MUST have a happy-path submit test: fill required fields → submit → verify success toast + data update. This is the single most important test for any form. Never omit it.
- **Visibility-only assertions for data** — Do not stop at "element is visible". For tables, assert row count and cell content. For forms, verify field values are prefilled correctly. For selects, verify the selected value after interaction.
- **API-as-substitute for UI interaction** — NEVER use `request.post()` / `request.get()` in the test body as a substitute for filling a form through the UI. The purpose of E2E tests is to exercise the actual user interface. The `request` fixture is ONLY for: (1) **cleanup** in `afterEach`/`afterAll` — deleting test data, (2) **setup** in `beforeEach` — creating prerequisite data for edit/delete tests. If a form has complex fields (selects, date pickers, comboboxes), the test MUST interact with those UI elements through Playwright locators, not bypass them with API calls.
- **Skipping after failed MCP dry-run** — When MCP browser interaction fails (form submit, tab content, dialog), investigate the root cause and fix it (missing data-testid, wrong locator, UI bug). Do NOT skip the test or fall back to API calls. The MCP dry-run failure is a signal that the spec would also fail — fix the problem first.

## Incremental Test Maintenance

When UI code changes, incrementally update tests — never rebuild from scratch.

### Change Detection

Use `git diff --name-only` (current branch vs base) to find changed Vue files under `app/src/views/` and `app/src/components/`.

### Delta Classification

| Change Type | Action |
|-------------|--------|
| New element/component added | Add test cases + locators |
| Element/component removed | Remove related test cases + locators |
| Element renamed / restructured | Update locators and assertions |
| Internal logic refactor (no UI change) | No spec changes needed |
| Props/events changed | Update POM methods if affected |

### Spec Modification Rules

- **Never** delete and recreate a spec file — always edit in place
- Preserve existing test order, `test.describe` grouping, and flaky markers
- Add new tests at the end of the relevant `test.describe` block
- Remove tests only when the corresponding UI is confirmed deleted

### Change Analysis Template

Before modifying any spec, produce this analysis:

```
## Change Analysis
- Changed files: [list of Vue files]
- Existing specs affected: [list of spec files]
- New scenarios needed: [list]
- Obsolete scenarios: [list]
- Modified scenarios: [list with reason]
```

## Locator Strategy (Priority Order)

1. `[data-testid="..."]` — Preferred, stable across refactors
2. `getByRole()` — Accessible, semantic
3. `getByText()` — For visible text content
4. `getByPlaceholder()` — For form inputs
5. CSS selectors — Last resort only

**Never use**: XPath, auto-generated class names

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
| `toast-success` | Global success toast notification |

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

### Coverage Plan (Required)

After recursive analysis, produce a Coverage Plan table before writing any tests. Mandatory whenever the page contains dialogs, tabs, or nested interactive containers.

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Page | `{Page}/index.vue` | table, toolbar buttons, search | table display, search, toolbar actions |
| {Dialog A} | `{DialogA}.vue > {FormComponent}` | form fields, submit btn | open/close, validation, **fill + submit + verify toast** |
| {Dialog B} > Tab 1 | `{Tab1Component}.vue` | table, add/remove, search | table content, CRUD operations, search |
| {Dialog B} > Tab 2 | `{Tab2Component}.vue` | form fields, selects, toggle | field interactions, form submit |

Key rules: each tab panel gets its own row(s) (tab switching alone is invalid). Every form MUST have a "fill + submit + verify toast" row. Each row maps to a `test.describe` block.

For full decomposition and validation rules, see **`references/code-patterns.md`** § Coverage Plan Rules.

### Test Organization

One page = one spec file. Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

### Interaction Depth Checklist

Apply to every container (dialog, tab panel, form) found in the Coverage Plan. All applicable items are required.

For the full checklist (containers, data display, forms, actions), see **`references/code-patterns.md`** § Interaction Depth Checklist.

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
- **`references/code-patterns.md`** — BasePage implementation, POM examples (including tab-internal locators), test structure, UI pattern testing examples (table, select, form, pagination, nested specs), Coverage Plan rules, Interaction Depth Checklist, MCP-Driven Test Discovery (session auth, exploration, form dry-run, MCP→Spec translation), flaky patterns, artifact management, Semantic Analysis Reference (extraction rules, behavior taxonomy code examples, column assertion rules, worked example)
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/report-template.md`** — Markdown report template and rules
