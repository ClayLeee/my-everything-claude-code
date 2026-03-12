---
name: "e2e:maintain"
description: "Incrementally update E2E tests based on code changes, run tests, and generate reports"
category: E2E Testing
tags: [e2e, playwright, maintain, update, incremental]
skills:
  - e2e-testing
---

# E2E Maintain — Incremental Update + Execute + Report

Detect code changes, update POM + spec incrementally, execute tests, and generate dual reports.

All output must be in **繁體中文**.

## Step 1: Load References (MANDATORY — do not skip)

Read these files before proceeding:
- `references/error-discrimination.md` — error classification framework
- `references/code-patterns.md` — POM and spec patterns for updates

Do NOT proceed to Step 2 without reading both files.

## Step 2: Detect Changes

Run `git diff --name-only` (current vs base branch) and filter for:
- `app/src/views/` — page components
- `app/src/components/` — shared components

If no relevant changes detected, inform the user and exit.

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
│   ├── FORM SUBMISSION + recoverable keyword?
│   │   └── YES → Fix per strategy table → Retry (max 2)
│   │   └── NO → Report FAIL with classification
│   ├── PAGE LOADING error → Report FAIL
│   └── ELEMENT INTERACTION error → Report FAIL
└── Generate report with per-failure classification

## Step 7: Generate Dual Reports

1. **HTML report** — `playwright/reports/{page-name}/`
2. **Markdown report** — `playwright/{page-name}-test-report.md` per `references/report-template.md`

## Step 8: Completion

Tell the user:

```
✅ 測試已更新並執行完畢。
📄 報告：
   - HTML: playwright/reports/{page-name}/
   - MD: playwright/{page-name}-test-report.md
```

If there are failures:
```
⚠️ 如有失敗請查看報告中的錯誤分類。
```
