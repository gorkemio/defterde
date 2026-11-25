const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

test('kısa dikey ve yatay telefonlarda tüm oyun sığar', () => {
  for (const [width, height, n] of [[375, 500, 8], [320, 568, 8], [568, 320, 12], [667, 375, 8]]) {
    const l = L.hesapla(width, height, n);
    assert.equal(l.kaydir, false, `${width}×${height}, ${n}`);
    assert.ok(l.pageW <= width && l.pageH <= height);
    assert.ok(l.board / n >= 24);
  }
});

test('5–12 tahtalar ekranı aşmadan ve kontrolleri örtmeden yerleşir', () => {
  for (let n = 5; n <= 12; n++) for (const [w, h] of [[320,568],[375,500],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[320,320]]) {
    const l = L.hesapla(w, h, n);
    assert.ok(l.pageW <= w, `yatay taşma: ${n}, ${w}×${h}`);
    assert.ok(l.board / n >= 24);
    assert.ok(l.controlsX >= l.boardX + l.board || l.controlsY >= l.boardY + l.board);
    assert.ok(l.controlsY + 160 <= l.pageH);
    assert.ok(l.boardY + l.board <= l.pageH);
    if (!l.kaydir) assert.ok(l.pageH <= h);
  }
});

test('sığan dikey düzen yön değiştirmeyi istemez; dar alan okunaklı kalır', () => {
  assert.equal(L.hesapla(390, 844, 8).mod, 'dikey');
  const dar = L.hesapla(320, 480, 8);
  assert.equal(dar.kaydir, true);
  assert.equal(dar.cevir, true);
  const cokDar = L.hesapla(320, 320, 12);
  assert.equal(cokDar.kaydir, true);
  assert.equal(cokDar.cevir, false);
});
