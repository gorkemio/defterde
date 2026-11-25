const test = require('node:test'), assert = require('node:assert');
const { T, pistleriYukle, SPRINT, pist } = require('./yardim.js');

test('ayrıştırma: boyut, yasal noktalar, boş satırlar', () => {
  const p = T.ayristir(Object.assign({}, SPRINT, { harita: '\n\n######\n######\n######\n######\n\n' }));
  assert.equal(p.W, 6); assert.equal(p.H, 4);
  assert.equal(p.NP, 7 * 5);
  const q = pist('##..\n##..');
  assert.ok(q.yasal(2, 0) && !q.yasal(3, 0) && q.yasal(0, 2));
  assert.equal(q.W, 4);
});

test('doğrulama: ince çim, kopuk asfalt, pisti tam kesmeyen çizgi, başlangıç', () => {
  const ince = T.dogrula(pist('#####\n##.##\n#####', { bitis: { a: [1, 0], b: [1, 3], yon: [1, 0] } }));
  assert.ok(ince.some(h => h.startsWith('ince çim (2,1)')));
  const kopuk = T.dogrula(pist('##...##\n##...##'));
  assert.ok(kopuk.some(h => h.includes('kopuk')));
  const kisa = T.dogrula(pist('####\n####\n####', { bitis: { a: [2, 0], b: [2, 2], yon: [1, 0] } }));
  assert.ok(kisa.some(h => h.includes('tam kesmiyor')));
  const sp = T.dogrula(T.ayristir(SPRINT));
  assert.ok(sp.some(h => h.includes('bitiş çizgisinde değil')));
});

test('altı MVP pisti temiz ve boyut sınırında', () => {
  const l = pistleriYukle();
  assert.equal(l.length, 6);
  for (const t of l) {
    const p = T.ayristir(t);
    assert.deepEqual(T.dogrula(p), [], t.kimlik);
    assert.ok(p.W <= 44 && p.H <= 28, t.kimlik);
  }
});

test('kenar çokgenleri: oval 2 halka, sekiz 3 halka, halkalar kapalı ve yarım hücre dışarıda', () => {
  pistleriYukle();
  const oval = T.ayristir(T.bul('ilk-viraj'));
  assert.equal(T.kenarCokgenleri(oval).length, 2);
  assert.equal(T.kenarCokgenleri(T.ayristir(T.bul('sekiz'))).length, 3);
  // yumuşatmasız halkanın tüm noktaları yasal ve yasadışı nokta arasındaki orta noktalarda
  const ham = T.kenarCokgenleri(oval, { chaikin: 0, eps: 0 });
  for (const [x, y] of ham[0]) {
    const a = [Math.floor(x), Math.floor(y)], b = [Math.ceil(x), Math.ceil(y)];
    assert.notEqual(oval.yasal(...a), oval.yasal(...b));
  }
  // Chaikin halka sayısını ve kapalılığı korur, nokta sayısını iki katına çıkarır
  const h = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assert.equal(T.chaikin(h).length, 8);
  assert.ok(Math.abs(T.alanHesap(T.chaikin(h))) < 4);
});

test('çim mesafesi: asfalt 0, komşu 1, tavan 9', () => {
  const p = pist('#..........\n...........');
  const d = T.cimMesafesi(p);
  assert.equal(d[0], 0); assert.equal(d[1], 1); assert.equal(d[11], 1); assert.equal(d[10], 9);
});

test('eğri yolu kapalı Bézier üretir', () => {
  const d = T.egriYolu([[0, 0], [1, 0], [1, 1], [0, 1]], (x, y) => [x * 20, y * 20]);
  assert.match(d, /^M .* Z$/);
  assert.equal((d.match(/Q /g) || []).length, 4);
});

test('yay örnekleme: sabit adım, iç normal asfalta bakar', () => {
  pistleriYukle();
  const oval = T.ayristir(T.bul('ilk-viraj'));
  const dis = T.kenarCokgenleri(oval)[0];
  const orn = T.yayOrnekle(dis, .5);
  for (let i = 1; i < orn.length; i++) assert.ok(Math.abs(orn[i].s - orn[i - 1].s - .5) < 1e-9);
  // örneklerin çoğunda normal yönünde yarım hücre ilerisi asfalta daha yakın
  let ic = 0;
  for (const q of orn) if (T.alanDegeri(oval, q.x + q.nx * .6, q.y + q.ny * .6) > T.alanDegeri(oval, q.x - q.nx * .6, q.y - q.ny * .6)) ic++;
  assert.ok(ic > orn.length * .9, `${ic}/${orn.length}`);
  // delikte de iç normal (asfalta doğru) aynı testi geçer
  const delik = T.kenarCokgenleri(oval)[1], od = T.yayOrnekle(delik, .5, false);
  let icD = 0;
  for (const q of od) if (T.alanDegeri(oval, q.x + q.nx * .6, q.y + q.ny * .6) > T.alanDegeri(oval, q.x - q.nx * .6, q.y - q.ny * .6)) icD++;
  assert.ok(icD > od.length * .9, `${icD}/${od.length}`);
});

test('bordür adayları yalnız virajlarda; uzunluk 3–7, en çok 4', () => {
  pistleriYukle();
  const stadyum = T.ayristir(T.bul('stadyum'));
  const dis = T.kenarCokgenleri(stadyum)[0];
  const b = T.bordurAdaylari(dis);
  assert.ok(b.length >= 2 && b.length <= 4, String(b.length));
  for (const z of b) assert.ok(z.bit - z.bas >= 3 - 1e-9 && z.bit - z.bas <= 7 + 1e-9);
  // bölge ortasındaki örneğin yakınında gerçekten dönüş var: uzun düzlerin ortası (en az eğrilik) hiçbir bölgede değil
  const orn = T.yayOrnekle(dis, .25);
  const duz = orn.filter(q => Math.abs(q.ty) < .05 && q.x > stadyum.W * .4 && q.x < stadyum.W * .6);
  for (const q of duz) assert.ok(!b.some(z => q.s >= z.bas && q.s <= z.bit));
});
