// scripts/ekran.cjs — ekran görüntüleri (docs/). Oyun bu araca bağımlı değildir; Playwright yerelde kurulu bir projeden okunur:
//   PLAYWRIGHT_PATH=../defterde/node_modules/playwright node scripts/ekran.cjs [faz1 | son]
//   faz1: kit vitrini (#vitrin). son: gerçek oyun — telefonda oyun ortası ve bitiş, masaüstü, gri tonlama.
// Her iki durumda: renk körlüğü öykünmeleri (Chromium) ve diğer Defterde oyunlarıyla yan yana karşılaştırma.
// Sayfa file:// ile ve çevrimdışı açılır (çift tıklama koşulu ve "dış istek yok" da sınanır).
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const kok = path.resolve(__dirname, '..');
const docs = path.join(kok, 'docs');
const ad = process.argv[2] || 'son';
const KARDESLER = ['kibrit', 'turkdamasi', 'adamasmaca', 'tangram'];
const ORNEK = ['KENAR', 'SALON', 'BİREY'];

async function hazirBekle(page, ms = 20000) {
  await page.waitForFunction(() => document.documentElement.dataset.hazir === 'true', null, { timeout: ms });
  await page.waitForTimeout(300);
}

// Oyun durumu: ilk açılış notunu kapatır, örnek tahminleri ekran tuşlarıyla yazar (cevap olanı atlar)
async function oyunHazirla(p, bitir = false) {
  await p.waitForTimeout(1100);                                   // ilk açılışta Nasıl oynanır fişi 0,9 sn sonra açılır
  await p.evaluate(() => BH.not.kapat());
  const cevap = await p.evaluate(() => BH.akis.durum.cevap);
  for (const k of ORNEK.filter((x) => x !== cevap)) {
    for (const h of Array.from(k)) await p.click(`#klavye button.tus[data-harf="${h}"]`);
    await p.click('#klavye button.tus[data-tus="enter"]');
    await p.waitForTimeout(250);
  }
  if (bitir) {
    for (const h of Array.from(cevap)) await p.click(`#klavye button.tus[data-harf="${h}"]`);
    await p.click('#klavye button.tus[data-tus="enter"]');
    await p.waitForTimeout(600);
    await p.evaluate(() => BH.not.kapat());
  }
  await p.waitForTimeout(300);
}

async function main() {
  fs.mkdirSync(path.join(docs, 'karsilastirma'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const hatalar = [];
  const izle = (p) => { p.on('pageerror', (e) => hatalar.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); }); };
  const url = pathToFileURL(path.join(kok, 'index.html')).href + (ad === 'faz1' ? '#vitrin' : '');
  const baglam = async (w, h, dpr) => { const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, reducedMotion: 'reduce' }); await c.setOffline(true); return c; };
  try {
    // Telefon (360 × 640)
    const tel = await baglam(360, 640, 2);
    const p = await tel.newPage(); izle(p);
    await p.goto(url); await hazirBekle(p);
    if (ad !== 'faz1') await oyunHazirla(p);
    await p.screenshot({ path: path.join(docs, `${ad}.png`) });
    const olcu = await p.evaluate(() => ({ kaydirma: document.documentElement.scrollHeight, s: BH.sahne.olcu.s,
      tus: [...document.querySelectorAll('button.tus')].map((b) => [b.offsetWidth, b.offsetHeight]) }));
    await p.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    await p.screenshot({ path: path.join(docs, `${ad}-gri.png`) });
    if (ad !== 'faz1') {
      const b = await (await baglam(360, 640, 2)).newPage(); izle(b);
      await b.goto(url); await hazirBekle(b); await oyunHazirla(b, true);
      await b.screenshot({ path: path.join(docs, `${ad}-bitis.png`) });
    }

    // Renk körlüğü (1x: yalnız yan yana sayfa için)
    const kucuk = await baglam(360, 640, 1);
    const pk = await kucuk.newPage(); izle(pk);
    await pk.goto(url); await hazirBekle(pk);
    if (ad !== 'faz1') await oyunHazirla(pk);
    await pk.screenshot({ path: path.join(docs, 'karsilastirma', 'besharf.png') });
    const cdp = await kucuk.newCDPSession(pk);
    for (const tur of ['achromatopsia', 'deuteranopia', 'protanopia', 'tritanopia']) {
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: tur });
      await pk.waitForTimeout(200);
      await pk.screenshot({ path: path.join(docs, 'karsilastirma', `besharf-${tur}.png`) });
    }

    // Masaüstü
    const m = await (await baglam(1280, 900, 1)).newPage(); izle(m);
    await m.goto(url); await hazirBekle(m);
    if (ad !== 'faz1') await oyunHazirla(m);
    await m.screenshot({ path: path.join(docs, `${ad}-masaustu.png`) });

    // Diğer Defterde oyunları: aynı telefon boyutunda ilk ekran
    const kard = await baglam(360, 640, 1);
    for (const oyun of KARDESLER) {
      const yol = path.join(kok, '..', oyun, 'index.html');
      if (!fs.existsSync(yol)) continue;
      const q = await kard.newPage();
      await q.goto(pathToFileURL(yol).href);
      await q.waitForTimeout(3500);
      await q.screenshot({ path: path.join(docs, 'karsilastirma', `${oyun}.png`) });
      await q.close();
    }

    // Yan yana sayfa: docs/karsilastirma.html → docs/karsilastirma-<ad>.png
    const s = await (await browser.newContext({ viewport: { width: 1520, height: 820 } })).newPage();
    await s.goto(pathToFileURL(path.join(docs, 'karsilastirma.html')).href);
    await s.waitForTimeout(500);
    await s.screenshot({ path: path.join(docs, `karsilastirma-${ad}.png`), fullPage: true });

    console.log(JSON.stringify({ olcu: { kaydirma: olcu.kaydirma, s: olcu.s, enDarTus: Math.min(...olcu.tus.map((t) => t[0])),
      enKisaTus: Math.min(...olcu.tus.map((t) => t[1])) }, hatalar }, null, 1));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
