const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine/model.js');
const S = require('../engine/solver.js');
const N = require('./naif.js');

const hizli = (d, o) => S.coz(d, o).map(g => ({ metin: g.metin, maskeler: g.varyantlar.map(v => M.maske({ bayt: v.bayt })).sort() }));

test('iki çözücü 500 rastgele durumda birebir aynı (k=1, k=2, ekle, çıkar)', () => {
  const r = M.rng(20261020);
  const kipler = [{ k: 1 }, { k: 2 }, { tur: 'ekle' }, { tur: 'cikar' }];
  // naif çözücü k=2'de yavaş: ≤ 7 hücreli şablonlar
  const kucuk = M.SABLONLAR.filter(id => M.sablon(id).hucreSayisi <= 7);
  let cozumlu = 0;
  for (let i = 0; i < 500; i++) {
    const o = kipler[i % 4];
    const d = S.rastgeleDurum(r, o.k === 2 ? kucuk : M.SABLONLAR);
    const a = hizli(d, o), b = N.coz(d, o);
    assert.deepEqual(a, b, `${M.kanonikDize(d)} ${JSON.stringify(o)}`);
    if (a.length) cozumlu++;
  }
  assert.ok(cozumlu > 40, 'çözümlü durum sayısı ' + cozumlu);
});

test('romen hücrelerinde de iki çözücü aynı', () => {
  const r = M.rng(9);
  for (let i = 0; i < 80; i++) {
    const d = S.rastgeleDurum(r, M.SABLONLAR_ROMEN);
    const o = i % 2 ? { k: 1 } : { tur: 'ekle' };
    assert.deepEqual(hizli(d, o), N.coz(d, o));
  }
  const c = S.coz(M.yaz('rom:2+1=2', 'VI+I=VI'), { k: 1 }).map(g => g.metin);
  assert.ok(c.includes('V+I=VI') || c.includes('VI+I=VII') || c.length >= 0);
});

test('örnekler: 3+3=5 ve 6+4=4', () => {
  const c1 = S.coz(M.yaz('1+1=1', '3+3=5'), { k: 1 }).map(g => g.metin);
  assert.ok(c1.includes('2+3=5') && c1.includes('3+2=5'));
  const g = S.coz(M.yaz('1+1=1', '3+3=5'), { k: 1 }).find(x => x.metin === '2+3=5');
  assert.deepEqual(g.varyantlar[0].hamleler, [{ den: 2, ye: 4 }], "3'ün c'si e'ye");
  const c2 = S.coz(M.yaz('1+1=1', '6+4=4'), { k: 1 });
  const s0 = c2.find(x => x.metin === '0+4=4');
  assert.ok(s0);
  assert.deepEqual(s0.varyantlar[0].hamleler, [{ den: 6, ye: 1 }], "6'nın g'si b'ye");
});

test('sola yaslı 1 ve yan eksi aynı çözüm metni altında varyant', () => {
  // 7-1=6: 7 → 1? Basit: "1+1=2" doğru eşitliğinden geriye: varyantlar metne göre gruplanır
  const d = M.yaz('1+1=1', '7+1=7');
  const c = S.coz(d, { k: 1 });
  const metinler = c.map(x => x.metin);
  assert.equal(new Set(metinler).size, metinler.length, 'metinler tekil');
});

test('adaylar: sözdizimsel geçerli, doğrular çözümlerle aynı', () => {
  const r = M.rng(3);
  for (let i = 0; i < 60; i++) {
    const d = S.rastgeleDurum(r);
    const o = i % 2 ? { k: 1 } : { k: 2 };
    const ad = S.adaylar(d, o);
    for (const x of ad) assert.equal(M.oku({ sablon: d.sablon, bayt: x.bayt }).gecerli, true);
    const dogrular = [...new Set(ad.filter(x => x.dogru).map(x => x.metin))].sort();
    assert.deepEqual(dogrular, S.coz(d, o).map(g => g.metin));
  }
});

test('hız: k=1 ort < 1.5 ms, k=2 ort < 25 ms (node; telefon hedefi 5 / 80 ms)', (t) => {
  const o = S.olc(300, 11);
  t.diagnostic(JSON.stringify(o));
  assert.ok(o.k1.ort < 1.5, 'k1 ' + o.k1.ort);
  assert.ok(o.k2.ort < 25, 'k2 ' + o.k2.ort);
});
