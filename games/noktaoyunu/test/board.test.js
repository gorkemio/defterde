// node --test test/board.test.js — tahta ve kurallar (PLAN §6: T1–T8)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');

// tohumlu rastgele (mulberry32)
function rng(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ayni = (a, b, msg) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y), msg);

test('T1 çizgi ve kutu sayıları; her kutu 4, her çizgi 1–2 kutu', () => {
  for (const [m, n, E, K] of [[4, 4, 24, 9], [5, 5, 40, 16], [6, 6, 60, 25], [7, 7, 84, 36], [6, 8, 82, 35]]) {
    const G = B.geo(m, n);
    assert.equal(G.E, m * (n - 1) + (m - 1) * n);
    assert.equal(G.E, E, `${m}×${n}`);
    assert.equal(G.K, K);
    const say = new Array(G.E).fill(0);
    for (let k = 0; k < G.K; k++) {
      const l = Array.from(G.KUTU_KENAR.slice(4 * k, 4 * k + 4));
      assert.equal(new Set(l).size, 4);
      l.forEach(e => say[e]++);
    }
    for (let e = 0; e < G.E; e++) {
      assert.ok(say[e] === 1 || say[e] === 2);
      const kenarda = G.KENAR_UC[e].every(([r, c]) => r === 0) || G.KENAR_UC[e].every(([r, c]) => r === m - 1)
        || G.KENAR_UC[e].every(([r, c]) => c === 0) || G.KENAR_UC[e].every(([r, c]) => c === n - 1);
      assert.equal(say[e], kenarda ? 1 : 2, `çizgi ${G.kenarAdi(e)}`);
    }
  }
});

test('T2 tek kutu kapanır: sahip, puan, sıra kalır', () => {
  const d = B.kur({ cizgiler: ['A1-B1', 'A1-A2', 'B1-B2'], sira: 1 });
  const G = d.G, e = G.kenar('A2-B2');
  assert.equal(B.kapatir(d, e), 1);
  const k = B.cek(d, e);
  assert.deepEqual(k.alinan, [0]);
  assert.equal(d.sahip[0], 1);
  assert.deepEqual(d.puan, [0, 1]);
  assert.equal(d.sira, 1, 'kutu alan bir daha oynar');
  B.cek(d, G.kenar('C1-D1'));
  assert.equal(d.sira, 0, 'kutu almayan çizgide sıra geçer');
});

test('T3 bir çizgiyle iki kutu: ikisi de çekenin, tek hamle', () => {
  const d = B.kur({ cizgiler: ['A1-B1', 'A1-A2', 'A2-B2', 'B1-C1', 'C1-C2', 'B2-C2'], sira: 0 });
  const e = d.G.kenar('B1-B2');
  assert.equal(B.kapatir(d, e), 2);
  const k = B.cek(d, e);
  ayni(k.alinan, [0, 1]);
  assert.deepEqual(d.puan, [2, 0]);
  assert.equal(d.sira, 0);
  assert.equal(d.kalan, d.G.E - 7);
});

test('T4 zorunlu ek hamle zinciri: açılan 3\'lüğü alan alan devam eder', () => {
  // Üst sıra: A1–D1 kutuları (0,0),(0,1),(0,2) üstü ve altı çekili, aralar ve uçlar boş → 3'lük zincir.
  const d = B.kur({ cizgiler: ['A1-B1', 'B1-C1', 'C1-D1', 'A2-B2', 'B2-C2', 'C2-D2', 'D1-D2'], sira: 0 });
  const G = d.G;
  B.cek(d, G.kenar('A1-A2'));                         // 0 zinciri açar
  assert.equal(d.sira, 1);
  B.cek(d, G.kenar('B1-B2'));                         // 1 ilk kutuyu alır
  assert.equal(d.sira, 1); assert.deepEqual(d.puan, [0, 1]);
  B.cek(d, G.kenar('C1-C2'));                         // ikinciyi; son kutu (0,2) D1-D2 çekili olduğundan aynı anda kapanır
  assert.deepEqual(d.puan, [0, 3], 'son çizgi iki kutuyu birden kapatır');
  assert.equal(d.sira, 1);
  B.cek(d, G.kenar('E1-E2'));                         // kapatmayan çizgi: sıra geçer
  assert.equal(d.sira, 0);
});

test('T5 oyun sonu ve skor; berabere', () => {
  const r = rng(5);
  for (let i = 0; i < 30; i++) {
    const d = B.yeniOyun({ m: 4, n: 4, baslayan: i % 2 });
    while (!d.bitti) { const l = B.hamleler(d); B.cek(d, l[Math.floor(r() * l.length)]); }
    assert.equal(d.puan[0] + d.puan[1], 9);
    assert.equal(d.kalan, 0);
    assert.ok(d.sahip.every(s => s >= 0));
    assert.equal(B.kazanan(d), d.puan[0] > d.puan[1] ? 0 : 1);
  }
  const d = B.kur({ m: 3, n: 3, bos: ['B1-B2'], sahip: { A1: 0, A2: 1 }, sira: 0 });
  assert.deepEqual(d.puan, [1, 1], 'alt sıradaki kapalı kutular: A2 → 1, B2 → varsayılan 0');
  B.cek(d, d.G.kenar('B1-B2'));
  assert.equal(d.bitti, true);
  assert.deepEqual(d.puan, [3, 1]);
  const b = B.kur({ m: 3, n: 3, bos: ['A3-B3'], sahip: { A1: 0, B1: 1, B2: 1 }, sira: 0 });
  B.cek(b, b.G.kenar('A3-B3'));
  assert.equal(B.kazanan(b), 'berabere');
  assert.equal(B.kazanan(B.yeniOyun()), null);
});

test('T6 güvenli hamle: üçüncü kenar veren çizgi güvensiz', () => {
  const d = B.kur({ cizgiler: ['A1-B1', 'A1-A2'] });         // (0,0) iki kenarlı
  const G = d.G;
  assert.equal(B.guvenliMi(d, G.kenar('A2-B2')), false);
  assert.equal(B.guvenliMi(d, G.kenar('B1-B2')), false);
  assert.equal(B.guvenliMi(d, G.kenar('B1-C1')), true, '3–4 serbestli kutular arası güvenli');
  assert.equal(B.guvenliMi(d, G.kenar('A1-B1')), false, 'çekili çizgi güvenli sayılmaz');
  assert.equal(B.guvenli(d).length, G.E - 2 - 2);
  ayni(B.tehlikeli(d), [G.kenar('A2-B2'), G.kenar('B1-B2')]);
  // kenar çizgisi yalnız kendi kutusuna bakar
  const k = B.kur({ cizgiler: ['B1-B2', 'A2-B2'] });
  assert.equal(B.guvenliMi(k, k.G.kenar('A1-B1')), false);
  assert.equal(B.guvenliMi(k, k.G.kenar('B1-C1')), true);
  // kapatan çizgi güvenli değil, alınabilir
  const a = B.kur({ cizgiler: ['A1-B1', 'A1-A2', 'B1-B2'] });
  assert.deepEqual(B.alinabilir(a), [a.G.kenar('A2-B2')]);
  assert.ok(!B.guvenli(a).includes(a.G.kenar('A2-B2')));
});

test('T7 cek/geriAl sonrası durum eşit; uygula girdiyi değiştirmez', () => {
  const r = rng(77);
  for (let oyun = 0; oyun < 300; oyun++) {
    const [m, n] = [[3, 3], [4, 4], [5, 5], [4, 6]][oyun % 4];
    const d = B.yeniOyun({ m, n, baslayan: oyun & 1 });
    const yigin = [];
    while (!d.bitti) {
      const once = B.kopya(d), l = B.hamleler(d), e = l[Math.floor(r() * l.length)];
      const k = B.cek(d, e);
      yigin.push([once, k]);
      if (r() < .15) { B.geriAl(d, k); assert.deepEqual(d, once); yigin.pop(); B.cek(d, e); yigin.push([once, k]); }
    }
    while (yigin.length) { const [once, k] = yigin.pop(); B.geriAl(d, k); assert.deepEqual(d, once); }
    assert.deepEqual(d, B.yeniOyun({ m, n, baslayan: oyun & 1 }));
  }
  const d = B.yeniOyun(), once = B.kopya(d);
  const y = B.uygula(d, 3);
  assert.deepEqual(d, once);
  assert.equal(y.cizgi[3], 1);
  assert.throws(() => B.cek(y, 3), /Geçersiz/);
});

test('T8 notasyon gidiş dönüş', () => {
  const G = B.geo(6, 8);
  for (let e = 0; e < G.E; e++) { assert.equal(G.kenar(G.kenarAdi(e)), e); }
  assert.equal(G.kenarAdi(G.H(0, 0)), 'A1-B1');
  assert.equal(G.kenarAdi(G.V(4, 7)), 'H5-H6');
  assert.equal(G.kenar('b1-a1'), G.H(0, 0), 'ters yön ve küçük harf');
  assert.equal(G.kutuAdi(G.K - 1), 'G5');
  assert.throws(() => G.kenar('A1-C1'));
});
