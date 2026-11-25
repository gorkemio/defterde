import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const url = process.env.TEST_BASE_URL || 'http://localhost:4321/';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const resources = [];
page.on('response', async (r) => {
  try {
    const body = await r.body();
    resources.push({
      url: r.url(),
      type: r.request().resourceType(),
      bytes: body.length,
      gzip: gzipSync(body).length,
    });
  } catch {}
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const entries = await page.evaluate(() =>
  performance.getEntriesByType('resource').map((r) => ({
    name: r.name,
    transferSize: r.transferSize,
    encodedBodySize: r.encodedBodySize,
  })),
);
await browser.close();
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const run = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
    formFactor: 'mobile',
  });
  await writeFile(
    'test-results/lighthouse.json',
    JSON.stringify(run.lhr, null, 2),
  );
  const a = run.lhr.audits;
  const report = {
    url,
    measuredAt: new Date().toISOString(),
    environment:
      'Local production build; Lighthouse mobile simulated throttling; no real device',
    scores: Object.fromEntries(
      Object.entries(run.lhr.categories).map(([k, v]) => [k, v.score]),
    ),
    lcpMs: a['largest-contentful-paint'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    transferBytes: a['total-byte-weight'].numericValue,
    clientJsGzip: resources
      .filter((r) => r.type === 'script')
      .reduce((s, r) => s + r.gzip, 0),
    gameRequests: resources.filter((r) => r.url.includes('/oyunlar/')),
    resources,
    entries,
    failures: Object.values(a)
      .filter(
        (a) =>
          a.score !== null && a.score < 1 && a.details?.type !== 'opportunity',
      )
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        displayValue: a.displayValue,
      })),
  };
  await writeFile(
    'test-results/performance.json',
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      { ...report, resources: undefined, entries: undefined },
      null,
      2,
    ),
  );
  if (
    report.lcpMs > 2500 ||
    report.cls > 0.1 ||
    report.transferBytes > 300 * 1024 ||
    report.clientJsGzip > 50 * 1024 ||
    report.gameRequests.length
  )
    process.exitCode = 1;
} finally {
  await chrome.kill();
}
