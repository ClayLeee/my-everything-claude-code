# Remote Testing Reference

Patterns for E2E testing remote URLs without a local project.

## Table of Contents

- [When to Use](#when-to-use)
- [Scaffold Minimal Playwright Project](#scaffold-minimal-playwright-project) (Directory Structure, Templates, Setup)
- [Remote Locator Strategy](#remote-locator-strategy) (Priority, MCP ARIA Mapping, Translation Rules)
- [MCP Authentication & Auth Bridging](#mcp-authentication--auth-bridging) (Login Flow, Export State, Config)
- [MCP Exploration Workflow](#mcp-exploration-workflow) (Auth, Page Exploration, Form Dry-Run, Discovery Report)
- [ARIA → Behavior Taxonomy Mapping](#aria--behavior-taxonomy-mapping)
- [Recursive Exploration Protocol](#recursive-exploration-protocol)
- [Error Boundary Discovery Protocol](#error-boundary-discovery-protocol)
- [Remote Table Column Assertion Rules](#remote-table-column-assertion-rules)
- [Remote Coverage Plan Format](#remote-coverage-plan-format)
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

Scaffold via:

```bash
echo '{"targetDir":".","templates":["playwright.config.remote"],"variables":{"BASE_URL":"https://example.com"}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates a config with: no `webServer`, `fullyParallel: false`, `workers: 1`, `storageState` commented out (uncomment if auth needed).

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

**Before starting**: credentials must come from `.env.test.local` in the current directory (first `TEST_{ABBREV}_USERNAME` / `TEST_{ABBREV}_PASSWORD` block). If the file does not exist, `/e2e:remote` Step 1 will scaffold it and stop — do not proceed until the user fills it in.

Do NOT ask for credentials inline in the conversation (they would be stored in conversation history). Do NOT attempt `browser_fill_form` without reading confirmed credentials from `.env.test.local`.

```
1. browser_navigate → login page URL
2. browser_snapshot → identify form fields (email/username input, password input, submit button)
3. browser_fill_form → fill credentials (from .env.test.local or user-provided)
4. browser_click → click login/submit button
5. browser_wait_for → wait for redirect or dashboard element
6. browser_snapshot → verify logged-in state (confirm URL changed, no error message visible)
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

### Phase 2: Five-Pass Structured Exploration

**Pass 1 — Top-Level Structure:**
1. `browser_navigate` → target page
2. `browser_snapshot` → identify: header, nav, main content, tabs, tables, forms, dialog triggers

**Pass 2 — Recursive Tabs (max 2 levels deep):**
1. For each tab: `browser_click` → `browser_snapshot` → record panel content
2. For sub-tabs inside a panel: repeat (stop at depth 2)

**Pass 3 — Recursive Dialogs (1 level deep):**
1. For each dialog trigger: `browser_click` → `browser_snapshot` → record dialog content
2. Press `Escape` (or click close) to dismiss
3. Record any nested dialog triggers found inside, but do NOT expand them

**Pass 4 — Form Dry-Run + Network Capture:**
1. For each form: fill with valid test data → submit → `browser_network_requests`
2. Record: API endpoint, method, success response status
3. Clean up created data via UI after each submission

**Pass 5 — Error Boundary Discovery (run after Pass 4):**
1. For each form: clear all required fields → submit → `browser_snapshot` → record inline error selectors + text
2. Fill invalid format values (e.g. `"not-an-email"` in email field) → submit → record error selectors
3. Record submit button state on validation failure (disabled / still enabled)

### Phase 3: Synthesize Artifacts

After all five passes, produce in order:
1. **Remote SET** — ARIA → Behavior Classification table (see § ARIA → Behavior Taxonomy Mapping)
2. **Remote Coverage Plan** — apply coverage self-check questions and output `playwright/{page-name}/remote-coverage-plan.md` (see § Remote Coverage Plan Format)

Do NOT generate test files until Coverage Plan is complete and checklist is fully verified.

## ARIA → Behavior Taxonomy Mapping

Map MCP snapshot elements to behavior types using both ARIA role and context. Context disambiguates same-name buttons with different functions.

| ARIA Pattern | Context | Behavior Type |
|---|---|---|
| `button` | Top-level or toolbar, not inside a form | `open-dialog` |
| `button "確認" / "儲存" / "送出"` | Inside a form or dialog | `form-submit` |
| `button "刪除" / "移除"` | Any location | `delete-action` |
| `button "編輯"` | Inside table row or list item | `open-edit-dialog` |
| `tab` | Inside `tablist` | `tab-switch` |
| `checkbox` / `switch` | Standalone toggle | `toggle` |
| `combobox` | Any location | `select-option` |
| `textbox` | Inside search bar or filter area | `search-filter` |
| `table` | Any location | `data-display` |
| pagination controls | Below a table | `pagination` |

Once you identify a behavior type, think about the element's business purpose — what the user is trying to accomplish, what can go wrong, and how success is confirmed. Use these questions to derive test scenarios rather than mapping to prescribed steps.

**Disambiguation rule:** When two buttons share the same label (e.g. two `button "編輯"` in different rows), use a parent container to scope the locator:
```typescript
page.getByRole('row', { name: 'Item Name' }).getByRole('button', { name: '編輯' })
```

## Recursive Exploration Protocol

- **Depth tracking:** Tabs explore up to **2 levels** deep. Dialogs explore **1 level** deep.
- **Stop condition:** Stop when you encounter a UI library primitive with no custom behavior (e.g. a plain icon button with tooltip).
- **Shared components:** When the same pattern appears in multiple tabs, record it once and annotate as `shared` in the Tab/Dialog Context column.
- **Nested dialog triggers:** If a dialog contains another dialog trigger, record the trigger in the Remote SET with context `{parent-dialog} > trigger`, but mark it for Pass 3 exploration and do NOT recursively open it during the parent's Pass 3.

## Error Boundary Discovery Protocol

Execute after Pass 4 (API structure is known). For each `form-submit` element in the Remote SET:

1. Clear all required fields → click submit → `browser_snapshot`
   - Record: inline error selector(s), error text content
2. Fill invalid format values (e.g. `"not-an-email"` for email, `"abc"` for number) → click submit → `browser_snapshot`
   - Record: error selector(s), error message text
3. Observe submit button state during validation failure:
   - `disabled` → note `submitDisabledOnError: true`
   - `still enabled` → note `submitDisabledOnError: false`
4. Write results into the Remote SET's `Scenarios Required` column for that element:
   - `fill+submit → success; empty required → {inline-error-selector}; invalid format → {error-selector}`

**Do not skip this protocol.** Error boundary tests are required for every `form-submit` behavior type.

## Remote Table Column Assertion Rules

Infer column type from MCP snapshot cell content, then apply the matching assertion pattern:

| Inferred Column Type | Identification (snapshot content) | Playwright Assertion |
|---|---|---|
| Plain text | Any text, no special pattern | `.not.toHaveText('')` |
| Badge / Status | Fixed set of values (e.g. Active/Inactive/啟用/停用) | `.toHaveText(/Active\|Inactive/i)` |
| Date | Matches `YYYY-MM-DD` or `YYYY/MM/DD` | `.toHaveText(/\d{4}[-\/]\d{2}[-\/]\d{2}/)` |
| Progress fraction | `x/y` pattern | `.toHaveText(/\d+\/\d+/)` |
| Percentage | `x%` pattern | `.toHaveText(/\d+%/)` |
| Action button column | Cell contains `button` or `link` | `firstRow.getByRole('button', { name: '編輯' })` — always include `name` to avoid ambiguity when a row has multiple buttons |
| Empty / N/A | Confirmed no data or non-required field | `.toBeVisible()` or skip assertion with comment |

Apply one assertion per data column. Do not assert on action columns beyond button visibility.

## Remote Coverage Plan Format

Output to `playwright/{page-name}/remote-coverage-plan.md`:

```markdown
# Remote Coverage Plan: {Page Name}

**URL**: {url}
**探索日期**: {date}

## Remote Semantic Element Table

| Element | ARIA Locator | Behavior Type | Tab/Dialog Context | Scenarios Required |
|---------|-------------|---------------|-------------------|--------------------|
| 新增按鈕 | `getByRole('button', {name: '新增'})` | `open-dialog` | top-level | open → content visible → close |
| 確認送出 | `getByRole('button', {name: '確認'})` | `form-submit` | 新增 dialog | fill+submit → success; empty required → error |
| 刪除 | `getByRole('button', {name: '刪除'})` | `delete-action` | top-level | click → removal（需先探索是否有 confirm dialog）|

## Test Scenarios

| # | Scenario | Elements Involved | Assertions | Priority |
|---|----------|------------------|------------|----------|
| 1 | 頁面載入 — 顯示資料 | table | row count > 0 | P0 |
| 2 | 新增流程 — 成功 | 新增按鈕, form, 確認送出 | success feedback + row added | P0 |
| 3 | 新增流程 — 必填驗證 | form, 確認送出 | inline error visible | P1 |
| 4 | 刪除流程 | 刪除, confirm dialog | row removed | P1 |

## Coverage Self-Check

- [ ] 每個 Tab 作為 sub-page 處理了嗎？（Tab names: {list}）
- [ ] 每個 form 有測試「成功送出」和「送出失敗（必填/格式錯誤）」嗎？
- [ ] 每個 table 有驗證「資料存在（row count > 0）」和「每欄的型別正確」嗎？
- [ ] 每個 delete action 有驗證實際移除嗎？（依探索結果：confirm dialog / inline confirm / 直接刪除）
- [ ] 每個建立的測試資料都有清理機制嗎？

Verify all applicable items before generating tests.

## API Documentation

| Operation | Endpoint | Method | Success Status | Error Status |
|-----------|----------|--------|----------------|-------------|
| 新增       | /api/... | POST   | 201            | 422         |
| 刪除       | /api/... | DELETE | 204            | 404         |
```

## RemoteBasePage Pattern

Scaffold via:

```bash
echo '{"targetDir":".","templates":["RemoteBasePage"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates `tests/e2e/pages/RemoteBasePage.ts` — an independent minimal base class with `goto()`, `waitForNavigation()`, and `waitForApi()`.

**Note**: This does NOT extend the local project's `BasePage`. It is an independent minimal base class because there is no local project to inherit from. No `feedbackSuccess`/`feedbackError` locators — UI feedback selectors vary by site and must be discovered via MCP exploration.

## Test Scenario Generation Rules

Generate tests from the Remote Coverage Plan — **not** directly from exploration findings.

For each element in the Remote SET, identify its business purpose and derive scenarios by answering:

1. **What does the user accomplish?** → success path test
2. **What can go wrong?** → error path tests (validation failures, API errors, empty states)
3. **How is success confirmed?** → assertion design (feedback message, data update, URL change)

Use the ARIA → Behavior Taxonomy Mapping to classify elements — the behavior type is a semantic label that tells you the element's purpose, not a recipe for prescribed steps. Every `form-submit` element must also include the error boundary scenarios recorded during Pass 5.

Additional rules:
- Navigation links: verify URL change after click
- File upload: verify preview or success message appears
- Any scenario requiring specific data state that cannot be reliably reproduced: mark `test.skip` with reason comment

### Table Data Preconditions

**Empty table on arrival:**
Do NOT assert `row count > 0` against an empty table. If the page has a create UI (discovered in Pass 3), generate a `beforeAll` that creates one `[E2E]` record via UI before the display assertions run, and an `afterAll` that deletes it. If there is no create UI, mark table display tests as `test.skip` with reason.

**Pagination with insufficient data:**
Check during Pass 1 whether the next-page button is enabled (ARIA: `button "Next"` or equivalent, `aria-disabled` attribute). If disabled:
- If the page has a create UI: generate a `beforeAll` that creates `[E2E]` records in a loop (`browser_click` add button → fill → submit) until the next-page button becomes enabled (max 25 iterations), then `afterAll` to clean up.
- If no create UI exists: mark pagination test as `test.skip` with reason: `// No create UI — cannot guarantee enough data for pagination`.

Record the observed next-button selector and aria-disabled state in the Remote SET for use in the generated `beforeAll` condition check.

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
3. **Toast/notification locators are site-specific** — Cannot assume Sonner or any specific toast library; must discover via MCP exploration
4. **Form validation behavior varies** — Must be explored empirically; inline errors, toast errors, and redirect patterns differ per site
5. **Cookie limitations** — `httpOnly` cookies cannot be exported via JavaScript; if the site uses httpOnly session cookies, storageState bridging may be incomplete. In such cases, consider using Playwright's own login flow in a setup project
6. **CORS and CSP** — Some sites may block Playwright's browser context; if tests fail with security errors, report to user
7. **Rate limiting** — Remote sites may rate-limit; add reasonable delays between form submissions if needed
