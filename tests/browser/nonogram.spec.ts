import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash = '') {
  await page.goto('/oyunlar/nonogram/' + hash);
  await page.waitForFunction(() => (window as any).KK_HAZIR);
  await page.evaluate(() => document.fonts.ready);
}
const state = (page: Page) =>
  page.evaluate(() => Array.from((window as any).KK.oyun.d));

test('nonogram saves pencil marks, undo and redo, completes a picture, and returns by keyboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.locator('.defter-karti')).toHaveCount(9);
  await page.getByRole('button', { name: /^Mutfak defteri/ }).click();
  await page.locator('.resim-karti').first().click();
  const id = await page.evaluate(() => (window as any).KK.oyun.resim.id);
  const initial = await state(page);
  await page.locator('#tahta').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  const marked = await state(page);
  expect(marked).not.toEqual(initial);
  await page.locator('#k-geri').click();
  expect(await state(page)).toEqual(initial);
  await page.locator('#k-yinele').click();
  expect(await state(page)).toEqual(marked);
  // Leaving through the album flushes the save before reloading the deep link.
  await page.locator('#k-album').click();
  await open(page, '#resim=' + id);
  expect(await state(page)).toEqual(marked);
  const solution = await page.evaluate(() => {
    const O = (window as any).KK.oyun;
    return {
      en: O.b.en,
      boy: O.b.boy,
      cells: Array.from(O.b.cozum) as number[],
    };
  });
  await page.locator('#tahta').focus();
  await page.keyboard.press('ArrowRight');
  for (let r = 0; r < solution.boy; r++) {
    for (let c = 0; c < solution.en; c++) {
      await page.keyboard.press(
        solution.cells[r * solution.en + c] ? 'Delete' : 'x',
      );
      if (solution.cells[r * solution.en + c])
        await page.keyboard.press('Space');
      if (c < solution.en - 1) await page.keyboard.press('ArrowRight');
    }
    if (r < solution.boy - 1) {
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
    }
  }
  await expect
    .poll(() => page.evaluate(() => (window as any).KK.oyun.bitti))
    .toBe(true);
  await expect(page.locator('#bitis-karti')).toBeVisible();
  await page.locator('.defterde-donus').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await expect(page.locator('.discovery-game')).toHaveCount(20);
  // The server renders the catalog before the search handlers are ready.
  await expect(
    page.getByRole('button', { name: 'Bana bir oyun seç' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('nonogram');
  await expect(page.locator('.discovery-games > li:not([hidden])')).toHaveCount(
    1,
  );
  await page.getByRole('radio', { name: 'Birlikte', exact: true }).check();
  await expect(page.locator('.discovery-games > li:not([hidden])')).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test('nonogram daily, kilim, custom editor and compact layouts load without errors', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Cloudflare injects optional analytics in production; its DNS may be
    // unavailable in the test environment. Keep all game errors actionable.
    if (
      m.type() === 'error' &&
      !m.location().url.startsWith('https://static.cloudflareinsights.com/')
    )
      errors.push(m.text());
  });
  await open(page, '#resim=vapur');
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [360, 740],
    [320, 740],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const link = page.locator('.defterde-donus');
    await expect(link).toBeInViewport();
    await expect
      .poll(async () => (await link.boundingBox())!.y)
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.locator('#k-ayarlar').click();
    await expect(page.locator('#ayarlar')).toBeInViewport();
    await page.locator('#ayarlar .kapat').click();
    await link.scrollIntoViewIfNeeded();
    if (info.project.name === 'chromium')
      await page.screenshot({
        path: info.outputPath(`nonogram-${width}.png`),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '#gunluk');
  await expect(page.locator('#bulmaca-adi')).toContainText('Günün karalaması');
  await open(page, '#kilim=15.214');
  await expect
    .poll(() => page.evaluate(() => (window as any).KK.oyun.resim.tur))
    .toBe('kilim');
  await page.locator('#k-ipucu').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).KK.oyun.ipucu))
    .toBeGreaterThan(0);
  await open(page);
  await page
    .getByRole('button', { name: 'Kendi resmini yap', exact: true })
    .click();
  await expect(page.locator('.kendi-tuval')).toBeVisible();
  await page.getByLabel('resmin adı:').fill('Deneme');
  await page.reload();
  await page.waitForFunction(() => (window as any).KK_HAZIR);
  await page
    .getByRole('button', { name: 'Kendi resmini yap', exact: true })
    .click();
  await expect(page.getByLabel('resmin adı:')).toHaveValue('Deneme');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.defterde-donus')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('padding', '0px');
  expect(errors).toEqual([]);
});

test('nonogram runtime is versioned, source files stay private and guide links to game', async ({
  page,
  request,
}) => {
  await open(page);
  const urls = await page
    .locator('script[src],link[rel=stylesheet]')
    .evaluateAll((nodes) =>
      nodes
        .map(
          (e) =>
            new URL(
              e.getAttribute('src') || e.getAttribute('href')!,
              document.baseURI,
            ),
        )
        // CDN-injected analytics are not part of the game's runtime manifest.
        .filter((url) => url.origin === location.origin)
        .map((url) => url.href),
    );
  expect(urls.length).toBeGreaterThan(40);
  for (const url of urls) expect(url).toMatch(/\?v=[a-f0-9]{12}$/);
  for (const path of [
    'test/model.test.js',
    'scripts/resimler.mjs',
    'tools/atolye.html',
    'README.md',
    'PLAN.md',
    '.claude/serve.js',
  ]) {
    expect((await request.get('/oyunlar/nonogram/' + path)).status()).toBe(
      path.startsWith('.') ? 403 : 404,
    );
  }
  await page.goto('/nasil-oynanir/nonogram/');
  await expect(page.locator('main h1')).toContainText('Kare Karalamaca');
  await expect(
    page.locator('.ink-button[href="/oyunlar/nonogram/"]'),
  ).toBeVisible();
});

test('nonogram touch cycles a square without shifting the notebook', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await open(page);
    await page.getByRole('button', { name: /^Mutfak defteri/ }).click();
    await page.locator('.resim-karti').first().click();
    const point = await page.evaluate(() => {
      const O = (window as any).KK.oyun,
        t = (window as any).KK.tahta;
      const i = Array.from(O.d).findIndex((v, k) => !v && !O.kilit[k]);
      const cv = document.querySelector<HTMLCanvasElement>('#tahta')!;
      const r = cv.getBoundingClientRect(),
        m = new DOMMatrix(
          getComputedStyle(document.querySelector('#defter')!).transform,
        );
      const x =
        t.kam.tx + ((i % O.b.en) + 0.5) * t.G.b * t.kam.s - cv.offsetWidth / 2;
      const y =
        t.kam.ty +
        (Math.floor(i / O.b.en) + 0.5) * t.G.b * t.kam.s -
        cv.offsetHeight / 2;
      return {
        i,
        x: r.left + r.width / 2 + m.a * x + m.c * y,
        y: r.top + r.height / 2 + m.b * x + m.d * y,
      };
    });
    for (const value of [1, 2, 0]) {
      await page.touchscreen.tap(point.x, point.y);
      await expect
        .poll(() => page.evaluate((i) => (window as any).KK.oyun.d[i], point.i))
        .toBe(value);
    }
    await expect(page.locator('.defterde-donus')).toBeInViewport();
  } finally {
    await context.close();
  }
});
