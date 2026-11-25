// tools/ekran.js — geliştirme: karşılaştırma sayfasının ve oyunun ekran görüntülerini docs/ altına basar.
// Playwright kardeş projeden ödünç alınır (../../sos/node_modules). Kullanım: node tools/ekran.js [faz1|son]
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../sos/node_modules/playwright'));
const kok = path.join(__dirname, '..'), ad = process.argv[2] || 'faz1';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1340, height: 1900 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(kok, 'docs/karsilastirma.html'));
  await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(kok, `docs/karsilastirma-${ad}.png`), fullPage: true });
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.goto('file://' + path.join(kok, 'index.html#ornek'));
  await m.waitForTimeout(2500);
  await m.screenshot({ path: path.join(kok, `docs/telefon-${ad}.png`) });
  await b.close();
  console.log('docs/karsilastirma-' + ad + '.png, docs/telefon-' + ad + '.png');
})().catch((e) => { console.error(e); process.exit(1); });
