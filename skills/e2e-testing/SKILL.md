---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  "handle test errors", "retry failed form submission", "classify test failures",
  or mentions Playwright testing, test maintenance, or test locators.
version: 1.1.0
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

For full delta classification table, change detection workflow, and change analysis template, see **`references/code-patterns.md`** § Incremental Test Maintenance.

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
- **Form submit success** — fill valid data → submit → verify success toast + list/page updates to reflect change
- **Form submit failure** — use invalid input that triggers real API error → verify error toast or inline error
- **Select / Dropdown** — click trigger → wait for dropdown content visible → select an option → verify trigger displays selected value
- **Rich text editor (Tiptap)** — click editor area → type text → verify content appears. Do NOT test toolbar formatting unless explicitly requested `[deep]`

#### Action Patterns

- **Toggle / Switch** — click → verify state change (visual or API call)
- **Delete confirmation** — open AlertDialog → fill confirmation input if required → submit → verify item removed from list
- **Drag and drop** — use Playwright `dragTo()` → verify order or position changes `[deep]`
- **Multi-role behavior** `[deep]`

**For Create Mode**: cover every item that applies to the target page. If an item cannot be tested without mocking, document it with `test.skip` and state the reason.

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
- **`references/code-patterns.md`** — BasePage implementation, POM examples (including tab-internal locators), test structure, incremental test maintenance (delta classification, change analysis template), UI pattern testing examples (table, select, form, pagination, nested specs), flaky patterns, artifact config, codegen workflow
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/report-template.md`** — Markdown report template and rules
- **`references/error-discrimination.md`** — Error Discrimination Framework: error classification decision flow, recoverable vs non-recoverable determination, retry strategy, detection code examples
