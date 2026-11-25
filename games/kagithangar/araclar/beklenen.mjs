// tasarimlar/*.json üretir ve `beklenen` alanını motorun çıktısıyla doldurur.
//   node araclar/beklenen.mjs                  → kaynaktan yaz (tasarimlar-kaynak.mjs)
//   node araclar/beklenen.mjs --yalniz-beklenen → mevcut JSON'ların yalnız beklenen alanını yenile
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uygula, kutu, enKalin } from '../engine/fold.js';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const klasor = path.join(kok, 'tasarimlar');
const yalniz = process.argv.includes('--yalniz-beklenen');

const yuvarla = (v) => Math.round(v * 1e4) / 1e4;
const sayilar = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1e12) / 1e12 : x)));

// Okunur JSON: her adım tek satır.
function yaz(t) {
  const { adimlar, ...ust } = t;
  const satirlar = Object.entries(ust).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const adimSatir = adimlar.map(a => '    ' + JSON.stringify(a)).join(',\n');
  return '{\n' + satirlar.join(',\n') + ',\n  "adimlar": [\n' + adimSatir + '\n  ]\n}\n';
}

const tasarimlar = yalniz
  ? fs.readdirSync(klasor).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(klasor, f), 'utf8')))
  : (await import('./tasarimlar-kaynak.mjs')).default.map(sayilar);

import { dogrula } from '../engine/tasarim.js';
for (const t of tasarimlar) {
  const hatalar = dogrula(t);
  if (hatalar.length) throw new Error(`${t.id}: ${hatalar.join('; ')}`);
  const r = uygula(t);
  t.beklenen = { poligon: r.son.poligonlar.length, kutu: kutu(r.son).map(yuvarla), enKalin: enKalin(r.son) };
  if (!('ucusGorunumu' in t)) t.ucusGorunumu = null;
  const { adimlar, ...geri } = t;
  fs.writeFileSync(path.join(klasor, t.id + '.json'), yaz({ ...geri, adimlar }));
  console.log(t.id.padEnd(8), JSON.stringify(t.beklenen), `adım ${t.adimlar.length}, hareket ${r.hareketler.length}`);
}
