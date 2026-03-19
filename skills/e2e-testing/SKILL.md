---
name: e2e-testing
description: |
  Playwright E2E testing patterns, Page Object Model, configuration, artifact management, and flaky test strategies.
  Use this skill whenever the user mentions E2E tests, Playwright, test automation, or page testing — even if they
  don't explicitly say "E2E". Trigger phrases include: "write tests", "add Playwright tests", "create page tests",
  "update tests", "deep test a page", "add data-testid", "fix flaky tests", "generate test report",
  "handle test errors", "retry failed form submission", "classify test failures",
  "test a remote URL", "remote test", "test this URL", "遠端測試", "測試網址",
  "record test", "錄製測試", "錄製", "codegen", "record browser actions", "錄製瀏覽器操作",
  "測試這個頁面", "幫我測這個功能", "這個功能怎麼驗證", "跑測試", "run tests",
  "build POM", "create POM", "Page Object Model", "建 POM", "更新 POM", "POM class",
  "分析頁面", "page analysis", "analyze page", "分析元件", "semantic analysis",
  "coverage plan", "覆蓋計畫", "測試計畫", "產生計畫", "generate plan",
  "更新 analysis", "update analysis", "補 analysis", "重新分析".
  Also trigger when the user discusses test maintenance, recording, locators, test reports, or test coverage gaps.
---

# E2E Testing Patterns

Playwright patterns for building stable, fast, and maintainable E2E test suites. Core conventions are inline below; detailed code templates are in `references/`.

## Auth & Login Strategy

Test accounts stored in `.env.test.local` (gitignored). Define roles matching your project's permission model (e.g., admin, manager, member, viewer).

Use `storageState` to skip login — the auth setup project runs once, saves JWT to `.auth/{role}.json`, and all subsequent tests start authenticated. No `beforeEach` login needed.

- `.auth/` and `.env.test.local` must be in `.gitignore`
- For full credential format, auth.setup.ts, and multi-role config, see **`references/auth-patterns.md`**

## BasePage Shared Class

All POM classes extend `BasePage` (`tests/e2e/pages/BasePage.ts`) which provides:

- Shared `page`, configurable `feedbackSuccess` / `feedbackError` locators via `FeedbackConfig` (presets: Sonner, MUI, Ant Design, React Hot Toast, or custom selectors)
- `interceptApi(urlPattern, action)` — intercept API response, return `{ ok, status, body }` for error classification (primary error detection)
- `waitForApi(urlPattern)` — fire-and-forget wait for API response
- `waitForNavigation(urlPattern)` — wait for SPA route change
- `getSuccessFeedback()` / `getErrorFeedback()` — read UI feedback message text (auxiliary verification, returns `null` if unconfigured)
- Abstract `goto()` — each POM implements its own navigation

For full implementation, see **`references/code-patterns.md`** § BasePage.

## Page Object Model (POM)

One page = one POM class extending `BasePage`. For pages with dialogs/tabs, use nested object structure:

```typescript
readonly createDialog = {
  container: this.page.locator('[data-testid="project-list-create-dialog"]'),
  nameInput: this.page.locator('[data-testid="project-list-create-dialog-name-input"]'),
  submitBtn: this.page.locator('[data-testid="project-list-create-dialog-submit-btn"]'),
}
```

For full POM examples (basic + deep testing), see **`references/code-patterns.md`** § POM Examples.

## No Mock Data

**All E2E tests must hit the real running dev server.** Never use fabricated API responses — mocked responses diverge from real API behavior over time, creating tests that pass locally but miss real bugs. E2E tests exist to verify the full stack as a user experiences it.

### Forbidden

- `route.fulfill()` with fabricated response bodies — this is mock data
- `route.abort()` to simulate network failures — use real error conditions instead
- Fake data constants (e.g. `MOCK_AUTH_METHODS_RESPONSE`) in test files
- `page.route()` + `waitForTimeout()` to simulate loading states
- Any test scenario that requires fabricated API responses to function

### What to Do Instead

- **Test against real API** — Hit the actual dev server, assert on real results
- **Trigger real errors** — Use wrong credentials, invalid input, missing fields to produce real API errors
- **Skip untestable states** — If a state (loading spinner, transient button disabled) can only be observed via mocking, it does not belong in E2E tests
- **Use `page.waitForResponse()`** — Waiting for real API responses is fine; intercepting and replacing them is not

## UI-Only Test Data Policy

All test data manipulation goes through the UI — no `request` fixture, no API calls in `beforeEach`/`afterEach`. This ensures tests exercise the same code paths a real user would, catching UI-layer bugs that API-only setup would skip (broken forms, missing validation, incorrect navigation).

### Naming Convention

Use `[E2E]` prefix for test-created data so it's identifiable and cleanable:
- `[E2E] Create Test`
- `[E2E] Delete Target`

### Lifecycle

For **create** tests:
1. Open dialog/form through UI (click add button)
2. Fill all required fields through UI interactions
3. Submit → wait for API response → assert success feedback + list update
4. Clean up through UI — search `[E2E]` data → delete via UI delete button

For **edit** tests:
- Use existing data on the page (first row) — do NOT create via API
- Record original values → edit through UI → assert success → restore original values through UI

For **delete** tests:
- Create the delete target through UI first (open create dialog → fill → submit)
- Search for the created data → delete through UI → confirm → assert removal

Use `test.describe.serial` to chain create → verify → delete within one group.

For full lifecycle examples and code patterns, see **`references/test-data-policy.md`**.

### When UI Cleanup Is Not Possible

If no delete UI exists, accept data persistence — use unique identifiers per run (timestamp suffix) to avoid collisions. Do NOT fall back to API cleanup.

## Test Scenario Guidelines

Not every feature requires all scenario types. Use judgement:

- **Happy path** — Always include
- **Invalid input** — When the feature accepts user input
- **Permission / role-based** — When the feature has role-based behavior
- **Empty state** — When the feature displays dynamic data. **Never skip CRUD tests because the list is empty** — create data through UI first, then test edit/delete on it. Only skip if the page genuinely has no create/edit/delete UI (read-only page). See `references/test-data-policy.md` § Empty Page Handling.
- **Error response** — When the feature depends on backend API calls. For detailed error classification (recoverable vs non-recoverable) and retry strategy, see **`references/error-discrimination.md`**

## Test Hygiene

- **Isolate tests** — Each test should be independent; no shared mutable state between tests
- **Fail fast** — Use `expect()` assertions at every key step; don't let tests drift after a critical failure
- **Wait for conditions, not time** — `waitForResponse()` > `waitForTimeout()`; never rely on arbitrary delays

## Incremental Test Maintenance

When UI code changes, incrementally update tests — rebuilding from scratch loses accumulated edge case coverage, flaky markers, and test ordering that were refined over time. Key rules:

- Edit spec files in place — deleting and recreating loses git history, flaky annotations, and manual tweaks
- Preserve existing test order, `test.describe` grouping, and flaky markers
- Before modifying any spec, produce a Change Analysis (changed files, affected specs, new/obsolete/modified scenarios)

## Locator Strategy (Priority Order)

1. `[data-testid="..."]` — Preferred, stable across refactors
2. `getByRole()` — Accessible, semantic
3. `getByText()` — For visible text content
4. `getByPlaceholder()` — For form inputs
5. CSS selectors — Last resort only

**Never use**: XPath (breaks on any DOM restructure, unreadable in POM classes, no framework support for injection), auto-generated class names (change every build)

> **Remote Test Mode exception**: When testing remote URLs without source code access, the priority order is reversed: `getByRole()` > `getByText()` > `getByPlaceholder()` > `getByLabel()` > CSS > `[data-testid]` (only if already present on the remote site). See **`references/remote-testing.md`** § Remote Locator Strategy for the full MCP ARIA → Playwright locator mapping table.

## data-testid Convention

### Naming Format

`{page}-{component}-{element}[-{qualifier}]` — all kebab-case.

### Examples

| data-testid | Description |
|-------------|-------------|
| `project-list-add-btn` | Add button on project list page |
| `project-list-edit-dialog` | Edit dialog on project list |
| `project-list-edit-dialog-tab-members` | Members tab inside edit dialog |
| `login-username-input` | Username input on login page |
| `login-sso-gitlab-btn` | GitLab SSO button on login page |

### Placement Rules

**Add to:** interactive elements (buttons, links, toggles), all form inputs, tab triggers, table wrappers, dialog content wrappers, feedback/notification containers.

**Do NOT add to:** purely decorative elements, layout wrappers, elements already uniquely identifiable by role + accessible name.

### Framework Syntax

**Vue:**
```html
<Button data-testid="add-btn">新增</Button>
<Button :data-testid="`row-${item.id}-edit-btn`">編輯</Button>
```

**React / Next.js:**
```tsx
<Button data-testid="add-btn">新增</Button>
<Button data-testid={`row-${item.id}-edit-btn`}>編輯</Button>
```

**Svelte:**
```svelte
<Button data-testid="add-btn">新增</Button>
<Button data-testid={`row-${item.id}-edit-btn`}>編輯</Button>
```

**Angular:**
```html
<button data-testid="add-btn">新增</button>
<button [attr.data-testid]="'row-' + item.id + '-edit-btn'">編輯</button>
```

**UI library pass-through** — most component libraries (shadcn, shadcn-vue, MUI, Radix, etc.) forward `data-testid` to the rendered DOM element. Verify by inspecting the output in DevTools.

The POM class itself serves as the registry of all `data-testid` values — no separate mapping file.

## Comprehensive Page Testing (Deep Testing)

### Component Tree Recursive Analysis

1. Read the page's main component (e.g., `index.vue`, `page.tsx`, `+page.svelte`, `page.component.ts`)
2. Identify all imported child components
3. Recursively read children to find further children
4. Stop at leaf nodes (UI library primitives — shadcn, MUI, Ant Design, etc. — and HTML elements)
5. Record all interactive elements at each level
6. For containers with tabs, list every tab panel and its inner components separately in the Coverage Plan — each tab is a sub-page requiring its own analysis

For the full semantic extraction procedure (recursive analysis, SET table, behavior taxonomy), see **`references/semantic-analysis.md`**. For Coverage Plan decomposition rules and validation, see **`references/coverage-checklist.md`**. For MCP browser-driven test discovery (session auth, exploration, form dry-run), see **`references/mcp-discovery.md`**.

> **Remote Test Mode**: When testing remote URLs without local source code, skip file-based component tree analysis entirely. Instead, use MCP browser exploration (`browser_navigate` → `browser_snapshot`) to discover page structure, interactive elements, and form fields. See **`references/remote-testing.md`** § MCP Exploration Workflow for the complete discovery procedure.

### Test Organization

One page = one spec file. Use nested `test.describe` mirroring the component hierarchy (Page > Dialog > Tab > Form).

### Interaction Depth Checklist

Apply to every container (dialog, tab panel, form) found in the Coverage Plan. Covers four categories: **Container Patterns** (dialog, tabs, popover, accordion), **Data Display** (table, pagination, empty state), **Form Patterns** (fields, validation, submit, select, rich text), and **Action Patterns** (toggle, delete confirm, drag-and-drop, multi-role).

Key mandatory items: every form needs a "fill + submit + verify feedback" test (this catches broken submissions that silent-fail); every table needs row count + per-column-type assertions (catches data binding and rendering bugs); every tab panel is treated as a sub-page with its own recursive checklist (tabs often have independent data loading that needs separate coverage).

For the complete checklist with all items and rules, see **`references/coverage-checklist.md`** § Interaction Depth Checklist. For runnable code examples of each pattern, see **`references/ui-patterns.md`**.

## No Manual Screenshots

**Do NOT call `page.screenshot()` in spec files.** Playwright is configured with `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, and `trace: 'on-first-retry'` — all failure artifacts are captured automatically to `playwright/test-results/`.

Manual screenshots create clutter, are not gitignored properly, and duplicate built-in functionality.

## Workflow Orchestration

When the user requests E2E testing, detect intent and execute the corresponding `/e2e:*` commands automatically:

| Trigger | Commands to Execute |
|---------|-------------------|
| "寫測試" / "write tests" / "深度測試" / "deep test" / new page without spec | `/e2e:analyze` → `/e2e:plan` → `/e2e:create` |
| "更新測試" / "update tests" / code changed / "補測試" / verbal description of test gaps | `/e2e:maintain` |
| "跑測試" / "run tests" / "execute tests" | `/e2e:run` |
| "遠端測試" / "測試網址" / "test URL" / user provides URL | `/e2e:remote` |
| "錄製測試" / "record test" / "錄製" / "codegen" / "record browser actions" | `/e2e:record` |

Most commands run in a forked subagent (`context: fork`) with their own references. The exception is `/e2e:record`, which runs inline (Phase 1 needs user interaction for supplementary input) and spawns Phase 2 via the Agent tool. Artifacts written to disk (`analysis.md`, `coverage-plan.md`, `recording-log.md`) serve as handoff between steps.

## Running Tests

Use the project's package manager scripts (not `npx` directly). Set `E2E_REPORT_NAME` to organize reports per page:

```bash
# Run specific spec with named report
E2E_REPORT_NAME=project-list pnpm test:e2e -- tests/e2e/projects/project-list.spec.ts
# Run headed (visible browser)
E2E_REPORT_NAME=project-list pnpm test:e2e -- --headed
# Interactive UI mode (no report)
pnpm test:e2e:ui
# View HTML report
pnpm test:e2e:report
```

> Adapt the commands to your project's `package.json` scripts. The key convention is setting `E2E_REPORT_NAME` so reports go to `playwright/reports/{page-name}/` instead of a generic `latest/` folder.

## Dual Test Reports

Every test run produces: (1) HTML report at `playwright/reports/{page-name}/`, (2) Markdown report at `playwright/reports/{page-name}/test-report.md` (no date in filename, overwrites on re-run). All paths are relative to the `package.json` directory. Use 繁體中文 for markdown reports, one table per `test.describe` group.

For the full markdown template, see **`references/report-template.md`**.

## Additional References

### Resolve `$SKILL_DIR` {#resolve-skill-dir}

All commands need the skill directory path to access references, scripts, and templates. Resolve it once per session:

1. `Glob("**/e2e-testing/SKILL.md")` — searches from CWD (works during plugin development)
2. If not found: `Glob("**/e2e-testing/SKILL.md", path: "~/.claude/plugins")` — searches the plugin cache
3. Extract the directory path from the result (remove `/SKILL.md` suffix) → `$SKILL_DIR`
4. Access resources as `$SKILL_DIR/references/`, `$SKILL_DIR/scripts/`, `$SKILL_DIR/templates/`

### Scripts

- **`scripts/scaffold.js`** — Template scaffolder: reads templates, replaces `{{VAR}}` placeholders, writes to target paths. stdin JSON: `{ targetDir, templates[], variables{}, overwrite }` → stdout JSON: `{ created[], skipped[], errors[] }`
- **`scripts/generate-report.js`** — Report generator: calculates summary stats, generates 繁體中文 markdown report. stdin JSON: `{ pageName, pageNameZh, testDate, testUrl, testAccount, describeGroups[], outputDir }` → stdout JSON: `{ outputPath, summary }`

### Templates

- **`templates/BasePage.ts`** — Full BasePage class with FeedbackConfig, FeedbackSelector, FEEDBACK_PRESETS (sonner, mui, antd, reactHotToast, dataTestId)
- **`templates/RemoteBasePage.ts`** — Minimal remote testing base class (no FeedbackConfig)
- **`templates/playwright.config.local.ts`** — Local config with `{{BASE_URL}}`, `{{WEB_SERVER_COMMAND}}` placeholders
- **`templates/playwright.config.remote.ts`** — Remote config with `{{BASE_URL}}` placeholder, no webServer
- **`templates/auth.ts`** — Credential loader (dotenv → accounts object)
- **`templates/auth.setup.ts`** — Auth setup project (sysadmin login → storageState)
- **`templates/env.test.local`** — .env.test.local template with role-based credential vars
- **`templates/error-utils.ts`** — ErrorClassificationConfig interface, classifyApiError function, submitAndIntercept helper

### References

- **`references/auth-patterns.md`** — storageState concept, multi-role auth guidance, scaffold pointers
- **`references/code-patterns.md`** — BasePage API surface, POM examples (including tab-internal locators), test structure, flaky patterns, artifact config, codegen workflow
- **`references/coverage-checklist.md`** — Coverage Plan decomposition rules, validation rules, Interaction Depth Checklist details
- **`references/error-discrimination.md`** — Error Discrimination Framework: error classification decision flow, recoverable vs non-recoverable determination, retry strategy, code examples (with import from error-utils)
- **`references/mcp-discovery.md`** — MCP-Driven Test Discovery: session auth, page exploration, form dry-run, MCP→Spec translation
- **`references/report-template.md`** — Report generation via generate-report.js, key rules
- **`references/semantic-analysis.md`** — Semantic Analysis: recursive extraction procedure, Semantic Element Table (SET), behavior taxonomy, column assertion rules, worked example
- **`references/test-data-policy.md`** — UI-Only Test Data Policy: forbidden API patterns, lifecycle examples (create with cleanup, edit/delete with setup)
- **`references/remote-testing.md`** — Remote Test Mode: scaffold via script, MCP auth bridging, remote locator strategy, MCP exploration workflow
- **`references/ui-patterns.md`** — Core UI pattern code examples: table, select, form, edit, pagination, search, toggle, delete, nested specs
- **`references/ui-patterns-extended.md`** — Extended UI patterns (load on-demand): sortable columns, tabs, accordion, popover/filter, date picker, rich text editor, file upload, drag-and-drop
- **`references/recording-patterns.md`** — Codegen workflow, locator transformation rules, auto-assignment algorithm, CRUD flow detection, code generation templates
