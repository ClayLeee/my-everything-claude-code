# Code Patterns

## BasePage Shared Class — `tests/e2e/pages/BasePage.ts`

```typescript
import type { Locator, Page } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;
  readonly toastSuccess: Locator;
  readonly toastError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastSuccess = page.locator('[data-sonner-toast][data-type="success"]');
    this.toastError = page.locator('[data-sonner-toast][data-type="error"]');
  }

  abstract goto(): Promise<void>;

  async waitForApi(urlPattern: string, status = 200) {
    await this.page
      .waitForResponse(
        (resp) => resp.url().includes(urlPattern) && resp.status() === status,
        { timeout: 10000 }
      )
      .catch(() => {});
  }

  async waitForNavigation(urlPattern: string) {
    await this.page.waitForURL(urlPattern, { timeout: 15000 });
  }

  async getSuccessToast(): Promise<string> {
    await this.toastSuccess.waitFor({ state: "visible" });
    return (await this.toastSuccess.textContent()) ?? "";
  }

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

  constructor(page: Page) {
    super(page)
    this.searchInput = page.locator('[data-testid="search-input"]')
    this.itemCards = page.locator('[data-testid="item-card"]')
  }

  async goto() {
    await this.page.goto('/items')
    await this.page.waitForLoadState('networkidle')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForResponse(resp => resp.url().includes('/api/search'))
  }
}
```

### Deep Testing POM (Nested Dialog/Tab Structure)

Initialize nested dialog/tab locators inside the `constructor` (not as class field initializers) to avoid TypeScript inheritance issues with `this.page`:

```typescript
export class ProjectListPage extends BasePage {
  readonly table: Locator
  readonly addButton: Locator
  readonly createDialog;
  readonly editDialog;

  constructor(page: Page) {
    super(page)
    this.table = page.locator('[data-testid="project-list-table"]')
    this.addButton = page.locator('[data-testid="project-list-add-btn"]')

    this.createDialog = {
      container: page.locator('[data-testid="project-list-create-dialog"]'),
      nameInput: page.locator('[data-testid="project-list-create-dialog-name-input"]'),
      submitBtn: page.locator('[data-testid="project-list-create-dialog-submit-btn"]'),
    }

    this.editDialog = {
      container: page.locator('[data-testid="project-list-edit-dialog"]'),
      tabInfo: page.locator('[data-testid="project-list-edit-dialog-tab-info"]'),
      tabMembers: page.locator('[data-testid="project-list-edit-dialog-tab-members"]'),
      // Info tab content
      nameInput: page.locator('[data-testid="project-list-edit-dialog-name-input"]'),
      submitBtn: page.locator('[data-testid="project-list-edit-dialog-submit-btn"]'),
      // Members tab content
      membersTable: page.locator('[data-testid="project-list-edit-dialog-members-table"]'),
      membersRows: page.locator('[data-testid="project-list-edit-dialog-members-table"] tbody tr'),
      addMemberBtn: page.locator('[data-testid="project-list-edit-dialog-add-member-btn"]'),
    }
  }

  async goto() {
    await this.page.goto('/projects')
    await this.page.waitForLoadState('networkidle')
  }
}
```

## Test Structure

```typescript
import { test, expect } from '@playwright/test'
import { ItemsPage } from '../pages/ItemsPage'

test.describe('Item Search', () => {
  let itemsPage: ItemsPage

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page)
    await itemsPage.goto()
  })

  test('should search by keyword', async () => {
    await itemsPage.search('test')
    expect(await itemsPage.itemCards.count()).toBeGreaterThan(0)
    await expect(itemsPage.itemCards.first()).toContainText(/test/i)
  })

  test('should handle no results', async ({ page }) => {
    await itemsPage.search('xyznonexistent123')
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible()
  })
})
```

## Flaky Test Patterns

### Quarantine

```typescript
test('flaky: complex search', async () => {
  test.fixme(true, 'Flaky - Issue #123')
})

test('conditional skip', async () => {
  test.skip(process.env.CI, 'Flaky in CI - Issue #123')
})
```

### Identify Flakiness

```bash
pnpm test:e2e -- tests/search.spec.ts --repeat-each=10
pnpm test:e2e -- tests/search.spec.ts --retries=3
```

### Common Causes & Fixes

| Problem | Bad | Good |
|---------|-----|------|
| Race condition | `await page.click(sel)` | `await page.locator(sel).click()` |
| Network timing | `await page.waitForTimeout(5000)` | `await page.waitForResponse(...)` |
| Animation | Click during animation | `waitFor({ state: 'visible' })` then click |
| SPA navigation | `expect(page.url()).toContain(...)` | `await page.waitForURL('**/target')` |

## Artifact Management

Do NOT use manual `page.screenshot()` in specs. Playwright handles all artifacts automatically:

```typescript
// playwright.config.ts — already configured
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
}
outputDir: 'playwright/test-results',
```
