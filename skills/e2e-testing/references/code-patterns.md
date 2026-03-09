# Code Patterns

## BasePage Shared Class — `tests/e2e/pages/BasePage.ts`

All POM classes extend `BasePage` to share common functionality:

```typescript
import type { Locator, Page } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;
  // vue-sonner renders [data-sonner-toast] with [data-type] attribute
  readonly toastSuccess: Locator;
  readonly toastError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastSuccess = page.locator('[data-sonner-toast][data-type="success"]');
    this.toastError = page.locator('[data-sonner-toast][data-type="error"]');
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

  /** Get toast success message text (targets [data-content] for message only) */
  async getSuccessToast(): Promise<string> {
    await this.toastSuccess.waitFor({ state: "visible", timeout: 5000 });
    return this.toastSuccess.locator("[data-content]").innerText();
  }

  /** Get toast error message text (targets [data-content] for message only) */
  async getErrorToast(): Promise<string> {
    await this.toastError.waitFor({ state: "visible", timeout: 5000 });
    return this.toastError.locator("[data-content]").innerText();
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

## Artifact Configuration

```typescript
// playwright.config.ts — already configured
use: {
  screenshot: 'only-on-failure',  // Auto-capture on failure
  video: 'retain-on-failure',     // Keep video for failed tests
  trace: 'on-first-retry',        // Capture trace on retry
}
outputDir: 'playwright/test-results',  // All artifacts go here
```

> **No manual `page.screenshot()` in specs** — see SKILL.md § No Manual Screenshots.

## Codegen Workflow

```bash
npx playwright codegen http://localhost:5173
```

After recording:
1. Replace CSS selectors with `data-testid` locators
2. Extract page interactions into POM classes
3. Add meaningful assertions
4. Remove unnecessary `waitForTimeout` calls

## Incremental Test Maintenance

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
