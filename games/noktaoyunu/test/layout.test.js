// node --test test/layout.test.js — iki düzen, nokta aralığı, sığma
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

const BOYUTLAR = [[4, 4], [5, 5], [6, 6], [7, 7], [6, 8]];

test('geniş ekranda defter düzeni, sayfa sığar', () => {
  for (const [vw, vh] of [[1280, 800], [1440, 900], [768, 1024], [1024, 768]]) {
    for (const [m, n] of BOYUTLAR) {
      const l = L.hesapla(vw, vh, m, n);
      assert.equal(l.mod, 'defter', `${vw}×${vh} ${m}×${n}`);
      assert.ok(l.W * l.sq <= vw - 24 && l.H * l.sq <= vh - 16, `${vw}×${vh} ${m}×${n} sığmalı`);
      assert.ok(l.sq >= L.SQ_MIN && l.sq <= L.SQ_MAX);
      assert.ok(l.oyuncu[1].y + l.oyuncu[1].puan.dy <= l.H - .5, 'ikinci oyuncunun puanı sayfada');
    }
  }
});

test('telefonda dikey düzen: 5×5 ve 7×7 kaydırmasız, noktalar ≥ 48 px', () => {
  for (const [vw, vh] of [[375, 667], [390, 844], [414, 896]]) {
    for (const [m, n] of [[4, 4], [5, 5], [6, 6], [7, 7]]) {
      const l = L.hesapla(vw, vh, m, n);
      assert.equal(l.mod, 'dikey');
      assert.ok(2 * l.sq >= 48, `${vw} ${m}×${n}: aralık ${2 * l.sq}`);
      assert.equal(l.kaydir, false, `${vw}×${vh} ${m}×${n} kaydırmasız`);
      assert.ok(l.W * l.sq <= vw - 8 && l.H * l.sq <= vh - 8);
    }
  }
});

test('6×8 dar ekranda kaydırılır ama noktalar küçülmez', () => {
  const l = L.hesapla(375, 667, 6, 8);
  assert.equal(l.mod, 'dikey');
  assert.equal(l.sq, L.SQ_MIN);
  assert.equal(l.kaydir, true);
});

test('320 px genişlikte 5×5 sığar; tahta noktaları sayfanın içinde', () => {
  const l = L.hesapla(320, 568, 5, 5);
  assert.ok(2 * l.sq >= 48 && !l.kaydir);
  const [x, y] = L.noktaYeri(l, 4, 4);
  assert.ok(x < l.W && y < l.H);
  assert.deepEqual(L.noktaYeri(l, 0, 0), [l.tahta.x, l.tahta.y]);
});

test('komutlar tahtanın altında, sayfanın içinde', () => {
  for (const [vw, vh] of [[1280, 800], [375, 667]]) {
    const l = L.hesapla(vw, vh, 5, 5);
    assert.ok(l.komutlar.y > l.tahta.y + l.tahta.h);
    assert.ok(l.komutlar.y + 3.5 <= l.H, `${vw}: komutlara en az 3,5 sq yer`);
  }
});
