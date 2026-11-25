const { test, expect } = require('@playwright/test');
const { openGame, state, ready, unshotCell, withinViewport } = require('./helpers.cjs');

test.describe('portrait tablet', () => {
  test.use({ hasTouch: true, viewport: { width: 768, height: 1024 } });

  test('the larger board follows readiness and rotation preserves the fleet and target', async ({ page }) => {
    await openGame(page);
    const before = await state(page);
    const own = await page.locator('#tahta-ben').boundingBox();
    const opponent = await page.locator('#tahta-rakip').boundingBox();
    expect(own.width).toBeGreaterThanOrEqual(528);
    expect(opponent.width).toBeGreaterThanOrEqual(220);
    await ready(page);
    expect((await page.locator('#tahta-rakip').boundingBox()).width).toBe(own.width);
    expect((await page.locator('#tahta-ben').boundingBox()).width).toBe(opponent.width);
    await page.locator('#tahta-rakip .hucre').first().tap();
    const selected = await state(page);
    for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => (await state(page)).secili).toEqual(selected.secili);
      expect((await state(page)).gemiler).toEqual(before.gemiler);
      expect((await state(page)).atis).toEqual({ ben: 0, rakip: 0 });
      for (const selector of ['#tahta-ben', '#tahta-rakip', '#yeni-sayfa', '#sayac-rakip']) {
        await withinViewport(page.locator(selector), viewport);
      }
    }
    await page.getByRole('button', { name: 'Ateş et', exact: true }).tap();
    await expect.poll(async () => (await state(page)).atis.ben).toBe(1);
  });
});

test('preparation requires readiness and remains editable until the first shot', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openGame(page);
  const before = await state(page);
  const inactiveCell = await page.locator('#tahta-rakip .hucre').first().boundingBox();
  await page.mouse.click(inactiveCell.x + inactiveCell.width / 2, inactiveCell.y + inactiveCell.height / 2);
  expect((await state(page)).atis).toEqual({ ben: 0, rakip: 0 });
  expect((await state(page)).hazir).toBe(false);
  await ready(page);
  await page.getByRole('button', { name: 'Düzenle', exact: true }).click();
  expect((await state(page)).hazir).toBe(false);
  expect((await state(page)).gemiler).toEqual(before.gemiler);
  await expect(page.getByRole('button', { name: 'Yeniden diz', exact: true })).toBeEnabled();
  await ready(page);
  const target = await unshotCell(page);
  await target.locator.click();
  await expect.poll(async () => (await state(page)).atis.ben).toBe(1);
  await expect(page.getByRole('button', { name: 'Düzenle', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Yeniden diz', exact: true })).toBeHidden();
});

test('desktop mouse and arrow/Enter targeting each fire once and reject repeated cells', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openGame(page);
  await ready(page);
  // Read the local game's board solely to choose a hit, keeping the user's turn deterministic.
  const hit = await page.evaluate(() => AB.durum.tahta.rakip.gemiler.find(g => g.uzunluk > 1).hucreler[0]);
  const hitCell = page.locator(`#tahta-rakip .hucre[data-s="${hit.s}"][data-k="${hit.k}"]`);
  await hitCell.click();
  await page.waitForFunction(() => !AB.durum.kilit && AB.durum.sira === 'ben');
  expect((await state(page)).atis.ben).toBe(1);
  const hitBox = await hitCell.boundingBox();
  await page.mouse.click(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2);
  expect((await state(page)).atis.ben).toBe(1);
  const target = await unshotCell(page);
  const startK = target.k === 0 ? 1 : target.k - 1;
  await page.locator(`#tahta-rakip .hucre[data-s="${target.s}"][data-k="${startK}"]`).focus();
  await page.keyboard.press(target.k === 0 ? 'ArrowLeft' : 'ArrowRight');
  await expect(target.locator).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await state(page)).atis.ben).toBe(2);
  await page.keyboard.press('Enter');
  expect((await state(page)).atis.ben).toBe(2);
});

test('keyboard ship placement previews, rotates, cancels, commits and rejects an invalid placement', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openGame(page);
  const before = await state(page);
  const longShip = before.gemiler.find(g => g.hucreler.length > 1);
  await page.locator(`#tahta-ben .tutamak[data-gemi="${longShip.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('r');
  await expect(page.locator('#duyuru')).toContainText(longShip.yatay ? 'dikey' : 'yatay');
  expect((await state(page)).gemiler).toEqual(before.gemiler);
  await page.keyboard.press('Escape');
  // Find a legal adjacent move from the generated fleet without modifying it.
  const move = await page.evaluate(() => {
    const t = AB.durum.tahta.ben;
    const directions = [['ArrowUp', -1, 0], ['ArrowDown', 1, 0], ['ArrowLeft', 0, -1], ['ArrowRight', 0, 1]];
    for (const g of t.gemiler) {
      for (const [key, ds, dk] of directions) {
        const cells = g.hucreler.map(h => ({ s: h.s + ds, k: h.k + dk }));
        if (cells.some(h => h.s < 0 || h.s >= t.n || h.k < 0 || h.k >= t.n)) continue;
        const clear = cells.every(h => {
          for (let s = h.s - 1; s <= h.s + 1; s++) {
            for (let k = h.k - 1; k <= h.k + 1; k++) {
              if (s < 0 || s >= t.n || k < 0 || k >= t.n) continue;
              const id = t.gemiHaritasi[s * t.n + k];
              if (id !== -1 && id !== g.id) return false;
            }
          }
          return true;
        });
        if (clear) return { id: g.id, key, cells };
      }
    }
    throw new Error('Generated fleet unexpectedly has no legal adjacent move');
  });
  const handle = page.locator(`#tahta-ben .tutamak[data-gemi="${move.id}"]`);
  await expect(handle).toHaveRole('button');
  await expect(handle).toHaveAccessibleName(/gemi/i);
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(move.key);
  expect((await state(page)).gemiler).toEqual(before.gemiler);
  await page.keyboard.press('Escape');
  expect((await state(page)).gemiler).toEqual(before.gemiler);
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(move.key);
  await page.keyboard.press('Enter');
  expect((await state(page)).gemiler[move.id].hucreler).toEqual(move.cells);

  const committed = await state(page);
  await handle.focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 11; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  expect((await state(page)).gemiler).toEqual(committed.gemiler);
  await expect(page.locator('#duyuru')).toContainText(/geçersiz|yerleştirile|sığmıyor/i);
  await page.keyboard.press('Escape');
});

test('reduced motion starts with no running drawing animation and supports a shot', async ({ page }) => {
  await openGame(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await ready(page);
  await (await unshotCell(page)).locator.click();
  expect((await state(page)).atis.ben).toBe(1);
});

test.describe('compact touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('320px touch controls fit after a target is selected', async ({ page }) => {
    const viewport = { width: 320, height: 568 };
    await page.setViewportSize(viewport);
    await openGame(page);
    await ready(page);
    await page.locator('#tahta-rakip .hucre').first().tap();
    await expect(page.getByRole('button', { name: 'Ateş et', exact: true })).toBeEnabled();
    // In the narrowest layout the target is shown in the board header so the
    // edit/fire controls can share one row without repeating the coordinate.
    await expect(page.locator('#sayfa-rakip .kompakt-durum')).toHaveText('A1 seçili');
    for (const selector of ['#tahta-ben', '#tahta-rakip', '#sayac-ben', '#sayac-rakip', '#sayfa-rakip .kompakt-durum']) {
      await withinViewport(page.locator(selector), viewport);
    }
    for (const button of await page.locator('button:visible').all()) {
      await withinViewport(button, viewport);
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
  });

  test('touch selects and changes a target, and explicit rapid fire counts only once', async ({ page }) => {
    await openGame(page);
    await ready(page);
    const cells = page.locator('#tahta-rakip .hucre');
    await cells.nth(0).tap();
    expect((await state(page)).secili).toEqual({ s: 0, k: 0 });
    expect((await state(page)).atis.ben).toBe(0);
    await cells.nth(1).tap();
    await cells.nth(1).tap();
    expect((await state(page)).secili).toEqual({ s: 0, k: 1 });
    expect((await state(page)).atis.ben).toBe(0);
    await expect(page.locator('#hedef-bilgi')).toContainText('B1');
    const fire = page.getByRole('button', { name: 'Ateş et', exact: true });
    const box = await fire.boundingBox();
    await fire.tap();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    expect((await state(page)).atis.ben).toBe(1);
    await expect(page.getByRole('button', { name: 'Düzenle', exact: true })).toBeHidden();
  });

  test('small viewport pauses and orientation preserves the fleet, target and counters', async ({ page }) => {
    await openGame(page);
    await ready(page);
    await page.locator('#tahta-rakip .hucre').nth(12).tap();
    const selected = await state(page);
    await page.setViewportSize({ width: 240, height: 300 });
    await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeVisible();
    await expect.poll(async () => (await state(page)).duraklat).toBe(true);
    await page.waitForTimeout(1000);
    const paused = await state(page);
    expect(paused.gemiler).toEqual(selected.gemiler);
    expect(paused.secili).toEqual(selected.secili);
    expect(paused.atis).toEqual(selected.atis);
    expect(paused.jeton).toBe(selected.jeton);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeHidden();
    const resumed = await state(page);
    expect(resumed.duraklat).toBe(false);
    expect(resumed.gemiler).toEqual(selected.gemiler);
    expect(resumed.secili).toEqual(selected.secili);
    expect(resumed.atis).toEqual(selected.atis);
    expect(resumed.jeton).toBe(selected.jeton);
    await page.getByRole('button', { name: 'Ateş et', exact: true }).tap();
    expect((await state(page)).atis.ben).toBe(1);
  });

  test('AI cannot shoot while paused, then resumes without changing the primary board', async ({ page }) => {
    await openGame(page);
    await ready(page);
    await (await unshotCell(page, { water: true })).locator.tap();
    await page.getByRole('button', { name: 'Ateş et', exact: true }).tap();
    await page.waitForFunction(() => AB.durum.sira === 'rakip');
    const before = await state(page);
    const primary = await page.locator('#tahta-rakip').boundingBox();
    const secondary = await page.locator('#tahta-ben').boundingBox();
    expect(primary.width).toBeGreaterThan(secondary.width);
    await page.setViewportSize({ width: 240, height: 300 });
    await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeVisible();
    await page.waitForTimeout(1200);
    expect((await state(page)).atis).toEqual(before.atis);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await state(page)).atis.rakip).toBeGreaterThan(before.atis.rakip);
    expect((await state(page)).atis.ben).toBe(1);
    expect((await state(page)).jeton).toBe(before.jeton);
    const primaryAfter = await page.locator('#tahta-rakip').boundingBox();
    const secondaryAfter = await page.locator('#tahta-ben').boundingBox();
    expect(primaryAfter.width).toBeGreaterThan(secondaryAfter.width);
  });
});

test.describe('animated game', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1366, height: 768 } });

  test('new page during AI thinking cancels the old game without leaking a shot', async ({ page }) => {
    await openGame(page);
    await ready(page);
    await (await unshotCell(page, { water: true })).locator.click();
    await page.waitForFunction(() => AB.durum.sira === 'rakip');
    const before = await state(page);
    await page.getByRole('button', { name: 'Yeni sayfa', exact: true }).click();
    await page.waitForFunction(oldToken => AB.durum.jeton > oldToken && !AB.durum.kilit && !AB.durum.gecis, before.jeton);
    await page.waitForTimeout(1400);
    const reset = await state(page);
    expect(reset.jeton).toBeGreaterThan(before.jeton);
    expect(reset.atis).toEqual({ ben: 0, rakip: 0 });
    expect(reset.sira).toBe('ben');
    expect(reset.basladi).toBe(false);
    expect(reset.hazir).toBe(false);
    await expect(page.getByRole('button', { name: 'Hazırım', exact: true })).toBeEnabled();
  });
});
