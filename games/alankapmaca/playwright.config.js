const { defineConfig } = require('playwright/test');

module.exports = defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8141',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node test/browser/server.js',
    url: 'http://127.0.0.1:8141',
    reuseExistingServer: !process.env.CI,
  },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({
    name: browserName,
    use: {
      browserName,
      launchOptions: {
        timeout: 30_000,
        ...(process.env[`PLAYWRIGHT_${browserName.toUpperCase()}_EXECUTABLE_PATH`]
          ? { executablePath: process.env[`PLAYWRIGHT_${browserName.toUpperCase()}_EXECUTABLE_PATH`] }
          : {}),
      },
    },
  })),
});
