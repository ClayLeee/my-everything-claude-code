# Error Discrimination Framework

When E2E tests encounter errors during execution, use this framework to classify errors as **recoverable** (fix and retry) or **non-recoverable** (report as FAIL).

## Decision Flowchart

```
ERROR DETECTED
    │
[1] Error CONTEXT?
    ├── FORM SUBMISSION ──▶ [2]
    ├── PAGE/DATA LOADING ──▶ [4]
    └── ELEMENT INTERACTION ──▶ [5]

[2] HTTP STATUS CODE?
    ├── 400 / 409 / 422 ──▶ [3] (potentially recoverable)
    ├── 401 / 403 ──▶ FAIL (permission issue)
    └── 500+ ──▶ FAIL (server error)

[3] Does the error message contain actionable field information?
    ├── YES (name duplicate, invalid format, etc.) ──▶ RECOVERABLE, fix and retry
    └── NO (operation failed, insufficient permissions, etc.) ──▶ FAIL

[4] Page/data loading error ──▶ always FAIL

[5] Element interaction error (timeout, element disappeared) ──▶ always FAIL
```

## Error Classification Table

| Signal | HTTP Status | Recoverable? | Action |
|---|---|---|---|
| Toast: field error (name duplicate, invalid format) | 400/409/422 | YES | Parse field, fix value, retry |
| Inline validation (`.text-destructive`) | N/A | YES | Fix field value, resubmit |
| Toast: generic error (operation failed) | 400+ | NO | Report failure |
| Toast: insufficient permissions | 403 | NO | Report failure |
| Server error | 500/502/503 | NO | Report failure |
| Playwright timeout | N/A | NO | Report failure |
| Empty table (initial load) | 200 | NO | Report failure (data issue) |
| Dialog did not open | N/A | NO | Report failure |

## Recoverable Error Keywords

These keywords in error toasts, combined with HTTP 400/409/422, indicate a recoverable error. The API returns error messages in zh-TW, so both Chinese and English keywords are listed:

```
重複 / already exists / duplicate
已被使用 / in use / taken
格式無效 / 格式不正確 / invalid format
必填 / 不得為空 / required
長度不足 / 超過長度 / too short / too long
不可早於 / 不可晚於 / must not be before / must not be after
```

## Non-Recoverable Error Keywords

These keywords always mean FAIL — do not retry:

```
權限不足 / unauthorized / forbidden
操作失敗 / operation failed
系統錯誤 / 伺服器錯誤 / server error / internal error
連線逾時 / timeout
找不到 / not found
```

## Retry Strategy

- Maximum **2 retries** (3 total attempts)
- After retries exhausted → report as FAIL

### Fix Strategies by Error Pattern

| Error Pattern | Strategy |
|---|---|
| duplicate / already exists / in use | Append timestamp suffix `_ts{Date.now()}` to the conflicting value |
| invalid format | Switch to correct format (e.g., valid email, URL, date) |
| required / must not be empty | Fill in with test data |

### Retry Flow

```
1. Detect error toast → read message text
2. Classify: recoverable or non-recoverable?
3. If recoverable → apply fix strategy → resubmit form → wait for result
4. If still failing after max retries → FAIL
```

## Error Detection Code Examples

### Toast Detection

The project uses vue-sonner. Error toasts use `[data-sonner-toast][data-type="error"]`:

```typescript
// In BasePage — already available as this.toastError
readonly toastError = this.page.locator('[data-sonner-toast][data-type="error"]');

// Read error message text
async getErrorToast(): Promise<string> {
  await this.toastError.waitFor({ state: "visible", timeout: 5000 });
  return this.toastError.locator("[data-content]").innerText();
}
```

### Inline Validation Detection

```typescript
// Inline validation errors use .text-destructive class
const inlineError = page.locator(".text-destructive");
if (await inlineError.count() > 0) {
  const errorText = await inlineError.first().innerText();
  // Classify and handle
}
```

### Recoverable Error Check

```typescript
const RECOVERABLE_KEYWORDS = [
  "重複", "already exists", "duplicate",
  "已被使用", "in use", "taken",
  "格式無效", "格式不正確", "invalid format",
  "必填", "不得為空", "required",
  "長度不足", "超過長度",
  "不可早於", "不可晚於",
];

function isRecoverable(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return RECOVERABLE_KEYWORDS.some((kw) => msg.includes(kw.toLowerCase()));
}
```

### Retry Loop Example

```typescript
const MAX_RETRIES = 2;
let attempt = 0;

while (attempt <= MAX_RETRIES) {
  await fillForm(page, testData);
  await submitBtn.click();

  // Wait for either success or error toast
  const successToast = page.locator('[data-sonner-toast][data-type="success"]');
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');

  const result = await Promise.race([
    successToast.waitFor({ state: "visible", timeout: 10000 }).then(() => "success"),
    errorToast.waitFor({ state: "visible", timeout: 10000 }).then(() => "error"),
  ]);

  if (result === "success") break;

  // Read and classify error
  const errorMsg = await errorToast.locator("[data-content]").innerText();

  if (!isRecoverable(errorMsg) || attempt === MAX_RETRIES) {
    throw new Error(`Form submission failed: ${errorMsg}`);
  }

  // Apply fix strategy and retry
  if (/重複|already exists|duplicate|已被使用|in use|taken/i.test(errorMsg)) {
    testData.name = `${testData.baseName}_ts${Date.now()}`;
  }

  // Dismiss toast before retrying
  await errorToast.click();
  await errorToast.waitFor({ state: "hidden" });
  attempt++;
}
```

### Page-Level Error States

```typescript
// Empty table (data loading issue)
const tableRows = page.locator("table tbody tr");
await expect(tableRows).not.toHaveCount(0); // FAIL if empty

// Redirect to login (session expired)
if (page.url().includes("/login")) {
  throw new Error("Redirected to login — session expired");
}
```
