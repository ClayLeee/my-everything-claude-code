---
name: "e2e:remote"
description: "E2E test a remote URL — scaffold, explore via MCP, create tests, and generate reports"
argument-hint: "[target_url]"
context: fork
---

# E2E Remote — Remote URL Testing + Report

Scaffold a minimal Playwright project, explore the remote URL via MCP, create tests, execute, and generate dual reports.

All output must be in **繁體中文**. `$SKILL_DIR` below is `${CLAUDE_PLUGIN_ROOT}/skills/e2e-testing`.

## Step 1: Validate Input

- If `$ARGUMENTS` provided, use it as the target URL
- If no argument, ask the user for:
  - Target URL (required)
  - Whether login is needed
    - If yes: check if `.env.test.local` exists in the current directory
      - **Exists** → read credentials from the first role block (same format as local testing)
      - **Does not exist** → scaffold `.env.test.local` skeleton:
        ```bash
        echo '{"targetDir":".","templates":["env.test.local"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
        ```
        Stop here and tell the user; the remaining steps need the credentials:
        ```
        📝 .env.test.local 已建立，請填入測試帳號密碼，完成後再繼續執行 /e2e:remote。
        ```
  - Test depth (single page / multi-page flow)

## Step 2: Read References

Read from `$SKILL_DIR/references/`:
- `remote-testing.md` — scaffold templates, MCP auth bridging, remote locator strategy, exploration workflow
- `mcp-discovery.md` — MCP exploration workflow
- `coverage-checklist.md` — Interaction Depth Checklist（套用於 Remote Coverage Plan）
- `auth-patterns.md` — only if login is needed
- `project-patterns.md` — then apply `playwright/e2e-patterns.md` if it exists (remote variant); do not create it yet if absent

`error-discrimination.md` is read in Step 7 only if tests fail.

## Step 3: Scaffold Playwright in Current Directory

Check if `playwright.config.ts` exists in the current working directory:
- **Exists** → reuse existing config (update `baseURL` if needed)
- **Does not exist** → scaffold in place:
  1. Create `package.json` (only `@playwright/test` dependency) — skip if already exists
  2. Scaffold config and base class via script:
     ```bash
     echo '{"targetDir":".","templates":["playwright.config.remote","RemoteBasePage"],"variables":{"BASE_URL":"TARGET_URL"}}' | node $SKILL_DIR/scripts/scaffold.js
     ```
  3. Install with the directory's package manager (from its lockfile — see SKILL.md § Running Tests; no lockfile yet → `npm`): e.g. `pnpm install` + `pnpm exec playwright install chromium`, or `npm install` + `npx playwright install chromium`

See `remote-testing.md` § Scaffold for details. All files stay in the current working directory.

## Step 4: MCP Authentication (if needed)

Per `remote-testing.md` § MCP Authentication:
1. `browser_navigate` → login page
2. `browser_fill_form` + `browser_click` → complete login
3. `browser_run_code` → export cookies + localStorage
4. Write `.auth/remote.json` storageState file
5. Update `playwright.config.ts` to use storageState

## Step 5: Structured MCP Exploration

Per `remote-testing.md` § MCP Exploration Workflow, execute five passes then synthesize into artifacts.

### Step 5A: Multi-Pass MCP Exploration

**Pass 1 — Top-Level Structure:**
- `browser_navigate` → target page
- `browser_snapshot` → identify top-level structure: header, nav, main content, tabs, tables, forms, dialog triggers

**Pass 2 — Recursive Tabs (max 2 levels deep):**
- For each tab found in Pass 1: `browser_click` → `browser_snapshot` → record panel content
- For each sub-tab inside a panel: repeat click → snapshot (stop at depth 2)

**Pass 3 — Recursive Dialogs (1 level deep):**
- For each dialog trigger: `browser_click` → `browser_snapshot` → record dialog content
- Press `Escape` (or click close) to dismiss before moving to next trigger
- If a dialog contains another dialog trigger: record it but do not expand it

**Pass 4 — Form Dry-Run + Network Capture:**
- For each form: fill with valid test data → submit → `browser_network_requests` → record API endpoint / method / response status
- Clean up created data via UI after each form submission

**Pass 5 — Error Boundary Discovery (run after Pass 4, API structure known):**
- For each form: clear all required fields → submit → `browser_snapshot` → record inline error selectors + text
- Re-try with invalid format values (e.g. "not-an-email" in email field) → record error selectors + text
- Record submit button state on validation failure (disabled / still enabled)

### Step 5B: Generate Remote Semantic Element Table (SET)

From Pass 1–5 results, produce the ARIA → Behavior Classification table per `remote-testing.md` § ARIA → Behavior Taxonomy Mapping:

| Element | ARIA Locator | Behavior Type | Tab/Dialog Context | Scenarios Required |
|---------|-------------|---------------|-------------------|--------------------|
| ...     | `getByRole(...)` | `open-dialog` / `form-submit` / `delete-action` / ... | top-level / {tab} / {dialog} | ... |

### Step 5C: Generate Remote Coverage Plan

Apply `coverage-checklist.md` § Interaction Depth Checklist to the Remote SET:

1. Verify every form has a fill+submit+verify scenario
2. Verify every tab panel is treated as a sub-page with its own test rows
3. Verify every table has row count + column type assertions
4. Verify every CRUD operation has an error boundary scenario

Finish the checklist before generating tests: run targeted `browser_snapshot` calls for unchecked items, and mark anything still unconfirmable (e.g. it requires a specific data state) as `test.skip` with the reason.

Output the plan to `playwright/{page-name}/remote-coverage-plan.md` per `remote-testing.md` § Remote Coverage Plan Format.

## Step 6: Generate Test Files

Generate from `playwright/{page-name}/remote-coverage-plan.md` (not directly from exploration results).

1. `tests/e2e/pages/{PageName}Page.ts` — POM extending `RemoteBasePage`
2. `tests/e2e/{domain}/{page-name}.spec.ts` — scenarios from Coverage Plan (domain inferred from URL path, e.g. `/projects/` → `tests/e2e/projects/`)

**Remote mode rules:**
- No `data-testid` injection (no source code access); use `data-testid` only where the remote site already has it
- Locator priority: `getByRole` > `getByText` > `getByPlaceholder` > CSS
- POM extends `RemoteBasePage` (not local `BasePage`)
- Table column assertions: use type-matching rules from `remote-testing.md` § Remote Table Column Assertion Rules
- Each Behavior Type from Remote SET maps to Minimum Test Steps per § ARIA → Behavior Taxonomy Mapping

## Step 7: Execute Tests

```bash
E2E_REPORT_NAME={page-name} {exec} playwright test {spec-path}
```

If any test fails, read `$SKILL_DIR/references/error-discrimination.md`, classify each failure, and follow the reference's retry strategy: fix entity state through the UI for ENVIRONMENT errors, fix test data for RECOVERABLE ones, and run the MCP Debug Loop for element errors. In remote mode the loop compares the failing locator with the ARIA tree and fixes the POM's `getByRole` / `getByText` locator; there is no `data-testid` to inject. Report what still fails with its classification and the MCP diagnostic; do not keep retrying past the limits the reference sets.

After all tests pass, if any POM or spec file changed in this session, record each fix in `playwright/e2e-patterns.md` per `project-patterns.md` § Writing it (remote variant).

## Step 8: Generate Dual Reports

1. **HTML report** — Generated by Playwright in project's report directory
2. **Markdown report** — Generate via `generate-report.js`:

```bash
echo '{"pageName":"{page-name}","pageNameZh":"{page-name-zh}","testDate":"YYYY-MM-DD","testUrl":"{remote-url}","testAccount":"{account}","describeGroups":[...],"outputDir":"playwright/reports/{page-name}"}' | node $SKILL_DIR/scripts/generate-report.js
```

## Step 9: Completion

Tell the user:

```
✅ 遠端測試已建立並執行完畢。
📄 報告：
   - HTML: playwright/reports/{page-name}/
   - MD: playwright/reports/{page-name}/test-report.md
```

If there are failures, include the error classification summary.
