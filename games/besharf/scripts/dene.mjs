#!/usr/bin/env node
// scripts/dene.mjs — kelimeleri dener: cevap mı, tahmin mi, neden. Kullanıcının "aklıma gelen 50 kelime" denemesi için.
//   node scripts/dene.mjs kalem geldi lorna …        (büyük/küçük harf ve şapka fark etmez)
// Reddedilen doğal bir kelime, scripts/elle-ekle.txt [tahmin] bölümüne yazılır ya da ek tablosu genişletilir.
import { hat, SIKLIK_SINIRI } from './kelimeler.mjs';
import { tr, TUR_ADI } from './suzgec.mjs';
import { aciklama } from './ekler.mjs';

const kelimeler = process.argv.slice(2).map((k) => tr.normalize(k)).filter(Boolean);
if (!kelimeler.length) { console.log('kullanım: node scripts/dene.mjs kelime1 kelime2 …'); process.exit(0); }
const H = await hat();
const cevap = new Set(H.cevaplar.map((c) => c.kelime));
const red = new Map(H.reddedilen.map((r) => [r.kelime, r]));
let kabul = 0;
for (const k of kelimeler) {
  const uz = Array.from(k).length, sira = H.siklik.get(k);
  const t = H.tahmin.get(k);
  let satir;
  if (uz !== 5) satir = `✗ ${uz} harf`;
  else if (t) {
    kabul++;
    const neden = t.kaynak === 'madde' ? `madde başı (${TUR_ADI[(H.gruplar.get(k) || { maddeler: [{}] }).maddeler[0].tur] || ''})`
      : t.kaynak === 'cekim' ? 'çekimli: ' + aciklama(k, t.analiz) : 'elle eklendi';
    satir = `✓ tahmin · ${neden}${cevap.has(k) ? ' · CEVAP' : ''}`;
    if (!cevap.has(k) && H.gruplar.has(k)) {
      const a = H.adaylar.find((x) => x.g.kelime === k);
      satir += a ? ` · cevap değil: ${a.k.neden}` : ` · cevap değil: ${sira && sira <= SIKLIK_SINIRI ? 'süzgeç (rapora bak)' : 'seyrek ya da süzgeç'}`;
    }
  } else if (red.has(k)) satir = `✗ ${red.get(k).neden}`;
  else if (H.gruplar.has(k)) satir = '✗ madde başı reddedildi (kaba/hakaret ya da yasaklı)';
  else if (H.uretilen.has(k)) satir = `✗ sıklık listesinde yok (üretilebiliyor: ${aciklama(k, H.uretilen.get(k))}) → elle-ekle.txt [tahmin]`;
  else if (H.ozelAdlar.has(k)) satir = '✗ özel ad';
  else satir = '✗ ne madde başı ne de kök + ek ile açıklanabiliyor';
  console.log(`${k.padEnd(7)} ${sira ? ('#' + sira).padEnd(7) : '—'.padEnd(7)} ${satir}`);
}
console.log(`\n${kabul}/${kelimeler.length} kabul`);
