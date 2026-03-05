---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
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
1. Create entity with `[E2E]` name in test body
2. Assert success (toast + list update)
3. Clean up in `test.afterEach` or `test.afterAll` via `request` fixture

For **edit/delete** tests:
- Create dedicated test data in `test.beforeEach` via API (`request` fixture)
- Perform UI action
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

## Test Hygiene

- **Isolate tests** — Each test should be independent; no shared mutable state between tests
- **Fail fast** — Use `expect()` assertions at every key step; don't let tests drift after a critical failure
- **Wait for conditions, not time** — `waitForResponse()` > `waitForTimeout()`; never rely on arbitrary delays

## Anti-Patterns — Never Do These

- **Preemptive skip/fixme** — Do NOT mark tests as `test.fixme` or `test.skip` based on *assumptions* about speed or reliability. Always write and execute the full flow first. Only mark as `test.fixme` after the test actually fails on execution. For known slow operations (e.g. backend provisioning), extend the timeout with `test.setTimeout(120000)` instead of skipping.
- **Shallow tab/dialog testing** — Switching tabs and verifying they render is NOT sufficient coverage. Each tab panel is a sub-page — apply the full Interaction Depth Checklist to its content (tables, forms, dialogs inside the tab).
- **Missing form submit test** — Every form (create dialog, edit dialog, inline form) MUST have a happy-path submit test: fill required fields → submit → verify success toast + data update. This is the single most important test for any form. Never omit it.
- **Visibility-only assertions for data** — Do not stop at "element is visible". For tables, assert row count and cell content. For forms, verify field values are prefilled correctly. For selects, verify the selected value after interaction.

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

### Coverage Plan (Required for Create Mode AND Deep Test Mode)

After recursive analysis, produce a Coverage Plan table before writing any tests. This is mandatory whenever the page contains dialogs, tabs, or nested interactive containers.

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Page | `{Page}/index.vue` | table, toolbar buttons, search | table display, search, toolbar actions |
| {Dialog A} | `{DialogA}.vue > {FormComponent}` | form fields, submit btn | open/close, validation, **fill + submit + verify toast** |
| {Dialog B} > Tab 1 | `{Tab1Component}.vue` | table, add/remove, search | table content, CRUD operations, search |
| {Dialog B} > Tab 2 | `{Tab2Component}.vue` | form fields, selects, toggle | field interactions, form submit |
| ... | ... | ... | ... |

**Decomposition rules:**
- **Tabbed containers** — Each tab panel gets its own row(s). Tab switching alone is NOT a valid Coverage Plan entry. Analyze the component rendered inside each tab and list its interactive elements separately.
- **Dialogs with forms** — List every form's fields. Every form MUST have a "fill + submit + verify toast" scenario.
- **Nested dialogs** — If a tab/dialog opens another dialog (e.g. "Add Member" dialog inside Members tab), that inner dialog gets its own row.

**Validation rules:**
- Every component found in recursive analysis MUST appear in the Coverage Plan
- If a component is excluded, add a row with reason: `N/A — no interactive elements` or `N/A — shadcn primitive`
- **Every form MUST have a submit success row** — "fill + submit + verify toast" is never optional
- **Every tab panel MUST have its own row(s)** with the tab's internal components — not just "tab switching"
- Each row with test cases MUST map to a `test.describe` block in the spec
- If coverage is intentionally skipped, use `test.skip(true, 'reason')` in the spec — never silently omit

### Test Organization

One page = one spec file. Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

### Interaction Depth Checklist

All applicable items are **required** in Create Mode. Items marked `[deep]` are additionally required in Deep Test Mode.

#### Container Patterns

- **Dialog** — open → verify content visible → close (click cancel or X). For AlertDialog, verify confirm action works
- **Tabs** — switch to each tab → **then treat each tab panel as a sub-page**: recursively apply this entire checklist to the content within each tab. In Coverage Plan, list each tab's inner components explicitly
- **Popover / Filter panel** — open trigger → interact with inner controls → verify effect on parent page (e.g., table filters, row count changes) → close
- **Accordion / Collapsible** — expand → verify content visible → collapse `[deep]`

#### Data Display Patterns

- **Table** — assert row count > 0 and at least one cell has non-empty text. If sortable: click header, verify order changes. If expandable: expand a row, verify children appear
- **Pagination** — verify page info text (e.g., total count or "第 1 頁"), click next page, assert content or page indicator changes. If table above: verify rows update
- **Empty state** — when no data exists, verify empty state message or illustration is visible `[deep]`
- **Skeleton / Loading** — do NOT assert on loading states (transient); instead wait for skeleton to disappear before asserting content `[deep]`

#### Form Patterns

- **Form fields** — verify all expected fields are present (visible). Fill all required fields with valid data
- **Required field validation** — submit empty form or clear a required field, expect error message or disabled submit button
- **⚠️ Form submit success** — **MANDATORY for every form.** Fill valid data → submit → verify success toast + list/page updates to reflect change. Never skip this preemptively. For slow operations, extend timeout with `test.setTimeout()` instead of using `test.fixme`.
- **Form submit failure** — use invalid input that triggers real API error → verify error toast or inline error
- **Select / Dropdown** — click trigger → wait for dropdown content visible → select an option → verify trigger displays selected value
- **Rich text editor (Tiptap)** — click editor area → type text → verify content appears. Do NOT test toolbar formatting unless explicitly requested `[deep]`

#### Action Patterns

- **Toggle / Switch** — click → verify state change (visual or API call)
- **Delete confirmation** — open AlertDialog → fill confirmation input if required → submit → verify item removed from list
- **Drag and drop** — use Playwright `dragTo()` → verify order or position changes `[deep]`
- **Multi-role behavior** `[deep]`

**For Create Mode**: cover every item that applies to the target page. If an item cannot be tested without mocking, document it with `test.skip` and state the reason. If a test is slow but functional, extend the timeout — do not skip.

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
- **`references/code-patterns.md`** — BasePage implementation, POM examples (including tab-internal locators), test structure, UI pattern testing examples (table, select, form, pagination, nested specs), flaky patterns, artifact management, codegen workflow
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/report-template.md`** — Markdown report template and rules
