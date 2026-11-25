const test = require('node:test'), assert = require('node:assert');
const R = require('../rules.js');
const { T, SPRINT, pist } = require('./yardim.js');

const sprint = () => T.ayristir(SPRINT);
const yaris = (p, n = 1, ayar = {}) => R.yeniYaris(p, ayar, Array.from({ length: n }, (_, i) => ({ ad: 'A' + i })));
const yerlestir = (d, i, x, y, vx = 0, vy = 0) => Object.assign(d.arabalar[i], { x, y, vx, vy, iz: [[x, y]] });
const indeks = (ax, ay) => (ay + 1) * 3 + (ax + 1);

test('dokuz aday: v\' = v + a, P\' = P + v\'', () => {
  const d = yaris(sprint());
  yerlestir(d, 0, 2, 2, 1, 0);
  const l = R.adaylar(d, 0);
  assert.equal(l.length, 9);
  for (const c of l) {
    assert.equal(c.vx, 1 + c.ax); assert.equal(c.vy, c.ay);
    assert.equal(c.x, 2 + c.vx); assert.equal(c.y, 2 + c.vy);
  }
  assert.deepEqual([l[0].ax, l[0].ay, l[8].ax, l[8].ay], [-1, -1, 1, 1]);
});

test('parça: çapraz çimin içinden geçerse çarpma, köşeye değmek serbest', () => {
  const p = pist('#####\n#####\n##.##\n#####\n#####');
  assert.equal(R.parcaYasal(p, 2, 2, 3, 3).yasal, false);
  const u = R.parcaYasal(p, 1, 1, 3, 3);
  assert.equal(u.yasal, false); assert.equal(u.carpmaT, 0.5);
  assert.equal(R.parcaYasal(p, 1, 4, 4, 1).yasal, false);      // (2,2) hücresinin içinden
  assert.equal(R.parcaYasal(p, 1, 3, 3, 1).yasal, true);       // yalnız (2,2) köşesine değer
  assert.equal(R.parcaYasal(p, 2, 2, 3, 2).yasal, true);       // kenar boyunca: bir yanı asfalt
  assert.equal(R.parcaYasal(p, 0, 2, 5, 2).yasal, true);       // uzun kenar boyunca
});

test('parça: iki yanı çim kenar yasadışı, duvara sürterek gitmek yasal', () => {
  const p = pist('####\n#..#\n#..#\n####');
  assert.equal(R.parcaYasal(p, 2, 1, 2, 3).yasal, false);
  assert.equal(R.parcaYasal(p, 1, 1, 1, 3).yasal, true);
  assert.equal(R.parcaYasal(p, 1, 0, 3, 0).yasal, true);
  assert.equal(R.parcaYasal(p, 1, 1, 3, 3).yasal, false);
});

test('parça: uzun çapraz (5, 3) doğru hücrelerden geçer', () => {
  const tam = '######\n######\n######\n######';
  assert.equal(R.parcaYasal(pist(tam), 0, 0, 5, 3).yasal, true);
  const cim = (c, r) => { const s = tam.split('\n').map(x => x.split('')); s[r][c] = '.'; return pist(s.map(x => x.join('')).join('\n')); };
  assert.equal(R.parcaYasal(cim(2, 1), 0, 0, 5, 3).yasal, false);
  assert.equal(R.parcaYasal(cim(1, 1), 0, 0, 5, 3).yasal, false);
  assert.equal(R.parcaYasal(cim(3, 1), 0, 0, 5, 3).yasal, false);
  assert.equal(R.parcaYasal(cim(0, 1), 0, 0, 5, 3).yasal, true);
  assert.equal(R.parcaYasal(cim(4, 1), 0, 0, 5, 3).yasal, true);
  assert.equal(R.parcaYasal(pist(tam), 0, 0, 7, 3).yasal, false);   // pist dışına
});

test('bitiş çizgisini ters yönden geçmek duvar sayılır', () => {
  const p = sprint(), d = yaris(p);
  yerlestir(d, 0, 6, 1, -1, 0);
  const l = R.adaylar(d, 0);
  assert.equal(l[indeks(-1, 0)].neden, 'ters');       // (6,1) → (4,1)
  assert.equal(l[indeks(0, 0)].yasal, true);           // çizginin üstüne önden varmak geçiş değil
  assert.equal(l[indeks(1, 0)].neden, 'yerinde');
  assert.ok(!l.some(c => c.yasal && c.x < 5));
  // çizginin tam üstünden geri gitmek de ters
  yerlestir(d, 0, 5, 1, 0, 0);
  assert.equal(R.adaylar(d, 0)[indeks(-1, 0)].neden, 'ters');
});

test('çizgi üstünden ileri çıkış tur saymaz; çizgiye tam varmak geçiştir', () => {
  const p = sprint();
  assert.deepEqual(R.gecisler(p, 5, 1, 6, 1), []);
  const g = R.gecisler(p, 3, 1, 5, 1);
  assert.equal(g.length, 1); assert.ok(g[0].ileri); assert.equal(g[0].s1, 0);
  assert.equal(R.ilerleme(0, 1, 0, 0, g).bitti, true);
});

test('kontrol noktaları sırayla; ters geçiş etkisiz; tek hamlede kontrol + bitiş', () => {
  const p = pist('############\n############', { bitis: { a: [9, 0], b: [9, 2], yon: [1, 0] },
    kontrol: [{ a: [3, 0], b: [3, 2], yon: [1, 0] }, { a: [6, 0], b: [6, 2], yon: [1, 0] }] });
  const il = (s, x1, x2) => R.ilerleme(2, 1, s, 0, R.gecisler(p, x1, 1, x2, 1));
  assert.equal(il(0, 4, 7).sayac, 0);          // 2 atlandı: sayılmaz
  assert.equal(il(0, 1, 7).sayac, 2);          // 1 sonra 2
  assert.equal(il(0, 2, 4).sayac, 1);
  assert.equal(il(1, 4, 2).sayac, 1);          // ters geçiş etkisiz
  assert.equal(il(0, 8, 10).bitti, false);     // kontrolsüz bitiş geçişi yasal ama sayılmaz
  assert.equal(il(1, 5, 10).bitti, true);      // 2. kontrol + bitiş aynı hamlede
  assert.equal(il(1, 5, 10).asim, 1);
});

test('çok turlu: bitiş geçişi tur sayar, son turda biter', () => {
  const p = sprint();
  const g = R.gecisler(p, 4, 1, 6, 1);
  assert.deepEqual(R.ilerleme(0, 2, 0, 0, g), { sayac: 0, tur: 1, bitti: false, asim: 0 });
  assert.equal(R.ilerleme(0, 2, 0, 1, g).bitti, true);
});

function oyna(d, i, ax, ay) { return R.hamleYap(d, i, indeks(ax, ay)); }

test('aynı turda çift bitiş: çizgiyi daha çok geçen önde, eşitse berabere', () => {
  let d = yaris(sprint(), 2);                    // A0 (0,1), A1 (0,2)
  d = oyna(d, 0, 1, 0); d = oyna(d, 1, 1, 0);
  d = oyna(d, 0, 1, 0); d = oyna(d, 1, 1, 0);
  d = oyna(d, 0, 1, 0);                          // A0: x 1, 3, 6 → aşım 1
  assert.equal(d.bitti, false, 'kalan araba o turdaki hamlesini yapar');
  d = oyna(d, 1, 0, 0);                          // A1: x 1, 3, 5 → aşım 0
  assert.ok(d.bitti);
  assert.deepEqual(d.siralama.map(e => [e.i, e.yer]), [[0, 1], [1, 2]]);

  let e = yaris(sprint(), 2);
  for (let k = 0; k < 3; k++) { e = oyna(e, 0, 1, 0); e = oyna(e, 1, 1, 0); }
  assert.deepEqual(e.siralama.map(x => x.yer), [1, 1]);
});

test('bitiremeyen ilerlemeye göre sıralanır', () => {
  let d = yaris(sprint(), 2);
  d = oyna(d, 0, 1, 0); d = oyna(d, 1, 0, 1);
  d = oyna(d, 0, 1, 0); d = oyna(d, 1, 1, -1);
  d = oyna(d, 0, 1, 0); d = oyna(d, 1, 0, 0);
  assert.ok(d.bitti);
  assert.equal(d.siralama[1].durum, 'bitiremedi');
  assert.equal(d.siralama[1].yer, 2);
});

test('çarpışma: başka arabanın durduğu nokta kapalı; kesişme ayarı', () => {
  const d = yaris(sprint(), 2);
  yerlestir(d, 0, 0, 1, 1, 0); yerlestir(d, 1, 2, 1);
  assert.equal(R.adaylar(d, 0)[indeks(1, 0)].neden, 'dolu');
  let k = yaris(T.ayristir(SPRINT), 2, { kesisme: false });
  yerlestir(k, 0, 1, 1); yerlestir(k, 1, 2, 1);
  k = R.hamleYap(k, 0, indeks(1, 1));            // (1,1) → (2,2)
  assert.equal(R.adaylar(k, 1)[indeks(-1, 1)].neden, 'kesisme');   // (2,1) → (1,2) çaprazı keser
  let s = yaris(T.ayristir(SPRINT), 2);
  yerlestir(s, 0, 1, 1); yerlestir(s, 1, 2, 1);
  s = R.hamleYap(s, 0, indeks(1, 1));
  assert.equal(R.adaylar(s, 1)[indeks(-1, 1)].yasal, true);         // varsayılan: kesişmek serbest
});

test('okul kuralı: çarpan yerinde kalır, hız 0, bir tur bekler; yasal aday varken çarpılamaz', () => {
  const p = pist('########\n########\n########');
  let d = yaris(p, 2);
  yerlestir(d, 0, 5, 1, 5, 0); yerlestir(d, 1, 0, 2);
  assert.ok(!R.adaylar(d, 0).some(c => c.yasal));
  d = R.hamleYap(d, 0, null);
  const a = d.arabalar[0];
  assert.deepEqual([a.x, a.y, a.vx, a.vy, a.bekle], [5, 1, 0, 0, 1]);
  assert.equal(d.olaylar[0].tip, 'carpti');
  assert.ok(d.arabalar[0].son.cx >= 7.9);
  d = R.hamleYap(d, 1, indeks(1, 0));
  assert.equal(R.siradakiAraba(d), 1, 'çarpan araba sırasını yakar');
  assert.ok(d.olaylar.some(o => o.tip === 'bekledi' && o.i === 0));
  d = R.hamleYap(d, 1, indeks(1, 0));
  assert.equal(R.siradakiAraba(d), 0);
  assert.throws(() => R.hamleYap(d, 0, null), /yasal aday varken/);
});

test('sert kural: çarpan elenir', () => {
  const p = pist('########\n########\n########');
  let d = yaris(p, 2, { carpma: 'sert' });
  yerlestir(d, 0, 5, 1, 5, 0); yerlestir(d, 1, 0, 2);
  d = R.hamleYap(d, 0, null);
  assert.equal(d.arabalar[0].durum, 'elendi');
  assert.equal(R.siradakiAraba(d), 1);
});

test('yerinde durma yalnız zorunluyken; serbest ayarında her zaman', () => {
  const p = pist('########\n########\n########');
  const d = yaris(p);
  yerlestir(d, 0, 3, 1, 1, 0);
  const l = R.adaylar(d, 0);
  assert.equal(l[indeks(-1, 0)].yasal, false);
  assert.equal(l[indeks(-1, 0)].neden, 'yerinde');
  const s = yaris(p, 1, { yerindeDurma: 'serbest' });
  yerlestir(s, 0, 3, 1, 1, 0);
  assert.equal(R.adaylar(s, 0)[indeks(-1, 0)].yasal, true);
  // zorunlu: dört köşede araba, tek hücrelik pist
  const z = yaris(pist('#'), 4);
  yerlestir(z, 0, 0, 0); yerlestir(z, 1, 1, 0); yerlestir(z, 2, 0, 1); yerlestir(z, 3, 1, 1);
  const lz = R.adaylar(z, 0);
  assert.deepEqual(lz.filter(c => c.yasal).map(c => [c.x, c.y]), [[0, 0]]);
});

test('hamleYap girdiyi değiştirmez', () => {
  const d = yaris(sprint(), 2);
  const once = JSON.stringify(d, (k, v) => (k === 'pist' ? undefined : v));
  R.hamleYap(d, 0, indeks(1, 0));
  assert.equal(JSON.stringify(d, (k, v) => (k === 'pist' ? undefined : v)), once);
});

test('fren izi: her turda hız 1 azalır; duvarda biter', () => {
  const p = pist('############\n############');
  const d = yaris(p);
  yerlestir(d, 0, 1, 2, 3, 0);
  assert.deepEqual(R.frenIzi(d, 0), { noktalar: [[1, 2], [3, 2], [4, 2]], carpma: -1 });
  yerlestir(d, 0, 6, 2, 5, 0);
  const f = R.frenIzi(d, 0);
  assert.equal(f.carpma, 1);
  assert.deepEqual(f.noktalar[1], [10, 2]);
  assert.deepEqual(f.noktalar[2], [12, 2]);
});

test('potansiyel: düz sprintte bitişe birim adım sayısı', () => {
  const p = sprint();
  assert.equal(R.potDeger(p, 0, 1, 0), 5);
  assert.equal(R.potDeger(p, 4, 1, 0), 1);
});
