const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const G = require('../engine/generate.js');
const S = require('../engine/solve.js');
const C = require('../config.js');

// Elle çizilmiş 5×5 (hücre = satır × 5 + sütun). Giriş 0 (üstten), çıkış 24 (alttan).
//   ┌─  ──┬───┬───┬───┬───┐       çözüm: 0 1 2 3 4 9 8 7 6 5 10 15 20 21 22 17 12 13 14 19 24
//   │ 0   1   2   3   4 │         çıkmazlar: 16 (16→11→10, 2 adım), 18 (→17, 1), 23 (→22, 1)
//   ├───┬───┬───┬───┐   │         kavşaklar (3 yol): 10, 17, 22 — üçü de çözümde
//   │ 5   6   7   8   9 │         yönler: D D D D G B B B B G G G D D K K D D G G → 7 dönüş
//   │   ┌───┬───┬───┬───┤
//   │10  11 │12  13  14 │
//   │   │   │   ├───┐   │
//   │15 │16 │17  18 │19 │
//   │   └───┘   ┌───┤   │
//   │20  21  22  23 │24 │
//   └───┴───┴───┴───┴─  ┘
const ELLE = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 9], [9, 8], [8, 7], [7, 6], [6, 5], [5, 10], [10, 15], [15, 20],
  [20, 21], [21, 22], [22, 17], [17, 12], [12, 13], [13, 14], [14, 19], [19, 24], [10, 11], [11, 16], [17, 18], [22, 23]];
const elleLab = () => G.elle(T.dik(5, 5), ELLE, { hucre: 0, kenar: 'K' }, { hucre: 24, kenar: 'G' });

test('elle sayılmış 5×5: çözüm ve beş metrik', () => {
  const L = elleLab();
  assert.equal(L.acik.reduce((a, b) => a + b), 24);
  assert.deepEqual(S.cozum(L), [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 15, 20, 21, 22, 17, 12, 13, 14, 19, 24]);
  const m = S.metrikler(L);
  assert.equal(m.cozumUzunlugu, 20);
  assert.equal(m.kararNoktasi, 3);
  assert.equal(m.cikmazSayisi, 3);
  assert.ok(Math.abs(m.cikmazOrt - 4 / 3) < 1e-9, String(m.cikmazOrt));
  assert.equal(m.donus, 7);
  const A = C.agirlik;
  assert.ok(Math.abs(S.zorluk(m) - (20 * A.uzunluk + 3 * A.karar + 4 / 3 * A.cikmazOrt + 3 * A.cikmazSayi + 7 * A.donus)) < 1e-9);
});

test('çözüm her labirentte girişten çıkışa açık geçitlerle gider; en kısa yol', () => {
  for (const kod of ['D-O-W-2345', 'H-B-P-2345', 'A-O-G-2345', 'D-V-K-2345']) {
    const L = G.uret(kod), yol = S.cozum(L);
    assert.equal(yol[0], L.giris.hucre);
    assert.equal(yol[yol.length - 1], L.cikis.hucre);
    for (let i = 1; i < yol.length; i++) assert.ok(T.acikMi(L, yol[i - 1], yol[i]), kod);
    assert.equal(yol.length - 1, T.bfs(L, L.giris.hucre).uz[L.cikis.hucre]);
    assert.equal(new Set(yol).size, yol.length);
  }
});

test('par: aynı labirentte aynı; çözüm uzadıkça artar', () => {
  const a = G.uret('D-O-K-7KQ9');
  assert.equal(S.par(a), S.par(G.uret('D-O-K-7KQ9')));
  const kucuk = G.uret('D-K-G-7KQ9'), buyuk = G.uret('D-B-G-7KQ9');
  assert.ok(S.par(kucuk) < S.par(buyuk));
  assert.ok(S.par(a) > 0);
});

test('ipucu: saptığı yer ve doğru rotanın sonraki 5 hücresi', () => {
  const L = elleLab();
  // çözümde ilerliyor: sapma yok, uçtan itibaren 5 hücre
  assert.deepEqual(S.ipucu(L, [0, 1, 2]), { sapma: null, sonraki: [2, 3, 4, 9, 8, 7] });
  // 10'dan 11'e saptı (doğrusu 15): sapma 10, sonraki 10'dan
  assert.deepEqual(S.ipucu(L, [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 16]), { sapma: 10, sonraki: [10, 15, 20, 21, 22, 17] });
  // henüz başlamadı
  assert.deepEqual(S.ipucu(L, [0]).sonraki, [0, 1, 2, 3, 4, 9]);
  // sona yakın: kalan kadar
  assert.deepEqual(S.ipucu(L, [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 15, 20, 21, 22, 17, 12, 13, 14, 19]).sonraki, [19, 24]);
});
