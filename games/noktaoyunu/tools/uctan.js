// tools/uctan.js — tarayıcıda uçtan uca kontrol (Playwright; npm test'e dahil değil). Önizleme sunucusu açıkken:
//   node tools/uctan.js http://127.0.0.1:8143/ [chromium|webkit|firefox]
// Playwright bu projede kurulu değilse kardeş sos projesindeki kurulum kullanılır.
let pw; try { pw = require('playwright'); } catch (e) { pw = require('../../sos/node_modules/playwright'); } const chromium = pw[process.argv[3] || 'chromium'];
const URL = process.argv[2] || 'http://127.0.0.1:8143/';
const ekran = (p, x, y) => p.evaluate(([x, y]) => {        // SVG birimi → ekran
  const svg = document.querySelector('#kagit'), pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
  const q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y];
}, [x, y]);
const cizgiOrtasi = (p, e, kay = 0) => p.evaluate(([e, kay]) => {
  const O = NK.durum, [[r1, c1], [r2, c2]] = O.durum.G.KENAR_UC[e];
  const [x1, y1] = NK.draw.yer(O.l, r1, c1), [x2, y2] = NK.draw.yer(O.l, r2, c2);
  const svg = document.querySelector('#kagit'), pt = svg.createSVGPoint();
  pt.x = (x1 + x2) / 2 + (y1 === y2 ? 0 : kay); pt.y = (y1 + y2) / 2 + (y1 === y2 ? kay : 0);
  const q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y];
}, [e, kay]);
const bekleKilit = (p, ms = 20000) => p.waitForFunction(() => NK.durum && !NK.durum.kilit, null, { timeout: ms });
const durum = (p) => p.evaluate(() => { const d = NK.durum.durum; return { puan: d.puan.slice(), sira: d.sira, kalan: d.kalan, bitti: d.bitti, gecmis: NK.durum.gecmis.length, mod: NK.durum.oyunAyar.mod, boyut: NK.durum.oyunAyar.boyut, cizgi: NK.durum.S.cizgi.size, kutu: NK.durum.S.kutu.size, E: d.G.E, K: d.G.K }; });
const tamam = (k, m) => { if (!k) { console.log('HATA: ' + m); process.exitCode = 1; } else console.log('✔ ' + m); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  const p = await ctx.newPage();
  const hatalar = []; p.on('pageerror', e => hatalar.push(e.message)); p.on('console', m => { if (m.type() === 'error') hatalar.push(m.text()); });
  await p.goto(URL);
  await bekleKilit(p);
  let d = await durum(p);
  tamam(d.mod === 'bilgisayar' && d.sira === 0 && d.kalan === 40, 'ilk oyun: bilgisayara karşı, 5×5, sen başlarsın');

  // fareyle tam oyun: her sırada güvenli varsa güvenli, yoksa alınabilir, yoksa ilk çizgi (orta noktasına tıkla)
  let tik = 0;
  while (!(await durum(p)).bitti && tik < 200) {
    const e = await p.evaluate(() => { const B = NK.board, d = NK.durum.durum; return (B.alinabilir(d)[0] ?? B.guvenli(d)[0] ?? B.hamleler(d)[0]); });
    const [x, y] = await cizgiOrtasi(p, e, 3);
    await p.mouse.click(x, y);
    tik++;
    await p.waitForTimeout(50);
    await bekleKilit(p);
  }
  d = await durum(p);
  tamam(d.bitti && d.puan[0] + d.puan[1] === 16 && d.cizgi === 40 && d.kutu === 16, `tam oyun bitti ${d.puan.join('–')}, ${tik} tıklama`);
  tamam(await p.evaluate(() => !!document.querySelector('#kagit .ust .sonuc')), 'sonuç yazısı tahtada');

  // geri al: son insan hamlesinden önceki duruma
  const once = d.gecmis;
  await p.click('#geri-al');
  await bekleKilit(p);
  d = await durum(p);
  tamam(!d.bitti && d.gecmis === once - 1 && d.sira === 0, 'geri al: oyun sonundan döndü, sıra bende');
  tamam(await p.evaluate(() => !document.querySelector('#kagit .ust .sonuc')), 'sonuç silindi');
  await p.waitForTimeout(400);
  tamam(await p.evaluate(() => { const O = NK.durum; return O.S.cizgi.size === O.durum.G.E - O.durum.kalan && O.S.kutu.size === O.durum.puan[0] + O.durum.puan[1]; }), 'sahne durumla eşit (çizgi/kutu sayıları)');

  // köşede belirsiz dokunuş hiçbir şey çizmez; çok uzak dokunuş da
  const kalan0 = (await durum(p)).kalan;
  const [nx, ny] = await p.evaluate(() => { const O = NK.durum; const [x, y] = NK.draw.yer(O.l, 2, 2); const svg = document.querySelector('#kagit'), pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; });
  await p.mouse.click(nx, ny); await p.waitForTimeout(200);
  tamam((await durum(p)).kalan === kalan0, 'noktanın üstüne dokunuş belirsiz: çizgi yok');

  // yeni sayfa: başlayan değişir, sayfa temiz
  await p.click('#yeni-sayfa');
  await p.waitForTimeout(300);
  await bekleKilit(p);
  d = await durum(p);
  tamam(d.cizgi === d.E - d.kalan && d.gecmis === 0, `yeni sayfa: başlayan bilgisayar (kalan ${d.kalan})`);
  tamam(d.kalan < 40, 'bilgisayar ilk çizgiyi çekti');

  // ayarlar: iki kişi + 4×4 → başlamış oyunda bekler
  await p.click('#ayarlar-ac');
  await p.click('#ayarlar [data-deger="ikiKisi"]');
  await p.click('#ayarlar [data-deger="4x4"]');
  tamam(await p.evaluate(() => !document.querySelector('#yeni-not').hidden), '"yeni sayfada geçerli" notu');
  // harf değiştir
  await p.fill('#harf-0', 'ç');
  tamam(await p.evaluate(() => NK.durum.ayar.ikiHarf[0] === 'Ç'), 'harf girişi büyük Türkçe harfe çevrilir (Ç)');
  await p.click('#ayarlar-kapat');
  await p.click('#yeni-sayfa');
  await p.waitForTimeout(300);
  await bekleKilit(p);
  d = await durum(p);
  tamam(d.mod === 'ikiKisi' && d.boyut === '4x4' && d.E === 24 && d.kalan === 24, 'yeni sayfada iki kişi, 4×4');
  // iki kişi: üç çizgi, geri al tek çizgi
  const s0 = d.sira;
  for (const e of [0, 5, 10]) { const [x, y] = await cizgiOrtasi(p, e); await p.mouse.click(x, y); await p.waitForTimeout(30); await bekleKilit(p); }
  d = await durum(p);
  tamam(d.kalan === 21 && d.gecmis === 3, 'iki kişi: üç çizgi');
  await p.click('#geri-al'); await bekleKilit(p);
  d = await durum(p);
  tamam(d.kalan === 22 && d.sira !== undefined, 'iki kişi: geri al tek çizgi');
  tamam(await p.evaluate(() => /sıra: [ÇB]/.test(document.querySelector('#kagit .durum text').textContent)), 'durum satırı harfle "sıra: Ç/B"');

  // klavye: tahtaya odaklan, ok + Enter
  await p.keyboard.press('Tab');
  await p.focus('#tahta-alan');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  const k0 = (await durum(p)).kalan;
  await p.keyboard.press('Enter'); await p.waitForTimeout(50); await bekleKilit(p);
  tamam((await durum(p)).kalan === k0 - 1 || (await p.evaluate(() => NK.durum.durum.cizgi[NK.durum.imlec] === 1)), 'klavyeyle çizgi çekildi');

  // dokunmatik telefon: 375×667, tap
  const ctx2 = await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx2.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  const t = await ctx2.newPage();
  t.on('pageerror', e => hatalar.push('tel: ' + e.message));
  await t.goto(URL);
  await bekleKilit(t);
  const e1 = await t.evaluate(() => NK.board.guvenli(NK.durum.durum)[3]);
  const [tx, ty] = await cizgiOrtasi(t, e1, 8);                // çizgiden 8 birim (~13 px) uzağa dokun
  await t.touchscreen.tap(tx, ty);
  await t.waitForTimeout(100);
  tamam(await t.evaluate((e) => NK.durum.durum.cizgi[e] === 1, e1), 'telefonda dokunuş en yakın çizgiyi çekti');
  tamam(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'telefonda yatay kaydırma yok');
  await bekleKilit(t);
  await t.screenshot({ path: require('path').join(require('os').tmpdir(), 'nk-tel-oyun.png') });
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'nk-masa-oyun.png') });
  console.log(hatalar.length ? 'KONSOL: ' + hatalar.join(' | ') : '✔ konsol temiz');
  await b.close();
})();
