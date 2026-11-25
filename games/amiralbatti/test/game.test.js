// node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const config = require('../config.js');

const sayac = (liste) => liste.slice().sort((a, b) => b - a).join(',');

// Bir tahtanın kurallara uyduğunu denetler.
function gecerliMi(t, cfg) {
  assert.equal(sayac(t.gemiler.map(g => g.uzunluk)), sayac(cfg.gemiler), 'gemi uzunlukları');
  const sahip = new Map();
  for (const g of t.gemiler) {
    assert.equal(g.hucreler.length, g.uzunluk);
    for (const h of g.hucreler) {
      assert.ok(h.s >= 0 && h.k >= 0 && h.s < t.n && h.k < t.n, 'sınır içinde');
      const anahtar = h.s * t.n + h.k;
      assert.ok(!sahip.has(anahtar), 'çakışma yok');
      sahip.set(anahtar, g.id);
      assert.equal(t.gemiHaritasi[anahtar], g.id, 'harita tutarlı');
    }
    // düz ve bitişik
    const h0 = g.hucreler[0];
    g.hucreler.forEach((h, i) => {
      if (g.yatay) { assert.equal(h.s, h0.s); assert.equal(h.k, h0.k + i); }
      else { assert.equal(h.k, h0.k); assert.equal(h.s, h0.s + i); }
    });
  }
  assert.equal(t.gemiHaritasi.filter(v => v !== -1).length, cfg.gemiler.reduce((a, b) => a + b, 0));
  if (cfg.degmeYasak) {
    for (const g of t.gemiler) {
      for (const h of G.halka(t.n, g.hucreler)) {
        const sahibi = sahip.get(h.s * t.n + h.k);
        assert.equal(sahibi, undefined, `gemi ${g.id} başka bir gemiye değiyor (köşegen dahil)`);
      }
    }
  }
}

test('rng: aynı tohum aynı diziyi verir, 0..1 aralığında', () => {
  const a = G.rng(42), b = G.rng(42), c = G.rng(43);
  const x = Array.from({ length: 20 }, a), y = Array.from({ length: 20 }, b), z = Array.from({ length: 20 }, c);
  assert.deepEqual(x, y);
  assert.notDeepEqual(x, z);
  assert.ok(x.every(v => v >= 0 && v < 1));
});

test('yeniTahta: 500 tohum boyunca kurallara uyar (varsayılan config)', () => {
  for (let tohum = 1; tohum <= 500; tohum++) gecerliMi(G.yeniTahta(config, G.rng(tohum)), config);
});

test('yeniTahta: aynı tohum aynı tahtayı verir', () => {
  const a = G.yeniTahta(config, G.rng(7)), b = G.yeniTahta(config, G.rng(7));
  assert.deepEqual(Array.from(a.gemiHaritasi), Array.from(b.gemiHaritasi));
});

test('yeniTahta: başka config (8x8, farklı gemiler)', () => {
  const cfg = { boyut: 8, gemiler: [3, 2, 2, 1, 1], degmeYasak: true };
  for (let tohum = 1; tohum <= 200; tohum++) gecerliMi(G.yeniTahta(cfg, G.rng(tohum)), cfg);
});

test('yeniTahta: degmeYasak kapalıyken yine çakışma yok', () => {
  const cfg = { ...config, degmeYasak: false };
  for (let tohum = 1; tohum <= 200; tohum++) gecerliMi(G.yeniTahta(cfg, G.rng(tohum)), cfg);
});

test('yeniTahta: sığmayan config hata verir', () => {
  assert.throws(() => G.yeniTahta({ boyut: 3, gemiler: [3, 3, 3], degmeYasak: true }, G.rng(1)));
});

test('yerlestirilebilir: sınır, çakışma, yan ve köşegen değme', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 3, 4, 4, true);                                   // satır 4, sütun 4-6
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(2, 9, 9, true)), false, 'sınır dışı');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(2, 4, 5, false)), false, 'çakışma');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(1, 4, 7, true)), false, 'yan komşu');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(1, 5, 7, true)), false, 'köşegen komşu');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(1, 3, 3, true)), false, 'köşegen komşu (sol üst)');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(1, 4, 8, true)), true, 'bir boşluk bırakılmış');
  assert.equal(G.yerlestirilebilir(t, G.gemiHucreleri(2, 6, 4, true)), true, 'iki satır aşağıda');
  const serbest = G.bosTahta(10, false);
  G.gemiEkle(serbest, 3, 4, 4, true);
  assert.equal(G.yerlestirilebilir(serbest, G.gemiHucreleri(1, 5, 7, true)), true, 'değme serbestse köşegen olur');
});

test('gemiEkle: geçersiz yerde hata fırlatır', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 2, 0, 0, true);
  assert.throws(() => G.gemiEkle(t, 2, 1, 0, true));
});

test('atesEt: ıska, tekrar, isabet, batma', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 2, 3, 3, true);                                   // (3,3) (3,4)
  assert.equal(G.atesEt(t, 0, 0).sonuc, 'iska');
  assert.equal(G.atesEt(t, 0, 0).sonuc, 'tekrar');
  assert.equal(t.atis[0], 1);
  const a = G.atesEt(t, 3, 3);
  assert.equal(a.sonuc, 'isabet');
  assert.equal(a.gemi.isabet, 1);
  assert.equal(a.gemi.batti, false);
  assert.equal(G.atesEt(t, 3, 3).sonuc, 'tekrar');
  assert.equal(t.gemiler[0].isabet, 1, 'tekrar atış sayacı artırmaz');
  const b = G.atesEt(t, 3, 4);
  assert.equal(b.sonuc, 'batti');
  assert.equal(b.gemi.batti, true);
  assert.ok(G.hepsiBatti(t));
});

test('atesEt: tahta dışı hata fırlatır', () => {
  const t = G.bosTahta(10, true);
  assert.throws(() => G.atesEt(t, -1, 0), RangeError);
  assert.throws(() => G.atesEt(t, 0, 10), RangeError);
});

test('batma: çevre otomatik ıska olur, isabet ve eski ıskaların üstüne yazılmaz', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 3, 4, 4, true);                                   // satır 4, sütun 4-6
  G.atesEt(t, 3, 3);                                              // halka içinde eski ıska (1)
  for (const k of [4, 5, 6]) G.atesEt(t, 4, k);
  assert.equal(t.atis[3 * 10 + 3], 1, 'eski ıska korunur');
  const halka = G.halka(10, t.gemiler[0].hucreler);
  assert.equal(halka.length, 12, '5x3 alan = 15, gemi 3 hücre: halka 12');
  for (const h of halka) {
    const v = t.atis[h.s * 10 + h.k];
    assert.ok(v === 1 || v === 3, `halka hücresi ${G.hucreAdi(h.s, h.k)} ıska olmalı`);
  }
  for (const k of [4, 5, 6]) assert.equal(t.atis[4 * 10 + k], 2, 'isabetler 2 kalır');
});

test('batma: otoIska yalnız yeni işaretlenenleri döndürür', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 1, 0, 0, true);                                   // köşede tek hücre
  const r = G.atesEt(t, 0, 0);
  assert.equal(r.sonuc, 'batti');
  assert.deepEqual(r.otoIska.map(h => G.hucreAdi(h.s, h.k)).sort(), ['A2', 'B1', 'B2']);
});

test('batma: değme serbestse otomatik ıska yok', () => {
  const t = G.bosTahta(10, false);
  G.gemiEkle(t, 1, 5, 5, true);
  const r = G.atesEt(t, 5, 5);
  assert.equal(r.sonuc, 'batti');
  assert.deepEqual(r.otoIska, []);
  assert.equal(t.atis.filter(v => v === 3).length, 0);
});

test('hepsiBatti: yalnız son gemi batınca doğru olur; boş tahtada yanlış', () => {
  assert.equal(G.hepsiBatti(G.bosTahta(10, true)), false);
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 1, 0, 0, true);
  G.gemiEkle(t, 1, 5, 5, true);
  G.atesEt(t, 0, 0);
  assert.equal(G.hepsiBatti(t), false);
  G.atesEt(t, 5, 5);
  assert.equal(G.hepsiBatti(t), true);
});

test('gorunum: ? o x # ve kalan uzunluklar', () => {
  const t = G.bosTahta(10, true);
  G.gemiEkle(t, 2, 0, 0, true);                                   // (0,0) (0,1)
  G.gemiEkle(t, 3, 5, 5, false);                                  // (5,5) (6,5) (7,5)
  G.gemiEkle(t, 1, 9, 9, true);
  G.atesEt(t, 0, 0); G.atesEt(t, 0, 1);                           // 2'lik battı (+ halka otomatik ıska)
  G.atesEt(t, 5, 5);                                              // 3'lükte tek isabet
  G.atesEt(t, 4, 9);                                              // ıska
  const v = G.gorunum(t);
  assert.equal(v.hucre[0], '#');
  assert.equal(v.hucre[1], '#');
  assert.equal(v.hucre[0 * 10 + 2], 'o', 'otomatik ıska da ıska görünür');
  assert.equal(v.hucre[5 * 10 + 5], 'x');
  assert.equal(v.hucre[4 * 10 + 9], 'o');
  assert.equal(v.hucre[9 * 10 + 9], '?');
  assert.deepEqual(v.kalanUzunluklar, [3, 1]);
});

test('bütün hücrelere sırayla atınca her gemi batar, isabet toplamı gemi toplamına eşit', () => {
  for (let tohum = 1; tohum <= 50; tohum++) {
    const t = G.yeniTahta(config, G.rng(tohum));
    let isabet = 0, batan = 0;
    for (let s = 0; s < 10; s++) {
      for (let k = 0; k < 10; k++) {
        if (t.atis[s * 10 + k] !== 0) continue;                    // otomatik ıska olmuş hücre
        const r = G.atesEt(t, s, k);
        if (r.sonuc === 'isabet' || r.sonuc === 'batti') isabet++;
        if (r.sonuc === 'batti') batan++;
        assert.notEqual(r.sonuc, 'tekrar');
      }
    }
    assert.equal(isabet, 20);
    assert.equal(batan, 10);
    assert.ok(G.hepsiBatti(t));
  }
});

// ---- dizilim aşamasında gemi taşıma / döndürme ----

test('gemiTasi: geçerli yere taşır, harita ve hücreler tutarlı kalır (500 rastgele deneme)', () => {
  const r = G.rng(11);
  let tasinan = 0;
  for (let i = 0; i < 500; i++) {
    const t = G.yeniTahta(config, r);
    const gemi = t.gemiler[Math.floor(r() * t.gemiler.length)];
    const s = Math.floor(r() * 10), k = Math.floor(r() * 10), yatay = r() < .5;
    const sorgu = G.tasinabilir(t, gemi.id, s, k, yatay);
    const once = Array.from(t.gemiHaritasi).join(',');
    assert.equal(Array.from(t.gemiHaritasi).join(','), once, 'tasinabilir tahtaya dokunmaz');
    const sonuc = G.gemiTasi(t, gemi.id, s, k, yatay);
    assert.equal(sonuc, sorgu);
    if (sonuc) tasinan++;
    else assert.equal(Array.from(t.gemiHaritasi).join(','), once, 'başarısız taşıma tahtayı değiştirmez');
    gecerliMi(t, config);                                         // her durumda kurallara uyar
  }
  assert.ok(tasinan > 20, 'bazı taşımalar geçerli olmalı');
});

test('gemiTasi: boş yere taşıma, aynı yerde kalma ve yerinde döndürme', () => {
  const t = G.bosTahta(10, true);
  const g = G.gemiEkle(t, 3, 0, 0, true);                         // (0,0)-(0,2)
  assert.equal(G.gemiTasi(t, g.id, 5, 5, true), true);
  assert.deepEqual(g.hucreler, [{ s: 5, k: 5 }, { s: 5, k: 6 }, { s: 5, k: 7 }]);
  assert.equal(t.gemiHaritasi[0], -1, 'eski yer boşalır');
  assert.equal(G.gemiTasi(t, g.id, 5, 5, true), true, 'aynı yer (kendi hücreleriyle çakışma sayılmaz)');
  assert.equal(G.gemiTasi(t, g.id, 5, 5, false), true, 'yerinde döndürme');
  assert.equal(g.yatay, false);
  assert.deepEqual(g.hucreler, [{ s: 5, k: 5 }, { s: 6, k: 5 }, { s: 7, k: 5 }]);
});

test('gemiTasi: başka gemiyle çakışma, değme, sınır dışı ve atıştan sonra reddedilir', () => {
  const t = G.bosTahta(10, true);
  const a = G.gemiEkle(t, 2, 0, 0, true);
  G.gemiEkle(t, 2, 4, 4, true);                                   // (4,4)-(4,5)
  assert.equal(G.gemiTasi(t, a.id, 4, 5, true), false, 'çakışma');
  assert.equal(G.gemiTasi(t, a.id, 5, 6, true), false, 'köşegen değme');
  assert.equal(G.gemiTasi(t, a.id, 3, 4, true), false, 'yan yana değme');
  assert.equal(G.gemiTasi(t, a.id, 0, 9, true), false, 'sınır dışı');
  assert.equal(G.gemiTasi(t, a.id, 9, 0, false), false, 'dikey sınır dışı');
  assert.deepEqual(a.hucreler, [{ s: 0, k: 0 }, { s: 0, k: 1 }], 'başarısız taşıma gemiyi değiştirmez');
  G.atesEt(t, 9, 9);
  assert.equal(G.gemiTasi(t, a.id, 7, 7, true), false, 'atış başladıktan sonra taşınamaz');
});

test('gemiTasi: tek hücreli gemi döndürülünce yatay kalır', () => {
  const t = G.bosTahta(10, true);
  const g = G.gemiEkle(t, 1, 2, 2, true);
  assert.equal(G.gemiTasi(t, g.id, 2, 2, false), true);
  assert.equal(g.yatay, true);
});
