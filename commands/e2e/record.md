---
name: "e2e:record"
description: "Record browser actions with Playwright codegen, then convert to POM + spec test code"
category: E2E Testing
tags: [e2e, playwright, record, codegen, recording]
argument-hint: "[target_url]"
model: opus
skills:
  - e2e-testing
---

# E2E Record — Playwright Codegen + AI Transform

Record browser actions via Playwright codegen, then convert to project-standard POM + spec test code.

All output must be in **繁體中文**.

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

### Step 2: Locate Skill Directory & Load References (MANDATORY)

**Step 2a: Find the skill directory**
Locate the e2e-testing skill directory by finding its SKILL.md:
1. `Glob("**/e2e-testing/SKILL.md")` — searches CWD (works during plugin development)
2. If not found: `Glob("**/e2e-testing/SKILL.md", path: "~/.claude/plugins")` — searches plugin cache

Extract the **directory path** from the result (remove `/SKILL.md` suffix). This is `$SKILL_DIR`.

**Step 2b: Read references (Phase 1 only needs recording-patterns)**
Read the following file using `$SKILL_DIR/references/{filename}`:
- `$SKILL_DIR/references/recording-patterns.md` — codegen workflow, locator transform rules, code gen templates

Do NOT proceed without reading this file. If both Glob attempts fail, report the error and stop.

### Step 3: Launch Playwright Codegen

**Step 3a: Verify Playwright dependency**

Confirm `@playwright/test` is in `package.json` devDependencies:
```bash
cd app && node -e "const pkg = require('./package.json'); if (!pkg.devDependencies?.['@playwright/test']) process.exit(1)"
```

If not installed:
```bash
cd app && pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

**Step 3b: Ensure .gitignore excludes recordings**

Check if `playwright/.recordings/` is in the project's `.gitignore`. If not, append it:
```
# Playwright codegen recordings (raw, not for commit)
playwright/.recordings/
```

**Step 3c: Launch codegen**

```bash
cd app && mkdir -p playwright/.recordings && pnpm exec playwright codegen --output=playwright/.recordings/raw-recording.ts "$TARGET_URL"
```

Tell the user:
```
🎬 瀏覽器已開啟，請直接在瀏覽器中操作。
📝 Playwright 會即時錄製您的所有動作。
✅ 完成後關閉瀏覽器視窗，錄製將自動結束。
```

Wait for the codegen process to complete (triggered when user closes the browser).

### Step 4: Read & Parse Codegen Output

1. Read `playwright/.recordings/raw-recording.ts` (relative to `app/` or project root)
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
```

If user describes supplementary interactions:
1. Generate corresponding Playwright API code (`page.hover()`, `page.dragAndDrop()`, `setInputFiles()`, etc.)
2. Mark as `// [supplementary] described by user` and append to the action list
3. Include in the recording artifact for Phase 2

If user says "無", "跳過", "skip", or similar → proceed to Step 6.

### Step 6: Generate Recording Artifact + Spawn Phase 2

**Step 6a: Determine page-name**

From the first `page.goto()` URL:
- Extract path → derive `page-name` (kebab-case) and `domain` (first path segment)
- Example: `/overview/project-list` → domain = `overview`, page-name = `project-list`

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
- Path to `$SKILL_DIR` (for reference loading)
- Mode (local/remote)
- The Phase 2 instructions below

---

## Phase 2: Code Generation (fork subagent via Agent tool)

The subagent should load these references from `$SKILL_DIR/references/`:
- `recording-patterns.md` — codegen workflow, locator transform rules, code gen templates
- `code-patterns.md` — BasePage, POM patterns, spec patterns
- `ui-patterns.md` — interaction code examples
- `test-data-policy.md` — UI-only data policy, CRUD lifecycle
- `error-discrimination.md` — error classification framework
- `report-template.md` — markdown report template

### Step 7: Auto-Assignment — Resolve Target Files

Based on `page.goto()` URLs from the recording, locate existing test files:

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
1. Find the corresponding Vue component file in `src/`
2. Inject `data-testid` following naming convention: `{page}-{component}-{element}`
3. **Only add `data-testid` attributes — change nothing else in the component**

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
- **Recording data exception:** Preserve user's original recorded values — do NOT apply `[E2E]` prefix or automated cleanup for manually recorded data
- Insert into target `test.describe` block (from Step 7)

### Step 11: Conflict Detection

Check existing spec for semantically similar tests:
- Compare test names and action sequences
- If a near-duplicate exists, report the conflict and suggest:
  - Skip (don't add duplicate)
  - Replace (overwrite existing test)
  - Rename (add with disambiguated name)

### Step 12: Execute Tests + Error Discrimination

```bash
cd app && E2E_REPORT_NAME={page-name} pnpm test:e2e -- {spec-path}
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

### Step 13: Dual Reports + Completion

1. **HTML report** — Generated by Playwright at `playwright/reports/{page-name}/`
2. **Markdown report** — Write `playwright/reports/{page-name}/test-report.md` per `references/report-template.md`

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
