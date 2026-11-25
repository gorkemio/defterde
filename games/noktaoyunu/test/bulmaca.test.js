// node --test test/bulmaca.test.js — 20 "bu konumda kazan" bulmacası çözücüyle doğrulanır (PLAN §10)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const C = require('../chains.js');
const A = require('../ai.js');
const BULMACALAR = require('../bulmacalar.js');

const kur = (b) => B.kur({ m: b.m, n: b.n, bos: b.bos, sira: 0 });

test('20 bulmaca: 7 kolay · 7 orta · 6 zor, kolaydan zora sıralı', () => {
  assert.equal(BULMACALAR.length, 20);
  const z = BULMACALAR.map(b => b.zorluk);
  assert.deepEqual(['kolay', 'orta', 'zor'].map(x => z.filter(y => y === x).length), [7, 7, 6]);
  assert.deepEqual(z, [...z].sort((a, b) => ['kolay', 'orta', 'zor'].indexOf(a) - ['kolay', 'orta', 'zor'].indexOf(b)));
});

BULMACALAR.forEach((b, i) => {
  test(`bulmaca ${i + 1} (${b.zorluk}, ${b.m}×${b.n}, ${b.parcalar}): kazanılabilir, tuzak var`, () => {
    const d = kur(b), P = C.parcala(d);
    assert.equal(d.puan[0] + d.puan[1], 0, 'henüz kutu yok');
    assert.equal(B.guvenli(d).length, 0, 'güvenli hamle yok');
    assert.equal(B.alinabilir(d).length, 0);
    assert.ok(P.saf, 'kavşak yok');
    assert.equal(C.coz(P.parcalar).deger, b.deger);
    assert.ok(b.deger > 0, 'sıradaki kazanır');
    if (P.serbestKenar <= 22) assert.equal(C.tahtaCoz(d).deger, b.deger, 'tahta üstü arama da aynı');
    // en az bir ilk çizgi kaybettirir
    // küçük tahtada her ilk çizgi kesin aramayla; büyükte (F > 22) her parçanın açılışı parça çözücüsüyle
    const kaybettiren = P.serbestKenar <= 23
      ? B.hamleler(d).some(e => { const t = C.tahtaCoz(B.uygula(d, e)); return t && -t.deger < 0; })
      : P.parcalar.some((p, i) => -C.cevap(P.parcalar, i, p.tur === 'dongu' ? 'dongu' : 'uc').deger < 0);
    assert.ok(kaybettiren, 'tuzak: kaybettiren bir ilk çizgi var');
    // insan kesin, bilgisayar zor oynarsa sonuç tam değer
    const s = B.kopya(d);
    while (!s.bitti) {
      const e = s.sira === 0 ? (C.tahtaCoz(s, { sinir: 24 }) || A.sec(s, { zorluk: 'zor' })).hamle ?? A.sec(s, { zorluk: 'zor' }).e
        : A.sec(s, { zorluk: 'zor', butceMs: 100 }).e;
      B.cek(s, e);
    }
    assert.equal(s.puan[0] - s.puan[1], b.deger);
  });
});
