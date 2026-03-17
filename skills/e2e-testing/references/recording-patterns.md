# Recording Patterns

Patterns for Playwright Codegen recording → AI-powered POM/Spec transformation.

## Codegen Startup & Output

### Dependency Check

Before launching codegen, verify Playwright is a local dependency:

```bash
# Check if @playwright/test is in devDependencies
cd app && node -e "const pkg = require('./package.json'); if (!pkg.devDependencies?.['@playwright/test']) process.exit(1)"
```

If not installed:
```bash
cd app && pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

### Launch Command

```bash
# Ensure output directory exists
mkdir -p playwright/.recordings

# Launch codegen with output file
cd app && pnpm exec playwright codegen --output=playwright/.recordings/raw-recording.ts "$TARGET_URL"
```

**Parameters:**
- `--output` — write generated code to file (required, enables post-processing)
- `--target playwright-test` — output format (default, produces `@playwright/test` code)
- Target URL — the starting page for recording

### Output Format

Codegen produces a self-contained TypeScript file:

```typescript
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/overview/project-list');
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByPlaceholder('請輸入名稱').fill('Test Project');
  await page.getByRole('combobox', { name: '角色' }).selectOption('admin');
  await page.getByRole('button', { name: '確認' }).click();
  await expect(page.getByText('新增成功')).toBeVisible();
});
```

### Codegen Limitations

These interactions are **NOT recorded** by codegen (but Playwright API fully supports them):
- **Hover** — `page.hover()` (events too noisy for recording)
- **Drag & Drop** — `page.dragAndDrop()` (requires OS-level interception)
- **File Upload** — `page.setInputFiles()` / `fileChooser` (OS dialog)
- **Keyboard Shortcuts** — `page.keyboard.press()` (complex key combos)
- **Scroll** — Playwright auto-scrolls to elements (no explicit action needed)

### .gitignore

Ensure `playwright/.recordings/` is in the target project's `.gitignore`:

```
# Playwright codegen recordings (raw, not for commit)
playwright/.recordings/
```

## Raw Code → POM/Spec Conversion Rules

### Action Parsing

Parse the codegen output to extract a structured action list:

| Codegen Pattern | Action Type | Extract |
|----------------|-------------|---------|
| `page.goto(url)` | NAVIGATION | URL path |
| `page.getBy*(...).click()` | CLICK | locator, target element |
| `page.getBy*(...).fill(value)` | FILL | locator, input value |
| `page.getBy*(...).selectOption(value)` | SELECT | locator, selected value |
| `page.getBy*(...).check()` / `.uncheck()` | CHECK | locator, state |
| `page.getBy*(...).press(key)` | KEYPRESS | locator, key |
| `expect(page.getBy*(...)).toBeVisible()` | ASSERTION | locator, assertion type |
| `expect(page.getBy*(...)).toHaveText(text)` | ASSERTION | locator, expected text |

### URL Change Detection

Track `page.goto()` calls to determine which page(s) the recording spans:

```
page.goto('/overview/project-list')  → page = project-list
page.goto('/settings/members')       → page = members (cross-page!)
```

**Cross-page rule:** If the recording spans multiple pages, assign the test to the **first** `page.goto()` page. Mention other pages in the test name for clarity.

### Action Grouping

Group sequential actions into logical units:
1. **Form fill** — consecutive `fill()` + `selectOption()` + `check()` before a `click()` submit
2. **Dialog interaction** — actions between dialog open (click trigger) and close (submit/cancel)
3. **Navigation flow** — `goto()` → actions → `goto()` different page
4. **Assertion block** — consecutive `expect()` calls

## Locator Conversion Strategy

### Local Mode (localhost + project source code)

Priority: `data-testid` > `getByRole` > `getByText`

**Step 1:** Collect codegen locators from the raw recording.

**Step 2:** For each codegen locator, attempt to find the corresponding `data-testid`:

```typescript
// Option A: Check existing POM for matching data-testid
// If POM has: nameInput: page.locator('[data-testid="project-list-create-dialog-name-input"]')
// And codegen has: page.getByPlaceholder('請輸入名稱')
// → Map to the existing POM locator

// Option B: Use MCP browser to query data-testid at runtime
// browser_navigate → target page
// browser_run_code:
//   const el = await page.getByPlaceholder('請輸入名稱').elementHandle();
//   return el ? await el.getAttribute('data-testid') : null;
```

**Step 3:** Classification result for each locator:
- **HAS_TESTID** — `data-testid` found → use it in POM
- **NEEDS_INJECTION** — element has no `data-testid` → inject into Vue component, then use in POM
- **KEEP_SEMANTIC** — element is a pure text/role reference (e.g., toast message) → keep `getByText`/`getByRole`

### Remote Mode (external URL, no source code)

Keep codegen's original locators with this priority: `getByRole` > `getByText` > `getByPlaceholder` > `getByLabel` > CSS.

No `data-testid` injection possible. POM extends `RemoteBasePage`.

## Auto-Assignment Algorithm

Determine where to insert the generated test code.

### Step 1: Extract URL Path

From `page.goto()` calls, extract the URL path and derive:
- **domain** — first path segment (e.g., `/overview/project-list` → `overview`)
- **page-name** — last meaningful path segment (e.g., `project-list`)
- **PageName** — PascalCase version (e.g., `ProjectList`)

### Step 2: Find Existing Files

```
Glob("tests/e2e/{domain}/*{page-name}*.spec.ts")   → existing spec
Glob("tests/e2e/pages/*{PageName}Page*.ts")          → existing POM
```

### Step 3: Decision Matrix

| POM exists? | Spec exists? | Action |
|:-----------:|:------------:|--------|
| Yes | Yes | Add new locators to POM + insert test into existing `test.describe` block |
| Yes | No | Add new locators to POM + create new spec file |
| No | No | Suggest `/e2e:create` first, OR create minimal POM + spec |

### Step 4: Find Insertion Point

When inserting into an existing spec:
1. Parse the spec's `test.describe` structure
2. Match the recording's context (which dialog/tab/form was used) to existing describe blocks
3. Insert new `test()` calls at the end of the matching describe block
4. If no matching block exists, create a new `test.describe` at the appropriate nesting level

## CRUD Flow Detection

Detect CRUD operations from action sequences to apply correct test patterns.

### Create Flow

Pattern: dialog open → fill fields → submit → success assertion

```
CLICK (trigger button, e.g., "新增", "Add")
  → FILL (one or more fields)
  → SELECT (optional dropdowns)
  → CLICK (submit button, e.g., "確認", "Submit", "儲存")
  → ASSERTION (toast visible / list updated)
```

When detected:
- Wrap in `test.describe.serial` with cleanup
- Add cleanup test that searches for created data → deletes via UI

### Edit Flow

Pattern: row action → form prefilled → modify → submit

```
CLICK (row edit button or row itself)
  → FILL (modify existing values)
  → CLICK (submit/save)
  → ASSERTION (success toast)
```

When detected:
- Record original values before edit
- Restore original values after test

### Delete Flow

Pattern: row action → confirm dialog → success

```
CLICK (delete button on row)
  → CLICK (confirm in dialog, e.g., "確認刪除", "Delete")
  → ASSERTION (item removed / toast)
```

When detected:
- Ensure a create step precedes the delete (setup test data)
- Use `test.describe.serial` for create → delete sequence

### Recording Data Exception

Data created during manual recording uses the **user's original values** — do NOT apply `[E2E]` prefix or automated cleanup strategies. The recording captures what the user actually typed, and the generated test should preserve those exact values.

This differs from `/e2e:create` where Claude generates test data with `[E2E]` prefix for automated identification and cleanup.

## Code Generation Templates

### POM Locator Addition

```typescript
// Add to existing POM class
readonly recordedElement = this.page.locator('[data-testid="page-name-element-name"]');

// Or for dialog/container context
readonly someDialog = {
  // ... existing locators ...
  newElement: this.page.locator('[data-testid="page-name-dialog-new-element"]'),
}
```

### Spec Test Case (within existing describe)

```typescript
test('should perform recorded action description', async ({ page }) => {
  const somePage = new SomePagePage(page);
  await somePage.goto();

  // Recorded actions converted to POM methods
  await somePage.someDialog.trigger.click();
  await somePage.someDialog.nameInput.fill('recorded value');
  await somePage.someDialog.submitBtn.click();

  // Wait for API + assert
  await somePage.waitForApi('/api/endpoint');
  const toast = await somePage.getSuccessToast();
  expect(toast).toContain('成功');
});
```

### Serial CRUD Group

```typescript
test.describe.serial('Recorded CRUD Flow', () => {
  test('should create item', async ({ page }) => {
    const somePage = new SomePagePage(page);
    await somePage.goto();
    // ... create actions from recording ...
  });

  test('should verify created item exists', async ({ page }) => {
    const somePage = new SomePagePage(page);
    await somePage.goto();
    // ... verification assertions ...
  });

  test('should delete created item (cleanup)', async ({ page }) => {
    const somePage = new SomePagePage(page);
    await somePage.goto();
    // ... cleanup via UI ...
  });
});
```

### Supplementary Action Templates

For actions added via user description (not captured by codegen):

```typescript
// Hover interaction
await page.locator('[data-testid="user-avatar"]').hover();
await expect(page.locator('[data-testid="user-dropdown-menu"]')).toBeVisible();

// Drag and drop
await page.dragAndDrop(
  '[data-testid="item-row-1"]',
  '[data-testid="item-row-3"]'
);

// File upload
const fileInput = page.locator('[data-testid="attachment-upload-input"]');
await fileInput.setInputFiles('path/to/test-file.pdf');

// Keyboard shortcut
await page.keyboard.press('Control+s');
```
