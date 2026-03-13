---
name: "e2e:maintain"
description: "Incrementally update E2E tests based on code changes or verbal descriptions, run tests, and generate reports"
category: E2E Testing
tags: [e2e, playwright, maintain, update, incremental]
context: fork
skills:
  - e2e-testing
---

# E2E Maintain — Incremental Update + Execute + Report

Detect code changes, update POM + spec incrementally, execute tests, and generate dual reports.

All output must be in **繁體中文**.

## Step 1: Locate Skill Directory & Load References (MANDATORY)

**Step 1a: Find the skill directory**
Locate the e2e-testing skill directory by finding its SKILL.md:
1. `Glob("**/e2e-testing/SKILL.md")` — searches CWD (works during plugin development)
2. If not found: `Glob("**/e2e-testing/SKILL.md", path: "~/.claude/plugins")` — searches plugin cache

Extract the **directory path** from the result (remove `/SKILL.md` suffix). This is `$SKILL_DIR`.

**Step 1b: Read references**
Read the following files using `$SKILL_DIR/references/{filename}`:
- `$SKILL_DIR/references/error-discrimination.md` — error classification framework
- `$SKILL_DIR/references/code-patterns.md` — POM and spec patterns for updates
- `$SKILL_DIR/references/coverage-checklist.md` — interaction depth checklist and coverage requirements
- `$SKILL_DIR/references/report-template.md` — markdown report template and rules

Do NOT proceed without reading all listed files. If both Glob attempts fail, report the error and stop.

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

Run from the `app/` directory:
```bash
E2E_REPORT_NAME={page-name} pnpm test:e2e -- {spec-path}
```

**After execution, apply Error Discrimination:**

IF any test fails:
├── Classify each failure using error-discrimination.md:
│   ├── FORM SUBMISSION error?
│   │   ├── Environment keyword (disabled/archived/locked/suspended)? → ENVIRONMENT: **do NOT modify test code**, fix environment state through UI (MCP), then retry
│   │   ├── Recoverable keyword (重複/duplicate/invalid format)? → Fix per strategy table → Retry (max 2)
│   │   └── Other → Report FAIL with classification
│   ├── PAGE LOADING error → Report FAIL
│   └── ELEMENT INTERACTION error → Report FAIL
└── Generate report with per-failure classification

## Step 7: Generate Dual Reports

1. **HTML report** — `playwright/reports/{page-name}/`
2. **Markdown report** — `playwright/reports/{page-name}/test-report.md` per `references/report-template.md`

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
