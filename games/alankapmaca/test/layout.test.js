const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

test('küçük yatay telefon: her tahta ve sayı paneli aynı ekrana sığar', () => {
  for (const n of [12, 16, 20]) {
    const d = L.hesapla({ width: 568, height: 320, n, touch: true });
    assert.equal(d.mode, 'alcak');
    assert.equal(d.blocked, false);
    assert.ok(d.square >= 14);
    assert.ok(d.width <= 560 && d.height <= 312);
  }
});

test('20 tahta küçük dikey telefonda küçültülmez; yatay önerilir', () => {
  const d = L.hesapla({ width: 320, height: 568, n: 20, touch: true });
  assert.equal(d.blocked, true);
  assert.equal(d.rotate, true);
  assert.ok(d.square >= 14);
});

test('16 tahta küçük dikey telefonda sayı paneliyle sığar', () => {
  const d = L.hesapla({ width: 320, height: 568, n: 16, touch: true });
  assert.equal(d.mode, 'dar');
  assert.equal(d.blocked, false);
  assert.ok(d.width <= 312 && d.height <= 560);
});

test('güvenli alanlar ve tarayıcı çubukları kullanılabilir alandan çıkarılır', () => {
  const d = L.hesapla({ width: 844, height: 350, n: 20, touch: true,
    safe: { left: 44, right: 44, top: 0, bottom: 21 } });
  assert.equal(d.blocked, false);
  assert.ok(d.width <= 748 && d.height <= 321);
});

test('telefon/tablet/masaüstü matrisinde sığan düzen taşmaz', () => {
  for (const [width, height] of [[320,568],[360,640],[390,844],[640,360],[768,1024],[1024,768],[1366,768]]) {
    for (const n of [12,16,20]) for (const touch of [true,false]) {
      const d = L.hesapla({ width, height, n, touch });
      assert.ok(d.square >= 14 && d.square <= 26);
      if (!d.blocked) assert.ok(d.width <= width - 8 && d.height <= height - 8, JSON.stringify(d));
    }
  }
});

test('iki yönde de sığmayan pencere sonsuz çevirme istemez', () => {
  const d = L.hesapla({ width: 280, height: 280, n: 20, touch: true });
  assert.equal(d.blocked, true);
  assert.equal(d.rotate, false);
});
