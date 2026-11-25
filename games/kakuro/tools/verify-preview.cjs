// Development-only browser checks. Set PLAYWRIGHT_MODULE to a local installation.
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/evidence');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4178/preview.html';
const report = { machine: `${os.platform()} ${os.arch()} ${os.cpus()[0].model}`, date: new Date().toISOString(), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const log = (name, details = {}) => report.checks.push({ name, ...details });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function metrics(page) {
  return page.evaluate(() => {
    const board = document.querySelector('#board'), viewport = document.querySelector('#board-viewport');
    const smallTargets = [...document.querySelectorAll('button:not(:disabled), select')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.9 || r.height < 43.9);
    }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent, width: el.offsetWidth, height: el.offsetHeight }));
    return {
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      cellSize: parseFloat(getComputedStyle(board).getPropertyValue('--cell-size')),
      boardWidth: board.getBoundingClientRect().width, scrollAreaWidth: viewport.clientWidth,
      whiteCells: board.querySelectorAll('.white').length,
      valueCount: board.querySelectorAll('.cell-value').length,
      noteCount: board.querySelectorAll('.cell-notes').length,
      selected: board.querySelector('.selected')?.dataset.index,
      fonts: ['Kalam', 'Patrick Hand'].map(family => ({ family, loaded: document.fonts.check(`20px "${family}"`) })),
      smallTargets,
    };
  });
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    report.chromium = browser.version();
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) errors.push(msg.text()); });
    await context.route('**/*', route => {
      const target = route.request().url();
      if (/^(https?:\/\/(127\.0\.0\.1|localhost)(:|\/)|file:|data:)/.test(target)) route.continue();
      else { errors.push(`Unexpected external request: ${target}`); route.abort(); }
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.selection-ink').waitFor();
    let m = await metrics(page);
    assert.equal(m.whiteCells, 30);
    assert.equal(m.valueCount, 0);
    assert.equal(m.noteCount, 0);
    assert.ok(m.fonts.every(f => f.loaded));
    await page.screenshot({ path: path.join(output, 'desktop-empty.png'), fullPage: true });
    log('Empty startup', m);

    await page.locator('#sample-view').click();
    m = await metrics(page);
    assert.equal(m.valueCount, 7);
    assert.equal(m.noteCount, 3);
    const drawing = await page.locator('.board-ground').innerHTML();
    await page.locator('.cell-button[data-index="30"]').click();
    await page.keyboard.press('ArrowRight');
    assert.equal((await metrics(page)).selected, '31');
    await page.keyboard.press('ArrowDown');
    assert.equal((await metrics(page)).selected, '38');
    await page.locator('#across-button').click();
    assert.equal(await page.locator('.board-ground').innerHTML(), drawing);
    log('Sample, arrow navigation and stable hatching');

    const double = page.locator('.clue-button[data-index="10"]');
    const bounds = await double.boundingBox();
    await double.click({ position: { x: bounds.width * .8, y: bounds.height * .2 } });
    assert.equal((await metrics(page)).selected, '11');
    assert.equal(await page.locator('#across-button').getAttribute('aria-pressed'), 'true');
    await double.click({ position: { x: bounds.width * .2, y: bounds.height * .8 } });
    assert.equal((await metrics(page)).selected, '17');
    assert.equal(await page.locator('#down-button').getAttribute('aria-pressed'), 'true');
    log('Both directions of a double clue');

    await page.locator('#help-button').click();
    assert.equal(await page.locator('#help-panel').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#help-panel').isVisible(), false);
    assert.equal(await page.locator('#help-button').evaluate(el => el === document.activeElement), true);
    log('Help and focus return');

    for (const width of [1536, 1280, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1024 });
      await page.locator('.cell-button[data-index="30"]').click();
      await page.locator('#across-button').click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      m = await metrics(page);
      assert.ok(m.documentWidth <= width, `Page overflow at ${width}: ${m.documentWidth}`);
      assert.ok(m.cellSize >= 44);
      assert.deepEqual(m.smallTargets, []);
      await page.screenshot({ path: path.join(output, `preview-${width}.png`), fullPage: true });
      log(`Responsive ${width}`, m);
    }

    await page.locator('#preview-size').selectOption('large');
    m = await metrics(page);
    assert.ok(m.whiteCells > 30);
    assert.equal(await page.locator('.cell').count(), 121);
    const first = page.locator('.cell-button').first();
    await first.click();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
    const selectedBounds = await page.locator('.selected .cell-button').boundingBox();
    const viewBounds = await page.locator('#board-viewport').boundingBox();
    assert.ok(selectedBounds.x >= viewBounds.x - 1 && selectedBounds.x + selectedBounds.width <= viewBounds.x + viewBounds.width + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'mobile-large-focus.png'), fullPage: true });
    log('11×11 keyboard selection scrolls into view', await metrics(page));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#preview-size').selectOption('small');
    await page.locator('#empty-view').click();
    assert.equal((await metrics(page)).valueCount, 0);
    const animations = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    assert.equal(animations, 0);
    log('Reduced motion', { runningAnimations: animations });

    // Narrower CSS viewport models the available width at 200% desktop zoom.
    await page.setViewportSize({ width: 640, height: 512 });
    await settle(page);
    m = await metrics(page);
    assert.ok(m.documentWidth <= 640);
    assert.ok(m.cellSize >= 44);
    log('640 CSS px reflow (200% equivalent for 1280)', m);
    assert.deepEqual(errors, []);
    log('Chromium HTTP console and external requests', { errors });
    await context.close();
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touch = await touchContext.newPage();
    await touch.goto(url);
    await touch.locator('.cell-button[data-index="30"]').tap();
    assert.equal((await metrics(touch)).selected, '30');
    await touch.locator('#sample-view').tap();
    assert.equal((await metrics(touch)).valueCount, 7);
    await touch.locator('#down-button').tap();
    assert.equal(await touch.locator('#down-button').getAttribute('aria-pressed'), 'true');
    log('Mobile touch: cell, example and direction');
    await touchContext.close();
    await browser.close();
    browser = null;

    for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
      const instance = await engine.launch({ headless: true });
      try {
        const ctx = await instance.newContext({ viewport: { width: 1280, height: 960 }, offline: true });
        const localPage = await ctx.newPage();
        const localErrors = [];
        localPage.on('pageerror', error => localErrors.push(error.message));
        await localPage.goto(pathToFileURL(path.join(root, 'preview.html')).href);
        await localPage.evaluate(() => document.fonts.ready);
        await localPage.locator('.selection-ink').waitFor();
        await localPage.locator('#sample-view').click();
        m = await metrics(localPage);
        assert.equal(m.valueCount, 7);
        assert.ok(m.fonts.every(f => f.loaded));
        assert.deepEqual(m.smallTargets, []);
        assert.deepEqual(localErrors, []);
        log(`${name} file:// offline`, { version: instance.version(), ...m, errors: localErrors });
        await ctx.close();
      } finally { await instance.close(); }
    }
    report.pass = true;
  } catch (error) {
    report.pass = false;
    report.errors.push(error.stack);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(output, 'browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
})();
