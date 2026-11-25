const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

const phones = [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932]];
const screens = [...phones, ...phones.map(([w, h]) => [h, w]), [768, 1024], [820, 1180], [1024, 768], [1366, 768], [1920, 1080]];

test('yerleşim: bütün hedef ekranlarda iki tahta ve kontroller sığar', () => {
  for (const [width, height] of screens) {
    const l = L.hesapla({ width, height });
    assert.equal(l.duraklat, false, `${width}×${height}`);
    assert.ok(l.width <= width && l.height <= height, `${width}×${height} taşma`);
    assert.ok(l.ana / 11 >= 24, 'etkileşimli hücre en az 24px');
    assert.ok(l.diger / 11 >= 12, 'küçük tahta bütünüyle görünür');
  }
});

test('yerleşim: telefon dikeyde bir büyük bir küçük tahta, yatayda iki eşit tahta', () => {
  const dikey = L.hesapla({ width: 390, height: 844 });
  const yatay = L.hesapla({ width: 844, height: 390 });
  assert.equal(dikey.mod, 'dikey');
  assert.ok(dikey.ana > dikey.diger);
  assert.equal(yatay.mod, 'yatay');
  assert.equal(yatay.ana, yatay.diger);
});

test('yerleşim: geniş ekranda orijinal defter korunur', () => {
  assert.equal(L.hesapla({ width: 1366, height: 768 }).mod, 'defter');
  assert.equal(L.hesapla({ width: 1024, height: 768 }).mod, 'defter');
});

test('yerleşim: dikey tablette ana tahta büyür, diğer tahta okunabilir kalır', () => {
  for (const [width, height] of [[600, 960], [768, 1024], [820, 1180], [1024, 1366]]) {
    const l = L.hesapla({ width, height });
    assert.ok(l.ana >= 528, 'ana hücreler en az 48px');
    assert.ok(l.diger >= 220, 'küçük hücreler en az 20px');
    assert.ok(l.height >= height * .75, 'dikey alanın en az dörtte üçü kullanılır');
    assert.ok(l.width <= width && l.height <= height, 'iki tahta ve kontroller sığar');
  }
});

test('yerleşim: güvenli kenarlar ve tarayıcı alanı hesapta kullanılır', () => {
  const l = L.hesapla({ width: 667, height: 375, insets: { left: 44, right: 44, top: 0, bottom: 21 } });
  assert.equal(l.duraklat, false);
  assert.ok(l.width <= 579);
  assert.ok(l.height <= 354);
});

test('yerleşim: sığmayınca hücreleri küçültmez, duraklatır', () => {
  for (const [width, height] of [[320, 400], [568, 240], [250, 700], [0, 0]]) {
    const l = L.hesapla({ width, height });
    assert.equal(l.duraklat, true);
    assert.ok(l.ana >= 264);
  }
});

test('yerleşim: sürekli boyut değişiminde sınır altında oynanabilir ölçü döndürmez', () => {
  for (let width = 280; width <= 1200; width += 17) {
    for (let height = 250; height <= 1000; height += 23) {
      const l = L.hesapla({ width, height });
      if (l.duraklat) continue;
      assert.ok(l.width <= width && l.height <= height);
      assert.ok(l.ana >= 264);
    }
  }
});
