const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../nonogram/model.js');
const S = require('../nonogram/solver.js');
const D = require('../nonogram/difficulty.js');
const O = require('./ornekler.js');
const yap = (s) => M.bulmacaYap({ en: s[0].length, boy: s.length, satirlar: s });

test('S1 2×2 dama deseni çok çözümlü', () => {
  const r = S.tekillik(yap(['#.', '.#']));
  assert.equal(r.sonuc, 'cok');
  assert.equal(r.cozumler.length, 2);
});

test('S2 elle kurulmuş 5 örnek tek çözümlü ve çözüm resimle aynı', () => {
  for (const ad of ['ok5', 'ev10', 'balik10', 'yaprak15', 'bardak10x15']) {
    const b = yap(O[ad]), r = S.tekillik(b);
    assert.equal(r.sonuc, 'tek', ad);
    assert.deepEqual(Array.from(r.cozumler[0], v => (v === 1 ? 1 : 0)), Array.from(b.cozum), ad);
  }
});

test('S3 çözümsüz ipuçları', () => {
  const b = yap(['#.', '.#']);
  b.ipuclari.satir[0] = [2]; b._coz = null;
  assert.equal(S.tekillik(b).sonuc, 'yok');
});

test('S4 derinlik-1 sınama: yayılım takılır, sınama çözer', () => {
  const b = yap(O.zor10), d = M.durumYap(b);
  assert.equal(S.yay(d.slice(), b).sonuc, 'takildi');
  assert.equal(S.coz(d.slice(), b, { derinlik: 1 }).sonuc, 'cozuldu');
});

test('S5 derinlik-2 örneği: derinlik 1 yetmez, 2 çözer', () => {
  const b = yap(O.uzman14), d = M.durumYap(b);
  assert.equal(S.coz(d.slice(), b, { derinlik: 1 }).sonuc, 'takildi');
  assert.equal(S.coz(d.slice(), b, { derinlik: 2 }).sonuc, 'cozuldu');
});

test('S6 bütçe aşımı → bilinmiyor', () => {
  const b = yap(O.tahmin15);
  assert.equal(S.tekillik(b, { dugumButcesi: 2 }).sonuc, 'bilinmiyor');
});

test('S7 aynı girdi aynı sonuç (tekillik ve derece)', () => {
  const b1 = yap(O.zor10), b2 = yap(O.zor10);
  assert.deepEqual(S.tekillik(b1).dugum, S.tekillik(b2).dugum);
  assert.deepEqual(D.derece(b1).puan, D.derece(b2).puan);
});
