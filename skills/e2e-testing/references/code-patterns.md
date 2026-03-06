# Code Patterns

## BasePage Shared Class — `tests/e2e/pages/BasePage.ts`

All POM classes extend `BasePage` to share common functionality:

```typescript
import type { Locator, Page } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;
  readonly toastSuccess: Locator;
  readonly toastError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastSuccess = page.locator('[data-testid="toast-success"]');
    this.toastError = page.locator('[data-testid="toast-error"]');
  }

  /** Navigate to the page's route */
  abstract goto(): Promise<void>;

  /** Wait for API response matching the URL pattern */
  async waitForApi(urlPattern: string, status = 200) {
    await this.page
      .waitForResponse(
        (resp) => resp.url().includes(urlPattern) && resp.status() === status,
        { timeout: 10000 }
      )
      .catch(() => {});
  }

  /** Wait for navigation to complete */
  async waitForNavigation(urlPattern: string) {
    await this.page.waitForURL(urlPattern, { timeout: 15000 });
  }

  /** Get toast success message text */
  async getSuccessToast(): Promise<string> {
    await this.toastSuccess.waitFor({ state: "visible" });
    return (await this.toastSuccess.textContent()) ?? "";
  }

  /** Get toast error message text */
  async getErrorToast(): Promise<string> {
    await this.toastError.waitFor({ state: "visible" });
    return (await this.toastError.textContent()) ?? "";
  }
}
```

## POM Examples

### Basic POM

```typescript
import { type Page, type Locator } from '@playwright/test'
import { BasePage } from './BasePage'

export class ItemsPage extends BasePage {
  readonly searchInput: Locator
  readonly itemCards: Locator
  readonly createButton: Locator

  constructor(page: Page) {
    super(page)
    this.searchInput = page.locator('[data-testid="search-input"]')
    this.itemCards = page.locator('[data-testid="item-card"]')
    this.createButton = page.locator('[data-testid="create-btn"]')
  }

  async goto() {
    await this.page.goto('/items')
    await this.page.waitForLoadState('networkidle')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForResponse(resp => resp.url().includes('/api/search'))
    await this.page.waitForLoadState('networkidle')
  }

  async getItemCount() {
    return await this.itemCards.count()
  }
}
```

### Deep Testing POM (Nested Dialog/Tab Structure)

One page = one POM file. Use nested object structure for dialog/tab locators. For tabs, include locators for the **content within** each tab panel (tables, forms, selects), not just the tab triggers:

```typescript
export class ProjectListPage extends BasePage {
  // Page-level locators
  readonly table: Locator
  readonly addButton: Locator

  // Nested dialog locators
  readonly createDialog = {
    container: this.page.locator('[data-testid="project-list-create-dialog"]'),
    nameInput: this.page.locator('[data-testid="project-list-create-dialog-name-input"]'),
    submitBtn: this.page.locator('[data-testid="project-list-create-dialog-submit-btn"]'),
  }

  readonly editDialog = {
    container: this.page.locator('[data-testid="project-list-edit-dialog"]'),
    // Tab triggers
    tabInfo: this.page.locator('[data-testid="project-list-edit-dialog-tab-info"]'),
    tabMembers: this.page.locator('[data-testid="project-list-edit-dialog-tab-members"]'),
    tabSettings: this.page.locator('[data-testid="project-list-edit-dialog-tab-settings"]'),
    // Info tab content
    nameInput: this.page.locator('[data-testid="project-list-edit-dialog-name-input"]'),
    descInput: this.page.locator('[data-testid="project-list-edit-dialog-desc-input"]'),
    submitBtn: this.page.locator('[data-testid="project-list-edit-dialog-submit-btn"]'),
    // Members tab content
    membersTable: this.page.locator('[data-testid="project-list-edit-dialog-members-table"]'),
    membersRows: this.page.locator('[data-testid="project-list-edit-dialog-members-table"] tbody tr'),
    addMemberBtn: this.page.locator('[data-testid="project-list-edit-dialog-add-member-btn"]'),
    // Settings tab content
    visibilitySelect: this.page.locator('[data-testid="project-list-edit-dialog-visibility-select"]'),
  }

  constructor(page: Page) {
    super(page)
    this.table = page.locator('[data-testid="project-list-table"]')
    this.addButton = page.locator('[data-testid="project-list-add-btn"]')
  }

  async goto() {
    await this.page.goto('/projects')
    await this.page.waitForLoadState('networkidle')
  }
}
```

### Test Structure Example

```typescript
import { test, expect } from '@playwright/test'
import { ItemsPage } from '../pages/ItemsPage'

test.describe('Item Search', () => {
  let itemsPage: ItemsPage

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page)
    await itemsPage.goto()
  })

  test('should search by keyword', async ({ page }) => {
    await itemsPage.search('test')

    const count = await itemsPage.getItemCount()
    expect(count).toBeGreaterThan(0)

    await expect(itemsPage.itemCards.first()).toContainText(/test/i)
  })

  test('should handle no results', async ({ page }) => {
    await itemsPage.search('xyznonexistent123')

    await expect(page.locator('[data-testid="no-results"]')).toBeVisible()
    expect(await itemsPage.getItemCount()).toBe(0)
  })
})
```

## Flaky Test Patterns

### Quarantine

```typescript
test('flaky: complex search', async ({ page }) => {
  test.fixme(true, 'Flaky - Issue #123')
  // test code...
})

test('conditional skip', async ({ page }) => {
  test.skip(process.env.CI, 'Flaky in CI - Issue #123')
  // test code...
})
```

### Identify Flakiness

```bash
npx playwright test tests/search.spec.ts --repeat-each=10
npx playwright test tests/search.spec.ts --retries=3
```

### Common Causes & Fixes

**Race conditions:**
```typescript
// Bad: assumes element is ready
await page.click('[data-testid="button"]')

// Good: auto-wait locator
await page.locator('[data-testid="button"]').click()
```

**Network timing:**
```typescript
// Bad: arbitrary timeout
await page.waitForTimeout(5000)

// Good: wait for specific condition
await page.waitForResponse(resp => resp.url().includes('/api/data'))
```

**Animation timing:**
```typescript
// Bad: click during animation
await page.click('[data-testid="menu-item"]')

// Good: wait for stability
await page.locator('[data-testid="menu-item"]').waitFor({ state: 'visible' })
await page.waitForLoadState('networkidle')
await page.locator('[data-testid="menu-item"]').click()
```

**SPA navigation:**
```typescript
// Bad: check URL immediately
expect(page.url()).toContain('/target')

// Good: wait for navigation
await page.waitForURL('**/target')
```

## Artifact Management

**Do NOT use manual `page.screenshot()` in specs.** Playwright's built-in config handles all artifacts automatically:

```typescript
// playwright.config.ts — already configured
use: {
  screenshot: 'only-on-failure',  // Auto-capture on failure
  video: 'retain-on-failure',     // Keep video for failed tests
  trace: 'on-first-retry',        // Capture trace on retry
}
outputDir: 'playwright/test-results',  // All artifacts go here
```

All failure artifacts (screenshots, videos, traces) are saved to `playwright/test-results/` automatically. No manual screenshot calls needed.

## Codegen Workflow

```bash
npx playwright codegen http://localhost:5173
```

After recording:
1. Replace CSS selectors with `data-testid` locators
2. Extract page interactions into POM classes
3. Add meaningful assertions
4. Remove unnecessary `waitForTimeout` calls

## Coverage Plan Rules

### Coverage Requirements

Every Coverage Plan row MUST have corresponding tests. Each tab panel's primary content (tables, forms) must be tested. All Interaction Depth Checklist items apply. Use `--repeat-each=3` for flakiness detection.

### Decomposition Rules

- **Tabbed containers** — Each tab panel gets its own row(s). Tab switching alone is NOT a valid Coverage Plan entry. Analyze the component rendered inside each tab and list its interactive elements separately.
- **Dialogs with forms** — List every form's fields. Every form MUST have a "fill + submit + verify toast" scenario.
- **Nested dialogs** — If a tab/dialog opens another dialog (e.g. "Add Member" dialog inside Members tab), that inner dialog gets its own row.

### Validation Rules

- Every component found in recursive analysis MUST appear in the Coverage Plan
- If a component is excluded, add a row with reason: `N/A — no interactive elements` or `N/A — shadcn primitive`
- **Every form MUST have a submit success row** — "fill + submit + verify toast" is never optional
- **Every tab panel MUST have its own row(s)** with the tab's internal components — not just "tab switching"
- Each row with test cases MUST map to a `test.describe` block in the spec
- If coverage is intentionally skipped, use `test.skip(true, 'reason')` in the spec — never silently omit

## Interaction Depth Checklist

Apply to every container (dialog, tab panel, form). All applicable items are required.

### Container Patterns

- **Dialog** — open → verify content visible → close (click cancel or X). For AlertDialog, verify confirm action works
- **Tabs** — switch to each tab → **then treat each tab panel as a sub-page**: recursively apply this entire checklist to the content within each tab. In Coverage Plan, list each tab's inner components explicitly
- **Popover / Filter panel** — open trigger → interact with inner controls → verify effect on parent page (e.g., table filters, row count changes) → close
- **Accordion / Collapsible** — expand → verify content visible → collapse

### Data Display Patterns

- **Table** — assert row count > 0. For each column, apply assertion matching its column type (see § Table Column Assertion Rules — Code Examples below). If sortable: click header, verify order changes. If expandable: expand a row, verify children appear
- **Pagination** — verify page info text (e.g., total count or "第 1 頁"), click next page, assert content or page indicator changes. If table above: verify rows update
- **Empty state** — when no data exists, verify empty state message or illustration is visible
- **Skeleton / Loading** — do NOT assert on loading states (transient); instead wait for skeleton to disappear before asserting content

### Form Patterns

- **Form fields** — verify all expected fields are present (visible). Fill all required fields with valid data
- **Required field validation** — submit empty form or clear a required field, expect error message or disabled submit button
- **Form submit success** — **MANDATORY for every form.** Fill valid data → submit → verify success toast + list/page updates to reflect change. Never skip this preemptively. For slow operations, extend timeout with `test.setTimeout()` instead of using `test.fixme`.
- **Form submit failure** — use invalid input that triggers real API error → verify error toast or inline error
- **Select / Dropdown** — click trigger → wait for dropdown content visible → select an option → verify trigger displays selected value
- **Rich text editor (Tiptap)** — click editor area → type text → verify content appears. Do NOT test toolbar formatting unless explicitly requested

### Action Patterns

- **Toggle / Switch** — click → verify state change (visual or API call)
- **Delete confirmation** — open AlertDialog → fill confirmation input if required → submit → verify item removed from list
- **Drag and drop** — use Playwright `dragTo()` → verify order or position changes
- **Multi-role behavior** — test different roles if applicable

Cover every item that applies to the target page. If an item cannot be tested without mocking, document it with `test.skip` and state the reason. If a test is slow but functional, extend the timeout — do not skip.

## MCP-Driven Test Discovery

After injecting `data-testid` and before writing POM/spec, use Playwright MCP browser to actually interact with the page. This is the "try before write" approach.

### MCP Session Authentication

MCP browser and `@playwright/test` storageState are separate — MCP needs its own login:
1. `browser_navigate` → login page
2. `browser_fill_form` → fill test account credentials
3. `browser_click` → submit login
4. `browser_wait_for` → wait for navigation to complete

### Interactive Exploration

After navigating to the target page:
- `browser_snapshot` → get ARIA tree to understand page structure
- `browser_run_code` → verify `data-testid` attributes exist and are unique
- Open each tab/dialog via `browser_click` → `browser_snapshot` → record content
- Update Coverage Plan if actual page differs from static Vue file analysis

### Form Dry-Run (mandatory for every form)

For each form in the Coverage Plan:
1. Open dialog via MCP → fill test data → submit
2. Verify success toast via `browser_snapshot`
3. Cleanup test data via `browser_run_code` (API delete)
4. If dry-run fails → investigate and fix. Never skip.

### MCP → Spec Translation

MCP snapshot uses ARIA `ref` to identify elements (no `data-testid`/`id`/`class` in snapshot).
Translation rules:
- MCP action succeeds → identify the corresponding `data-testid` locator → write into spec
- Use `browser_run_code` to query element's `data-testid`:
  ```javascript
  await page.locator('[aria-label="..."]').getAttribute('data-testid')
  ```
- Specs MUST use `page.locator('[data-testid="..."]')` — never MCP `ref` values

## MCP Pre-Validation Workflow

### Step 1: MCP Dry-Run (in agent's MCP session)

Agent uses MCP tools to validate the full interaction flow:

```
browser_navigate → /overview/project-list
browser_click → [Add Project button]
browser_fill_form → [{name: "Project Name", ref: "N1", value: "[E2E] Test"}]
browser_click → [Submit button]
browser_snapshot → verify toast visible in ARIA tree
browser_run_code → cleanup: await fetch('/prod-api/v3/projects/...', {method: 'DELETE'})
```

### Step 2: Map MCP refs to data-testid

Use `browser_run_code` to find the `data-testid` for elements interacted via MCP:

```javascript
// In browser_run_code
const testIds = await page.locator('[data-testid]').evaluateAll(
  els => els.map(el => ({
    testid: el.getAttribute('data-testid'),
    tag: el.tagName,
    text: el.textContent?.trim().slice(0, 30)
  }))
);
return testIds;
```

### Step 3: Translate to Spec Code

Based on the successful MCP dry-run, write the corresponding spec:

```typescript
test('should create project via UI form', async ({ page }) => {
  const listPage = new ProjectListPage(page)
  await listPage.goto()
  await listPage.clickAddProject()

  // Fill form — each line validated via MCP dry-run
  await listPage.createDialog.nameInput.fill('[E2E] Test')
  // ... other fields validated in MCP

  const apiPromise = listPage.waitForApi('/v3/projects')
  await listPage.createDialog.submitBtn.click()
  await apiPromise

  const toast = await listPage.getSuccessToast()
  expect(toast).toContain('成功')
})
```

Every `fill`/`click` in the spec corresponds to a MCP action that was verified to work.

## Real API Test Data Examples

### Create with Cleanup

```typescript
test.describe('Create Project', () => {
  const TEST_NAME = '[E2E] Create Test'

  test.afterEach(async ({ request }) => {
    // Best-effort cleanup
    const resp = await request.get('/prod-api/v3/projects?keyword=[E2E]')
    if (resp.ok()) {
      const data = await resp.json()
      for (const p of data.data ?? []) {
        await request.delete(`/prod-api/v3/projects/${p.id}`).catch(() => {})
      }
    }
  })

  test('should create project and show success toast', async ({ page }) => {
    const listPage = new ProjectListPage(page)
    await listPage.goto()
    await listPage.clickAddProject()
    await listPage.createDialog.nameInput.fill(TEST_NAME)
    // fill other required fields...
    const apiPromise = listPage.waitForApi('/v3/projects')
    await listPage.createDialog.submitBtn.click()
    await apiPromise
    const toast = await listPage.getSuccessToast()
    expect(toast).toContain('成功')
  })
})
```

## UI Pattern Testing Examples

### Table Assertion

Always verify row count **and** cell content — not just that the table exists:

```typescript
// Assert table has data
const rows = page.locator('[data-testid="members-table"] tbody tr')
expect(await rows.count()).toBeGreaterThan(0)

// Assert cell content is non-empty
const firstCell = rows.first().locator('td').first()
await expect(firstCell).not.toHaveText('')
```

### Select / Dropdown Interaction

shadcn-vue Select uses Radix portal — the dropdown content renders **outside** the parent container:

```typescript
// Click the select trigger
await page.locator('[data-testid="role-select-trigger"]').click()

// Wait for dropdown content (rendered in portal, not inside trigger's parent)
const dropdownContent = page.locator('[data-testid="role-select-content"]')
await expect(dropdownContent).toBeVisible()

// Select an option
await dropdownContent.getByText('Engineer').click()

// Verify selected value is displayed in trigger
await expect(page.locator('[data-testid="role-select-trigger"]')).toContainText('Engineer')
```

### Form Fill + Validation

Test both invalid and valid submission:

```typescript
test.describe('Create Project Form', () => {
  test('should show validation error on empty submit', async ({ page }) => {
    const listPage = new ProjectListPage(page)
    await listPage.goto()
    await listPage.addButton.click()

    // Submit without filling required fields
    await listPage.createDialog.submitBtn.click()

    // Expect error (inline or toast)
    await expect(page.locator('.field-error, [data-testid="field-error"]').first()).toBeVisible()
  })

  test('should create project with valid data', async ({ page }) => {
    const listPage = new ProjectListPage(page)
    await listPage.goto()
    await listPage.addButton.click()

    await listPage.createDialog.nameInput.fill('[E2E] Test Project')
    // Fill other required fields...

    const apiPromise = listPage.waitForApi('/v3/projects')
    await listPage.createDialog.submitBtn.click()
    await apiPromise

    const toast = await listPage.getSuccessToast()
    expect(toast).toContain('成功')
  })
})
```

### Pagination

Verify page info and navigation:

```typescript
// Verify page info text exists
const pageInfo = page.locator('[data-testid="pagination-info"]')
await expect(pageInfo).toBeVisible()

// Record current content for comparison
const firstRowBefore = await page.locator('tbody tr').first().textContent()

// Click next page
await page.locator('[data-testid="pagination-next"]').click()
await page.waitForLoadState('networkidle')

// Verify content changed (rows or page indicator)
const firstRowAfter = await page.locator('tbody tr').first().textContent()
expect(firstRowAfter).not.toBe(firstRowBefore)
```

### Nested Spec Structure for Tabbed Dialogs

Mirror the component hierarchy with nested `test.describe` blocks:

```typescript
test.describe('Project List', () => {
  test.describe('Edit Dialog', () => {
    test.beforeEach(async ({ page }) => {
      const listPage = new ProjectListPage(page)
      await listPage.goto()
      // Open edit dialog for first project
      await listPage.firstRowEditBtn.click()
      await expect(listPage.editDialog.container).toBeVisible()
    })

    test.describe('Info Tab', () => {
      test('should display project info fields', async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await expect(listPage.editDialog.nameInput).toBeVisible()
        await expect(listPage.editDialog.descInput).toBeVisible()
      })

      test('should update project info', async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await listPage.editDialog.nameInput.fill('[E2E] Updated Name')
        const apiPromise = listPage.waitForApi('/v3/projects/')
        await listPage.editDialog.submitBtn.click()
        await apiPromise
        const toast = await listPage.getSuccessToast()
        expect(toast).toContain('成功')
      })
    })

    test.describe('Members Tab', () => {
      test.beforeEach(async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await listPage.editDialog.tabMembers.click()
      })

      test('should display members table with data', async ({ page }) => {
        const listPage = new ProjectListPage(page)
        const rows = listPage.editDialog.membersRows
        expect(await rows.count()).toBeGreaterThan(0)
        // Verify cell content
        const firstCell = rows.first().locator('td').first()
        await expect(firstCell).not.toHaveText('')
      })

      test('should have add member button', async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await expect(listPage.editDialog.addMemberBtn).toBeVisible()
      })
    })

    test.describe('Settings Tab', () => {
      test.beforeEach(async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await listPage.editDialog.tabSettings.click()
      })

      test('should interact with visibility select', async ({ page }) => {
        const listPage = new ProjectListPage(page)
        await listPage.editDialog.visibilitySelect.click()
        // Wait for dropdown content
        const content = page.locator('[data-testid="visibility-select-content"]')
        await expect(content).toBeVisible()
        // Select option
        await content.getByText('Private').click()
        await expect(listPage.editDialog.visibilitySelect).toContainText('Private')
      })
    })
  })
})
```

## Semantic Analysis Reference

### Semantic Extraction Rules

Complete mapping from Vue source clues to SET entries:

| Source Clue | Extraction |
|---|---|
| `@click="handleAddMember"` | handler name → semantic `add-member` |
| `<Trash2 />` icon inside button | icon name → semantic `delete` |
| `<Pencil />` or `<Edit />` icon | icon name → semantic `edit` |
| `<Plus />` icon | icon name → semantic `add/create` |
| `t("member.addMember")` | i18n key → semantic `add-member` |
| `emit('toggle-status')` | event name → semantic `toggle-status` |
| `emit('update:modelValue')` | v-model pattern → semantic `inline-edit` |
| `await api.post('/members')` in handler | HTTP method + path → API Call `POST /members` |
| `await api.delete(...)` in handler | HTTP method → API Call `DELETE ...` |
| `<AlertDialog>` wrapping button | UI pattern → behavior `delete-confirm` |
| `<Dialog>` with form inside | UI pattern → behavior `form-submit` |
| `<Switch>` or `<Toggle>` | UI pattern → behavior `toggle` |
| `router.push(...)` in handler | navigation call → behavior `navigation` |
| `<Badge>` in table cell | display type → column type `badge/status` |
| `<Progress>` in table cell | display type → column type `progress` |
| `formatDate()` / `<DateDisplay>` | display type → column type `date` |
| `:disabled="!canSubmit"` | disabled condition → error scenario source |
| `z.string().min(1)` in Zod schema | validation rule → required field + error scenario |

### Behavior Taxonomy

Each behavior maps to minimum required test steps:

| Behavior | Minimum Test Steps |
|----------|-------------------|
| **form-submit** | open container → fill ALL required fields via UI → submit → `waitForResponse` POST/PATCH → assert toast → assert data update → cleanup |
| **delete-confirm** | click trigger → assert AlertDialog → fill confirm input → click confirm → `waitForResponse` DELETE → assert removal |
| **toggle** | record state → click → `waitForResponse` PATCH → assert state flipped |
| **inline-edit** | click to enter edit → change value → save/auto-save → assert API + display |
| **navigation** | click → `waitForURL` → assert destination loaded |
| **sort** | record first row → click header → `waitForResponse` GET with sort → assert order changed |
| **filter** | type/select value → `waitForResponse` GET with filter → assert rows match |
| **pagination** | assert info text → click next → `waitForResponse` GET with page → assert content changed |
| **drag-reorder** | record order → `dragTo` → `waitForResponse` PATCH order → assert order changed |
| **static-display** | per column type assertions (see § Table Column Assertion Rules below) |

### Required Error/Boundary Scenarios per Behavior

Each behavior also requires these fail-case tests (in addition to happy path):

| Behavior | Required Error Scenarios | Verification |
|----------|------------------------|-------------|
| **form-submit** | (1) Empty required field → inline error (`[data-invalid="true"]` or `[role="alert"]`) (2) Invalid value → API error toast (`[data-sonner-toast][data-type="error"]`) (3) Submit button disabled during submission (`toBeDisabled()`) | Derive from Vue component's Zod schema / validation rules |
| **delete-confirm** | (1) Confirm input mismatch → submit button disabled (2) Cancel → dialog close + data unchanged | Derive from delete dialog's disabled condition |
| **toggle** | (1) Disabled state → not clickable (`toBeDisabled()`) | Derive from computed permission |
| **inline-edit** | (1) Empty/invalid value → error or save blocked | Derive from validation logic |
| **filter** | (1) No match → empty state visible (2) Special characters → no crash | Always test empty state |
| **form-submit (dialog)** | (1) Cancel/close → reopen shows empty form (state cleanup) (2) Escape key close → same | Verify dialog state reset |

### Behavior Taxonomy — Code Examples

#### form-submit (Happy Path + Error)

```typescript
test.describe('Create Member', () => {
  const TEST_NAME = '[E2E] New Member'

  test.afterEach(async ({ request }) => {
    // Cleanup via API
    const resp = await request.get('/prod-api/v3/members?keyword=[E2E]')
    if (resp.ok()) {
      const data = await resp.json()
      for (const m of data.data ?? []) {
        await request.delete(`/prod-api/v3/members/${m.id}`).catch(() => {})
      }
    }
  })

  test('should create member successfully', async ({ page }) => {
    const pg = new MembersPage(page)
    await pg.goto()
    await pg.addMemberBtn.click()
    await expect(pg.addDialog.container).toBeVisible()

    // Fill ALL required fields via UI
    await pg.addDialog.nameInput.fill(TEST_NAME)
    await pg.addDialog.roleSelect.click()
    const roleContent = page.locator('[data-testid="role-select-content"]')
    await expect(roleContent).toBeVisible()
    await roleContent.getByText('Engineer').click()

    // Submit and verify
    const apiPromise = pg.waitForApi('/v3/members')
    await pg.addDialog.submitBtn.click()
    await apiPromise
    const toast = await pg.getSuccessToast()
    expect(toast).toContain('成功')

    // Assert table updated
    await expect(pg.membersTable.getByText(TEST_NAME)).toBeVisible()
  })

  test('should show validation error on empty required fields', async ({ page }) => {
    const pg = new MembersPage(page)
    await pg.goto()
    await pg.addMemberBtn.click()

    // Submit without filling required fields
    await pg.addDialog.submitBtn.click()

    // Expect inline validation error
    await expect(pg.addDialog.container.locator('[data-invalid="true"]').first()).toBeVisible()
  })

  test('should reset form on cancel', async ({ page }) => {
    const pg = new MembersPage(page)
    await pg.goto()
    await pg.addMemberBtn.click()
    await pg.addDialog.nameInput.fill('partial data')
    await pg.addDialog.cancelBtn.click()

    // Reopen and verify empty
    await pg.addMemberBtn.click()
    await expect(pg.addDialog.nameInput).toHaveValue('')
  })
})
```

#### delete-confirm (Happy Path + Cancel)

```typescript
test.describe('Delete Member', () => {
  test.beforeEach(async ({ request }) => {
    // Setup: create test data via API
    await request.post('/prod-api/v3/members', {
      data: { name: '[E2E] Delete Target', role: 'engineer' }
    })
  })

  test('should delete member after confirmation', async ({ page }) => {
    const pg = new MembersPage(page)
    await pg.goto()
    const row = pg.membersTable.getByText('[E2E] Delete Target').locator('..')
    await row.locator('[data-testid="delete-btn"]').click()

    // AlertDialog appears
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog).toBeVisible()

    // Fill confirm input and submit
    await dialog.locator('input').fill('[E2E] Delete Target')
    const apiPromise = pg.waitForApi('/v3/members/')
    await dialog.getByRole('button', { name: /confirm|確認/i }).click()
    await apiPromise

    // Assert removed
    await expect(pg.membersTable.getByText('[E2E] Delete Target')).not.toBeVisible()
  })

  test('should keep submit disabled when confirm input mismatches', async ({ page }) => {
    const pg = new MembersPage(page)
    await pg.goto()
    const row = pg.membersTable.getByText('[E2E] Delete Target').locator('..')
    await row.locator('[data-testid="delete-btn"]').click()

    const dialog = page.locator('[role="alertdialog"]')
    await dialog.locator('input').fill('wrong text')
    await expect(dialog.getByRole('button', { name: /confirm|確認/i })).toBeDisabled()
  })
})
```

#### toggle

```typescript
test('should toggle member status', async ({ page }) => {
  const pg = new MembersPage(page)
  await pg.goto()

  const toggle = pg.membersTable.locator('[data-testid="status-toggle"]').first()
  const initialState = await toggle.getAttribute('data-state')

  const apiPromise = pg.waitForApi('/v3/members/')
  await toggle.click()
  await apiPromise

  const newState = await toggle.getAttribute('data-state')
  expect(newState).not.toBe(initialState)
})
```

#### filter + empty state

```typescript
test('should filter and show empty state', async ({ page }) => {
  const pg = new MembersPage(page)
  await pg.goto()

  // Filter with no-match term
  await pg.searchInput.fill('xyznonexistent999')
  await pg.waitForApi('/v3/members?keyword=')

  // Empty state visible
  await expect(pg.emptyState).toBeVisible()
  expect(await pg.membersRows.count()).toBe(0)
})
```

### Table Column Assertion Rules — Code Examples

```typescript
// Pure text column
const nameCell = rows.first().locator('td').nth(0)
await expect(nameCell).not.toHaveText('')

// Badge/Status column
const statusCell = rows.first().locator('td').nth(1)
await expect(statusCell.locator('.badge, [data-testid*="badge"]'))
  .toHaveText(/Active|Inactive|啟用|停用/i)

// Date column
const dateCell = rows.first().locator('td').nth(2)
await expect(dateCell).toHaveText(/\d{4}[-/]\d{2}/)

// Progress column
const progressCell = rows.first().locator('td').nth(3)
await expect(progressCell).toHaveText(/\d+\/\d+/)

// Action column — test each button per Behavior Taxonomy
const actionCell = rows.first().locator('td').last()
await expect(actionCell.locator('[data-testid="edit-btn"]')).toBeVisible()
await expect(actionCell.locator('[data-testid="delete-btn"]')).toBeVisible()
```

### Worked Example — Members Page

#### 1. Component Tree

```
MembersPage/index.vue
├── MembersToolbar.vue (search input, add member button)
├── MembersTable.vue (table with columns: name, role[badge], joined[date], actions[edit/delete])
├── AddMemberDialog.vue (form: name input, role select, submit/cancel)
└── DeleteMemberDialog.vue (AlertDialog with confirm input)
```

#### 2. Semantic Element Table (SET)

| # | Element | Type | Semantic | Handler/Event | API Call | Behavior | Test Strategy |
|---|---------|------|----------|---------------|----------|----------|---------------|
| 1 | Search input | input | search-members | `handleSearch` | `GET /members?keyword=` | filter | type → waitForResponse → assert rows match |
| 2 | Add Member button | button | add-member | `openAddDialog` | — | navigation (opens dialog) | click → dialog visible |
| 3 | Name column | td | display-name | — | — | static-display | `not.toHaveText('')` |
| 4 | Role column | td+Badge | display-role | — | — | static-display | `toHaveText(/Admin\|Engineer\|QA/i)` |
| 5 | Joined column | td+date | display-date | — | — | static-display | `toHaveText(/\d{4}[-/]\d{2}/)` |
| 6 | Edit button | icon-button | edit-member | `handleEdit` | — | navigation (opens edit dialog) | click → edit dialog visible |
| 7 | Delete button | icon-button | delete-member | `handleDelete` | `DELETE /members/:id` | delete-confirm | click → AlertDialog → confirm → removal |
| 8 | Add Dialog form | dialog+form | create-member | `handleSubmit` | `POST /members` | form-submit | fill name + role → submit → toast → table update |
| 9 | Add Dialog cancel | button | cancel-add | `closeDialog` | — | navigation (closes dialog) | click → dialog hidden |
| 10 | Delete Dialog | AlertDialog | confirm-delete | `handleConfirmDelete` | `DELETE /members/:id` | delete-confirm | fill confirm → submit → removal |

#### 3. Derived Coverage Plan

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Page | `index.vue` + `MembersToolbar` + `MembersTable` | search input, table (4 cols), add btn | table display (per-column assertions), search filter, filter empty state |
| Add Member Dialog | `AddMemberDialog.vue` | name input, role select, submit, cancel | fill + submit + toast + table update, empty field validation, cancel resets form |
| Delete Member Dialog | `DeleteMemberDialog.vue` | confirm input, confirm btn, cancel | confirm + delete + removal, mismatch keeps btn disabled, cancel preserves data |

#### 4. Resulting test.describe Blocks

```typescript
test.describe('Members Page', () => {
  test.describe('Table Display', () => {
    // Row count > 0
    // Per-column type assertions (name=text, role=badge, joined=date, actions=buttons)
  })

  test.describe('Search Filter', () => {
    // Type keyword → assert filtered rows
    // No match → empty state
  })

  test.describe('Add Member Dialog', () => {
    // Happy path: fill all → submit → toast → table updated
    // Error: empty required fields → inline error
    // Cancel → reopen shows empty form
  })

  test.describe('Delete Member', () => {
    // Happy path: confirm input matches → delete → removed
    // Error: confirm mismatch → button disabled
    // Cancel → dialog closes, data unchanged
  })
})
```
