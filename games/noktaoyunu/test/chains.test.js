// node --test test/chains.test.js — zincir/döngü ayrıştırması ve son oyun çözücüleri (PLAN §7: Z1–Z6, Ç1–Ç12)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const C = require('../chains.js');

function rng(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const G5 = B.geo(5, 5), H = G5.H, V = G5.V, kk = (r, c) => r * 4 + c;
const ayni = (a, b, msg) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y), msg);

// [3, 3]: iki köşede L biçimli 3'lük zincir, iki ucu da tahta kenarına açık; kalan 10 kutu 5–5 paylaşılmış.
const UCUC = [H(0, 1), V(0, 1), H(1, 0), V(1, 0), H(4, 2), V(3, 3), H(3, 3), V(2, 4)];
const ucUc = (sira = 0) => B.kur({ bos: UCUC, sahip: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], sira });
// [1, 5]: köşede 1'lik (3,0), üst sıra boyunca 5'lik (0,0)…(0,3),(1,3); 10 kutu 5–5
const BIRBES = [V(3, 0), H(4, 0), V(0, 0), V(0, 1), V(0, 2), V(0, 3), H(1, 3), V(1, 4)];

test('Z1 [3, 3]: iki 3\'lük zincir, uçları kenara açık', () => {
  const d = ucUc(), P = C.parcala(d);
  assert.equal(P.saf, true);
  assert.equal(P.serbestKenar, 8);
  assert.equal(P.parcalar.length, 2);
  for (const p of P.parcalar) {
    assert.equal(p.tur, 'zincir'); assert.equal(p.uzunluk, 3); assert.equal(p.uzun, true); assert.equal(p.acik, false);
    assert.deepEqual(p.uclar.map(u => u.tip), ['kenar', 'kenar']);
    assert.equal(p.kenarlar.length, 4);
  }
  const [a, b] = P.parcalar;
  assert.ok([kk(0, 1), kk(1, 0)].includes(a.kutular[0]) && a.kutular[1] === kk(0, 0), 'sıralı: uçtan uca');
  ayni(a.kutular, [kk(0, 1), kk(0, 0), kk(1, 0)]);
  ayni(b.kutular, [kk(3, 2), kk(3, 3), kk(2, 3)]);
  ayni(a.kenarlar.slice(1, 3), [V(0, 1), H(1, 0)], 'iç kenarlar ortada');
});

test('Z2 döngüler: 2×2 blok (4) ve 2×3 halka (6)', () => {
  const d4 = B.kur({ bos: [V(1, 2), V(2, 2), H(2, 1), H(2, 2)] });
  const P4 = C.parcala(d4);
  assert.equal(P4.parcalar.length, 1);
  assert.equal(P4.parcalar[0].tur, 'dongu');
  assert.equal(P4.parcalar[0].uzunluk, 4);
  assert.equal(P4.parcalar[0].kenarlar.length, 4);
  assert.equal(P4.parcalar[0].uzun, false, 'döngü uzun zincir sayılmaz');
  const d6 = B.kur({ bos: [V(1, 1), V(1, 2), V(2, 1), V(2, 2), H(2, 0), H(2, 2)] });
  const p6 = C.parcala(d6).parcalar;
  assert.equal(p6.length, 1);
  assert.equal(p6[0].tur, 'dongu');
  assert.equal(p6[0].uzunluk, 6);
  ayni(p6[0].kenarlar, [V(1, 1), V(1, 2), V(2, 1), V(2, 2), H(2, 0), H(2, 2)]);
});

test('Z3 kenara açık zincir ile kavşağa açılan zincir ayrı tutulur', () => {
  // Faz 1 örnek konumu: alt sırada (3,0)–(3,2) zinciri; bir ucu sol kenar, öteki (2,2) kavşağı
  const cizgiler = [H(0, 0), V(0, 0), H(1, 0), V(0, 1), H(0, 1), V(0, 2), H(1, 1), V(1, 0), H(2, 0), V(1, 1),
    H(4, 0), H(4, 1), H(4, 2), H(3, 0), H(3, 1), V(2, 3), H(2, 3), V(2, 4), H(3, 3), V(3, 3), V(3, 4), H(4, 3)];
  const d = B.kur({ cizgiler }), P = C.parcala(d);
  assert.equal(P.saf, false);
  assert.ok(P.kavsaklar.includes(kk(2, 2)));
  const z = P.parcalar.find(p => p.kutular.includes(kk(3, 1)));
  assert.equal(z.uzunluk, 3);
  ayni(z.kutular, [kk(3, 0), kk(3, 1), kk(3, 2)]);
  assert.deepEqual(z.uclar.map(u => u.tip).sort(), ['kavsak', 'kenar']);
  assert.equal(z.uclar.find(u => u.tip === 'kavsak').kutu, kk(2, 2));
  const tek = P.parcalar.find(p => p.kutular.includes(kk(2, 0)));
  assert.equal(tek.uzunluk, 1);
  assert.deepEqual(tek.uclar.map(u => u.tip).sort(), ['kavsak', 'kenar']);
});

test('Z4 köşede 1\'lik, kenar boyunca 2\'lik zincir', () => {
  const p1 = C.parcala(B.kur({ bos: [H(0, 0), V(0, 0)] })).parcalar;
  assert.equal(p1.length, 1);
  assert.equal(p1[0].uzunluk, 1);
  assert.deepEqual(p1[0].uclar.map(u => u.tip), ['kenar', 'kenar']);
  ayni(p1[0].kenarlar, [H(0, 0), V(0, 0)]);
  const p2 = C.parcala(B.kur({ bos: [V(0, 0), V(0, 1), H(0, 1)] })).parcalar;
  assert.equal(p2.length, 1);
  assert.equal(p2[0].uzunluk, 2);
  assert.equal(p2[0].kenarlar[1], V(0, 1), 'orta kenar (sert ikram) ortada');
});

test('Z5 açılmış zincir: kapalı uç ve alınabilir kutu', () => {
  const d = ucUc();
  B.cek(d, H(0, 1));
  const P = C.parcala(d), a = P.parcalar.find(p => p.kutular.includes(kk(0, 0)));
  assert.equal(a.acik, true);
  assert.equal(a.uzunluk, 3);
  assert.equal(a.kutular[0], kk(0, 1), 'açık kutu uçta');
  assert.deepEqual(a.uclar.map(u => u.tip), ['kapali', 'kenar']);
  assert.equal(a.kenarlar.length, 3);
  assert.equal(P.parcalar.find(p => p !== a).acik, false);
});

test('Z6 uzun zincir tahmini ve parite', () => {
  const d = ucUc();
  assert.equal(C.uzunZincirTahmini(d), 2);
  const p = C.parite(d);
  assert.equal(p.toplam, 27);
  assert.deepEqual(p.uygun, [false, true], '25 nokta + 2 zincir tek: ikinci oyuncunun işine gelir');
  const bos5 = B.yeniOyun({ m: 5, n: 5, baslayan: 1 });
  assert.equal(C.uzunZincirTahmini(bos5), 1, 'boş tahta tek kavşak bölgesi');
  assert.deepEqual(C.parite(bos5).uygun, [false, true], '26 çift: başlayan (1) memnun');
  const bos6 = B.yeniOyun({ m: 6, n: 6, baslayan: 0 });
  assert.equal(C.parite(bos6).toplam, 37);
  assert.deepEqual(C.parite(bos6).uygun, [false, true]);
});

// Ç1–Ç6: elle hesaplanmış altı son oyun (açmak zorunda olanın net kazancı)
const ORNEKLER = [
  { ad: '[3, 3]', z: [3, 3], d: [], deger: -2 },
  { ad: '[1, 1, 5]', z: [1, 1, 5], d: [], deger: -5 },
  { ad: '[4, döngü 4]', z: [4], d: [4], deger: 0, ac: 'dongu' },
  { ad: '[1, 5]', z: [1, 5], d: [], deger: 4, ac: 1 },
  { ad: '[3, döngü 4]', z: [3], d: [4], deger: -1, ac: 'dongu' },
  { ad: '[2, 3]', z: [2, 3], d: [], deger: 1, ac: 2 },
];
const parcalar = (z, d) => [...z.map(k => ({ tur: 'zincir', uzunluk: k })), ...d.map(k => ({ tur: 'dongu', uzunluk: k }))];

ORNEKLER.forEach((o, i) => {
  test(`Ç${i + 1} ${o.ad} → ${o.deger}`, () => {
    const P = parcalar(o.z, o.d), r = C.coz(P);
    assert.equal(r.deger, o.deger);
    if (o.ac === 'dongu') assert.equal(P[r.ac].tur, 'dongu');
    else if (o.ac) { assert.equal(P[r.ac].tur, 'zincir'); assert.equal(P[r.ac].uzunluk, o.ac); }
    if (o.ac === 2) assert.equal(r.bicim, 'orta', "2'lik ortadan açılır");
  });
});

test('Ç7 aynı parça kümesi, farklı sıra: aynı sonuç', () => {
  const r = rng(3);
  for (const o of ORNEKLER) {
    for (let t = 0; t < 6; t++) {
      const P = parcalar(o.z, o.d).map(p => [r(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      const s = C.coz(P);
      assert.equal(s.deger, o.deger, o.ad);
      assert.equal(-C.cevap(P, s.ac, s.bicim).deger + 0, o.deger, 'seçilen açılış bu değeri verir');
    }
  }
  assert.equal(C.V([5, 1, 3], [6, 4]), C.V([1, 3, 5], [4, 6]));
});

test('Ç8 cevap: ikisi hariç, dördü hariç, hepsi', () => {
  assert.equal(C.cevap(parcalar([3, 3], []), 0).karar, 'ikisiHaric');
  assert.equal(C.cevap(parcalar([3, 3], []), 0).deger, 2, 'kontrolü koruyan 4–2 alır');
  assert.equal(C.cevap(parcalar([3], []), 0).karar, 'hepsi', 'son parça');
  assert.equal(C.cevap(parcalar([4], [4]), 0).karar, 'ikisiHaric');
  assert.equal(C.cevap(parcalar([5], [6]), 1).karar, 'dorduHaric', 'döngü 6 açılınca 4 bırakılır: 5\'lik alana kalır');
  assert.equal(C.cevap(parcalar([5], [6]), 1).deger, 3);
  assert.equal(C.cevap(parcalar([4], [6]), 1).karar, 'hepsi', 'eşitlikte hepsi alınır');
  assert.equal(C.cevap(parcalar([2, 3], []), 0, 'uc').karar, 'ikisiHaric', 'uçtan açılan 2\'lik reddedilir');
  assert.equal(C.cevap(parcalar([2, 3], []), 0, 'orta').karar, 'hepsi', 'ortadan açılan 2\'lik reddedilemez');
  assert.equal(C.cevap(parcalar([1, 5], []), 0).karar, 'hepsi');
});

// Saf loony konumlar: iki taraf rastgele güvenli hamle oynar, güvenli hamle bitince durur
function loony(m, n, r) {
  const d = B.yeniOyun({ m, n, baslayan: r() < .5 ? 0 : 1 });
  for (;;) { const g = B.guvenli(d); if (!g.length) return d; B.cek(d, g[Math.floor(r() * g.length)]); }
}

test('Ç9 saf loony konumlarda parça çözücüsü = tahta üstü kesin arama (200 konum)', () => {
  const r = rng(11);
  let saf = 0, kavsakli = 0;
  for (let deneme = 0; deneme < 4000 && saf < 200; deneme++) {
    const [m, n] = deneme % 3 ? [5, 5] : [4, 5];
    const d = loony(m, n, r);
    assert.equal(B.alinabilir(d).length, 0, 'güvenli hamleler kutu vermez');
    const P = C.parcala(d);
    if (P.serbestKenar > 22) continue;
    if (!P.saf) { kavsakli++; continue; }
    const t = C.tahtaCoz(d);
    assert.equal(C.coz(P.parcalar).deger, t.deger, '\n' + B.yazdir(d));
    saf++;
  }
  assert.ok(saf >= 200, `yalnız ${saf} saf konum`);
  assert.ok(kavsakli > 0, 'kavşaklı konum da üretildi');
});

// Budamasız ezberli negamax (hakem): budamanın değeri değiştirmediğini doğrular
function hakem(d) {
  const ez = new Map();
  const ara = () => {
    if (d.bitti) return 0;
    const a = d.cizgi.join('');
    if (ez.has(a)) return ez.get(a);
    let en = -Infinity;
    for (const e of B.hamleler(d)) {
      const p = d.sira, k = B.cek(d, e);
      const v = d.sira === p ? k.alinan.length + ara() : -ara();
      B.geriAl(d, k);
      if (v > en) en = v;
    }
    ez.set(a, en);
    return en;
  };
  return ara() + 0;
}

test('Ç10 tahta üstü arama: budama değeri değiştirmez (rastgele 240 konum, hakemle)', () => {
  const r = rng(29);
  for (let i = 0; i < 240; i++) {
    const [m, n, F] = [[3, 4, 13], [4, 4, 13], [3, 5, 12], [4, 5, 12]][i % 4];
    const d = B.yeniOyun({ m, n, baslayan: i & 1 });
    while (d.kalan > F) { const l = B.hamleler(d); B.cek(d, l[Math.floor(r() * l.length)]); }
    if (d.bitti) continue;
    const t = C.tahtaCoz(d);
    assert.equal(t.deger, hakem(B.kopya(d)), `konum ${i}\n` + B.yazdir(d));
    // önerilen hamle gerçekten bu değeri verir
    const y = B.kopya(d), p = y.sira, k = B.cek(y, t.hamle);
    const v = y.bitti ? k.alinan.length : y.sira === p ? k.alinan.length + C.tahtaCoz(y).deger : -C.tahtaCoz(y).deger;
    assert.equal(v + 0, t.deger);
  }
});

test('Ç11 kavşaklı T konumu: el hesabı +2 (açan 3, alan 1)', () => {
  const G = B.geo(4, 4);
  const d = B.kur({ m: 4, n: 4, bos: [G.H(1, 1), G.V(1, 1), G.V(1, 2), G.H(0, 1), G.V(1, 0), G.V(1, 3)] });
  const P = C.parcala(d);
  assert.equal(P.saf, false);
  assert.deepEqual(P.kavsaklar, [4]);
  assert.equal(B.guvenli(d).length, 0);
  assert.equal(C.tahtaCoz(d).deger, 2);
  assert.equal(C.kesinDeger(d), 2);
});

test('Ç12 tahta üstü arama hızı: F = 20 < 300 ms; sınırı aşınca null', () => {
  const r = rng(5);
  let enCok = 0;
  for (let i = 0; i < 6; i++) {
    const d = B.yeniOyun({ m: 5, n: 5 });
    while (d.kalan > 20) { const g = B.guvenli(d), l = g.length ? g : B.hamleler(d); B.cek(d, l[Math.floor(r() * l.length)]); }
    if (d.bitti) continue;
    const t0 = Date.now();
    assert.ok(C.tahtaCoz(d));
    enCok = Math.max(enCok, Date.now() - t0);
  }
  console.log(`  tahtaCoz F=20: en uzun ${enCok} ms`);
  assert.ok(enCok < 300, `${enCok} ms`);
  assert.equal(C.tahtaCoz(B.yeniOyun({ m: 5, n: 5 })), null);
});

test('Ç13 analiz: [1, 5]\'te 5\'liği açan kaybeder; hamlesi işaretlenir', () => {
  const d = B.kur({ bos: BIRBES, sahip: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], sira: 0 });
  assert.equal(C.kesinDeger(d), 4);
  const gecmis = [];
  const oyna = (e) => { gecmis.push({ durum: B.kopya(d), e }); B.cek(d, e); };
  oyna(V(0, 0));                                        // hata: 5'liği açar
  while (!d.bitti) oyna(C.tahtaCoz(d).hamle);
  assert.deepEqual(d.puan, [6, 10]);
  const a = C.analiz(gecmis, d);
  assert.equal(a.kaybeden, 0);
  assert.equal(a.hamle.indeks, 0);
  assert.equal(a.hamle.e, V(0, 0));
  assert.equal(a.uzunZincir, 1);
  // doğru oynanırsa (1'liği feda) kazanır
  const d2 = B.kur({ bos: BIRBES, sahip: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], sira: 0 });
  while (!d2.bitti) B.cek(d2, C.tahtaCoz(d2).hamle);
  assert.deepEqual(d2.puan, [10, 6]);
});
