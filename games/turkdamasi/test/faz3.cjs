// Gerçek DOM girişleriyle iki kişilik oyun; motoru doğrudan oynatmaz.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fixtures = require('./fixtures/tudaf.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/evidence/faz3');
fs.mkdirSync(output, { recursive: true });
const reports = [];
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
const cell = (page, square) => page.locator(`.hucre[data-kare="${square}"]`);
const ready = page => page.waitForFunction(() => !TD.ui.read().busy);
const state = page => page.evaluate(() => {
  const { game: g, ids } = TD.ui.read();
  return JSON.stringify([g.position, g.repetitions, g.history, g.result, ids]);
});

async function exhaustive(page) {
  return page.evaluate(async fixtures => {
    const B = TD.board, U = TD.ui;
    const sq = s => 'abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1);
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const snapshot = () => {
      const { game: g, ids } = U.read();
      return [g.position, g.repetitions, g.history, g.result, ids];
    };
    const click = i => document.querySelector(`.hucre[data-kare="${TD.layout.name(i)}"]`).click();
    const settled = async () => {
      for (let i = 0; U.read().busy; i++) {
        if (i > 1000) throw new Error('Oturum kilitli kaldı');
        await new Promise(r => setTimeout(r, 0));
      }
      check(!U.read().error, U.read().error);
    };
    const pos = f => {
      const cells = Array(64).fill(0);
      for (const [list, piece] of [[f.blue, 1], [f.red, -1], [f.blueKings, 2], [f.redKings, -2]]) {
        for (const s of (list || '').split(' ').filter(Boolean)) cells[sq(s)] = piece;
      }
      return B.position(cells, f.turn || 1);
    };
    function visual() {
      const v = U.read(), visible = [...document.querySelectorAll('#tahta-cizim .tas')].filter(el => el.style.display !== 'none');
      check(visible.length === v.position.cells.filter(Boolean).length, 'Taş sayısı');
      for (const el of visible) {
        const i = v.ids.indexOf(el.dataset.id);
        check(el.dataset.kare === TD.layout.name(i), 'Kalıcı kimlik hücre eşleşmesi');
        check(el.getAttribute('transform') === `translate(${TD.layout.center(i).join(' ')}) scale(1)`, 'SVG konumu');
        check(el.dataset.dama === String(Math.abs(v.position.cells[i]) === 2), 'Taç durumu');
      }
      check(+document.querySelector('#mavi-sayi').textContent === v.position.cells.filter(p => p > 0).length, 'Mavi sayaç');
      check(+document.querySelector('#kirmizi-sayi').textContent === v.position.cells.filter(p => p < 0).length, 'Kırmızı sayaç');
      const targets = [...document.querySelectorAll('.hucre[data-hedef="true"]')].map(el => sq(el.dataset.kare)).sort((a, b) => a - b);
      check(equal(targets, [...v.targets].sort((a, b) => a - b)), 'DOM hedefleri');
    }
    let routes = 0, steps = 0;
    for (const f of fixtures) {
      const p = pos(f);
      for (const m of B.legalMoves(p)) {
        await U.start(p);
        const before = snapshot();
        const nodes = [...document.querySelectorAll('#tahta-cizim .tas')].map(el => [el, el.querySelector('.tas-yuz').innerHTML]);
        click(m.from);
        for (let i = 0; i < m.landings.length; i++) {
          const expected = B.continuations(U.read().legal, m.from, m.landings.slice(0, i)).next;
          check(equal(U.read().targets, expected), `TÜDAF ${f.number} bütün önek seçenekleri`);
          check(document.querySelector(`.hucre[data-kare="${TD.layout.name(m.landings[i])}"]`).dataset.hedef === 'true', 'Hedef tıklanabilir');
          click(m.landings[i]);
          await settled();
          visual();
          if (i < m.landings.length - 1) {
            check(U.read().game.history.length === 0 && U.read().position.turn === p.turn, 'Yarım tur kaydedilmemeli');
            check(Math.abs(U.read().position.cells[m.landings[i]]) === Math.abs(p.cells[m.from]), 'Erken terfi yok');
          }
          steps++;
        }
        check(equal(U.read().position, B.applyMove(p, m)), `TÜDAF ${f.number} tam hamle`);
        check(U.read().game.history.length === 1, 'Bir zincir bir tur');
        check(nodes.every(([el, face]) => el.isConnected && el.querySelector('.tas-yuz').innerHTML === face), 'Gövde ve yüzler sabit');
        document.querySelector('#geri-al').click();
        check(equal(snapshot(), before), `TÜDAF ${f.number} eksiksiz geri alma`);
        visual();
        routes++;
      }
    }
    // Yarım zincir: aynı taşla devam, geri alma ve yardım sonrası seçimi koruma.
    await U.start(pos(fixtures[0]));
    const before = snapshot();
    click(sq('f3')); click(sq('f5')); await settled();
    click(sq('a3'));
    check(U.read().from === sq('f3') && U.read().prefix.length === 1, 'Zincir sırasında taş değişmez');
    document.querySelector('#nasil').click();
    document.querySelector('#nasil-kapat').click();
    check(U.read().prefix.length === 1, 'Kısa kurallar seçimi korur');
    document.querySelector('#geri-al').click();
    check(equal(snapshot(), before), 'Yarım zincir tam geri alma');

    // Gerçek bitişler ve üçüncü tekrar; sonuçtan geri alma.
    for (const [f, reason] of [
      [{ blue: 'a8', red: 'b8 c8' }, 'blocked'],
      [{ blue: 'a2', red: 'h7' }, 'one-each'],
    ]) {
      await U.start(pos(f));
      check(U.read().game.result.reason === reason, reason);
      check(document.querySelectorAll('.hucre[aria-disabled="true"]').length === 64, 'Sonuç girdiyi kilitler');
    }
    await U.start(pos({ blue: 'a2 b2', red: 'a3' }));
    click(sq('a2')); click(sq('a4')); await settled();
    check(document.querySelector('#sira-yazi').textContent === 'Mavi kazandı!', 'Galibiyet görünür');
    document.querySelector('#geri-al').click();
    check(U.read().game.result === null, 'Sonuç geri alınır');
    await U.start(pos({ blue: 'a1 h1', red: 'a8 h8' }));
    const initial = snapshot();
    for (let i = 0; i < 2; i++) {
      for (const route of ['a1 b1', 'a8 b8', 'b1 a1', 'b8 a8']) {
        for (const s of route.split(' ')) click(sq(s));
        await settled();
      }
    }
    check(U.read().game.result.reason === 'repetition', 'Üçüncü tekrar');
    check(document.querySelector('#sira-yazi').textContent === 'Berabere!', 'Beraberlik görünür');
    for (let i = 0; i < 8; i++) document.querySelector('#geri-al').click();
    check(equal(snapshot(), initial), 'Tekrar geçmişi ve kimlikler geri gelir');
    return { routes, steps };
  }, fixtures);
}

async function interactions(page, name) {
  await page.locator('#yeni-oyun').click();
  await ready(page);
  await cell(page, 'a3').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await ready(page);
  assert.equal(await page.locator('#sira-yazi').textContent(), 'Sıra kırmızıda');
  await cell(page, 'h6').click();
  await cell(page, 'h5').click();
  await ready(page);
  assert.equal(await page.locator('#sira-yazi').textContent(), 'Sıra mavide');
  await page.locator('#geri-al').click();
  assert.equal(await cell(page, 'h6').getAttribute('data-tas'), 'kirmizi');
  await page.locator('#geri-al').click();
  assert.equal(await cell(page, 'a3').getAttribute('data-tas'), 'mavi');
  assert(await page.locator('#geri-al').isDisabled());
  assert.equal(await page.locator('.hucre[tabindex="0"]').count(), 1);

  // Gerçek RAF hareketini başladıktan sonra iptal et; eski kareler yeniden uygulanmamalı.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const action of ['undo', 'new', 'pagehide']) {
    await page.locator('#yeni-oyun').click(); await ready(page);
    const before = await state(page);
    const sample = await page.evaluate(async action => {
      const el = s => document.querySelector(`.hucre[data-kare="${s}"]`);
      const stone = document.querySelector('#tahta-cizim .tas[data-kare="a3"]');
      const origin = stone.getAttribute('transform');
      const now = performance.now();
      el('a3').click(); el('a4').click();
      el('b3').click(); el('b4').click();
      if (TD.ui.read().busy !== 'animation') throw new Error('Hareket anında kilitlenmeli');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const intermediate = stone.getAttribute('transform');
      if (action === 'undo') document.querySelector('#geri-al').click();
      else if (action === 'new') document.querySelector('#yeni-oyun').click();
      else window.dispatchEvent(new PageTransitionEvent('pagehide'));
      const cancelMs = performance.now();
      await new Promise(r => setTimeout(r, 250));
      return { moved: origin !== intermediate, cancelToRenderMs: cancelMs - now, restored: stone.getAttribute('transform') === origin };
    }, action);
    await ready(page);
    assert(sample.moved && sample.restored, `${name}/${action}: hareket başladı ve geri döndü`);
    assert.equal(await state(page), before, `${action}: eski sonuç reddedildi`);
  }
  await cell(page, 'a3').click();
  await cell(page, 'a4').click();
  await ready(page);
  assert.equal(await cell(page, 'a4').getAttribute('data-tas'), 'mavi', 'Animasyon normal tamamlanır');
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Kapalı', 'SecurityError'); } });
    });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:')) external.push(r.url()); });
    for (const protocol of ['file', 'http']) {
      await context.setOffline(protocol === 'file');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(protocol === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : `http://127.0.0.1:${server.address().port}/index.html`);
      await page.waitForFunction(() => document.documentElement.dataset.hazir === 'true');
      await page.evaluate(() => TD.ui.configure({ mode: 'local' }));
      const result = await exhaustive(page);
      await interactions(page, name);
      for (const [width, height] of [[320, 700], [375, 812], [390, 844], [768, 1024], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.locator('#yeni-oyun').click(); await ready(page);
        await cell(page, 'e3').tap();
        const size = await page.evaluate(() => ({
          width: innerWidth, content: document.documentElement.scrollWidth,
          cell: document.querySelector('.hucre').getBoundingClientRect().width,
          controls: [...document.querySelectorAll('.komutlar button')].map(b => b.getBoundingClientRect().height),
        }));
        assert(size.content <= size.width, `${name}/${width} yatay taşma`);
        assert(size.controls.every(h => h >= 44), '44px komutlar');
        if (width === 320) assert(size.cell >= 34.5 && size.cell <= 36.5);
        if (protocol === 'file') await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
        await cell(page, 'e4').tap(); await ready(page);
        assert.equal(await cell(page, 'e4').getAttribute('data-tas'), 'mavi', 'Dokunarak hamle');
      }
      // 1440×900 ekranın %200 tarayıcı zoom'undaki CSS alanını taklit eder.
      // CSS zoom özelliği medya sorgusu genişliğini değiştirmediği için bu amaçla kullanılmaz.
      await page.setViewportSize({ width: 720, height: 450 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '200% etkin alanında yatay taşma');
      reports.push({ browser: name, protocol, ...result, sizes: [320, 375, 390, 768, 1440], errors: errors.length, external: external.length });
      console.log(`${name}/${protocol}: ${result.routes} tam yol, ${result.steps} adım, klavye/dokunma, iptal/geri alma, 5 genişlik.`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await context.close();
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run('chromium', chromium, process.env.CHROMIUM_PATH);
    await run('webkit', webkit, process.env.WEBKIT_PATH);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
  } finally { server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
