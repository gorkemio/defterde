import { test, expect } from '@playwright/test';

test('Labirent content stays level and pointer drawing follows the maze after resize', async ({
  page,
}) => {
  await page.goto('/oyunlar/labirent/?kod=D-K-G-7KQ9');
  await page.waitForFunction(() => (window as any).LB?.hazir);
  await page.evaluate(() => document.fonts.ready);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.getElementById('ekran')!;
          return Math.abs(
            canvas.getBoundingClientRect().width -
              document.getElementById('alan')!.clientWidth,
          );
        }),
      )
      .toBeLessThan(1);
    await page.locator('#k-bastan').click();
    await page.locator('#k-ayarlar').click();
    const geometry = await page.evaluate(() => {
      const tilted: string[] = [];
      for (const selector of [
        '.baslik',
        '#kronometre',
        '#modlar',
        '#kunye',
        '#ekran',
        '#sonuc',
        '#komutlar',
        '.not:not([hidden])',
      ]) {
        for (
          let element = document.querySelector(selector);
          element;
          element = element.parentElement
        ) {
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          if (Math.abs(matrix.b) > 0.000001 || Math.abs(matrix.c) > 0.000001)
            tilted.push(selector);
        }
      }
      const paper = new DOMMatrix(
        getComputedStyle(document.getElementById('sayfa')!, '::before')
          .transform,
      );
      return {
        tilted,
        paperAngle: (Math.atan2(paper.b, paper.a) * 180) / Math.PI,
      };
    });
    expect(geometry.tilted).toEqual([]);
    expect(geometry.paperAngle).toBeCloseTo(0.7, 2);
    await page.screenshot({
      path: test.info().outputPath(`settings-${viewport.width}.png`),
    });
    await page.keyboard.press('Escape');

    // Project cell centers from the visible, level canvas; do not compensate for a notebook tilt.
    const points = await page.evaluate(() => {
      const L = (window as any).LB;
      const rect = document.getElementById('ekran')!.getBoundingClientRect();
      return L.solve.cozum(L.oyun.lab).map((cell: number) => {
        const world = L.maze.dunya(L.oyun.y, L.oyun.lab.grid.merkez(cell));
        const [x, y] = L.sahne.ekrana(world);
        return { x: rect.left + x, y: rect.top + y };
      });
    });
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (const point of points.slice(1))
      await page.mouse.move(point.x, point.y, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => (window as any).LB.oyun.d.bitti))
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`solved-${viewport.width}.png`),
    });
  }

  // The decorative paper must still accompany the temporary page-turn clone.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#k-yeni').click();
  await expect(page.locator('.sayfa.ceviriliyor')).toHaveCount(1);
  await expect(page.locator('.sayfa')).toHaveCount(1);
  await expect(page.locator('#ekran')).toBeVisible();
});
