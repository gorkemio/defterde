'use strict';
const { test, expect } = require('playwright/test');
const { openGame, roll, state } = require('./helpers');

async function startOpponent(page, phase = 'hesap') {
  await page.clock.install({ time: new Date('2026-10-18T12:00:00Z') });
  await openGame(page, { board: 20 });
  await page.clock.pauseAt(new Date('2026-10-18T13:00:00Z'));
  await page.evaluate(() => {
    AB.config.ilkBaslayan = 'rakip';
    AB.config.ai.dusunmeMs = [1000, 1000];
  });
  await page.locator('#yeni-sayfa').click();
  await expect(page.locator('#cevap')).toBeVisible();
  await expect.poll(() => page.evaluate(() => AB.durum.oyun.asama)).toBe('hesap');
  if (phase === 'yerlestir') {
    await page.clock.runFor(500);
    await expect.poll(() => page.evaluate(() => AB.durum.oyun.asama)).toBe('yerlestir');
  }
}

async function setPaused(page, reason, paused) {
  if (reason === 'settings') {
    await page.locator(paused ? '#ayarlar' : '#ay-kapat').click();
  } else if (reason === 'orientation gate') {
    await page.setViewportSize(paused ? { width: 320, height: 568 } : { width: 1280, height: 900 });
    await page.clock.runFor(100);
    if (paused) await expect(page.locator('#yon-uyarisi')).toBeVisible();
    else await expect(page.locator('#yon-uyarisi')).toBeHidden();
  } else {
    await page.evaluate(hidden => {
      if (hidden) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      } else {
        delete document.hidden;
        delete document.visibilityState;
      }
      document.dispatchEvent(new Event('visibilitychange'));
    }, paused);
  }
}

test.describe('opponent pause', () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });

  for (const phase of ['hesap', 'yerlestir']) {
    for (const reason of ['settings', 'orientation gate', 'background']) {
      test(`${reason} preserves the opponent ${phase} phase and resumes exactly once`, async ({ page }) => {
        await startOpponent(page, phase);
        await setPaused(page, reason, true);
        const before = await state(page);
        await page.clock.runFor(5000);
        expect(await state(page)).toEqual(before);
        await setPaused(page, reason, false);
        await page.clock.runFor(3000);
        await expect.poll(() => page.evaluate(() => AB.durum.oyun.sira)).toBe('ben');
        expect(await page.evaluate(() => AB.durum.oyun.dikdortgenler.map(d => d.sahip))).toEqual(['rakip']);
      });
    }
  }

  test('a paused opponent cannot write into a restarted game', async ({ page }) => {
    await startOpponent(page, 'yerlestir');
    await setPaused(page, 'settings', true);
    await page.clock.runFor(5000);
    await page.evaluate(() => { AB.config.ilkBaslayan = 'ben'; });
    await page.locator('#ay-yeni').click();
    await page.clock.runFor(5000);
    expect(await page.evaluate(() => ({
      phase: AB.durum.oyun.asama, player: AB.durum.oyun.sira,
      history: AB.durum.oyun.gecmis, points: AB.durum.oyun.puan,
    }))).toEqual({ phase: 'zar', player: 'ben', history: [], points: { ben: 0, rakip: 0 } });
  });
});

test('answer keyboard focus is visible, follows resizing, and clears on Tab', async ({ page }) => {
  await openGame(page);
  await roll(page);
  await page.locator('#tamam').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#giris')).toBeFocused();
  const strokes = page.locator('#giris-kap > .odak-halka path');
  await expect.poll(() => strokes.count()).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(async () => {
    return page.locator('#giris-kap').evaluate(el =>
      Number(el.querySelector('.odak-halka').getAttribute('width')) === el.offsetWidth);
  }).toBe(true);
  await expect(page.locator('#giris')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(strokes).toHaveCount(0);
});
