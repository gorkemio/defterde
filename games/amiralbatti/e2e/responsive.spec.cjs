const { test, expect } = require('@playwright/test');
const { openGame, ready, withinViewport } = require('./helpers.cjs');

// Include the touch confirmation controls in every compact geometry check;
// mouse-only contexts hide them and would miss a crowded landscape toolbar.
test.use({ hasTouch: true });

const viewports = [
  [320, 568], [360, 640], [375, 667], [390, 844], [430, 932],
  [568, 320], [640, 360], [667, 375], [844, 390], [932, 430],
  [600, 960], [768, 1024], [820, 1180], [1024, 1366], [1024, 768], [1366, 768], [1920, 1080],
];

for (const [width, height] of viewports) {
  test(`${width}x${height}: both boards and controls fit during placement and battle`, async ({ page }) => {
    const viewport = { width, height };
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openGame(page);
    for (const phase of ['placement', 'battle']) {
      if (phase === 'battle') await ready(page);
      for (const selector of ['#tahta-ben', '#tahta-rakip', '#sayac-ben', '#sayac-rakip', '#yeni-sayfa', '#ses-dugme']) {
        await withinViewport(page.locator(selector), viewport);
      }
      const headings = page.locator('#ust-ben:visible, #ust-rakip:visible, .kompakt-baslik:visible');
      expect(await headings.count()).toBe(2);
      for (const heading of await headings.all()) await withinViewport(heading, viewport);
      const primary = phase === 'placement' ? '#tahta-ben' : '#tahta-rakip';
      const mode = await page.locator('#oyun').getAttribute('data-layout');
      const hint = page.locator('#yerlestirme-ipucu');
      if (phase === 'placement' && mode !== 'defter') {
        await withinViewport(hint, viewport);
        await expect(hint).toContainText(/sürükle/i);
        await expect(hint).toContainText(/dokun.*döndür/i);
        const hintBox = await hint.boundingBox();
        const boardBox = await page.locator(primary).boundingBox();
        expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(boardBox.y + 1);
      } else {
        await expect(hint).toBeHidden();
      }
      const cell = await page.locator(`${primary} .hucre`).first().boundingBox();
      expect(cell.width).toBeGreaterThanOrEqual(24);
      expect(cell.height).toBeGreaterThanOrEqual(24);
      const buttons = page.locator('button:visible');
      for (const button of await buttons.all()) {
        await withinViewport(button, viewport);
        const box = await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth > innerWidth,
        y: document.documentElement.scrollHeight > innerHeight,
      }));
      expect(overflow).toEqual({ x: false, y: false });
    }
    expect(errors).toEqual([]);
  });
}
