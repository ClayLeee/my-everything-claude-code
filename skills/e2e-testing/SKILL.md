---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  This skill should be used when the user asks to "write E2E tests", "add Playwright tests", "create page tests",
  "update E2E tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
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

### Test Organization

One page = one spec file. Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

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
pnpm test:e2e                                    # Run all tests
pnpm test:e2e -- tests/e2e/auth/login.spec.ts    # Run specific spec
pnpm test:e2e -- --headed                         # See browser
pnpm test:e2e:ui                                  # Interactive UI
pnpm test:e2e:report                              # View HTML report
```

## Dual Test Reports

Every test run produces: (1) HTML report at `playwright/reports/` via Playwright, (2) Markdown report at `playwright/{page-name}-test-report.md` (no date in filename, overwrites on re-run). Use 繁體中文 for markdown reports, one table per `test.describe` group.

For the full markdown template, see **`references/report-template.md`**.

## Additional References

- **`references/auth-patterns.md`** — Credential format, auth.setup.ts, multi-role storageState
- **`references/code-patterns.md`** — BasePage implementation, POM examples, test structure, flaky patterns, artifact management, codegen workflow
- **`references/configuration.md`** — Full playwright.config.ts template, file organization, CLI commands
- **`references/report-template.md`** — Markdown report template and rules
