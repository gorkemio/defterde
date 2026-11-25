import { test, expect } from '@playwright/test';

test.use({ userAgent: 'DefterdeDeployHealthCheck' });

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`Sayı Bulma: onboarding, keypad and return at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewportSize(viewport);
    await page.goto('/oyunlar/sayibulma/');
    await page.waitForFunction(
      () => (window as any).SB?.ui?.O && !(window as any).SB.ui.O.kilit,
    );
    await expect(page.locator('#tuslar')).toBeVisible();
    await expect(page.locator('[data-not="rehber1"]')).toContainText(
      '4 haneli sayıyı bul',
    );
    await expect(page.locator('.imlec')).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const back = page.getByRole('link', { name: '← İçindekiler' });
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page
        .locator('#sayfa')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(251, 249, 242)');
    const keys = page.locator('#tuslar');
    for (const digit of ['1', '2', '3', '4'])
      await keys.getByRole('button', { name: digit, exact: true }).click();
    await expect(page.locator('.imlec')).toHaveCount(0);
    await keys.getByRole('button', { name: 'tahmin', exact: true }).click();
    await expect(page.locator('#satir-metni li')).toHaveCount(1);
    await expect(page.locator('#satir-metni')).toContainText('1 2 3 4');
    await expect(page.locator('.imlec')).toHaveCount(1);
    await expect(page.locator('[data-not="rehber1"]')).toHaveCount(0);
    await page.keyboard.type('5678');
    await page.keyboard.press('Enter');
    await expect(page.locator('#satir-metni li')).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath('game.png'),
      fullPage: true,
    });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');
    expect(errors).toEqual([]);
  });
}

test('Sayı Bulma: reduced motion keeps the input cursor still', async ({
  page,
}) => {
  await page.goto('/oyunlar/sayibulma/');
  await expect(page.locator('.imlec')).toHaveCount(1);
  expect(
    await page.locator('.imlec').evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});

async function numberGameReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => (window as any).SB?.ui?.O?.oyun && !(window as any).SB.ui.O.kilit,
  );
}

async function numberSetting(
  page: import('@playwright/test').Page,
  name: string,
  value: string,
) {
  await page.locator('#ayarlar-ac').click();
  await page.locator(`[data-ayar="${name}"][data-deger="${value}"]`).click();
  if (await page.locator('#ayarlar-kapat').isVisible())
    await page.locator('#ayarlar-kapat').click();
  await numberGameReady(page);
}

test('Sayı Bulma: repeated defaults, explicit preferences and fixed daily rules', async ({
  page,
}) => {
  await page.goto('/oyunlar/sayibulma/');
  await numberGameReady(page);
  await expect(page.locator('[data-not="rehber2"]')).toContainText(
    'rakamlar tekrar edebilir',
  );
  for (const digit of ['5', '7', '5', '5'])
    await page
      .locator('#tuslar')
      .getByRole('button', { name: digit, exact: true })
      .click();
  await page
    .locator('#tuslar')
    .getByRole('button', { name: 'tahmin', exact: true })
    .click();
  await expect(page.locator('#satir-metni')).toContainText('5 7 5 5');
  await page.locator('#yeni').click();
  await numberGameReady(page);
  await numberSetting(page, 'tekrar', 'hayir');
  await page.reload();
  await numberGameReady(page);
  await expect(page.locator('[data-not="rehber2"]')).toContainText(
    'rakamları hep farklı',
  );
  await page
    .locator('#tuslar')
    .getByRole('button', { name: '5', exact: true })
    .click();
  await expect(
    page.locator('#tuslar').getByRole('button', { name: '5', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.locator('#tuslar [data-tus="sil"]').click();
  await numberSetting(page, 'tekrar', 'evet');
  await numberSetting(page, 'mod', 'gunun');
  expect(
    await page.evaluate(() => (window as any).SB.ui.O.oyun.ayar),
  ).toMatchObject({ hane: 4, tekrar: false, sifirBaslar: false });
  await page.reload();
  await numberGameReady(page);
  expect(
    await page.evaluate(() => (window as any).SB.ui.O.oyun.ayar.tekrar),
  ).toBe(false);
  await numberSetting(page, 'mod', 'senbul');
  await expect(page.locator('[data-not="rehber2"]')).toContainText(
    'rakamlar tekrar edebilir',
  );
});

test('Sayı Bulma: legacy automatic number settings adopt the new default', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'sb-ayar',
      JSON.stringify({
        mod: 'senbul',
        zorluk: 'orta',
        cizelge: 'elle',
        cizelgeAcik: false,
        sayi: { hane: 4, tekrar: false, sifirBaslar: false },
      }),
    ),
  );
  await page.goto('/oyunlar/sayibulma/');
  await numberGameReady(page);
  await expect(page.locator('[data-not="rehber2"]')).toContainText(
    'rakamlar tekrar edebilir',
  );
  expect(await page.evaluate(() => (window as any).SB.ui.O.ayar.zorluk)).toBe(
    'orta',
  );
  await expect(page.locator('#cizelge-ac')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('Sayı Bulma: settings and help stay below instructions in narrow and wide layouts', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/oyunlar/sayibulma/');
  await numberGameReady(page);
  for (const mode of ['senbul', 'obulsun']) {
    if (mode === 'obulsun') {
      await numberSetting(page, 'hane', '5');
      await numberSetting(page, 'mod', 'obulsun');
    }
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 1024],
      [1440, 900],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      for (const [opener, panel, closer] of [
        ['#ayarlar-ac', '#ayarlar', '#ayarlar-kapat'],
        ['#nasil', '#nasil-not', '#nasil-kapat'],
      ]) {
        await page.locator(opener).click();
        await expect(page.locator(panel)).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              ({ panel, mode }) => {
                const notes =
                  mode === 'obulsun'
                    ? [document.querySelector('#basla-not')!]
                    : Array.from(
                        document.querySelectorAll('[data-not^="rehber"]'),
                      );
                const bottom = Math.max(
                  ...notes.map((el) => el.getBoundingClientRect().bottom),
                );
                return (
                  document.querySelector(panel)!.getBoundingClientRect().top -
                  bottom
                );
              },
              { panel, mode },
            ),
          )
          .toBeGreaterThanOrEqual(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        if (width === 390 && panel === '#ayarlar')
          await page.screenshot({
            path: testInfo.outputPath(`${mode}-settings.png`),
            fullPage: true,
          });
        await page.locator(closer).click();
      }
    }
  }
  expect(errors).toEqual([]);
});
