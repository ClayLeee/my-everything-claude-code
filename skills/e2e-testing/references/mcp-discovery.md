# MCP-Driven Test Discovery

After injecting `data-testid` and before writing POM/spec, use Playwright MCP browser to interact with the page. This is the "try before write" approach.

## MCP Tool Reference

| Tool | When to Use |
|---|---|
| `browser_navigate` | Go to target page |
| `browser_snapshot` | Get ARIA tree — primary tool for understanding page structure |
| `browser_click` | Click buttons, links, tabs, triggers |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select dropdown option by value (more reliable than click for `<select>`) |
| `browser_type` | Type into inputs with `slowly` option (triggers key handlers like debounced search) |
| `browser_press_key` | Press keyboard keys (Enter, Tab, Escape) — confirm forms, close dialogs, navigate |
| `browser_hover` | Reveal tooltips, hidden menus, hover-only actions |
| `browser_wait_for` | Wait for text to appear/disappear, or a fixed time |
| `browser_handle_dialog` | Accept/dismiss native browser dialogs (alert, confirm, prompt) |
| `browser_file_upload` | Upload files to file input elements |
| `browser_drag` | Drag-and-drop between two elements |
| `browser_network_requests` | Inspect API calls — discover endpoints, methods, response structure |
| `browser_console_messages` | Read console output — detect JS errors, unhandled rejections, warnings |
| `browser_take_screenshot` | Visual verification when ARIA snapshot is insufficient |
| `browser_run_code` | Execute arbitrary Playwright code — query DOM, extract attributes, run custom logic |
| `browser_evaluate` | Evaluate JS on the page or a specific element |
| `browser_resize` | Test responsive layouts at different viewport sizes |
| `browser_tabs` | List, create, close, or switch browser tabs |

## MCP Session Authentication

MCP browser and `@playwright/test` storageState are separate — MCP needs its own login:

1. `browser_navigate` → login page
2. `browser_fill_form` → fill test account credentials
3. `browser_click` → submit login
4. `browser_wait_for` → wait for navigation to complete

## Interactive Exploration

After navigating to the target page:

1. `browser_snapshot` → get ARIA tree to understand page structure
2. `browser_run_code` → verify `data-testid` attributes exist and are unique
3. Open each tab/dialog via `browser_click` → `browser_snapshot` → record content
4. `browser_hover` on action icons → `browser_snapshot` → discover tooltips and hidden menus
5. Update Coverage Plan if actual page differs from source code analysis

## API Discovery (mandatory before writing error handling)

Use `browser_network_requests` to discover the project's API structure. This feeds directly into the `ErrorClassificationConfig` defined in `error-discrimination.md`.

### Step 1: Trigger API calls and capture them

```
browser_navigate → target page (observe GET requests for data loading)
browser_network_requests → record API endpoints and response patterns

browser_fill_form → fill a form with valid data
browser_click → submit
browser_network_requests → capture the POST/PUT request + response
```

### Step 2: Trigger errors to discover error response structure

```
// Duplicate: submit the same data again
browser_fill_form → same data
browser_click → submit
browser_network_requests → capture 409 response body structure

// Required field: clear a required field and submit
browser_fill_form → leave name empty
browser_click → submit
browser_network_requests → capture 400/422 response body structure
```

### Step 3: Build ErrorClassificationConfig from observations

Inspect the captured error responses to identify:

- **Which body field contains the error code?** → `codeField` (e.g., `"code"`, `"type"`, `"errorCode"`)
- **Which body field contains the message?** → `messageField` (e.g., `"message"`, `"error"`, `"detail"`)
- **Which body field contains the problematic field name?** → `fieldField` (e.g., `"field"`, `"param"`)
- **What error codes exist?** → populate `environmentCodes` and `recoverableCodes`

Document the discovered structure in the Coverage Plan or as a code comment in BasePage.

## Console Error Detection

After each exploration step, check for JavaScript errors that could affect test stability:

```
browser_console_messages (level: "error")
→ If errors found: document in Coverage Plan as potential flakiness sources
→ Common issues: failed API calls, unhandled promise rejections, missing resources
```

Run this check especially after:
- Page initial load
- Form submission (both success and error)
- Tab switching
- Dialog open/close

## Form Dry-Run (mandatory for every form)

For each form in the Coverage Plan:

1. Open dialog via MCP → fill test data → submit
2. `browser_network_requests` → verify API was called, check response status
3. `browser_snapshot` → verify UI feedback visible in ARIA tree (if the project has feedback)
4. **Clean up through UI** — search for created data → delete via UI delete button. If no delete UI exists, note in Coverage Plan
5. If dry-run fails → investigate and fix. Never skip.

### Special form elements during dry-run

| Element | MCP Tool | Notes |
|---|---|---|
| Text input | `browser_fill_form` | Standard fields |
| `<select>` dropdown | `browser_select_option` | Use value, not click |
| Portaled dropdown (Radix, etc.) | `browser_click` trigger → `browser_click` option | Portaled content needs two clicks |
| Date picker | `browser_type` into input or `browser_click` calendar cells | Try input first, fall back to calendar |
| Rich text editor | `browser_click` editor → `browser_type` content | Target the `contenteditable` area |
| File upload | `browser_file_upload` with file path | Needs actual file on disk |
| Checkbox / Radio | `browser_fill_form` with `true`/`false` | Use form fill, not click |
| Native dialog (alert/confirm) | `browser_handle_dialog` | Must be called before the action that triggers it |

## Pre-Validation Workflow

### Step 1: Dry-Run

```
browser_navigate → /overview/project-list
browser_click → [Add Project button]
browser_fill_form → [{name: "Project Name", type: "textbox", value: "[E2E] Test"}]
browser_click → [Submit button]
browser_network_requests → verify POST /api/projects returned 200
browser_snapshot → verify success feedback visible in ARIA tree
// Clean up via UI:
browser_click → [Search input]
browser_type → "[E2E]"
browser_click → [Delete button on created row]
browser_handle_dialog → accept (if native confirm)
browser_click → [Confirm delete] (if custom dialog)
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
