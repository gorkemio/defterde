import { test, expect, type Page } from '@playwright/test';

const ready = (page: Page) =>
  page.waitForFunction(() => {
    const app = (window as any).Mangala?.app;
    return app && app.activity() === 'idle';
  });
const read = (page: Page) =>
  page.evaluate(() => (window as any).Mangala.app.snapshot());

test('Mangala: local and computer play, undo, examples, settings and saved preferences on the platform', async ({
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
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !== new URL(baseURL!).origin
    )
      external.push(r.url());
  });
  await page.goto('/oyunlar/mangala/');
  await ready(page);
  await expect(page.locator('.pit')).toHaveCount(12);
  await expect(page.locator('[data-stone]')).toHaveCount(48);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    await page.evaluate(
      (difficulty) =>
        (window as any).Mangala.app.newGame(
          { mode: 'computer', difficulty },
          { firstPlayer: 0 },
        ),
      difficulty,
    );
    await page.locator('.pit[data-position="0"]').click();
    await ready(page);
    expect((await read(page)).history.length).toBe(1);
    expect((await read(page)).board.player).toBe(0);
    await page.locator('#undo').click();
    await ready(page);
    expect((await read(page)).board.counts).toEqual([
      4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0,
    ]);
  }
  await page.locator('#settings-open').click();
  await page.locator('[name=mode]').selectOption('local');
  await page.locator('[name=sets]').selectOption('5');
  await page.locator('#settings-form [type=submit]').click();
  await ready(page);
  expect((await read(page)).settings).toMatchObject({ mode: 'local', sets: 5 });
  await page.evaluate(() =>
    (window as any).Mangala.app.newGame(
      { mode: 'local', sets: 5 },
      { firstPlayer: 0 },
    ),
  );
  const before = await read(page);
  await page.locator('.pit[data-position="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await ready(page);
  expect((await read(page)).board.counts[1]).toBe(1);
  await page.locator('#undo').click();
  expect((await read(page)).board).toEqual(before.board);
  await page.locator('#help-open').focus();
  await page.keyboard.press('Enter');
  for (const example of ['0', '1', '2', '3']) {
    await page.locator('#example-select').selectOption(example);
    await page.locator('#example-play').click();
    await expect(page.locator('#example-play')).toBeDisabled();
    expect((await read(page)).board).toEqual(before.board);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-open')).toBeFocused();
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await ready(page);
  expect((await read(page)).settings).toMatchObject({ mode: 'local', sets: 5 });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});

test('Mangala: touch targets, upright pits, help and return at phone, landscape and desktop sizes', async ({
  page,
}) => {
  await page.goto('/oyunlar/mangala/');
  await ready(page);
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const pits = [...document.querySelectorAll('.pit')].map((p) =>
        p.getBoundingClientRect(),
      );
      return {
        width: document.documentElement.scrollWidth,
        min: Math.min(...pits.flatMap((p) => [p.width, p.height])),
        aligned: pits
          .slice(0, 6)
          .every((p, i) => Math.abs(p.x - pits[i + 6].x) < 1),
      };
    });
    expect(layout.width).toBeLessThanOrEqual(width);
    expect(layout.min).toBeGreaterThanOrEqual(44);
    expect(layout.aligned).toBe(true);
    await expect(page.locator('.back-link')).toBeInViewport();
    await page.locator('#help-open').click();
    const box = (await page.locator('#help-dialog').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    await page.locator('[data-close="help-dialog"]').click();
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: test.info().outputPath(`mangala-${width}.png`),
        fullPage: true,
      });
  }
  await page.locator('.back-link').click();
  await expect(
    page.locator('.discovery-game[href="/oyunlar/mangala/"]'),
  ).toBeVisible();
});
