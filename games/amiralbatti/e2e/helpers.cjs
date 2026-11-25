const { expect } = require('@playwright/test');

async function openGame(page) {
  // The renderer is loaded from the shipped vendor file, just as in production.
  // A blocked web font is a supported, common offline case. Use the real fallback font.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('/');
  await page.waitForFunction(() => window.AB?.durum?.tahta?.ben && !AB.durum.kilit);
}

async function state(page) {
  return page.evaluate(() => {
    const o = AB.durum;
    return {
      jeton: o.jeton, sira: o.sira, atis: o.atis, basladi: o.basladi,
      hazir: o.hazir, duraklat: o.duraklat, secili: o.secili, kilit: o.kilit,
      gemiler: o.tahta.ben.gemiler.map(g => ({ id: g.id, yatay: g.yatay, hucreler: g.hucreler })),
    };
  });
}

async function ready(page) {
  await page.getByRole('button', { name: 'Hazırım', exact: true }).click();
  await expect.poll(async () => (await state(page)).hazir).toBe(true);
}

async function withinViewport(locator, viewport) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box.x, `${locator}: left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${locator}: top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${locator}: right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${locator}: bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
}

async function unshotCell(page, { water = false } = {}) {
  const coordinate = await page.evaluate(waterOnly => {
    const t = AB.durum.tahta.rakip;
    for (let s = 0; s < t.n; s++) {
      for (let k = 0; k < t.n; k++) {
        if (t.atis[s * t.n + k] === 0 && (!waterOnly || t.gemiHaritasi[s * t.n + k] === -1)) return { s, k };
      }
    }
  }, water);
  if (!coordinate) throw new Error('No suitable unshot cell');
  return {
    ...coordinate,
    locator: page.locator(`#tahta-rakip .hucre[data-s="${coordinate.s}"][data-k="${coordinate.k}"]`),
  };
}

module.exports = { openGame, state, ready, withinViewport, unshotCell };
