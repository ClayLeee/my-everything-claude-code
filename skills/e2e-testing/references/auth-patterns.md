# Auth Patterns

## Test Credentials & Auth Loader

Scaffold `.env.test.local` via:

```bash
echo '{"targetDir":".","templates":["env.test.local"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates `.env.test.local` — fill in one `TEST_{ABBREV}_USERNAME` / `TEST_{ABBREV}_PASSWORD` block per role the project needs.

## Generating auth.ts

**Do not scaffold `auth.ts` from the template.** Instead, read `.env.test.local` after it has been filled in, parse the role blocks, and generate `tests/fixtures/auth.ts` accordingly.

The convention is: `TEST_{ABBREV}_USERNAME` / `TEST_{ABBREV}_PASSWORD` → one entry in `accounts` keyed by a readable role name derived from the comment above the block (or the abbreviation lowercased if no comment).

Example — if `.env.test.local` contains:
```
# Admin
TEST_ADMIN_USERNAME=
TEST_ADMIN_PASSWORD=

# Regular user
TEST_USER_USERNAME=
TEST_USER_PASSWORD=
```

Generate:
```typescript
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

export const accounts = {
  admin: {
    username: process.env.TEST_ADMIN_USERNAME!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  },
  user: {
    username: process.env.TEST_USER_USERNAME!,
    password: process.env.TEST_USER_PASSWORD!,
  },
} as const

export type AccountRole = keyof typeof accounts
```

The `dotenv.config` path (`../../.env.test.local`) assumes `auth.ts` lives at `tests/fixtures/auth.ts` — adjust the relative path if the project layout differs.

## Auth State Storage — Skip Login via `storageState`

Playwright's `storageState` persists browser session (cookies + localStorage) to `.auth/{role}.json`, allowing subsequent test runs to skip the login UI entirely.

### Setup Project in `playwright.config.ts`

The auth config is scaffolded via `playwright.config.local.auth` template (see `/e2e:create` Pass 2 Step 5). It contains a `setup` project and a `storageState` reference keyed to `FIRST_ROLE`.

### Auth Setup File — `tests/e2e/auth/auth.setup.ts`

**Dynamically generated** during `/e2e:create` Pass 2 — one `setup()` block per role parsed from `.env.test.local`. Each block authenticates via `LoginPage`, then saves `storageState` to `.auth/{role}.json`.

Example output for roles `admin` + `user`:

```typescript
import { test as setup } from "@playwright/test";
import { accounts } from "../../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

setup("authenticate as admin", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.admin);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/admin.json" });
});

setup("authenticate as user", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.user);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/user.json" });
});
```

### Using Roles in Tests

```typescript
import { test, expect } from '@playwright/test'

// Tests under "chromium" project automatically use FIRST_ROLE storageState
test.describe('Admin features', () => {
  test('should access admin settings', async ({ page }) => {
    await expect(page.locator('[data-testid="admin-settings"]')).toBeVisible()
  })
})
```

### Important Notes

- `.env.test.local` and `.auth/` must be in `.gitignore` — never commit credentials or auth state
- For new roles, add `TEST_<ROLE>_USERNAME` / `TEST_<ROLE>_PASSWORD` entries to `.env.test.local`, then re-run `/e2e:create`
- For CI, inject credentials via CI environment variables or secrets

## MCP Auth via StorageState

When using MCP browser tools to explore pages that require authentication, inject the pre-built `.auth/{role}.json` instead of manually filling credentials:

```javascript
// browser_run_code — inject storageState from .auth/{role}.json
const state = JSON.parse(require('fs').readFileSync('.auth/{role}.json', 'utf8'));

// Inject localStorage tokens
if (state.origins?.[0]?.localStorage?.length) {
  await page.goto(state.origins[0].origin);
  await page.evaluate(
    items => items.forEach(i => localStorage.setItem(i.name, i.value)),
    state.origins[0].localStorage
  );
}

// Inject cookies
if (state.cookies?.length) {
  await page.context().addCookies(state.cookies);
}
```

Then `browser_navigate` to the target page — already in authenticated state.

See `references/mcp-discovery.md` § MCP Session Authentication for the full fallback flow when `.auth/` does not exist.

## LoginPage POM — Required for `auth.setup.ts`

`auth.setup.ts` calls `loginPage.loginAs(account)`. Before writing the POM, read the project's login page source to understand its structure. Then create `tests/e2e/pages/LoginPage.ts` with:

- `goto()` — navigate to the login route and wait for page load
- `loginAs(account: { username: string; password: string })` — fill credentials and submit via real UI interactions (no `page.route()` mocks)

Derive all locators from the actual source. Inject `data-testid` attributes if missing. Login pages vary (password-only, SSO, multi-step) — always read the source before writing the POM.
