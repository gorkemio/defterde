import { test, expect, type Page } from '@playwright/test';
const visibleRows = (page: Page) =>
  page.locator('.discovery-games > li:not([hidden])');
const slugs = (page: Page) =>
  visibleRows(page).evaluateAll((rows) =>
    rows.map((row) => (row as HTMLElement).dataset.slug),
  );
async function ready(page: Page, query = '') {
  await page.goto('/' + query);
  await expect(
    page.getByRole('button', { name: 'Bana bir oyun seç' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('discovery layout, accessible targets and resource isolation across viewports', async ({
  page,
}, info) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1000, 900],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await ready(page);
    await expect(visibleRows(page)).toHaveCount(20);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const shown = await page.locator('.discovery-game').evaluateAll(
      (links) =>
        links.filter((link) => {
          const r = link.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        }).length,
    );
    if (width === 1440) expect(shown).toBeGreaterThanOrEqual(6);
    if (width === 390) expect(shown).toBeGreaterThanOrEqual(2);
    const targets = await page
      .locator(
        '.discovery-filters button:visible, .discovery-field input, .discovery-field select, .discovery-player-options label, .discovery-actions a, .discovery-game',
      )
      .evaluateAll((elements) =>
        elements.map((e) => ({
          label: e.textContent,
          height: e.getBoundingClientRect().height,
        })),
      );
    expect(targets.filter((target) => target.height < 44)).toEqual([]);
    if (info.project.name === 'chromium')
      await page.screenshot({
        path: info.outputPath(`discovery-${width}.png`),
        fullPage: true,
      });
  }
  expect(requests.filter((u) => u.includes('/oyunlar/'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('search and filters intersect without navigation, suggestions stay in the results', async ({
  page,
}, info) => {
  await ready(page);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const search = page.getByRole('searchbox', { name: 'Oyun ara' });
  await search.fill('KAGIT');
  await expect(visibleRows(page)).toHaveCount(3);
  await expect(page).toHaveURL(/q=KAGIT/);
  await page.getByLabel('Oyun türü').selectOption('bulmaca');
  await expect(
    page.getByText('Eşleşen oyun yok.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Bana bir oyun seç' }),
  ).toBeDisabled();
  await page.locator('#discovery-empty [data-clear]').click();
  await expect(search).toBeFocused();
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await page.getByLabel('Oyun türü').selectOption('bulmaca');
  await page.getByRole('radio', { name: 'Birlikte', exact: true }).check();
  expect(await slugs(page)).toEqual(['noktaoyunu', 'sayibulma', 'kibrit']);
  let previous = '';
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', { name: 'Bana bir oyun seç' }).click();
    const href = await page.locator('#pick-link').getAttribute('href');
    expect(href).toMatch(/\/oyunlar\/(noktaoyunu|sayibulma|kibrit)\/$/);
    expect(href).not.toBe(previous);
    previous = href!;
  }
  if (info.project.name === 'chromium')
    await page.screenshot({
      path: info.outputPath('suggestion.png'),
      fullPage: true,
    });
  await search.fill('SAYI');
  await expect(page.locator('#discovery-pick')).toBeHidden();
  expect(await slugs(page)).toEqual(['sayibulma']);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Bana bir oyun seç' }).click();
    await expect(page.locator('#pick-link')).toHaveAttribute(
      'href',
      /\/oyunlar\/sayibulma\/$/,
    );
  }
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await page.locator('#pick-link').click();
  await expect(page).toHaveURL(/\/oyunlar\/sayibulma\/$/);
  await page.goBack();
  await expect(search).toHaveValue('SAYI');
  await expect(
    page.getByRole('radio', { name: 'Birlikte', exact: true }),
  ).toBeChecked();
  await expect(visibleRows(page)).toHaveCount(1);
  await page.reload();
  await expect(visibleRows(page)).toHaveCount(1);
  await expect(page.getByLabel('Oyun türü')).toHaveValue('bulmaca');
});

test('GET filtering and native game links work without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(visibleRows(page)).toHaveCount(20);
  await expect(
    page.getByRole('button', { name: 'Bana bir oyun seç' }),
  ).toBeHidden();
  await page.getByRole('searchbox').fill('kagit');
  await page.getByLabel('Oyun türü').selectOption('yaris');
  await page.getByRole('radio', { name: 'Birlikte', exact: true }).check();
  await page.getByRole('button', { name: 'Oyunları göster' }).click();
  expect(await slugs(page)).toEqual(['kagitrallisi']);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('searchbox')).toHaveValue('kagit');
  await visibleRows(page).getByRole('link').click();
  await expect(page).toHaveURL(/\/oyunlar\/kagitrallisi\/$/);
  await context.close();
});

test('old discovery bookmarks keep filters when redirected to the homepage', async ({
  page,
}) => {
  await page.goto('/kesfet/?q=sayi&tur=bulmaca&oyuncu=together#oyunlar');
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page).toHaveURL(
    new URL('/?q=sayi&tur=bulmaca&oyuncu=together#oyunlar', page.url()).href,
  );
  await expect(page.getByRole('searchbox')).toHaveValue('sayi');
  await expect(page.getByLabel('Oyun türü')).toHaveValue('bulmaca');
  await expect(
    page.getByRole('radio', { name: 'Birlikte', exact: true }),
  ).toBeChecked();
  expect(await slugs(page)).toEqual(['sayibulma']);
  await page.locator('.discovery-actions [data-clear]').click();
  await expect(visibleRows(page)).toHaveCount(20);
});

test('keyboard, zoom reflow, reduced motion and homepage metadata', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 720, height: 450 }); // 1440×900 at 200% browser zoom: same CSS viewport.
  await ready(page, '?tur=invalid&oyuncu=online');
  await expect(visibleRows(page)).toHaveCount(20);
  await expect(page.getByLabel('Oyun türü')).toHaveValue('');
  await page.keyboard.press(info.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByText('İçeriğe geç', { exact: true })).toBeFocused();
  await page.getByRole('searchbox').focus();
  await expect(page.getByRole('searchbox')).toHaveCSS(
    'outline-style',
    'dashed',
  );
  await page.keyboard.type('labirent');
  await expect(visibleRows(page)).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(visibleRows(page)).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(720);
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
  await expect(page.locator('meta[name=robots]')).toHaveCount(0);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    new URL('/', page.url()).href,
  );
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(
    '/kesfet/',
  );
  await expect(
    page.getByRole('link', { name: 'Mevcut ana sayfa' }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Defterde ana sayfa', exact: true })
    .click();
  await expect(page.locator('.discovery-game')).toHaveCount(20);
  await expect(page.getByRole('searchbox')).toHaveValue('');
});
