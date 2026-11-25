import { test, expect, type Page } from '@playwright/test';
async function open(page: Page, slug: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/oyunlar/${slug}/`, { waitUntil: 'domcontentloaded' });
}
async function sound(page: Page, id = '#ses-dugme') {
  const button = page.locator(id);
  const before = await button.getAttribute('aria-pressed');
  await button.click();
  await expect(button).not.toHaveAttribute('aria-pressed', before || 'false');
}
async function rotate(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 1440, height: 900 });
}
test('Amiral Battı: placement, rotation, readiness, first shot and settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'amiralbatti');
  await page.waitForFunction(
    () =>
      (window as any).AB?.durum?.tahta?.ben && !(window as any).AB.durum.kilit,
  );
  const ship = page.locator('#tahta-ben .tutamak').first();
  await ship.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('r');
  await expect(page.locator('#duyuru')).toContainText(/yatay|dikey/);
  await page.keyboard.press('Escape');
  await page.locator('#yeniden-diz').click();
  await expect(page.locator('#hazir')).toBeEnabled();
  await page.locator('#hazir').click();
  await page.locator('#tahta-rakip .hucre').first().click();
  await page.waitForFunction(() => (window as any).AB.durum.atis.ben === 1);
  await sound(page);
  await rotate(page);
  await page.reload();
  await expect(page.locator('#hazir')).toBeEnabled();
  expect(errors).toEqual([]);
});
test('Alan Kapmaca: dice, multiplication, rectangle placement and next turn', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'alankapmaca');
  await page.waitForFunction(
    () => (window as any).AB?.durum?.hazir && !(window as any).AB.durum.kilit,
  );
  await page.locator('#zar-a').click();
  await page.waitForFunction(
    () =>
      (window as any).AB.durum.hesaplaniyor && !(window as any).AB.durum.kilit,
  );
  const product = await page.evaluate(() => {
    const d = (window as any).AB.durum.oyun;
    return d.zar.a * d.zar.b;
  });
  await page.locator('#giris').fill(String(product));
  await page.locator('#tamam').click();
  await page.waitForFunction(
    () =>
      (window as any).AB.durum.yerlesiyor && !(window as any).AB.durum.kilit,
  );
  const box = (await page.locator('#tahta').boundingBox())!;
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 4);
  await page.waitForFunction(() =>
    (window as any).AB.durum.oyun.dikdortgenler.some(
      (r: any) => r.sahip === 'ben',
    ),
  );
  expect(
    await page.evaluate(() => (window as any).AB.durum.oyun.puan.ben),
  ).toBe(product);
  await page.waitForFunction(
    () =>
      (window as any).AB.durum.oyun.tur > 1 && !(window as any).AB.durum.kilit,
  );
  await sound(page);
  await rotate(page);
  await page.reload();
  await expect(page.locator('#zar-a')).toBeVisible();
  expect(errors).toEqual([]);
});
test('Kağıt Futbolu: direction button, settings, pitch rotation and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'kagitfutbolu');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => (window as any).KF?.durum?.d && !(window as any).KF.durum.kilit,
  );
  await page.locator('#taktik').click();
  await expect(page.locator('#taktik-notu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#yonler button:enabled').first().click();
  await page.waitForFunction(
    () =>
      (window as any).KF.durum.gecmis.length > 0 &&
      !(window as any).KF.durum.kilit,
  );
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).KF.durum.gecmis),
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() =>
      page.evaluate(() => JSON.stringify((window as any).KF.durum.gecmis)),
    )
    .toBe(before);
  await sound(page);
  await page.reload();
  await expect(page.locator('#saha')).toBeVisible();
  expect(errors).toEqual([]);
});
test('SOS: several moves, saved board, turn and history after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'sos');
  await page.waitForFunction(
    () => (window as any).SOS?.durum && !(window as any).SOS.durum.kilit,
  );
  for (let n = 0; n < 3; n++) {
    await page.locator('.hucre[aria-disabled="false"]').first().click();
    await page.waitForFunction(
      () =>
        !(window as any).SOS.durum.kilit && !(window as any).SOS.durum.gecis,
    );
  }
  const state = () =>
    page.evaluate(() =>
      JSON.stringify({
        d: (window as any).SOS.durum.durum,
        h: (window as any).SOS.durum.gecmis,
      }),
    );
  const before = await state();
  await page.reload();
  await page.waitForFunction(
    () => (window as any).SOS?.durum && !(window as any).SOS.durum.kilit,
  );
  expect(await state()).toBe(before);
  await sound(page);
  await rotate(page);
  expect(await state()).toBe(before);
  expect(errors).toEqual([]);
});
test('Kağıt Hangar: hash, JSON, folding, naming, flight, hangar, share and print', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    jsons: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/tasarimlar/') && r.status() === 200)
      jsons.push(r.url());
  });
  await open(page, 'kagithangar');
  await page.goto('/oyunlar/kagithangar?test=1#/katalog');
  await expect(page).toHaveURL(/kagithangar\/\?test=1#\/katalog$/);
  await expect(page.locator('#kart-ok')).toBeVisible();
  await page.reload();
  await page.locator('#kart-ok').click();
  await page.locator('#mod-izle').click();
  for (let n = 0; n < 20; n++) {
    if (await page.locator('#son-adlandir').isVisible()) break;
    await page.locator('#adim-katla').click();
  }
  await page.locator('#son-adlandir').click();
  await page.locator('#ucak-adi').fill('Defter denemesi');
  await page.locator('#ucak-adi').blur();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('kagithangar.v1')))
    .toContain('Defter denemesi');
  await page.locator('#kalem-kirmizi').click();
  // Upstream 5f2b7fd fixes a ReferenceError when drawing a paperclip.
  await page.locator('#ayar-atac-2').click();
  await expect(page.locator('.onizleme .atac')).toHaveCount(2);
  await page.locator('#isim-bicim-cizgili').click();
  await page.locator('#isim-renk-yesil').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(
          localStorage.getItem('kagithangar.v1') || '{}',
        );
        return state.ucaklar?.[0]?.isimStili;
      }),
    )
    .toMatchObject({ bicim: 'cizgili', renk: 'yesil' });
  await page.locator('#uc-firca').click();
  await page.locator('#gor-on').click();
  const paper = page.locator('.duz-svg');
  await paper.scrollIntoViewIfNeeded();
  const paperBox = (await paper.boundingBox())!;
  await page.mouse.move(
    paperBox.x + paperBox.width * 0.4,
    paperBox.y + paperBox.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    paperBox.x + paperBox.width * 0.6,
    paperBox.y + paperBox.height * 0.5,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(
          localStorage.getItem('kagithangar.v1') || '{}',
        );
        return state.ucaklar?.[0]?.boya.cizgiler.some(
          (line: any) =>
            line.firca && line.renk === 'kirmizi' && line.noktalar.length > 1,
        );
      }),
    )
    .toBe(true);
  await page.locator('#adlandir-ucur').click();
  const flight = page.url();
  await expect(page.locator('canvas[tabindex]')).toBeVisible();
  await expect(page.locator('main > .defterde-donus')).toBeHidden();
  await page.locator('canvas[tabindex]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem('kagithangar.v1') || '{}');
    return s.ucaklar?.some((u: any) => u.istatistik.ucus > 0);
  });
  await page.locator('#fis-hangar').click();
  await expect(page.locator('main > .defterde-donus')).toBeVisible();
  await expect(page.locator('.askili')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.askili')).toHaveCount(1);
  await page.locator('.askili').click();
  await page.locator('#fis-yazdir').click();
  await expect(page.locator('#yazdir-bas')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({
    path: test.info().outputPath('hangar-print.png'),
    fullPage: true,
  });
  await page.emulateMedia({ media: 'screen' });
  const id = flight.split('#/uc/')[1].split('/')[0];
  await page.goto(`/oyunlar/kagithangar/#/notla/${id}`);
  await page.locator('#not-metni').fill('Bir sayfa aç.');
  await page.locator('#not-katla').click();
  const share = page.getByRole('textbox', { name: 'Not bağlantısı' });
  await expect(share).toBeVisible();
  const link = await share.inputValue();
  expect(link).toContain('/oyunlar/kagithangar/#/not/');
  await page.goto(link);
  await expect(page.locator('main')).toBeVisible();
  await page.goto('/oyunlar/kagithangar/#/hangar');
  await rotate(page);
  expect(jsons.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test('Adam Asmaca: five modes, Turkish I/İ, daily save and local statistics', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'adamasmaca');
  await expect(page.locator('#basla')).toBeVisible();
  for (const mod of ['tek', 'okul', 'hileci', 'maraton']) {
    await page.locator(`[data-grup="mod"][data-deger="${mod}"]`).click();
    await page.locator('#basla').click();
    await expect(
      page.locator(mod === 'okul' ? '#s-kart' : '#s-oyun'),
    ).toBeVisible();
    if (mod === 'tek') {
      await page.keyboard.press('i');
      await page.locator('[data-harf="I"]').click();
      await expect(page.locator('[data-harf="İ"]')).toBeDisabled();
      await expect(page.locator('[data-harf="I"]')).toBeDisabled();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#s-ic')).toBeVisible();
  }
  await page.locator('[data-grup="mod"][data-deger="gunun"]').click();
  await page.locator('#basla').click();
  await expect(page.locator('#s-oyun')).toBeVisible();
  await page.keyboard.press('a');
  const saved = await page.evaluate(() => localStorage.getItem('aa-gunun'));
  expect(saved).toBeTruthy();
  await page.reload();
  await page.locator('#basla').click();
  await expect(page.locator('#s-oyun')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('aa-gunun'))).toBe(
    saved,
  );
  await sound(page, '#ses-oyun');
  await rotate(page);
  for (let n = 0; n < 29; n++) {
    const letters = page.locator(
      '#alfabe button:enabled:not([aria-disabled="true"])',
    );
    if (!(await letters.count())) break;
    await letters.first().click();
    if (await page.locator('#sonraki').isVisible()) break;
  }
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('aa-istatistik')))
    .toBeTruthy();
  expect(errors).toEqual([]);
});
