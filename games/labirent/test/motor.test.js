const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const G = require('../engine/generate.js');

const TURLER = ['D', 'H', 'A'], ALGLAR = ['G', 'P', 'W', 'K'], BOYLAR = ['K', 'O', 'B'];
const toplam = (a) => a.reduce((x, y) => x + y, 0);

test('her topoloji × algoritma × boy: bağlı ve döngüsüz (geçit = hücre − 1)', () => {
  for (const tur of TURLER) for (const alg of ALGLAR) for (const boy of BOYLAR) for (const tohum of [1, 777, 99999]) {
    const L = G.uret({ tur, boy, alg, tohum }), n = L.grid.n, ad = L.kod;
    assert.equal(toplam(L.acik), n - 1, `${ad}: geçit sayısı`);
    const { uz } = T.bfs(L, 0);
    assert.ok(uz.every(v => v >= 0), `${ad}: bağlı değil`);
  }
});

test('aynı tohum aynı labirent (kenar kümesi, giriş, çıkış); farklı tohum farklı', () => {
  for (const tur of TURLER) for (const alg of ALGLAR) {
    const a = G.uret({ tur, boy: 'O', alg, tohum: 4242 }), b = G.uret(a.kod), c = G.uret({ tur, boy: 'O', alg, tohum: 4243 });
    assert.deepEqual(a.acik, b.acik, a.kod);
    assert.deepEqual([a.giris, a.cikis], [b.giris, b.cikis], a.kod);
    assert.notDeepEqual(a.acik, c.acik, a.kod);
  }
});

test('algoritma farkı: geri izlemenin çıkmaz oranı Prim\'inkinin en çok %60\'ı (20 tohum)', () => {
  const oran = (L) => { let c = 0; for (let i = 0; i < L.grid.n; i++) if (T.derece(L, i) === 1) c++; return c / L.grid.n; };
  for (const tur of TURLER) {
    const ort = (alg) => toplam(Array.from({ length: 20 }, (_, s) => oran(G.uret({ tur, boy: 'O', alg, tohum: s + 1 })))) / 20;
    const g = ort('G'), p = ort('P'), w = ort('W'), k = ort('K');
    assert.ok(g <= .6 * p, `${tur}: geri izleme ${g.toFixed(3)} / Prim ${p.toFixed(3)}`);
    assert.ok(g < k && k < p, `${tur}: karışım ikisinin arasında (${g.toFixed(3)} < ${k.toFixed(3)} < ${p.toFixed(3)})`);
    assert.ok(w > g && w < p, `${tur}: Wilson ${w.toFixed(3)}`);
  }
});

test('ızgara boyları ve geometri tutarlı', () => {
  assert.deepEqual(T.halkaSayilari(5), [1, 6, 12, 24, 24]);
  assert.equal(T.daire(9).n, 235);
  assert.equal(T.altigen({ R: 9 }).n, 271);
  const d = T.dik(14, 20), h = T.altigen({ R: 5 }), c = T.daire(6);
  assert.equal(toplam(d.sinir.map(s => s.length)), 2 * (14 + 20));
  assert.equal(toplam(h.sinir.map(s => s.length)), 6 * (2 * 5 + 1));
  const yakin = (a, b) => Math.abs(a - b) < 1e-9;
  // dik ve altıgen: iç kenarın ortası iki hücre merkezinin ortası; altıgen kenar boyu 1
  for (const g of [d, h, T.altigen({ alan: 'dik', W: 7, H: 6 })]) g.kenar.forEach(([i, j], k) => {
    const e = g.kenarGeo(k), [ix, iy] = g.merkez(i), [jx, jy] = g.merkez(j);
    assert.ok(yakin((e.a[0] + e.b[0]) / 2, (ix + jx) / 2) && yakin((e.a[1] + e.b[1]) / 2, (iy + jy) / 2), `${g.tur} kenar ${k}`);
    if (g.tur === 'altigen') assert.ok(yakin(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), 1));
  });
  // daire: ic/dis kenarı iç halkanın dış yarıçapında yay; saat/ters kenarı 1 boyunda ışın
  c.kenar.forEach(([i, j], k) => {
    const e = c.kenarGeo(k), hi = c.halka[i], hj = c.halka[j];
    if (hi === hj) { assert.equal(e.tip, 'd'); assert.ok(yakin(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), 1)); }
    else { assert.equal(e.tip, 'y'); assert.equal(e.r, Math.max(hi, hj)); assert.ok(e.t1 > e.t0); }
  });
  // her hücrenin komşu sayısı: dik 2–4, altıgen 3–6 (sınırda), daire merkez 6
  assert.equal(c.komsu[0].length, 6);
});

test('giriş üst-sol bölgede dış kenarda; çıkış girişe en uzak dış hücrelerin ilk %20\'sinde', () => {
  for (const tur of ['D', 'A']) for (let s = 1; s <= 15; s++) {
    const L = G.uret({ tur, boy: 'O', alg: 'W', tohum: s }), g = L.grid, gi = L.giris.hucre;
    assert.ok(g.sinir[gi].some(x => x.yon === L.giris.kenar), `${L.kod}: giriş dış kenarda değil`);
    assert.ok(g.sinir[L.cikis.hucre].some(x => x.yon === L.cikis.kenar), `${L.kod}: çıkış dış kenarda değil`);
    if (tur === 'D') {
      const c = gi % g.W, r = Math.floor(gi / g.W);
      assert.ok((L.giris.kenar === 'K' && r === 0 && c < g.W / 3) || (L.giris.kenar === 'B' && c === 0 && r < g.H / 3), L.kod);
    } else {
      const [x, y] = g.merkez(gi);
      assert.ok(x < g.orta[0] && y < g.orta[1], L.kod);
    }
    const { uz } = T.bfs(L, gi), dis = [];
    for (let i = 0; i < g.n; i++) if (g.sinir[i].length && i !== gi) dis.push(uz[i]);
    dis.sort((a, b) => b - a);
    const esik = dis[Math.max(1, Math.ceil(dis.length * .2)) - 1];
    assert.ok(uz[L.cikis.hucre] >= esik, `${L.kod}: çıkış uzaklığı ${uz[L.cikis.hucre]} < ${esik}`);
  }
  for (let s = 1; s <= 10; s++) {
    const L = G.uret({ tur: 'H', boy: 'O', alg: 'P', tohum: s }), g = L.grid;
    assert.equal(L.cikis.hucre, 0);
    assert.equal(g.halka[L.giris.hucre], g.R - 1);
    const { uz } = T.bfs(L, 0);
    for (let i = g.bas[g.R - 1]; i < g.n; i++) assert.ok(uz[i] <= uz[L.giris.hucre]);
  }
});

test('duvarlar: kapalı iç kenarlar + sınır − iki ağız', () => {
  for (const kod of ['D-O-G-2345', 'A-O-K-2345', 'H-O-W-2345']) {
    const L = G.uret(kod), g = L.grid;
    const beklenen = g.kenar.length - (g.n - 1) + toplam(g.sinir.map(s => s.length)) - (L.cikis.kenar ? 2 : 1);
    assert.equal(T.duvarlar(L).length, beklenen, kod);
  }
});

test('labirent kodu: gidiş-dönüş, küçük harf, bozuk kod reddi', () => {
  for (const kod of ['D-O-W-7KQ9', 'H-K-G-2222', 'A-V-P-ZZZZ', 'D-B-K-AB3C', 'T-O-W-7KQ9']) {
    const s = G.kodOku(kod);
    assert.ok(s, kod);
    assert.equal(G.kodYaz(s), kod);
    assert.equal(G.uret(kod.toLowerCase()).kod, kod);
  }
  for (const k of ['D-O-W-7KQ', 'X-O-W-7KQ9', 'D-Q-W-7KQ9', 'D-O-Z-7KQ9', 'D-O-W-7KQ0', 'DOW7KQ9', '']) assert.equal(G.kodOku(k), null, k);
  assert.throws(() => G.uret('bozuk'));
});
