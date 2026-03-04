---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  or mentions Playwright testing, test maintenance, or test locators.
version: 1.2.0
---

# E2E Testing Patterns

Playwright patterns for building stable, fast, and maintainable E2E test suites. Core conventions are inline below; detailed code templates are in `references/`.

## Auth & Login Strategy

Test accounts stored in `.env.test.local` (gitignored). Five roles: sysadmin, orgOwner, projectManager, engineer, qa.

Use `storageState` to skip login — the auth setup project runs once, saves JWT to `.auth/sysadmin.json`, and all subsequent tests start authenticated. No `beforeEach` login needed.

- `.auth/` and `.env.test.local` must be in `.gitignore`
- For full credential format, auth.setup.ts, and multi-role config, see **`references/auth-patterns.md`**
  > Subagent: use `Glob("**/e2e-testing/references/auth-patterns.md")` to locate this file.

## BasePage Shared Class

All POM classes extend `BasePage` (`tests/e2e/pages/BasePage.ts`) which provides:

- Shared `page`, `toastSuccess`, `toastError` locators
- `waitForApi(urlPattern)` — wait for API response
- `waitForNavigation(urlPattern)` — wait for SPA route change
- `getSuccessToast()` / `getErrorToast()` — read toast message text
- Abstract `goto()` — each POM implements its own navigation

For full implementation, see **`references/code-patterns.md`** § BasePage.
> Subagent: use `Glob("**/e2e-testing/references/code-patterns.md")` to locate this file.

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
> Subagent: use `Glob("**/e2e-testing/references/code-patterns.md")` to locate this file.

## No Mock Data

**All E2E tests must hit the real running dev server.** Never use fabricated API responses.

- **Forbidden**: `route.fulfill()` with fake data, `route.abort()`, fake data constants, `waitForTimeout()` delays to simulate loading
- **Allowed**: `page.waitForResponse()` to wait for real API responses
- **Skip untestable states**: If a state (loading spinner, transient button disabled) can only be observed via mocking, do not test it in E2E — those belong in unit tests

## Test Scenario Guidelines

Not every feature requires all scenario types. Use judgement:

- **Happy path** — Always include
- **Invalid input** — When the feature accepts user input
- **Permission / role-based** — When the feature has role-based behavior
- **Empty state** — When the feature displays dynamic data
- **Error response** — When the feature depends on backend API calls

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

### Coverage Plan (Required for Deep Testing)

After recursive analysis, produce a Coverage Plan table before writing any tests:

| Component Path | Interactive Elements | Test Cases |
|---------------|---------------------|------------|
| `ProjectList/index.vue` | table, search, filter, refresh, add btn | 5 |
| `ProjectList/EditProjectDialog.vue` | dialog open/close | 2 |
| `ProjectList/EditProjectDialog.vue > GeneralTab` | name input, description, submit | 3 |
| `ProjectList/EditProjectDialog.vue > MembersTab` | member list, add/remove member | 3 |

**Validation rules:**
- Every component found in recursive analysis MUST appear in the Coverage Plan
- If a component is excluded, add a row with reason: `N/A — no interactive elements` or `N/A — shadcn primitive`
- The total test case count is the minimum — additional edge cases may be added during implementation
- Each row with test cases MUST map to a `test.describe` block in the spec

### Test Organization

**Simple pages**: One page = one spec file.

**Deep testing complex pages**: One page = one main spec + optional component spec files.
When a page has 3+ major interactive component groups (dialogs with tabs, complex forms),
split into separate spec files for parallel development:

- `{page}.spec.ts` — main page UI, toolbar, table, search, filter
- `{page}-{dialog}.spec.ts` — each major dialog/panel gets its own spec

All spec files share the same POM class. Each spec file is independently runnable.

Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

#### Nested Structure Example

```typescript
test.describe('Project List', () => {
  test.describe('Basic UI & Toolbar', () => { /* ... */ });
  test.describe('Search & Filter', () => { /* ... */ });

  test.describe('Edit Project Dialog', () => {
    test('should open edit dialog', async () => { /* ... */ });

    test.describe('General Tab', () => {
      test('should display form fields', async () => { /* ... */ });
      test('should validate required fields', async () => { /* ... */ });
      test('should save changes', async () => { /* ... */ });
    });

    test.describe('Members Tab', () => {
      test('should switch to members tab', async () => { /* ... */ });
      test('should list current members', async () => { /* ... */ });
    });
  });
});
```

### Interaction Depth Checklist

Consider all applicable interactions:
- Dialog open / close
- Form field fill (text, select, date, rich text)
- Required field validation (submit empty form)
- Form submit success (verify toast + list update)
- Form submit failure (verify error toast)
- Tab switching (verify content change)
- Table operations (sort, filter, pagination)
- Toggle / switch state changes
- Delete confirmation dialog
- Empty state display

## No Manual Screenshots

**Do NOT call `page.screenshot()` in spec files.** Playwright is configured with `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, and `trace: 'on-first-retry'` — all failure artifacts are captured automatically to `playwright/test-results/`.

Manual screenshots create clutter, are not gitignored properly, and duplicate built-in functionality.

## Running Tests

Always use `pnpm` scripts from `app/` directory (not `npx`):

```bash
cd app
E2E_REPORT_NAME=login-test-report pnpm test:e2e -- tests/e2e/auth/login.spec.ts    # Run specific spec
E2E_REPORT_NAME=project-list-test-report pnpm test:e2e                              # Run all tests
pnpm test:e2e -- --headed                                                            # See browser
pnpm test:e2e:ui                                                                     # Interactive UI
pnpm test:e2e:report                                                                 # View HTML report
```

Set `E2E_REPORT_NAME` to control report file naming (defaults to `latest` if not set).

## Dual Test Reports

Every test run produces:
1. HTML report at `playwright/reports/{report-name}/index.html`
2. Markdown report at `playwright/{report-name}.md`

Both use the same `{page-name}-test-report` identifier.
The report name is set via `E2E_REPORT_NAME` env var (defaults to `latest` if not set).

Use 繁體中文 for markdown reports, one table per `test.describe` group. Filename has no date (overwrites on re-run, date is in content).

For the full markdown template, see **`references/report-template.md`**.
> Subagent: use `Glob("**/e2e-testing/references/report-template.md")` to locate this file.

## Additional References

- **`references/auth-patterns.md`** — Credential format, auth.setup.ts, multi-role storageState
  > Subagent: use `Glob("**/e2e-testing/references/auth-patterns.md")` to locate this file.
- **`references/code-patterns.md`** — BasePage implementation, POM examples, test structure, flaky patterns, artifact management, codegen workflow
  > Subagent: use `Glob("**/e2e-testing/references/code-patterns.md")` to locate this file.
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
  > Subagent: use `Glob("**/e2e-testing/references/configuration.md")` to locate this file.
- **`references/report-template.md`** — Markdown report template and rules
  > Subagent: use `Glob("**/e2e-testing/references/report-template.md")` to locate this file.
