// node --test — kit/rakam.js glif verisi
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../kit/rakam.js');

const noktalar = (d) => (d[0] === 'L' ? [[d[1], d[2]], [d[3], d[4]]]
  : d[0] === 'C' ? d[1]
  : [[d[1] - d[3] / 2, d[2] - d[4] / 2], [d[1] + d[3] / 2, d[2] + d[4] / 2]]);

test('her rakam ve işaretin en az bir darbesi var', () => {
  for (const ch of '0123456789+-.:?') assert.ok(R.GLIF[ch] && R.GLIF[ch].length, ch);
  assert.ok(R.GLIF.tik.length);
});

test('darbeler 10×14 kutusunda (en çok 1 birim taşma)', () => {
  for (const [ch, darbeler] of Object.entries(R.GLIF)) {
    for (const d of darbeler) {
      assert.ok(['L', 'C', 'E'].includes(d[0]), `${ch}: bilinmeyen darbe ${d[0]}`);
      if (d[0] === 'C') assert.ok(d[1].length >= 3, `${ch}: eğri en az 3 nokta`);
      for (const [x, y] of noktalar(d)) {
        assert.ok(x >= -1 && x <= 11 && y >= -1 && y <= 15, `${ch}: (${x}, ${y}) kutu dışında`);
      }
    }
  }
});

test('genişlik: boşluk ve dar glifler hesaba katılır, eksi işareti tanınır', () => {
  assert.ok(R.genislik('11', 14) < R.genislik('00', 14));
  assert.equal(R.genislik('+1 −2', 14), R.genislik('+1 -2', 14));
  assert.deepEqual(R.parcala('+1 −2'), ['+', '1', ' ', '-', '2']);
  assert.deepEqual(R.parcala('tik'), ['tik']);
});
