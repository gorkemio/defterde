const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry.js');
const puzzles = require('../puzzles/catalog.js');
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);

test('kanonik set yedi parça, alanlar 4:4:2:1:1:2:2', () => {
  assert.equal(G.pieces.length, 7);
  assert.deepEqual(G.pieces.map(p => G.ringArea(p.vertices) * 2).map(n => Math.round(n)), [4, 4, 2, 1, 1, 2, 2]);
  close(G.pieces.reduce((sum, p) => sum + G.ringArea(p.vertices), 0), 8);
});

test('dönüşler kenarları korur ve sekiz adımda başlangıca döner', () => {
  for (const piece of G.pieces) {
    const start = { pieceId: piece.id, x: 1.37, y: -2.12, rotation: 0, flipped: false };
    const initial = G.transformPiece(start);
    for (let step = 0; step <= 8; step++) {
      const vertices = G.transformPiece({ ...start, rotation: step % 8 });
      close(G.ringArea(vertices), piece.area);
      vertices.forEach((p, i) => {
        const q = vertices[(i + 1) % vertices.length];
        const a = initial[i], b = initial[(i + 1) % initial.length];
        close(Math.hypot(p[0] - q[0], p[1] - q[1]), Math.hypot(a[0] - b[0], a[1] - b[1]));
      });
    }
    assert.deepEqual(G.transformPiece({ ...start, rotation: 8 % 8 }), initial);
  }
});

test('120 şeklin her biri yedi parçayla bağlantılı ve çakışmasızdır', () => {
  assert.equal(puzzles.length, 120);
  assert.equal(new Set(puzzles.map(p => p.id)).size, 120);
  for (const puzzle of puzzles) {
    const result = G.validateLayout(puzzle.solutions[0]);
    assert.equal(result.valid, true, `${puzzle.id}: ${result.errors.join(', ')}`);
    close(result.area, 8);
    close(result.overlap, 0);
    assert.equal(puzzle.reviewStatus, 'pending', 'İsimsiz onay alınmadan kabul edilmiş sayılmaz.');
  }
});

test('ortak 45° kenarlar ve köşe temasları tüm sekiz yönde çalışır', () => {
  for (const puzzle of puzzles) for (let step = 0; step < 8; step++) {
    const [c, s] = G.rotations[step];
    const poses = puzzle.solutions[0].map(p => ({
      ...p, rotation: (p.rotation + step) % 8,
      x: p.x * c - p.y * s + 13.25, y: p.x * s + p.y * c - 5.75,
    }));
    const result = G.validateLayout(poses);
    assert.equal(result.valid, true, `${puzzle.id}, dönüş ${step}: ${result.errors.join(', ')}`);
  }
});

test('eksik, tekrarlanan, esnetilen ve izin verilmeyen pozlar reddedilir', () => {
  const valid = puzzles[0].solutions[0];
  assert.equal(G.validateLayout(valid.slice(1)).valid, false);
  assert.equal(G.validateLayout([...valid.slice(0, 6), valid[0]]).valid, false);
  for (const extra of [{ scale: 1.2 }, { rotation: 1.5 }, { flipped: true }, { x: NaN }]) {
    assert.equal(G.validateLayout(valid.map((p, i) => i ? p : { ...p, ...extra })).valid, false);
  }
});

test('iç çakışma ve kopuk yerleşim yakalanır', () => {
  const poses = puzzles.find(p => p.id === 'dikdortgen').solutions[0];
  const overlap = poses.map(p => p.pieceId === 'large-b' ? { ...poses[0], pieceId: 'large-b' } : p);
  assert.equal(G.validateLayout(overlap).valid, false);
  const detached = poses.map(p => p.pieceId === 'small-a' ? { ...p, x: p.x + 20 } : p);
  assert.ok(G.validateLayout(detached).errors.includes('Yerleşim bağlantılı değil.'));
});

test('eş üçgenlerin kimlikleri yer değiştirebilir', () => {
  const poses = puzzles[0].solutions[0].map(p => ({ ...p, pieceId:
    p.pieceId === 'large-a' ? 'large-b' : p.pieceId === 'large-b' ? 'large-a'
      : p.pieceId === 'small-a' ? 'small-b' : p.pieceId === 'small-b' ? 'small-a' : p.pieceId }));
  assert.equal(G.validateLayout(poses).valid, true);
});
