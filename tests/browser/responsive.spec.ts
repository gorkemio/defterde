import { test, expect } from '@playwright/test';
for (const slug of [
  'amiralbatti',
  'alankapmaca',
  'kagitfutbolu',
  'sos',
  'kagithangar',
  'adamasmaca',
])
  test(`${slug}: narrow portrait, landscape and audio control`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/oyunlar/${slug}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    if (slug === 'amiralbatti')
      await page.waitForFunction(
        () =>
          (window as any).AB?.durum?.tahta?.ben &&
          !(window as any).AB.durum.kilit,
      );
    if (slug === 'alankapmaca')
      await page.waitForFunction(
        () =>
          (window as any).AB?.durum?.hazir && !(window as any).AB.durum.kilit,
      );
    if (slug === 'kagitfutbolu')
      await page.waitForFunction(
        () => (window as any).KF?.durum?.d && !(window as any).KF.durum.kilit,
      );
    if (slug === 'sos')
      await page.waitForFunction(
        () => (window as any).SOS?.durum && !(window as any).SOS.durum.kilit,
      );
    if (slug === 'kagithangar') {
      await page.waitForFunction(() => (window as any).KagitHangar?.sayfa);
      await expect(page.locator('.masa-duzen')).toBeVisible();
    }
    const button = page.locator(
      slug === 'kagithangar'
        ? '#ses-dugmesi'
        : slug === 'adamasmaca'
          ? '#ses-ic'
          : '#ses-dugme',
    );
    await expect(button).toBeVisible();
    const previous = await button.getAttribute('aria-pressed');
    await button.click();
    await expect(button).not.toHaveAttribute(
      'aria-pressed',
      previous || 'false',
    );
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
      await expect(page.locator('main')).toBeVisible();
    }
  });
