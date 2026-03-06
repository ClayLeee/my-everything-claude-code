# MCP-Driven Test Discovery

After injecting `data-testid` and before writing POM/spec, use Playwright MCP browser to interact with the page. This is the "try before write" approach.

## MCP Session Authentication

MCP browser and `@playwright/test` storageState are separate — MCP needs its own login:

1. `browser_navigate` → login page
2. `browser_fill_form` → fill test account credentials
3. `browser_click` → submit login
4. `browser_wait_for` → wait for navigation to complete

## Interactive Exploration

After navigating to the target page:

- `browser_snapshot` → get ARIA tree to understand page structure
- `browser_run_code` → verify `data-testid` attributes exist and are unique
- Open each tab/dialog via `browser_click` → `browser_snapshot` → record content
- Update Coverage Plan if actual page differs from static Vue file analysis

## Form Dry-Run (mandatory for every form)

For each form in the Coverage Plan:

1. Open dialog via MCP → fill test data → submit
2. Verify success toast via `browser_snapshot`
3. **Clean up through UI** — search for created data → delete via UI delete button. If no delete UI exists, note in Coverage Plan
4. If dry-run fails → investigate and fix. Never skip.

## Pre-Validation Workflow

### Step 1: Dry-Run

```
browser_navigate → /overview/project-list
browser_click → [Add Project button]
browser_fill_form → [{name: "Project Name", value: "[E2E] Test"}]
browser_click → [Submit button]
browser_snapshot → verify toast visible in ARIA tree
// Clean up via UI:
browser_click → [Search button]
browser_fill_form → [{name: "Search", value: "[E2E]"}]
browser_click → [Delete button on created row]
browser_click → [Confirm delete]
```

### Step 2: Map MCP refs to data-testid

```javascript
// In browser_run_code
const testIds = await page.locator('[data-testid]').evaluateAll(
  els => els.map(el => ({
    testid: el.getAttribute('data-testid'),
    tag: el.tagName,
    text: el.textContent?.trim().slice(0, 30)
  }))
);
return testIds;
```

### Step 3: Translate to Spec

MCP snapshot uses ARIA `ref` (no `data-testid`/`id`/`class`). Translation rules:

- MCP action succeeds → identify corresponding `data-testid` locator → write into spec
- Use `browser_run_code` to query element's `data-testid`:
  ```javascript
  await page.locator('[aria-label="..."]').getAttribute('data-testid')
  ```
- Specs MUST use `page.locator('[data-testid="..."]')` — never MCP `ref` values

Every `fill`/`click` in the spec corresponds to a MCP action verified to work.
