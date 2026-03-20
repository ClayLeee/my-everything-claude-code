# Error Discrimination Framework

When E2E tests encounter errors during execution, use this framework to classify errors as **recoverable** (fix and retry) or **non-recoverable** (report as FAIL).

## Table of Contents

- [Error Detection Layers](#error-detection-layers) (API-first error sourcing with auxiliary UI verification)
- [Classification Priority](#classification-priority) (four-layer evaluation order: HTTP status → error code → field → message)
- [Decision Flowchart](#decision-flowchart) (visual flow from form submission to classification outcome)
- [Error Classification Table](#error-classification-table) (signal-to-action mapping for all error types)
- [ENVIRONMENT Errors — Fix Environment, NOT Test Code](#environment-errors--fix-environment-not-test-code) (fix entity state via UI, never modify test code)
- [Error Classification Config](#error-classification-config) (project-specific config interface with structured and unstructured API examples)
- [Retry Strategy](#retry-strategy) (max 2 retries with fix strategies by error type)
- [Error Detection Code Examples](#error-detection-code-examples) (API interception, classification function, retry loop, UI feedback verification)

## Error Detection Layers

API response is the **primary** error source — it provides HTTP status, error code, and field-level detail. UI signals (toast, inline validation) serve as **auxiliary** verification to confirm the UI correctly communicates errors to users.

| Layer | Source | Role | Method |
|---|---|---|---|
| **Primary** | API Response | Classification, retry decisions, field identification | `page.waitForResponse()` → `status` + `response.json()` |
| Auxiliary | UI feedback (toast, snackbar, banner, alert, etc.) | Verify UI renders the error to the user | `feedbackError.waitFor()` → `innerText` |
| Auxiliary | Inline validation | Client-side validation (no API call) | `.text-destructive` presence check |
| Auxiliary | Page-level state | Structural problems (empty table, redirect) | URL / DOM checks |

**Why API-first?** Toast text is a second-hand rendering — it may abbreviate, localize, or omit details from the original API response. `response.json()` gives you the raw `status`, `message`, `field`, and `code` that the UI derived its display from.

## Classification Priority

Classification uses **four layers**, evaluated in order. Stop at the first layer that produces a definitive result:

```
Layer 1: HTTP Status Code        ← universal, always available
  ↓
Layer 2: body.code / body.type   ← structured error code, project-defined
  ↓
Layer 3: body.field              ← field-level detail = likely recoverable
  ↓
Layer 4: body.message keywords   ← last resort fallback for unstructured APIs
```

**Layer 1 (HTTP Status)** is the only universal layer. Layers 2–4 depend on your API's response structure. Inspect your API's actual error responses (via DevTools Network tab or MCP `browser_network_requests`) to determine which layers apply.

## Decision Flowchart

```
FORM SUBMITTED
    │
    ▼
[1] Intercept API response (waitForResponse)
    │
    ├── response.ok() ──▶ SUCCESS
    │       └── Auxiliary: verify UI feedback visible
    │
    └── response.status() >= 400 ──▶ [2]

[2] HTTP STATUS CODE (Layer 1 — universal)
    ├── 401 / 403 ──▶ FAIL (permission issue)
    ├── 500+ ──▶ FAIL (server error)
    └── 400 / 409 / 422 ──▶ [3] Parse response body

[3] STRUCTURED ERROR CODE (Layer 2 — if API provides body.code/body.type)
    ├── Code matches environment list ──▶ ENVIRONMENT
    ├── Code matches recoverable list ──▶ RECOVERABLE
    ├── Code matches fail list ──▶ FAIL
    └── No code field or unrecognized ──▶ [4]

[4] FIELD PRESENCE (Layer 3)
    ├── body.field exists ──▶ RECOVERABLE (fix that field, retry)
    └── No field ──▶ [5]

[5] MESSAGE FALLBACK (Layer 4 — last resort for unstructured APIs)
    ├── Message matches project-defined patterns ──▶ classify accordingly
    └── No match ──▶ FAIL

NON-FORM ERRORS (no API call involved):
    ├── Redirect to login ──▶ FAIL (session expired)
    ├── Empty table on initial load ──▶ FAIL (data issue)
    └── Element not found / timeout / disappeared ──▶ [6]

[6] MCP DEBUG (if MCP available AND command has code-modification scope)
    ├── browser_navigate → failing page URL
    ├── browser_snapshot → get ARIA tree
    ├── Compare failed locator vs actual DOM:
    │   ├── data-testid missing in DOM → LOCATOR_MISMATCH: inject data-testid, update POM, retry
    │   ├── data-testid exists but wrong value → LOCATOR_MISMATCH: fix POM locator, retry
    │   ├── Element exists but not visible/interactable → TIMING: add waitFor, retry
    │   └── Element genuinely absent → FAIL (page structure differs from analysis)
    └── Max 1 MCP-debug retry per test
```

## Error Classification Table

| Signal | HTTP Status | Classification | Action |
|---|---|---|---|
| API: permission denied | 401/403 | FAIL | Report failure |
| API: server error | 500/502/503 | FAIL | Report failure |
| `body.code` matches environment code | 400/409 | ENVIRONMENT | **Do NOT modify test code.** Fix entity state via UI (MCP), then retry. |
| `body.code` matches recoverable code | 400/409/422 | RECOVERABLE | Read `body.field` → fix value → retry |
| `body.field` present (no code match) | 400/409/422 | RECOVERABLE | Fix that field → retry |
| No structured info, message fallback | 400+ | Depends on pattern | Project-specific |
| Generic error (no actionable detail) | 400+ | FAIL | Report failure |
| Inline validation (no API call) | N/A | RECOVERABLE | Fix field value, resubmit |
| Playwright timeout | N/A | FAIL | Report failure |
| Empty table (initial load) | 200 | FAIL | Report failure (data issue) |
| Dialog did not open | N/A | FAIL | Report failure |
| Element not found (`data-testid`) | N/A | LOCATOR_MISMATCH | MCP snapshot → fix data-testid or POM locator → retry |
| Element not interactable / timeout | N/A | TIMING | MCP snapshot → add explicit waitFor → retry |

## ENVIRONMENT Errors — Fix Environment, NOT Test Code

**ENVIRONMENT errors mean the test data or environment state is wrong, NOT the test code.** When the API response body describes a state/condition of the entity (disabled, archived, suspended, locked, etc.), the test logic is correct but the environment doesn't support the operation.

**Mandatory behavior:**
1. **Do NOT modify test code** — the test is correct
2. **Identify the root cause** — parse `body.message` (or `body.error`) to determine which entity is in what state (e.g., "project X is disabled")
3. **Fix the environment through UI** — use Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_fill_form`, etc.) to navigate to the entity's settings and restore it to the required state (e.g., re-enable the project)
4. **Retry the test** — after fixing the environment, re-run the failing test (max 1 environment-fix retry)
5. **If UI fix is not possible** — report clearly to the user: what entity, what state, what needs to change. Do NOT rewrite the test.

**Example:** Test tries to create an issue in a project → API returns `{ "message": "專案已停用", "code": "PROJECT_DISABLED" }` →
1. Use MCP: `browser_navigate` to the project settings page
2. Find and click the "enable" / "activate" button
3. Confirm the project is re-enabled
4. Re-run the test

## MCP Debug Loop — Fix Locators via Browser Verification

When element interaction errors occur (not found, timeout, not interactable) and MCP Playwright tools are available, use browser verification to diagnose and fix before reporting FAIL. This applies only to commands with code-modification scope (create, maintain, record) — NOT run.

**Prerequisites:**
- Dev server is running (or remote URL is accessible)
- MCP Playwright tools are available in the session

**Procedure:**

1. **Navigate** — `browser_navigate` to the page URL where the test failed
2. **Snapshot** — `browser_snapshot` to get the full ARIA tree
3. **Diagnose** — For each failed locator:
   - `browser_run_code` to query: `await page.locator('[data-testid="failing-testid"]').count()` → 0 means missing
   - If missing: `browser_run_code` to scan nearby elements: `await page.locator('[data-testid]').evaluateAll(els => els.map(e => ({ testid: e.getAttribute('data-testid'), tag: e.tagName, text: e.textContent?.trim().slice(0, 30) })))` → find the actual testid or confirm injection needed
   - If present but test still fails: check visibility with `browser_run_code`: `await page.locator('[data-testid="..."]').isVisible()`
4. **Fix** — Apply the minimal fix:
   - **LOCATOR_MISMATCH**: inject missing `data-testid` in source component, or fix the POM locator value
   - **TIMING**: add `waitFor({ state: 'visible' })` or `waitForLoadState('networkidle')` before the interaction
5. **Retry** — Re-run only the failing test(s), max 1 MCP-debug retry
6. **Report** — If still failing after retry, report as FAIL with MCP diagnostic info (what the snapshot showed vs what the test expected)

**Scope guard:** Do NOT enter MCP debug loop for:
- Permission errors (401/403) — not a locator issue
- Server errors (500+) — not a UI issue
- API response classification errors — handled by the existing retry strategy
- `/e2e:run` command — run has no code-modification scope

## Error Classification Config

Projects define how their API's error codes and messages map to classifications via `ErrorClassificationConfig`. The interface, `classifyApiError()` function, and `submitAndIntercept()` helper are in the **error-utils template** — use `scaffold.js` to create it:

```bash
echo '{"targetDir":".","templates":["error-utils"],"variables":{}}' | node $SKILL_DIR/scripts/scaffold.js
```

This creates `tests/fixtures/error-utils.ts` with:
- `ErrorClassificationConfig` interface — fields: `codeField`, `messageField`, `fieldField`, `environmentCodes`, `recoverableCodes`, `environmentKeywords`, `recoverableKeywords`
- `classifyApiError(status, body, config)` — 4-layer classification function (HTTP status → error code → field → message)
- `submitAndIntercept(page, submitBtn, apiUrlPattern)` — form submit + API response interception

### Example: Structured API (preferred)

If your API returns structured error codes like `{ "code": "DUPLICATE_NAME", "field": "name", "message": "..." }`:

```typescript
const config: ErrorClassificationConfig = {
  codeField: "code",
  messageField: "message",
  fieldField: "field",
  environmentCodes: [
    "ENTITY_DISABLED", "ENTITY_ARCHIVED", "ENTITY_LOCKED",
    "PROJECT_SUSPENDED", "ACCOUNT_FROZEN",
  ],
  recoverableCodes: [
    "DUPLICATE_NAME", "DUPLICATE_EMAIL", "INVALID_FORMAT",
    "FIELD_REQUIRED", "VALUE_TOO_LONG", "VALUE_TOO_SHORT",
  ],
};
```

### Example: Unstructured API (fallback)

If your API only returns `{ "message": "名稱已被使用" }` with no error code:

```typescript
const config: ErrorClassificationConfig = {
  messageField: "message",
  environmentKeywords: [
    "disabled", "deactivated", "archived", "locked",
    "suspended", "frozen", "read-only", "cannot operate",
    // Add your API's language-specific keywords:
    "已停用", "已封存", "已鎖定", "已暫停",
  ],
  recoverableKeywords: [
    "duplicate", "already exists", "in use", "taken",
    "invalid format", "required", "too short", "too long",
    // Add your API's language-specific keywords:
    "重複", "已被使用", "格式無效", "必填",
  ],
};
```

### How to discover your API's error structure

1. Open DevTools Network tab (or use MCP `browser_network_requests`)
2. Trigger form submission errors (duplicate name, empty required field, invalid format)
3. Inspect the response body to identify: which fields exist (`code`? `type`? `field`? `errors[]`?), what values they contain
4. Build your `ErrorClassificationConfig` from the observed patterns

## Retry Strategy

- Maximum **2 retries** (3 total attempts)
- After retries exhausted → report as FAIL

### Fix Strategies by Error Type

| Error Type | Strategy |
|---|---|
| Duplicate / conflict | Append timestamp suffix `_ts{Date.now()}` to `body[fieldField]` value |
| Invalid format | Switch to correct format (e.g., valid email, URL, date) |
| Required / empty | Fill in with test data |

Use `body[config.fieldField]` (e.g., `body.field`) to target the exact input. If the API doesn't provide a field name, infer from `body[config.codeField]` or fall back to the first empty required field.

### Retry Flow

```
1. Intercept API response → parse status + body
2. Classify: recoverable, environment, or non-recoverable?
3. If recoverable → apply fix strategy (use body.field if available) → resubmit → wait for response
4. If environment → fix entity state via MCP UI → re-run test (max 1 retry)
5. If still failing after max retries → FAIL
```

## Error Detection Code Examples

The `submitAndIntercept()`, `classifyApiError()`, and `ErrorClassificationConfig` implementations are in the **error-utils template** (`tests/fixtures/error-utils.ts`) — see § Error Classification Config above for scaffold instructions.

### Retry Loop Example

```typescript
import { classifyApiError, submitAndIntercept } from '../../fixtures/error-utils';

const MAX_RETRIES = 2;
let attempt = 0;

while (attempt <= MAX_RETRIES) {
  await fillForm(page, testData);

  // Primary: intercept API response
  const { ok, status, body } = await submitAndIntercept(
    page, submitBtn, "/api/items"
  );

  if (ok) {
    // Auxiliary: verify UI feedback rendered to user (if configured)
    if (basePage.feedbackSuccess) {
      await expect(basePage.feedbackSuccess).toBeVisible();
    }
    break;
  }

  // Classify using project-specific config
  const errorClass = classifyApiError(status, body, errorConfig);
  const msgField = errorConfig.messageField || "message";
  const errorMsg = body?.[msgField] || `HTTP ${status}`;

  if (errorClass === "fail" || attempt === MAX_RETRIES) {
    throw new Error(`Form submission failed (${status}): ${errorMsg}`);
  }

  if (errorClass === "environment") {
    throw new Error(
      `ENVIRONMENT error — fix entity state, do NOT modify test code: ${errorMsg}`
    );
  }

  // RECOVERABLE — apply fix strategy using body[fieldField] when available
  const field = errorConfig.fieldField ? body?.[errorConfig.fieldField] : undefined;
  const code = errorConfig.codeField ? body?.[errorConfig.codeField] : undefined;

  // Determine fix strategy from code or message
  if (code?.includes("DUPLICATE") || /duplicate|conflict|already.exist/i.test(errorMsg)) {
    testData[field || "name"] = `${testData.baseName}_ts${Date.now()}`;
  } else if (code?.includes("REQUIRED") || field) {
    testData[field || "name"] = `[E2E] Retry ${Date.now().toString(36)}`;
  }

  // Auxiliary: dismiss error feedback if visible before retrying
  if (basePage.feedbackError && await basePage.feedbackError.isVisible()) {
    await basePage.feedbackError.click();
    await basePage.feedbackError.waitFor({ state: "hidden" });
  }

  attempt++;
}
```

### Auxiliary: UI Feedback Verification

After API classification, verify the UI correctly communicated the result to the user. BasePage provides configurable `feedbackSuccess` / `feedbackError` locators via `FeedbackConfig` — see `code-patterns.md` § BasePage for setup.

```typescript
// After successful API response — verify success feedback shown
if (basePage.feedbackSuccess) {
  await expect(basePage.feedbackSuccess).toBeVisible({ timeout: 5000 });
}

// After failed API response — optionally verify feedback matches API error
const feedbackText = await basePage.getErrorFeedback();
if (feedbackText) {
  expect(feedbackText).toContain(body.message);  // UI should reflect API error
}
```

> If the project has no UI feedback mechanism (or uses one that's hard to detect), set `FeedbackConfig` to `{}`. The API response remains the primary error source — UI feedback verification is skipped gracefully when unconfigured.

### Auxiliary: Inline Validation Detection

Client-side validation fires **before** any API call. If inline errors appear, no API response will be intercepted:

```typescript
// Inline validation errors — project-specific selector
const inlineError = page.locator(".text-destructive");
if (await inlineError.count() > 0) {
  const errorText = await inlineError.first().innerText();
  // Fix field value and resubmit — no API classification needed
}
```

### Auxiliary: Page-Level Error States

```typescript
// Empty table (data loading issue)
const tableRows = page.locator("table tbody tr");
await expect(tableRows).not.toHaveCount(0); // FAIL if empty

// Redirect to login (session expired)
if (page.url().includes("/login")) {
  throw new Error("Redirected to login — session expired");
}
```
