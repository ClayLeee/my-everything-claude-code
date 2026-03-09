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
    ['html', { outputFolder: 'playwright/reports' }],
  ],
  outputDir: 'playwright/test-results',
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
app/
├── playwright.config.ts           # Playwright config
├── playwright/                    # All test artifacts (gitignored)
│   ├── reports/                   # HTML reports
│   ├── test-results/              # Built-in artifacts (failure screenshots, videos, traces)
│   └── *-test-report.md           # Markdown reports
├── tests/
│   ├── e2e/
│   │   ├── auth/
│   │   │   ├── auth.setup.ts      # Auth state setup (runs first)
│   │   │   └── login.spec.ts
│   │   ├── features/
│   │   │   ├── project-list.spec.ts
│   │   │   └── issue-list.spec.ts
│   │   └── pages/                 # Page Object Model classes
│   │       ├── BasePage.ts
│   │       ├── LoginPage.ts
│   │       └── ProjectListPage.ts
│   └── fixtures/
│       ├── auth.ts                # Account credentials loader
│       └── data.ts                # Test data factories
```

## Playwright Commands

Always use `pnpm` scripts (not `npx`) to ensure the project-pinned Playwright version is used.

```bash
# Via pnpm scripts (preferred)
cd app
pnpm test:e2e                                      # Run all E2E tests
pnpm test:e2e -- tests/e2e/auth/login.spec.ts      # Run specific spec
pnpm test:e2e -- --headed                           # See browser
pnpm test:e2e -- --debug                            # Debug with inspector
pnpm test:e2e -- --trace on                         # Run with trace
pnpm test:e2e -- --repeat-each=3                    # Check flakiness
pnpm test:e2e:ui                                    # Interactive UI mode
pnpm test:e2e:report                                # View HTML report

# Direct playwright (use only for commands without pnpm script)
cd app
pnpm exec playwright codegen http://localhost:5173  # Record interactions
```

## Artifact Paths

All artifacts are consolidated under `app/playwright/` (gitignored):

| Artifact | Path | Source |
|----------|------|--------|
| HTML report | `playwright/reports/` | `reporter` config |
| Failure screenshots | `playwright/test-results/` | Built-in `screenshot: 'only-on-failure'` |
| Failure videos | `playwright/test-results/` | Built-in `video: 'retain-on-failure'` |
| Retry traces | `playwright/test-results/` | Built-in `trace: 'on-first-retry'` |
| Markdown reports | `playwright/*-test-report.md` | Agent-generated |

> **No manual `page.screenshot()` in specs** — see SKILL.md § No Manual Screenshots.
