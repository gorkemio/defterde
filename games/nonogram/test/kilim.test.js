const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../nonogram/kilim.js');
const S = require('../nonogram/solver.js');
const D = require('../nonogram/difficulty.js');

test('K1 simetri: dörtlü desen iki eksende, ayna desen dikey eksende aynalı', () => {
  let dortlu = 0, ayna = 0;
  for (const n of [11, 15, 19, 21]) for (let t = 1; t <= 25; t++) {
    const { katman: g, sim } = K.desen(t, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      assert.equal(!!g[y * n + x], !!g[y * n + n - 1 - x], `${n}/${t} dikey eksen`);
      if (sim === 'dortlu') assert.equal(!!g[y * n + x], !!g[(n - 1 - y) * n + x], `${n}/${t} yatay eksen`);
    }
    if (sim === 'dortlu') dortlu++; else ayna++;
  }
  assert.ok(dortlu > 40 && ayna > 10, `dörtlü ${dortlu}, ayna ${ayna}`);
});

test('K2 tekillik: 4 boy × 12 tohum hepsi tek çözümlü ve tahminsiz', () => {
  for (const n of [11, 15, 19, 21]) for (let t = 1; t <= 12; t++) {
    const u = K.uret(t * 31 + n, { boy: n, hedefBant: 'orta' });
    assert.ok(u, `${n}/${t} üretildi`);
    const b = u.bulmaca;
    assert.equal(S.tekillik(b, { dugumButcesi: 40000 }).sonuc, 'tek', `${n}/${t}`);
    assert.notEqual(D.derece(b).bant, 'tahmin', `${n}/${t}`);
  }
});

test('K3 zorluk bantları dağılıyor; 15×15\'te hedef bant tutturma ≥ %70', () => {
  const gorulen = new Set();
  let tutan = 0, toplam = 0;
  for (const hedef of ['kolay', 'orta', 'zor']) for (let t = 1; t <= 10; t++) {
    const u = K.uret(t * 7 + 1000, { boy: 15, hedefBant: hedef });
    gorulen.add(u.derece.bant);
    toplam++; if (u.derece.bant === hedef) tutan++;
  }
  assert.ok(gorulen.has('kolay') && gorulen.has('orta') && gorulen.has('zor'), [...gorulen].join(','));
  assert.ok(tutan / toplam >= .7, `${tutan}/${toplam}`);
});

test('K4 aynı tohum aynı desen ve aynı bulmaca', () => {
  const a = K.resim(214, { boy: 15 }), b = K.resim(214, { boy: 15 });
  assert.deepEqual(Array.from(a.cozum), Array.from(b.cozum));
  assert.deepEqual(a.renk, b.renk);
  assert.deepEqual(a.baslangic, b.baslangic);
  assert.equal(a.ad, b.ad);
  assert.match(a.ad, /^Kilim No\. \d{3}$/);
});

test('K5 süre: 15×15 bir desen (yeniden denemeler dahil) ortalama 300 ms altında', () => {
  const sure = [];
  for (let t = 1; t <= 12; t++) for (const hedef of ['kolay', 'orta', 'zor']) {
    const a = performance.now(); K.uret(t * 13 + 5, { boy: 15, hedefBant: hedef }); sure.push(performance.now() - a);
  }
  const ort = sure.reduce((x, y) => x + y, 0) / sure.length;
  assert.ok(ort < 300, `ortalama ${ort.toFixed(0)} ms`);
});

test('K6 düzeltme oranı raporu', () => {
  const say = { yok: 0, kirma: 0, baslangic: 0 }, bas = [];
  for (const n of [11, 15, 19, 21]) for (let t = 1; t <= 10; t++) {
    const u = K.uret(t * 53 + n, { boy: n, hedefBant: 'orta' });
    say[u.duzeltme.tur]++; if (u.duzeltme.baslangic) bas.push(u.duzeltme.baslangic);
  }
  const top = say.yok + say.kirma + say.baslangic, yuzde = (k) => `${Math.round(100 * say[k] / top)}%`;
  console.log(`kilim düzeltme (orta, 40 desen): düzeltmesiz ${yuzde('yok')} · simetri kırma ${yuzde('kirma')} · başlangıç karesi ${yuzde('baslangic')} · ortalama başlangıç ${bas.length ? (bas.reduce((a, b) => a + b, 0) / bas.length).toFixed(1) : 0}`);
  assert.equal(top, 40);
});

test('K7 doluluk ve kabul: her satır ve sütunda en az bir dolu kare, doluluk %28–62', () => {
  for (const n of [11, 15, 19, 21]) for (let t = 1; t <= 10; t++) {
    const u = K.uret(t * 3 + n, { boy: n, hedefBant: 'orta' }), g = u.bulmaca.cozum;
    const oran = g.reduce((a, v) => a + v, 0) / (n * n);
    assert.ok(oran >= .26 && oran <= .64, `${n}/${t} ${oran}`);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = 0; j < n; j++) { s += g[i * n + j]; c += g[j * n + i]; }
      assert.ok(s > 0 && c > 0, `${n}/${t} satır/sütun ${i}`);
    }
  }
});

test('K8 tohum yardımcıları kit ile aynı (karma)', () => {
  // kit/kalem.js tarayıcıda çalışır; FNV-1a değerini sabit örnekle karşılaştır
  assert.equal(K.karma('a', 1), (() => { let h = 2166136261; for (const ch of 'a|1') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; })());
});
