import type { Locator, Page } from "@playwright/test";

// ── Error Classification Config ────────────────────────────────
// Projects define how their API's error codes and messages map to classifications.

export interface ErrorClassificationConfig {
  /** Body field that contains the error code (e.g., "code", "type", "errorCode") */
  codeField?: string;
  /** Body field that contains the error message (e.g., "message", "error", "detail") */
  messageField?: string;
  /** Body field that contains the problematic field name (e.g., "field", "param", "source") */
  fieldField?: string;

  /** Error codes that indicate environment/data state issues */
  environmentCodes?: string[];
  /** Error codes that indicate recoverable field-level issues */
  recoverableCodes?: string[];

  /** Fallback: message keywords for environment errors (only if API has no structured codes) */
  environmentKeywords?: string[];
  /** Fallback: message keywords for recoverable errors (only if API has no structured codes) */
  recoverableKeywords?: string[];
}

// ── Error Classification Function ──────────────────────────────

export type ErrorClass = "recoverable" | "environment" | "fail";

export function classifyApiError(
  status: number,
  body: any,
  config: ErrorClassificationConfig
): ErrorClass {
  // Layer 1: HTTP status (universal)
  if (status === 401 || status === 403) return "fail";
  if (status >= 500) return "fail";

  // Layer 2: Structured error code (if API provides one)
  const code = config.codeField ? body?.[config.codeField] : undefined;
  if (code) {
    if (config.environmentCodes?.includes(code)) return "environment";
    if (config.recoverableCodes?.includes(code)) return "recoverable";
  }

  // Layer 3: Field presence (field-level error = likely recoverable)
  const field = config.fieldField ? body?.[config.fieldField] : undefined;
  if (field && (status === 400 || status === 409 || status === 422)) {
    return "recoverable";
  }

  // Layer 4: Message keyword fallback (for unstructured APIs)
  const msgField = config.messageField || "message";
  const message = (body?.[msgField] || "").toLowerCase();
  if (message) {
    if (config.environmentKeywords?.some((kw) => message.includes(kw.toLowerCase()))) {
      return "environment";
    }
    if (config.recoverableKeywords?.some((kw) => message.includes(kw.toLowerCase()))) {
      return "recoverable";
    }
  }

  return "fail";
}

// ── Submit and Intercept Helper ────────────────────────────────

/** Submit form and intercept the API response */
export async function submitAndIntercept(
  page: Page,
  submitBtn: Locator,
  apiUrlPattern: string
): Promise<{ ok: boolean; status: number; body: any }> {
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes(apiUrlPattern) &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(resp.request().method()),
    { timeout: 15000 }
  );
  await submitBtn.click();
  const response = await responsePromise;

  const status = response.status();
  let body: any = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g., 502 HTML error page)
  }

  return { ok: response.ok(), status, body };
}
