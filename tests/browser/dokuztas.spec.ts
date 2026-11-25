import { test, expect } from '@playwright/test';

test('Dokuz Taş: computer move, local mill/capture, undo, settings and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/oyunlar/dokuztas/');
  await page.waitForFunction(
    () => (window as any).DT?.durum?.durum && !(window as any).DT.durum.kilit,
  );
  await expect(page.locator('.nokta')).toHaveCount(24);
  await page.locator('.nokta[data-i="0"]').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).DT.durum.durum.hamleNo))
    .toBe(2);
  await page.locator('#ayarlar-ac').click();
  await page.locator('[data-ayar="ikiKisi"][data-deger="evet"]').click();
  await page.locator('[data-ayar="tasSeti"][data-deger="fasulye"]').click();
  await page.locator('#ayarlar-kapat').click();
  await page.locator('#yeni-oyun').click();
  await page.waitForFunction(() => !(window as any).DT.durum.kilit);
  for (const i of [0, 8, 1, 9, 2]) {
    await page.locator(`.nokta[data-i="${i}"]`).click();
    await page.waitForFunction(() => !(window as any).DT.durum.kilit);
  }
  await page.locator('.nokta[data-i="8"]').click();
  await expect(page.locator('.nokta[data-i="8"]')).toHaveAttribute(
    'aria-label',
    /boş/,
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).DT.durum.gecmis.length))
    .toBe(5);
  await page.locator('#geri-al').click();
  await expect(page.locator('.nokta[data-i="8"]')).not.toHaveAttribute(
    'aria-label',
    /boş/,
  );
  const soundBefore = await page.locator('#ses').getAttribute('aria-pressed');
  await page.locator('#ses').click();
  await expect(page.locator('#ses')).not.toHaveAttribute(
    'aria-pressed',
    soundBefore!,
  );
  await page.reload();
  await page.waitForFunction(() => !(window as any).DT?.durum?.kilit);
  await page.locator('#ayarlar-ac').click();
  await expect(
    page.locator('[data-ayar="tasSeti"][data-deger="fasulye"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('[data-ayar="ikiKisi"][data-deger="evet"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('Amiral Battı has no static back leaves, and the real binding remains', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/oyunlar/amiralbatti/');
  await expect(page.locator('.cilt')).toBeVisible();
  for (const pseudo of ['::before', '::after']) {
    expect(
      await page
        .locator('main .defter')
        .evaluate((el, p) => getComputedStyle(el, p).content, pseudo),
    ).toBe('none');
  }
});
