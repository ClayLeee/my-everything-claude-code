import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright/reports' }],
  ],
  outputDir: 'playwright/test-results',
  use: {
    baseURL: process.env.BASE_URL || '{{BASE_URL}}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: ".auth/sysadmin.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: '{{WEB_SERVER_COMMAND}}',
    url: '{{BASE_URL}}',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
