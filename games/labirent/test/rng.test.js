const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../engine/rng.js');

test('aynı tohum aynı dizi, farklı tohum farklı dizi; değerler [0, 1)', () => {
  const a = R.rng(42), b = R.rng(42), c = R.rng(43);
  const da = Array.from({ length: 50 }, a), db = Array.from({ length: 50 }, b), dc = Array.from({ length: 50 }, c);
  assert.deepEqual(da, db);
  assert.notDeepEqual(da, dc);
  assert.ok(da.every(v => v >= 0 && v < 1));
  assert.deepEqual(Array.from({ length: 5 }, R.rng('dize')), Array.from({ length: 5 }, R.rng('dize')));
});

test('dağılım kabaca düzgün; gauss ortalaması ~0, sapması ~1', () => {
  const r = R.rng(7), kova = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) kova[Math.floor(r() * 10)]++;
  assert.ok(kova.every(k => k > 1800 && k < 2200), kova.join(','));
  const g = Array.from({ length: 20000 }, () => R.gauss(r)), m = g.reduce((a, b) => a + b) / g.length;
  const s = Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length);
  assert.ok(Math.abs(m) < .03 && Math.abs(s - 1) < .03, `${m} ${s}`);
});

test('tohum alfabesi: gidiş-dönüş, 4 harf, karışan harf yok, bozuk girdi null', () => {
  for (const n of [0, 1, 31, 32, 123456, R.TOHUM_EN - 1]) {
    const s = R.tohumYaz(n);
    assert.equal(s.length, 4);
    assert.equal(R.tohumOku(s), n);
    assert.equal(R.tohumOku(s.toLowerCase()), n);
  }
  assert.ok(!/[IO01]/.test(R.ALFABE));
  for (const k of ['7KQ', '7KQ9X', '7KQI', '7KQ0', '', null]) assert.equal(R.tohumOku(k), null);
});
