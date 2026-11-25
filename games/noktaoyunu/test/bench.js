// node test/bench.js — zor modun hamle süresi (5×5, 7×7), ulaşılan derinlik, dilim içi en uzun adım; son oyun çözücü süreleri.
// Test değil; elle çalıştırılır (npm run bench). Sonuçlar PLAN.md'ye yazılır.
const B = require('../board.js');
const C = require('../chains.js');
const A = require('../ai.js');

const simdi = () => performance.now();
function konum(m, n, cizili, tohum) {
  const r = A.rngYap(tohum), d = B.yeniOyun({ m, n });
  while (d.G.E - d.kalan < cizili) { const g = B.guvenli(d); if (!g.length) break; B.cek(d, g[Math.floor(r() * g.length)]); }
  return d;
}

// Üreteci elle sür: toplam süre ve iki yield arasındaki en uzun adım
function olc(d, o) {
  const A2 = require('../ai.js');
  const t0 = simdi();
  let enUzun = 0, son = t0, sonuc;
  const g = (function () { return A2._uretec ? A2._uretec(d, o) : null; })();
  if (!g) { sonuc = A.sec(d, o); return { toplam: simdi() - t0, enUzun: NaN, sonuc }; }
  for (;;) {
    const a = g.next(), t = simdi();
    enUzun = Math.max(enUzun, t - son); son = t;
    if (a.done) { sonuc = a.value; break; }
  }
  return { toplam: simdi() - t0, enUzun, sonuc };
}

console.log('zor, bütçe 800 ms (Node ' + process.version + ')');
console.log('tahta  çizili  güvenli  süre ms  en uzun adım ms  derinlik  düğüm');
for (const [m, n] of [[5, 5], [7, 7]]) {
  for (const oran of [0, .25, .45, .6]) {
    for (const tohum of [1, 2]) {
      const d = konum(m, n, Math.floor(d0(m, n) * oran), tohum);
      const g = B.guvenli(d).length;
      if (!g) continue;
      const { toplam, enUzun, sonuc } = olc(d, { zorluk: 'zor', rng: A.rngYap(tohum) });
      console.log(`${m}×${n}   ${String(d.G.E - d.kalan).padStart(5)}  ${String(g).padStart(7)}  ${toplam.toFixed(0).padStart(7)}  ${enUzun.toFixed(1).padStart(15)}  ${String(sonuc.derin ?? '-').padStart(8)}  ${sonuc.dugum ?? '-'}`);
    }
  }
}
function d0(m, n) { return B.geo(m, n).E; }

console.log('\nson oyun: güvenli hamle bitince (loony) orta/zor kararı');
for (const [m, n] of [[5, 5], [7, 7]]) {
  let enUzun = 0, sayi = 0, kesin = 0;
  for (let t = 0; t < 30; t++) {
    const d = konum(m, n, 999, 50 + t);
    const F = C.parcala(d).serbestKenar;
    const t0 = simdi();
    const s = A.sec(d, { zorluk: 'zor' });
    enUzun = Math.max(enUzun, simdi() - t0);
    sayi++;
    if (s.neden === 'kesin') kesin++;
    void F;
  }
  console.log(`${m}×${n}: ${sayi} konum, en uzun ${enUzun.toFixed(0)} ms, kesin aramayla ${kesin}`);
}

console.log('\ngeç orta oyun: 10–16 güvenli hamle (derin arama bölgesi)');
for (const [m, n] of [[5, 5], [6, 6], [7, 7]]) {
  let enUzunToplam = 0, enUzunAdim = 0, sayi = 0, derinlikler = [];
  for (let t = 0; t < 400 && sayi < 8; t++) {
    const r = A.rngYap(300 + t), d = B.yeniOyun({ m, n });
    for (;;) { const g = B.guvenli(d); if (g.length <= 16) break; B.cek(d, g[Math.floor(r() * g.length)]); }
    const g = B.guvenli(d).length;
    if (g < 10) continue;
    const { toplam, enUzun, sonuc } = olc(d, { zorluk: 'zor', rng: A.rngYap(t) });
    enUzunToplam = Math.max(enUzunToplam, toplam); enUzunAdim = Math.max(enUzunAdim, enUzun); derinlikler.push(sonuc.derin); sayi++;
  }
  console.log(`${m}×${n}: ${sayi} konum, en uzun hamle ${enUzunToplam.toFixed(0)} ms, en uzun adım ${enUzunAdim.toFixed(1)} ms, derinlik ${derinlikler.join(' ')}`);
}
