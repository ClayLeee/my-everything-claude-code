import type { Locator, Page } from "@playwright/test";

// ── UI Feedback Configuration ──────────────────────────────────
// Projects define how success/error feedback appears in the UI.
// If the project has no visible feedback, set selectors to undefined.

export interface FeedbackSelector {
  /** CSS selector for the feedback container */
  selector: string;
  /** Sub-selector for the message text within the container (optional) */
  textSelector?: string;
}

export interface FeedbackConfig {
  success?: FeedbackSelector;
  error?: FeedbackSelector;
}

// ── BasePage ───────────────────────────────────────────────────

export abstract class BasePage {
  readonly page: Page;
  readonly feedbackSuccess: Locator | null;
  readonly feedbackError: Locator | null;
  private readonly feedbackConfig: FeedbackConfig;

  constructor(page: Page, feedback: FeedbackConfig = {}) {
    this.page = page;
    this.feedbackConfig = feedback;
    this.feedbackSuccess = feedback.success
      ? page.locator(feedback.success.selector)
      : null;
    this.feedbackError = feedback.error
      ? page.locator(feedback.error.selector)
      : null;
  }

  /** Navigate to the page's route */
  abstract goto(): Promise<void>;

  /** Wait for API response matching the URL pattern (fire-and-forget) */
  async waitForApi(urlPattern: string, status = 200) {
    await this.page
      .waitForResponse(
        (resp) => resp.url().includes(urlPattern) && resp.status() === status,
        { timeout: 10000 }
      )
      .catch(() => {});
  }

  /** Intercept API response and return status + body for error classification */
  async interceptApi(
    urlPattern: string,
    action: () => Promise<void>
  ): Promise<{ ok: boolean; status: number; body: any }> {
    const responsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(urlPattern) &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(resp.request().method()),
      { timeout: 15000 }
    );
    await action();
    const response = await responsePromise;
    let body: any = {};
    try {
      body = await response.json();
    } catch {
      // Non-JSON response (e.g., 502 HTML error page)
    }
    return { ok: response.ok(), status: response.status(), body };
  }

  /** Wait for navigation to complete */
  async waitForNavigation(urlPattern: string) {
    await this.page.waitForURL(urlPattern, { timeout: 15000 });
  }

  /** Get success feedback message text. Returns null if no feedback config. */
  async getSuccessFeedback(): Promise<string | null> {
    if (!this.feedbackSuccess) return null;
    await this.feedbackSuccess.waitFor({ state: "visible", timeout: 5000 });
    const textSel = this.feedbackConfig.success?.textSelector;
    return textSel
      ? this.feedbackSuccess.locator(textSel).innerText()
      : this.feedbackSuccess.innerText();
  }

  /** Get error feedback message text. Returns null if no feedback config. */
  async getErrorFeedback(): Promise<string | null> {
    if (!this.feedbackError) return null;
    await this.feedbackError.waitFor({ state: "visible", timeout: 5000 });
    const textSel = this.feedbackConfig.error?.textSelector;
    return textSel
      ? this.feedbackError.locator(textSel).innerText()
      : this.feedbackError.innerText();
  }
}
