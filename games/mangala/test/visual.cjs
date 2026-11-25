// Browser acceptance. No app dependency: node test/visual.cjs /path/to/playwright
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const pw = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const shots = path.join(root, 'docs/screenshots/final');
fs.mkdirSync(shots, { recursive: true });
const report = { date: new Date().toISOString(), cpu: os.cpus()[0].model,
  os: `${os.platform()} ${os.release()} ${os.arch()}`, completedEngines: [], checks: [], errors: [], unavailable: [], ai: [] };
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!filename.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(filename, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(filename)] || 'application/octet-stream');
    res.end(data);
  });
});
const initial = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
async function inspect(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const pits = [...document.querySelectorAll('.pit')], rects = pits.map(p => p.getBoundingClientRect());
    return { width: innerWidth, pageWidth: document.documentElement.scrollWidth, pits: pits.length,
      stones: document.querySelectorAll('[data-stone]').length,
      sum: [...document.querySelectorAll('.pit-count,.store-count')].reduce((s, el) => s + Number(el.textContent), 0),
      minTarget: Math.min(...rects.flatMap(r => [r.width, r.height])),
      selected: document.querySelectorAll('.pit[aria-pressed="true"]').length,
      labels: pits.every(p => p.getAttribute('aria-label').includes('taş')),
      fonts: ['Kalam', 'Marck Script'].every(f => document.fonts.check(`20px "${f}"`, 'ŞĞİçöü')),
      aligned: rects.slice(0, 6).every((r, i) => Math.abs(r.x - rects[i + 6].x) < 1) };
  });
}
async function reset(page, settings = { mode: 'local', sets: 1 }, firstPlayer = 0) {
  await page.evaluate(({ settings, firstPlayer }) => Mangala.app.newGame(settings, { firstPlayer }), { settings, firstPlayer });
}
async function snapshot(page) { return page.evaluate(() => Mangala.app.snapshot()); }
async function visibleCounts(page) {
  return page.evaluate(() => {
    const counts = [];
    document.querySelectorAll('.pit, .store').forEach(el => {
      counts[Number(el.dataset.position)] = Number(el.querySelector('.pit-count,.store-count').textContent);
    });
    return counts;
  });
}
async function runEngine(engine, browser, local) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce' });
  // Throwing storage must not stop startup or changes to settings/sound.
  await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(`${engine}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(`${engine}: ${m.text()}`); });
  page.on('request', r => { if (!/^(file:|data:|http:\/\/127\.0\.0\.1:)/.test(r.url())) report.errors.push(`External: ${r.url()}`); });
  page.on('requestfailed', r => report.errors.push(`Failed asset ${r.url()}: ${r.failure().errorText}`));
  const file = pathToFileURL(path.join(root, 'index.html')).href;
  const sizes = engine === 'chrome' ? [[1536,1024],[1440,1000],[1024,768],[600,800],[599,800],[320,800],[360,800],[390,844],[430,932],[844,390]] : [[1440,1000],[320,800],[390,844]];
  for (const url of [file, local]) {
    await page.goto(url);
    await reset(page, { mode: 'computer' });
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const result = await inspect(page);
      assert.equal(result.pits, 12); assert.equal(result.stones, 48); assert.equal(result.sum, 48);
      assert.equal(result.selected, 0); assert.ok(result.labels && result.fonts && result.aligned);
      assert.equal(result.pageWidth, width); assert.ok(result.minTarget >= 44);
      report.checks.push({ engine, version: browser.version(), protocol: url.startsWith('file') ? 'file' : 'http', height, ...result });
      if (engine === 'chrome' && url === file) {
        await page.evaluate(() => scrollTo(0, 0));
        // Chrome/macOS full-page tiling may duplicate viewport rows at short heights.
        const shortViewport = width === 600 || width === 844;
        if (width === 844) {
          const fresh = await context.newPage();
          await fresh.setViewportSize({ width, height });
          await fresh.goto(file);
          await reset(fresh, { mode: 'computer' });
          await fresh.evaluate(() => document.fonts.ready);
          await fresh.screenshot({ path: path.join(shots, `board-${width}.png`) });
          await fresh.close();
        } else await page.screenshot({ path: path.join(shots, `board-${width}.png`), fullPage: !shortViewport });
        if (shortViewport) {
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await page.screenshot({ path: path.join(shots, `board-${width}-bottom.png`) });
          await page.evaluate(() => scrollTo(0, 0));
        }
      }
    }
  }
  await reset(page);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await page.locator('#top-pits').getAttribute('aria-labelledby')) === 'top-row-label');
  assert.ok((await page.locator('#top-row-label').textContent()).includes('2. oyuncu'));
  const before = await snapshot(page);
  await page.locator('.pit[data-position="0"]').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.equal((await snapshot(page)).board.counts[1], 1);
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('.pit:focus').getAttribute('data-position'), '11');
  await page.locator('#undo').click();
  assert.deepEqual(await snapshot(page), before);

  // Tutorial owns an independent board and pauses computation.
  await page.locator('#help-open').click();
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'help-top-mobile.png'), fullPage: true });
  for (const index of ['0','1','2','3']) {
    await page.selectOption('#example-select', index);
    await page.locator('#example-play').click();
    assert.equal(await page.locator('#example-play').isDisabled(), true);
    assert.deepEqual(await snapshot(page), before);
  }
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'help-mobile.png'), fullPage: true });
  await page.locator('[data-close="help-dialog"]').click();
  await page.locator('#settings-open').click();
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'settings-top-mobile.png'), fullPage: true });
  await page.selectOption('[name="mode"]', 'local');
  await page.selectOption('[name="sets"]', '5');
  await page.check('[name="preview"]');
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'settings-mobile.png'), fullPage: true });
  await page.locator('#settings-form [type="submit"]').click();
  assert.equal((await snapshot(page)).settings.sets, 5);
  await page.locator('#sound').click(); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  await page.locator('#sound').click();

  // A complete five-set local match via the same controller called by buttons.
  await reset(page, { mode: 'local', sets: 5 });
  const full = await page.evaluate(async () => {
    let seed = 123456, moves = 0;
    for (let set = 1; set <= 5; set++) {
      while (Mangala.app.snapshot().board.status === 'playing' && moves < 1500) {
        const legal = Mangala.board.legalMoves(Mangala.app.snapshot().board);
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        await Mangala.app.play(legal[seed % legal.length]); moves++;
      }
      if (set < 5) document.getElementById('next-set').click();
    }
    return { match: Mangala.app.snapshot(), moves };
  });
  assert.equal(full.match.results.length, 5); assert.equal(full.match.board.status, 'finished');
  assert.ok(full.moves < 1500);
  assert.equal(await page.locator('#next-set').isVisible(), false);
  assert.equal(await page.locator('#result-note').isVisible(), true);
  assert.ok(await page.locator('#result-title').evaluate(el => {
    const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
  }), 'Keyboard focus must bring the completed result into view');
  assert.deepEqual(await visibleCounts(page), full.match.board.counts);
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'match-result.png'), fullPage: true });
  // Undo the terminal move removes exactly its result, and next-set clears history.
  await page.locator('#undo').click();
  assert.equal((await snapshot(page)).results.length, 4);
  assert.equal((await snapshot(page)).board.status, 'playing');

  // Animation, skip, resize, reduced motion converge. Undo/restart invalidate callbacks.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const route of ['normal', 'skip', 'resize', 'undo', 'restart']) {
    await reset(page);
    await page.evaluate(() => { void Mangala.app.play(3); });
    if (route === 'skip') await page.locator('#skip-animation').click();
    if (route === 'resize') await page.setViewportSize({ width: 360, height: 800 });
    if (route === 'undo') await page.locator('#undo').click();
    if (route === 'restart') await page.locator('#new-game').click();
    await page.waitForFunction(() => Mangala.app.activity() === 'idle');
    const state = (await snapshot(page)).board;
    assert.deepEqual(await visibleCounts(page), state.counts);
    assert.deepEqual(state.counts, route === 'undo' || route === 'restart' ? initial : [4,4,4,1,5,5,1,4,4,4,4,4,4,0]);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page, { mode: 'computer', difficulty: 'hard' });
  await page.evaluate(async () => { await Mangala.app.play(0); Mangala.app.undo(); });
  await page.waitForTimeout(900);
  assert.deepEqual((await snapshot(page)).board.counts, initial);
  await page.evaluate(() => { void Mangala.app.showHint(); Mangala.app.newGame({ mode: 'local' }, { firstPlayer: 1 }); });
  await page.waitForTimeout(900);
  assert.equal((await snapshot(page)).board.player, 1);
  assert.equal(await page.locator('.pit[aria-pressed="true"]').count(), 0);
  await reset(page, { mode: 'computer', difficulty: 'hard' }, 1);
  await page.locator('#help-open').click();
  const paused = await snapshot(page);
  await page.waitForTimeout(900);
  assert.deepEqual(await snapshot(page), paused);
  await page.locator('[data-close="help-dialog"]').click();
  await reset(page, { mode: 'computer', difficulty: 'easy' });
  const computerGame = await page.evaluate(async () => {
    let iterations = 0;
    while (Mangala.app.snapshot().board.status === 'playing' && iterations++ < 3000) {
      const state = Mangala.app.snapshot().board;
      if (state.player === 0 && Mangala.app.activity() === 'idle') await Mangala.app.play(Mangala.board.legalMoves(state)[0]);
      else await new Promise(resolve => setTimeout(resolve, 5));
    }
    return Mangala.app.snapshot();
  });
  assert.equal(computerGame.board.status, 'finished');
  assert.deepEqual(await visibleCounts(page), computerGame.board.counts);

  await reset(page, { mode: 'local' });
  await page.locator('#hint').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Mangala.app.activity() === 'idle');
  assert.equal(await page.locator('.pit[aria-pressed="true"]').count(), 1);
  assert.deepEqual((await snapshot(page)).board.counts, initial);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.pit[aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#move-note').textContent(), '');
  // Escape must also cancel an unfinished hint without applying a stale result.
  await page.locator('#hint').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(() => Mangala.app.activity()), 'idle');
  assert.equal(await page.locator('.pit[aria-pressed="true"]').count(), 0);
  assert.deepEqual((await snapshot(page)).board.counts, initial);
  // Representative stone caps and redraw stability, independent from the match.
  const same = await page.evaluate(() => {
    const before = document.querySelector('.board').innerHTML;
    Mangala.draw.render(Mangala.app.snapshot().board.counts);
    return before === document.querySelector('.board').innerHTML;
  });
  assert.equal(same, true);
  await page.evaluate(() => Mangala.draw.render([12,0,0,0,0,0,18,0,0,0,0,0,0,18]));
  assert.equal(await page.locator('.pit[data-position="0"] [data-stone]').count(), 8);
  assert.equal(await page.locator('[data-store-pile="6"] [data-stone]').count(), 12);
  if (engine === 'chrome') await page.screenshot({ path: path.join(shots, 'piles-mobile.png'), fullPage: true });
  await context.setOffline(true); await page.goto(file); await reset(page);
  assert.equal((await inspect(page)).sum, 48);
  report.checks.push({ engine, keyboard: 'passed', storageBlocked: 'passed', offlineFile: 'passed',
    fullLocalMatch: full.moves, fullComputerGame: 'passed', tutorial: 'passed',
    animationRoutes: 'passed', staleSearch: 'passed', hint: 'passed', representativePiles: 'passed' });
  await context.setOffline(false);
  if (engine === 'chrome') {
    await reset(page);
    const samples = await page.evaluate(async () => {
      const longTasks = [];
      const observer = new PerformanceObserver(list => list.getEntries().forEach(e => longTasks.push(e.duration)));
      observer.observe({ type: 'longtask', buffered: false });
      const samples = [];
      let state = Mangala.board.createInitialState();
      for (let i = 0; i < 8; i++) state = Mangala.board.applyMove(state, Mangala.board.legalMoves(state)[0], { events: false }).state;
      for (const difficulty of ['medium', 'hard']) for (const [name, s] of [['opening', Mangala.board.createInitialState()], ['middle', state]]) {
        samples.push({ difficulty, position: name, ...await Mangala.ai.search(s, { difficulty }) });
      }
      await new Promise(r => setTimeout(r, 50)); observer.disconnect();
      return { samples, longTasks, userAgent: navigator.userAgent };
    });
    report.ai = samples;
    await page.setViewportSize({ width: 1536, height: 1024 });
    await reset(page, { mode: 'computer' });
    await page.screenshot({ path: path.join(shots, 'desktop.png'), fullPage: true });
  }
  await context.close();
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const engine of ['chrome', 'webkit', 'firefox']) {
      let browser;
      try {
        browser = engine === 'chrome' ? await pw.chromium.launch({ channel: 'chrome', headless: true }) :
          await pw[engine].launch({ headless: engine !== 'firefox', timeout: 12000 });
      } catch (e) { report.unavailable.push({ engine, error: e.message }); continue; }
      try {
        await runEngine(engine, browser, `http://127.0.0.1:${server.address().port}/index.html`);
        report.completedEngines.push(engine);
      }
      catch (e) { report.errors.push(`${engine}: ${e.stack}`); }
      finally { await browser.close(); }
    }
  } finally {
    server.close();
    if (!report.completedEngines.length) report.errors.push('No browser completed acceptance checks.');
    report.status = report.errors.length ? 'failed' : report.unavailable.length ? 'partial' : 'passed';
    fs.writeFileSync('docs/browser-checks.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exitCode = 1;
  }
})();
