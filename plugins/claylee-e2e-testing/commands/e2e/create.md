---
name: "e2e:create"
description: "Create POM + spec from coverage plan, run tests, and generate dual reports"
model: opus
context: fork
---

# E2E Create — Build Tests + Execute + Report

Create POM + spec files from the coverage plan, execute tests, and generate dual reports.

All output must be in **繁體中文**.

## Step 1: Locate Coverage Plan

Look for `playwright/{page-name}/coverage-plan.md` (relative to `package.json` directory):
- If exactly one exists, use it
- If multiple exist, ask the user which page to create tests for
- If none exist, tell the user to run `/e2e:analyze` then `/e2e:plan` first

> **Note:** Legacy flat-file paths (`playwright/{page-name}-coverage-plan.md`) are also accepted for backward compatibility.

## Step 2: Locate Skill Directory & Load References (MANDATORY)

**Resolve `$SKILL_DIR`** per SKILL.md § Resolve `$SKILL_DIR` — Glob for `**/e2e-testing/SKILL.md`, extract directory path.

**Read references** from `$SKILL_DIR/references/`:
- `code-patterns.md` — POM class patterns and spec file patterns
- `ui-patterns.md` — core interaction code (table, form, select, pagination, search, toggle, delete, edit)
- `ui-patterns-extended.md` — **only if coverage plan includes**: sortable columns, tabs, accordion, popover/filter, date picker, rich text editor, file upload, or drag-and-drop
- `error-discrimination.md` — error classification for test failures
- `test-data-policy.md` — UI-Only test data policy
- `auth-patterns.md` — authentication setup patterns
- `mcp-discovery.md` — MCP tool reference and exploration patterns (for pre-validation and debug loop)

Do NOT proceed without reading. If resolution fails, report the error and stop.

## Step 2b: Load Project-Local Patterns (if present)

Check for project-local patterns — zero additional cost when absent:
- Check if `playwright/e2e-patterns.md` exists (in the `package.json` directory)
- If exists: Read it and apply its patterns throughout Steps 4–8:
  - `## Locators` — prefer these selectors over default `[data-testid]` when building POM
  - `## Timing` — add these wait conditions to relevant POM action methods
  - `## Feedback` — use this confirmed selector in `super(page, {...})` constructor
- If absent: skip — do not create it yet

## Step 3: Scaffold Shared Files

Run the scaffold script from the **`package.json` directory** (not the repo root). Use `"targetDir":"."`.

**Always scaffold** — shared infrastructure required by all tests:

```bash
echo '{"targetDir":".","templates":["BasePage","playwright.config.local","error-utils"],"variables":{"BASE_URL":"http://localhost:5173","WEB_SERVER_COMMAND":"pnpm dev"}}' | node $SKILL_DIR/scripts/scaffold.js
```

Adjust `BASE_URL` and `WEB_SERVER_COMMAND` based on the project's actual dev server.

If auth is **not** required, skip the rest of this step and proceed to Step 4.

---

**Conditionally: Auth Setup** — only if the coverage plan indicates the page requires authentication (e.g., tests start from authenticated state, scenarios involve roles or permissions, page redirects to login when unauthenticated).

**Pass 1 — Check `.env.test.local`:**

If `.env.test.local` does not exist or is empty (no credentials filled in):

```bash
echo '{"targetDir":".","templates":["env.test.local"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

Stop here. Tell the user:

```
📝 .env.test.local 已建立，請填入各角色的測試帳號密碼，完成後再繼續執行 /e2e:create。
```

Do NOT proceed to Steps 4–10.

---

**Pass 2 — Generate Auth Files** (`.env.test.local` exists with credentials filled in):

**1. Parse roles** from `.env.test.local`:
- Each `TEST_{ABBREV}_USERNAME` block defines one role
- Use the `# Comment` above the block as the role key, camelCased (e.g., `# System Admin` → `systemAdmin`)
- If no comment, lowercase the abbreviation (e.g., `TEST_AD_USERNAME` → `ad`)
- `FIRST_ROLE` = the first role parsed

**2. Dynamically generate `tests/fixtures/auth.ts`** (do NOT scaffold from template) — see `references/auth-patterns.md` § Generating auth.ts for the full convention.

**3. Dynamically generate `tests/e2e/auth/auth.setup.ts`** (do NOT scaffold from template) — one `setup()` block per role, each saving `.auth/{role}.json`:

```typescript
import { test as setup } from "@playwright/test";
import { accounts } from "../../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

setup("authenticate as {role}", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.{role});
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/{role}.json" });
});
// ... one block per parsed role
```

**4. Generate `tests/e2e/pages/LoginPage.ts`** — read the project's login page source first, then implement `goto()` and `loginAs(account)`. See `references/auth-patterns.md` § LoginPage POM.

**5. Scaffold `playwright.config.ts` with auth config** (overwrite: true, replaces the no-auth version):

```bash
echo '{"targetDir":".","templates":["playwright.config.local.auth"],"variables":{"FIRST_ROLE":"{firstRole}","BASE_URL":"{baseUrl}","WEB_SERVER_COMMAND":"{webServerCommand}"},"overwrite":true}' | node $SKILL_DIR/scripts/scaffold.js
```

**6. Run auth setup** to create `.auth/*.json` for all roles:

```bash
pnpm exec playwright test tests/e2e/auth/auth.setup.ts
```

- **Success** → `.auth/{role}.json` created for all roles — proceed to Step 4
- **Failure** → Stop. Tell the user:
  ```
  ❌ Auth setup 失敗，請確認 .env.test.local 中的帳號密碼是否正確，完成後再繼續執行 /e2e:create。
  ```
  Do NOT proceed to Steps 4–10.

## Step 4: Inject `data-testid`

Per the coverage plan's injection summary:
- Add `data-testid` attributes to Vue components
- **Only add attributes — change nothing else in the component files**

## Step 5: Build POM Class

Create `tests/e2e/pages/{PageName}Page.ts`:
- Extend `BasePage`
- Use `data-testid` locators from the coverage plan
- Nested object structure for dialogs, tabs, sub-components
- Include action methods for each user flow

After writing the POM constructor with feedback config:
- If `super(page, {})` (no feedback selectors) → skip
- If `super(page, { success: ..., error: ... })` → check `playwright/e2e-patterns.md`:
  - `## Feedback` section empty or file absent → create file skeleton if needed, write entry
  - `## Feedback` already has an entry → skip (trust existing confirmed selector)

The file skeleton when creating from scratch:
```markdown
# E2E Patterns — {project-name}
<!-- Hard cap: 50 lines total. When full, replace similar entries, do NOT add. -->

## Locators
<!-- Quirks where UI library wrappers change the actual DOM element to target -->
<!-- Format: - {component}: use {selector} not {default} -->

## Timing
<!-- Wait conditions this app needs beyond SKILL.md defaults -->
<!-- Format: - {operation}: needs {waitCondition} because {reason} -->

## Feedback
<!-- The ONE confirmed feedback selector for this project -->
<!-- Format: - library: {name} | success: {selector} | error: {selector} -->

## API
<!-- Base URL and auth pattern (only if non-standard) -->
<!-- Format: - baseUrl: {pattern} | auth: {method} -->
```

## Step 6: Build Spec File

Create `tests/e2e/{domain}/{page-name}.spec.ts` (domain inferred from `src/views/` subdirectory, e.g. `src/views/projects/` → `tests/e2e/projects/`):
- Follow the coverage plan's test scenario list and interaction depth checklist
- Tests start from authenticated state (no login in `beforeEach`)
- For destructive operations (create/edit/delete), follow UI-Only Test Data Policy
- Nested `test.describe` blocks matching the coverage plan structure

## Step 7: MCP Pre-validation (if dev server running)

IF dev server is running AND MCP Playwright tools are available:

1. `browser_navigate` → target page URL
2. `browser_snapshot` → get ARIA tree
3. `browser_run_code` → verify all POM `data-testid` locators exist in DOM:
   ```javascript
   const testIds = await page.locator('[data-testid]').evaluateAll(
     els => els.map(e => e.getAttribute('data-testid'))
   );
   return testIds;
   ```
4. Cross-check: every `data-testid` in the POM class MUST appear in the DOM scan result
5. For each missing `data-testid`:
   - Check if the injection in Step 4 was applied correctly
   - Fix the source component or POM locator
6. For dialogs/tabs: `browser_click` to open each → `browser_snapshot` → verify inner `data-testid` attributes

IF dev server NOT running OR MCP NOT available:
→ Skip this step. Proceed to test execution.

## Step 8: Execute Tests

Run tests from the `package.json` directory. **Never use `npx playwright test`** — always go through the project's package manager.

First, check `package.json` for the E2E script name (commonly `test:e2e`, `e2e`, or `playwright`):
- If a dedicated script exists: `E2E_REPORT_NAME={page-name} pnpm test:e2e -- {spec-path}`
- If no dedicated script: `E2E_REPORT_NAME={page-name} pnpm exec playwright test {spec-path}`

```bash
E2E_REPORT_NAME={page-name} pnpm test:e2e -- {spec-path}
```

**After execution, apply Error Discrimination:**

IF any test fails:
├── Classify each failure:
│   ├── FORM SUBMISSION error (API returned 4xx/5xx)?
│   │   ├── ENVIRONMENT (disabled/archived/locked)? → Fix entity state via MCP UI, retry
│   │   ├── RECOVERABLE (duplicate/invalid format)? → Fix test data per strategy table → Retry (max 2)
│   │   └── Other → Report FAIL with classification
│   ├── ELEMENT INTERACTION error (not found / timeout / not interactable)?
│   │   └── **MCP Debug Loop** (see error-discrimination.md § MCP Debug Loop):
│   │       ├── `browser_navigate` → failing page
│   │       ├── `browser_snapshot` → get ARIA tree
│   │       ├── Diagnose: query failed locator in DOM, find actual testid or confirm missing
│   │       ├── Fix: inject data-testid / fix POM locator / add waitFor
│   │       └── Retry failing test(s) (max 1 MCP-debug retry)
│   └── PAGE LOADING error → Report FAIL
└── Generate report with per-failure classification + MCP diagnostic info

**After all tests pass** (whether initially, after MCP debug loop, or after user-guided fixes):
→ If any POM or spec file was modified in this session AND tests now pass:
  1. Read `playwright/e2e-patterns.md` (create with skeleton from Step 5 if absent)
  2. Classify each fix made in this session:
     - Selector / locator change → `## Locators` entry: `- {component}: use {actual-selector} not {attempted-selector}`
     - Wait / timing change → `## Timing` entry: `- {operation}: needs {waitCondition} because {reason}`
  3. Skip if same pattern already present (substring match)
  4. If total file lines < 50 → append; if ≥ 50 → replace most similar entry in same section

## Step 9: Generate Dual Reports

1. **HTML report** — Already generated by Playwright at `playwright/reports/{page-name}/`
2. **Markdown report** — Generate via `generate-report.js`:

```bash
echo '{"pageName":"{page-name}","pageNameZh":"{page-name-zh}","testDate":"YYYY-MM-DD","testUrl":"{test-url}","testAccount":"{account}","describeGroups":[...],"outputDir":"playwright/reports/{page-name}"}' | node $SKILL_DIR/scripts/generate-report.js
```

Include per-failure error classification (recoverable vs non-recoverable) in the `error` field of each failed test.

## Step 10: Completion

Tell the user:

```
✅ 測試已建立並執行完畢。
📄 報告：
   - HTML: playwright/reports/{page-name}/
   - MD: playwright/reports/{page-name}/test-report.md
```

If there are failures, include the error classification summary.
