const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../nonogram/model.js');
const O = require('./ornekler.js');
const yap = (s, bas) => M.bulmacaYap({ en: s[0].length, boy: s.length, satirlar: s, baslangic: bas });

test('M1 bütün ipuçlarını sağlayan ızgara çözülmüş sayılır (tekil bulmacada = çözüm)', () => {
  const b = yap(O.ev10), d = M.durumYap(b);
  assert.equal(M.cozulduMu(d, b), false);
  for (let i = 0; i < d.length; i++) d[i] = b.cozum[i] ? 1 : 0;   // çarpısız
  assert.equal(M.cozulduMu(d, b), true);
  d[0] = 1;
  assert.equal(M.cozulduMu(d, b), false);
});

test('M2 üstü çizme yalnız oyuncunun işaretlerine bakar', () => {
  // ipucu 2 1 3, uzunluk 10
  const ip = [2, 1, 3];
  assert.deepEqual(M.ustuCizilenler([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], ip), [false, false, false]);
  assert.deepEqual(M.ustuCizilenler([1, 1, 2, 0, 0, 0, 0, 0, 0, 0], ip), [true, false, false]);
  assert.deepEqual(M.ustuCizilenler([1, 1, 0, 0, 0, 0, 0, 0, 0, 0], ip), [false, false, false], 'ucu açık');
  assert.deepEqual(M.ustuCizilenler([2, 1, 1, 2, 0, 0, 2, 1, 1, 1], ip), [true, false, true]);
  assert.deepEqual(M.ustuCizilenler([2, 1, 1, 2, 0, 0, 0, 1, 1, 1], ip), [true, false, false], 'sondaki koşunun önü açık');
  assert.deepEqual(M.ustuCizilenler([1, 1, 0, 1, 0, 0, 1, 1, 1, 0], ip), [true, true, true], 'koşular ipucuyla aynı');
  assert.deepEqual(M.ustuCizilenler([1, 1, 1, 2, 0, 0, 0, 0, 0, 0], ip), [false, false, false], 'yanlış uzunluk');
  assert.deepEqual(M.ustuCizilenler([2, 2, 2], [0]), [true]);
  assert.deepEqual(M.ustuCizilenler([2, 0, 2], [0]), [false]);
});

test('M3 kod gidiş-dönüş', () => {
  const renk = new Uint8Array(25 * 25);
  for (let i = 0; i < renk.length; i++) renk[i] = (i * 7) % 13;
  const bas = [{ r: 3, c: 4, v: 1 }, { r: 24, c: 24, v: 2 }];
  const k = M.koduYaz(25, 25, renk, bas), g = M.koduOku(k);
  assert.equal(g.en, 25); assert.equal(g.boy, 25);
  assert.deepEqual(Array.from(g.renkler), Array.from(renk));
  assert.deepEqual(g.baslangic, bas);
  assert.ok(k.length < 450);
  assert.throws(() => M.koduOku('v9.1.1.AA'));
});

test('M4 yanlışlar ve başlangıç kareleri', () => {
  const b = yap(O.ok5, [[0, 2, 1], [0, 0, 2]]);
  const d = M.durumYap(b);
  assert.equal(d[2], 1); assert.equal(d[0], 2);
  d[1] = 1; d[12] = 2;
  assert.deepEqual(M.yanlislar(d, b), [{ r: 0, c: 1 }, { r: 2, c: 2 }]);
});
