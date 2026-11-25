import { test, expect } from '@playwright/test';

test('Tangram works from the directory, persists favorites and returns home', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?q=tangram');
  const row = page.locator('a[href="/oyunlar/tangram/"]');
  await expect(row).toBeVisible();
  await row.click();
  await expect(
    page.locator('#catalog-grid .puzzle-link').first(),
  ).toBeVisible();
  await page.locator('#search').fill('kare');
  await page
    .locator('#catalog-grid .puzzle-link')
    .filter({ hasText: /^Kare$/ })
    .click();
  await expect(page.locator('#puzzle-title')).toHaveText('Kare');
  await expect(page.locator('#scene .piece')).toHaveCount(7);
  await page.locator('.game-options > summary').click();
  await page.locator('#favorite-puzzle').click();
  await expect(page.locator('#favorite-puzzle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#color-preview').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-preview', 'true');
  await expect(page.locator('#completion')).toBeHidden();
  await page.locator('#color-preview').click();
  await page.locator('.game-options > summary').click();
  await page.keyboard.press('1');
  await expect(page.locator('#rotate-right')).toBeEnabled();
  const before = await page
    .locator('#scene [data-piece="large-a"]')
    .getAttribute('aria-label');
  await page.locator('#rotate-right').click();
  await expect(
    page.locator('#scene [data-piece="large-a"]'),
  ).not.toHaveAttribute('aria-label', before!);
  await page.locator('#undo').click();
  await expect(page.locator('#scene [data-piece="large-a"]')).toHaveAttribute(
    'aria-label',
    before!,
  );
  await page.reload();
  await page.locator('.game-options > summary').click();
  await expect(page.locator('#favorite-puzzle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('.game-options > summary').click();
  await page.locator('.defterde-return').click();
  await expect(page.locator('#discovery')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 740],
  [844, 390],
]) {
  test(`Tangram catalog, seven pieces and controls fit at ${width}x${height}`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      failed: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    await page.setViewportSize({ width, height });
    await page.goto('/oyunlar/tangram/');
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.locator('#catalog-grid .puzzle-link').first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`catalog-${width}.png`),
      fullPage: true,
    });
    await page.locator('#catalog-grid .puzzle-link').first().click();
    await expect(page.locator('#scene .piece')).toHaveCount(7);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const boxes = await page.locator('#scene .piece').evaluateAll((nodes) =>
      nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, right: r.right, width: r.width, height: r.height };
      }),
    );
    expect(
      boxes.every(
        (b) => b.width > 5 && b.height > 5 && b.x >= -1 && b.right <= width + 1,
      ),
    ).toBe(true);
    await expect(page.locator('#hint')).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`game-${width}.png`),
      fullPage: true,
    });
    await page.locator('#hint').click();
    await expect(page.locator('#selection-status')).not.toBeEmpty();
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}

test('Tangram design and content tools load under the game directory', async ({
  page,
  request,
}) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  for (const file of ['design.html', 'editor.html', 'review.html']) {
    await page.goto('/oyunlar/tangram/' + file);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main svg').first()).toBeAttached();
  }
  for (const url of [
    '/nasil-oynanir/tangram/',
    '/assets/drawings/tangram.svg',
    '/assets/licenses/tangram-content-source.zip',
  ])
    expect((await request.get(url)).status()).toBe(200);
  for (const file of [
    'package.json',
    'test/geometry.test.js',
    'tools/content/source/peces-t7.fig',
    '.git/config',
  ])
    expect([403, 404]).toContain(
      (await request.get('/oyunlar/tangram/' + file)).status(),
    );
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
