import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  outputDir: process.env.TEST_OUTPUT_DIR || 'test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.REPORT_PATH || 'test-results/browser-results.json',
      },
    ],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4321',
    headless: true,
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
