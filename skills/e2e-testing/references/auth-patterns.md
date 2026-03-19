# Auth Patterns

## Test Credentials & Auth Loader

Scaffold `.env.test.local` and `tests/fixtures/auth.ts` via:

```bash
echo '{"targetDir":"app","templates":["env.test.local","auth"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates:
- `.env.test.local` — env vars for each role: `TEST_AD_USERNAME/PASSWORD` (sysadmin), `TEST_OO_*` (org owner), `TEST_PM_*` (project manager), `TEST_RD_*` (engineer), `TEST_QA_*` (QA)
- `tests/fixtures/auth.ts` — loads credentials via `dotenv`, exports `accounts` object with typed `AccountRole`

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

Scaffold via:

```bash
echo '{"targetDir":"app","templates":["auth.setup"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates a setup file that authenticates as sysadmin via `LoginPage`, saves `storageState` to `.auth/sysadmin.json`.

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
