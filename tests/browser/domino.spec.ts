import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript((settings) => {
    localStorage.setItem(
      'domino-defterde-settings',
      JSON.stringify({
        mode: 'computer',
        difficulty: 'medium',
        target: 0,
        ...settings,
      }),
    );
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: Uint32Array) => {
        array.fill(3);
        return array;
      },
    });
  }, settings);
  await page.goto('/oyunlar/domino/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#setup')).not.toBeVisible();
}
async function finishHand(page: Page) {
  for (let turn = 0; turn < 100; turn++) {
    if (await page.locator('#result').isVisible()) return;
    if (await page.locator('#handover').isVisible()) {
      await expect(page.locator('#hand button')).toHaveCount(0);
      await expect(page.locator('#opponent-tiles svg')).toHaveCount(0);
      await page.locator('#ready').click();
    }
    await page.waitForFunction(
      () => !document.querySelector('main[aria-busy="true"]'),
    );
    if (await page.locator('#result').isVisible()) return;
    const playable = page.locator('#hand button[aria-disabled="false"]');
    if (await playable.count()) {
      if (await page.locator('#play').isDisabled()) {
        if (!(await page.locator('#hand button[aria-pressed="true"]').count()))
          await playable.first().click();
        if (await page.locator('#play').isDisabled())
          await page.locator('.end-point:not(:disabled)').first().click();
      }
      await page.locator('#play').click();
    } else if (await page.locator('#draw').isEnabled()) {
      await page.locator('#draw').click();
    } else {
      await page.waitForFunction(
        () =>
          document.querySelector('#handover[open]') ||
          !document.querySelector('#result[hidden]') ||
          document.querySelector('#hand button[aria-disabled="false"]') ||
          !document.querySelector('#draw[disabled]'),
      );
    }
  }
  throw new Error('Hand did not finish within 100 actions');
}

for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [320, 740],
  [844, 390],
])
  test(`Domino fits ${width}×${height} with working settings, help and return`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const badResponses: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) badResponses.push(r.url());
    });
    await page.setViewportSize({ width, height });
    await open(page);
    await expect(page.locator('#hand button').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await expect(page.locator('.back-link')).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath(`domino-${width}.png`),
      fullPage: true,
    });
    await page.locator('#settings-open').click();
    await expect(page.locator('#setup')).toBeVisible();
    await page.getByRole('radio', { name: 'Aynı cihazda iki kişi' }).check();
    await expect(page.locator('#difficulty-label')).toBeHidden();
    await page.locator('#setup-cancel').click();
    await page.locator('#help-open').click();
    await expect(page.locator('#help')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.back-link')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await page.locator('.back-link').click();
    await expect(page.locator('.discovery-game')).toHaveCount(20);
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
  });

for (const difficulty of ['easy', 'medium', 'hard'])
  test(`Domino ${difficulty} completes a hand with correct result and no console errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, { difficulty });
    await finishHand(page);
    await expect(page.locator('#result-title')).not.toBeEmpty();
    await expect(page.locator('#announcement')).toContainText(
      await page.locator('#result-title').innerText(),
    );
    await expect(page.locator('#next-round')).toBeHidden();
    await page.locator('#result-new').click();
    await expect(page.locator('#result')).toBeHidden();
    expect(errors).toEqual([]);
  });

test('Domino local play keeps hands private, supports keyboard selection and advances a scored match', async ({
  page,
}) => {
  await open(page, { mode: 'local', target: 50, names: ['Deniz', 'Ece'] });
  await expect(page.locator('#handover')).toBeVisible();
  await expect(page.locator('#hand button')).toHaveCount(0);
  await page.locator('#ready').click();
  const first = page.locator('#hand button').first();
  await first.focus();
  await page.keyboard.press('End');
  await expect(page.locator('#hand button').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await finishHand(page);
  await expect(page.locator('#next-round')).toBeVisible();
  const score = await page.locator('.score-number').allTextContents();
  await page.locator('#next-round').click();
  await expect(page.locator('#handover')).toBeVisible();
  await expect(page.locator('#target')).toContainText('2. el');
  expect(await page.locator('.score-number').allTextContents()).toEqual(score);
});

test('Domino remains playable with denied storage, and only runtime files are public', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    }),
  );
  await page.goto('/oyunlar/domino/');
  await expect(page.locator('#hand button').first()).toBeVisible();
  await page.locator('#settings-open').click();
  await page.getByRole('radio', { name: 'Zor', exact: true }).check();
  await page.getByRole('button', { name: 'Yeni maça başla' }).click();
  await expect(page.locator('#settings-note')).toContainText('Zor');
  expect(errors).toEqual([]);
  for (const path of [
    'README.md',
    'tests/offline.test.js',
    'tests/blocked-hand.html',
    'docs/verification.md',
    '.git/config',
  ])
    expect([403, 404]).toContain(
      (await request.get('/oyunlar/domino/' + path)).status(),
    );
  for (const path of [
    '/nasil-oynanir/domino/',
    '/assets/drawings/domino.svg',
    '/assets/licenses/domino-kaynaklar.txt',
  ])
    expect((await request.get(path)).status()).toBe(200);
});
