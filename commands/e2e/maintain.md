---
name: "e2e:maintain"
description: "Incrementally update E2E tests based on code changes or verbal descriptions, run tests, and generate reports"
model: sonnet
context: fork
---

# E2E Maintain — Incremental Update + Execute + Report

Detect code changes, update POM + spec incrementally, execute tests, and generate dual reports.

All output must be in **繁體中文**.

## Step 1: Locate Skill Directory & Load References (MANDATORY)

**Resolve `$SKILL_DIR`** per SKILL.md § Resolve `$SKILL_DIR` — Glob for `**/e2e-testing/SKILL.md`, extract directory path.

**Read references** from `$SKILL_DIR/references/`:
- `error-discrimination.md` — error classification framework
- `code-patterns.md` — POM and spec patterns for updates
- `coverage-checklist.md` — interaction depth checklist and coverage requirements
- `mcp-discovery.md` — MCP tool reference (for debug loop)

Do NOT proceed without reading. If resolution fails, report the error and stop.

## Step 1b: Load Project-Local Patterns (if present)

Check for project-local patterns — zero additional cost when absent:
- Check if `playwright/e2e-patterns.md` exists (in the `package.json` directory)
- If exists: Read it and apply its patterns throughout Steps 4–6:
  - `## Locators` — prefer these selectors over default `[data-testid]` when updating POM
  - `## Timing` — add these wait conditions to relevant POM action methods
  - `## Feedback` — use this confirmed selector if updating feedback-related code
- If absent: skip — do not create it yet

## Step 2: Determine Change Scope

Determine the change scope using one or both input sources:

**A. Natural language description** — User verbally describes what changed or what needs testing:
- Parse the description to identify target pages, features, and test gaps
- Cross-reference with `references/coverage-checklist.md` to find coverage gaps
- Locate the corresponding source files, POM, and spec

**B. Git diff** — Automatic detection from code changes:
- Run `git diff --name-only` (current vs base branch) and filter for:
  - `app/src/views/` — page components
  - `app/src/components/` — shared components

**Decision logic:**
- User provided description only → use (A)
- No description provided → use (B)
- Both available → merge results from (A) and (B)

If neither source yields relevant changes, inform the user and exit.

## Step 3: Analyze Delta

For each changed file:
1. Read the changed component
2. Find the corresponding POM + spec files (if they exist)
3. Identify what changed:
   - New elements added → need `data-testid` + POM locator + spec test
   - Elements removed → need POM locator removal + spec test removal
   - Element behavior changed → need spec assertion update
   - API calls changed → need spec expectation update

If no existing spec/POM found for the changed page, suggest `/e2e:create` instead.

## Step 4: Update `data-testid`

Add `data-testid` to new elements only. **Only add attributes — change nothing else.**

## Step 5: Update POM + Spec

- POM path: `tests/e2e/pages/{PageName}Page.ts`
- Spec path: `tests/e2e/{domain}/{page-name}.spec.ts` (domain inferred from `src/views/` subdirectory)
- Update POM class with new/removed locators and action methods
- Update spec file with new/removed/modified test cases
- Do NOT touch unrelated tests

## Step 6: Execute Tests

Run from the `package.json` directory. **Never use `npx playwright test`** — always go through the project's package manager.

Check `package.json` for the E2E script name, then run:
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
  1. Read `playwright/e2e-patterns.md` (create with skeleton if absent — see `/e2e:create` Step 5 for skeleton format)
  2. Classify each fix made in this session:
     - Selector / locator change → `## Locators` entry: `- {component}: use {actual-selector} not {attempted-selector}`
     - Wait / timing change → `## Timing` entry: `- {operation}: needs {waitCondition} because {reason}`
  3. Skip if same pattern already present (substring match)
  4. If total file lines < 50 → append; if ≥ 50 → replace most similar entry in same section

## Step 7: Generate Dual Reports

1. **HTML report** — `playwright/reports/{page-name}/`
2. **Markdown report** — Generate via `generate-report.js`:

```bash
echo '{"pageName":"{page-name}","pageNameZh":"{page-name-zh}","testDate":"YYYY-MM-DD","testUrl":"{test-url}","testAccount":"{account}","describeGroups":[...],"outputDir":"playwright/reports/{page-name}"}' | node $SKILL_DIR/scripts/generate-report.js
```

## Step 8: Completion

Tell the user:

```
✅ 測試已更新並執行完畢。
📄 報告：
   - HTML: playwright/reports/{page-name}/
   - MD: playwright/reports/{page-name}/test-report.md
```

If there are failures:
```
⚠️ 如有失敗請查看報告中的錯誤分類。
```
