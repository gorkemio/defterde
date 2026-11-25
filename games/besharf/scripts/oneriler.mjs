#!/usr/bin/env node
// scripts/oneriler.mjs — ilk tahmin önerisini ve açılışın 243 örüntüsüne en iyi ikinci tahmini önceden hesaplar → data/oneriler.js
//   node scripts/oneriler.mjs          (kelime listesi değişince yeniden çalıştırılır)
// İlk adım tam havuz (tahmin listesinin en sık 6000'i ∪ cevaplar) × bütün cevaplar; ikinci adım her kovada aynı havuz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../engine/solver.js');
const D = require('../engine/daily.js');
const C0 = require('../config.js');

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TV = require('../data/tahminler.js');
const tahminler = TV.liste.split('\n');
const onerilmez = TV.onerilmez ? TV.onerilmez.split('\n') : [];
const cevaplar = D.cozCevaplar(require('../data/cevaplar.js'));
const C = S.kur({ tahminler, cevaplar, onerilmez, havuz: C0.havuz });

const t0 = Date.now();
const ilkListe = C.oner(C.cevapIdx, { enIyi: 10, havuz: Math.min(C0.havuz, C.n) });
const ilk = ilkListe[0];
const ikinci = {};
for (const [kod, grup] of C.kovalar(ilk.idx, C.cevapIdx)) {
  if (kod === S.HEPSI_DOGRU) continue;
  const A = Uint16Array.from(grup);
  ikinci[kod] = C.oner(A, { havuz: Math.min(C0.havuz, C.n) })[0].kelime;
}
const sure = Date.now() - t0;
const v = { ilk: ilk.kelime, entropi: Number(ilk.entropi.toFixed(4)), beklenen: Number(ilk.beklenen.toFixed(2)),
  adaylar: ilkListe.map((x) => x.kelime), ikinci };
const metin = `// data/oneriler.js — scripts/oneriler.mjs üretti; elle düzenleme. ${new Date().toISOString().slice(0, 10)}
// İlk tahmin önerisi (en yüksek beklenen bilgi, ${v.entropi} bit; ortalama ${v.beklenen} aday bırakır) ve açılışın her örüntüsüne
// (0–242) en iyi ikinci tahmin. Havuz: tahmin listesinin en sık ${C0.havuz} kelimesi ∪ cevaplar.
(function () {
  'use strict';
  var v = ${JSON.stringify(v)};
  if (typeof window !== 'undefined') ((window.BH = window.BH || {}).veri = window.BH.veri || {}).oneriler = v;
  if (typeof module !== 'undefined' && module.exports) module.exports = v;
})();
`;
fs.writeFileSync(path.join(kok, 'data', 'oneriler.js'), metin);
console.log(`ilk öneri ${v.ilk} (${v.entropi} bit, beklenen ${v.beklenen}) · ilk 10: ${v.adaylar.join(' ')} · ikinci adım ${Object.keys(ikinci).length} örüntü · ${sure} ms`);
