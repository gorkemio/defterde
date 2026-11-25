// node --test test/game.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const config = require('../config.js');

// Testlerde hesap kontrolü kapalı başlar; gerekirse ayrıca açılır.
const kur = (ek = {}) => G.yeniOyun({ ...config, hesap: { acik: false, deneme: 1, ceza: true }, ...ek });
// Sabit zar: dizideki sayıları sırayla verir (zar 1–6: 0 → 1, 0.99 → 6)
const dizi = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const D = { 1: 0, 2: 0.17, 3: 0.34, 4: 0.5, 5: 0.67, 6: 0.99 };
const zarlar = (a, b) => dizi(D[a], D[b]);

// Bağımsız kaba kuvvet: ortak modda (bitişiklik kapalı) a×b yerleşimleri
function referans(o, a, b) {
  const sonuc = new Set();
  for (const [w, h] of (a === b ? [[a, b]] : [[a, b], [b, a]])) {
    for (let s = 0; s < o.n; s++) {
      for (let k = 0; k < o.n; k++) {
        let tamam = s + h <= o.n && k + w <= o.n;
        for (let i = 0; i < h && tamam; i++) for (let j = 0; j < w && tamam; j++) if (o.hucre[(s + i) * o.n + k + j] !== -1) tamam = false;
        if (tamam) sonuc.add(`${s},${k},${w},${h}`);
      }
    }
  }
  return sonuc;
}
const anahtar = (l) => new Set(l.map(p => `${p.s},${p.k},${p.w},${p.h}`));

// Bir zar atıp (hesap varsa doğru cevaplayıp) rastgele geçerli yerleşime koyar ya da pas geçer.
function rastgeleHamle(o, r) {
  const z = G.zarAt(o, r);
  if (!z.sigar) { G.pasGec(o); return 'pas'; }
  if (o.asama === 'hesap') G.cevapVer(o, z.a * z.b);
  const adaylar = G.yerlesimler(o, z.a, z.b, o.sira);
  const p = adaylar[Math.floor(r() * adaylar.length)];
  G.yerlestir(o, p.s, p.k, p.w, p.h);
  return 'cizdi';
}

test('rng: aynı tohum aynı diziyi verir, 0..1 aralığında', () => {
  const a = G.rng(42), b = G.rng(42), c = G.rng(43);
  const x = Array.from({ length: 20 }, a), y = Array.from({ length: 20 }, b), z = Array.from({ length: 20 }, c);
  assert.deepEqual(x, y);
  assert.notDeepEqual(x, z);
  assert.ok(x.every(v => v >= 0 && v < 1));
});

test('yeniOyun: boş tahta, sıra, ayarlar kopyalanır', () => {
  const o = kur();
  assert.equal(o.n, 16);
  assert.ok(o.hucre.every(v => v === -1));
  assert.equal(o.sira, 'ben');
  assert.equal(o.asama, 'zar');
  assert.deepEqual(o.puan, { ben: 0, rakip: 0 });
  assert.equal(kur({ ilkBaslayan: 'rakip' }).sira, 'rakip');
  const k = kur();
  k.ayar.zar[1] = 99;
  assert.equal(config.zar[1], 6, 'config değişmez');
});

test('yerlesimler: boş tahtada sayı (iki yön; a = b tek yön)', () => {
  const o = kur();
  assert.equal(G.yerlesimler(o, 3, 5, 'ben').length, 2 * 14 * 12);
  assert.equal(G.yerlesimler(o, 4, 4, 'ben').length, 13 * 13);
  assert.equal(G.yerlesimler(o, 1, 1, 'ben').length, 256);
  assert.equal(G.yerlesimler(o, 17, 1, 'ben').length, 0, 'tahtadan uzun');
  assert.equal(G.yerlesimler(kur({ boyut: 4 }), 5, 5, 'ben').length, 0);
});

test('yerlesimler: tekrarsız ve kaba kuvvetle aynı (200 rastgele konum)', () => {
  const r = G.rng(9);
  for (let t = 0; t < 200; t++) {
    const o = kur({ boyut: [8, 12, 16][t % 3], zar: [1, [6, 9, 12][t % 3]] });
    const hamle = Math.floor(r() * 25);
    for (let i = 0; i < hamle && o.asama !== 'bitti'; i++) rastgeleHamle(o, r);
    const a = 1 + Math.floor(r() * 6), b = 1 + Math.floor(r() * 6);
    const l = G.yerlesimler(o, a, b, 'ben');
    assert.equal(anahtar(l).size, l.length, 'tekrar yok');
    assert.deepEqual([...anahtar(l)].sort(), [...referans(o, a, b)].sort());
    assert.equal(G.sigarMi(o, a, b, 'ben'), l.length > 0);
  }
});

test('yerlestirilebilir: sınır ve çakışma', () => {
  const o = kur();
  assert.equal(G.yerlestirilebilir(o, 0, 0, 16, 16, 'ben'), true);
  assert.equal(G.yerlestirilebilir(o, 1, 0, 16, 16, 'ben'), false, 'aşağı taşar');
  assert.equal(G.yerlestirilebilir(o, 0, 15, 2, 1, 'ben'), false, 'sağa taşar');
  assert.equal(G.yerlestirilebilir(o, -1, 0, 1, 1, 'ben'), false);
  o.asama = 'yerlestir'; o.zar = { a: 3, b: 4 };
  G.yerlestir(o, 2, 2, 3, 4);                                      // satır 2–5, sütun 2–4
  o.asama = 'yerlestir'; o.zar = { a: 2, b: 2 }; o.sira = 'rakip';
  assert.equal(G.yerlestirilebilir(o, 5, 4, 2, 2, 'rakip'), false, 'bir hücre çakışır');
  assert.equal(G.yerlestirilebilir(o, 6, 2, 2, 2, 'rakip'), true, 'hemen altı serbest');
  assert.equal(G.yerlestirilebilir(o, 2, 5, 2, 2, 'rakip'), true, 'hemen yanı serbest');
});

test('zarAt: aralıkta; sığmayınca pas aşaması', () => {
  const o = kur({ boyut: 4, zar: [5, 5] });
  const z = G.zarAt(o, G.rng(1));
  assert.deepEqual([z.a, z.b, z.sigar], [5, 5, false]);
  assert.equal(o.asama, 'pas');
  assert.throws(() => G.zarAt(o, G.rng(1)), /zar atılmaz/);

  const r = G.rng(3);
  for (let i = 0; i < 100; i++) {
    const s = G.zarAt(kur({ zar: [2, 9] }), r);
    assert.ok(s.a >= 2 && s.a <= 9 && s.b >= 2 && s.b <= 9);
  }
});

test('zarAt: hesap açıksa hesap aşaması ve deneme hakkı', () => {
  const o = G.yeniOyun({ ...config, hesap: { acik: true, deneme: 3, ceza: true } });
  G.zarAt(o, zarlar(3, 4));
  assert.equal(o.asama, 'hesap');
  assert.equal(o.hak, 3);
  const k = kur();
  G.zarAt(k, zarlar(3, 4));
  assert.equal(k.asama, 'yerlestir', 'hesap kapalıysa doğrudan yerleştirme');
});

test('yerlestir: harita, puan, sıra, geçmiş; geçersizler hata verir', () => {
  const o = kur();
  G.zarAt(o, zarlar(3, 4));
  assert.throws(() => G.yerlestir(o, 0, 0, 2, 6), /uymuyor/);
  assert.throws(() => G.yerlestir(o, 14, 0, 3, 4), /yerleştirilemez/, 'taşar');
  const d = G.yerlestir(o, 0, 0, 4, 3);                            // ters yön de olur
  assert.equal(d.alan, 12);
  assert.deepEqual(d.zar, [3, 4]);
  assert.equal(o.puan.ben, 12);
  assert.equal(o.sayi.ben, 1);
  assert.equal(o.hucre.filter(v => v === d.id).length, 12);
  assert.equal(o.sira, 'rakip');
  assert.equal(o.asama, 'zar');
  assert.equal(o.tur, 1);
  assert.equal(o.zar, null);
  assert.deepEqual(o.gecmis[0], { tur: 0, sahip: 'ben', zar: [3, 4], olay: 'cizdi', dik: { s: 0, k: 0, w: 4, h: 3 }, alan: 12 });
  assert.throws(() => G.yerlestir(o, 5, 5, 1, 1), /yerleştirilmez/, 'zar atılmadan çizilmez');
  G.zarAt(o, zarlar(2, 2));
  assert.throws(() => G.yerlestir(o, 0, 0, 2, 2), /yerleştirilemez/, 'çakışma');
});

test('cevapVer: doğru, tekrar, ceza, affedildi', () => {
  const hesapli = (deneme, ceza) => {
    const o = G.yeniOyun({ ...config, hesap: { acik: true, deneme, ceza } });
    G.zarAt(o, zarlar(3, 4));
    return o;
  };
  let o = hesapli(1, true);
  assert.deepEqual(G.cevapVer(o, '12'), { sonuc: 'dogru', dogruCevap: 12, kalanHak: 1 });
  assert.equal(o.asama, 'yerlestir');

  o = hesapli(2, true);
  assert.equal(G.cevapVer(o, 11).sonuc, 'tekrar');
  assert.equal(G.cevapVer(o, 'abc').sonuc, 'ceza', 'sayı olmayan cevap yanlış sayılır');
  assert.equal(o.sira, 'rakip');
  assert.equal(o.asama, 'zar');
  assert.equal(o.ardisikPas, 0);
  assert.equal(o.gecmis.at(-1).olay, 'yanlis');
  assert.equal(o.puan.ben, 0);

  o = hesapli(1, false);
  const s = G.cevapVer(o, 7);
  assert.deepEqual([s.sonuc, s.dogruCevap], ['affedildi', 12]);
  assert.equal(o.asama, 'yerlestir');
  assert.equal(o.sira, 'ben', 'ceza kapalı: sıra geçmez');

  o = hesapli(1, true);
  assert.equal(G.cevapVer(o, '').sonuc, 'ceza', 'boş cevap yanlış sayılır');
});

test('pas ve bitiş: iki ardışık pas bitirir, tek pas bitirmez', () => {
  const o = kur({ boyut: 4, zar: [5, 5] });
  G.zarAt(o, G.rng(1));
  G.pasGec(o);
  assert.equal(o.asama, 'zar');
  assert.equal(o.ardisikPas, 1);
  assert.equal(o.sira, 'rakip');
  G.zarAt(o, G.rng(1));
  G.pasGec(o);
  assert.equal(o.asama, 'bitti');
  assert.equal(o.kazanan, 'berabere');
  assert.throws(() => G.pasGec(o), /bitti/);
});

test('pas sayacı: yerleştirme ve yanlış cevap sıfırlar', () => {
  const o = kur({ zar: [1, 1], boyut: 3 });
  o.ardisikPas = 1;
  G.zarAt(o, G.rng(1));
  G.yerlestir(o, 0, 0, 1, 1);
  assert.equal(o.ardisikPas, 0);

  const h = G.yeniOyun({ ...config, boyut: 4, zar: [1, 6], hesap: { acik: true, deneme: 1, ceza: true } });
  h.ardisikPas = 1;
  G.zarAt(h, zarlar(2, 2));
  G.cevapVer(h, 5);
  assert.equal(h.ardisikPas, 0, 'yanlış cevap pas sayılmaz');
});

test('bitiş: tahta dolunca; kazanan ve berabere', () => {
  let o = kur({ boyut: 2, zar: [2, 2] });
  G.zarAt(o, G.rng(1));
  G.yerlestir(o, 0, 0, 2, 2);
  assert.equal(o.asama, 'bitti');
  assert.equal(o.kazanan, 'ben');
  assert.deepEqual(o.puan, { ben: 4, rakip: 0 });

  o = kur({ boyut: 2, zar: [1, 1] });
  const koordinatlar = [[0, 0], [0, 1], [1, 0], [1, 1]];
  koordinatlar.forEach(([s, k], i) => {
    assert.equal(o.asama, 'zar');
    G.zarAt(o, G.rng(1));
    G.yerlestir(o, s, k, 1, 1);
    assert.equal(o.asama === 'bitti', i === 3);
  });
  assert.equal(G.bosHucre(o), 0);
  assert.equal(o.kazanan, 'berabere');
  assert.deepEqual(o.puan, { ben: 2, rakip: 2 });

  o = kur({ boyut: 2, zar: [1, 2] });                              // rakip yalnız 1'lik atınca puan düşük kalır
  G.zarAt(o, dizi(0.99, 0)); G.yerlestir(o, 0, 0, 2, 1);           // zar 2×1: ben 2
  G.zarAt(o, dizi(0, 0));    G.yerlestir(o, 1, 0, 1, 1);           // zar 1×1: rakip 1
  G.zarAt(o, dizi(0, 0));    G.yerlestir(o, 1, 1, 1, 1);           // zar 1×1: ben 1 → toplam 3, tahta dolu
  assert.equal(o.asama, 'bitti');
  assert.equal(o.kazanan, 'ben');
});

test('sureDoldu: sıra geçer, "sure" kaydı düşer, art arda pas sayacı sıfırlanır', () => {
  const o = kur();
  o.ardisikPas = 1;
  G.zarAt(o, zarlar(3, 4));
  G.sureDoldu(o);
  assert.equal(o.sira, 'rakip');
  assert.equal(o.asama, 'zar');
  assert.equal(o.ardisikPas, 0);
  assert.deepEqual(o.gecmis.at(-1), { tur: 0, sahip: 'ben', zar: [3, 4], olay: 'sure' });
  const z = kur();
  G.sureDoldu(z);                                                  // zar atılmadan da süre dolabilir
  assert.equal(z.gecmis.at(-1).zar, null);
});

test('süre dolması + rakibin "yer yok" pası oyunu bitirmez; iki gerçek pas bitirir', () => {
  const o = kur({ boyut: 4, zar: [5, 5], ilkBaslayan: 'rakip' });  // 5×5 hiç sığmaz
  G.zarAt(o, G.rng(1)); G.pasGec(o);                               // rakip: yer yok (1)
  G.sureDoldu(o);                                                  // ben: süre doldu → sayaç 0
  assert.notEqual(o.asama, 'bitti');
  G.zarAt(o, G.rng(1)); G.pasGec(o);                               // rakip: yer yok (1)
  assert.notEqual(o.asama, 'bitti');
  G.zarAt(o, G.rng(1)); G.pasGec(o);                               // ben: yer yok (2) → biter
  assert.equal(o.asama, 'bitti');
  assert.throws(() => G.sureDoldu(o), /bitti/);
});

// ---- bitişiklik kuralı ----

test('bitişiklik: ilk dikdörtgen kendi köşesini içerir', () => {
  const o = kur({ bitisiklik: true });
  const ben = G.yerlesimler(o, 2, 3, 'ben');
  assert.deepEqual([...anahtar(ben)].sort(), ['0,0,2,3', '0,0,3,2']);
  const rakip = G.yerlesimler(o, 2, 3, 'rakip');
  assert.deepEqual([...anahtar(rakip)].sort(), ['13,14,2,3', '14,13,3,2']);
});

test('bitişiklik: sonrakiler kendi alanına kenardan değer, köşegen yetmez, rakibe değmek serbest', () => {
  const o = kur({ bitisiklik: true });
  G.zarAt(o, zarlar(3, 2)); G.yerlestir(o, 0, 0, 3, 2);            // ben: satır 0–1, sütun 0–2
  G.zarAt(o, zarlar(1, 1)); G.yerlestir(o, 15, 15, 1, 1);          // rakip köşesini alır
  assert.equal(G.yerlestirilebilir(o, 0, 3, 1, 1, 'ben'), true, 'sağ kenar');
  assert.equal(G.yerlestirilebilir(o, 2, 0, 1, 1, 'ben'), true, 'alt kenar');
  assert.equal(G.yerlestirilebilir(o, 2, 3, 1, 1, 'ben'), false, 'köşegen');
  assert.equal(G.yerlestirilebilir(o, 5, 5, 2, 2, 'ben'), false, 'uzak');
  assert.equal(G.yerlestirilebilir(o, 14, 15, 1, 1, 'ben'), false, 'rakibe değmek yetmez, kendi alanına değmeli');
  assert.equal(G.yerlestirilebilir(o, 15, 14, 1, 1, 'rakip'), true, 'rakip kendi alanına değer');
});

test('bitişiklik: alanı olmayan oyuncunun köşesi karşı taraf için yasak', () => {
  const o = kur({ boyut: 4, zar: [4, 4], bitisiklik: true });
  G.zarAt(o, G.rng(1));
  assert.equal(o.asama, 'pas', '4×4 ben için rakibin köşesini de kapatır: yasak');
  assert.equal(G.yerlestirilebilir(o, 0, 0, 4, 4, 'ben'), false);
  assert.equal(G.yerlestirilebilir(o, 0, 0, 3, 3, 'ben'), true);
});

// ---- simülasyon ----

const MODLAR = [
  { boyut: 16, zar: [1, 6] },
  { boyut: 12, zar: [1, 9], bitisiklik: true },
  { boyut: 16, zar: [1, 6], bitisiklik: true },
  { boyut: 8, zar: [1, 12] },
  { boyut: 20, zar: [1, 12], bitisiklik: true },
  { boyut: 16, zar: [1, 6], hesap: { acik: true, deneme: 1, ceza: true } },
];

function tutarli(o) {
  const n = o.n;
  const alan = { ben: 0, rakip: 0 }, sayi = { ben: 0, rakip: 0 };
  for (const d of o.dikdortgenler) {
    assert.equal(d.alan, d.w * d.h);
    alan[d.sahip] += d.alan; sayi[d.sahip]++;
    for (const i of G.hucreler(n, d.s, d.k, d.w, d.h)) assert.equal(o.hucre[i], d.id, 'harita dikdörtgenle aynı');
  }
  assert.deepEqual(o.puan, alan);
  assert.deepEqual(o.sayi, sayi);
  const dolu = o.hucre.filter(v => v !== -1).length;
  assert.equal(dolu, alan.ben + alan.rakip, 'puan toplamı = dolu hücre');
  for (const v of o.hucre) assert.ok(v === -1 || (v >= 0 && v < o.dikdortgenler.length));
}

// Geçmişi bağımsız bir tahtada yeniden oynar; bitişiklik kuralını kendi kodumuzla denetler.
function gecmisiDenetle(o, cfg) {
  const n = o.n, sahipHarita = new Array(n * n).fill(null), varMi = { ben: false, rakip: false };
  const koseler = { ben: 0, rakip: n * n - 1 };
  o.gecmis.forEach((g, i) => {
    assert.equal(g.sahip, i % 2 === 0 ? (cfg.ilkBaslayan === 'rakip' ? 'rakip' : 'ben') : (cfg.ilkBaslayan === 'rakip' ? 'ben' : 'rakip'), 'sıra dönüşümlü');
    if (g.olay !== 'cizdi') return;
    const { s, k, w, h } = g.dik, hucreler = G.hucreler(n, s, k, w, h);
    for (const c of hucreler) assert.equal(sahipHarita[c], null, 'çakışma yok');
    if (o.ayar.bitisiklik) {
      if (!varMi[g.sahip]) assert.ok(hucreler.includes(koseler[g.sahip]), 'ilk dikdörtgen köşeyi içerir');
      else {
        const komsu = hucreler.some(c => {
          const si = Math.floor(c / n), kj = c % n;
          return [[si - 1, kj], [si + 1, kj], [si, kj - 1], [si, kj + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && sahipHarita[a * n + b] === g.sahip);
        });
        assert.ok(komsu, 'kendi alanına kenardan değer');
      }
    }
    hucreler.forEach(c => { sahipHarita[c] = g.sahip; });
    varMi[g.sahip] = true;
  });
}

test('simülasyon: 300 tohumlu rastgele oyun hep biter, tutarlı kalır, kurallara uyar', () => {
  let toplamTur = 0, enCok = 0, pasli = 0;
  for (let tohum = 1; tohum <= 300; tohum++) {
    const cfg = {
      ...config, hesap: { acik: false, deneme: 1, ceza: true },   // mod kendi hesap ayarını getirirse o geçerli
      ...MODLAR[tohum % MODLAR.length], ilkBaslayan: tohum % 2 ? 'ben' : 'rakip',
    };
    const o = G.yeniOyun(cfg), r = G.rng(tohum);
    let adim = 0;
    while (o.asama !== 'bitti') {
      if (rastgeleHamle(o, r) === 'pas') pasli++;
      assert.ok(++adim <= 2 * o.n * o.n + 2, 'oyun sınırlı turda biter');
    }
    assert.ok(G.bosHucre(o) === 0 || o.ardisikPas >= o.ayar.bitisPas);
    assert.equal(o.kazanan, o.puan.ben > o.puan.rakip ? 'ben' : o.puan.ben < o.puan.rakip ? 'rakip' : 'berabere');
    tutarli(o);
    gecmisiDenetle(o, cfg);
    toplamTur += adim; enCok = Math.max(enCok, adim);
  }
  console.log(`  300 oyun: ortalama ${(toplamTur / 300).toFixed(1)} tur, en çok ${enCok}, pas ${pasli}`);
});

test('simülasyon: yanlış cevaplı oyunlar (deneme 1–2, ceza açık/kapalı) biter ve tutarlı kalır', () => {
  let ceza = 0, affedildi = 0, tekrar = 0;
  for (let tohum = 1; tohum <= 150; tohum++) {
    const cfg = {
      ...config, boyut: 12, zar: [1, 6],
      hesap: { acik: true, deneme: 1 + (tohum % 2), ceza: tohum % 3 !== 0 },
      ilkBaslayan: tohum % 2 ? 'ben' : 'rakip',
    };
    const o = G.yeniOyun(cfg), r = G.rng(tohum);
    let adim = 0;
    while (o.asama !== 'bitti') {
      const z = G.zarAt(o, r);
      if (!z.sigar) G.pasGec(o);
      else {
        let s;
        do {
          s = G.cevapVer(o, r() < 0.3 ? z.a * z.b + 1 : z.a * z.b);
          if (s.sonuc === 'tekrar') tekrar++;
        } while (s.sonuc === 'tekrar');
        if (s.sonuc === 'ceza') { ceza++; assert.equal(o.ardisikPas, 0); assert.equal(o.asama, 'zar'); }
        else {
          if (s.sonuc === 'affedildi') affedildi++;
          assert.equal(o.asama, 'yerlestir');
          const adaylar = G.yerlesimler(o, z.a, z.b, o.sira);
          const p = adaylar[Math.floor(r() * adaylar.length)];
          G.yerlestir(o, p.s, p.k, p.w, p.h);
        }
      }
      assert.ok(++adim < 10 * o.n * o.n, 'oyun sınırlı turda biter');
    }
    tutarli(o);
    gecmisiDenetle(o, cfg);
  }
  assert.ok(ceza > 0 && affedildi > 0 && tekrar > 0, 'her sonuç türü görüldü');
  console.log(`  yanlışlı oyunlar: ceza ${ceza}, affedildi ${affedildi}, tekrar ${tekrar}`);
});
