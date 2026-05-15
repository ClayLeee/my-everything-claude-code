import { defineConfig } from '@playwright/test';

const reportName = process.env.E2E_REPORT_NAME || 'latest';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: `playwright/reports/${reportName}`, open: 'never' }],
  ],

  use: {
    baseURL: '{{BASE_URL}}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // storageState: '.auth/remote.json',  // Uncomment if auth needed
  },

  outputDir: 'playwright/test-results',

  // No webServer — testing remote URL directly
});
