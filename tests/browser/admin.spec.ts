import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { Database } from '../../src/server/database';
import { digest } from '../../src/server/auth';
const dbURL = process.env.TEST_DATABASE_URL;
test('owner catalog UI: save, preview, publish, conflict and restore', async ({
  page,
  context,
}, info) => {
  test.skip(
    !dbURL || !process.env.ADMIN_BASE_URL,
    'Dedicated admin test server required',
  );
  expect(new URL(dbURL!).pathname).toMatch(/_test$/);
  const db = new Database(dbURL!),
    token = randomBytes(32).toString('base64url'),
    csrf = randomBytes(32).toString('base64url');
  await db.createSession(digest(token), '42', csrf);
  try {
    const base = process.env.ADMIN_BASE_URL!;
    await context.addCookies([
      {
        name: 'defterde-session',
        value: token,
        url: base,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto(base + '/yonetim/');
    await expect(page.locator('#status')).toHaveText('Taslak hazır.');
    await page.locator('[name="amiralbatti-title"]').fill('Tarayıcı testi');
    await expect(page.locator('#publish')).toBeDisabled();
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText('Taslak kaydedildi');
    const preview = await context.newPage();
    await preview.goto(base + '/yonetim/onizleme/');
    await expect(preview.locator('.game-row').first()).toContainText(
      'Tarayıcı testi',
    );
    await preview.close();
    await page.locator('#publish').click();
    await expect(page.locator('#status')).toContainText('Katalog yayımlandı');
    const pub = await context.newPage();
    await pub.goto(base);
    await expect(pub.locator('.discovery-game').first()).toContainText(
      'Tarayıcı testi',
    );
    await pub.close();
    const other = await context.newPage();
    await other.goto(base + '/yonetim/');
    await expect(other.locator('#status')).toHaveText('Taslak hazır.');
    await other.locator('[name="sos-description"]').fill('İkinci sekme');
    await other.locator('#save').click();
    await expect(other.locator('#status')).toContainText('Taslak kaydedildi');
    await page.locator('[name="sos-description"]').fill('Eski sekme');
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText(
      'başka bir sekmede değişti',
    );
    await expect(page.locator('[name="sos-description"]')).toHaveValue(
      'Eski sekme',
    );
    page.on('dialog', (d) => d.accept());
    await page.locator('#reload').click();
    await expect(page.locator('#status')).toContainText(
      'Güncel taslak yüklendi',
    );
    await page.locator('#history').selectOption('0');
    await page.locator('#restore').click();
    await expect(page.locator('#status')).toContainText('yeniden yayımlandı');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: `test-results/admin-${info.project.name}.png`,
      fullPage: true,
    });
    await page.locator('#logout').click();
    await expect(page.locator('#catalog-form')).toHaveCount(0);
    await other.close();
  } finally {
    await db.close();
  }
});
