# Auth Patterns

## Test Credentials — `.env.test.local` Format

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

## Loading Credentials — `tests/fixtures/auth.ts`

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

## Auth State Storage — Skip Login via `storageState`

This project uses `localStorage["auth_token"]` for JWT storage. The API client sends it via `Authorization: Bearer` header (no cookies). Playwright's `storageState` can inject the token to skip login entirely.

### Setup Project in `playwright.config.ts`

```typescript
projects: [
  {
    name: "setup",
    testMatch: /.*\.setup\.ts/,
  },
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      storageState: ".auth/sysadmin.json",
    },
    dependencies: ["setup"],
  },
]
```

### Auth Setup File — `tests/e2e/auth/auth.setup.ts`

```typescript
import { test as setup } from "@playwright/test";
import { accounts } from "../../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

setup("authenticate as sysadmin", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.sysadmin);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/sysadmin.json" });
});
```

### Multi-Role Auth Setup

For tests requiring different roles, add more setup entries:

```typescript
setup("authenticate as engineer", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.engineer);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/engineer.json" });
});
```

Then reference in project config:

```typescript
{
  name: "engineer-tests",
  use: { storageState: ".auth/engineer.json" },
  dependencies: ["setup"],
  testMatch: /.*\.engineer\.spec\.ts/,
}
```

### Using Roles in Tests

```typescript
import { test, expect } from '@playwright/test'

// Tests under "chromium" project automatically use sysadmin storageState
test.describe('Sysadmin features', () => {
  test('should access system settings', async ({ page }) => {
    await expect(page.locator('[data-testid="system-settings"]')).toBeVisible()
  })
})
```

### Important Notes

- `.env.test.local` and `.auth/` must be in `.gitignore` — never commit credentials or auth state
- For new roles, add `TEST_<ROLE>_USERNAME` / `TEST_<ROLE>_PASSWORD` entries
- For CI, inject credentials via CI environment variables or secrets
