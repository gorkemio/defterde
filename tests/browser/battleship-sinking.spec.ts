import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`Battleship sinking (${reducedMotion})`, () => {
    test.use({ reducedMotion, viewport: { width: 1440, height: 900 } });
    test('horizontal and vertical ships tilt after their final hit', async ({
      page,
    }) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        let seed = 731;
        Math.random = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      });
      await page.goto('/oyunlar/amiralbatti/');
      await page.waitForFunction(
        () =>
          (window as any).AB?.durum?.tahta?.ben &&
          !(window as any).AB.durum.kilit,
      );
      await page.locator('#hazir').click();
      const ships = await page.evaluate(() => {
        const fleet = (window as any).AB.durum.tahta.rakip.gemiler;
        return [true, false].map((horizontal) => {
          const ship = fleet.find(
            (g: any) => g.uzunluk > 1 && g.yatay === horizontal,
          );
          return { id: ship.id, cells: ship.hucreler };
        });
      });
      for (const ship of ships) {
        for (const cell of ship.cells) {
          await page.waitForFunction(() => !(window as any).AB.durum.kilit);
          await page
            .locator(
              `#tahta-rakip .hucre[data-s="${cell.s}"][data-k="${cell.k}"]`,
            )
            .click();
        }
        const wreck = page.locator(`#tahta-rakip .gemi[data-id="${ship.id}"]`);
        await expect(wreck).toBeVisible();
        await expect
          .poll(() =>
            wreck.evaluate((element) => {
              const transform = new DOMMatrix(
                getComputedStyle(element).transform,
              );
              return {
                degrees: Math.round(
                  (Math.atan2(transform.b, transform.a) * 180) / Math.PI,
                ),
                drop: Math.round(transform.f),
              };
            }),
          )
          .toEqual({ degrees: 6, drop: 3 });
        await expect(wreck).toHaveCSS('opacity', '0.88');
        if (reducedMotion === 'reduce')
          await expect(wreck).toHaveCSS('transition-duration', '0s');
        await expect(page.locator('#tahta-rakip .batik')).toHaveCount(
          ships.indexOf(ship) + 1,
        );
      }
      expect(errors).toEqual([]);
      await page.screenshot({
        path: `test-results/battleship-sinking-${test.info().project.name}-${reducedMotion}.png`,
      });
    });
  });
}
