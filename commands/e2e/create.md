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

## Step 3: Scaffold Shared Files

Run the scaffold script from the **`package.json` directory** (not the repo root). Use `"targetDir":"."`.

**Always scaffold** — shared infrastructure required by all tests:

```bash
echo '{"targetDir":".","templates":["BasePage","playwright.config.local","error-utils"],"variables":{"BASE_URL":"http://localhost:5173","WEB_SERVER_COMMAND":"pnpm dev"}}' | node $SKILL_DIR/scripts/scaffold.js
```

**Conditionally scaffold auth** — only if the coverage plan indicates the page requires authentication (e.g., tests start from authenticated state, scenarios involve roles or permissions, page redirects to login when unauthenticated):

```bash
echo '{"targetDir":".","templates":["auth","auth.setup","env.test.local"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

If auth is scaffolded, also create `tests/e2e/pages/LoginPage.ts` — read the project's login page source first, then implement `goto()` and `loginAs(account)`. See `references/auth-patterns.md` § LoginPage POM.

Adjust `BASE_URL` and `WEB_SERVER_COMMAND` based on the project's actual dev server.

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
