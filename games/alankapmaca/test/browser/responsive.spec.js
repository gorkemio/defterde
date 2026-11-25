'use strict';
const { test, expect } = require('playwright/test');
const { openGame, fitOrGate, gateVisible, roll, answer, state } = require('./helpers');

const screens = [
  [320, 568], [360, 640], [390, 844], [568, 320], [640, 360],
  [667, 375], [844, 390], [768, 1024], [1024, 768], [1366, 768],
];

test.describe('touch viewport matrix', () => {
  test.use({
    hasTouch: true,
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'),
  });
  for (const board of [12, 16, 20]) {
    for (const [width, height] of screens) {
      test(`${board} board fits ${width}x${height} or requests rotation`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await openGame(page, { board });
        // Only this supported viewport lacks room for a 20×20 board plus 44px controls.
        if (board === 20 && width === 320 && height === 568) {
          await expect(page.locator('#yon-uyarisi')).toBeVisible();
        } else {
          await expect(page.locator('#yon-uyarisi')).toBeHidden();
        }
        await fitOrGate(page, { touch: true });
        if (await gateVisible(page)) return;
        const product = await roll(page);
        await fitOrGate(page, { touch: true });
        await answer(page, product, { touch: true });
        await fitOrGate(page, { touch: true });
      });
    }
  }

  test('browser bar height changes and safe-area insets preserve the answer', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openGame(page, { board: 20 });
    await roll(page);
    await page.locator('[data-sayi="1"]').tap();
    const before = await state(page);
    await page.addStyleTag({ content: 'body { padding: 20px 36px !important; }' });
    await page.setViewportSize({ width: 844, height: 340 });
    await page.waitForTimeout(100);
    await fitOrGate(page, { touch: true });
    expect(await state(page)).toEqual(before);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(100);
    await fitOrGate(page, { touch: true });
    expect(await state(page)).toEqual(before);
    await page.locator('#ayarlar').tap();
    const settings = await page.locator('#ayarlar-paneli').boundingBox();
    expect(settings.x).toBeGreaterThanOrEqual(32);
    expect(settings.x + settings.width).toBeLessThanOrEqual(844 - 32);
    expect(settings.y).toBeGreaterThanOrEqual(16);
    expect(settings.y + settings.height).toBeLessThanOrEqual(390 - 16);
    await page.locator('#ay-kapat').tap();
    expect(await state(page)).toEqual(before);
  });
});

test('mouse controls fit a desktop and a narrow landscape window', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openGame(page, { board: 20 });
  await fitOrGate(page);
  await page.setViewportSize({ width: 568, height: 320 });
  await page.waitForTimeout(100);
  await fitOrGate(page);
});

test('selection and rectangle direction survive rotation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openGame(page);
  await answer(page, await roll(page));
  await page.locator('#tahta').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('r');
  const before = await state(page);
  expect(before.preview).not.toBeNull();
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(100);
  expect(await state(page)).toEqual(before);
  await expect(page.locator('#tahta .hayalet')).toBeVisible();
});

test('typed answer survives a portrait-landscape round trip', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openGame(page);
  await roll(page);
  await page.locator('#giris').fill('12');
  const before = await state(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(100);
  expect(await state(page)).toEqual(before);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(100);
  expect(await state(page)).toEqual(before);
});
