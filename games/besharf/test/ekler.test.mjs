// node --test — scripts/ekler.mjs: çekimli biçim sezgisi (brief: örnek 30 sözcükte doğru karar)
import test from 'node:test';
import assert from 'node:assert/strict';
import { uret, takiCoz, fiilTakiCoz, simdiki, ekle, aciklama } from '../scripts/ekler.mjs';

// Küçük, elle yazılmış kök tablosu (TDK'daki taki değerleriyle)
const KOKLER = [
  { kelime: 'EV', tip: 'ad' }, { kelime: 'ARA', tip: 'ad' }, { kelime: 'İÇ', tip: 'ad' }, { kelime: 'OĞUL', tip: 'ad', taki: 'ğlu, -ulu' },
  { kelime: 'BURUN', tip: 'ad', taki: 'rnu' }, { kelime: 'AYAK', tip: 'ad', taki: 'ğı' }, { kelime: 'HAL', tip: 'ad', taki: 'li' },
  { kelime: 'VAR', tip: 'ad' }, { kelime: 'YOK', tip: 'ad', taki: 'ku, -ğu' }, { kelime: 'SPOR', tip: 'ad' }, { kelime: 'TANK', tip: 'ad' },
  { kelime: 'DÜN', tip: 'ad' }, { kelime: 'LOR', tip: 'ad' }, { kelime: 'GEM', tip: 'ad' }, { kelime: 'ÇİŞ', tip: 'ad' },
  { kelime: 'ANA', tip: 'ad' }, { kelime: 'VAKİT', tip: 'ad', taki: 'kti' }, { kelime: 'KALP', tip: 'ad', taki: 'bi' },
  { kelime: 'SU', tip: 'ad', taki: 'yu' }, { kelime: 'HAK', tip: 'ad', taki: 'kkı' },
  { kelime: 'BEN', tip: 'zamir' }, { kelime: 'BU', tip: 'zamir' }, { kelime: 'O', tip: 'zamir' }, { kelime: 'NE', tip: 'zamir', taki: 'yi' },
  { kelime: 'GİT', tip: 'fiil', taki: 'der' }, { kelime: 'GEL', tip: 'fiil', taki: 'ir' }, { kelime: 'YAP', tip: 'fiil', taki: 'ar' },
  { kelime: 'DE', tip: 'fiil', taki: 'r' }, { kelime: 'BEKLE', tip: 'fiil' }, { kelime: 'KIL', tip: 'fiil' }, { kelime: 'OL', tip: 'fiil', taki: 'ur' },
  { kelime: 'ANLA', tip: 'fiil' }, { kelime: 'SÖYLE', tip: 'fiil' }, { kelime: 'UYAR', tip: 'fiil' },
];
const M = uret(KOKLER);

const KABUL = {
  GİDİP: ['GİT', '-(y)İp'], AYAĞI: ['AYAK', '-(s)İ'], OĞLUM: ['OĞUL', '-(İ)m'], BURNU: ['BURUN', '-(s)İ'], EVLER: ['EV', '-lAr'],
  EVİNE: ['EV'], ARADA: ['ARA', '-DA'], İÇİNE: ['İÇ'],             // evin+e ya da evi+ne: ikisi de doğru BENİM: ['BEN'], BUNUN: ['BU', '-(n)İn'], NEDİR: ['NE', '-Dİr'],
  NEYİN: ['NE', '-(n)İn'], MİSİN: ['Mİ', '-sİn'], VARDI: ['VAR', '-(y)Dİ'], YOKTU: ['YOK', '-(y)Dİ'], GELDİ: ['GEL', '-Dİ'],
  YAPAR: ['YAP', '-(İ/A)r'], DİYOR: ['DE', '-(İ)yor'], BEKLE: ['BEKLE'], SPORU: ['SPOR', '-(s)İ'], TANKI: ['TANK', '-(s)İ'],
  KILAR: ['KIL', '-(İ/A)r'], ÇİŞİM: ['ÇİŞ', '-(İ)m'], MÜYÜZ: ['MÜ', '-(y)İz'], HALDE: ['HAL', '-DA'], DEDİK: ['DE', '-k'],
  DÜNKÜ: ['DÜN', '-kü'], VAKTİ: ['VAKİT', '-(s)İ'], KALBE: ['KALP', '-(y)A'], SUYUN: ['SU'], HAKKI: ['HAK', '-(s)İ'],
  OLMAZ: ['OL', '-z'], ONDAN: ['O', '-DAn'], NEYDİ: ['NE', '-(y)Dİ'], MIYDI: ['MI', '-(y)Dİ'], BEKLİYOR: null,
};
const RET = ['LORNA', 'HAVVA', 'CİSCO', 'MYERS', 'BUNLA', 'BURDA', 'GEMMA', 'UYARİ', 'HALDA', 'KALPE', 'EVİYE', 'ARAİN', 'GİTİP', 'GEDİK',
  'BENİN', 'İÇNİE'];

test('çekimli biçim sezgisi: kabul edilmesi gerekenler, doğru kök ve ek', () => {
  let n = 0;
  for (const [b, beklenen] of Object.entries(KABUL)) {
    if (!beklenen) continue;
    const a = M.get(b);
    assert.ok(a, `${b} kabul edilmeli`);
    assert.equal(a.kok, beklenen[0], `${b}: kök ${aciklama(b, a)}`);
    if (beklenen[1]) assert.ok(a.ekler.includes(beklenen[1]), `${b}: ${beklenen[1]} bekleniyordu, ${aciklama(b, a)}`);
    n++;
  }
  assert.ok(n >= 30, 'en az 30 örnek');
});

test('çekimli biçim sezgisi: uydurma, ad ve yanlış ek birleşimi reddedilir', () => {
  for (const b of RET) assert.ok(!M.has(b), `${b} reddedilmeli, ${M.has(b) ? aciklama(b, M.get(b)) : ''}`);
});

test('yalnız tam 5 harfli biçimler üretilir', () => {
  for (const b of M.keys()) assert.equal(Array.from(b).length, 5, b);
});

test('taki çözümü: yedi kural', () => {
  assert.deepEqual(takiCoz('YOK', 'ku, -ğu').map(t => t.alt), [null, 'YOĞ']);   // 1 değişmez · 3 yumuşama
  assert.equal(takiCoz('HAK', 'kkı')[0].alt, 'HAKK');                             // 2 ikizleşme
  assert.equal(takiCoz('KİTAP', 'bı')[0].alt, 'KİTAB');                           // 3 yumuşama
  assert.equal(takiCoz('RENK', 'gi')[0].alt, 'RENG');                             // 3 nk → ng
  assert.equal(takiCoz('BURUN', 'rnu')[0].alt, 'BURN');                           // 4 ünlü düşmesi
  assert.equal(takiCoz('NE', 'yi')[0].alt, 'NEY');                                // 5 kaynaştırma
  assert.equal(takiCoz('RET', 'ddi')[0].alt, 'REDD');                             // 6 ikizleşme + yumuşama
  assert.equal(takiCoz('AHİT', 'hdi')[0].alt, 'AHD');                             // 4 ünlü düşmesi + yumuşama
  assert.ok(takiCoz('VECT', 'cdi')[0].cozulemedi);                                // 7 çözülemeyen
  assert.equal(takiCoz('KALP', 'bi')[0].uyum, 'İ');                               // uyum taki ünlüsünden
});

test('fiil takisi ve şimdiki zaman daralması', () => {
  assert.deepEqual(fiilTakiCoz('GİT', 'der'), [{ alt: 'GİD', genis: 'ER' }]);
  assert.deepEqual(fiilTakiCoz('GEL', 'ir'), [{ alt: null, genis: 'İR' }]);
  assert.equal(simdiki('BEKLE'), 'BEKLİYOR');
  assert.equal(simdiki('ANLA'), 'ANLIYOR');
  assert.equal(simdiki('SÖYLE'), 'SÖYLÜYOR');
  assert.equal(simdiki('DE'), 'DİYOR');
  assert.equal(simdiki('GİT', 'GİD'), 'GİDİYOR');
  assert.equal(simdiki('OKU'), 'OKUYOR');
});

test('şablon: uyum, kaynaştırma, sertleşme', () => {
  assert.equal(ekle('KİTAP', '%@'), 'KİTAPTA');
  assert.equal(ekle('ARABA', '[y]@'), 'ARABAYA');
  assert.equal(ekle('EV', '[n]#N'), 'EVİN');
  assert.equal(ekle('ANNE', '[n]#N'), 'ANNENİN');
  assert.equal(ekle('SÜT', '&#'), 'SÜTÇÜ');
  assert.equal(ekle('GÖZ', 'L#K'), 'GÖZLÜK');
  assert.equal(ekle('SAAT', '[y]@', 'İ'), 'SAATE');
});

test('ek açıkları: ünlü düşmesi + yumuşama, de/ye daralması, ulaçlar, yılki', () => {
  const m = uret([{ kelime: 'KAYIP', tip: 'ad', taki: 'ybı' }, { kelime: 'KUTUP', tip: 'ad', taki: 'tbu' }, { kelime: 'YIL', tip: 'ad' },
    { kelime: 'DE', tip: 'fiil', taki: 'r' }, { kelime: 'YE', tip: 'fiil', taki: 'r' }, { kelime: 'UYU', tip: 'fiil' }, { kelime: 'ÖL', tip: 'fiil', taki: 'ür' },
    { kelime: 'AİT', tip: 'ad' }]);
  for (const b of ['KAYBI', 'KUTBU', 'YILKİ', 'DİYEN', 'YİYEN', 'YİYİP', 'YİYİN', 'DEYİP', 'UYUYA', 'ÖLELİ', 'AİTTİ']) assert.ok(m.has(b), b);
});
