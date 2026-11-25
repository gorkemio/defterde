const { test, expect } = require('@playwright/test');
const { openGame, ready, state, withinViewport } = require('./helpers.cjs');

for (const outcome of ['win', 'loss']) {
  test(`full ${outcome}: shots, sinking, result announcement and result rotation`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1366, height: 768 });
    // Reproducible random fleets and AI decisions; the actual rules, renderer and
    // controller run unchanged. Virtual time only advances their real timers.
    await page.addInitScript(() => {
      let seed = 731;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await openGame(page);
    await ready(page);
    await page.clock.install();
    let shots = 0;
    while (!await page.evaluate(() => AB.durum.bitti)) {
      const target = await page.evaluate(win => {
        const t = AB.durum.tahta.rakip;
        const preferred = Array.from(t.atis).findIndex((a, i) => !a && (win ? t.gemiHaritasi[i] >= 0 : t.gemiHaritasi[i] < 0));
        const i = preferred < 0 ? Array.from(t.atis).findIndex(a => !a) : preferred;
        return { s: Math.floor(i / t.n), k: i % t.n };
      }, outcome === 'win');
      await page.locator(`#tahta-rakip .hucre[data-s="${target.s}"][data-k="${target.k}"]`).click();
      expect((await state(page)).atis.ben).toBe(++shots);
      // A hit may keep the AI's turn. Advance until the complete turn finishes.
      for (let i = 0; i < 100; i++) {
        await page.clock.runFor(2000);
        if (await page.evaluate(() => AB.durum.bitti || !AB.durum.kilit)) break;
      }
      expect(shots).toBeLessThanOrEqual(100);
    }
    const ended = await state(page);
    const winner = await page.evaluate(() => AB.game.hepsiBatti(AB.durum.tahta.rakip) ? 'win' : 'loss');
    expect(winner).toBe(outcome);
    const announcement = `${outcome === 'win' ? 'Kazandın!' : 'Kaybettin.'} Sen ${ended.atis.ben} atış, rakip ${ended.atis.rakip} atış yaptı.`;
    await expect(page.locator('#duyuru')).toHaveText(announcement);
    await expect(page.locator('#tahta-rakip .sonuc')).toContainText(outcome === 'win' ? 'KAZANDIN!' : 'KAYBETTİN…');
    async function resize(width, height, layout, paused) {
      await page.setViewportSize({ width, height });
      // Native resize delivery is asynchronous and independent of virtual time.
      // Advance RAF until the application has actually measured the new area.
      await expect.poll(async () => {
        await page.clock.runFor(32);
        return page.evaluate(() => ({ layout: document.querySelector('#oyun').dataset.layout, paused: AB.durum.duraklat }));
      }).toEqual({ layout, paused });
    }
    await resize(390, 844, 'dikey', false);
    expect(await state(page)).toEqual(ended);
    await withinViewport(page.locator('#tahta-rakip .sonuc'), { width: 390, height: 844 });
    await resize(240, 300, 'dikey', true);
    await expect(page.getByRole('dialog', { name: 'Cihazı yana çevir' })).toBeVisible();
    await resize(844, 390, 'yatay', false);
    expect(await state(page)).toEqual(ended);
    await expect(page.locator('#duyuru')).toHaveText(announcement);
  });
}
