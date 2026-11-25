// scripts/sec.mjs — bölüm tohumlarını seçer ve data/bolumler.js'e yazar. Çıktı deterministik.
//   node scripts/sec.mjs
// Her defter (dikdörtgen, daire, altıgen, dokuma) için 20 seviye: boy ve algoritma config.bolum'dan. Her seviye için
// config.bolum.aday kadar tohum üretilir, metrikleri ve zorluk puanı hesaplanır. Hedef zorluk, seviyenin boy diliminde
// o boyun bütün adaylarının zorluk dağılımında %10'luk dilimden %90'lık dilime doğrusal ilerler ve bir önceki seviyeden
// düşük olamaz. Hedefe en yakın parAday aday arasında zorluğu en yakın olan seçilir; par'ı hesaplanır.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const C = require('../config.js'), G = require('../engine/generate.js'), S = require('../engine/solve.js'), R = require('../engine/rng.js');

const B = C.bolum, t0 = Date.now(), sonuc = {};
const dilimDegeri = (sirali, q) => sirali[Math.min(sirali.length - 1, Math.max(0, Math.round(q * (sirali.length - 1))))];

for (const tur of B.defterler) {
  // 1. adaylar
  const adaylar = [];
  for (let s = 1; s <= B.seviye; s++) {
    const boy = B.boy(s), alg = B.alg(s), liste = [];
    for (let k = 0; k < B.aday; k++) {
      const tohum = R.karma('bolum', tur, s, k) % R.TOHUM_EN, lab = G.uret({ tur, boy, alg, tohum }), m = S.metrikler(lab);
      liste.push({ tohum, kod: lab.kod, zorluk: S.zorluk(m), m });
    }
    adaylar.push({ s, boy, alg, liste });
  }
  // 2. boy dilimleri ve hedefler
  const boyDagilim = {};
  for (const a of adaylar) (boyDagilim[a.boy] = boyDagilim[a.boy] || []).push(...a.liste.map(x => x.zorluk));
  for (const k in boyDagilim) boyDagilim[k].sort((a, b) => a - b);
  const seviyeler = [];
  let onceki = -Infinity;
  for (const a of adaylar) {
    const ayni = adaylar.filter(x => x.boy === a.boy), j = ayni.indexOf(a), q = B.dilim[0] + (B.dilim[1] - B.dilim[0]) * (ayni.length > 1 ? j / (ayni.length - 1) : .5);
    const hedef = Math.max(dilimDegeri(boyDagilim[a.boy], q), onceki + 1e-9);
    const uygun = a.liste.filter(x => x.zorluk >= onceki);
    const havuz = (uygun.length ? uygun : a.liste).slice().sort((x, y) => Math.abs(x.zorluk - hedef) - Math.abs(y.zorluk - hedef)).slice(0, B.parAday);
    const sec = havuz[0];
    const par = S.par(G.uret(sec.kod));
    onceki = sec.zorluk;
    seviyeler.push({ seviye: a.s, kod: sec.kod, boy: a.boy, alg: a.alg, zorluk: +sec.zorluk.toFixed(2), hedef: +hedef.toFixed(2), par, cozum: sec.m.cozumUzunlugu, cikmaz: sec.m.cikmazSayisi });
  }
  sonuc[tur] = seviyeler;
}

const satirlar = Object.entries(sonuc).map(([tur, l]) => `  ${tur}: [\n${l.map(v => '    ' + JSON.stringify({ seviye: v.seviye, kod: v.kod, zorluk: v.zorluk, par: v.par, cozum: v.cozum })).join(',\n')},\n  ],`).join('\n');
const metin = `// data/bolumler.js — scripts/sec.mjs üretir; elle düzenleme. Her defterde 20 seviye, kolaydan zora.
// { seviye, kod, zorluk (engine/solve.js zorluk puanı), par (saniye), cozum (çözüm uzunluğu, geçit) }
(function (v) {
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).BOLUMLER = v;
  if (typeof module !== 'undefined' && module.exports) module.exports = v;
})({
${satirlar}
});
`;
writeFileSync(fileURLToPath(new URL('../data/bolumler.js', import.meta.url)), metin);
for (const [tur, l] of Object.entries(sonuc)) {
  console.log(`\n${C.tur[tur]} defteri`);
  console.log('sev  kod          boy alg  zorluk (hedef)   par  çözüm  çıkmaz');
  for (const v of l) console.log(`${String(v.seviye).padStart(3)}  ${v.kod}  ${v.boy}   ${v.alg}   ${String(v.zorluk).padStart(7)} (${String(v.hedef).padStart(7)})  ${String(v.par).padStart(4)}  ${String(v.cozum).padStart(5)}  ${String(v.cikmaz).padStart(6)}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} sn · data/bolumler.js`);
