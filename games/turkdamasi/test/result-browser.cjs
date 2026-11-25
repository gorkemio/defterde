const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/evidence/results');
fs.mkdirSync(out, { recursive: true });
const cell = (p, s) => p.locator(`.hucre[data-kare="${s}"]`);
const ready = p => p.waitForFunction(() => document.documentElement.dataset.hazir === 'true' && !TD.ui.read().busy);
async function position(page, { blue, red, turn = 1 }, defer = false) {
  await page.evaluate(async ({ blue, red, turn, defer }) => {
    const cells = Array(64).fill(0);
    for (const [squares, value] of [[blue, 1], [red, -1]])
      for (const s of squares.split(' ').filter(Boolean)) cells['abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1)] = value;
    const pending = TD.ui.start(TD.board.position(cells, turn));
    if (defer) document.querySelector('#ayarlar-ac').click();
    await pending;
  }, { blue, red, turn, defer });
  await ready(page);
}
async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    await context.setOffline(true);
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    await position(page, { blue: 'a2 b2', red: 'a3' });
    await cell(page, 'a2').click(); await cell(page, 'a4').click(); await ready(page);
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Kazandın!');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'sonuc-yeni');
    assert.equal(await page.locator('#sonuc').evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.screenshot({ path: path.join(out, name + '-win.png'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sonuc').isVisible(), false);
    await page.locator('#ayarlar-ac').click(); await page.locator('#ayarlar-kapat').click();
    assert.equal(await page.locator('#sonuc').isVisible(), false, 'Kapatılmış aynı sonuç yeniden açılmaz');
    await page.locator('#geri-al').click();
    assert.equal(await page.evaluate(() => TD.ui.read().game.result), null);
    await cell(page, 'a2').click(); await cell(page, 'a4').click(); await ready(page);
    assert(await page.locator('#sonuc').isVisible(), 'Geri alınan galibiyet tekrar kazanılınca gösterilir');
    await page.locator('#sonuc-yeni').click(); await ready(page);
    assert.equal(await page.evaluate(() => TD.ui.read().game.history.length), 0);
    assert.equal(await page.locator('#sonuc').isVisible(), false);

    await position(page, { blue: 'a3', red: 'a4 b7', turn: -1 });
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Bu kez olmadı.');
    assert.match(await page.locator('#sonuc-aciklama').textContent(), /Bilgisayar kazandı/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const bounds = await page.locator('#sonuc').boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
      const buttons = await page.locator('#sonuc button').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
      assert(buttons.every(h => h >= 44));
      if (width === 320) await page.screenshot({ path: path.join(out, name + '-loss-mobile.png'), fullPage: true });
    }
    await page.locator('#sonuc-kapat').click();
    await page.evaluate(() => TD.ui.configure({ mode: 'ai', human: -1, level: 'easy' }));
    await position(page, { blue: 'a6', red: 'a7 b7', turn: -1 });
    await cell(page, 'a7').click(); await cell(page, 'a5').click(); await ready(page);
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Kazandın!');
    assert.equal(await page.locator('#sonuc').getAttribute('data-takim'), 'kirmizi');
    await page.locator('#sonuc-yeni').click(); await ready(page);
    assert.equal(await page.evaluate(() => TD.ui.read().human), -1, 'Yeniden oyna tarafı korur');

    await page.evaluate(() => TD.ui.configure({ mode: 'local' }));
    await position(page, { blue: 'a8', red: 'b8 c8' }, true);
    assert.equal(await page.locator('#sonuc').isVisible(), false, 'Ayar üzerine modal bindirilmez');
    await page.locator('#ayarlar-kapat').click();
    await page.locator('#sonuc').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Kırmızı kazandı!');
    assert.match(await page.locator('#sonuc-aciklama').textContent(), /hamle yapamıyor/);
    await position(page, { blue: 'a2', red: 'h7' });
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Berabere!');
    assert.match(await page.locator('#sonuc-aciklama').textContent(), /birer taş/);
    assert.equal(await page.locator('.sonuc-taslar svg:visible').count(), 2);
    await page.screenshot({ path: path.join(out, name + '-draw.png'), fullPage: true });
    await page.locator('#sonuc-yeni').click(); await ready(page);
    await page.locator('#nasil').click(); await page.locator('[data-ornek="crown"]').click();
    await page.waitForFunction(() => TD.ui.tutorial() && !TD.ui.tutorial().running);
    assert.equal(await page.locator('#sonuc').isVisible(), false);
    await page.locator('#oyuna-don').click(); await ready(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => TD.ui.configure({ motion: 'full', mode: 'local' }));
    await position(page, { blue: 'a2', red: 'h7' });
    assert.equal(await page.locator('#sonuc').evaluate(e => getComputedStyle(e).animationName), 'sonuc-kagit');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Sonuç hareketi bir kez biter');
    await page.locator('#sonuc-yeni').click(); await ready(page);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(`${name}: galibiyet, yenilgi, beraberlik, taraf, tekrar açma/geri alma, modal odak, dört genişlik ve hareket geçti.`);
  } finally { await browser.close(); }
}
(async () => {
  await run('chromium', chromium, process.env.CHROMIUM_PATH);
  await run('webkit', webkit, process.env.WEBKIT_PATH);
})().catch(e => { console.error(e); process.exitCode = 1; });
