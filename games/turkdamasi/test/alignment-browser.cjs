const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const ready = p => p.waitForFunction(() => document.documentElement.dataset.hazir === 'true' && !TD.ui.read().busy);
const cell = (p, name) => p.locator(`.hucre[data-kare="${name}"]`);

async function position(page, flipped) {
  await page.evaluate(async flipped => {
    await TD.ui.configure({ mode: 'ai', human: flipped ? -1 : 1, level: 'easy' });
    const cells = Array(64).fill(0);
    const pieces = flipped ? { a5: -1, b7: -1, h2: 1, h3: 1 } : { a3: 1, b2: 1, h6: -1, h7: -1 };
    for (const [square, piece] of Object.entries(pieces)) {
      cells['abcdefgh'.indexOf(square[0]) + 8 * (+square[1] - 1)] = piece;
    }
    await TD.ui.start(TD.board.position(cells, flipped ? -1 : 1));
  }, flipped);
  await ready(page);
}

async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.setOffline(true);
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await ready(page);
    // The same destination is drawn before and after both orientation changes.
    for (const flipped of [false, true, false]) {
      await position(page, flipped);
      await cell(page, flipped ? 'a5' : 'a3').click();
      const distance = await page.evaluate(() => {
        const marker = document.querySelector('.hedef-isareti[data-kare="a4"]');
        const point = new DOMPoint(0, 0).matrixTransform(marker.getScreenCTM());
        const target = document.querySelector('.hucre[data-kare="a4"]').getBoundingClientRect();
        return Math.hypot(point.x - target.x - target.width / 2, point.y - target.y - target.height / 2);
      });
      assert(distance < 1, `${name}: a4 marker must overlap its touch target after flip=${flipped}, distance=${distance}`);
      await cell(page, 'a4').click(); await ready(page);
      assert.equal(await page.evaluate(() => TD.ui.read().game.history[0].move.landings[0]), 24);
    }
    await page.locator('#ayarlar-ac').click();
    const mode = page.locator('[name="mode"][value="ai"]');
    await mode.focus(); await page.keyboard.press('ArrowRight');
    assert(await page.locator('[name="mode"][value="local"]').isChecked());
    assert.equal(await page.locator('.ai-ayari:visible').count(), 0);
    assert.equal(await page.locator('.ai-ayari:disabled').count(), 2);
    await page.keyboard.press('ArrowLeft');
    assert(await mode.isChecked());
    assert.equal(await page.locator('.ai-ayari:visible').count(), 2);
    await page.locator('[name="level"][value="medium"]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('[name="level"][value="hard"]').isChecked());
    assert.equal(await page.locator('[name="level"][value="hard"]').evaluate(el =>
      getComputedStyle(el.closest('label')).outlineStyle), 'dashed');
    for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const sizes = await page.locator('.ayar-secenekleri label:visible').evaluateAll(els =>
        els.map(el => ({ height: el.getBoundingClientRect().height, right: el.getBoundingClientRect().right })));
      assert(sizes.every(s => s.height >= 44 && s.right <= width - 12));
      assert(await page.locator('#ayarlar').evaluate(el => el.scrollHeight <= el.clientHeight + 1),
        `${name}: ${width}px ayar notunun tamamı görünür`);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ayarlar').isVisible(), false);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'ayarlar-ac');
    assert.equal(await page.locator('.defterde-donus').getAttribute('href'), 'https://defterde.com/');
    assert(await page.evaluate(() => document.fonts.check('20px Kalam')));
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(`${name}: hedef yönü, klavye ile ayarlar, dört genişlik, yerel font ve çevrimdışı açılış geçti.`);
  } finally { await browser.close(); }
}
(async () => {
  await run('chromium', chromium, process.env.CHROMIUM_PATH);
  await run('webkit', webkit, process.env.WEBKIT_PATH);
})().catch(e => { console.error(e); process.exitCode = 1; });
