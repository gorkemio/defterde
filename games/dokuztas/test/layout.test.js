// node --test test/layout.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

const EKRANLAR = [[320, 568], [375, 667], [390, 844], [414, 896], [768, 1024], [1280, 720], [1440, 900], [1920, 1080]];

test('her ekranda noktalar arası en az 40 px (2 kare × sq ≥ 20)', () => {
  for (const [w, h] of EKRANLAR) {
    const l = L.hesapla(w, h);
    assert.ok(2 * l.sq >= 40, `${w}×${h}: sq ${l.sq}`);
    assert.ok(l.sq <= L.SQ_MAX);
  }
});

test('geniş ekran defter, telefon dikey düzen', () => {
  assert.equal(L.hesapla(1440, 900).mod, 'defter');
  assert.equal(L.hesapla(1280, 720).mod, 'defter');
  assert.equal(L.hesapla(375, 667).mod, 'dikey');
  assert.equal(L.hesapla(320, 568).mod, 'dikey');
});

test('375×667: dikey sayfa kaydırmadan sığar, noktalar 48 px', () => {
  const l = L.hesapla(375, 667);
  assert.equal(l.sq, 24);
  assert.ok(l.W * l.sq <= 375 - 8, 'genişlik');
  assert.ok(l.H * l.sq <= 667 - 8, 'yükseklik');
  assert.equal(l.kaydir, false);
});

test('defter sayfası görünür alana sığar', () => {
  for (const [w, h] of EKRANLAR) {
    const l = L.hesapla(w, h);
    if (l.mod !== 'defter') continue;
    assert.ok(l.W * l.sq <= w - 24 && l.H * l.sq <= h - 16, `${w}×${h}`);
  }
});

test('tahta, tepsiler ve komutlar sayfanın içinde ve tahta ile çakışmaz', () => {
  for (const [w, h] of EKRANLAR) {
    const l = L.hesapla(w, h);
    const [x0, y0] = L.noktaYeri(l, 0, 0), [x1, y1] = L.noktaYeri(l, 6, 6);
    assert.ok(x0 - 1 >= 0 && x1 + 1 <= l.W && y0 - 1 >= 0 && y1 + 1 <= l.H, `${w}×${h} tahta`);
    for (const t of [...l.tepsi.el, ...l.tepsi.alinan]) {
      assert.ok(t.x > 0 && t.x < l.W && t.y > 0 && t.y < l.H, `${w}×${h} tepsi`);
      const icinde = t.x > x0 - 1 && t.x < x1 + 1 && t.y > y0 - 1 && t.y < y1 + 1;
      assert.ok(!icinde, `${w}×${h} tepsi tahtada`);
    }
    assert.ok(l.komutlar.y > y1 + .8, `${w}×${h} komutlar tahtanın altında`);
  }
});
