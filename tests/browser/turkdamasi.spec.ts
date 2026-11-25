import { test, expect, type Page } from '@playwright/test';
const ready = (page: Page) =>
  page.waitForFunction(
    () =>
      document.documentElement.dataset.hazir === 'true' &&
      !(window as any).TD.ui.read().busy,
  );
const cell = (page: Page, square: string) =>
  page.locator(`.hucre[data-kare="${square}"]`);

test('Türk Daması: three AI levels, undo, local moves, help demo and result on the platform path', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    failed: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  page.on('request', (r) => {
    if (
      new URL(r.url()).origin !== new URL(baseURL!).origin &&
      /^https?:/.test(r.url())
    )
      external.push(r.url());
  });
  await page.goto('/oyunlar/turkdamasi/');
  await ready(page);
  await expect(page.locator('#tahta-cizim .tas')).toHaveCount(32);
  await expect(page.locator('.hucre')).toHaveCount(64);
  for (const level of ['easy', 'medium', 'hard']) {
    await page.locator('#ayarlar-ac').click();
    await page.locator(`[name="level"][value="${level}"]`).check();
    await page.locator('#ayar-form button[type=submit]').click();
    await ready(page);
    await cell(page, 'a3').click();
    await cell(page, 'a4').click();
    await ready(page);
    expect(
      await page.evaluate(
        () => (window as any).TD.ui.read().game.history.length,
      ),
    ).toBe(2);
    await page.locator('#geri-al').click();
    await ready(page);
    expect(
      await page.evaluate(
        () => (window as any).TD.ui.read().game.history.length,
      ),
    ).toBe(0);
  }
  await page.locator('#ayarlar-ac').click();
  await page.locator('[name=mode][value=local]').check();
  await page.locator('#ayar-form button[type=submit]').click();
  await ready(page);
  await cell(page, 'a3').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await ready(page);
  expect(
    await page.evaluate(() => (window as any).TD.ui.read().game.history.length),
  ).toBe(1);
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).TD.ui.read().game),
  );
  await page.locator('#nasil').click();
  expect(
    await page.locator('#nasil-not').evaluate((e) => e.matches(':modal')),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#nasil')).toBeFocused();
  await page.locator('#nasil').click();
  await page.locator('[data-ornek=crown]').click();
  await page.waitForFunction(
    () =>
      (window as any).TD.ui.tutorial() &&
      !(window as any).TD.ui.tutorial().running,
  );
  await expect(cell(page, 'd8')).toHaveAttribute('aria-label', 'd8, mavi dama');
  await page.locator('#oyuna-don').click();
  await ready(page);
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as any).TD.ui.read().game),
    ),
  ).toBe(before);
  await page.evaluate(async () => {
    const TD = (window as any).TD,
      cells = Array(64).fill(0);
    cells[16] = 1;
    cells[9] = 1;
    cells[24] = -1;
    await TD.ui.start(TD.board.position(cells, 1));
  });
  await cell(page, 'a3').click();
  await cell(page, 'a5').click();
  await expect(page.locator('#sonuc')).toBeVisible();
  await expect(page.locator('#sonuc-baslik')).toContainText('Mavi');
  await page.locator('#sonuc-yeni').click();
  await ready(page);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).TD.ui.read().mode)).toBe(
    'local',
  );
  expect(
    await page.evaluate(() => (window as any).TD.ui.read().game.history.length),
  ).toBe(0);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});

test('Türk Daması: tilted paper, upright board, touch targets and bounded help at five widths', async ({
  page,
}) => {
  await page.goto('/oyunlar/turkdamasi/');
  await ready(page);
  await page.evaluate(() => (window as any).TD.ui.configure({ mode: 'local' }));
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator('#yeni-oyun').click();
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const geometry = await page.evaluate(() => {
      const paper = new DOMMatrix(
        getComputedStyle(document.querySelector('#kagit-yuzeyi')!).transform,
      );
      const board = (
        document.querySelector('#tahta-cizim') as unknown as SVGSVGElement
      ).getScreenCTM()!;
      return {
        paper: paper.b,
        board: board.b,
        cell: document.querySelector('.hucre')!.getBoundingClientRect().width,
      };
    });
    expect(geometry.paper).toBeLessThan(0);
    expect(Math.abs(geometry.board)).toBeLessThan(0.001);
    if (width === 320) expect(geometry.cell).toBeGreaterThanOrEqual(34.5);
    await cell(page, 'a3').click();
    expect(
      await page.evaluate(() => {
        const marker = document.querySelector(
          '.hedef-isareti[data-kare="a4"]',
        ) as unknown as SVGGraphicsElement;
        const point = new DOMPoint(0, 0).matrixTransform(
          marker.getScreenCTM()!,
        );
        const target = document
          .querySelector('.hucre[data-kare="a4"]')!
          .getBoundingClientRect();
        return Math.hypot(
          point.x - target.x - target.width / 2,
          point.y - target.y - target.height / 2,
        );
      }),
    ).toBeLessThan(1);
    await page.locator('#nasil').click();
    const box = (await page.locator('#nasil-not').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await page.locator('#nasil-kapat').click();
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: test.info().outputPath(`turkdamasi-${width}.png`),
        fullPage: true,
      });
  }
});

test('Türk Daması: score, captured stacks, side selection and sound follow game state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/oyunlar/turkdamasi/');
  await ready(page);
  const shown = (id: string) =>
    page
      .locator(`${id} .tas`)
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) => (node as SVGElement).style.display !== 'none')
            .length,
      );
  expect(await shown('#mavi-alinan')).toBe(0);
  expect(await shown('#kirmizi-alinan')).toBe(0);
  await expect(page.locator('#skor')).toHaveAttribute(
    'aria-label',
    'Kalan taş: mavi 16, kırmızı 16',
  );
  await page.locator('#ses').click();
  await expect(page.locator('#ses')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#ses')).toHaveAttribute('aria-label', 'Ses açık');
  await page.locator('#ses').click();
  await expect(page.locator('#ses')).toHaveAttribute(
    'aria-label',
    'Ses kapalı',
  );
  await page.evaluate(() =>
    (window as any).TD.ui.configure({ human: -1, level: 'easy' }),
  );
  await ready(page);
  await expect(page.locator('#oyun-alani')).toHaveAttribute(
    'data-cevrik',
    'true',
  );
  await expect(page.locator('#kirmizi-yan-ad')).toHaveText('Sen');
  const sides = await page.evaluate(() => ({
    red: document.querySelector('.yan.kirmizi')!.getBoundingClientRect().x,
    blue: document.querySelector('.yan.mavi')!.getBoundingClientRect().x,
  }));
  expect(sides.red).toBeGreaterThan(sides.blue);
  await page.evaluate(async () => {
    const TD = (window as any).TD,
      cells = Array(64).fill(0);
    await TD.ui.configure({ mode: 'local' });
    cells[16] = 1;
    cells[9] = 1;
    cells[24] = -1;
    cells[55] = -1;
    cells[43] = -1;
    await TD.ui.start(TD.board.position(cells, 1));
  });
  await ready(page);
  expect(await shown('#mavi-alinan')).toBe(13);
  await cell(page, 'a3').click();
  await cell(page, 'a5').click();
  await ready(page);
  await expect(page.locator('#skor')).toHaveAttribute(
    'aria-label',
    'Kalan taş: mavi 2, kırmızı 2',
  );
  expect(await shown('#mavi-alinan')).toBe(14);
  await page.locator('#geri-al').click();
  await ready(page);
  expect(await shown('#mavi-alinan')).toBe(13);
  await expect(page.locator('#kirmizi-sayi')).toHaveText('3');
});
