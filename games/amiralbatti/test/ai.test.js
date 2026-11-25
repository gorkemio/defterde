// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const AI = require('../ai.js');
const config = require('../config.js');

// Metinle görünüm kur: her satır 10 karakter ('?' 'o' 'x' '#'); kalan uzunluklar verilir.
function gorunum(satirlar, kalan) {
  const n = satirlar.length;
  const hucre = satirlar.join('').split('');
  assert.equal(hucre.length, n * n);
  return { n, hucre, kalanUzunluklar: kalan };
}
const bos = (n = 10) => Array.from({ length: n }, () => '?'.repeat(n));
const yaz = (satirlar, s, k, c) => { const a = satirlar.map(r => r.split('')); a[s][k] = c; return a.map(r => r.join('')); };
const adlar = (liste) => liste.map(h => G.hucreAdi(h.s, h.k)).sort();

test('sec: yalnız bilinmeyen hücre seçer (rastgele görünümlerde)', () => {
  const r = G.rng(5);
  for (let t = 0; t < 300; t++) {
    const tahta = G.yeniTahta(config, r);
    const atis = Math.floor(r() * 60);
    for (let i = 0; i < atis; i++) G.atesEt(tahta, Math.floor(r() * 10), Math.floor(r() * 10));
    if (G.hepsiBatti(tahta)) continue;
    const v = G.gorunum(tahta);
    const { s, k } = AI.sec(v, { parite: true }, r);
    assert.equal(v.hucre[s * 10 + k], '?');
  }
});

test('hedef: tek isabette dört dik komşu aday olur', () => {
  const v = gorunum(yaz(bos(), 4, 4, 'x'), [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
  assert.deepEqual(adlar(AI.hedefAdaylari(v)), ['D5', 'E4', 'E6', 'F5']);
});

test('hedef: köşedeki tek isabette yalnız tahta içindeki komşular', () => {
  const v = gorunum(yaz(bos(), 0, 0, 'x'), [4]);
  assert.deepEqual(adlar(AI.hedefAdaylari(v)), ['A2', 'B1']);
});

test('hedef: ıska olan komşu aday olmaz', () => {
  let s = yaz(bos(), 4, 4, 'x');
  s = yaz(s, 3, 4, 'o'); s = yaz(s, 4, 3, 'o');
  assert.deepEqual(adlar(AI.hedefAdaylari(gorunum(s, [3]))), ['E6', 'F5']);
});

test('hedef: iki yatay isabette doğrultu devam eder (yalnız iki uç)', () => {
  let s = yaz(bos(), 4, 4, 'x'); s = yaz(s, 4, 5, 'x');
  assert.deepEqual(adlar(AI.hedefAdaylari(gorunum(s, [4]))), ['D5', 'G5']);
});

test('hedef: bir uç ıskaysa diğer uca gider', () => {
  let s = yaz(bos(), 2, 3, 'x'); s = yaz(s, 3, 3, 'x'); s = yaz(s, 1, 3, 'o');
  assert.deepEqual(adlar(AI.hedefAdaylari(gorunum(s, [3]))), ['D5']);
});

test('hedef: isabetler arasında boşluk varsa önce o doldurulur', () => {
  let s = yaz(bos(), 5, 2, 'x'); s = yaz(s, 5, 4, 'x');
  assert.deepEqual(adlar(AI.hedefAdaylari(gorunum(s, [3]))), ['D6']);
});

test('hedef: üç isabetli hatta uçlar atlanarak bulunur', () => {
  let s = yaz(bos(), 0, 3, 'x'); s = yaz(s, 1, 3, 'x'); s = yaz(s, 2, 3, 'x');
  assert.deepEqual(adlar(AI.hedefAdaylari(gorunum(s, [4]))), ['D4']);   // üstü tahta dışı
});

test('hedef: hizasız isabetlerde (değme serbest) komşulara düşer', () => {
  let s = yaz(bos(), 2, 2, 'x'); s = yaz(s, 6, 7, 'x');
  const aday = AI.hedefAdaylari(gorunum(s, [2, 2]));
  assert.equal(aday.length, 8);
});

test('hedef: batmış gemi (#) ve çevresi hedef üretmez; av moduna döner', () => {
  let s = bos();
  for (const [r, c] of [[0, 0], [0, 1]]) s = yaz(s, r, c, '#');
  for (const [r, c] of [[0, 2], [1, 0], [1, 1], [1, 2]]) s = yaz(s, r, c, 'o');
  const v = gorunum(s, [3, 2]);
  assert.deepEqual(AI.hedefAdaylari(v), []);
  const { s: a, k } = AI.sec(v, { parite: true }, G.rng(1));
  assert.equal(v.hucre[a * 10 + k], '?');
});

test('av: parite açıkken boş tahtada hep aynı renkten hücre seçer', () => {
  const v = gorunum(bos(), [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
  const renkler = new Set();
  const r = G.rng(3);
  for (let i = 0; i < 200; i++) { const { s, k } = AI.sec(v, { parite: true }, r); renkler.add((s + k) % 2); }
  assert.equal(renkler.size, 1);
});

test('av: parite kapalıyken iki renk de seçilir', () => {
  const v = gorunum(bos(), [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
  const renkler = new Set();
  const r = G.rng(3);
  for (let i = 0; i < 200; i++) { const { s, k } = AI.sec(v, { parite: false }, r); renkler.add((s + k) % 2); }
  assert.equal(renkler.size, 2);
});

test('av: yalnız 1\'likler kalınca parite bırakılır', () => {
  const v = gorunum(bos(), [1, 1]);
  const renkler = new Set();
  const r = G.rng(9);
  for (let i = 0; i < 200; i++) { const { s, k } = AI.sec(v, { parite: true }, r); renkler.add((s + k) % 2); }
  assert.equal(renkler.size, 2);
});

test('sigar: gemi sığmayan tek hücre elenir', () => {
  // A1 çevresi ıska: yalnız kendisi boş; 2'lik sığmaz, 1'lik sığar.
  let s = bos();
  s = yaz(s, 0, 1, 'o'); s = yaz(s, 1, 0, 'o');
  assert.equal(AI.sigar(gorunum(s, [2]), 0, 0), false);
  assert.equal(AI.sigar(gorunum(s, [2, 1]), 0, 0), true);
});

test('av: sığmayan hücreler aday olmaz', () => {
  let s = bos();
  s = yaz(s, 0, 1, 'o'); s = yaz(s, 1, 0, 'o');
  const aday = AI.avAdaylari(gorunum(s, [2]), false);
  assert.ok(!adlar(aday).includes('A1'));
});

// ---- simülasyon: AI tek başına bir tahtayı batırır ----

function oyna(cfg, tohum, parite) {
  const r = G.rng(tohum);
  const t = G.yeniTahta(cfg, r);
  let atis = 0;
  while (!G.hepsiBatti(t)) {
    const { s, k } = AI.sec(G.gorunum(t), { parite }, r);
    const sonuc = G.atesEt(t, s, k);
    assert.notEqual(sonuc.sonuc, 'tekrar', 'AI aynı hücreye ikinci kez attı');
    atis++;
    assert.ok(atis <= 100, 'oyun 100 atışta bitmeli');
  }
  return atis;
}

const ortalama = (cfg, parite, adet = 200) => {
  let toplam = 0, enAz = 1e9, enCok = 0;
  for (let i = 1; i <= adet; i++) { const a = oyna(cfg, i * 7919, parite); toplam += a; enAz = Math.min(enAz, a); enCok = Math.max(enCok, a); }
  return { ort: toplam / adet, enAz, enCok };
};

test('simülasyon: varsayılan filoda 200 tahtada hep biter, tekrar yok, ortalama makul', () => {
  const a = ortalama(config, true), b = ortalama(config, false);
  console.log(`  varsayılan filo — parite açık: ort ${a.ort.toFixed(1)} (en az ${a.enAz}, en çok ${a.enCok}) · kapalı: ort ${b.ort.toFixed(1)} (en az ${b.enAz}, en çok ${b.enCok})`);
  assert.ok(a.ort < 65, `ortalama ${a.ort} çok yüksek`);
  assert.ok(b.ort < 65, `ortalama ${b.ort} çok yüksek`);
});

test('simülasyon: klasik filoda (5,4,3,3,2) parite ortalamayı belirgin düşürür', () => {
  const klasik = { boyut: 10, gemiler: [5, 4, 3, 3, 2], degmeYasak: false };
  const a = ortalama(klasik, true, 300), b = ortalama(klasik, false, 300);
  console.log(`  klasik filo — parite açık: ort ${a.ort.toFixed(1)} · kapalı: ort ${b.ort.toFixed(1)}`);
  assert.ok(a.ort + 4 < b.ort, 'parite en az 4 atış kazandırmalı');
});

test('simülasyon: değme serbestken de (gevşek hedef zinciri) hep biter', () => {
  const cfg = { ...config, degmeYasak: false };
  const a = ortalama(cfg, true, 200);
  console.log(`  değme serbest: ort ${a.ort.toFixed(1)} (en çok ${a.enCok})`);
  assert.ok(a.enCok <= 100);
});

test('simülasyon: 8x8 küçük tahtada da biter', () => {
  const cfg = { boyut: 8, gemiler: [3, 2, 2, 1, 1], degmeYasak: true };
  for (let i = 1; i <= 100; i++) oyna(cfg, i, true);
});
