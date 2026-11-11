---
name: "e2e:maintain"
description: "Incrementally update E2E tests based on code changes or verbal descriptions, run tests, and generate reports"
context: fork
---

# E2E Maintain — Incremental Update + Execute + Report

Detect code changes, update POM + spec incrementally, execute tests, and generate dual reports.

All output must be in **繁體中文**. `$SKILL_DIR` below is `${CLAUDE_PLUGIN_ROOT}/skills/e2e-testing`.

## Step 1: Read References

Read from `$SKILL_DIR/references/`:
- `code-patterns.md` — POM and spec patterns for updates
- `coverage-checklist.md` — interaction depth checklist and coverage requirements
- `project-patterns.md` — then apply `playwright/e2e-patterns.md` (in the `package.json` directory) if it exists; do not create it yet if absent

`error-discrimination.md` and `mcp-discovery.md` are read in Step 6 only if tests fail.

## Step 2: Determine Change Scope

Determine the change scope using one or both input sources:

**A. Natural language description** — User verbally describes what changed or what needs testing:
- Parse the description to identify target pages, features, and test gaps
- Cross-reference with `coverage-checklist.md` to find coverage gaps
- Locate the corresponding source files, POM, and spec

**B. Git diff** — Automatic detection from code changes:
- Run `git diff --name-only` (current vs base branch) and filter, under the directory that holds the project's `package.json`, for:
  - the page/route directory — page components (e.g. `src/views/`, `src/pages/`, `app/`, `src/routes/`)
  - the shared component directory — shared components (e.g. `src/components/`)

Use (A) when only a description was given, (B) when none was, and merge both when both are available. If neither source yields relevant changes, inform the user and exit.

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

Add `data-testid` to new elements only. Only add attributes; change nothing else in the component files.

## Step 5: Update POM + Spec

- POM path: `tests/e2e/pages/{PageName}Page.ts`
- Spec path: `tests/e2e/{domain}/{page-name}.spec.ts` (domain inferred from the page's route or its page directory)
- Update POM class with new/removed locators and action methods
- Update spec file with new/removed/modified test cases
- Leave unrelated tests untouched

## Step 6: Execute Tests

Run from the `package.json` directory with the project's package manager runner (`{run}` / `{exec}` from the lockfile — see SKILL.md § Running Tests).

Check `package.json` for the E2E script name, then run:
- If a dedicated script exists: `E2E_REPORT_NAME={page-name} {run} test:e2e -- {spec-path}`
- If no dedicated script: `E2E_REPORT_NAME={page-name} {exec} playwright test {spec-path}`

If any test fails, read `$SKILL_DIR/references/error-discrimination.md` and `$SKILL_DIR/references/mcp-discovery.md`, classify each failure, and follow the reference's retry strategy: fix entity state through the UI for ENVIRONMENT errors, fix test data for RECOVERABLE ones, and run the MCP Debug Loop for element errors (snapshot the page, compare the failing locator with the DOM, inject the `data-testid` or fix the POM locator or add a wait, rerun the failing tests). Report what still fails with its classification; do not keep retrying past the limits the reference sets.

After all tests pass, if any POM or spec file changed in this session, record each fix in `playwright/e2e-patterns.md` per `project-patterns.md` § Writing it.

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
