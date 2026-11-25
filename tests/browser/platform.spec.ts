import { test, expect } from '@playwright/test';
const screens = [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [844, 390],
];
const pages = [
  '/',
  '/nasil-oynanir/',
  '/nasil-oynanir/sos/',
  '/hakkinda/',
  '/gizlilik/',
  '/kaynaklar/',
  '/yonetim/',
];
test('platform pages at five viewports, twenty links, semantic metadata and no game downloads', async ({
  page,
}, info) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [width, height] of screens) {
    await page.setViewportSize({ width, height });
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path} ${width}`,
      ).toBeLessThanOrEqual(width);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        new RegExp(path.replaceAll('/', '\\/') + '$'),
      );
      if (path === '/') {
        await expect(page.locator('.discovery-game')).toHaveCount(20);
        if (height >= 800)
          expect(
            (await page.locator('.discovery-game').first().boundingBox())!.y,
          ).toBeLessThan(height - 44);
        for (const slug of [
          'amiralbatti',
          'alankapmaca',
          'kagitfutbolu',
          'sos',
          'kagithangar',
          'adamasmaca',
          'kagitrallisi',
          'dokuztas',
          'xox',
          'noktaoyunu',
          'sayibulma',
          'turkdamasi',
          'kibrit',
          'labirent',
          'kakuro',
          'mangala',
          'nonogram',
          'besharf',
          'tangram',
          'domino',
        ])
          await expect(
            page.locator(`.discovery-game[href="/oyunlar/${slug}/"]`),
          ).toBeVisible();
        if (
          info.project.name === 'chromium' &&
          (width === 390 || width === 1440)
        )
          await page.screenshot({
            path: test.info().outputPath(`home-${width}.png`),
            fullPage: true,
          });
      }
    }
  }
  expect(errors).toEqual([]);
  expect(requests.filter((u) => u.includes('/oyunlar/'))).toEqual([]);
  await page.goto('/');
  await page.keyboard.press(info.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByText('İçeriğe geç')).toBeFocused();
});
test('catalog works with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4321/');
  await expect(page.locator('.discovery-game')).toHaveCount(20);
  await page.locator('.discovery-game[href="/oyunlar/sos/"]').click();
  await expect(page).toHaveURL(/\/oyunlar\/sos\/$/);
  await context.close();
});
test('all guide links lead to their own game; authenticated routes do not leak', async ({
  page,
  request,
}) => {
  for (const slug of [
    'amiralbatti',
    'alankapmaca',
    'kagitfutbolu',
    'sos',
    'kagithangar',
    'adamasmaca',
    'kagitrallisi',
    'dokuztas',
    'xox',
    'noktaoyunu',
    'sayibulma',
    'turkdamasi',
    'kibrit',
    'labirent',
    'kakuro',
    'mangala',
    'nonogram',
    'besharf',
  ]) {
    await page.goto(`/nasil-oynanir/${slug}/`);
    await expect(
      page.locator(`.ink-button[href="/oyunlar/${slug}/"]`),
    ).toBeVisible();
  }
  expect(
    (
      await request.patch('/api/v1/admin/catalog', {
        data: { version: 0, items: [] },
      })
    ).status(),
  ).toBe(401);
  await page.goto('/yonetim/onizleme/');
  await expect(page).toHaveURL(/\/yonetim\/$/);
  await expect(page.locator('#catalog-form')).toHaveCount(0);
});

test('source code link sits in the top-right corner without overflowing', async ({
  page,
}) => {
  for (const [width, height] of screens) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const link = page.locator('.masthead .repo-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\//);
    await expect(link).toHaveAccessibleName("Kaynak kodu GitHub'da");
    const box = (await link.boundingBox())!;
    const brand = (await page.locator('.brand').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    // Köşede: markanın sağında ve onunla aynı üst bantta.
    expect(box.x).toBeGreaterThan(brand.x + brand.width);
    expect(box.y).toBeLessThan(brand.y + brand.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
