// node --test — engine/solver.js: örüntü, süzme, entropi, öneri, analiz, düello, hız
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engine/solver.js');
const G = require('../engine/game.js');
const D = require('../engine/daily.js');

const TV = require('../data/tahminler.js');
const tahminler = TV.liste.split('\n');
const cevaplar = D.cozCevaplar(require('../data/cevaplar.js'));
const oneriler = require('../data/oneriler.js');

test('kodla: harf kodları, şapka, hata', () => {
  assert.deepEqual(Array.from(S.kodla('KALEM')), [13, 0, 14, 5, 15]);
  assert.deepEqual(Array.from(S.kodla('kâlem')), [13, 0, 14, 5, 15]);
  assert.throws(() => S.kodla('KALE'));
  assert.throws(() => S.kodla('KAXEM'));
});

test('örüntü: tekrar eden harfler ve kodlama', () => {
  assert.equal(S.oruntu('KAZAK', 'KALEM'), S.oruntuKodla([2, 2, 0, 0, 0]));
  assert.equal(S.oruntu('KAZAK', 'KALEM'), 8);
  assert.equal(S.oruntu('AAAAA', 'KAPAK'), 60);
  assert.equal(S.oruntu('AKAKA', 'KAPAK'), 40);
  assert.equal(S.oruntu('KALEM', 'KALEM'), 242);
  assert.deepEqual(S.oruntuAc(242), [2, 2, 2, 2, 2]);
  for (let k = 0; k < 243; k++) assert.equal(S.oruntuKodla(S.oruntuAc(k)), k);
});

test('örüntü ≡ game.geriBildirim (1000 tohumlu rastgele çift)', () => {
  const r = S.rng(7);
  for (let i = 0; i < 1000; i++) {
    const t = tahminler[Math.floor(r() * tahminler.length)], c = cevaplar[Math.floor(r() * cevaplar.length)];
    assert.equal(S.oruntu(t, c), S.oruntuKodla(G.geriBildirim(t, c)), `${t} / ${c}`);
  }
});

test('küçük evrende süzme, entropi, öneri eşitliği', () => {
  const C = S.kur({ tahminler: ['SALON', 'KAZAK', 'KALEM', 'KAPAK'], cevaplar: ['KALEM', 'KAZAK', 'KAPAK', 'SALON'] });
  const hepsi = C.cevapIdx;
  assert.deepEqual(Array.from(C.suz(hepsi, 'KAZAK', 8), (i) => C.kelime(i)), ['KALEM']);
  const C2 = S.kur({ tahminler: ['ABCDE', 'ZZZZZ', 'AAAAA', 'BBBBB', 'CCCCC', 'DDDDD'], cevaplar: ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD'] });
  const e = C2.entropi(C2.dizin('ABCDE'), C2.cevapIdx);
  assert.ok(Math.abs(e.entropi - 2) < 1e-9);
  assert.equal(e.beklenen, 1);
  const z = C2.entropi(C2.dizin('ZZZZZ'), C2.cevapIdx);
  assert.equal(z.entropi, 0);
  assert.equal(z.beklenen, 4);
  // eşitlikte aday olan ve daha sık olan
  const C3 = S.kur({ tahminler: ['SALON', 'KAZAK', 'KALEM'], cevaplar: ['KALEM', 'KAZAK'] });
  assert.equal(C3.oner(C3.cevapIdx, { havuz: 3, enIyi: 1 })[0].kelime, 'KAZAK');
  assert.equal(C3.oner(Uint16Array.from([C3.dizin('KALEM')]))[0].kelime, 'KALEM');
});

const C = S.kur({ tahminler, cevaplar, oneriler, onerilmez: TV.onerilmez.split('\n') });

test('açılış ve ikinci adım tablodan; çekimli biçim önerilmez', () => {
  assert.equal(C.oner(C.cevapIdx)[0].kelime, oneriler.ilk);
  const kod = C.oruntu(oneriler.ilk, cevaplar[0]);
  if (kod !== 242) {
    const A = C.suz(C.cevapIdx, oneriler.ilk, kod);
    if (A.length > 2) assert.equal(C.oner(A, { gecmis: [{ kelime: oneriler.ilk, kod }] })[0].kelime, oneriler.ikinci[kod]);
  }
  const onerilmez = new Set(TV.onerilmez.split('\n'));
  const A = C.suz(C.cevapIdx, 'ARMUT', C.oruntu('ARMUT', 'KALEM'));
  for (const o of C.oner(A, { enIyi: 20 })) assert.ok(!onerilmez.has(o.kelime) || o.adayMi, o.kelime);
});

test('analiz: aday sayıları, öneri, beceri ve şans', () => {
  const a = C.analiz(['ARMUT', 'MELEK', 'KALEM'], 'KALEM');
  assert.equal(a.cozuldu, true);
  assert.equal(a.tahminSayisi, 3);
  assert.equal(a.adimlar[0].once, cevaplar.length);
  assert.equal(a.adimlar[1].once, a.adimlar[0].sonra);
  assert.equal(a.adimlar[2].sonra, 1);
  assert.ok(a.adimlar[0].oneri && a.adimlar[0].oneri.kelime);
  assert.ok(a.beceri >= 0 && a.beceri <= 1);
  const toplam = a.adimlar.reduce((t, x) => t + (x.sans || 0), 0);
  assert.ok(Math.abs(toplam - a.sans) < 1e-9);
  assert.ok(a.bilgisayarTahmin >= 1 && a.bilgisayarTahmin <= 6);
  const kayip = C.analiz(['ARMUT', 'SALON', 'BALIK', 'KAPAK', 'KAZAK', 'KARAR'], 'KALEM');
  assert.equal(kayip.cozuldu, false);
  assert.ok(kayip.kalanSayisi >= 1);
});

test('düello: orta en sık aday, kolay tohumla aynı ve tutarlı, zor öneriyle aynı', () => {
  const A = C.suz(C.cevapIdx, 'ARMUT', C.oruntu('ARMUT', 'KALEM'));
  assert.equal(C.duelloHamle('orta', A).idx, A[0]);
  const k1 = C.duelloHamle('kolay', A, S.hamleRng(42, 1)), k2 = C.duelloHamle('kolay', A, S.hamleRng(42, 1));
  assert.deepEqual(k1, k2);
  assert.ok(A.includes(k1.idx));
  assert.equal(C.duelloHamle('zor', A).kelime, C.oner(A)[0].kelime);
  assert.throws(() => C.duelloHamle('çok zor', A));
});

test('hız: ilk tahminden sonraki öneri (cömert sınır)', () => {
  const A = C.suz(C.cevapIdx, 'SALON', C.oruntu('SALON', 'BİREY'));
  const t0 = Date.now();
  C.oner(A, { gecmis: [{ kelime: 'SALON', kod: -1 }] });
  assert.ok(Date.now() - t0 < 1000);
});
