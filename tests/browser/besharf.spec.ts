import { test, expect, type Page } from '@playwright/test';
async function open(page: Page, suffix = '') {
  await page.goto('/oyunlar/besharf/' + suffix);
  await page.waitForFunction(() => (window as any).BH?.hazir);
  await expect(page.locator('#not')).toBeVisible();
  await page.keyboard.press('Escape');
}
async function typeWord(page: Page, word: string) {
  for (const letter of word)
    await page.locator(`.klavye [data-harf="${letter}"]`).click();
  await page.getByRole('button', { name: 'Gönder', exact: true }).click();
}

test('Beş Harf daily guesses survive reload; I/İ and return-link keyboard work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page).toHaveTitle('Beş Harf — Defterde');
  await page.keyboard.press('i');
  await page.keyboard.press('I');
  await expect
    .poll(() => page.evaluate(() => (window as any).BH.akis.giris.join('')))
    .toBe('İI');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await typeWord(page, 'KALEM');
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).BH.akis.durum.tahminler.length),
    )
    .toBe(1);
  const saved = await page.evaluate(() => localStorage.getItem('bh-gun'));
  await page.reload();
  await page.waitForFunction(() => (window as any).BH?.hazir);
  expect(await page.evaluate(() => localStorage.getItem('bh-gun'))).toBe(saved);
  expect(
    await page.evaluate(() => (window as any).BH.akis.durum.tahminler.length),
  ).toBe(1);
  await page.locator('.defterde-donus').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.discovery-game')).toHaveCount(20);
  // SSR renders the catalog before its search handlers are attached.
  await expect(
    page.getByRole('button', { name: 'Bana bir oyun seç' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('bes harf');
  await expect(page.locator('.discovery-game:visible')).toHaveCount(1);
  await expect(page.locator('.discovery-game:visible')).toHaveAttribute(
    'href',
    '/oyunlar/besharf/',
  );
  expect(errors).toEqual([]);
});

test('Beş Harf friend link stays in game subdirectory, shared word wins, free and duel open', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.locator('#k-serbest').click();
  await page.locator('#se-arkadas').click();
  await page.getByLabel('Gönderilecek kelime').fill('KALEM');
  await page.getByRole('button', { name: 'Link oluştur', exact: true }).click();
  const link = await page.locator('.link-kutusu').textContent();
  expect(link).toContain('/oyunlar/besharf/#k=');
  // A recipient opens the shared link in a fresh document.
  await page.goto('about:blank');
  await page.goto(link!);
  await page.waitForFunction(
    () => (window as any).BH?.modlar?.aktif === 'arkadas',
  );
  await typeWord(page, 'KALEM');
  await expect
    .poll(() => page.evaluate(() => (window as any).BH.akis.durum.sonuc))
    .toBe('kazandi');
  await page.locator('#k-gunun').click();
  await page.locator('#k-serbest').click();
  await page.locator('#se-rastgele').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).BH.modlar.aktif))
    .toBe('serbest');
  await page.locator('#k-duello').click();
  await expect(page.locator('#not')).toBeVisible();
  await expect(page.locator('#not')).toHaveAttribute('aria-label', 'Düello');
  await page.locator('#du-basla').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).BH.modlar.aktif))
    .toBe('duello');
  await typeWord(page, 'KALEM');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).BH.duello.mac.bilgisayar.satirlar.length,
      ),
    )
    .toBe(1);
  expect(errors).toEqual([]);
});

test('Beş Harf layout and settings remain usable on narrow and short screens', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() => page.evaluate(() => (window as any).BH.sahne.olcu.vw))
      .toBe(width);
    await expect
      .poll(() =>
        page
          .locator('.sayfa')
          .evaluate((el) => el.getBoundingClientRect().width),
      )
      .toBeLessThanOrEqual(width);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await expect(page.locator('.defterde-donus')).toBeInViewport();
    await page.locator('#k-ayarlar').click();
    await expect(page.locator('#not')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#klavye')).toBeVisible();
    if (info.project.name === 'chromium')
      await page.screenshot({
        path: info.outputPath(`besharf-${width}.png`),
        fullPage: true,
      });
  }
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.defterde-donus')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Beş Harf runtime and guides are available; development files are private', async ({
  page,
  request,
}) => {
  const response = await request.get('/oyunlar/besharf/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  for (const m of html.matchAll(/(?:src|href)="([^"?]+)\?v=([a-f0-9]+)"/g)) {
    expect(m[2]).toHaveLength(8);
    expect((await request.get('/oyunlar/besharf/' + m[1])).status()).toBe(200);
  }
  for (const path of [
    'test/game.test.js',
    'README.md',
    'scripts/kelimeler.mjs',
    'ham/raw.txt',
    '.git/config',
  ])
    expect([403, 404]).toContain(
      (await request.get('/oyunlar/besharf/' + path)).status(),
    );
  for (const path of [
    '/nasil-oynanir/besharf/',
    '/assets/drawings/besharf.svg',
    '/assets/licenses/besharf-kaynaklar.txt',
    '/assets/licenses/besharf-veriler.txt',
  ])
    expect((await request.get(path)).status()).toBe(200);
  await page.goto('/nasil-oynanir/besharf/');
  await page.locator('.ink-button[href="/oyunlar/besharf/"]').click();
  await page.waitForFunction(() => (window as any).BH?.hazir);
  await expect(page.locator('#not')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('changing modes during a result animation keeps the new keyboard usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/oyunlar/besharf/#k=nh97on'); // KALEM friend link.
  await page.waitForFunction(() => (window as any).BH?.hazir);
  await typeWord(page, 'KALEM');
  await expect
    .poll(() => page.evaluate(() => (window as any).BH.akis.durum.sonuc))
    .toBe('kazandi');
  await page.locator('#k-serbest').click();
  await page.locator('#se-rastgele').click();
  // The old reveal and paper-extension timers must have had time to finish.
  await page.waitForTimeout(1600);
  await expect(page.locator('#klavye')).toBeVisible();
  expect(await page.locator('#kagit').evaluate((el) => el.clientHeight)).toBe(
    await page.evaluate(() => (window as any).BH.sahne.olcu.kagitH),
  );
  await typeWord(page, 'KALEM');
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).BH.akis.durum.tahminler.length),
    )
    .toBe(1);
  expect(await page.evaluate(() => (window as any).BH.modlar.aktif)).toBe(
    'serbest',
  );
});
