const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/browser', timeout: 60000, fullyParallel: true, workers: 3,
  use: { baseURL: 'http://127.0.0.1:8138', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: { command: 'npx serve -l 8138 .', url: 'http://127.0.0.1:8138', reuseExistingServer: !process.env.CI },
});
