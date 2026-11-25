const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine/model.js');
const A = require('../engine/ai.js');
const G = require('../engine/generator.js');
const H = require('./havuz.js');

const ort = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function sure(d, kategori, seviye, tohum) { const p = A.plan(d, { kategori, seviye, tohum }); return p.pes ? 90 : p.buldu; }

test('Orta: bant ortalamaları sıralı (tek ve iki çöp, banttan 30 bulmaca)', { skip: !H.varMi() }, (t) => {
  for (const k of ['tek', 'iki']) {
    const o = ['kolay', 'orta', 'zor', 'cokzor'].map(b => {
      const L = H.kayitlar(`${k}-${b}`), r = M.rng(['ai', k, b]);
      return ort(Array.from({ length: 30 }, (_, i) => sure(L[Math.floor(r() * L.length)].durum, k, 'orta', i)));
    });
    t.diagnostic(`${k}: ${o.map(x => x.toFixed(1)).join(' < ')}`);
    for (let i = 1; i < 4; i++) assert.ok(o[i] > o[i - 1], `${k} ${o}`);
  }
});

test('seviyeler: Usta < Zor < Orta < Kolay', { skip: !H.varMi() }, () => {
  const L = H.kayitlar('tek-orta'), r = M.rng('seviye');
  const ornek = Array.from({ length: 40 }, () => L[Math.floor(r() * L.length)].durum);
  const o = ['usta', 'zor', 'orta', 'kolay'].map(s => ort(ornek.map((d, i) => sure(d, 'tek', s, i))));
  for (let i = 1; i < 4; i++) assert.ok(o[i] > o[i - 1], o.join());
});

test('aynı tohum aynı plan; farklı tohum farklı', () => {
  const d = M.yaz('2+1=2', '13+5=10');
  assert.deepEqual(A.plan(d, { kategori: 'iki', seviye: 'orta', tohum: 3 }), A.plan(d, { kategori: 'iki', seviye: 'orta', tohum: 3 }));
  assert.notDeepEqual(A.plan(d, { kategori: 'iki', seviye: 'orta', tohum: 3 }).centikler, A.plan(d, { kategori: 'iki', seviye: 'orta', tohum: 4 }).centikler);
});

test('çentikler çözümün hangisi olduğundan bağımsız (sıralama doğruluğu kullanmaz)', () => {
  const d = M.yaz('2+2=2', '12+34=40');
  const liste = A.adayListesi(d, { k: 1 });
  assert.ok(liste.length > 3);
  const tek = liste.map(a => ({ ...a, dogru: false }));
  const p0 = A.plan(d, { kategori: 'tek', seviye: 'orta', tohum: 9, adaylar: tek });
  for (let j = 0; j < liste.length; j++) {
    const l = tek.map((a, i) => ({ ...a, dogru: i === j }));
    const p = A.plan(d, { kategori: 'tek', seviye: 'orta', tohum: 9, adaylar: l });
    // çözüm bulunana kadarki çentikler, hiç çözüm olmayan planın başıyla aynı
    assert.deepEqual(p.centikler, p0.centikler.slice(0, p.centikler.length));
  }
});

test('pes 90 saniye sınırına uyar; çözüm üst düzeyde görünmez', () => {
  const d = M.yaz('2+1=2', '13+5=10');
  const p = A.plan(d, { kategori: 'iki', seviye: 'kolay', tohum: 1, sureS: 20 });
  assert.ok(p.centikler.every(t => t <= 20));
  const acik = JSON.stringify({ centikler: p.centikler, buldu: p.buldu, pes: p.pes });
  assert.ok(!/[0-9]+[+\-*/=][0-9]/.test(acik), 'çözüm metni yalnız gizli alanda');
  assert.deepEqual(Object.keys(p).sort(), ['buldu', 'centikler', 'gizli', 'pes']);
});

test('Hepsini Bul planı 2–6 çözümü zamanlarıyla verir', () => {
  const u = G.uret(5, { kategori: 'hepsini' });
  const p = A.plan(u.durum, { kategori: 'tek', seviye: 'usta', tohum: 2, hepsini: true, sureS: 600 });
  const n = require('../engine/solver.js').cozumSayisi(u.durum, { k: 1 });
  assert.ok(n >= 2 && n <= 6);
  assert.equal(p.gizli.cozumler.length, n);
  for (let i = 1; i < n; i++) assert.ok(p.gizli.cozumler[i].t >= p.gizli.cozumler[i - 1].t);
});

test('bozucu: tek çözümlü, kanonik, yanlış bozma seçer; Kolay rastgele', () => {
  const d = M.yaz('2+1=2', '13+5=18');
  const b = A.bozmaSec(d, 'orta', M.rng(1));
  assert.ok(b && !M.dogru(b) && M.kanonikMi(b));
  assert.equal(require('../engine/solver.js').cozumSayisi(b, { k: 1 }), 1);
  const k = A.bozmaSec(d, 'kolay', M.rng(2));
  assert.ok(k && !M.dogru(k));
});
