const test = require('node:test'), assert = require('node:assert');
const R = require('../rules.js'), A = require('../ai.js');
const { T, pistleriYukle } = require('./yardim.js');

function rng(s) { return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function kos(p, h, z, r, k) {
  let d = R.yeniYaris(p, {}, [{ ad: z }], {});
  Object.assign(d.arabalar[0], { x: p.baslangic[k][0], y: p.baslangic[k][1], iz: [p.baslangic[k]] });
  for (let n = 0; n < 400 && !d.bitti; n++) d = R.hamleYap(d, 0, A.sec(d, 0, { zorluk: z, harita: h, rng: r }));
  return d;
}

test('pist dosyalarındaki par BFS ile aynı; BFS süresi < 1 sn (1 ve 3 tur)', () => {
  for (const t of pistleriYukle()) {
    const p = T.ayristir(t);
    for (const tur of [1, 3]) {
      const t0 = Date.now(), h = A.olc(p, { tur }), ms = Date.now() - t0;
      if (tur === 1) assert.equal(h.par, t.par, t.kimlik);
      assert.ok(h.par < 255, t.kimlik);
      assert.ok(ms < 1000, `${t.kimlik} ${tur} tur ${ms} ms`);
      console.log(`  ${t.kimlik} ${tur} tur: par ${h.par}, ${ms} ms`);
    }
  }
});

test('zor her pisti par ya da +1\'de bitirir; kolay ara sıra çarpar ama hep bitirir', () => {
  let toplamCarpma = 0;
  for (const t of pistleriYukle()) {
    const p = T.ayristir(t), h = A.olc(p);
    for (let k = 0; k < 4; k++) {
      const d = kos(p, h, 'zor', rng(k), k);
      assert.ok(d.bitti && d.arabalar[0].hamle <= h.par + 1, `${t.kimlik} zor ${d.arabalar[0].hamle}`);
    }
    let carpma = 0;
    for (let s = 0; s < 8; s++) {
      const d = kos(p, h, 'kolay', rng(100 + s), s % 4);
      assert.ok(d.bitti, `${t.kimlik} kolay bitirmedi`);
      carpma += d.arabalar[0].carpma;
    }
    console.log(`  ${t.kimlik}: kolay 8 yarışta ${carpma} çarpma`);
    toplamCarpma += carpma;
  }
  assert.ok(toplamCarpma > 0, 'kolay hiç çarpmıyor');
});

test('gösteri sürücüsü İlk Viraj\'da ilk virajda çarpar', () => {
  const p = T.ayristir(T.bul('ilk-viraj')), h = A.olc(p);
  const d = kos(p, h, 'gosteri', rng(1), 1);
  assert.ok(d.arabalar[0].carpma >= 1);
  assert.ok(d.bitti);
});
