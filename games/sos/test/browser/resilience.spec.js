const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// Seed only a new browser context: reloading must exercise the app's saved values.
async function configure(page, { n = 5, ikiKisi = true, dusunmeMs = 30 } = {}) {
  await page.addInitScript(iki => {
    try {
      if (localStorage.getItem('sos-ayar') === null) {
        localStorage.setItem('sos-ayar', JSON.stringify({ ikiKisi: iki, fazlaTur: true, zorluk: 'orta', ipucu: false }));
      }
    } catch (_) { /* The unavailable-storage test intentionally rejects access. */ }
  }, ikiKisi);
  await page.route('**/config.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text())
      .replace('boyut: 8', `boyut: ${n}`)
      .replace('dusunmeMs: [400, 800]', `dusunmeMs: [${dusunmeMs}, ${dusunmeMs}]`) });
  });
}

async function ready(page) {
  await page.waitForFunction(() => window.SOS?.durum && !SOS.durum.kilit && !SOS.durum.gecis, null, { timeout: 10000 });
}

async function move(page, i, harf = 'S') {
  await page.locator(`#harf-${harf.toLowerCase()}`).click();
  await page.locator(`.hucre[data-i="${i}"]`).click();
  await ready(page);
}

async function position(page) {
  return page.evaluate(() => {
    const o = SOS.durum, d = o.durum;
    return {
      cells: Array.from(d.hucre), owners: Array.from(d.yazan), score: d.puan,
      turn: d.sira, empty: d.bos, finished: d.bitti, selected: o.secili,
      history: o.gecmis.length,
    };
  });
}

test('reload preserves the scored position, selection and undo; a new page stays empty', async ({ page }) => {
  await configure(page);
  await page.goto('/'); await ready(page);
  for (const i of [0, 2, 10, 12]) await move(page, i);
  const beforeScoring = await position(page);
  await move(page, 6, 'O');
  await expect(page.locator('#puan-mavi')).toHaveText('2');
  const scored = await position(page);
  const labels = await page.locator('.hucre').evaluateAll(cells => cells.map(c => c.getAttribute('aria-label')));

  await page.reload(); await ready(page);
  expect(await position(page)).toEqual(scored);
  expect(await page.locator('.hucre').evaluateAll(cells => cells.map(c => c.getAttribute('aria-label')))).toEqual(labels);
  await expect(page.locator('#harf-o')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#puan-mavi')).toHaveText('2');
  await page.locator('#geri-al').click(); await ready(page);
  expect(await position(page)).toEqual({ ...beforeScoring, selected: 'O' });
  await expect(page.locator('#puan-mavi')).toHaveText('0');

  await page.locator('#yeni-sayfa').click(); await ready(page);
  await page.reload(); await ready(page);
  const empty = await position(page);
  expect(empty.empty).toBe(25);
  expect(empty.history).toBe(0);
  expect(empty.score).toEqual([0, 0]);
  await expect(page.locator('#geri-al')).toBeDisabled();
});

test('reload during the computer turn resumes one response and keeps paired undo', async ({ page }) => {
  await configure(page, { ikiKisi: false, dusunmeMs: 1200 });
  await page.goto('/'); await ready(page);
  await page.locator('.hucre[data-i="0"]').click();
  await page.waitForFunction(() => SOS.durum.durum.bos === 24 && SOS.durum.durum.sira === 1);
  await page.reload(); await ready(page);
  expect((await position(page)).empty).toBe(23);
  expect((await position(page)).turn).toBe(0);
  // A second reload of the completed response cannot replay the AI move.
  const answered = await position(page);
  await page.reload(); await ready(page);
  expect(await position(page)).toEqual(answered);
  await page.locator('#geri-al').click(); await ready(page);
  expect((await position(page)).empty).toBe(25);
  await expect(page.locator('#geri-al')).toBeDisabled();
});

test('a completed game restores its result and can be undone after reload', async ({ page }) => {
  await configure(page);
  await page.goto('/'); await ready(page);
  for (let i = 0; i < 25; i++) await move(page, i);
  await expect(page.locator('#duyuru')).toContainText('BERABERE');
  const completed = await position(page);
  await page.reload(); await ready(page);
  expect(await position(page)).toEqual(completed);
  await expect(page.locator('#duyuru')).toContainText('BERABERE');
  await expect(page.locator('#duyuru')).toContainText('Skor: 0 – 0');
  await expect(page.locator('.sonuc')).toBeVisible();
  await page.locator('#geri-al').click(); await ready(page);
  expect((await position(page)).finished).toBe(false);
  expect((await position(page)).empty).toBe(1);
  await expect(page.locator('.hucre[aria-disabled="false"]')).toHaveCount(1);
  await expect(page.locator('.sonuc')).toHaveCount(0);
});

test('corrupt or unavailable storage never prevents a fresh playable board', async ({ browser, baseURL }) => {
  for (const failure of ['corrupt', 'unavailable']) {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(mode => {
        if (mode === 'corrupt') localStorage.setItem('sos-oyun', '{broken JSON');
        else Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } });
      }, failure);
      await configure(page);
      await page.goto('/'); await ready(page);
      expect((await position(page)).empty).toBe(25);
      await move(page, 0);
      expect((await position(page)).empty).toBeLessThan(25);
      await expect(page.locator('#geri-al')).toBeEnabled();
      await page.locator('#geri-al').click(); await ready(page);
      expect((await position(page)).empty).toBe(25);
      expect(errors, failure).toEqual([]);
    } finally { await context.close(); }
  }
});

test('HTTP and file pages load their drawing library and handwriting font without external requests', async ({ browser, baseURL }) => {
  const fileURL = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;
  for (const url of [baseURL, fileURL]) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const external = [];
    await context.route('**/*', route => {
      const requested = new URL(route.request().url());
      if (['http:', 'https:'].includes(requested.protocol) && requested.origin !== baseURL) {
        external.push(requested.href);
        return route.abort();
      }
      return route.continue();
    });
    try {
      await page.goto(url); await ready(page);
      expect(external, url).toEqual([]);
      expect(await page.evaluate(async () => (await document.fonts.load('26px "Patrick Hand"', 'AİŞĞÇÖÜıüöç')).length)).toBeGreaterThan(0);
      await expect(page.getByRole('gridcell')).toHaveCount(64);
      await move(page, 0);
      expect((await position(page)).empty).toBeLessThan(64);
    } finally { await context.close(); }
  }
});

test('fallback text fits desktop buttons and small screens retain 44px controls', async ({ page }) => {
  await page.route(/\.(?:woff2?|ttf|otf)(?:\?|$)|fonts\.googleapis\.com/, route => route.abort());
  await page.setViewportSize({ width: 1024, height: 736 });
  await configure(page, { n: 8 });
  await page.goto('/'); await ready(page);
  await page.addStyleTag({ content: 'body { font-family: sans-serif !important; }' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(page.locator('body')).toHaveAttribute('data-duzen', 'defter');
  const overflow = () => page.locator('.dugmeler button').evaluateAll(buttons => buttons
    .filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent));
  await expect.poll(overflow).toEqual([]);
  for (const [width, height] of [[320, 568], [390, 844], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('body')).toHaveAttribute('data-duzen', width > height ? 'yatay' : 'dikey');
    await expect.poll(overflow).toEqual([]);
    const sizes = await page.locator('.harf-dugme,.dugmeler button,.ayar').evaluateAll(buttons => buttons.map(b => {
      const r = b.getBoundingClientRect(); return { label: b.id || b.textContent, width: r.width, height: r.height };
    }));
    for (const size of sizes) {
      expect(size.width, size.label).toBeGreaterThanOrEqual(43.9);
      expect(size.height, size.label).toBeGreaterThanOrEqual(43.9);
    }
  }
});

test('settings apply on an empty board and explicitly queue during a game', async ({ page }) => {
  await configure(page, { ikiKisi: false });
  await page.goto('/'); await ready(page);
  const mode = page.locator('[data-ayar="ikiKisi"]');
  const extra = page.locator('[data-ayar="fazlaTur"]');
  const easy = page.locator('[data-ayar="zorluk"][data-deger="kolay"]');
  const hard = page.locator('[data-ayar="zorluk"][data-deger="zor"]');
  await mode.click(); await ready(page);
  await extra.click(); await ready(page);
  await easy.click(); await ready(page);
  expect(await page.evaluate(() => SOS.durum.oyunAyar)).toEqual({ ikiKisi: true, fazlaTur: false, zorluk: 'kolay' });
  await expect(page.locator('#yeni-not')).toBeHidden();
  await expect(page.locator('#ad-mavi')).toHaveText('mavi');
  await move(page, 0); await move(page, 1, 'O'); await move(page, 2);
  expect((await position(page)).score).toEqual([1, 0]);
  expect((await position(page)).turn).toBe(1); // Extra turns were switched off before play.
  const active = await position(page);
  await mode.click(); await extra.click(); await hard.click();
  expect(await position(page)).toEqual(active);
  expect(await page.evaluate(() => SOS.durum.oyunAyar)).toEqual({ ikiKisi: true, fazlaTur: false, zorluk: 'kolay' });
  await expect(page.locator('#yeni-not')).toBeVisible();
  await expect(page.locator('#yeni-not')).toContainText('Yeni sayfa');
  for (const changed of [mode, extra, hard]) await expect(changed).toHaveAccessibleDescription(/Yeni sayfa/);

  await page.reload(); await ready(page);
  expect(await position(page)).toEqual(active);
  await expect(page.locator('#yeni-not')).toBeVisible();
  await expect(mode).toHaveAttribute('aria-checked', 'false');
  await expect(hard).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#yeni-sayfa').click(); await ready(page);
  expect(await page.evaluate(() => SOS.durum.oyunAyar)).toEqual({ ikiKisi: false, fazlaTur: true, zorluk: 'zor' });
  await expect(page.locator('#yeni-not')).toBeHidden();
  for (const changed of [mode, extra, hard]) await expect(changed).not.toHaveAccessibleDescription(/Yeni sayfa/);
});
