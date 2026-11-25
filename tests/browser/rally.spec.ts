import { test, expect } from '@playwright/test';

test('Kağıt Rallisi: race move, undo, modes, saved settings, orientation and local assets', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/oyunlar/kagitrallisi/') && r.status() >= 400)
      failed.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/oyunlar/kagitrallisi?test=rally');
  await expect(page).toHaveURL(/kagitrallisi\/\?test=rally$/);
  await page.waitForFunction(() => (window as any).KR?.ui?.U?.durum);
  await page.locator('#nasil-kapat').click();
  await page.locator('#yeni').click();
  await page.locator('[data-ayar="mod"][data-deger="solo"]').click();
  await page.locator('#basla').click();
  await expect.poll(() => page.locator('.hedef').count()).toBeGreaterThan(0);
  await page.locator('.hedef').first().click();
  await page.waitForFunction(
    () =>
      (window as any).KR.ui.U.gecmis.length > 0 &&
      (window as any).KR.ui.U.bekleyen,
  );
  await expect(page.locator('#geri')).toBeEnabled();
  await page.locator('#geri').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).KR.ui.U.gecmis.length))
    .toBe(0);
  const audio = page.locator('#ses'),
    pressed = await audio.getAttribute('aria-pressed');
  await audio.click();
  await expect(audio).not.toHaveAttribute('aria-pressed', pressed!);
  await page.locator('#fren').click();
  await page.reload();
  await page.waitForFunction(() => (window as any).KR?.ui?.U?.bekleyen);
  await expect(page.locator('#fren')).toHaveAttribute('aria-pressed', 'true');
  await expect(audio).not.toHaveAttribute('aria-pressed', pressed!);
  await expect
    .poll(() => page.evaluate(() => (window as any).KR.ui.ayar.mod))
    .toBe('solo');
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).KR.ui.U.durum),
  );
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('main > .defterde-donus')).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(
      await page.evaluate(() => JSON.stringify((window as any).KR.ui.U.durum)),
    ).toBe(before);
  }
  for (const mod of ['aynicihaz', 'bilgisayar', 'gunun']) {
    await page.locator('#yeni').click();
    await page.locator(`[data-ayar="mod"][data-deger="${mod}"]`).click();
    if (mod === 'aynicihaz')
      await page.locator('[data-ayar="oyuncuSayisi"][data-deger="4"]').click();
    await page.locator('#basla').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).KR.ui.U.mod))
      .toBe(mod);
    await expect.poll(() => page.locator('.hedef').count()).toBeGreaterThan(0);
    if (mod === 'aynicihaz')
      await expect(page.locator('#oyuncular > li')).toHaveCount(4);
  }
  await page.waitForFunction(
    () => (window as any).KR.ui.U.gunun && (window as any).KR.ui.U.bekleyen,
  );
  const daily = await page.evaluate(() => (window as any).KR.ui.U.gunun.tarih);
  await page.reload();
  await page.waitForFunction(() => (window as any).KR?.ui?.U?.gunun);
  expect(await page.evaluate(() => (window as any).KR.ui.U.gunun.tarih)).toBe(
    daily,
  );
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
