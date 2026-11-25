// node --test — layout.js: düzen modu ve kare boyu (tarayıcı gerekmez)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

test('mod seçimi: ≥ 900 defter, 600–899 tablet, < 600 kompakt', () => {
  assert.equal(L.modSec(1280), 'defter');
  assert.equal(L.modSec(900), 'defter');
  assert.equal(L.modSec(899), 'tablet');
  assert.equal(L.modSec(600), 'tablet');
  assert.equal(L.modSec(599), 'kompakt');
  assert.equal(L.modSec(320), 'kompakt');
});

test('kare boyu: yaygın ekranlar', () => {
  assert.equal(L.hesapla({ vw: 1280, vh: 900 }).sq, 24);
  const dizustu = L.hesapla({ vw: 1024, vh: 768 }).sq;
  assert.ok(dizustu >= 17 && dizustu <= 22, 'dizüstü: ' + dizustu);
  assert.equal(L.hesapla({ vw: 820, vh: 1180 }).sq, 26);
  assert.equal(L.hesapla({ vw: 390, vh: 844 }).sq, 17);
  assert.equal(L.hesapla({ vw: 375, vh: 667 }).sq, 16);
  assert.equal(L.hesapla({ vw: 320, vh: 568 }).sq, 14);
});

test('üç sayfa aynı kutuyu kullanır: kw × kh moda bağlı, içeriğe bağlı değil', () => {
  for (const [vw, vh] of [[1440, 900], [1024, 768], [820, 1180], [768, 1024], [390, 844], [360, 740]]) {
    const l = L.hesapla({ vw, vh });
    assert.ok(Number.isInteger(l.sq), 'tam sayı px: ' + l.sq);
    assert.ok(l.kw * l.sq <= vw, `${vw}×${vh}: sayfa ekrandan geniş`);
    assert.ok(l.ix > l.marjK && l.ix + l.iw <= l.kw, `${vw}: içerik sütunu marjla sayfa kenarı arasında`);
  }
});

test('masaüstünde sayfa ekrana sığar; eğim yalnız defterde', () => {
  for (const [vw, vh] of [[1280, 900], [1440, 900], [1920, 1080], [1366, 768]]) {
    const l = L.hesapla({ vw, vh });
    assert.ok(l.kh * l.sq <= vh - 32, `${vw}×${vh}: sayfa ${l.kh * l.sq} px`);
    assert.notEqual(l.egim, 0);
  }
  assert.equal(L.hesapla({ vw: 820, vh: 1180 }).egim, 0);
  assert.equal(L.hesapla({ vw: 390, vh: 844 }).egim, 0);
});

test('dokunmatik: alfabe hücresi parmakla basılacak kadar büyük', () => {
  const px = (l) => [l.hucre.w * l.sq, l.hucre.h * l.sq];
  for (const vw of [700, 768, 820, 899]) {
    const [w, h] = px(L.hesapla({ vw, vh: 1100 }));
    assert.ok(w >= 40 && h >= 40, `tablet ${vw}: ${w.toFixed(1)}×${h.toFixed(1)}`);
  }
  for (const vw of [320, 360, 375, 390, 430]) {
    const [w, h] = px(L.hesapla({ vw, vh: 800 }));
    assert.ok(w >= 33 && h >= 33, `telefon ${vw}: ${w.toFixed(1)}×${h.toFixed(1)}`);
  }
});

test('telefonda tüm sayfa yaygın ekran yüksekliğine sığar', () => {
  for (const [vw, vh] of [[390, 844], [375, 812], [360, 740], [414, 896]]) {
    const l = L.hesapla({ vw, vh });
    assert.equal(l.mod, 'kompakt');
    assert.ok(l.kh * l.sq <= vh, `${vw}×${vh}: ${l.kh * l.sq} px`);
  }
});
