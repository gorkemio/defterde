import { test, expect } from '@playwright/test';

test('Kakuro fits compact screens and supports notes, undo, save, help and navigation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/oyunlar/kakuro/');
  await expect(page.locator('#board .cell-button').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [768, 800],
    [390, 844],
    [360, 740],
    [320, 740],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const link = page.getByRole('link', { name: '← İçindekiler', exact: true });
    await expect(link).toBeInViewport();
    await expect
      .poll(async () => (await link.boundingBox())!.y)
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    if (height >= 720 && width >= 360)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
        .toBeLessThanOrEqual(height);
    expect(
      await page
        .locator('#board .cell-button')
        .first()
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(44);
    if (info.project.name === 'chromium')
      await page.screenshot({
        path: info.outputPath(`kakuro-${width}.png`),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const cell = page.locator('#board .cell-button').first();
  await cell.click();
  await page.keyboard.press('n');
  await page.keyboard.press('2');
  await expect(cell).toHaveAttribute('aria-label', /Notlar: 2/);
  await page.keyboard.press('n');
  await page.keyboard.press('3');
  await expect(cell).toHaveAttribute('aria-label', /Değer 3/);
  await page.locator('#undo-button').click();
  await expect(cell).toHaveAttribute('aria-label', /Notlar: 2/);
  await page.reload();
  await expect(cell).toHaveAttribute('aria-label', /Notlar: 2/);
  await page.locator('#hint-button').click();
  await expect(page.locator('#hint-panel')).toBeVisible();
  await page.locator('#list-button').click();
  await expect(page.locator('#list-panel')).toBeVisible();
  await expect(page.locator('.puzzle-choice')).toHaveCount(20);
  await page.locator('#difficulty-select').selectOption('zor');
  await expect(page.locator('.puzzle-choice')).toHaveCount(20);
  await page.locator('.puzzle-choice').first().click();
  await expect(page.locator('#board .cell-button').first()).toBeVisible();
  await page.locator('#help-button').click();
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.locator('#close-help').click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.defterde-donus')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.locator('.defterde-donus').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await expect(page.locator('.discovery-game')).toHaveCount(20);
  await page.getByRole('searchbox').fill('kakuro');
  await expect(page.locator('.discovery-games > li:not([hidden])')).toHaveCount(
    1,
  );
  await page.getByRole('radio', { name: 'Birlikte', exact: true }).check();
  await expect(page.locator('.discovery-games > li:not([hidden])')).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test('Kakuro assets are versioned and development files are not served', async ({
  page,
  request,
}) => {
  await page.goto('/oyunlar/kakuro/');
  const urls = await page
    .locator('script[src],link[rel=stylesheet]')
    .evaluateAll((nodes) =>
      nodes.map((e) => e.getAttribute('src') || e.getAttribute('href')),
    );
  for (const url of urls) expect(url).toMatch(/\?v=[a-f0-9]{12}$/);
  for (const path of [
    'test/core.test.cjs',
    'tools/generate.cjs',
    'generated/proofs.json',
    'README.md',
  ])
    expect((await request.get('/oyunlar/kakuro/' + path)).status()).toBe(404);
  await page.goto('/nasil-oynanir/kakuro/');
  await expect(
    page.locator('.ink-button[href="/oyunlar/kakuro/"]'),
  ).toBeVisible();
});
