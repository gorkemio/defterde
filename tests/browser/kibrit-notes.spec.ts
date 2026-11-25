import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/oyunlar/kibrit/');
  await page.waitForFunction(() => (window as any).KB?.hazir);
  await page.evaluate(() => document.fonts.ready);
}

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [1440, 900],
  [844, 390],
]) {
  test(`notes stay centered and usable at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    for (const id of ['modlar', 'ayarlar']) {
      await page.locator(`#k-${id}`).click();
      const dialog = page.locator(`#${id}`);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      const box = (await dialog.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(3);
      expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThan(3);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      const close = dialog.locator('[data-kapat]');
      await expect(close).toBeInViewport({ ratio: 1 });
      const closeBox = (await close.boundingBox())!;
      expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(
        box.y + box.height + 4,
      );
      await page.screenshot({
        path: test.info().outputPath(`${id}-${width}.png`),
      });
      await close.click();
      await expect(dialog).toBeHidden();
    }
    await page.locator('#k-modlar').click();
    await page.locator('[data-mod="kitap"]').click();
    await expect(page.locator('.kitap-no')).toHaveCount(190);
    await page.locator('.kitap-no').last().click();
    await page.locator('.bulmaca-no').last().click();
    await expect(page.locator('#kitaplar')).toBeHidden();
    await expect(page.locator('#kupur svg.sahne')).toBeVisible();
  });
}

test('notes trap keyboard focus and restore it on Escape and backdrop click', async ({
  page,
}) => {
  await open(page);
  const trigger = page.locator('#k-modlar');
  await trigger.focus();
  await trigger.press('Enter');
  const first = page.locator('#modlar button').first();
  const last = page.locator('#modlar button').last();
  await expect(first).toBeFocused();
  await first.press('Shift+Tab');
  await expect(last).toBeFocused();
  await last.press('Tab');
  await expect(first).toBeFocused();
  await first.press('Escape');
  await expect(page.locator('#modlar')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await page.locator('#not-katman').click({ position: { x: 2, y: 2 } });
  await expect(page.locator('#modlar')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await page.locator('[data-mod="ikiKisi"]').click();
  await expect(page.locator('#devir')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#not-katman').click({ position: { x: 2, y: 2 } });
  await expect(page.locator('#devir')).toBeVisible();
  await page
    .getByRole('button', { name: 'sırayla boz ve düzelt', exact: true })
    .click();
  await page.locator('#devir-tamam').click();
  await expect(page.locator('#devir')).toBeHidden();
});
