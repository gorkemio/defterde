const { test, expect } = require('@playwright/test');
const { openGame, state, ready } = require('./helpers.cjs');

for (const interruption of ['pointercancel', 'lostpointercapture', 'blur', 'resize', 'same-layout resize']) {
  test(`ship dragging cancels on ${interruption} without committing or rotating`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openGame(page);
    const before = await state(page);
    const handle = page.locator('#tahta-ben .tutamak').first();
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 26, y + 26, { steps: 3 });
    await expect.poll(() => page.evaluate(() => Boolean(AB.durum.surukle?.tasindi))).toBe(true);
    const pointerId = await page.evaluate(() => AB.durum.surukle.id);
    if (interruption === 'pointercancel' || interruption === 'lostpointercapture') {
      await handle.dispatchEvent(interruption, { pointerId, pointerType: 'mouse', bubbles: true });
    } else if (interruption === 'blur') {
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    } else if (interruption === 'resize') {
      await page.setViewportSize({ width: 390, height: 844 });
    } else {
      const boardBefore = await page.locator('#tahta-ben').boundingBox();
      await page.setViewportSize({ width: 1367, height: 768 });
      const boardAfter = await page.locator('#tahta-ben').boundingBox();
      expect(boardAfter.width).toBe(boardBefore.width);
      expect(boardAfter.height).toBe(boardBefore.height);
    }
    await expect.poll(() => page.evaluate(() => AB.durum.surukle === null)).toBe(true);
    await expect(page.locator('#tahta-ben')).not.toHaveClass(/suruklenen/);
    await page.mouse.up();
    expect((await state(page)).gemiler).toEqual(before.gemiler);
    expect((await state(page)).atis).toEqual(before.atis);
    expect((await state(page)).jeton).toBe(before.jeton);
  });
}

test.describe('browser permission failures', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  for (const failure of ['fullscreen', 'orientation lock']) {
    test(`${failure} rejection preserves the paused game and allows manual rotation`, async ({ page }) => {
      // Stub only OS/browser capabilities: game state and rendering remain real.
      await page.addInitScript(rejectedStage => {
        window.__testPermissionCalls = { fullscreen: 0, orientation: 0 };
        Object.defineProperty(Element.prototype, 'requestFullscreen', {
          configurable: true,
          value: async function () {
            window.__testPermissionCalls.fullscreen++;
            if (rejectedStage === 'fullscreen') throw new DOMException('User denied fullscreen', 'NotAllowedError');
          },
        });
        const orientation = screen.orientation || {};
        if (!screen.orientation) Object.defineProperty(screen, 'orientation', { value: orientation, configurable: true });
        Object.defineProperty(orientation, 'lock', {
          configurable: true,
          value: async () => {
            window.__testPermissionCalls.orientation++;
            throw new DOMException('Orientation lock unavailable', 'NotSupportedError');
          },
        });
      }, failure);
      await openGame(page);
      await ready(page);
      await page.locator('#tahta-rakip .hucre').nth(23).tap();
      const before = await state(page);
      expect(before.secili).toEqual({ s: 2, k: 3 });
      await page.setViewportSize({ width: 240, height: 300 });
      await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeVisible();
      await page.getByRole('button', { name: 'Tam ekran', exact: true }).click();
      await expect(page.locator('#yon-sonuc')).toContainText(/elle yana çevir/i);
      expect(await page.evaluate(() => window.__testPermissionCalls)).toEqual({ fullscreen: 1, orientation: failure === 'fullscreen' ? 0 : 1 });
      const paused = await state(page);
      expect(paused.duraklat).toBe(true);
      expect(paused.gemiler).toEqual(before.gemiler);
      expect(paused.secili).toEqual(before.secili);
      expect(paused.atis).toEqual(before.atis);
      expect(paused.jeton).toBe(before.jeton);
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeHidden();
      expect((await state(page)).duraklat).toBe(false);
      expect((await state(page)).secili).toEqual(before.secili);
      await page.getByRole('button', { name: 'Ateş et', exact: true }).tap();
      expect((await state(page)).atis.ben).toBe(1);
    });
  }
});
