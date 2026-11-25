const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine/model.js');
const D = require('../engine/difficulty.js');
const Ra = require('../engine/rating.js');

test('ağırlıklar tek tabloda; her etiket ham değeri artırır', () => {
  for (const k of Object.keys(D.ETIKET)) assert.ok(D.AGIRLIK[k] > 0, k);
  const d = M.yaz('1x1+1=2', '2x3+1=18');
  const z = D.hesapla(d, 'tek');
  let beklenen = Math.log(1 + z.temel);
  for (const k in D.ETIKET) if (z.etiket & D.ETIKET[k]) beklenen += D.AGIRLIK[k];
  beklenen += Math.min(D.AGIRLIK.yakinIskaEnCok, D.AGIRLIK.yakinIska * z.etiketler.yakinIska);
  assert.ok(Math.abs(beklenen - z.ham) < 1e-9);
});

test('kapalı biçim temel değer örneklemeyle uyumlu', () => {
  const Ai = require('../engine/ai.js');
  const d = M.yaz('2+1=2', '13+5=10');
  const liste = Ai.adayListesi(d, { k: 2 });
  const kapali = D.temelDeger(liste, .6, 1);
  // örnekleme
  const r = M.rng(5);
  let top = 0;
  for (let n = 0; n < 4000; n++) {
    const p = liste.map(a => a.temel + Ai.gauss(r) * .6);
    const s = p[liste.findIndex(a => a.dogru)];
    top += 1 + p.filter(x => x < s).length;
  }
  assert.ok(Math.abs(kapali - top / 4000) / kapali < .05, `${kapali} ~ ${top / 4000}`);
});

test('aynı bulmaca aynı puan; bant eşikleri sıralı; puan 600–2200', () => {
  const d = M.yaz('1+1=1', '3+3=5');
  assert.deepEqual(D.hesapla(d, 'hepsini'), D.hesapla(d, 'hepsini'));
  for (const k in D.KALIBRE.BANT_ESIK) {
    const e = D.KALIBRE.BANT_ESIK[k];
    assert.ok(e[0] < e[1] && e[1] < e[2], k);
  }
  assert.equal(D.puanOf(-5), 600); assert.equal(D.puanOf(50), 2200);
});

test('etiketler: "=" taşıma, işlem, sayıdan sayıya, öncelik', () => {
  const Ai = require('../engine/ai.js');
  const bas = M.yaz('1+1=1', '6+4=4');
  const coz = M.yaz('1+1=1', '0+4=4');
  const e = D.etiketler(bas, coz.bayt, Ai.adayListesi(bas, { k: 1 }));
  assert.ok(!e.islem && !e.esit && !e.sayidan);
  const b2 = M.yaz('1+1=1', '8-4=4');
  assert.ok(D.etiketler(bas, b2.bayt, []).islem);
  const b3 = M.yaz('1+1x1=2', '2+3x4=14');
  assert.ok(D.etiketler(M.yaz('1+1x1=2', '2+3x4=15'), b3.bayt, []).oncelik);
});

test('Elo: kazanma artırır, kaybetme azaltır, eşit puanda ±16', () => {
  assert.equal(Ra.guncelle(1000, 1000, 1), 1016);
  assert.equal(Ra.guncelle(1000, 1000, 0), 984);
  assert.equal(Ra.guncelle(1000, 1000, .5), 1000);
  assert.ok(Ra.guncelle(1000, 1400, 1) > 1016);
  assert.ok(Ra.guncelle(1000, 600, 1) < 1016);
});

test('sonuç tablosu: süre, ipucu, pes', () => {
  assert.equal(Ra.sonuc(10, 'kolay'), 1);
  assert.equal(Ra.sonuc(25, 'kolay'), .5);
  assert.equal(Ra.sonuc(10, 'kolay', { ipucu: 1 }), .5);
  assert.equal(Ra.sonuc(10, 'kolay', { ipucu: 3 }), 0);
  assert.equal(Ra.sonuc(10, 'kolay', { pes: true }), 0);
  assert.equal(Ra.sonuc(70, 'cokzor'), 1);
  assert.deepEqual(Ra.aralik(1000), [900, 1150]);
  assert.equal(Ra.turHedefi(1000, 0, 5), 900);
  assert.equal(Ra.turHedefi(1000, 4, 5), 1150);
});

test('kitap dağıtımı: 100\'lük, her kitap artan puanlı, kitaplar benzer aralıkta', () => {
  const k = Array.from({ length: 2000 }, (_, i) => ({ puan: 600 + Math.floor(i * .8) }));
  const kitaplar = Ra.kitapDagit(k, 100);
  assert.equal(kitaplar.length, 20);
  for (const b of kitaplar) {
    assert.equal(b.length, 100);
    for (let i = 1; i < b.length; i++) assert.ok(b[i].puan >= b[i - 1].puan);
  }
  const ort = kitaplar.map(b => b.reduce((s, x) => s + x.puan, 0) / b.length);
  assert.ok(Math.max(...ort) - Math.min(...ort) < 20);
});
