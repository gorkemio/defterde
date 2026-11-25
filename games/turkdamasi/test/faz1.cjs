// Çalıştırma: PLAYWRIGHT_PATH=/.../node_modules/playwright node test/faz1.cjs
// Tarayıcı yolları CHROMIUM_PATH ve WEBKIT_PATH ile değiştirilebilir.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, '.impeccable/review');
fs.mkdirSync(evidence, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
const measurements = [];
async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    // Kayıt erişimi olmayan tarayıcıda da görsel açılmalı.
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Kapalı', 'SecurityError'); } });
    });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
    for (const protocol of ['file', 'http']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await context.setOffline(protocol === 'file');
      const url = protocol === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : `http://127.0.0.1:${server.address().port}/index.html`;
      await page.goto(url);
      await page.waitForFunction(() => document.documentElement.dataset.hazir === 'true');
      await page.evaluate(() => TD.ui.configure({ mode: 'local' }));
      assert.equal(await page.locator('#tahta-cizim .tas').count(), 32);
      assert.equal(await page.locator('#tahta-cizim [data-dama="true"]').count(), 0);
      assert.equal(await page.locator('#dama-ornek [data-dama="true"]').count(), 1);
      assert.equal(await page.locator('.hucre').count(), 64);
      const position = await page.locator('.hucre[data-tas]').evaluateAll(els => els.map(e => `${e.dataset.tas}:${e.dataset.kare}`).sort());
      const expected = [];
      for (const [team, ranks] of [['mavi', [2, 3]], ['kirmizi', [6, 7]]]) {
        for (const rank of ranks) for (const col of 'abcdefgh') expected.push(`${team}:${col}${rank}`);
      }
      assert.deepEqual(position, expected.sort());
      const crown = await page.locator('#dama-ornek .tas-tac').evaluate(el => { const r = el.getBBox(); return { x: r.x, y: r.y, right: r.x + r.width, bottom: r.y + r.height }; });
      assert(crown.x > -49 && crown.y > -49 && crown.right < 49 && crown.bottom < 49, 'Taç hücre içinde');
      await page.evaluate(() => {
        window.testStones = [...document.querySelectorAll('#tahta-cizim .tas')];
        window.testFaces = window.testStones.map(el => el.querySelector('.tas-yuz').innerHTML);
      });
      for (const [width, height] of [[320, 700], [375, 812], [390, 844], [768, 1024], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const size = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          viewport: innerWidth,
          cell: document.querySelector('.hucre').getBoundingClientRect().width,
          commands: [...document.querySelectorAll('.komutlar button')].map(b => b.getBoundingClientRect().height),
          pageHeight: document.documentElement.scrollHeight,
          animations: document.getAnimations().length,
        }));
        assert(size.page <= size.viewport, `Yatay taşma: ${name} ${width}`);
        assert(size.commands.every(h => h >= 44), 'Komut dokunma alanı en az 44px');
        assert(size.animations === 0, 'Sürekli animasyon yok');
        if (width === 320) assert(size.cell >= 34.5 && size.cell <= 36.5, '320px hücre boyutu');
        if (width === 1440) assert(size.pageHeight <= height, 'Masaüstü komutları ilk görünümde');
        measurements.push({ browser: name, protocol, width, height, ...size });
        if (protocol === 'file') {
          const label = name === 'chromium' && width === 1440 ? 'desktop' : name === 'chromium' && width === 390 ? 'mobile' : `${name}-${width}`;
          await page.screenshot({ path: path.join(evidence, `${label}.png`), fullPage: true });
        }
      }
      await page.locator('.hucre[data-kare="a3"]').click();
      assert.equal(await page.locator('[aria-selected="true"]').getAttribute('data-kare'), 'a3');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator(':focus').getAttribute('data-kare'), 'a3');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('[aria-selected="true"]').getAttribute('data-kare'), 'b3');
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
      assert.equal(await page.locator(':focus').getAttribute('data-kare'), 'h3');
      await page.locator('#yeni-oyun').click();
      await page.waitForFunction(() => !TD.ui.read().busy);
      assert.equal(await page.locator('[aria-selected="true"]').count(), 0, 'Yeni oyun seçimsiz başlar');
      const stable = await page.evaluate(() => [...document.querySelectorAll('#tahta-cizim .tas')].every((el, i) => el === window.testStones[i] && el.querySelector('.tas-yuz').innerHTML === window.testFaces[i]));
      assert(stable, 'Seçim, sıfırlama ve yeniden boyutlama taşları yeniden üretmemeli');
      await page.locator('#nasil').click();
      assert(await page.locator('#nasil-not').isVisible());
      await page.locator('#nasil-kapat').focus();
      await page.keyboard.press('Escape');
      assert(!(await page.locator('#nasil-not').isVisible()));
      assert.equal(await page.locator(':focus').getAttribute('id'), 'nasil');
    }
    assert.deepEqual(errors, [], `${name} konsol hataları`);
    assert.deepEqual(external, [], `${name} dış ağ istekleri`);
    console.log(`${name}: file:// + HTTP; 5 genişlik; diziliş, giriş, kimlik, taç ve çevrimdışı kontrolleri geçti.`);
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run('chromium', chromium, process.env.CHROMIUM_PATH);
    await run('webkit', webkit, process.env.WEBKIT_PATH);
    fs.writeFileSync(path.join(evidence, 'metrics.json'), JSON.stringify(measurements, null, 2));
  } finally { server.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
