import { test, expect } from '@playwright/test';

const games = [
  'amiralbatti',
  'alankapmaca',
  'kagitfutbolu',
  'sos',
  'kagithangar',
  'adamasmaca',
  'kagitrallisi',
  'dokuztas',
  'xox',
  'noktaoyunu',
  'sayibulma',
  'turkdamasi',
  'kibrit',
  'labirent',
  'kakuro',
  'mangala',
  'nonogram',
  'besharf',
];
const screens = [
  [1440, 900],
  [768, 1024],
  [360, 800],
  [390, 844],
  [844, 390],
];

for (const slug of games)
  test(`${slug}: return link stays clear of the game and opens home`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/oyunlar/${slug}/`);
    await page.waitForFunction((game) => {
      const w = window as any;
      if (game === 'kagithangar') return w.KagitHangar?.sayfa;
      if (game === 'kagitrallisi') return w.KR?.ui?.U?.durum;
      if (game === 'xox') return w.XOX?.ui?.U?.durum && !w.XOX.ui.U.kilit;
      if (game === 'noktaoyunu') return w.NK?.durum?.durum && !w.NK.durum.kilit;
      if (game === 'sayibulma') return w.SB?.ui?.O?.oyun && !w.SB.ui.O.kilit;
      if (game === 'dokuztas') return w.DT?.durum?.durum && !w.DT.durum.kilit;
      if (game === 'turkdamasi')
        return (
          document.documentElement.dataset.hazir === 'true' &&
          !w.TD.ui.read().busy
        );
      if (game === 'kakuro')
        return document.querySelector('#board .cell-button');
      if (game === 'domino') return document.querySelector('#hand .hand-tile');
      if (game === 'besharf') return w.BH?.hazir;
      if (game === 'nonogram') return w.KK_HAZIR;
      if (game === 'mangala')
        return w.Mangala?.app && w.Mangala.app.activity() === 'idle';
      if (game === 'labirent') return w.LB?.hazir;
      if (game === 'kibrit') return w.KB?.hazir;
      if (game === 'sos') return w.SOS?.durum && !w.SOS.durum.kilit;
      if (game === 'kagitfutbolu') return w.KF?.durum?.d && !w.KF.durum.kilit;
      if (game === 'amiralbatti')
        return w.AB?.durum?.tahta?.ben && !w.AB.durum.kilit;
      if (game === 'alankapmaca')
        return w.AB?.durum?.hazir && !w.AB.durum.kilit;
      return document.querySelector('#basla:not([disabled])');
    }, slug);
    await page.evaluate(() => document.fonts.ready);
    const link = page.locator('main > .defterde-donus');
    await expect(link).toHaveAttribute('href', '/');
    await expect(link).toHaveText('← İçindekiler');
    for (const [width, height] of screens) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      // Adam Asmaca debounces its responsive layout by 150 ms.
      if (slug === 'adamasmaca' || slug === 'besharf')
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width + 1);
      await expect(link).toBeInViewport();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const a = document.querySelector<HTMLElement>(
              'main > .defterde-donus',
            )!;
            // Compare in paper coordinates; the original paper can be tilted.
            return -(a.offsetTop + a.offsetHeight);
          }),
        )
        .toBeGreaterThanOrEqual(0);
      const box = (await link.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      // Firefox can report a 44 px box as 43.999999 px.
      expect(box.height).toBeGreaterThanOrEqual(44 - 0.01);
      expect(box.width).toBeGreaterThanOrEqual(44 - 0.01);
      // Check this addition's bounds; the original games own their canvas sizing.
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expect(link).toBeVisible();
      if (
        test.info().project.name === 'chromium' &&
        [1440, 390].includes(width)
      )
        await page.screenshot({
          path: test.info().outputPath(`${slug}-${width}.png`),
          fullPage: true,
        });
    }
    await page.emulateMedia({ media: 'print' });
    await expect(link).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none');
    await link.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.discovery-game')).toHaveCount(20);
    expect(errors).toEqual([]);
  });

test('direct entry returns home with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    for (const slug of games) {
      await page.goto(`/oyunlar/${slug}/`);
      await page.locator('main > .defterde-donus').click();
      await expect(page.locator('.discovery-game')).toHaveCount(20);
    }
  } finally {
    await context.close();
  }
});
