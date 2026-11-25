const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../layout.js');

test('üç saha, dar dikey ve yatay alanlara iki kaleyle birlikte sığar', () => {
  for (const [W, H] of [[6, 8], [8, 10], [8, 11]]) {
    for (const [width, height] of [[272, 280], [320, 420], [380, 210], [700, 600]]) {
      for (const yatay of [false, true]) {
        const r = L.sigdir(W, H, width, height, yatay);
        assert.ok(r.width <= width && r.height <= height);
        assert.ok(r.adim > 0);
        const oran = yatay ? (H + 3) / (W + 1) : (W + 1) / (H + 3);
        assert.ok(Math.abs(r.width / r.height - oran) < 1e-12);
      }
    }
  }
});

test('yatay dönüşüm mavinin üst kalesini sağa taşır; sekiz yön geri çevrilebilir', () => {
  assert.deepEqual(L.ekranYon(0, -1, true), [1, 0]);
  for (const yatay of [false, true]) {
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      assert.deepEqual(L.sahaYon(...L.ekranYon(x, y, yatay), yatay), [x, y]);
    }
  }
});

test('geçici sıfır boyutlarında sonlu ve negatif olmayan ölçüler döner', () => {
  const r = L.sigdir(8, 10, 0, -10, false);
  assert.deepEqual(r, { width: 0, height: 0, adim: 0 });
});

test('eğik kâğıdın baskısı ekranda düz kalır ve saha noktasından geçer', () => {
  for (const [w, h] of [[320, 568], [1100, 680]]) for (const aci of [0, -.7, 2]) {
    for (const kare of [8, 15.75, 28]) {
      const x = -11.25, y = 203.4, g = L.izgaraHizasi(w, h, aci, kare, x, y);
      assert.ok(g.x >= 0 && g.x < kare && g.y >= 0 && g.y < kare);
      const [a, b, c, d, e, f] = g.matris, r = aci * Math.PI / 180;
      for (const [px, py] of [[x, y], [x + 2 * kare, y], [x, y - 2 * kare]]) {
        const u = a * px + c * py + e - w / 2, v = b * px + d * py + f - h / 2;
        const sx = Math.cos(r) * u - Math.sin(r) * v + w / 2;
        const sy = Math.sin(r) * u + Math.cos(r) * v + h / 2;
        assert.ok(Math.hypot(sx - px, sy - py) < 1e-9);
        assert.ok(Math.abs((sx - g.x) / kare - Math.round((sx - g.x) / kare)) < 1e-9);
        assert.ok(Math.abs((sy - g.y) / kare - Math.round((sy - g.y) / kare)) < 1e-9);
      }
    }
  }
});
