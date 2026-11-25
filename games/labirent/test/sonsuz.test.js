const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const E = require('../engine/eller.js');
const P = require('../engine/path.js');
const H = require('../engine/ghost.js');
const G = require('../engine/generate.js');
const C = require('../config.js');

test('akan labirent: üretilen satırlar orman, her bileşen son satıra dokunur; üretilmemişe geçit yok', () => {
  const a = E.akis(T, 12, 300, 7), g = a.lab.grid;
  for (const kadar of [5, 40, 120, 300]) {
    a.uret(kadar);
    const n = a.satir * 12, ata = Array.from({ length: n }, (_, i) => i), kok = (x) => { while (ata[x] !== x) x = ata[x] = ata[ata[x]]; return x; };
    for (let k = 0; k < g.kenar.length; k++) if (a.lab.acik[k]) {
      const [i, j] = g.kenar[k];
      assert.ok(i < n && j < n, 'üretilmemiş satıra geçit');
      const x = kok(i), y = kok(j);
      assert.notEqual(x, y, 'döngü');
      ata[x] = y;
    }
    // son üretilen satırdaki hücrelerin kökleri bütün bileşenleri kapsar (kapanmamış)
    const hepsi = new Set(), son = new Set();
    for (let i = 0; i < n; i++) hepsi.add(kok(i));
    for (let c = 0; c < 12; c++) son.add(kok(n - 12 + c));
    assert.equal(son.size, hepsi.size);
  }
});

test('akan labirentte yol aşağı iner; duvar listesi ağzı açık bırakır; aynı tohum aynı labirent', () => {
  const a = E.akis(T, 12, 200, 3); a.uret(60);
  const b = E.akis(T, 12, 200, 3); b.uret(60);
  assert.deepEqual(a.lab.acik, b.lab.acik);
  assert.deepEqual(a.lab.giris, b.lab.giris);
  const d = P.yeni(a.lab, { pay: .3 }), g = a.lab.grid;
  // girişten 40. satıra kadar en kısa yol boyunca sürükle
  const { uz, eb } = T.bfs(a.lab, a.lab.giris.hucre);
  let hedef = -1;
  for (let i = 40 * 12; i < 41 * 12; i++) if (uz[i] >= 0 && (hedef < 0 || uz[i] < uz[hedef])) hedef = i;
  const yol = []; for (let i = hedef; i >= 0; i = eb[i]) yol.unshift(i);
  assert.ok(P.basla(d, P.agizOrta(g, a.lab.giris)));
  for (const h of yol) P.surukle(d, g.merkez(h));
  assert.equal(Math.floor(d.hucreler[d.hucreler.length - 1] / 12), 40);
  assert.ok(!d.bitti);
  const duvar = a.duvarlar(0, 1);
  assert.ok(!duvar.some(w => w.a[1] === 0 && w.b[1] === 0 && w.a[0] === a.lab.giris.hucre), 'giriş ağzı kapalı');
});

test('silgi: hız sürekli artar, yol hızın integrali, başta ekranın üstünde', () => {
  assert.ok(C.silgiYol(0) < 0);
  let onceki = C.silgiYol(0);
  for (let t = 1; t <= 300; t++) {
    const y = C.silgiYol(t);
    assert.ok(y > onceki);
    const sayisal = (C.silgiYol(t + 1e-3) - C.silgiYol(t - 1e-3)) / 2e-3;
    assert.ok(Math.abs(sayisal - C.silgiHizi(t)) < 1e-3 * C.silgiHizi(t) + 1e-6);
    onceki = y;
  }
  assert.ok(Math.abs(C.silgiHizi(10) / C.silgiHizi(0) - 1.08) < 1e-9);
});

test('hayaletin yeri: ileri, geri sarma, ara kesir ve son', () => {
  const iz = [{ hucre: 0, t: 0 }, { hucre: 1, t: 1 }, { hucre: 2, t: 2 }, { hucre: 1, t: 2.5 }, { hucre: 6, t: 3.5 }];
  assert.deepEqual(H.yeri(iz, 0), { hucreler: [0], sonraki: 1, f: 0, geri: false, bitti: false });
  assert.deepEqual(H.yeri(iz, 1.5), { hucreler: [0, 1], sonraki: 2, f: .5, geri: false, bitti: false });
  const y = H.yeri(iz, 2.25);
  assert.deepEqual(y.hucreler, [0, 1, 2]); assert.equal(y.geri, true); assert.ok(Math.abs(y.f - .5) < 1e-9);
  assert.deepEqual(H.yeri(iz, 3).hucreler, [0, 1]);
  assert.deepEqual(H.yeri(iz, 9), { hucreler: [0, 1, 6], sonraki: null, f: 0, geri: false, bitti: true });
  assert.deepEqual(H.ac(H.sikistir(iz)), iz);
});

test('bilgisayar hayaletinin izi oynatılınca çıkışta biter, yığın her an geçerli yol', () => {
  const L = G.uret('D-O-W-4567'), s = H.simule(L, 'orta', 2);
  for (let t = 0; t <= s.sure + 1; t += .37) {
    const y = H.yeri(s.iz, t);
    for (let i = 1; i < y.hucreler.length; i++) assert.ok(T.acikMi(L, y.hucreler[i - 1], y.hucreler[i]));
  }
  const son = H.yeri(s.iz, s.sure + 1);
  assert.ok(son.bitti);
  assert.equal(son.hucreler[son.hucreler.length - 1], L.cikis.hucre);
});
