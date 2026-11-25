const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine/eller.js');

// Birleşim-bul: geçit hep iki ayrı bileşeni bağlamalı (döngü yok); her satırdan sonra açık kalan her bileşen
// son satıra dokunmalı (yoksa sonsuza dek kopuk kalırdı).
test('Eller: 1000 satırda her yeni satır mükemmelliği koruyor', () => {
  for (const W of [12, 5]) {
    const d = E.baslat(W, 'test-' + W), ata = [], kok = (x) => { while (ata[x] !== x) { ata[x] = ata[ata[x]]; x = ata[x]; } return x; };
    const bagla = (a, b) => { const x = kok(a), y = kok(b); assert.notEqual(x, y, 'döngü'); ata[x] = y; };
    let asagiOnceki = null, gecit = 0;
    for (let s = 0; s < 1000; s++) {
      for (let c = 0; c < W; c++) ata[s * W + c] = s * W + c;
      if (asagiOnceki) for (let c = 0; c < W; c++) if (asagiOnceki[c]) { bagla((s - 1) * W + c, s * W + c); gecit++; }
      const satir = E.sonrakiSatir(d);
      assert.equal(satir.satir, s);
      for (let c = 0; c < W - 1; c++) if (satir.yatay[c]) { bagla(s * W + c, s * W + c + 1); gecit++; }
      // bu satırdan aşağı inen hücrelerin kökleri, bütün bileşenleri kapsamalı
      const inen = new Set(), hepsi = new Set();
      for (let x = 0; x < (s + 1) * W; x++) hepsi.add(kok(x));
      for (let c = 0; c < W; c++) if (satir.asagi[c]) inen.add(kok(s * W + c));
      assert.equal(inen.size, hepsi.size, `satır ${s}: kopuk bileşen`);
      asagiOnceki = satir.asagi;
    }
    // ilk 1000 satır, aşağıya sarkan geçitler dışında bir orman; kapanmamış bileşen sayısı kadar eksik
    assert.ok(gecit < 1000 * W);
  }
});

test('Eller: aynı tohum aynı satırlar', () => {
  const a = E.baslat(12, 9), b = E.baslat(12, 9);
  for (let s = 0; s < 50; s++) assert.deepEqual(E.sonrakiSatir(a), E.sonrakiSatir(b));
});
