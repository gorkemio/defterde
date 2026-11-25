const test = require('node:test'), assert = require('node:assert');
const R = require('../rules.js'), A = require('../ai.js');
const { T, SPRINT, pist } = require('./yardim.js');

function rng(s) { return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const HALKA = pist('##########\n##########\n##......##\n##......##\n##......##\n##......##\n##########\n##########', {
  bitis: { a: [5, 0], b: [5, 2], yon: [1, 0] }, kontrol: [{ a: [5, 6], b: [5, 8], yon: [-1, 0] }],
  baslangic: [[5, 1], [5, 2], [5, 0]] });

// Bağımsız kaba kuvvet: kural motoruyla ileri BFS, hız sınırı yok.
function kabaPar(p, tur = 1) {
  let en = Infinity;
  for (const [x, y] of p.baslangic) {
    const gor = new Set(), q = [[x, y, 0, 0, 0, 0, 0]];
    gor.add([x, y, 0, 0, 0, 0].join());
    for (let k = 0; k < q.length; k++) {
      const [px, py, vx, vy, s, t, d] = q[k];
      if (d >= en) break;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        const nvx = vx + ax, nvy = vy + ay, nx = px + nvx, ny = py + nvy;
        if (!nvx && !nvy) continue;
        if (!R.parcaYasal(p, px, py, nx, ny).yasal) continue;
        const g = R.gecisler(p, px, py, nx, ny);
        if (g.some(z => z.cizgi === 0 && !z.ileri)) continue;
        const il = R.ilerleme(p.N, tur, s, t, g);
        if (il.bitti) { en = Math.min(en, d + 1); continue; }
        const a = [nx, ny, nvx, nvy, il.sayac, il.tur].join();
        if (!gor.has(a)) { gor.add(a); q.push([nx, ny, nvx, nvy, il.sayac, il.tur, d + 1]); }
      }
    }
  }
  return en;
}

test('par: 6×4 düz sprintte elle sayılan değer (1, 2, 3 → x=6) = 3', () => {
  const h = A.olc(T.ayristir(SPRINT));
  assert.equal(h.par, 3);
  const koridor = pist('##########', { bitis: { a: [9, 0], b: [9, 1], yon: [1, 0] }, baslangic: [[0, 0]] });
  assert.equal(A.olc(koridor).par, 4);                     // 1, 3, 6, 10
});

test('par: 10×8 halkada kaba kuvvet aramayla aynı (1 ve 2 tur)', () => {
  assert.equal(A.olc(HALKA).par, kabaPar(HALKA));
  assert.equal(A.olc(HALKA, { tur: 2 }).par, kabaPar(HALKA, 2));
});

test('ideal yol: par uzunluğunda, her parçası yasal, bitişte biter', () => {
  const h = A.olc(HALKA), y = A.idealYol(h, HALKA);
  assert.equal(y.length - 1, h.par);
  for (let i = 1; i < y.length; i++) assert.ok(R.parcaYasal(HALKA, ...y[i - 1], ...y[i]).yasal);
  let d = R.yeniYaris(HALKA, {}, [{ ad: 'z' }]);
  Object.assign(d.arabalar[0], { x: y[0][0], y: y[0][1] });
  while (!d.bitti) d = R.hamleYap(d, 0, A.sec(d, 0, { zorluk: 'zor', harita: h }));
  assert.equal(d.arabalar[0].hamle, h.par);
});

// Rastgele yasal hamlelerle ulaşılan durumlar
function durumlar(p, adet, r) {
  const l = [];
  while (l.length < adet) {
    let d = R.yeniYaris(p, {}, [{ ad: 'a' }]);
    for (let n = 0; n < 40 && !d.bitti; n++) {
      l.push(d);
      const y = R.adaylar(d, 0).map((c, k) => (c.yasal ? k : -1)).filter(k => k >= 0);
      d = R.hamleYap(d, 0, y.length ? y[Math.floor(r() * y.length)] : null);
    }
  }
  return l.slice(0, adet);
}

test('hiçbir zorluk yasal aday varken çarpmayı seçmez; zor kalan hamleyi bir azaltır', () => {
  const h = A.olc(HALKA), r = rng(7);
  for (const d of durumlar(HALKA, 2000, r)) {
    const l = R.adaylar(d, 0), yasalVar = l.some(c => c.yasal);
    for (const z of ['kolay', 'orta', 'zor', 'gosteri']) {
      const k = A.sec(d, 0, { zorluk: z, harita: h, rng: r });
      if (yasalVar) assert.ok(l[k] && l[k].yasal, z); else assert.equal(k, null);
    }
    const a = d.arabalar[0], once = A.kalanAl(h, HALKA, a.x, a.y, a.vx, a.vy, R.prog(HALKA, a));
    if (once < 255 && once > 1) {
      const c = l[A.sec(d, 0, { zorluk: 'zor', harita: h })];
      assert.equal(A.kalanAl(h, HALKA, c.x, c.y, c.vx, c.vy, c.ilerleme.tur * 2 + c.ilerleme.sayac), once - 1);
    }
  }
});

test('orta: dörtte bir ikinci en iyi adayı seçer', () => {
  const h = A.olc(HALKA), r = rng(3);
  let fark = 0, say = 0;
  for (const d of durumlar(HALKA, 3000, rng(11))) {
    const l = R.adaylar(d, 0);
    if (l.filter(c => c.yasal).length < 2) continue;
    const zor = A.sec(d, 0, { zorluk: 'zor', harita: h });
    const orta = A.sec(d, 0, { zorluk: 'orta', harita: h, rng: r });
    say++; if (orta !== zor) fark++;
  }
  const oran = fark / say;
  assert.ok(oran > .18 && oran < .3, 'oran ' + oran.toFixed(3));
});

test('önbellek anahtarı pist içeriğine bağlı; paketle/aç kayıpsız', () => {
  const p = T.ayristir(SPRINT);
  const q = T.ayristir(Object.assign({}, SPRINT, { harita: '######\n######\n######\n#####.' }));
  assert.equal(A.onbellekAnahtari(p), A.onbellekAnahtari(T.ayristir(SPRINT)));
  assert.notEqual(A.onbellekAnahtari(p), A.onbellekAnahtari(q));
  assert.notEqual(A.onbellekAnahtari(p, 1), A.onbellekAnahtari(p, 2));
  const h = A.olc(HALKA, { tur: 2 }), g = A.ac(A.paketle(h));
  assert.deepEqual(Array.from(g.kalan), Array.from(h.kalan));
  assert.equal(g.par, h.par);
});

test('dilimli ölçüm aynı sonucu verir ve iptal edilebilir', async () => {
  const h = await A.olcAsync(HALKA, {}, { dilimMs: 1 });
  assert.equal(h.par, A.olc(HALKA).par);
  await assert.rejects(A.olcAsync(HALKA, {}, { iptal: () => true }), /iptal/);
});
