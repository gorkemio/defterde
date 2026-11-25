// Oyun dosyalarını gerçek tarayıcıda klasik script olarak doğrular.
// Çalıştırma ortamı: test/faz1.cjs ile aynı PLAYWRIGHT/CHROMIUM/WEBKIT_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fixtures = require('./fixtures/tudaf.cjs');
const stress = require('./fixtures/stress.cjs');
const root = path.resolve(__dirname, '..');
const report = [];
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

async function checkPage(page, label, full = true) {
  return page.evaluate(async ({ fixtures, stress, label, full }) => {
    const B = window.TD.board;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const sq = s => 'abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1);
    const name = n => 'abcdefgh'[n % 8] + ((n >> 3) + 1);
    const route = m => [m.from, ...m.landings].map(name).join(' ');
    const state = g => JSON.stringify([g.position, g.repetitions, g.history, g.result]);
    function pos(f) {
      const cells = Array(64).fill(0);
      for (const [list, piece] of [[f.blue, 1], [f.red, -1], [f.blueKings, 2], [f.redKings, -2]]) {
        for (const s of (list || '').split(' ').filter(Boolean)) cells[sq(s)] = piece;
      }
      return B.position(cells, f.turn || 1);
    }
    if (full) for (const f of fixtures) {
      const p = pos(f), game = B.createGame(p);
      const { moves } = await B.collectMoves(p);
      const paths = moves.map(route).sort();
      check(f.paths.every(s => paths.includes(s)), `TÜDAF ${f.number}: beklenen yol yok`);
      if (!f.allowOtherPaths) check(paths.length === f.paths.length, `TÜDAF ${f.number}: ek yol`);
      check(moves.every(m => m.captures.length === f.maximum), 'Global maksimum');
      for (const m of moves) {
        const next = B.play(game, m, { legal: moves });
        check(state(B.undo(next)) === state(game), 'Tam geri alma');
      }
    }
    const cases = [
      ['açılış', B.initialPosition()],
      ['yoğun alma', pos(stress)],
      ['dama son oyunu', pos({ blueKings: 'b2 f2', redKings: 'c7 g7' })],
    ];
    const measurements = [];
    for (const [scenario, p] of cases) {
      const { moves, stats } = await B.collectMoves(p);
      measurements.push({ label, scenario, moves: moves.length, captures: moves[0]?.captures.length || 0, ...stats });
    }
    if (full) {
      let clicked = false, running = true, inputDelayMs = null;
      const dense = pos(stress);
      const result = await B.collectMoves(dense, {
        sliceMs: 1,
        yieldTask: () => new Promise(resolve => {
          const requested = performance.now();
          setTimeout(() => {
            if (!clicked) {
              check(running, 'Tıklama üretim bitmeden işlenmeli');
              document.querySelector('.hucre[data-kare="a3"]').click();
              clicked = true;
              inputDelayMs = performance.now() - requested;
            }
            resolve();
          }, 0);
        }),
      });
      running = false;
      check(clicked && document.querySelector('[aria-selected="true"]').dataset.kare === 'a3', 'Üretim sırasında UI yanıtı');
      check(result.moves.every(m => m.captures.length === 16), 'Dilimli yoğun alma');
      const controller = new AbortController();
      let aborted = false;
      try {
        await B.collectMoves(dense, {
          signal: controller.signal, sliceMs: 0.25,
          yieldTask: () => { controller.abort(); return Promise.resolve(); },
        });
      } catch (e) { aborted = e.name === 'AbortError'; }
      check(aborted, 'Üretim iptali');
      measurements.push({ label, scenario: 'planlanan DOM tıklaması', inputDelayMs, whileGenerating: clicked });
    }
    return measurements;
  }, { fixtures, stress, label, full });
}

async function run(name, type, executablePath) {
  const browser = await type.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
    for (const protocol of ['file', 'http']) {
      await context.setOffline(protocol === 'file');
      await page.goto(protocol === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : `http://127.0.0.1:${server.address().port}/index.html`);
      await page.waitForFunction(() => document.documentElement.dataset.hazir === 'true');
      await page.evaluate(() => TD.ui.configure({ mode: 'local' }));
      report.push(...await checkPage(page, `${name}/${protocol}`));
      if (name === 'chromium' && protocol === 'file') {
        const session = await context.newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.setViewportSize({ width: 390, height: 844 });
        report.push(...await checkPage(page, 'chromium/file/4x-CPU-emulation', false));
        await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await session.detach();
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`${name}: 10 TÜDAF şeması, geri alma, dilimleme, giriş ve iptal; file:// + HTTP geçti.`);
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run('chromium', chromium, process.env.CHROMIUM_PATH);
    await run('webkit', webkit, process.env.WEBKIT_PATH);
    const output = path.join(root, 'docs/evidence');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'faz2-browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { server.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
