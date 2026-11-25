// tools/olc.js — geliştirme: ?olc=1 ölçüm düzeneğini başsız Chromium'da çalıştırır (isteğe bağlı CPU yavaşlatma).
// Kullanım: node tools/olc.js [yavaslatma=1] [genislik=390]
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../sos/node_modules/playwright'));
const yav = +process.argv[2] || 1, w = +process.argv[3] || 390;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: w < 720, hasTouch: w < 720 });
  const cdp = await p.context().newCDPSession(p);
  if (yav > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: yav });
  const sonuc = new Promise((coz) => p.on('console', (m) => { if (m.text().startsWith('ölçüm')) coz(m.text()); }));
  await p.goto('file://' + path.join(__dirname, '../index.html?olc=1'));
  console.log(`genişlik ${w}, CPU ×${yav}:`, await sonuc);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
