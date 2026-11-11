---
name: "e2e:record"
description: "Record browser actions with Playwright codegen, then convert to POM + spec test code"
argument-hint: "[target_url]"
---

# E2E Record — Playwright Codegen + AI Transform

Record browser actions via Playwright codegen, then convert to project-standard POM + spec test code.

All output must be in **繁體中文**. `$SKILL_DIR` below is `${CLAUDE_PLUGIN_ROOT}/skills/e2e-testing`.

**Two-phase design:**
- **Phase 1 (inline):** Launch codegen → read results → ask user for supplementary interactions → produce recording artifact
- **Phase 2 (fork subagent via Agent tool):** Auto-assignment + locator transform + code generation + execute + report

---

## Phase 1: Recording (inline, requires user interaction)

### Step 1: Validate Input & Mode Detection

- If `$ARGUMENTS` provided, use it as the target URL
- If no argument, ask the user for the target URL

**Mode detection:**
- **Local mode:** URL is `localhost` or local dev server AND project has `tests/e2e/` directory → locator strategy = `data-testid` priority, POM extends `BasePage`
- **Remote mode:** External URL, no local source code → locator strategy = preserve codegen semantic locators, POM extends `RemoteBasePage`

### Step 2: Read References

Read `$SKILL_DIR/references/recording-patterns.md` (codegen workflow, locator transform rules, code gen templates). Phase 1 needs nothing else.

### Step 3: Launch Playwright Codegen

**Step 3a: Verify Playwright dependency**

Run these from the directory that holds the project's `package.json`, using the project's package manager (`{exec}` from the lockfile — see SKILL.md § Running Tests).

Confirm `@playwright/test` is in `package.json` devDependencies:
```bash
node -e "process.exit(require('./package.json').devDependencies?.['@playwright/test'] ? 0 : 1)"
```

If not installed (`{add-dev}` = `pnpm add -D` / `yarn add -D` / `npm install -D` / `bun add -d`):
```bash
{add-dev} @playwright/test && {exec} playwright install chromium
```

**Step 3b: Ensure .gitignore excludes recordings**

Check if `playwright/.recordings/` is in the project's `.gitignore`. If not, append it:
```
# Playwright codegen recordings (raw, not for commit)
playwright/.recordings/
```

**Step 3c: Launch codegen**

```bash
mkdir -p playwright/.recordings && {exec} playwright codegen --output=playwright/.recordings/raw-recording.ts "$TARGET_URL"
```

Tell the user:
```
🎬 瀏覽器已開啟，請直接在瀏覽器中操作。
📝 Playwright 會即時錄製您的所有動作。
✅ 完成後關閉瀏覽器視窗，錄製將自動結束。
```

Wait for the codegen process to complete (triggered when user closes the browser).

### Step 4: Read & Parse Codegen Output

1. Read `playwright/.recordings/raw-recording.ts` (relative to the directory that holds the project's `package.json`)
2. Parse the raw code and extract:
   - All `page.goto()` calls → identify which pages were visited
   - All actions (click, fill, select, check, etc.) → extract locator + value
   - All assertions (`expect()` calls)
   - Navigation sequence → determine if cross-page recording
3. Build a structured action list with: `[{ type, locator, value?, page_url }]`

### Step 5: Supplementary Interaction Prompt

Present the recording summary to the user:

```
📋 錄製摘要：
   - 動作數：{count}
   - 頁面：{page_urls}
   - 操作：{action_summary}

⚠️ Playwright codegen 無法錄製以下類型的互動：
   - Hover（如 hover menu、tooltip）
   - Drag & Drop
   - File Upload
   - Keyboard Shortcuts

📝 是否有需要補充的互動？請用自然語言描述，例如：
   - 「hover 到使用者頭像會顯示一個下拉選單」
   - 「拖曳第一個項目到第三個位置」
   - 「上傳一個 PDF 檔案到附件欄位」
   輸入「無」或「跳過」繼續。

🎯 是否要指定這段錄製的目標？（選填，留空則自動根據 URL 判斷）
   - 新增測試：「加到 {頁面名稱} 的測試中」
   - 修正測試：「修正 {頁面名稱} 裡的 {測試名稱}」
   - 新增特定流程：「把新增使用者的流程加到 user-list 的測試」
```

If user describes supplementary interactions:
1. Generate corresponding Playwright API code (`page.hover()`, `page.dragAndDrop()`, `setInputFiles()`, etc.)
2. Mark as `// [supplementary] described by user` and append to the action list
3. Include in the recording artifact for Phase 2

If user specifies a target (page name, test name, or flow description):
- Record as `user_target` in the recording artifact
- Phase 2 Step 7 will use this to override URL-based auto-assignment

If user says "無", "跳過", "skip", or similar → proceed to Step 6.

### Step 6: Generate Recording Artifact + Spawn Phase 2

**Step 6a: Determine page-name**

From the first `page.goto()` URL:
- Extract path → derive `page-name` (kebab-case) and `domain` (first path segment)
- Example: `/admin/items` → domain = `admin`, page-name = `items`

**Step 6b: Write recording artifact**

Write `playwright/{page-name}/recording-log.md` with:
- Mode (local/remote)
- Target URL
- Raw codegen output (full file content)
- Supplementary interactions (if any)
- Parsed action list summary
- Detected CRUD flows (per `recording-patterns.md` § CRUD Flow Detection)

**Step 6c: Spawn Phase 2 subagent**

Use the **Agent tool** to spawn a fork subagent with the following prompt. Include:
- Path to `recording-log.md`
- The skill directory path (`$SKILL_DIR`, for reference loading)
- Mode (local/remote)
- The Phase 2 instructions below

---

## Phase 2: Code Generation (fork subagent via Agent tool)

Read from `$SKILL_DIR/references/`:
- `recording-patterns.md` — codegen workflow, locator transform rules, code gen templates
- `code-patterns.md` — BasePage, POM patterns, spec patterns
- `ui-patterns.md` — core interaction code examples
- `ui-patterns-extended.md` — only if the recording involves sortable columns, tabs, accordion, date picker, rich text, file upload, or drag-and-drop
- `test-data-policy.md` — UI-only data policy, CRUD lifecycle
- `project-patterns.md` — then apply `playwright/e2e-patterns.md` if it exists; do not create it yet if absent

`error-discrimination.md` and `mcp-discovery.md` are read in Step 12 only if tests fail (Step 8 also uses MCP in local mode; read `mcp-discovery.md` there if the tool reference is needed).

### Step 7: Auto-Assignment — Resolve Target Files

**If `user_target` was specified in Step 5**, use it to resolve the target directly:
- Parse the page name and test name from the user's description
- `Glob` for matching spec/POM files using the specified page name
- If a specific test name was given (「修正 X 測試」), locate that `test()` block within the spec for targeted replacement

**If no `user_target`**, fall back to URL-based auto-detection:

1. Extract URL path → domain + page-name + PageName
2. `Glob("tests/e2e/{domain}/*{page-name}*.spec.ts")` → find existing spec
3. `Glob("tests/e2e/pages/*{PageName}Page*.ts")` → find existing POM
4. Apply decision matrix:

| POM exists? | Spec exists? | Action |
|:-----------:|:------------:|--------|
| Yes | Yes | Add new locators to POM + insert test into correct `test.describe` block |
| Yes | No | Add new locators to POM + create new spec file |
| No | No | Suggest `/e2e:create` first, OR create minimal POM + spec |

5. If inserting into existing spec: parse `test.describe` structure, find the matching block for the recording's context (page/dialog/tab), insert new test at end of that block

### Step 8: Locator Transformation

**Local mode:**
1. Read existing POM's `data-testid` locator list
2. For each codegen locator, attempt to find matching `data-testid`:
   - Check POM for existing locator that targets the same element
   - Use Playwright MCP (`browser_navigate` + `browser_run_code`) to query the real DOM:
     ```js
     // Example: codegen produced getByRole('button', { name: '新增' })
     // → query for data-testid on that element
     await page.getByRole('button', { name: '新增' }).getAttribute('data-testid')
     ```
3. Classify each locator:
   - **HAS_TESTID** → use existing `data-testid` in POM
   - **NEEDS_INJECTION** → mark for Step 9
   - **KEEP_SEMANTIC** → keep `getByText`/`getByRole` (e.g., toast assertions)

**Remote mode:** Keep codegen's original locators as-is (already semantic). Skip to Step 10.

### Step 9: data-testid Injection (Local mode only)

For locators marked **NEEDS_INJECTION**:
1. Find the page's source component (the file that renders the element — `.vue`, `.tsx`/`.jsx`, `.svelte`, or Angular template)
2. Inject `data-testid` following naming convention: `{page}-{component}-{element}`
3. Only add `data-testid` attributes; change nothing else in the component

Remote mode: skip this step entirely.

### Step 10: Code Generation

Transform codegen output into project-standard POM + spec:

**POM updates:**
- Add missing locators (Local: `data-testid`, Remote: `getByRole`/`getByText`)
- Local POM extends `BasePage`, Remote POM extends `RemoteBasePage`
- Use nested object structure for dialog/tab locators

**Spec generation:**
- Convert to nested `test.describe` structure
- Add `waitForResponse` for API calls where appropriate
- Add toast assertions where form submissions detected
- **CRUD detection:** If action sequence matches create flow → wrap in `test.describe.serial` with cleanup test
- **Recording data exception:** Preserve user's original recorded values; the `[E2E]` prefix and automated cleanup do not apply to manually recorded data
- Insert into target `test.describe` block (from Step 7)

### Step 11: Conflict Detection

Check existing spec for semantically similar tests:
- Compare test names and action sequences
- If a near-duplicate exists, report the conflict and suggest:
  - Skip (don't add duplicate)
  - Replace (overwrite existing test)
  - Rename (add with disambiguated name)

### Step 12: Execute Tests + Error Discrimination

Run from the directory that holds the project's `package.json` (`{run}` / `{exec}` from the lockfile — see SKILL.md § Running Tests; no dedicated script → `{exec} playwright test {spec-path}`):

```bash
E2E_REPORT_NAME={page-name} {run} test:e2e -- {spec-path}
```

If any test fails, read `$SKILL_DIR/references/error-discrimination.md` and `$SKILL_DIR/references/mcp-discovery.md`, classify each failure, and follow the reference's retry strategy: fix entity state through the UI for ENVIRONMENT errors, fix test data for RECOVERABLE ones, and run the MCP Debug Loop for element errors (snapshot the page, compare the failing locator with the DOM, inject the `data-testid` or fix the POM locator or add a wait, rerun the failing tests; in remote mode fix the ARIA locator instead). Report what still fails with its classification and the MCP diagnostic; do not keep retrying past the limits the reference sets.

After all tests pass, if any POM or spec file changed in this session, record each fix in `playwright/e2e-patterns.md` per `project-patterns.md` § Writing it (remote variant in remote mode).

### Step 13: Dual Reports + Completion

1. **HTML report** — Generated by Playwright at `playwright/reports/{page-name}/`
2. **Markdown report** — Generate via `generate-report.js`:

```bash
echo '{"pageName":"{page-name}","pageNameZh":"{page-name-zh}","testDate":"YYYY-MM-DD","testUrl":"{test-url}","testAccount":"{account}","describeGroups":[...],"outputDir":"playwright/reports/{page-name}"}' | node $SKILL_DIR/scripts/generate-report.js
```

Tell the user:

```
✅ 錄製測試已建立並執行完畢。
📄 產出：
   - 原始錄製：playwright/.recordings/raw-recording.ts
   - POM 更新：tests/e2e/pages/{PageName}Page.ts
   - Spec 更新：tests/e2e/{domain}/{page-name}.spec.ts
   - HTML 報告：playwright/reports/{page-name}/
   - MD 報告：playwright/reports/{page-name}/test-report.md
```

If there are failures, include the error classification summary.
