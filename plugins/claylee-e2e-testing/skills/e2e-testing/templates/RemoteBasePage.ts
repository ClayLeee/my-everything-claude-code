import { type Page } from '@playwright/test';

export abstract class RemoteBasePage {
  constructor(protected page: Page) {}

  abstract goto(): Promise<void>;

  async waitForNavigation(urlPattern: string | RegExp) {
    await this.page.waitForURL(urlPattern, { timeout: 15_000 });
  }

  async waitForApi(urlPattern: string | RegExp) {
    return this.page.waitForResponse(
      (response) => {
        const url = response.url();
        if (typeof urlPattern === 'string') return url.includes(urlPattern);
        return urlPattern.test(url);
      },
      { timeout: 15_000 }
    );
  }
}
