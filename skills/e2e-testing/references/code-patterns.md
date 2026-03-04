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

One page = one POM file. Use nested object structure for dialog/tab locators:

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
    tabMembers: this.page.locator('[data-testid="project-list-edit-dialog-tab-members"]'),
    tabSettings: this.page.locator('[data-testid="project-list-edit-dialog-tab-settings"]'),
    nameInput: this.page.locator('[data-testid="project-list-edit-dialog-name-input"]'),
    submitBtn: this.page.locator('[data-testid="project-list-edit-dialog-submit-btn"]'),
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
