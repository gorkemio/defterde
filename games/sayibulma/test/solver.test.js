// node --test — solver.js: simülasyon (300 sayı), çelişki ve tek satır düzeltme, çıkarım, asenkron seçim, süre ölçümü
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules.js');
const V = require('../solver.js');

// Tohumlu bir oyun: gizli sayı ve çözücünün rastgelelikleri aynı üreteçten. Dönüş: tahmin sayısı
function oyna(seviye, tohum, ayar = {}) {
  const r = R.rng(tohum), k = R.kume(ayar), gizli = Math.floor(r() * k.boyut);
  let S = V.kur(ayar), n = 0;
  for (;;) {
    const t = V.sec(S, { seviye, r });
    n++;
    const kod = k.skor(gizli, t.tahmin);
    if (kod === k.kazanKodu) return n;
    S = V.ele(S, t.tahmin, kod);
    assert.ok(V.kalan(S) > 0, 'doğru cevaplarla aday kümesi boşalamaz');
    if (n > 30) return n;
  }
}
function istatistik(seviye, N = 300, ayar) {
  const liste = [];
  for (let i = 0; i < N; i++) liste.push(oyna(seviye, 1000 + i, ayar));
  const ort = liste.reduce((a, b) => a + b, 0) / N, dagilim = {};
  liste.forEach(n => { dagilim[n] = (dagilim[n] || 0) + 1; });
  return { ort, enCok: Math.max(...liste), dagilim };
}

test('zor: 300 sayının hepsini ≤ 8 tahminde bulur, ortalama < 5.6', (t) => {
  const s = istatistik('zor');
  t.diagnostic(`zor ortalama ${s.ort.toFixed(3)}, en çok ${s.enCok}, dağılım ${JSON.stringify(s.dagilim)}`);
  assert.ok(s.enCok <= 8, `en çok ${s.enCok}`);
  assert.ok(s.ort < 5.6, `ortalama ${s.ort}`);
});

test('orta: 300 sayıda ortalama < 5.6', (t) => {
  const s = istatistik('orta');
  t.diagnostic(`orta ortalama ${s.ort.toFixed(3)}, en çok ${s.enCok}, dağılım ${JSON.stringify(s.dagilim)}`);
  assert.ok(s.ort < 5.6, `ortalama ${s.ort}`);
});

test('kolay: 300 sayıda ortalama 6.5–8, en çok 14', (t) => {
  const s = istatistik('kolay');
  t.diagnostic(`kolay ortalama ${s.ort.toFixed(3)}, en çok ${s.enCok}, dağılım ${JSON.stringify(s.dagilim)}`);
  assert.ok(s.ort >= 6.5 && s.ort <= 8, `ortalama ${s.ort}`);
  assert.ok(s.enCok <= 14, `en çok ${s.enCok}`);
});

test('diğer ayarlar: 3 / 5 hane ve tekrarlı rakamda zor bulur', () => {
  for (const ayar of [{ hane: 3 }, { hane: 5 }, { tekrar: true }, { hane: 4, sifirBaslar: true }]) {
    for (let i = 0; i < 12; i++) {
      const n = oyna('zor', 500 + i, ayar);
      assert.ok(n <= 9, `${JSON.stringify(ayar)}: ${n} tahmin`);
    }
  }
});

test('ele ve kalan: tahmin dizesiyle de çalışır, S değişmez', () => {
  const S0 = V.kur({});
  assert.equal(V.kalan(S0), 4536);
  const S1 = V.ele(S0, '1234', R.kod(0, 2, 4));
  assert.equal(V.kalan(S0), 4536);
  assert.equal(V.kalan(S1), 1155);
  const S2 = V.ele(S1, '5678', R.kod(0, 1, 4));
  assert.equal(V.kalan(S2), 441);
  assert.equal(S2.cevaplar.length, 2);
});

/* ---------- çelişki ---------- */

const T = ['1234', '5678', '4930', '9340'];                // gizli 4703: +0−2, +0−1, +1−2, +0−3
const DOGRU = [[0, 2], [0, 1], [1, 2], [0, 3]];
function kurCevap(cevaplar) {
  return V.kur({}, T.slice(0, cevaplar.length).map((t, i) => ({ tahmin: t, arti: cevaplar[i][0], eksi: cevaplar[i][1] })));
}

test('çelişki yokken null', () => {
  assert.equal(V.celiski(kurCevap(DOGRU)), null);
});

test('tek yanlış cevap: tam o satır gösterilir', () => {
  for (const [i, yanlis] of [[0, [0, 0]], [1, [2, 1]], [2, [0, 0]], [3, [0, 4]]]) {
    const c = DOGRU.map(x => x.slice());
    c[i] = yanlis;
    const S = kurCevap(c);
    assert.equal(V.kalan(S), 0, `satır ${i + 1} yanlışken çelişki`);
    assert.deepEqual(V.celiski(S), { satirlar: [i] }, `satır ${i + 1}`);
  }
});

test('iki satırdan biri olabilir: ikisi de gösterilir', () => {
  const c = DOGRU.map(x => x.slice());
  c[2] = [2, 0];
  assert.deepEqual(V.celiski(kurCevap(c)), { satirlar: [2, 3] });
});

test('tek satırla giderilemeyen çelişki: boş liste', () => {
  const c = DOGRU.map(x => x.slice());
  c[0] = [0, 0]; c[1] = [0, 4];
  assert.deepEqual(V.celiski(kurCevap(c)), { satirlar: [] });
});

test('satır düzeltilince küme yeniden dolar ve gizli sayı içinde', () => {
  const c = DOGRU.map(x => x.slice());
  c[1] = [2, 1];
  assert.equal(V.kalan(kurCevap(c)), 0);
  c[1] = [0, 1];
  const S = kurCevap(c);
  assert.ok(Array.from(S.adaylar).includes(S.kume.indeks('4703')));
});

/* ---------- çıkarım ---------- */

function elleKume(dizeler, ayar = {}) {
  const kume = R.kume(ayar);
  return { ayar: R.ayar(ayar), kume, adaylar: Uint32Array.from(dizeler.map(d => kume.indeks(d))), cevaplar: [] };
}

test('çıkarım: kesin var / yok / yeri kesin', () => {
  assert.deepEqual(V.cikarim(elleKume(['1234', '1243', '1324'])), { var: [1, 2, 3, 4], yok: [0, 5, 6, 7, 8, 9], yer: { 1: 1 } });
  assert.deepEqual(V.cikarim(elleKume(['5678', '1234'])), { var: [], yok: [0, 9], yer: {} });
  assert.deepEqual(V.cikarim(elleKume(['4703'])), { var: [0, 3, 4, 7], yok: [1, 2, 5, 6, 8, 9], yer: { 4: 1, 7: 2, 0: 3, 3: 4 } });
  assert.deepEqual(V.cikarim(elleKume(['4053', '4063', '4083', '4503'])), { var: [0, 3, 4], yok: [1, 2, 7, 9], yer: { 4: 1, 3: 4 } });
  assert.deepEqual(V.cikarim(elleKume(['1123', '1132'], { tekrar: true })), { var: [1, 2, 3], yok: [0, 4, 5, 6, 7, 8, 9], yer: { 1: 1 } });
  assert.equal(V.cikarim(elleKume([])), null);
});

test('çıkarım gerçek oyunda: örnek sahnedeki dört cevaptan sonra', () => {
  const S = kurCevap(DOGRU);
  assert.equal(V.kalan(S), 9);
  assert.deepEqual(V.cikarim(S), { var: [3, 4], yok: [1, 2], yer: { 4: 1, 3: 4 } });
});

/* ---------- seçim ayrıntıları ---------- */

test('ilk tahmin geçerli, tohuma göre değişir; tekrarlıda aabb kalıbı', () => {
  const k = R.kume({}), farkli = new Set();
  for (let i = 0; i < 20; i++) {
    const t = V.ilkTahmin({}, R.rng(i));
    assert.ok(R.gecerli(k.dize(t), {}));
    farkli.add(t);
  }
  assert.ok(farkli.size > 15);
  const kt = R.kume({ tekrar: true }), d = kt.dize(V.ilkTahmin({ tekrar: true }, R.rng(3)));
  assert.match(d, /^(\d)\1(\d)\2$/);
  assert.notEqual(d[0], d[2]);
});

test('aday kalmayınca seçim null; tek aday kalınca o', () => {
  const c = DOGRU.map(x => x.slice()); c[0] = [0, 0];
  assert.equal(V.sec(kurCevap(c), { seviye: 'zor', r: R.rng(1) }), null);
  const S = V.ele(kurCevap(DOGRU), '4073', R.kod(2, 2, 4));
  assert.equal(V.kalan(S), 1);
  assert.equal(V.sec(S, { seviye: 'zor', r: R.rng(1) }).dize, '4703');
});

test('secAsync: büyük bütçeyle sec ile aynı tahmin', async () => {
  const S = V.ele(V.kur({}), '1234', R.kod(0, 2, 4));
  for (const seviye of ['kolay', 'orta', 'zor']) {
    const a = V.sec(S, { seviye, r: R.rng(9) });
    const b = await V.secAsync(S, { seviye, r: R.rng(9), butceMs: 1e6 });
    assert.equal(b.tahmin, a.tahmin, seviye);
    assert.equal(b.eksik, false);
  }
});

test('secAsync: bütçe dolunca o ana kadarki en iyiyle döner', async () => {
  const S = V.ele(V.kur({ hane: 5 }), '12345', R.kod(0, 2, 5));
  const b = await V.secAsync(S, { seviye: 'zor', r: R.rng(2), butceMs: 1, dilimMs: 1 });
  assert.ok(b && b.tahmin >= 0, 'bir tahmin döndü');
  assert.equal(b.eksik, true);
});

test('secAsync: iptal edilince AbortError', async () => {
  const S = V.ele(V.kur({ hane: 5 }), '12345', R.kod(0, 2, 5));
  const k = new AbortController();
  const p = V.secAsync(S, { seviye: 'zor', r: R.rng(2), dilimMs: 1, signal: k.signal });
  k.abort();
  await assert.rejects(p, { name: 'AbortError' });
});

test('ölçüm: zor çözücünün ilk iki tahmininde hesap süresi', (t) => {
  const o = V.olc({ n: 20 });
  const ort = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  t.diagnostic(`1. tahmin (önceden belirli) ort ${ort(o.ilk)} ms · 2. tahmin ort ${ort(o.ikinci)} ms, en çok ${o.enCok.toFixed(1)} ms · ` +
    `ilk tahmin hesaplansaydı ${o.tamIlkMs.toFixed(0)} ms (${o.tamIlkTahmin})`);
  assert.ok(o.enCok < 300, `2. tahmin ${o.enCok} ms`);
});
