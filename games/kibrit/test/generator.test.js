const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine/model.js');
const S = require('../engine/solver.js');
const G = require('../engine/generator.js');
const H = require('./havuz.js');

test('doğru eşitlik sayımı küçük şablonda elle sayımla aynı', () => {
  // a+b=c tek basamak: a, b ∈ 0..9, a+b ≤ 9 → 55
  assert.equal(G.dogruEsitlikler('1+1=1').length, 55);
  // a×b=c tek basamak: 0 içerenler 19, diğerleri a·b ≤ 9: 23 → 42
  assert.equal(G.dogruEsitlikler('1x1=1').length, 42);
  for (const d of G.dogruEsitlikler('2-1=2')) { assert.equal(M.dogru(d), true); assert.equal(M.kanonikMi(d), true); }
});

test('boz: her çıktı kanonik, geçerli ve yanlış; çözümü kaynak eşitliği içerir', () => {
  const r = M.rng(4);
  for (const id of ['1+1=2', '2-1=2', '1x1+1=2', '2/1=1']) {
    const esit = G.dogruEsitlikler(id).slice(0, 15);
    for (const d of esit) {
      for (const [kat, ters] of Object.entries(G.TERS)) {
        if (kat === 'romen' || kat === 'hepsini') continue;
        for (const b of G.boz(d, ters, { enCok: 8, r })) {
          assert.equal(M.kanonikMi(b), true);
          assert.equal(M.oku(b).gecerli, true);
          assert.equal(M.dogru(b), false);
          const hak = M.hakOf(kat);
          assert.ok(S.coz(b, hak).some(g => g.metin === M.oku(d).metin), 'kaynak çözüm olmalı');
        }
      }
    }
  }
});

test('tarayıcı üreticisi: her çıktı yanlış, kanonik ve kategori koşulunu sağlıyor (200 tohum)', () => {
  const kat = ['tek', 'iki', 'ekle', 'cikar', 'hepsini', 'romen'];
  for (let t = 0; t < 200; t++) {
    const k = kat[t % kat.length];
    const u = G.uret(t, { kategori: k, enCokHucre: k === 'iki' ? 7 : 9 });
    assert.ok(u, 'üretilemedi ' + k + ' ' + t);
    assert.equal(M.dogru(u.durum), false);
    assert.equal(M.kanonikMi(u.durum), true);
    assert.equal(G.kosul(u.durum, k), true, `${k} ${M.kanonikDize(u.durum)}`);
  }
});

test('aynı tohum aynı bulmaca; band hedefi gözetilir', () => {
  const a = G.uret(77, { kategori: 'tek', band: 'zor' }), b = G.uret(77, { kategori: 'tek', band: 'zor' });
  assert.equal(M.kanonikDize(a.durum), M.kanonikDize(b.durum));
  assert.notEqual(M.kanonikDize(G.uret(78, { kategori: 'tek' }).durum), M.kanonikDize(a.durum));
  assert.ok(['orta', 'zor', 'cokzor'].includes(a.zorluk.bant));
});

test('havuz değişmezleri: her kayıt başlangıçta yanlış, kanonik ve kategori koşulunu sağlıyor', { skip: !H.varMi() }, () => {
  const meta = require('../data/havuz/meta.js');
  let n = 0;
  for (const ad of meta.paketler) {
    const liste = H.kayitlar(ad);
    const r = M.rng(ad);
    // her paketten 60 kayıt (tamamı uzun sürer: KB_TAM=1 ile hepsi)
    const ornek = process.env.KB_TAM ? liste : Array.from({ length: Math.min(60, liste.length) }, () => liste[Math.floor(r() * liste.length)]);
    for (const x of ornek) {
      assert.equal(G.kosul(x.durum, x.kategori), true, `${ad} ${x.kimlik}`);
      n++;
    }
    for (let i = 1; i < liste.length; i++) assert.ok(liste[i].puan >= liste[i - 1].puan, 'puana göre sıralı');
  }
  assert.ok(n > 1000);
  assert.ok(meta.toplam >= 19000, 'toplam ' + meta.toplam);
  const hedef = { tek: 8000, iki: 5000, ekle: 2000, cikar: 2000, hepsini: 1500, romen: 500 };
  for (const [k, h] of Object.entries(hedef)) {
    const s = meta.sayilar[k], t = Object.values(s).reduce((a, c) => a + c, 0);
    assert.ok(t >= h, `${k} ${t}`);
    for (const b in s) assert.ok(s[b] / t >= .1, `${k}-${b} %10 altında`);
  }
});
