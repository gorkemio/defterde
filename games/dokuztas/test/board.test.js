// node --test test/board.test.js — tahta grafı ve kurallar (PLAN §6.3: G1–G6, R1–R14)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');

const n = (ad) => B.indeks(ad);
const yazi = (l) => l.map(B.hamleYazi).sort();
const ayni = (a, b) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));
const hamle = (d, kaynak, hedef, al = -1) => B.uygula(d, { kaynak, hedef, al, al2: -1 });
const almalar = (d, hedef, kaynak = -1) => B.hamleler(d).filter(m => m.hedef === hedef && m.kaynak === kaynak).map(m => m.al);

// tohumlu rastgele (mulberry32)
function rng(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- geometri ---------- */

test('G1 komşuluk ve hat sayıları: 32/16, köşegenli 40/20', () => {
  assert.equal(B.graf(false).kenarlar.length, 32);
  assert.equal(B.graf(false).HAT.length, 16);
  assert.equal(B.graf(true).kenarlar.length, 40);
  assert.equal(B.graf(true).HAT.length, 20);
});

test('G2 derece dizileri', () => {
  assert.equal(B.graf(false).KOMSU.map(l => l.length).join(''), '232323232424242423232323');
  assert.equal(B.graf(true).KOMSU.map(l => l.length).join(''), '333333334444444433333333');
});

test('G3 komşuluk simetrik, döngü ve çift yok', () => {
  for (const k of [false, true]) {
    const G = B.graf(k);
    G.KOMSU.forEach((l, i) => {
      assert.ok(!l.includes(i));
      assert.equal(new Set(l).size, l.length);
      for (const j of l) assert.ok(G.KOMSU[j].includes(i));
    });
  }
});

test('G4 hatlar: üçer nokta, birleşim tam; her nokta 2 hatta (köşegenli köşeler 3), her kenar tam 1 hatta', () => {
  for (const k of [false, true]) {
    const G = B.graf(k);
    let birlesim = 0;
    for (const H of G.HAT) { assert.equal(B.pop(H), 3); birlesim |= H; }
    assert.equal(birlesim, B.TAM);
    for (let i = 0; i < 24; i++) {
      const beklenen = k && i % 2 === 0 ? 3 : 2;
      assert.equal(G.NOKTA_HATLARI[i].length, beklenen, `nokta ${i}`);
    }
    for (const [a, b] of G.kenarlar) {
      const m = (1 << a) | (1 << b);
      assert.equal(Array.from(G.HAT).filter(H => (H & m) === m).length, 1, `kenar ${a}-${b}`);
    }
  }
});

test('G5 simetriler komşuluğu ve hatları korur', () => {
  for (const k of [false, true]) {
    const G = B.graf(k);
    const kenar = new Set(G.kenarlar.map(([a, b]) => Math.min(a, b) * 32 + Math.max(a, b)));
    const hat = new Set(G.hatlar.map(h => [...h].sort((x, y) => x - y).join(',')));
    for (const [ad, s] of Object.entries(B.SIMETRI)) {
      assert.equal(new Set(Array.from({ length: 24 }, (_, i) => s(i))).size, 24, ad + ' birebir');
      for (const [a, b] of G.kenarlar) assert.ok(kenar.has(Math.min(s(a), s(b)) * 32 + Math.max(s(a), s(b))), ad);
      for (const h of G.hatlar) assert.ok(hat.has(h.map(s).sort((x, y) => x - y).join(',')), ad);
    }
  }
});

test('G6 notasyon', () => {
  assert.equal(B.NOTASYON[6], 'a1');
  assert.equal(B.NOTASYON[2], 'g7');
  assert.equal(B.NOTASYON[23], 'c4');
  assert.equal(B.NOTASYON[11], 'f4');
  assert.equal(new Set(B.NOTASYON).size, 24);
  assert.equal(n('d5'), 17);
});

/* ---------- kurallar ---------- */

test('R1 başlangıç: 24 yerleştirme, el 9-9, evre 1', () => {
  const d = B.yeniOyun();
  assert.equal(B.hamleler(d).length, 24);
  assert.deepEqual(d.el, [9, 9]);
  assert.equal(B.evre(d), 1);
  assert.equal(d.bitti, null);
});

test('R2 yerleştirmeden harekete geçiş', () => {
  const b = [0, 2, 4, 6, 9, 11, 13, 15, 17], s = [1, 3, 5, 7, 8, 10, 12, 14, 16];
  let d = B.yeniOyun();
  for (let k = 0; k < 9; k++) {
    d = hamle(d, -1, b[k]); assert.equal(d.son.kurulan, 0);
    d = hamle(d, -1, s[k]); assert.equal(d.son.kurulan, 0);
  }
  assert.deepEqual(d.el, [0, 0]);
  assert.equal(d.sira, 0);
  assert.equal(B.evre(d), 2);
  assert.deepEqual(yazi(B.hamleler(d)), ['b4-c4', 'd2-d3', 'd5-e5', 'f4-e4'].sort());
});

test('R3 uçma: 3 taşı kalan her boş noktaya gider; kural kapalıyken komşuya', () => {
  const o = { b: [0, 12, 23], s: [1, 3, 5, 7, 9, 11], el: [0, 0], sira: 0 };
  const d = B.kur(o);
  assert.equal(B.evre(d), 3);
  const l = B.hamleler(d);
  assert.equal(l.length, 45);
  assert.ok(l.every(m => m.al === -1));
  const d2 = B.kur({ ...o, kurallar: { ucma: false } });
  assert.equal(B.evre(d2), 2);
  assert.deepEqual(yazi(B.hamleler(d2)), ['c4-b4', 'c4-c3', 'c4-c5', 'f2-d2'].sort());
  // 4 taşlı taraf uçmaz
  assert.equal(B.evre(B.kur({ b: [0, 12, 23, 21], s: [1, 3, 5, 7], el: [0, 0], sira: 0 })), 2);
});

test('R4 değirmen: dış kenar, iç kenar, orta çizgi; köşegen yalnız varyantta', () => {
  const el = [5, 5];
  assert.ok(almalar(B.kur({ b: [0, 1], s: [8], el, sira: 0 }), 2).every(a => a >= 0));
  assert.ok(almalar(B.kur({ b: [20, 21], s: [8], el, sira: 0 }), 22).every(a => a >= 0));
  assert.ok(almalar(B.kur({ b: [3, 11], s: [8], el, sira: 0 }), 19).every(a => a >= 0));
  assert.deepEqual(almalar(B.kur({ b: [0, 1], s: [8], el, sira: 0 }), 3), [-1]);
  assert.deepEqual(almalar(B.kur({ b: [0, 8], s: [5], el, sira: 0 }), 16), [-1]);
  assert.deepEqual(almalar(B.kur({ b: [0, 8], s: [5], el, sira: 0, kurallar: { kosegen: true } }), 16), [5]);
});

test('R5 değirmendeki taş alınamaz; hepsi değirmendeyse herhangi biri', () => {
  const el = [5, 5];
  assert.deepEqual(almalar(B.kur({ b: [0, 1], s: [8, 9, 10, 20], el, sira: 0 }), 2), [20]);
  ayni(almalar(B.kur({ b: [0, 1], s: [8, 9, 10], el, sira: 0 }), 2), [8, 9, 10]);
  assert.deepEqual(almalar(B.kur({ b: [0, 1], s: [8, 9, 10], el, sira: 0, kurallar: { hepsiDegirmendeyseAl: false } }), 2), [-1]);
});

test('R6 bir hamlede iki değirmen: tek taş (kural açıkken iki)', () => {
  const o = { b: [0, 2, 9, 17], s: [4, 6, 12], el: [5, 5], sira: 0 };
  const d = B.kur(o);
  const l = B.hamleler(d).filter(m => m.hedef === 1);
  assert.equal(l.length, 3);
  assert.ok(l.every(m => m.al >= 0 && m.al2 === -1));
  const cift = (s) => B.hamleler(B.kur({ ...o, s, kurallar: { ciftDegirmenIkiTas: true } }))
    .filter(m => m.hedef === 1).map(m => [Math.min(m.al, m.al2), Math.max(m.al, m.al2)].join('-')).sort();
  assert.deepEqual(cift([4, 6, 12]), ['4-6', '4-12', '6-12'].sort());
  assert.deepEqual(cift([12, 13, 14, 20]), ['12-20', '13-20', '14-20'].sort());
});

test('R7 açıp kapama: taşı çıkarıp geri koymak yine değirmen', () => {
  let d = B.kur({ b: [0, 1, 2, 15], s: [4, 12, 20, 22], el: [0, 0], sira: 0 });
  d = hamle(d, 1, 9);
  d = hamle(d, 20, 19);
  const l = almalar(d, 1, 9);
  ayni(l, [4, 12, 19, 22]);
  d = hamle(d, 9, 1, 12);
  assert.equal(d.son.kurulan, 1);
  assert.equal(B.pop(d.tas[1]), 3);
});

test('R8 rakibi 2 taşa düşüren kazanır; elinde taş varken bitmez', () => {
  let d = B.kur({ b: [0, 2, 9, 15, 20], s: [4, 6, 12], el: [0, 0], sira: 0 });
  d = hamle(d, 9, 1, 4);
  assert.deepEqual(d.bitti, { kazanan: 0, neden: 'tas' });
  assert.deepEqual(B.hamleler(d), []);
  assert.throws(() => hamle(d, 1, 9));
  const d2 = B.kur({ b: [0, 2, 9, 15, 20], s: [4, 12], el: [0, 1], sira: 1 });
  assert.equal(d2.bitti, null);
});

test('R9 hamlesi olmayan kaybeder; uçabilen kaybetmez', () => {
  assert.deepEqual(B.kur({ s: [0, 1, 2, 3], b: [4, 7, 9, 11, 20], el: [0, 0], sira: 1 }).bitti, { kazanan: 0, neden: 'hamle' });
  const o = { s: [0, 1, 2], b: [3, 7, 9, 20], el: [0, 0], sira: 1 };
  assert.equal(B.kur(o).bitti, null);
  assert.deepEqual(B.kur({ ...o, kurallar: { ucma: false } }).bitti, { kazanan: 0, neden: 'hamle' });
});

test('R10 aynı konum üçüncü kez: berabere', () => {
  let d = B.kur({ b: [0, 4, 16, 20], s: [2, 6, 18, 22], el: [0, 0], sira: 0 });
  const tur = [[0, 1], [2, 3], [1, 0], [3, 2]];
  for (let k = 0; k < 8; k++) {
    assert.equal(d.bitti, null, `yarım hamle ${k}`);
    d = hamle(d, ...tur[k % 4]);
  }
  assert.deepEqual(d.bitti, { kazanan: null, neden: 'tekrar' });
  // kural kapalıyken sürer
  let e = B.kur({ b: [0, 4, 16, 20], s: [2, 6, 18, 22], el: [0, 0], sira: 0, kurallar: { tekrar: 0 } });
  for (let k = 0; k < 12; k++) e = hamle(e, ...tur[k % 4]);
  assert.equal(e.bitti, null);
});

test('R11 taş alınmadan 50 yarım hamle: berabere; alma sıfırlar; yerleştirme saymaz', () => {
  const d = B.kur({ b: [0, 4, 16, 20], s: [2, 6, 18, 22], el: [0, 0], sira: 0, tassiz: 49 });
  assert.equal(d.bitti, null);
  assert.deepEqual(hamle(d, 0, 1).bitti, { kazanan: null, neden: 'elli' });
  const k = B.kur({ b: [0, 4, 16, 20], s: [2, 6, 18, 22], el: [0, 0], sira: 0, tassiz: 49, kurallar: { tassizHamle: 0 } });
  assert.equal(hamle(k, 0, 1).bitti, null);
  const a = B.kur({ b: [0, 2, 9, 15, 20], s: [4, 6, 12, 14], el: [0, 0], sira: 0, tassiz: 30 });
  assert.equal(hamle(a, 9, 1, 4).tassiz, 0);
  let y = B.yeniOyun();
  for (const i of [0, 5, 10, 15]) y = hamle(y, -1, i);
  assert.equal(y.tassiz, 0);
});

test('R12 rastgele oyunlar: değişmezler', () => {
  const r = rng(2026);
  for (let oyun = 0; oyun < 200; oyun++) {
    const kurallar = { ucma: r() < .8, kosegen: r() < .2, ciftDegirmenIkiTas: r() < .2 };
    let d = B.yeniOyun(kurallar, oyun % 2);
    for (let k = 0; k < 160 && !d.bitti; k++) {
      const l = B.hamleler(d);
      assert.ok(l.length > 0);
      const once = JSON.stringify(d);
      const y = B.uygula(d, l[Math.floor(r() * l.length)]);
      assert.equal(JSON.stringify(d), once, 'uygula girdiyi değiştirmez');
      assert.equal(y.tas[0] & y.tas[1], 0);
      for (let p = 0; p < 2; p++) assert.equal(B.pop(y.tas[p]) + y.el[p] + y.alinan[1 - p], 9);
      assert.equal(y.anahtarlar[y.anahtarlar.length - 1], B.anahtar(y));
      assert.ok(B.anahtar(y) < Number.MAX_SAFE_INTEGER);
      d = y;
    }
  }
});

test('R13 simetri: hamle kümesi dönüşümle birlikte döner', () => {
  const r = rng(7);
  const s = B.SIMETRI;
  const donusumler = [s.dondur, s.ayna, s.halka, (i) => s.dondur(s.halka(i))];
  const cevir = (m, f) => B.paketle(m.kaynak < 0 ? -1 : f(m.kaynak), f(m.hedef), m.al < 0 ? -1 : f(m.al), m.al2 < 0 ? -1 : f(m.al2));
  for (let oyun = 0; oyun < 30; oyun++) {
    let d = B.yeniOyun({}, 0);
    for (let k = 0; k < 40 && !d.bitti; k++) {
      for (const f of donusumler) {
        const maske = (t) => { let m = 0; for (let i = 0; i < 24; i++) if (t & (1 << i)) m |= 1 << f(i); return m; };
        const e = { ...d, tas: [maske(d.tas[0]), maske(d.tas[1])], anahtarlar: [] };
        ayni(B.hamlelerPaketli(e), B.hamleler(d).map(m => cevir(m, f)));
      }
      const l = B.hamleler(d);
      d = B.uygula(d, l[Math.floor(r() * l.length)]);
    }
  }
});

test('R14 köşegen komşuluğu yalnız varyantta', () => {
  const o = { b: [0, 3, 5, 19], s: [20, 21, 22, 13], el: [0, 0], sira: 0 };
  assert.ok(!B.hamleler(B.kur(o)).some(m => m.kaynak === 0 && m.hedef === 8));
  assert.ok(B.hamleler(B.kur({ ...o, kurallar: { kosegen: true } })).some(m => m.kaynak === 0 && m.hedef === 8));
});

test('tehdit delikleri: yerleştirme, hareket, uçma', () => {
  assert.equal(B.tehditDelikleri(B.kur({ b: [0, 1], s: [9], el: [5, 5], sira: 0 }), 0), 1 << 2);
  // hareket: delik 2'ye komşu, hattın dışında bir taş gerekir (3)
  assert.equal(B.tehditDelikleri(B.kur({ b: [0, 1, 3], s: [9, 12, 13], el: [0, 0], sira: 0 }), 0), 1 << 2);
  assert.equal(B.tehditDelikleri(B.kur({ b: [0, 1, 20, 21], s: [9, 12, 13], el: [0, 0], sira: 0 }), 0) & (1 << 2), 0);
  // uçma: üçüncü taş her yerden gelir
  assert.equal(B.tehditDelikleri(B.kur({ b: [0, 1, 20], s: [9, 12, 13, 14], el: [0, 0], sira: 0 }), 0), 1 << 2);
});

test('kurulu değirmenler listesi', () => {
  const d = B.kur({ b: [0, 1, 2], s: [20, 21, 22], el: [3, 3], sira: 0 });
  assert.deepEqual(B.kuruluDegirmenler(d).map(x => [x.hat.join(','), x.sahip]), [['0,1,2', 0], ['20,21,22', 1]]);
});
