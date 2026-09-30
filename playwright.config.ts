import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Playwright configuration.
 *
 * Everything environment-specific (URL, credentials, rule values) comes from .env
 * via src/config/env.ts. Nothing here or in the tests is hard-coded.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  // Retries stay at 0 locally so a flaky result is visible, not hidden.
  retries: process.env.CI ? 1 : 0,

  // The lab app is a single Apache/PHP instance on a shared VM and returns HTTP 500
  // under parallel load. One worker keeps a lab artefact from looking like a defect.
  workers: 1,

  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: env.baseUrl,

    // Evidence: a screenshot for every test, video and trace kept on failure.
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
