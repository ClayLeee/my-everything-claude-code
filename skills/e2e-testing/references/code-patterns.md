# Code Patterns

## Table of Contents

- [BasePage Shared Class](#basepage-shared-class)
- [POM Examples](#pom-examples) (Basic, Deep Testing with Nested Dialog/Tab)
- [Test Structure Example](#test-structure-example)
- [Flaky Test Patterns](#flaky-test-patterns) (Quarantine, Identify, Common Causes)
- [Artifact Configuration](#artifact-configuration)
- [Codegen Workflow](#codegen-workflow)
- [Playwright Configuration Template](#playwright-configuration-template)

---

## BasePage Shared Class — `tests/e2e/pages/BasePage.ts`

All POM classes extend `BasePage` to share common functionality. The full implementation is in the **scaffold template** — use `scaffold.js` to create it:

```bash
echo '{"targetDir":"app","templates":["BasePage"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

**Key API surface:**
- `constructor(page, feedback?)` — accepts a `FeedbackConfig` (presets: `sonner`, `mui`, `antd`, `reactHotToast`, `dataTestId`, or custom)
- `interceptApi(urlPattern, action)` — intercept API response → `{ ok, status, body }` for error classification
- `waitForApi(urlPattern)` — fire-and-forget wait for API response
- `waitForNavigation(urlPattern)` — wait for SPA route change
- `getSuccessFeedback()` / `getErrorFeedback()` — read UI feedback message text (returns `null` if unconfigured)
- Abstract `goto()` — each POM implements its own navigation

### Usage per project

```typescript
// Sonner project (default)
class MyPage extends BasePage {
  constructor(page: Page) { super(page); }
}

// MUI project
class MyPage extends BasePage {
  constructor(page: Page) { super(page, FEEDBACK_PRESETS.mui); }
}

// Custom selectors
class MyPage extends BasePage {
  constructor(page: Page) {
    super(page, {
      success: { selector: ".toast-success", textSelector: ".toast-body" },
      error: { selector: ".toast-error", textSelector: ".toast-body" },
    });
  }
}

// No UI feedback (API-only verification)
class MyPage extends BasePage {
  constructor(page: Page) { super(page, {}); }
}
```

> **Error handling:** Use `interceptApi()` as the primary error detection method — it returns HTTP status and response body for precise classification. `getSuccessFeedback()` / `getErrorFeedback()` serve as auxiliary verification that the UI correctly communicated the result. See **`error-discrimination.md`** for the full API-first classification framework.

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

> **Incremental Test Maintenance** — see SKILL.md § Incremental Test Maintenance for delta classification and change analysis template.
>
> **Test Data Lifecycle** — see `test-data-policy.md` for UI-Only test data lifecycle examples (create with cleanup, delete with setup).
>
> **UI Pattern Testing** — see `ui-patterns.md` for core patterns (table, form, select, edit, pagination, search, toggle, delete) and `ui-patterns-extended.md` for specialized patterns (tabs, accordion, date picker, rich text, file upload, drag-and-drop).

## Playwright Configuration Template — `playwright.config.ts`

Use `scaffold.js` to create the config with project-specific values:

```bash
echo '{"targetDir":"app","templates":["playwright.config.local"],"variables":{"BASE_URL":"http://localhost:5173","WEB_SERVER_COMMAND":"pnpm dev"}}' | node $SKILL_DIR/scripts/scaffold.js
```

For remote testing, use `playwright.config.remote` template instead. See `templates/` for the full source.
