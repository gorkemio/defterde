const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/evidence/help');
fs.mkdirSync(out, { recursive: true });
const ready = p => p.waitForFunction(() => document.documentElement.dataset.hazir === 'true' && !TD.ui.read().busy);
const snapshot = p => p.evaluate(() => {
  const s = TD.ui.read();
  return JSON.stringify([s.game, s.ids, s.from, s.prefix]);
});

async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.setOffline(true);
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    await page.evaluate(() => TD.ui.configure({ mode: 'local' }));
    await page.locator('.hucre[data-kare="a3"]').click();
    const before = await snapshot(page);
    for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const paperHeight = await page.locator('#sayfa').evaluate(el => el.offsetHeight);
      await page.locator('#nasil').click();
      assert(await page.locator('#nasil-not').evaluate(el => el.matches(':modal')));
      assert.equal(await page.locator('#nasil').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'nasil-baslik');
      assert.equal(await page.locator('#sayfa').evaluate(el => el.offsetHeight), paperHeight, 'Yardım sayfayı uzatmaz');
      const bounds = await page.locator('#nasil-not').boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
      assert(await page.locator('#nasil-not').evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
      // macOS WebKit uses Option+Tab for buttons when full keyboard access is off.
      const tab = name === 'webkit' ? 'Alt+Tab' : 'Tab';
      await page.keyboard.press(tab);
      // A scrollable dialog can precede its controls in the native focus order.
      if (await page.locator(':focus').getAttribute('id') === 'nasil-not') await page.keyboard.press(tab);
      assert.equal(await page.locator(':focus').getAttribute('id'), 'nasil-kapat');
      await page.locator('#nasil-not').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const close = await page.locator('#nasil-kapat').boundingBox();
      assert(close.y >= bounds.y && close.y + close.height <= bounds.y + bounds.height && close.height >= 44,
        'Kaydırırken Kapat görünür ve dokunulabilir kalır');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement.id === 'nasil' &&
        document.querySelector('#nasil').getAttribute('aria-expanded') === 'false');
      assert.equal(await page.locator('#nasil').getAttribute('aria-expanded'), 'false');
      assert.equal(await snapshot(page), before, 'Açma/kapatma oyunu ve seçimi korur');
    }
    await page.locator('#nasil').click();
    assert.equal(await page.locator('#nasil-not').evaluate(el => el.scrollTop), 0);
    await page.locator('[data-ornek="chain"]').click();
    assert.equal(await page.locator('#nasil-not').isVisible(), false);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'oyuna-don');
    await page.waitForFunction(() => TD.ui.tutorial() && !TD.ui.tutorial().running);
    await page.locator('#oyuna-don').click(); await ready(page);
    assert.equal(await snapshot(page), before);

    // A completed result waits behind help, then opens without losing its focus.
    await page.evaluate(async () => {
      const cells = Array(64).fill(0); cells[8] = 1; cells[55] = -1;
      const pending = TD.ui.start(TD.board.position(cells, 1));
      document.querySelector('#nasil').click();
      await pending;
    });
    assert.equal(await page.locator('#sonuc').isVisible(), false);
    await page.locator('#nasil-kapat').click();
    await page.locator('#sonuc').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#sonuc-baslik').textContent(), 'Berabere!');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'sonuc-yeni');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(`${name}: yardım modalı, dört genişlik, odak/kapatma, örnekten dönüş ve bekleyen sonuç geçti.`);
  } finally { await browser.close(); }
}
(async () => {
  await run('chromium', chromium, process.env.CHROMIUM_PATH);
  await run('webkit', webkit, process.env.WEBKIT_PATH);
})().catch(e => { console.error(e); process.exitCode = 1; });
