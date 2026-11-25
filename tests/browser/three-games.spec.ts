import { test, expect, type Page } from '@playwright/test';

function captureErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}
async function ready(page: Page, game: 'xox' | 'noktaoyunu' | 'sayibulma') {
  await page.waitForFunction((slug) => {
    const w = window as any;
    const s =
      slug === 'xox'
        ? w.XOX?.ui?.U
        : slug === 'noktaoyunu'
          ? w.NK?.durum
          : w.SB?.ui?.O;
    return s && !s.kilit && (s.durum || s.oyun);
  }, game);
}
async function sound(page: Page) {
  const before = await page.locator('#ses').getAttribute('aria-pressed');
  await page.locator('#ses').click();
  await expect(page.locator('#ses')).not.toHaveAttribute(
    'aria-pressed',
    before!,
  );
}

test('5’li XOX: AI reply, undo, local five-in-a-row, settings and reload', async ({
  page,
}) => {
  const errors = captureErrors(page);
  await page.goto('/oyunlar/xox/');
  await ready(page, 'xox');
  await page.locator('.hucre[data-r="7"][data-c="7"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).XOX.ui.U.durum.hamleler.length),
    )
    .toBe(2);
  await ready(page, 'xox');
  await page.locator('#geri').click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).XOX.ui.U.durum.hamleler.length),
    )
    .toBe(0);
  await page.locator('[data-ayar="rakip"][data-deger="ikiKisi"]').click();
  await ready(page, 'xox');
  for (const [r, c] of [
    [7, 3],
    [8, 3],
    [7, 4],
    [8, 4],
    [7, 5],
    [8, 5],
    [7, 6],
    [8, 6],
    [7, 7],
  ]) {
    await page.locator(`.hucre[data-r="${r}"][data-c="${c}"]`).click();
    await ready(page, 'xox');
  }
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).XOX.ui.U.durum.besli?.length),
    )
    .toBe(5);
  await sound(page);
  await page.reload();
  await ready(page, 'xox');
  await expect(
    page.locator('[data-ayar="rakip"][data-deger="ikiKisi"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

async function drawEdge(page: Page, edge: number) {
  const point = await page.evaluate((e) => {
    const n = (window as any).NK,
      s = n.durum;
    const [a, b] = s.durum.G.KENAR_UC[e];
    const [x1, y1] = n.draw.yer(s.l, ...a),
      [x2, y2] = n.draw.yer(s.l, ...b);
    const svg = document.querySelector('#kagit') as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = (x1 + x2) / 2;
    pt.y = (y1 + y2) / 2;
    const p = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, edge);
  await page.mouse.click(point.x, point.y);
  await ready(page, 'noktaoyunu');
}
test('Nokta Oyunu: AI reply, local box capture, undo, puzzles and saved settings', async ({
  page,
}) => {
  const errors = captureErrors(page);
  await page.goto('/oyunlar/noktaoyunu/');
  await ready(page, 'noktaoyunu');
  await drawEdge(page, 0);
  await expect
    .poll(() => page.evaluate(() => (window as any).NK.durum.durum.kalan))
    .toBe(38);
  await ready(page, 'noktaoyunu');
  await page.locator('#ayarlar-ac').click();
  await page.locator('[data-ayar="mod"][data-deger="ikiKisi"]').click();
  await page.locator('#ayarlar-kapat').click();
  await page.locator('#yeni-sayfa').click();
  await ready(page, 'noktaoyunu');
  const edges = await page.evaluate(
    () =>
      Array.from(
        (window as any).NK.durum.durum.G.KUTU_KENAR.slice(0, 4),
      ) as number[],
  );
  for (const e of edges) await drawEdge(page, e);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).NK.durum.durum.puan.reduce(
          (a: number, b: number) => a + b,
          0,
        ),
      ),
    )
    .toBe(1);
  await page.locator('#geri-al').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).NK.durum.durum.puan.reduce(
          (a: number, b: number) => a + b,
          0,
        ),
      ),
    )
    .toBe(0);
  await sound(page);
  await page.locator('#ayarlar-ac').click();
  await page.locator('[data-ayar="mod"][data-deger="bulmaca"]').click();
  await page.locator('#ayarlar-kapat').click();
  await page.locator('#yeni-sayfa').click();
  await ready(page, 'noktaoyunu');
  await expect
    .poll(() => page.evaluate(() => (window as any).NK.durum.oyunAyar.mod))
    .toBe('bulmaca');
  await page.reload();
  await ready(page, 'noktaoyunu');
  expect(await page.evaluate(() => (window as any).NK.durum.oyunAyar.mod)).toBe(
    'bulmaca',
  );
  expect(errors).toEqual([]);
});

test('Sayı Bulma: guess clues, all five modes, daily restore and mobile keypad', async ({
  page,
}) => {
  const errors = captureErrors(page);
  await page.goto('/oyunlar/sayibulma/');
  await ready(page, 'sayibulma');
  await page.keyboard.type('1234');
  await page.locator('#tahmin').click();
  await expect(page.locator('#satir-metni li')).toHaveCount(1);
  await expect(page.locator('#satir-metni')).toContainText('artı');
  await sound(page);
  for (const mode of ['obulsun', 'yaris', 'ikikisi', 'gunun']) {
    await page.locator('#ayarlar-ac').click();
    await page.locator(`[data-ayar="mod"][data-deger="${mode}"]`).click();
    if (await page.locator('#ayarlar-kapat').isVisible())
      await page.locator('#ayarlar-kapat').click();
    if ((await page.evaluate(() => (window as any).SB.ui.O.oyun.mod)) !== mode)
      await page.locator('#yeni').click();
    await ready(page, 'sayibulma');
    await expect
      .poll(() => page.evaluate(() => (window as any).SB.ui.O.oyun.mod))
      .toBe(mode);
    if (mode === 'obulsun') {
      await page.locator('#tuttum').click();
      await expect(page.locator('#duyuru')).toContainText('1. tahmin:');
      await expect(page.locator('#cevapla')).toBeVisible();
    }
    if (mode === 'ikikisi') {
      for (const secret of ['5678', '9012']) {
        await page.locator('#hazirim').click();
        await page.keyboard.type(secret);
        await page.locator('#tahmin').click();
        await expect(page.locator('#devir')).toBeVisible();
      }
      await page.locator('#hazirim').click();
      await expect
        .poll(() => page.evaluate(() => (window as any).SB.ui.O.asama))
        .toBe('giris');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#tuslar')).toBeVisible();
  for (const digit of ['1', '2', '3', '4'])
    await page
      .locator('#tuslar')
      .getByRole('button', { name: digit, exact: true })
      .click();
  await page
    .locator('#tuslar')
    .getByRole('button', { name: 'tahmin', exact: true })
    .click();
  await expect(page.locator('#satir-metni li')).toHaveCount(1);
  const row = await page.locator('#satir-metni').textContent();
  await page.reload();
  await ready(page, 'sayibulma');
  await expect(page.locator('#satir-metni')).toHaveText(row!);
  expect(errors).toEqual([]);
});
