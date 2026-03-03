# Playwright Configuration

## Full Configuration Template — `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
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
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

## Test File Organization

```
tests/
├── e2e/
│   ├── auth/
│   │   └── auth.setup.ts        # Auth state setup (runs first)
│   ├── features/
│   │   ├── project-list.spec.ts
│   │   ├── issue-list.spec.ts
│   │   └── login.spec.ts
│   └── pages/                   # Page Object Model classes
│       ├── BasePage.ts
│       ├── LoginPage.ts
│       └── ProjectListPage.ts
├── fixtures/
│   ├── auth.ts                  # Account credentials loader
│   └── data.ts                  # Test data factories
└── playwright.config.ts
```

## Playwright Commands

```bash
npx playwright test                           # Run all E2E tests
npx playwright test tests/e2e/features/       # Run feature tests
npx playwright test --headed                  # See browser
npx playwright test --debug                   # Debug with inspector
npx playwright test --trace on                # Run with trace
npx playwright show-report                    # View HTML report
npx playwright codegen http://localhost:5173  # Record interactions
npx playwright test --repeat-each=3           # Check flakiness
```
