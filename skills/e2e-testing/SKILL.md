---
name: e2e-testing
description: Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
version: 1.0.0
---

# E2E Testing Patterns

Comprehensive Playwright patterns for building stable, fast, and maintainable E2E test suites.

## Test File Organization

```
tests/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── register.spec.ts
│   ├── features/
│   │   ├── browse.spec.ts
│   │   ├── search.spec.ts
│   │   └── create.spec.ts
│   └── pages/              # Page Object Model classes
│       ├── LoginPage.ts
│       ├── HomePage.ts
│       └── BasePage.ts
├── fixtures/
│   ├── auth.ts
│   └── data.ts
└── playwright.config.ts
```

## Test Credentials & Multi-Role Authentication

Test accounts are stored in `.env.test.local` (gitignored, never committed). Different permission levels require different accounts — always use the role that matches the test scenario.

**`.env.test.local` format:**
```env
# Sysadmin — system-level administration
TEST_AD_USERNAME=
TEST_AD_PASSWORD=

# Organization Owner — organization management
TEST_OO_USERNAME=
TEST_OO_PASSWORD=

# Project Manager — project-level management
TEST_PM_USERNAME=
TEST_PM_PASSWORD=

# Engineer (RD) — development tasks
TEST_RD_USERNAME=
TEST_RD_PASSWORD=

# QA — testing and quality assurance
TEST_QA_USERNAME=
TEST_QA_PASSWORD=
```

**Loading credentials in fixtures (`tests/fixtures/auth.ts`):**
```typescript
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

export const accounts = {
  sysadmin: {
    username: process.env.TEST_AD_USERNAME!,
    password: process.env.TEST_AD_PASSWORD!,
  },
  orgOwner: {
    username: process.env.TEST_OO_USERNAME!,
    password: process.env.TEST_OO_PASSWORD!,
  },
  projectManager: {
    username: process.env.TEST_PM_USERNAME!,
    password: process.env.TEST_PM_PASSWORD!,
  },
  engineer: {
    username: process.env.TEST_RD_USERNAME!,
    password: process.env.TEST_RD_PASSWORD!,
  },
  qa: {
    username: process.env.TEST_QA_USERNAME!,
    password: process.env.TEST_QA_PASSWORD!,
  },
} as const

export type AccountRole = keyof typeof accounts
```

**Using in tests:**
```typescript
import { test, expect } from '@playwright/test'
import { accounts } from '../fixtures/auth'
import { LoginPage } from '../pages/LoginPage'

test.describe('Sysadmin features', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.loginAs(accounts.sysadmin)
  })

  test('should access system settings', async ({ page }) => {
    await expect(page.locator('[data-testid="system-settings"]')).toBeVisible()
  })
})

test.describe('Engineer restrictions', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.loginAs(accounts.engineer)
  })

  test('should not see admin panel', async ({ page }) => {
    await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible()
  })
})
```

**Important:**
- `.env.test.local` must be added to `.gitignore` — never commit real credentials
- When adding a new role, add corresponding `TEST_<ROLE>_USERNAME` / `TEST_<ROLE>_PASSWORD` entries
- For CI, inject these values via CI environment variables or secrets

## Page Object Model (POM)

```typescript
import { type Page, type Locator } from '@playwright/test'

export class ItemsPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly itemCards: Locator
  readonly createButton: Locator

  constructor(page: Page) {
    this.page = page
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

  test('should search by keyword', async ({ page }) => {
    await itemsPage.search('test')

    const count = await itemsPage.getItemCount()
    expect(count).toBeGreaterThan(0)

    await expect(itemsPage.itemCards.first()).toContainText(/test/i)
    await page.screenshot({ path: 'artifacts/search-results.png' })
  })

  test('should handle no results', async ({ page }) => {
    await itemsPage.search('xyznonexistent123')

    await expect(page.locator('[data-testid="no-results"]')).toBeVisible()
    expect(await itemsPage.getItemCount()).toBe(0)
  })
})
```

## Test Scenario Guidelines

Not every feature requires all scenario types. Based on the nature of the feature, consider whether these are applicable:

- **Happy path** — The normal, expected successful flow. Always include this.
- **Invalid input** — Wrong credentials, empty form submission, malformed data. Applicable when the feature accepts user input.
- **Permission / role-based** — Different roles see different UI or get denied access. Applicable when the feature has role-based behavior.
- **Empty state** — No data available, empty lists, first-time user experience. Applicable when the feature displays dynamic data.
- **Error response** — API returns 500, network timeout, unexpected error. Applicable when the feature depends on backend API calls.

This is not a checklist — use judgement to decide which scenarios are relevant for each feature.

## Locator Strategy (Priority Order)

1. `[data-testid="..."]` — Preferred, stable across refactors
2. `getByRole()` — Accessible, semantic
3. `getByText()` — For visible text content
4. `getByPlaceholder()` — For form inputs
5. CSS selectors — Last resort only

**Never use**: XPath, auto-generated class names

## Playwright Configuration

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
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

### Screenshots

```typescript
await page.screenshot({ path: 'artifacts/after-login.png' })
await page.screenshot({ path: 'artifacts/full-page.png', fullPage: true })
await page.locator('[data-testid="chart"]').screenshot({ path: 'artifacts/chart.png' })
```

### Traces

```typescript
// In playwright.config.ts
use: {
  trace: 'on-first-retry',  // Only capture trace on retry
}
```

### Video

```typescript
// In playwright.config.ts
use: {
  video: 'retain-on-failure',
}
```

## Codegen Workflow

For quickly scaffolding tests:

```bash
npx playwright codegen http://localhost:5173
```

After recording:
1. Replace CSS selectors with `data-testid` locators
2. Extract page interactions into POM classes
3. Add meaningful assertions
4. Remove unnecessary `waitForTimeout` calls

## Test Report Template

```markdown
# E2E Test Report

**Date:** YYYY-MM-DD HH:MM
**Duration:** Xm Ys
**Status:** PASSING / FAILING

## Summary
- Total: X | Passed: Y (Z%) | Failed: A | Flaky: B | Skipped: C

## Failed Tests

### test-name
**File:** `tests/e2e/feature.spec.ts:45`
**Error:** Expected element to be visible
**Screenshot:** artifacts/failed.png
**Recommended Fix:** [description]

## Artifacts
- HTML Report: playwright-report/index.html
- Screenshots: artifacts/*.png
- Videos: artifacts/videos/*.webm
- Traces: artifacts/*.zip
```
