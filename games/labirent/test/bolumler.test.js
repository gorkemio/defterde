const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../config.js');
const G = require('../engine/generate.js');
const S = require('../engine/solve.js');
const B = require('../data/bolumler.js');

test('her defterde 20 seviye; boy ve algoritma tabloya uygun; kodlar geçerli ve tekil', () => {
  const hepsi = new Set();
  for (const tur of C.bolum.defterler) {
    assert.equal(B[tur].length, C.bolum.seviye, tur);
    B[tur].forEach((v, i) => {
      const s = G.kodOku(v.kod);
      assert.ok(s, v.kod);
      assert.equal(v.seviye, i + 1);
      assert.equal(s.tur, tur);
      assert.equal(s.boy, C.bolum.boy(i + 1), v.kod);
      assert.equal(s.alg, C.bolum.alg(i + 1), v.kod);
      assert.ok(!hepsi.has(v.kod)); hepsi.add(v.kod);
    });
  }
});

test('kolaydan zora: zorluk hiç düşmez; kayıtlı zorluk ve çözüm labirentten yeniden üretilir', () => {
  for (const tur of C.bolum.defterler) {
    let onceki = -Infinity;
    for (const v of B[tur]) {
      const L = G.uret(v.kod), m = S.metrikler(L);
      assert.ok(Math.abs(S.zorluk(m) - v.zorluk) < .01, v.kod);
      assert.equal(m.cozumUzunlugu, v.cozum, v.kod);
      assert.ok(v.zorluk >= onceki, `${v.kod}: ${v.zorluk} < ${onceki}`);
      onceki = v.zorluk;
    }
    assert.ok(B[tur][19].zorluk > 3 * B[tur][0].zorluk, tur);
  }
});

test('par aynı tohumla aynı çıkar (örnek seviyeler)', () => {
  for (const tur of C.bolum.defterler) for (const i of [0, 9, 19]) assert.equal(S.par(G.uret(B[tur][i].kod)), B[tur][i].par, B[tur][i].kod);
});
