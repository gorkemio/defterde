const test = require('node:test'), assert = require('node:assert');
const G = require('../gen.js'), T = require('../track.js'), A = require('../ai.js');

test('100 ardışık günün pisti geçerli: lint temiz, boyut sınırda, par 18–40, az deneme', () => {
  let toplam = 0, en = 0;
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) {
    const tarih = G.yerelTarih(new Date(2026, 9, 19 + i));
    const g = G.gununPisti(tarih);
    assert.ok(g, tarih);
    assert.deepEqual(T.dogrula(g.p), [], tarih);
    assert.ok(g.p.W <= 44 && g.p.H <= 28);
    assert.ok(g.tanim.par >= 18 && g.tanim.par <= 40, `${tarih} par ${g.tanim.par}`);
    assert.equal(A.olc(g.p).par, g.tanim.par);
    assert.ok(g.deneme <= 10);
    toplam += g.deneme; en = Math.max(en, g.deneme);
  }
  console.log(`  ortalama ek deneme ${(toplam / 100).toFixed(2)}, en çok ${en}, gün başına ${((Date.now() - t0) / 100).toFixed(0)} ms`);
});

test('aynı tarih aynı pist, farklı tarih farklı pist', () => {
  const a = G.gununPisti('2026-10-19'), b = G.gununPisti('2026-10-19'), c = G.gununPisti('2026-10-20');
  assert.equal(a.tanim.harita, b.tanim.harita);
  assert.deepEqual(a.tanim.bitis, b.tanim.bitis);
  assert.notEqual(a.tanim.harita, c.tanim.harita);
});

test('paylaşım metni', () => {
  assert.equal(G.paylasimMetni('2026-10-19', 26, 23), 'Kağıt Rallisi · 19 Ekim · 26 hamle (ideal 23)');
  assert.equal(G.tarihYazi('2027-02-03'), '3 Şubat');
});
