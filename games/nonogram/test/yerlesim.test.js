const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../ui/yerlesim.js');
const M = require('../nonogram/model.js');
const O = require('./ornekler.js');

function bos(en, boy) { const s = []; for (let r = 0; r < boy; r++) s.push(Array.from({ length: en }, (_, c) => ((r * 7 + c * 3) % 5 < 2 ? '#' : '.')).join('')); return M.bulmacaYap({ en, boy, satirlar: s }); }

test('Y1 375 px telefonda varsayılan yakınlıkta kare ≥ 28 px', () => {
  for (const [en, boy] of [[5, 5], [10, 10], [15, 15], [20, 20], [25, 25], [10, 15]]) {
    const b = bos(en, boy), bn = Y.bantlar(b), y = Y.yerlesim({ vw: 375, vh: 667, en, boy, ...bn, dokunmatik: true });
    assert.equal(y.duzen, 'dikey');
    assert.ok(y.sq * y.s0 >= 28 - 1e-9, `${en}×${boy}: ${y.sq * y.s0}`);
    assert.ok(y.Wsq * y.sq <= 375);
    assert.ok(y.smin <= y.s0 && y.s0 <= y.smax);
  }
});

test('Y2 15×15\'ten büyükler telefonda yakınlaştırılmış başlar; 5×5 bütünüyle görünür', () => {
  const b = bos(20, 20), y = Y.yerlesim({ vw: 390, vh: 844, en: 20, boy: 20, ...Y.bantlar(b), dokunmatik: true });
  assert.ok(y.s0 > y.smin, 'yakın başlar');
  const k = bos(5, 5), yk = Y.yerlesim({ vw: 390, vh: 844, en: 5, boy: 5, ...Y.bantlar(k), dokunmatik: true });
  assert.equal(yk.s0, yk.smin, 'bütünü sığar');
});

test('Y3 bant genişlikleri ipuçlarına göre', () => {
  const b = M.bulmacaYap({ en: 10, boy: 10, satirlar: O.ev10 }), bn = Y.bantlar(b);
  assert.ok(bn.Lw >= 2 && bn.Lw <= 5, `Lw ${bn.Lw}`);
  assert.ok(bn.Lh >= 2 && bn.Lh <= 4, `Lh ${bn.Lh}`);
  const genis = Y.yerlesim({ vw: 1440, vh: 900, en: 25, boy: 25, Lw: 8, Lh: 7, dokunmatik: false });
  assert.equal(genis.duzen, 'defter');
  assert.ok(genis.Hsq * genis.sq <= 900 && genis.Wsq * genis.sq <= 1440);
  assert.equal(genis.s0, 1);
});
