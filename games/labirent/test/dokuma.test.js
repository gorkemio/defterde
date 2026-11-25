const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const G = require('../engine/generate.js');
const S = require('../engine/solve.js');
const P = require('../engine/path.js');

const KARSI = { K: 'G', G: 'K', D: 'B', B: 'D' };

test('dokuma: her algoritma ve boyda bağlı, döngüsüz; aynı tohum aynı labirent', () => {
  for (const alg of ['G', 'P', 'W', 'K']) for (const boy of ['K', 'O', 'B']) for (const tohum of [1, 4242]) {
    const L = G.uret({ tur: 'T', boy, alg, tohum });
    assert.equal(L.acik.reduce((a, b) => a + b), L.grid.n - 1, L.kod);
    assert.ok(T.bfs(L, 0).uz.every(v => v >= 0), L.kod);
    assert.deepEqual(G.uret(L.kod).acik, L.acik);
  }
  assert.ok(G.uret('T-B-K-2345').grid.kopru.length > 5);
});

test('dokuma: her alt geçit, düz bir koridorun kendisine dik bir koridorun altından geçtiği yerde', () => {
  for (const kod of ['T-O-G-2345', 'T-B-P-2345', 'T-B-W-9999']) {
    const L = G.uret(kod), g = L.grid;
    for (const k of g.kopru) {
      const u = g.alt[k.c], ust = T.acikKomsular(L, k.c), alt = T.acikKomsular(L, u);
      // üst: tam iki açık geçit, karşılıklı ve köprünün yönünde; alt: tam iki, karşılıklı ve dik
      assert.equal(g.komsu[k.c].length, 2); assert.equal(ust.length, 2);
      assert.equal(g.komsu[u].length, 2); assert.equal(alt.length, 2);
      assert.equal(KARSI[ust[0].yon], ust[1].yon); assert.equal(KARSI[alt[0].yon], alt[1].yon);
      assert.deepEqual(ust.map(e => e.yon).sort(), k.yatay ? ['B', 'D'] : ['G', 'K']);
      assert.deepEqual(alt.map(e => e.yon).sort(), k.yatay ? ['G', 'K'] : ['B', 'D']);
      // komşular köprü değil (köprüler arası Chebyshev ≥ 2) ve alt hücre köprüyle aynı yerde
      for (const e of [...ust, ...alt]) assert.equal(g.alt[e.j], -1);
      assert.deepEqual(g.merkez(u), g.merkez(k.c));
    }
    assert.equal(g.korkuluk.length, 2 * g.kopru.length);
  }
});

test('dokuma: çözüm geçitlerle tutarlı; çözüm boyunca sürüklenince alt geçitten geçilir ve çıkılır', () => {
  for (const kod of ['T-O-G-7KQ9', 'T-B-K-7KQ9']) {
    const L = G.uret(kod), g = L.grid, yol = S.cozum(L), n0 = g.W * g.H;
    for (let i = 1; i < yol.length; i++) assert.ok(T.acikMi(L, yol[i - 1], yol[i]));
    // alt hücreye girilen ve çıkılan yön karşılıklı (düz geçer)
    for (let i = 1; i < yol.length - 1; i++) if (yol[i] >= n0) {
      const giris = g.komsu[yol[i]].find(e => e.j === yol[i - 1]).yon, cikis = g.komsu[yol[i]].find(e => e.j === yol[i + 1]).yon;
      assert.equal(KARSI[giris], cikis, kod);
    }
    assert.ok(yol.some(h => h >= n0), kod + ': çözüm alt geçitten geçmiyor');
    const d = P.yeni(L, { pay: .3 });
    assert.ok(P.basla(d, P.agizOrta(g, L.giris)));
    for (const h of yol) { const [x, y] = g.merkez(h); P.surukle(d, [x, y]); }
    assert.ok(d.bitti, kod);
    assert.deepEqual(d.hucreler, yol);
  }
});

test('dokuma: köprü karesinde hücre bağlama göre seçilir', () => {
  const L = G.uret('T-O-W-2345'), g = L.grid, k = g.kopru[0], u = g.alt[k.c], [x, y] = g.merkez(k.c);
  const altK = T.acikKomsular(L, u)[0].j, ustK = T.acikKomsular(L, k.c)[0].j;
  assert.equal(P.hucreBul(g, [x, y], altK), u);
  assert.equal(P.hucreBul(g, [x, y], ustK), k.c);
  assert.equal(P.hucreBul(g, [x, y]), k.c);
});
