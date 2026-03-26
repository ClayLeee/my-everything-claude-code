---
name: "e2e:remote"
description: "E2E test a remote URL — scaffold, explore via MCP, create tests, and generate reports"
argument-hint: "[target_url]"
model: opus
context: fork
---

# E2E Remote — Remote URL Testing + Report

Scaffold a minimal Playwright project, explore the remote URL via MCP, create tests, execute, and generate dual reports.

All output must be in **繁體中文**.

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
        Stop here. Tell the user:
        ```
        📝 .env.test.local 已建立，請填入測試帳號密碼，完成後再繼續執行 /e2e:remote。
        ```
        Do NOT proceed to Steps 2–9.
  - Test depth (single page / multi-page flow)

## Step 2: Locate Skill Directory & Load References (MANDATORY)

**Resolve `$SKILL_DIR`** per SKILL.md § Resolve `$SKILL_DIR` — Glob for `**/e2e-testing/SKILL.md`, extract directory path.

**Read references** from `$SKILL_DIR/references/`:
- `remote-testing.md` — scaffold templates, MCP auth bridging, remote locator strategy
- `mcp-discovery.md` — MCP exploration workflow
- `error-discrimination.md` — error classification framework
- `auth-patterns.md` — authentication patterns (if login needed)
- `coverage-checklist.md` — Interaction Depth Checklist（套用於 Remote Coverage Plan）

Do NOT proceed without reading. If resolution fails, report the error and stop.

## Step 3: Scaffold Playwright in Current Directory

Check if `playwright.config.ts` exists in the current working directory:
- **Exists** → reuse existing config (update `baseURL` if needed)
- **Does not exist** → scaffold in place:
  1. Create `package.json` (only `@playwright/test` dependency) — skip if already exists
  2. Scaffold config and base class via script:
     ```bash
     echo '{"targetDir":".","templates":["playwright.config.remote","RemoteBasePage"],"variables":{"BASE_URL":"TARGET_URL"}}' | node $SKILL_DIR/scripts/scaffold.js
     ```
  3. Run `pnpm install` and `pnpm exec playwright install chromium`

See `references/remote-testing.md` § Scaffold for details.

> **Note:** Do NOT scaffold to `~/e2e-remote/`. All files stay in the current working directory.

## Step 4: MCP Authentication (if needed)

Per `references/remote-testing.md` § MCP Authentication:
1. `browser_navigate` → login page
2. `browser_fill_form` + `browser_click` → complete login
3. `browser_run_code` → export cookies + localStorage
4. Write `.auth/remote.json` storageState file
5. Update `playwright.config.ts` to use storageState

## Step 5: Structured MCP Exploration

Per `references/remote-testing.md` § MCP Exploration Workflow, execute five passes then synthesize into artifacts.

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
- If a dialog contains another dialog trigger: record it but do NOT expand it

**Pass 4 — Form Dry-Run + Network Capture:**
- For each form: fill with valid test data → submit → `browser_network_requests` → record API endpoint / method / response status
- Clean up created data via UI after each form submission

**Pass 5 — Error Boundary Discovery (run after Pass 4, API structure known):**
- For each form: clear all required fields → submit → `browser_snapshot` → record inline error selectors + text
- Re-try with invalid format values (e.g. "not-an-email" in email field) → record error selectors + text
- Record submit button state on validation failure (disabled / still enabled)

### Step 5B: Generate Remote Semantic Element Table (SET)

From Pass 1–5 results, produce the ARIA → Behavior Classification table per `references/remote-testing.md` § ARIA → Behavior Taxonomy Mapping:

| Element | ARIA Locator | Behavior Type | Tab/Dialog Context | Scenarios Required |
|---------|-------------|---------------|-------------------|--------------------|
| ...     | `getByRole(...)` | `open-dialog` / `form-submit` / `delete-action` / ... | top-level / {tab} / {dialog} | ... |

### Step 5C: Generate Remote Coverage Plan

Apply `references/coverage-checklist.md` § Interaction Depth Checklist to the Remote SET:

1. Verify every form has a fill+submit+verify scenario
2. Verify every tab panel is treated as a sub-page with its own test rows
3. Verify every table has row count + column type assertions
4. Verify every CRUD operation has an error boundary scenario

**If checklist has unchecked items:**
- Run targeted `browser_snapshot` to gather missing info
- If still unconfirmable (e.g. requires specific data state): mark as `test.skip` with reason

Output the plan to `playwright/{page-name}/remote-coverage-plan.md` per `references/remote-testing.md` § Remote Coverage Plan Format.

**Do NOT proceed to Step 6 until all applicable checklist items are checked.**

## Step 6: Generate Test Files

Generate from `playwright/{page-name}/remote-coverage-plan.md` (NOT directly from exploration results).

1. `tests/e2e/pages/{PageName}Page.ts` — POM extending `RemoteBasePage`
2. `tests/e2e/{domain}/{page-name}.spec.ts` — scenarios from Coverage Plan (domain inferred from URL path, e.g. `/projects/` → `tests/e2e/projects/`)

**Remote mode rules:**
- No `data-testid` injection (no source code access) — **do NOT use `data-testid` unless the remote site already has them**
- Locator priority: `getByRole` > `getByText` > `getByPlaceholder` > CSS
- POM extends `RemoteBasePage` (not local `BasePage`)
- Table column assertions: use type-matching rules from `references/remote-testing.md` § Remote Table Column Assertion Rules
- Each Behavior Type from Remote SET maps to Minimum Test Steps per § ARIA → Behavior Taxonomy Mapping

## Step 7: Execute Tests

```bash
E2E_REPORT_NAME={page-name} pnpm exec playwright test {spec-path}
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
│   │       ├── Diagnose: compare failed locator vs ARIA tree (remote uses getByRole/getByText, not data-testid)
│   │       ├── Fix: update POM locator to match actual ARIA roles/text
│   │       └── Retry failing test(s) (max 1 MCP-debug retry)
│   └── PAGE LOADING error → Report FAIL
└── Generate report with per-failure classification + MCP diagnostic info

**After all tests pass** (whether initially, after MCP debug loop, or after user-guided fixes):
→ If any POM or spec file was modified in this session AND tests now pass:
  1. Read `playwright/e2e-patterns.md` (create with skeleton below if absent)
  2. Classify each fix made in this session:
     - Selector / locator change → `## Locators` entry: `- {component}: use {actual-selector} not {attempted-selector}`
     - Wait / timing change → `## Timing` entry: `- {operation}: needs {waitCondition} because {reason}`
  3. Skip if same pattern already present (substring match)
  4. If total file lines < 50 → append; if ≥ 50 → replace most similar entry in same section

Skeleton when creating from scratch:
```markdown
# E2E Patterns — {project-name}
<!-- Hard cap: 50 lines total. When full, replace similar entries, do NOT add. -->

## Locators
<!-- Quirks where remote UI renders differently than expected ARIA roles/text -->
<!-- Format: - {component}: use {selector} not {attempted-selector} -->

## Timing
<!-- Wait conditions this remote app needs beyond SKILL.md defaults -->
<!-- Format: - {operation}: needs {waitCondition} because {reason} -->

## API
<!-- Base URL and auth pattern (only if non-standard) -->
<!-- Format: - baseUrl: {pattern} | auth: {method} -->
```

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
