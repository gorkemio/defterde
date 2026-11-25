const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine/model.js');

const bitler = (s) => [...s].reduce((m, ch) => m | (1 << 'abcdefg'.indexOf(ch)), 0);

test('rakam tanıma tablosunun tamamı', () => {
  const tablo = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  for (const [r, s] of Object.entries(tablo)) {
    assert.equal(M.TANI.R[bitler(s)], r, s);
    assert.equal(M.KANONIK.R[bitler(s)], true, s);
  }
  assert.equal(M.TANI.R[bitler('ef')], '1', 'sola yaslı 1 geçerli');
  assert.equal(M.KANONIK.R[bitler('ef')], false, 'sola yaslı 1 kanonik değil');
  // geçerli rakamlar dışında kalan her küme geçersiz (boş hariç)
  const gecerli = new Set([...Object.values(tablo).map(bitler), bitler('ef'), 0]);
  let sayi = 0;
  for (let b = 0; b < 128; b++) if (!gecerli.has(b)) { assert.equal(M.TANI.R[b], null, 'bayt ' + b); sayi++; }
  assert.equal(sayi, 128 - 12);
  // 6'nın şapkası, 9'un kuyruğu, 7 üç çöp
  assert.equal(M.TANI.R[bitler('fgedc')], null, 'şapkasız 6 yok');
  assert.equal(M.TANI.R[bitler('abcfg')], null, 'kuyruksuz 9 yok');
  assert.equal(M.TANI.R[bitler('fabc')], null, 'dört çöplü 7 yok');
});

test('işlem tanıma ve geçersiz kümeler', () => {
  const T = 1, Mm = 2, Bb = 4, V = 8, D1 = 16, D2 = 32;
  assert.equal(M.TANI.I[Mm], '-'); assert.equal(M.KANONIK.I[Mm], true);
  assert.equal(M.TANI.I[T], '-'); assert.equal(M.KANONIK.I[T], false);
  assert.equal(M.TANI.I[Bb], '-'); assert.equal(M.KANONIK.I[Bb], false);
  assert.equal(M.TANI.I[T | Bb], '=');
  assert.equal(M.TANI.I[Mm | V], '+');
  assert.equal(M.TANI.I[D1 | D2], '*');
  assert.equal(M.TANI.I[D1], '/');
  for (const x of [0, V, D2, T | Mm, Mm | Bb, T | Mm | Bb, T | V, D1 | V, Mm | D1, T | Bb | V, 63]) assert.equal(M.TANI.I[x], null, 'geçersiz ' + x);
  let gecerli = 0;
  for (let b = 0; b < 64; b++) if (M.TANI.I[b] !== null) gecerli++;
  assert.equal(gecerli, 7);
});

test('romen tanıma ve yazım kuralları', () => {
  assert.equal(M.TANI.M[1], 'I'); assert.equal(M.TANI.M[6], 'V'); assert.equal(M.TANI.M[24], 'X'); assert.equal(M.TANI.M[96], 'L');
  const ok = { I: 1, IV: 4, IX: 9, XL: 40, XLIX: 49, L: 50, XXXIX: 39, VIII: 8, XIV: 14 };
  for (const [s, v] of Object.entries(ok)) assert.equal(M.romenDeger(s), v, s);
  for (const s of ['IIII', 'VV', 'IL', 'IC', 'XXXX', 'LX', 'VX', 'IIV', 'LI', '']) assert.equal(M.romenDeger(s), null, s);
});

const deg = (sablon, metin) => M.degerlendir(M.oku(M.yaz(sablon, metin)));

test('değerlendirici: öncelik, tam bölme, sıfıra bölme, baştaki sıfır, tek "=", negatif', () => {
  assert.equal(deg('1+1x1=2', '2+3x4=14').dogru, true, 'çarpma önce');
  assert.equal(deg('1+1x1=2', '2+3x4=20').dogru, false);
  assert.equal(deg('2/1+1=1', '12/4+1=4').dogru, true);
  assert.equal(deg('1/1=1', '7/2=3').gecerli, false, 'tam olmayan bölme');
  assert.equal(deg('1/1=1', '7/0=0').gecerli, false, 'sıfıra bölme');
  assert.equal(M.oku(M.yaz('2+1=1', '05+3=8')).gecerli, false, 'baştaki sıfır');
  assert.equal(deg('1+1=1', '0+4=4').dogru, true, 'tek başına 0 geçerli');
  assert.equal(M.oku(M.yaz('1+1=1', '1=1=1')).gecerli, false, 'iki "="');
  assert.equal(M.oku(M.yaz('1+1=1', '1+1+1')).gecerli, false, '"=" yok');
  assert.equal(deg('1-1+1=1', '2-5+4=1').gecerli, false, 'negatif ara sonuç');
  assert.equal(deg('1-1=1', '3-5=2').gecerli, false, 'negatif taraf');
  assert.equal(deg('1+1=1', '5=5+0').gecerli, true, '"=" başka yerde');
  assert.equal(deg('1+1=1', '5=5+0').dogru, true);
  assert.equal(deg('1+1=1', '3-3=0').dogru, true);
});

test('boş hücre yalnız şablonun izin verdiği öncü yerde', () => {
  assert.equal(M.oku(M.yaz('2+1=1', ' 5+3=8')).gecerli, true);
  const d = M.yaz('1+2=2', '5+12=17');
  d.bayt[d.bayt.length - 1] = 0;                       // son basamak boş
  assert.equal(M.oku(d).gecerli, false);
  const e = M.yaz('1+1=1', '5+3=8'); e.bayt[0] = 0;   // tek basamaklı sayı boş olamaz
  assert.equal(M.oku(e).gecerli, false);
});

test('elle doğrulanmış örnekler (naif çözücüyle)', () => {
  const N = require('./naif.js');
  const c1 = N.coz(M.yaz('1+1=1', '3+3=5'), { k: 1 }).map(x => x.metin);
  assert.ok(c1.includes('2+3=5') && c1.includes('3+2=5'), c1.join());
  const c2 = N.coz(M.yaz('1+1=1', '6+4=4'), { k: 1 }).map(x => x.metin);
  assert.ok(c2.includes('0+4=4'), c2.join());
  // 3'ün c'si e'ye: 3 → 2
  const d = M.yaz('1+1=1', '3+3=5'); d.bayt[0] = (d.bayt[0] & ~(1 << 2)) | (1 << 4);
  assert.equal(M.oku(d).metin, '2+3=5');
  // 6'nın g'si b'ye: 6 → 0
  const e = M.yaz('1+1=1', '6+4=4'); e.bayt[0] = (e.bayt[0] & ~(1 << 6)) | (1 << 1);
  assert.equal(M.oku(e).metin, '0+4=4');
});

test('kanonik dize gidiş-dönüş ve kanoniklik', () => {
  const d = M.yaz('2-1=2', '13-5=8');
  const s = M.kanonikDize(d);
  assert.equal(s, '2-1=2:' + M.maske(d));
  assert.deepEqual([...M.dizeOku(s).bayt], [...d.bayt]);
  assert.equal(M.kanonikMi(d), true);
  d.bayt[0] = M.BIR_SOL; assert.equal(M.kanonikMi(d), false);
});

test('fark ve hamle sayacı', () => {
  const bas = M.yaz('1+1=1', '6+4=4');
  const d = M.kopya(bas); d.bayt[0] = (d.bayt[0] & ~(1 << 6)) | (1 << 1);
  const f = M.fark(bas, d);
  assert.deepEqual(f, { kaldirilan: [6], eklenen: [1] });
  assert.deepEqual(M.hamle(f, 'tek'), { sayac: 1, hak: 1, dolu: true, asildi: false });
  assert.equal(M.hamle(f, 'iki').dolu, false);
  assert.equal(M.hamle({ kaldirilan: [], eklenen: [3] }, 'ekle').dolu, true);
  assert.equal(M.hamle({ kaldirilan: [3], eklenen: [] }, 'cikar').dolu, true);
  assert.equal(M.hamle({ kaldirilan: [3], eklenen: [] }, 'ekle').asildi, true, 'ekle bulmacasında çıkarma');
  assert.equal(M.hamle({ kaldirilan: [3, 4], eklenen: [1, 2] }, 'tek').asildi, true);
  // aynı çöpü iki kez oynatmak tek hamle: yalnız fark sayılır
  const g = M.kopya(d); g.bayt[0] = (g.bayt[0] & ~(1 << 1)) | (1 << 6);
  assert.equal(M.hamle(M.fark(bas, g), 'tek').sayac, 0);
});

test('yerleşim: her hücrede doğru sayıda yuva', () => {
  const y = M.yerlesim('2+1=2', 50);
  assert.equal(y.yuvalar.length, 7 * 5 + 6 * 2);
  assert.ok(y.genislik > 7 * 50);
  assert.equal(y.yukseklik, 100);
});

test('tohum, karma ve tarih', () => {
  assert.equal(M.rng(5)(), M.rng(5)());
  assert.notEqual(M.rng(5)(), M.rng(6)());
  assert.equal(M.karma('gun', '2026-10-20'), M.karma('gun', '2026-10-20'));
  assert.equal(M.tarihYazi('2026-10-20'), '20 Ekim');
  assert.equal(M.sesli(M.oku(M.yaz('1+1=1', '5+3=6'))), 'beş artı üç eşittir altı');
});
