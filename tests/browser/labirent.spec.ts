import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page, query = '?kod=D-K-G-7KQ9') {
  await page.goto('/oyunlar/labirent/' + query);
  await page.waitForFunction(() => (window as any).LB?.hazir);
  await page.evaluate(() => document.fonts.ready);
}
async function solve(page: Page) {
  const keys = await page.evaluate(() => {
    const L = (window as any).LB,
      g = L.oyun.lab.grid;
    const route: number[] = L.solve.cozum(L.oyun.lab);
    return route.slice(1).map((cell, i) => {
      const a = g.merkez(route[i]),
        b = g.merkez(cell);
      return b[0] > a[0]
        ? 'ArrowRight'
        : b[0] < a[0]
          ? 'ArrowLeft'
          : b[1] > a[1]
            ? 'ArrowDown'
            : 'ArrowUp';
    });
  });
  // The note buttons retain focus when hidden; focus a real game control first.
  await page.locator('#k-bastan').focus();
  for (const key of keys) await page.keyboard.press(key);
  await expect
    .poll(() => page.evaluate(() => (window as any).LB.oyun.d.bitti))
    .toBe(true);
}

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [844, 390],
  [667, 375],
])
  test(`Labirent fits ${width}×${height}, solves, saves and returns home`, async ({
    page,
  }) => {
    const errors: string[] = [],
      failed: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    page.on('requestfailed', (r) =>
      failed.push(`${r.failure()?.errorText} ${r.url()}`),
    );
    await page.setViewportSize({ width, height });
    await ready(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const canvas = await page.locator('#alan').boundingBox();
    expect(canvas!.height).toBeGreaterThan(80);
    const link = page.locator('main > .defterde-donus');
    await expect(link).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath(`labirent-${width}.png`),
    });
    await solve(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            !!(window as any).LB.depo.enIyi((window as any).LB.oyun.lab.kod),
        ),
      )
      .toBe(true);
    await page.reload();
    await page.waitForFunction(() => (window as any).LB?.hazir);
    expect(
      await page.evaluate(
        () => !!(window as any).LB.depo.enIyi((window as any).LB.oyun.lab.kod),
      ),
    ).toBe(true);
    for (const id of ['#m-serbest', '#k-hayalet', '#m-bolum', '#k-ayarlar']) {
      await page.locator(id).click();
      const close = page.locator('.not:not([hidden]) [data-kapat]');
      await close.scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport();
      await close.click();
    }
    await page.locator('#k-ayarlar').click();
    await page.locator('#renk-secim [data-deger="pembe"]').click();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => (window as any).LB?.hazir);
    expect(await page.evaluate(() => (window as any).LB.oyun.ayar.renk)).toBe(
      'pembe',
    );
    await link.focus();
    await link.press('Enter');
    await expect(page.locator('.discovery-game')).toHaveCount(20);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

test('Labirent chapters, shared codes, hints, ghost, UV, endless and print', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A real print dialog blocks the click in Firefox; count calls instead.
  await page.addInitScript(() => {
    (window as any).__baskilar = 0;
    window.print = () => {
      (window as any).__baskilar++;
    };
  });
  await ready(page, '');
  expect(await page.evaluate(() => (window as any).LB.oyun.baglam.mod)).toBe(
    'gunun',
  );
  await page.locator('#m-bolum').click();
  await page
    .getByRole('button', { name: 'Dikdörtgen 1. seviye', exact: true })
    .click();
  await expect(page.locator('#not-bolum')).toBeHidden();
  await solve(page);
  await expect(page.locator('#k-sonraki')).toBeVisible();
  await page.locator('#k-sonraki').click();
  expect(await page.evaluate(() => (window as any).LB.oyun.baglam.seviye)).toBe(
    2,
  );
  await page.locator('#k-ipucu').click();
  expect(await page.evaluate(() => (window as any).LB.oyun.ceza)).toBe(10);
  await page.locator('#k-cozum').click();
  expect(await page.evaluate(() => (window as any).LB.oyun.cozumGoruldu)).toBe(
    true,
  );
  await page.locator('#k-bastan').click();
  await page.locator('#k-hayalet').click();
  await page.locator('#hayalet-secim [data-deger="kolay"]').click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => !!(window as any).LB.oyun.rakip)).toBe(true);
  await page.locator('#k-ayarlar').click();
  await page
    .locator('#uv-secim [data-grup="görünmez mürekkep"][data-deger="acik"]')
    .click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).LB.oyun.ayar.uv)).toBe(true);
  for (const type of ['H', 'A', 'T']) {
    await page.locator('#m-serbest').click();
    await page.locator('#kod-gir').fill(`${type}-K-G-7KQ9`);
    await page.locator('#kod-ac').click();
    await expect(page).toHaveURL(new RegExp(`kod=${type}-K-G-7KQ9`));
    expect(await page.evaluate(() => (window as any).LB.oyun.lab.tur)).toBe(
      type,
    );
    expect(
      await page.evaluate(() =>
        (window as any).LB.kod.link((window as any).LB.oyun.lab.kod),
      ),
    ).toContain('/oyunlar/labirent/?kod=');
  }
  await page.locator('#k-yazdir').click();
  await expect(page.locator('#yazdir svg')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__baskilar))
    .toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#yazdir')).toBeVisible();
  await expect(page.locator('.defterde-donus')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.locator('#m-sonsuz').click();
  expect(await page.evaluate(() => (window as any).LB.sonsuz.aktif)).toBe(true);
  await expect(page.locator('#k-yazdir')).toBeDisabled();
  await page.locator('#m-gunun').click();
  expect(await page.evaluate(() => (window as any).LB.sonsuz.aktif)).toBe(
    false,
  );
  expect(errors).toEqual([]);
});

test('Labirent serves only reviewed runtime resources', async ({ request }) => {
  for (const path of [
    'PLAN.md',
    'stil.html',
    'package.json',
    'test/path.test.js',
    'scripts/font-tr.py',
    'assets/fonts/Mynerve-Regular.ttf',
  ])
    expect((await request.get('/oyunlar/labirent/' + path)).status()).toBe(404);
  expect((await request.get('/oyunlar/labirent/.git/config')).status()).toBe(
    403,
  );
  expect((await request.get('/assets/drawings/labirent.svg')).status()).toBe(
    200,
  );
  expect((await request.get('/nasil-oynanir/labirent/')).status()).toBe(200);
});
