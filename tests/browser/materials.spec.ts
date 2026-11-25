import { test, expect } from '@playwright/test';
import { registry } from '../../src/lib/catalog';

test('open paper palette and notebook leaves stay consistent across all thirteen games and home', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Ortak açık kâğıt paleti ilk on üç oyun içindir. Sonraki oyunların kendi
  // malzemeleri vardır (ör. Labirent siyah eskiz defteri) ve kendi testlerinde denetlenir.
  const shared = registry.slice(0, 13).map((g) => g.slug);
  for (const slug of ['home', ...shared]) {
    await page.goto(slug === 'home' ? '/' : `/oyunlar/${slug}/`);
    await page.evaluate(() => document.fonts.ready);
    const paper = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--kagit')
        .trim(),
    );
    expect(paper, slug).toBe('#fbf9f2');
    expect(
      await page
        .locator(slug === 'amiralbatti' ? 'html' : 'body')
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      slug,
    ).toBe('rgb(182, 165, 138)');
    if (slug === 'amiralbatti') {
      await expect(page.locator('.cilt')).toBeVisible();
      expect(
        await page
          .locator('.defter')
          .evaluate((e) => getComputedStyle(e, '::before').content),
      ).toBe('none');
      continue;
    }
    const shell = page.locator(
      slug === 'home'
        ? '.notebook'
        : slug === 'turkdamasi'
          ? '.sayfa'
          : 'main.defter',
    );
    for (const pseudo of ['::before', '::after'])
      expect(
        await shell.evaluate((e, p) => getComputedStyle(e, p).content, pseudo),
      ).toBe('""');
    const front = page
      .locator(
        slug === 'home'
          ? '.paper'
          : ['alankapmaca', 'turkdamasi'].includes(slug)
            ? '.kagit-yuzeyi'
            : '.sayfa',
      )
      .first();
    expect(
      await front.evaluate(
        (e, p) => getComputedStyle(e, p).boxShadow,
        slug === 'kagitfutbolu' ? '::before' : null,
      ),
    ).toContain('inset');
    const backShadow = await shell.evaluate(
      (e) => getComputedStyle(e, '::before').boxShadow,
    );
    expect(backShadow).toContain('16px 28px 40px -6px');
    expect(
      await shell.evaluate((e) => getComputedStyle(e, '::after').boxShadow),
    ).toBe(
      slug === 'turkdamasi' ? 'rgba(40, 24, 10, 0.25) 0px 1px 2px 0px' : 'none',
    );
    await page.emulateMedia({ media: 'print' });
    for (const pseudo of ['::before', '::after'])
      expect(
        await shell.evaluate((e, p) => getComputedStyle(e, p).display, pseudo),
      ).toBe('none');
    await page.emulateMedia({ media: 'screen' });
  }
});
