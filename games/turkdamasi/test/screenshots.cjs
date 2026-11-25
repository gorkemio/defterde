// Son görünüm kayıtları; oyun uygulaması bu araca bağımlı değildir.
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/gorseller');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => document.documentElement.dataset.hazir === 'true');
    await page.screenshot({ path: path.join(out, 'son-masaustu.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.hucre[data-kare="e3"]').click();
    await page.screenshot({ path: path.join(out, 'son-telefon.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.locator('#ayarlar-ac').click();
    await page.screenshot({ path: path.join(out, 'son-ayarlar.png'), fullPage: true });
    await page.locator('#ayarlar-kapat').click();
    await page.setViewportSize({ width: 1024, height: 1000 });
    await page.locator('#nasil').click();
    await page.screenshot({ path: path.join(out, 'son-nasil.png'), fullPage: true });
    await page.locator('[data-ornek="crown"]').click();
    await page.waitForFunction(() => TD.ui.tutorial() && !TD.ui.tutorial().running);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, 'son-ogretici.png'), fullPage: true });
    await page.locator('#oyuna-don').click();
    await page.evaluate(async () => {
      await TD.ui.configure({ mode: 'local' });
      const cells = Array(64).fill(0); cells[16] = 1; cells[24] = -1;
      // Tek taş beraberliği yerine son taş galibiyetini gösteren iki mavi.
      cells[9] = 1;
      await TD.ui.start(TD.board.position(cells, 1));
    });
    await page.locator('.hucre[data-kare="a3"]').click();
    await page.locator('.hucre[data-kare="a5"]').click();
    await page.waitForFunction(() => TD.ui.read().game.result);
    await page.screenshot({ path: path.join(out, 'son-sonuc.png'), fullPage: true });
    console.log('Altı son görünüm docs/gorseller altında kaydedildi.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
