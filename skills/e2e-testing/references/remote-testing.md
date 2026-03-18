# Remote Testing Reference

Patterns for E2E testing remote URLs without a local project.

## Table of Contents

- [When to Use](#when-to-use)
- [Scaffold Minimal Playwright Project](#scaffold-minimal-playwright-project) (Directory Structure, Templates, Setup)
- [Remote Locator Strategy](#remote-locator-strategy) (Priority, MCP ARIA Mapping, Translation Rules)
- [MCP Authentication & Auth Bridging](#mcp-authentication--auth-bridging) (Login Flow, Export State, Config)
- [MCP Exploration Workflow](#mcp-exploration-workflow) (Auth, Page Exploration, Form Dry-Run, Discovery Report)
- [RemoteBasePage Pattern](#remotebasepage-pattern)
- [Test Scenario Generation Rules](#test-scenario-generation-rules)
- [Report Adaptation](#report-adaptation)
- [Known Limitations](#known-limitations)

---

## When to Use

- User provides a URL rather than a local project path
- Testing third-party websites, staging environments, or production
- No local source code available — cannot inject `data-testid` or analyze component trees
- User says "測試這個網址", "遠端測試", "test this URL", "remote test"

## Scaffold Minimal Playwright Project

Scaffold Playwright in the **current working directory**. If `playwright.config.ts` already exists, reuse it (update `baseURL` if needed). Do NOT scaffold to `~/e2e-remote/`.

### Directory Structure

```
{project-root}/
├── package.json              # Only @playwright/test (skip if exists)
├── playwright.config.ts      # baseURL = remote URL, no webServer
├── .auth/                    # storageState (if auth needed)
│   └── remote.json
├── playwright/
│   └── {page-name}/
│       └── test-report.md    # Markdown report
└── tests/
    └── e2e/
        ├── pages/
        │   ├── RemoteBasePage.ts # Abstract base class
        │   └── {PageName}Page.ts # POM based on exploration results
        └── {domain}/
            └── {page-name}.spec.ts   # Test scenarios (domain from URL path)
```

### package.json Template

```json
{
  "name": "e2e-remote-{domain}",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:report": "playwright show-report playwright/reports/latest"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

### playwright.config.ts Template

```typescript
import { defineConfig } from '@playwright/test';

const reportName = process.env.E2E_REPORT_NAME || 'latest';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: `playwright/reports/${reportName}`, open: 'never' }],
  ],

  use: {
    baseURL: '{REMOTE_URL}',  // Replace with actual target URL
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // storageState: '.auth/remote.json',  // Uncomment if auth needed
  },

  outputDir: 'playwright/test-results',

  // No webServer — testing remote URL directly
});
```

### Setup Commands

```bash
pnpm install
pnpm exec playwright install chromium
```

## Remote Locator Strategy

Priority order is **reversed** compared to local testing (no `data-testid` injection possible):

1. `getByRole()` — Best stability for remote sites
2. `getByText()` — Visible text content
3. `getByPlaceholder()` — Form inputs
4. `getByLabel()` — Labeled form elements
5. CSS selectors — When no semantic locator works
6. `[data-testid]` — Only if the remote site already has them

**Never use**: XPath, auto-generated class names.

### MCP ARIA → Playwright Locator Mapping

| MCP Snapshot Element | Playwright Locator |
|---|---|
| `button "Submit"` | `page.getByRole('button', { name: 'Submit' })` |
| `textbox "Email"` | `page.getByRole('textbox', { name: 'Email' })` |
| `link "Products"` | `page.getByRole('link', { name: 'Products' })` |
| `tab "Settings"` | `page.getByRole('tab', { name: 'Settings' })` |
| `heading "Welcome"` | `page.getByRole('heading', { name: 'Welcome' })` |
| `checkbox "Remember me"` | `page.getByRole('checkbox', { name: 'Remember me' })` |
| `combobox "Country"` | `page.getByRole('combobox', { name: 'Country' })` |
| `navigation "Main"` | `page.getByRole('navigation', { name: 'Main' })` |
| `table "Users"` | `page.getByRole('table', { name: 'Users' })` |
| 無 ARIA role 的元素 | CSS selector fallback |

### Translation Rules

1. Take the **role** from the MCP snapshot element type
2. Take the **name** from the quoted text (accessible name)
3. If the element has no role or the name is not unique, fall back to CSS selector
4. For elements inside a specific container, chain with `.locator()`: `page.getByRole('dialog').getByRole('button', { name: 'Save' })`

## MCP Authentication & Auth Bridging

When the remote site requires login, use MCP browser to authenticate and export state for Playwright.

### MCP Login Flow

```
1. browser_navigate → login page URL
2. browser_snapshot → identify form fields
3. browser_fill_form → fill credentials (username, password)
4. browser_click → click login/submit button
5. browser_wait_for → wait for redirect or dashboard element
6. browser_snapshot → verify logged-in state
```

### Export Auth State

Use `browser_run_code` to extract cookies and localStorage:

```javascript
// Run in MCP browser after login
const cookies = await document.cookie.split(';').map(c => {
  const [name, ...rest] = c.trim().split('=');
  return {
    name,
    value: rest.join('='),
    domain: window.location.hostname,
    path: '/',
    httpOnly: false,
    secure: window.location.protocol === 'https:',
    sameSite: 'Lax'
  };
});

const localStorageItems = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  localStorageItems.push({ name: key, value: localStorage.getItem(key) });
}

JSON.stringify({
  cookies,
  origins: [{
    origin: window.location.origin,
    localStorage: localStorageItems
  }]
});
```

### storageState JSON Format

Write the exported data to `.auth/remote.json`:

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": "example.com",
      "path": "/",
      "httpOnly": false,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://example.com",
      "localStorage": [
        { "name": "token", "value": "eyJ..." }
      ]
    }
  ]
}
```

### Config Update

When auth is needed, uncomment `storageState` in `playwright.config.ts`:

```typescript
use: {
  storageState: '.auth/remote.json',
}
```

## MCP Exploration Workflow

### Phase 1: Authentication (if needed)

Follow the MCP Login Flow above.

### Phase 2: Page Exploration

1. `browser_navigate` → target page
2. `browser_snapshot` → get ARIA tree, build page structure map
3. Identify interactive elements: buttons, links, tabs, forms, tables
4. For each tab: `browser_click` → `browser_snapshot` → record panel content
5. For each dialog trigger: `browser_click` → `browser_snapshot` → record dialog content → close
6. For pagination: `browser_click` next → `browser_snapshot` → record changes

### Phase 3: Form Dry-Run

1. `browser_fill_form` → fill with test data
2. `browser_click` → submit
3. `browser_snapshot` → verify result (success message, error messages, validation)
4. Clean up: undo changes if possible (delete created data, restore edited data)

### Discovery Report Structure

After exploration, produce a Discovery Report documenting:

```markdown
## Discovery Report: {Page Name}

**URL**: {url}
**認證**: 需要 / 不需要

### 頁面結構
- Header: {description}
- Navigation: {links found}
- Main content: {description}

### 互動元素
| 元素 | 類型 | Locator | 備註 |
|------|------|---------|------|
| ... | button/link/tab/... | getByRole(...) | ... |

### 表單
| 欄位 | 類型 | 必填 | Locator |
|------|------|------|---------|
| ... | text/select/checkbox/... | 是/否 | ... |

### 表格
- 欄位: {column names}
- 資料筆數: {count}
- 分頁: 有/無

### Tabs
| Tab 名稱 | 內容摘要 |
|-----------|----------|
| ... | ... |
```

## RemoteBasePage Pattern

```typescript
import { type Page } from '@playwright/test';

export abstract class RemoteBasePage {
  constructor(protected page: Page) {}

  abstract goto(): Promise<void>;

  async waitForNavigation(urlPattern: string | RegExp) {
    await this.page.waitForURL(urlPattern, { timeout: 15_000 });
  }

  async waitForApi(urlPattern: string | RegExp) {
    return this.page.waitForResponse(
      (response) => {
        const url = response.url();
        if (typeof urlPattern === 'string') return url.includes(urlPattern);
        return urlPattern.test(url);
      },
      { timeout: 15_000 }
    );
  }
}
```

**Note**: This does NOT extend the local project's `BasePage`. It is an independent minimal base class because there is no local project to inherit from. No `toastSuccess`/`toastError` locators — toast selectors vary by site and must be discovered via MCP exploration.

## Test Scenario Generation Rules

| Exploration Finding | Generated Test |
|---|---|
| Navigation links | Click → verify URL change |
| Table with data | Row count > 0, column content assertions |
| Search / filter | Enter keyword → verify result change |
| Form | Fill → submit → verify feedback (toast/redirect/message) |
| Tabs | Switch → verify panel content change |
| Pagination | Click next → verify content change |
| Dialog trigger | Click → verify dialog opens → interact → close |
| Toggle / switch | Click → verify state change |
| Dropdown / select | Open → select option → verify selection |
| File upload | Upload → verify preview / success message |

## Report Adaptation

Markdown reports follow the existing `references/report-template.md` template with these adaptations:

- **測試 URL** field: fill with the remote URL (not `localhost`)
- **測試帳號** field: fill with the user-provided account, or `公開網站（無需登入）`
- **測試環境** field: `Remote` instead of `Local Dev Server`
- **專案路徑** field: path to the scaffolded Playwright project

All other fields follow the existing template.

## Known Limitations

1. **No `data-testid` injection** — Locators rely on ARIA roles and text; may break if the remote site changes its UI text or structure
2. **No internal API access** — Cannot call backend endpoints directly; use `waitForResponse` with observable URL patterns from network tab
3. **Toast/notification locators are site-specific** — Cannot assume `vue-sonner` or any specific toast library; must discover via MCP exploration
4. **Form validation behavior varies** — Must be explored empirically; inline errors, toast errors, and redirect patterns differ per site
5. **Cookie limitations** — `httpOnly` cookies cannot be exported via JavaScript; if the site uses httpOnly session cookies, storageState bridging may be incomplete. In such cases, consider using Playwright's own login flow in a setup project
6. **CORS and CSP** — Some sites may block Playwright's browser context; if tests fail with security errors, report to user
7. **Rate limiting** — Remote sites may rate-limit; add reasonable delays between form submissions if needed
