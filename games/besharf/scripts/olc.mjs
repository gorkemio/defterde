#!/usr/bin/env node
// scripts/olc.mjs — çözücü ölçümleri. Her satır ✓/✗; herhangi ✗ → çıkış kodu 1.
//   A örüntü ≡ game.geriBildirim (1000 rastgele çift)
//   B tutarlılık: 500 tohumlu oyunda gerçek cevap her adımda aday kümesinde (kolay/orta/zor dönüşümlü)
//   C Zor seviyenin bütün cevap listesindeki ortalama tahmin sayısı (< 4)
//   D öneri süresi: ilk tahminden sonraki öneri (50 rastgele açılış; node sınırı 100 ms ≈ telefonda 300 ms, ×3 varsayımı)
//   E cevaplar ⊂ tahminler
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../engine/solver.js');
const G = require('../engine/game.js');
const D = require('../engine/daily.js');
const C0 = require('../config.js');

const TV = require('../data/tahminler.js');
const tahminler = TV.liste.split('\n');
const onerilmez = TV.onerilmez ? TV.onerilmez.split('\n') : [];
const cevaplar = D.cozCevaplar(require('../data/cevaplar.js'));
const oneriler = require('../data/oneriler.js');
const C = S.kur({ tahminler, cevaplar, oneriler, onerilmez, havuz: C0.havuz });
const r = S.rng(20261020);
const sec = (l) => l[Math.floor(r() * l.length)];
let hata = 0;
const satir = (ok, metin) => { if (!ok) hata++; console.log(`${metin} ${ok ? '✓' : '✗'}`); };
const t0 = Date.now();

// A
let esit = 0;
for (let i = 0; i < 1000; i++) {
  const t = sec(tahminler), c = sec(cevaplar);
  if (S.oruntuKodla(G.geriBildirim(t, c)) === S.oruntu(t, c)) esit++;
}
satir(esit === 1000, `A örüntü ≡ geriBildirim: ${esit}/1000 çift`);

// B
const seviyeler = ['kolay', 'orta', 'zor'];
let tutarli = 0, bOyun = 0;
for (let o = 0; o < 500; o++) {
  const cevap = sec(cevaplar), ci = C.dizin(cevap), seviye = seviyeler[o % 3];
  let A = C.cevapIdx, ok = true;
  const gecmis = [];
  for (let k = 0; k < 8; k++) {
    if (!A.includes(ci)) { ok = false; break; }
    const t = C.duelloHamle(seviye, A, S.hamleRng(o, k), { gecmis });
    const kod = C.oruntu(t.idx, ci);
    if (kod === S.HEPSI_DOGRU) break;
    gecmis.push({ kelime: t.kelime, kod });
    A = C.suz(A, t.idx, kod);
  }
  bOyun++;
  if (ok) tutarli++;
}
satir(tutarli === bOyun, `B tutarlılık: ${tutarli}/${bOyun} tohumlu oyunda cevap her adımda aday kümesinde kaldı (kolay/orta/zor dönüşümlü)`);

// C
const dag = new Array(11).fill(0);
let toplam = 0, enUzun = 0, basarisiz = 0;
for (const c of cevaplar) {
  const n = C.coz(C.dizin(c)).length;
  dag[Math.min(n, 10)]++;
  toplam += n;
  enUzun = Math.max(enUzun, n);
  if (n > 6) basarisiz++;
}
const ort = toplam / cevaplar.length;
satir(ort < 4, `C Zor ortalama ${ort.toFixed(3)} tahmin (sınır < 4) · dağılım ${dag.map((v, i) => (v && i ? `${i}:${v}` : '')).filter(Boolean).join(' ')} · 6'yı aşan ${basarisiz} · en uzun ${enUzun}`);

// D
const sureler = [], nler = [];
for (let i = 0; i < 50; i++) {
  const acilis = sec(tahminler.slice(0, 3000)), cevap = sec(cevaplar);
  const A = C.suz(C.cevapIdx, C.dizin(acilis), C.oruntu(acilis, cevap));
  if (A.length < 2) continue;
  const z = process.hrtime.bigint();
  C.oner(A, { gecmis: [{ kelime: acilis, kod: -1 }] });
  sureler.push(Number(process.hrtime.bigint() - z) / 1e6);
  nler.push(A.length);
}
sureler.sort((a, b) => a - b); nler.sort((a, b) => a - b);
const orta = sureler[Math.floor(sureler.length / 2)], enCok = sureler[sureler.length - 1];
satir(enCok < 100, `D öneri süresi, 2. adım (${sureler.length} rastgele açılış, aday ortanca ${nler[Math.floor(nler.length / 2)]}, en çok ${nler[nler.length - 1]}): ortanca ${orta.toFixed(1)} ms · en çok ${enCok.toFixed(1)} ms (node sınırı 100 ms ≈ telefonda 300 ms)`);

// E
const T = new Set(tahminler);
const alt = cevaplar.filter((c) => T.has(c)).length;
satir(alt === cevaplar.length, `E cevaplar ⊂ tahminler: ${alt}/${cevaplar.length} · toplam süre ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
process.exit(hata ? 1 : 0);
