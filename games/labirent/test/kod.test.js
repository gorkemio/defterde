const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../engine/rng.js');
const G = require('../engine/generate.js');

// ui/kod.js tarayıcı dosyası: küçük bir pencere taklidiyle yüklenir
function kodYukle() {
  const sureYaz = (sn) => { const t = Math.max(0, Math.floor(sn)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const ctx = { window: { LB: { rng: R, marj: { sureYaz } } }, URL, location: { href: 'https://defterde.com/labirent/index.html?kod=X#a' } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/kod.js'), 'utf8'), ctx);
  return ctx.window.LB.kod;
}

test('günün labirenti: aynı gün herkese aynı, ertesi gün farklı; Orta dikdörtgen', () => {
  const K = kodYukle(), a = K.gunun('2026-10-20'), b = K.gunun('2026-10-20'), c = K.gunun('2026-10-21');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.tur, 'D'); assert.equal(a.boy, 'O');
  assert.ok(['G', 'P', 'K'].includes(a.alg));
  assert.equal(G.uret(a).kod, G.uret(b).kod);
  assert.equal(K.bugun(new Date(2026, 9, 5)), '2026-10-05');
});

test('paylaşım metni ve link', () => {
  const K = kodYukle();
  assert.equal(K.paylasim({ tarih: '2026-10-20', sure: 52.7, par: 65, ipuclu: false }), 'Labirent · 20 Ekim · 0:52 · par 1:05 · ipuçsuz');
  assert.equal(K.paylasim({ tarih: '2026-03-01', sure: 125, par: 70, ipuclu: true }), 'Labirent · 1 Mart · 2:05 · par 1:10 · ipuçlu');
  assert.equal(K.link('D-O-W-7KQ9'), 'https://defterde.com/labirent/index.html?kod=D-O-W-7KQ9');
});
