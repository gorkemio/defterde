import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/oyunlar/kibrit/');
  await page.waitForFunction(() => (window as any).KB?.hazir);
  await page.evaluate(() => document.fonts.ready);
}
async function mode(page: Page, name: string) {
  await page.locator('#k-modlar').click();
  await page.locator(`[data-mod="${name}"]`).click();
  await page.waitForFunction((m) => (window as any).KB.oyun.mod === m, name);
}
async function move(page: Page, input: 'keyboard' | 'pointer' = 'keyboard') {
  const step = await page.evaluate(() => {
    const kb = (window as any).KB,
      t = kb.oyun.tur;
    const c = kb.solver.coz(t.durum0, kb.model.hakOf(t.hakKat))[0]
      .varyantlar[0];
    const h = c.hamleler[0];
    return { from: t.kupur.sahne.yuvaCop.get(h.den), to: h.ye };
  });
  const from = page.locator(`#kupur [data-cop="${step.from}"]`);
  const to = page.locator(`#kupur [data-yuva="${step.to}"]`);
  if (input === 'keyboard') {
    await from.focus();
    await from.press('Enter');
    await expect(to).toHaveAttribute('role', 'button');
    await to.focus();
    await to.press('Enter');
  } else {
    await from.click();
    await to.click();
  }
  await page.waitForFunction(() => (window as any).KB.oyun.tur.bitti);
}

// PT Serif ships upstream's unmodified files (its OFL reserves the name, so an
// edited copy would need renaming). Their legacy `kern` table has a subtable
// longer than 64 KB; Firefox's sanitizer drops that table and kerns through
// GPOS instead. Ignore only that notice for this font.
const fontSanitizerNotice = (text: string) =>
  /downloadable font: (kern: Too large subtable|Table discarded) \(font-family: "PT Serif"/.test(
    text,
  ) && text.includes('/oyunlar/kibrit/assets/fonts/PTSerif-');

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [844, 390],
])
  test(`Kibrit fits ${width}×${height} and solves through keyboard`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (fontSanitizerNotice(m.text())) return;
      if (['warning', 'error'].includes(m.type())) errors.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.setViewportSize({ width, height });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await expect(page.locator('.defterde-donus')).toBeInViewport();
    const b = (await page.locator('.defterde-donus').boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({
      path: test.info().outputPath(`kibrit-${width}.png`),
      fullPage: true,
    });
    await move(page);
    await expect(page.locator('#duyuru')).toContainText('Çözdün:');
    await expect(page.locator('#k-sonraki')).toContainText('maça başla');
    expect(errors).toEqual([]);
  });

test('daily puzzle and settings persist; pointer move solves the puzzle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('#k-ayarlar').click();
  await page.getByRole('button', { name: '3 tur', exact: true }).click();
  await page.getByRole('button', { name: 'kolay', exact: true }).click();
  await page.locator('[data-kapat="ayarlar"]').click();
  await mode(page, 'gunun');
  await page.waitForFunction(() => (window as any).KB.oyun.gun?.tur?.etk);
  await move(page, 'pointer');
  await expect(page.locator('#k-paylas')).toBeVisible();
  const before = await page.evaluate(() => {
    const g = (window as any).KB.oyun.gun;
    return { date: g.tarih, record: g.kay, puzzle: g.tur.kayit.kimlik };
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).KB?.hazir);
  await page.locator('#k-ayarlar').click();
  await expect(
    page.getByRole('button', { name: '3 tur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'kolay', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-kapat="ayarlar"]').click();
  await mode(page, 'gunun');
  await page.waitForFunction(() => (window as any).KB.oyun.gun?.tur?.bitti);
  expect(
    await page.evaluate(() => {
      const g = (window as any).KB.oyun.gun;
      return { date: g.tarih, record: g.kay, puzzle: g.tur.kayit.kimlik };
    }),
  ).toEqual(before);
});

test('all modes and all six book categories load below the platform path', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  for (const name of ['hepsini', 'boz', 'sonsuz']) {
    await mode(page, name);
    await expect(page.locator('#kupur svg.sahne')).toBeVisible();
  }
  await mode(page, 'kitap');
  await expect(page.locator('.kitap-kategori')).toHaveCount(6);
  await expect.poll(() => page.locator('.kitap-no').count()).toBe(190);
  for (let i = 0; i < 6; i++) {
    await page
      .locator('.kitap-kategori')
      .nth(i)
      .locator('.kitap-no')
      .first()
      .click();
    await page.locator('#kitap-icerik .bulmaca-no').first().click();
    await expect(page.locator('#kupur svg.sahne')).toBeVisible();
    await page.locator('#k-yeni').click();
    await expect(page.locator('.kitap-kategori')).toHaveCount(6);
  }
  await page.locator('[data-kapat="kitaplar"]').click();
  await mode(page, 'ikiKisi');
  await expect(page.locator('#devir')).toBeVisible();
  await page
    .getByRole('button', { name: 'sırayla boz ve düzelt', exact: true })
    .click();
  await expect(page.locator('#devir-tamam')).toBeVisible();
  await page.locator('#devir-tamam').click();
  await expect(page.locator('#kupur svg.sahne')).toBeVisible();
  expect(errors).toEqual([]);
});

test('runtime allowlist blocks source, tests and unused kit modules', async ({
  request,
}) => {
  for (const path of [
    'test/model.test.js',
    'scripts/uret.mjs',
    'README.md',
    'kit/gazete.js',
  ])
    expect((await request.get(`/oyunlar/kibrit/${path}`)).status(), path).toBe(
      404,
    );
  expect((await request.get('/oyunlar/kibrit/.git/config')).status()).toBe(403);
});
