import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Todo App.
 *
 * Virtual WebAuthn authenticator is set up per-test via helpers.ts.
 * Singapore timezone is applied globally to match app behaviour.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /^(?!.*\/unit\/).*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    timezoneId: 'Asia/Singapore',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      JWT_SECRET: 'playwright-test-jwt-secret-32chars-todo-app',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Full Chromium (not headless-shell) needed for CDP / virtual authenticator
        channel: undefined,
      },
    },
  ],
});
