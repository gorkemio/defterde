// Capture reference images separately from interaction tests. WebKit avoids
// Chrome/macOS's repeated viewport strips in full-page screenshots.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { webkit } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const shots = path.join(root, 'docs/screenshots/final');
const review = path.join(root, '.impeccable/review');

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  fs.mkdirSync(review, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  try {
    const sizes = [[1536,1024],[1440,1000],[1024,768],[600,800],[599,800],
      [320,800],[360,800],[390,844],[430,932],[844,390]];
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.evaluate(() => {
        Mangala.app.newGame({ mode: 'computer' }, { firstPlayer: 0 });
        return document.fonts.ready;
      });
      await page.screenshot({ path: path.join(shots, `board-${width}.png`), fullPage: true });
      await page.close();
    }
    for (const [id, name] of [['settings-open', 'settings-top-mobile'], ['help-open', 'help-top-mobile']]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.evaluate(() => {
        Mangala.app.newGame({ mode: 'local' }, { firstPlayer: 0 });
        return document.fonts.ready;
      });
      await page.locator(`#${id}`).click();
      await page.screenshot({ path: path.join(shots, `${name}.png`) });
      await page.close();
    }
    fs.copyFileSync(path.join(shots, 'board-1536.png'), path.join(shots, 'desktop.png'));
    for (const [from, to] of [['board-1440','desktop'], ['board-390','mobile'],
      ['board-320','mobile-320'], ['board-600','tablet-600'],
      ['settings-top-mobile','settings'], ['help-top-mobile','help']]) {
      fs.copyFileSync(path.join(shots, `${from}.png`), path.join(review, `${to}.png`));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
