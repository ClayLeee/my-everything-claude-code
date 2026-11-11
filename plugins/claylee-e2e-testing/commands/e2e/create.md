---
name: "e2e:create"
description: "Create POM + spec from coverage plan, run tests, and generate dual reports"
context: fork
---

# E2E Create — Build Tests + Execute + Report

Create POM + spec files from the coverage plan, execute tests, and generate dual reports.

All output must be in **繁體中文**. `$SKILL_DIR` below is `${CLAUDE_PLUGIN_ROOT}/skills/e2e-testing`.

## Step 1: Locate Coverage Plan

Look for `playwright/{page-name}/coverage-plan.md` (relative to `package.json` directory):
- If exactly one exists, use it
- If multiple exist, ask the user which page to create tests for
- If none exist, tell the user to run `/e2e:analyze` then `/e2e:plan` first

> **Note:** Legacy flat-file paths (`playwright/{page-name}-coverage-plan.md`) are also accepted for backward compatibility.

## Step 2: Read References

Read from `$SKILL_DIR/references/`:
- `code-patterns.md` — POM class patterns and spec file patterns
- `ui-patterns.md` — core interaction code (table, form, select, pagination, search, toggle, delete, edit)
- `ui-patterns-extended.md` — only if the coverage plan includes sortable columns, tabs, accordion, popover/filter, date picker, rich text editor, file upload, or drag-and-drop
- `test-data-policy.md` — UI-Only test data policy
- `project-patterns.md` — then apply `playwright/e2e-patterns.md` (in the `package.json` directory) if it exists; do not create it yet if absent

Other references are read where they are needed: `auth-patterns.md` in Step 3 when the page needs authentication, `mcp-discovery.md` in Step 7 when MCP pre-validation runs, `error-discrimination.md` in Step 8 when a test fails.

## Step 3: Scaffold Shared Files

Run the scaffold script from the **`package.json` directory** (not the repo root). Use `"targetDir":"."`.

Always scaffold the shared infrastructure every test needs:

```bash
echo '{"targetDir":".","templates":["BasePage","playwright.config.local","error-utils"],"variables":{"BASE_URL":"{baseUrl}","WEB_SERVER_COMMAND":"{webServerCommand}"}}' | node $SKILL_DIR/scripts/scaffold.js
```

Fill `{baseUrl}` and `{webServerCommand}` from the project's actual dev server — see SKILL.md § Running Tests (dev server URL and command, package manager runner `{run}` / `{exec}` from the lockfile).

If auth is **not** required, skip the rest of this step and proceed to Step 4.

---

**Auth setup** — only if the coverage plan indicates the page requires authentication (e.g., tests start from authenticated state, scenarios involve roles or permissions, page redirects to login when unauthenticated). Read `$SKILL_DIR/references/auth-patterns.md` first.

**Pass 1 — Check `.env.test.local`:**

If `.env.test.local` does not exist or is empty (no credentials filled in):

```bash
echo '{"targetDir":".","templates":["env.test.local"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

Stop here and tell the user; the remaining steps need the credentials:

```
📝 .env.test.local 已建立，請填入各角色的測試帳號密碼，完成後再繼續執行 /e2e:create。
```

---

**Pass 2 — Generate Auth Files** (`.env.test.local` exists with credentials filled in):

**1. Parse roles** from `.env.test.local`:
- Each `TEST_{ABBREV}_USERNAME` block defines one role
- Use the `# Comment` above the block as the role key, camelCased (e.g., `# System Admin` → `systemAdmin`)
- If no comment, lowercase the abbreviation (e.g., `TEST_ADMIN_USERNAME` → `admin`)
- `FIRST_ROLE` = the first role parsed

**2. Generate `tests/fixtures/auth.ts`** from the parsed roles (not from a template) — see `auth-patterns.md` § Generating auth.ts for the convention.

**3. Generate `tests/e2e/auth/auth.setup.ts`** from the parsed roles (not from a template) — one `setup()` block per role, each saving `.auth/{role}.json`:

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

**4. Generate `tests/e2e/pages/LoginPage.ts`** — read the project's login page source first, then implement `goto()` and `loginAs(account)`. See `auth-patterns.md` § LoginPage POM.

**5. Scaffold `playwright.config.ts` with auth config** (overwrite: true, replaces the no-auth version):

```bash
echo '{"targetDir":".","templates":["playwright.config.local.auth"],"variables":{"FIRST_ROLE":"{firstRole}","BASE_URL":"{baseUrl}","WEB_SERVER_COMMAND":"{webServerCommand}"},"overwrite":true}' | node $SKILL_DIR/scripts/scaffold.js
```

**6. Run auth setup** to create `.auth/*.json` for all roles:

```bash
{exec} playwright test tests/e2e/auth/auth.setup.ts
```

- **Success** → `.auth/{role}.json` created for all roles — proceed to Step 4
- **Failure** → stop here and tell the user; the tests cannot run without a valid session:
  ```
  ❌ Auth setup 失敗，請確認 .env.test.local 中的帳號密碼是否正確，完成後再繼續執行 /e2e:create。
  ```

## Step 4: Inject `data-testid`

Per the coverage plan's injection summary, add `data-testid` attributes to the page's source components (syntax per framework: SKILL.md § Framework Syntax). Only add attributes; change nothing else in the component files.

## Step 5: Build POM Class

Create `tests/e2e/pages/{PageName}Page.ts`:
- Extend `BasePage`
- Use `data-testid` locators from the coverage plan
- Nested object structure for dialogs, tabs, sub-components
- Include action methods for each user flow

If the constructor passes real feedback selectors (`super(page, { success: ..., error: ... })`), record them in `playwright/e2e-patterns.md` per `project-patterns.md` § Writing it.

## Step 6: Build Spec File

Create `tests/e2e/{domain}/{page-name}.spec.ts` (domain inferred from the page's route or its page directory, e.g. `/projects` or `src/views/projects/` / `app/projects/page.tsx` → `tests/e2e/projects/`):
- Follow the coverage plan's test scenario list and interaction depth checklist
- Tests start from authenticated state (no login in `beforeEach`)
- For destructive operations (create/edit/delete), follow UI-Only Test Data Policy
- Nested `test.describe` blocks matching the coverage plan structure

## Step 7: MCP Pre-validation (if dev server running)

If the dev server is running and MCP Playwright tools are available, read `$SKILL_DIR/references/mcp-discovery.md`, then:

1. `browser_navigate` → target page URL
2. `browser_snapshot` → get ARIA tree
3. `browser_run_code` → list the `data-testid` values present in the DOM:
   ```javascript
   const testIds = await page.locator('[data-testid]').evaluateAll(
     els => els.map(e => e.getAttribute('data-testid'))
   );
   return testIds;
   ```
4. Every `data-testid` the POM uses should appear in that list; for each missing one, check the Step 4 injection and fix the source component or the POM locator
5. For dialogs/tabs: `browser_click` to open each → `browser_snapshot` → verify inner `data-testid` attributes

Otherwise skip this step and proceed to test execution.

## Step 8: Execute Tests

Run tests from the `package.json` directory with the project's package manager runner (`{run}` / `{exec}` from the lockfile — see SKILL.md § Running Tests).

First, check `package.json` for the E2E script name (commonly `test:e2e`, `e2e`, or `playwright`):
- If a dedicated script exists: `E2E_REPORT_NAME={page-name} {run} test:e2e -- {spec-path}`
- If no dedicated script: `E2E_REPORT_NAME={page-name} {exec} playwright test {spec-path}`

```bash
E2E_REPORT_NAME={page-name} {run} test:e2e -- {spec-path}
```

If any test fails, read `$SKILL_DIR/references/error-discrimination.md` (and `mcp-discovery.md` if not yet read), classify each failure, and follow the reference's retry strategy: fix entity state through the UI for ENVIRONMENT errors, fix test data for RECOVERABLE ones, and run the MCP Debug Loop for element errors (snapshot the page, compare the failing locator with the DOM, inject the `data-testid` or fix the POM locator or add a wait, rerun the failing tests). Report what still fails with its classification and the MCP diagnostic; do not keep retrying past the limits the reference sets.

After all tests pass, if any POM or spec file changed in this session, record each fix in `playwright/e2e-patterns.md` per `project-patterns.md` § Writing it.

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
