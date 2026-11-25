// tools/bulmaca-uret.js — "bu konumda kazan" bulmacaları üretir ve doğrular; bulmacalar.js'i yazar.
//   node tools/bulmaca-uret.js            → bulmacalar.js (20 bulmaca: 7 kolay · 7 orta · 6 zor)
//   node tools/bulmaca-uret.js --kuru     → yalnız yazdırır
// Yöntem: tohumlu rastgele güvenli oyun güvenli hamle bitene dek oynanır (henüz hiç kutu alınmamıştır); konum saf
// (kavşaksız) zincir/döngü kümesiyse ve sırası gelen (insan) en iyi oyunla kazanıyorsa, ama en az bir ilk hamle
// kaybettiriyorsa adaydır. Zorluk, kazanmak için gerekenden:
//   kolay: kolay bilgisayarın yolu (hep hepsini al, en kısayı aç) da kazanır — yalnız doğru açma sırası
//   orta:  kazanan yolda en az bir kez "ikisi hariç" gerekir
//   zor:   "dördü hariç" gerekir ya da kazanan yol hem ret hem çok parça (≥ 4) ister
const fs = require('fs'), path = require('path');
const B = require('../board.js'), C = require('../chains.js'), A = require('../ai.js');

const HEDEF = { kolay: 7, orta: 7, zor: 6 };
const BOYUTLAR = [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6]];

function loony(m, n, r) {
  const d = B.yeniOyun({ m, n });
  for (;;) { const g = B.guvenli(d); if (!g.length) return d; B.cek(d, g[Math.floor(r() * g.length)]); }
}

// Sıradaki (insan) karar verici f ile, rakip kesin (zor) oynarken sonuç: insanın net farkı ve insanın retleri
function oyna(d0, f) {
  const d = B.kopya(d0), retler = [];
  while (!d.bitti) {
    let e;
    if (d.sira === 0) {
      e = f(d);
      if (B.alinabilir(d).length && !B.kapatir(d, e)) retler.push(C.parcala(d).parcalar.find(p => p.acik)?.uzunluk ?? 2);
    } else e = A.sec(d, { zorluk: 'zor', butceMs: 200 }).e;
    B.cek(d, e);
  }
  return { fark: d.puan[0] - d.puan[1], retler };
}

const kesin = (d) => { const t = C.tahtaCoz(d, { sinir: 24 }); return t ? t.hamle : A.sec(d, { zorluk: 'zor' }).e; };
const kolayYol = (d) => A.sec(d, { zorluk: 'kolay', rng: () => 0 }).e;

// İlk hamlelerden en az biri kaybettiriyor mu (parça düzeyinde: her parçanın her açılışı)
function kaybettirenVar(d) {
  const P = C.parcala(d).parcalar;
  return P.some((p, i) => [p.tur === 'dongu' ? 'dongu' : 'uc', ...(p.uzunluk === 2 ? ['orta'] : [])].some(b => -C.cevap(P, i, b).deger < 0));
}

function uret() {
  const r = A.rngYap(20261020), secilen = { kolay: [], orta: [], zor: [] }, gorulen = new Set();
  for (let deneme = 0; deneme < 60000; deneme++) {
    if (Object.keys(HEDEF).every(z => secilen[z].length >= HEDEF[z])) break;
    const [m, n] = BOYUTLAR[deneme % BOYUTLAR.length];
    const d = loony(m, n, r);
    d.sira = 0;
    d.baslayan = 0;
    const P = C.parcala(d);
    if (!P.saf || P.parcalar.length < 2 || P.serbestKenar > 30) continue;
    const V = C.coz(P.parcalar).deger;
    if (V <= 0 || !kaybettirenVar(d)) continue;
    const t = P.serbestKenar <= 22 ? C.tahtaCoz(d) : null;
    if (t && t.deger !== V) throw new Error('çözücüler uyuşmuyor');
    const enIyi = oyna(d, kesin);
    if (enIyi.fark !== V) throw new Error(`kesin oyun ${enIyi.fark}, beklenen ${V}`);
    const kolayca = oyna(d, kolayYol).fark > 0;
    const donguRet = enIyi.retler.some(k => k >= 4), ret = enIyi.retler.length > 0;
    const zorluk = kolayca ? 'kolay' : donguRet || (ret && P.parcalar.length >= 4) ? 'zor' : ret ? 'orta' : null;
    if (!zorluk || secilen[zorluk].length >= HEDEF[zorluk]) continue;
    // aynı zorlukta aynı desen bir kez: 1–4'lük zincirler olduğu gibi, daha uzunlar "U", döngüler "D" (çeşitlilik için)
    const imza = zorluk + ':' + P.parcalar.map(p => (p.tur === 'dongu' ? 'D' : p.uzunluk >= 5 ? 'U' : String(p.uzunluk))).sort().join(',');
    if (gorulen.has(imza)) continue;
    gorulen.add(imza);
    secilen[zorluk].push({
      m, n, zorluk, deger: V,
      parcalar: P.parcalar.map(p => (p.tur === 'dongu' ? 'döngü ' : '') + p.uzunluk).join(' · '),
      bos: B.hamleler(d).map(e => d.G.kenarAdi(e)),
    });
  }
  return ['kolay', 'orta', 'zor'].flatMap(z => secilen[z].sort((a, b) => a.m * a.n - b.m * b.n));
}

const liste = uret();
const sayi = (z) => liste.filter(b => b.zorluk === z).length;
console.log(`${liste.length} bulmaca: kolay ${sayi('kolay')} · orta ${sayi('orta')} · zor ${sayi('zor')}`);
liste.forEach((b, i) => console.log(`${String(i + 1).padStart(2)} ${b.zorluk.padEnd(5)} ${b.m}×${b.n}  +${b.deger}  ${b.parcalar}`));
if (!process.argv.includes('--kuru')) {
  const js = `// bulmacalar.js — tools/bulmaca-uret.js üretti (elle düzenleme). "Bu konumda kazan": sıra sende, güvenli hamle kalmadı.
// Her bulmaca: m × n nokta, bos = çekilmemiş çizgiler (gerisi çekili, henüz kutu alınmadı), deger = en iyi oyunla kutu farkı.
(function () {
  'use strict';
  const BULMACALAR = ${JSON.stringify(liste, null, 1).replace(/\n\s*/g, ' ').replace(/\{ /g, '\n  { ').replace(/ \]$/, '\n]')};
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).bulmacalar = BULMACALAR;
  if (typeof module !== 'undefined' && module.exports) module.exports = BULMACALAR;
})();
`;
  fs.writeFileSync(path.join(__dirname, '..', 'bulmacalar.js'), js);
  console.log('bulmacalar.js yazıldı');
}
