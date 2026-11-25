'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('playwright/test');
const { openGame, fitOrGate, expectInside, roll, answer, state } = require('./helpers');

test.describe('touch input', () => {
  test.use({
    hasTouch: true, viewport: { width: 768, height: 1024 },
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'),
  });

  test('keypad limits digits, deletes, and accepts a correct answer without the system keyboard', async ({ page }) => {
    await openGame(page);
    const product = await roll(page);
    await expect(page.locator('#giris')).toHaveJSProperty('readOnly', true);
    await expect(page.locator('#sayi-paneli button')).toHaveCount(12);
    for (const digit of ['1', '2', '3', '4']) await page.locator(`[data-sayi="${digit}"]`).tap();
    await expect(page.locator('#giris')).toHaveValue('123');
    for (let i = 0; i < 3; i++) await page.locator('#sayi-sil').tap();
    await expect(page.locator('#giris')).toHaveValue('');
    const rights = await page.evaluate(() => AB.durum.oyun.hak);
    await page.locator('#sayi-tamam').tap();
    expect(await page.evaluate(() => AB.durum.oyun.hak)).toBe(rights);
    expect(await page.evaluate(() => AB.durum.hesaplaniyor)).toBe(true);
    await answer(page, product, { touch: true });
    await expect(page.locator('#sayi-paneli')).toBeHidden();
  });

  test('physical keyboard works with the readonly touch input', async ({ page }) => {
    await openGame(page);
    const product = await roll(page);
    await page.locator('#giris').focus();
    await page.keyboard.type('1234');
    await expect(page.locator('#giris')).toHaveValue('123');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#giris')).toHaveValue('12');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(String(product));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => AB.durum.yerlesiyor && !AB.durum.kilit);
  });

  test('two taps on the same cell place exactly one rectangle', async ({ page }) => {
    await openGame(page);
    const product = await roll(page);
    await answer(page, product, { touch: true });
    const box = await page.locator('#tahta').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 4, box.y + box.height / 4);
    expect(await page.evaluate(() => AB.durum.oyun.dikdortgenler.length)).toBe(0);
    await page.touchscreen.tap(box.x + box.width / 4, box.y + box.height / 4);
    await page.touchscreen.tap(box.x + box.width / 4, box.y + box.height / 4);
    expect(await page.evaluate(() => AB.durum.oyun.dikdortgenler.filter(r => r.sahip === 'ben').length)).toBe(1);
    expect(await page.evaluate(() => AB.durum.oyun.puan.ben)).toBe(product);
  });

  for (const [width, height] of [[320, 568], [568, 320]]) {
  test(`settings choices have reachable 44px touch targets at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openGame(page);
    await page.locator('#ayarlar').tap();
    await expectInside(page, '#ayarlar-paneli');
    for (const button of await page.locator('#ayarlar-paneli button').all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(43.99);
      expect(box.height).toBeGreaterThanOrEqual(43.99);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await page.getByRole('radio', { name: '20', exact: true }).tap();
    await page.locator('#ay-kapat').tap();
    await page.locator('#yeni-sayfa').tap();
    await page.waitForFunction(() => AB.durum.oyun.n === 20 && !AB.durum.kilit);
    await fitOrGate(page, { touch: true });
  });
  }
});

test('wrong answer consumes one turn, including a rapid second submit', async ({ page }) => {
  await openGame(page);
  await roll(page);
  await page.locator('#giris').fill('999');
  await page.locator('#tamam').dblclick();
  await page.waitForFunction(() => AB.durum.oyun.gecmis.some(h => h.olay === 'yanlis'));
  expect(await page.evaluate(() => AB.durum.oyun.gecmis.filter(h => h.olay === 'yanlis' && h.sahip === 'ben').length)).toBe(1);
  expect(await page.evaluate(() => AB.durum.oyun.puan.ben)).toBe(0);
});

test('empty desktop answer does not consume a chance', async ({ page }) => {
  await openGame(page);
  await roll(page);
  const before = await page.evaluate(() => ({ rights: AB.durum.oyun.hak, history: AB.durum.oyun.gecmis.length }));
  await page.locator('#tamam').click();
  expect(await page.evaluate(() => ({ rights: AB.durum.oyun.hak, history: AB.durum.oyun.gecmis.length }))).toEqual(before);
  expect(await page.evaluate(() => AB.durum.hesaplaniyor)).toBe(true);
});

test('timer pauses in settings and resumes on close', async ({ page }) => {
  await page.clock.install();
  await openGame(page, { seconds: 20 });
  await page.locator('#ayarlar').click();
  const remaining = await page.evaluate(() => AB.durum.kalan);
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => AB.durum.kalan)).toBe(remaining);
  await page.locator('#ay-kapat').click();
  await page.clock.runFor(1100);
  expect(await page.evaluate(() => AB.durum.kalan)).toBeLessThan(remaining);
});

test('timer pauses while the document is hidden', async ({ page }) => {
  await page.clock.install();
  await openGame(page, { seconds: 20 });
  // Visibility is a browser event boundary: synthesize it without changing game state.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const remaining = await page.evaluate(() => AB.durum.kalan);
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => AB.durum.kalan)).toBe(remaining);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1100);
  expect(await page.evaluate(() => AB.durum.kalan)).toBeLessThan(remaining);
});

test.describe('rotation pause', () => {
  test.use({
    hasTouch: true, viewport: { width: 568, height: 320 },
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'),
  });
  test('orientation gate freezes remaining time and dismissal restores input', async ({ page }) => {
    await page.clock.install();
    await openGame(page, { board: 20, seconds: 20 });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.clock.runFor(100);
    await expect(page.locator('#yon-uyarisi')).toBeVisible();
    const remaining = await page.evaluate(() => AB.durum.kalan);
    const before = await state(page);
    await page.clock.runFor(3000);
    expect(await page.evaluate(() => AB.durum.kalan)).toBe(remaining);
    expect(await state(page)).toEqual(before);
    await page.setViewportSize({ width: 568, height: 320 });
    await page.clock.runFor(100);
    await expect(page.locator('#yon-uyarisi')).toBeHidden();
    await expect(page.locator('#zar-a')).toBeEnabled();
    await page.clock.runFor(1100);
    expect(await page.evaluate(() => AB.durum.kalan)).toBeLessThan(remaining);
  });

  test('orientation gate settings can open a smaller playable board', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openGame(page, { board: 20 });
    await expect(page.locator('#yon-uyarisi')).toBeVisible();
    await page.locator('#yon-ayarlar').tap();
    await expect(page.locator('#ayarlar-paneli')).toBeVisible();
    await page.getByRole('radio', { name: '12', exact: true }).tap();
    await page.locator('#ay-yeni').tap();
    await page.waitForFunction(() => AB.durum.oyun.n === 12 && !AB.durum.kilit);
    await expect(page.locator('#yon-uyarisi')).toBeHidden();
    await fitOrGate(page, { touch: true });
    await roll(page);
  });

  test('a short landscape viewport requests portrait when that is the fitting direction', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 300 });
    await openGame(page, { board: 16 });
    await expect(page.locator('#yon-baslik')).toContainText(/dik çevir/i);
    await page.evaluate(() => {
      Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: () => Promise.resolve() });
      Object.defineProperty(screen, 'orientation', {
        configurable: true,
        value: { lock: orientation => { window.requestedOrientation = orientation; return Promise.resolve(); } },
      });
    });
    await page.locator('#tam-ekran').tap();
    expect(await page.evaluate(() => window.requestedOrientation)).toBe('portrait');
    await page.setViewportSize({ width: 300, height: 640 });
    await expect(page.locator('#yon-uyarisi')).toBeHidden();
    await fitOrGate(page, { touch: true });
    await roll(page);
  });

  for (const rejected of ['fullscreen', 'orientation lock']) {
    test(`manual rotation remains available when ${rejected} is rejected`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openGame(page, { board: 20 });
      const before = await state(page);
      await page.evaluate(rejected => {
        Object.defineProperty(document.documentElement, 'requestFullscreen', {
          configurable: true,
          value: () => rejected === 'fullscreen'
            ? Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : Promise.resolve(),
        });
        Object.defineProperty(screen, 'orientation', {
          configurable: true,
          value: { lock: () => Promise.reject(new DOMException('Unsupported orientation lock', 'NotSupportedError')) },
        });
      }, rejected);
      await page.locator('#tam-ekran').tap();
      await expect(page.locator('#yon-durum')).toContainText(/elle.*çevir/i);
      expect(await state(page)).toEqual(before);
      await page.setViewportSize({ width: 568, height: 320 });
      await expect(page.locator('#yon-uyarisi')).toBeHidden();
      await expect(page.locator('#zar-a')).toBeEnabled();
      await roll(page);
    });
  }
});

test('time expiry records a single lost turn', async ({ page }) => {
  await page.clock.install();
  await openGame(page, { seconds: 20 });
  await page.clock.runFor(22_000);
  expect(await page.evaluate(() => AB.durum.oyun.gecmis.filter(h => h.olay === 'sure').length)).toBe(1);
  expect(await page.evaluate(() => AB.durum.oyun.puan.ben)).toBe(0);
});

test('a board with no fitting move passes twice, shows the result, and restarts cleanly', async ({ page }) => {
  await openGame(page, { board: 12, dieMax: 12, calculation: false });
  await page.evaluate(() => { AB.durum.r = () => 0.9; });
  await page.locator('#zar-a').click();
  await page.waitForFunction(() => AB.durum.yerlesiyor && !AB.durum.kilit);
  await page.locator('#tahta').click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(() => AB.durum.oyun.sira === 'ben' && AB.durum.oyun.asama === 'zar' && !AB.durum.kilit);
  await page.locator('#zar-a').click();
  await page.waitForFunction(() => AB.durum.oyun.asama === 'bitti');
  await expect(page.locator('#tahta .sonuc')).toBeVisible();
  expect(await page.evaluate(() => AB.durum.oyun.puan)).toEqual({ ben: 121, rakip: 0 });
  expect(await page.evaluate(() => AB.durum.oyun.gecmis.filter(h => h.olay === 'pas').length)).toBe(2);
  await page.locator('#yeni-sayfa').click();
  await page.waitForFunction(() => !AB.durum.kilit && AB.durum.oyun.asama === 'zar');
  expect(await page.evaluate(() => AB.durum.oyun.dikdortgenler.length)).toBe(0);
  expect(await page.evaluate(() => AB.durum.oyun.puan)).toEqual({ ben: 0, rakip: 0 });
  await expect(page.locator('#tahta .sonuc')).toHaveCount(0);
});

test('restarting during a pending answer cannot change the new game', async ({ page }) => {
  await openGame(page);
  const product = await roll(page);
  await page.locator('#giris').fill(String(product));
  await page.locator('#tamam').click();
  await page.locator('#yeni-sayfa').click();
  await page.waitForFunction(() => !AB.durum.kilit && AB.durum.oyun.asama === 'zar');
  const before = await state(page);
  await page.waitForTimeout(1300);
  expect(await state(page)).toEqual(before);
  expect(await page.evaluate(() => AB.durum.yerlesiyor)).toBe(false);
});

test.describe('animated transitions', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 768, height: 1024 } });

  test('rotation during rolling, drawing and the opponent turn keeps one move per player', async ({ page }) => {
    test.setTimeout(60_000);
    await openGame(page);
    await page.locator('#zar-a').click();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(() => AB.durum.hesaplaniyor && !AB.durum.kilit);
    const product = await page.evaluate(() => AB.durum.oyun.zar.a * AB.durum.oyun.zar.b);
    await page.locator('#giris').fill(String(product));
    await page.locator('#tamam').click();
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForFunction(() => AB.durum.yerlesiyor && !AB.durum.kilit);
    await page.locator('#tahta').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => AB.durum.balonAcik);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForFunction(() => !AB.durum.kilit && AB.durum.oyun.sira === 'ben' && AB.durum.oyun.asama === 'zar');
    expect(await page.evaluate(() => AB.durum.oyun.dikdortgenler.map(r => r.sahip))).toEqual(['ben', 'rakip']);
    expect(await page.evaluate(() => AB.durum.oyun.puan.ben)).toBe(product);
    expect(await page.evaluate(() => AB.durum.hesap.toplam)).toEqual(await page.evaluate(() => AB.durum.oyun.puan));
    await fitOrGate(page);
  });

  test('a restarted page is not changed by the old dice animation', async ({ page }) => {
    test.setTimeout(60_000);
    await openGame(page);
    await page.locator('#zar-a').click();
    await page.locator('#yeni-sayfa').click();
    await page.waitForFunction(() => !AB.durum.kilit && !AB.durum.gecis && AB.durum.oyun.asama === 'zar');
    const before = await state(page);
    await page.waitForTimeout(1500);
    expect(await state(page)).toEqual(before);
    expect(await page.evaluate(() => AB.durum.sonZar)).toBeNull();
  });
});

test('HTTP game starts and plays with all external requests blocked', async ({ page }) => {
  const external = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await openGame(page);
  await answer(page, await roll(page));
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('file URL starts and plays without a network connection', async ({ page, context }) => {
  await context.setOffline(true);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openGame(page, { url: pathToFileURL(path.resolve(__dirname, '../../index.html')).href });
  await answer(page, await roll(page));
  expect(errors).toEqual([]);
});
