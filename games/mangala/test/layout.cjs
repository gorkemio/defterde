// Compact-layout regression: node test/layout.cjs /path/to/playwright
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const pw = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const sizes = [[320,568],[360,640],[390,844],[430,932],[599,800],
  [600,600],[768,600],[1024,768],[1280,720],[1440,900],[844,390]];

async function measure(page) {
  return page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const targets = [...document.querySelectorAll('.pit, .footer-line button')]
      .map(element => element.getBoundingClientRect());
    return {
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      boardTop: rect('.board').top,
      commandsBottom: rect('.footer-line').bottom,
      commandCount: document.querySelectorAll('.footer-line button').length,
      minTarget: Math.min(...targets.flatMap(r => [r.width, r.height]))
    };
  });
}

(async () => {
  const report = { date: new Date().toISOString(), checks: [] };
  for (const engine of ['chromium', 'webkit']) {
    const browser = await pw[engine].launch({ headless: true });
    try {
      for (const [width, height] of sizes) {
        const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
        try {
          await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
          await page.evaluate(async () => {
            Mangala.app.newGame({ mode: 'computer', sets: 1 }, { firstPlayer: 0 });
            await document.fonts.ready;
          });
          const initial = await measure(page);
          const label = `${engine} ${width}×${height}`;
          assert.equal(initial.pageWidth, width, `${label}: horizontal overflow`);
          assert.equal(initial.commandCount, 6, `${label}: all commands remain available`);
          assert.ok(initial.minTarget >= 44, `${label}: touch targets below 44px`);
          assert.ok(initial.boardTop >= 0 && initial.commandsBottom <= height,
            `${label}: board and commands must fit the initial viewport`);
          // On the two shortest windows only the mode note / paper edge may
          // need a small scroll. No fixed height or clipping masks content.
          const allowance = width === 320 ? 32 : height < 400 ? 16 : 0;
          assert.ok(initial.pageHeight <= height + allowance, `${label}: excessive page scrolling`);

          await page.evaluate(async () => {
            Mangala.app.newGame({ mode: 'local', sets: 5 }, { firstPlayer: 0 });
            await Mangala.app.play(3);
          });
          const played = await measure(page);
          assert.equal(played.pageWidth, width, `${label}: match text causes overflow`);
          assert.ok(played.minTarget >= 44, `${label}: match touch targets shrink`);
          await page.locator('#settings-open').click();
          assert.ok(await page.locator('#settings-dialog').isVisible());
          await page.keyboard.press('Escape');
          await page.locator('#undo').click();
          assert.deepEqual(await page.evaluate(() => Mangala.app.snapshot().board.counts),
            [4,4,4,4,4,4,0,4,4,4,4,4,4,0]);
          report.checks.push({ engine, version: browser.version(), width, height, ...initial });
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(root, 'docs/layout-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.checks.length} compact layout checks passed (Chromium + WebKit).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
