const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry.js');
const puzzles = require('../puzzles/catalog.js');
const rectangle = puzzles.find(p => p.id === 'dikdortgen').solutions[0];
const target = G.deriveTarget(rectangle);
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('tüm örnek çözümler hedef kaplama kontrolünü geçer', () => {
  for (const puzzle of puzzles) {
    const solution = puzzle.solutions[0];
    const result = G.evaluatePlacement(solution, G.deriveTarget(solution));
    assert.equal(result.complete, true, puzzle.id);
    near(result.outside, 0); near(result.uncovered, 0); near(result.overlap, 0);
  }
});

test('kenar teması serbest; iç çakışma ve eksik parça başarı değildir', () => {
  assert.equal(G.evaluatePlacement(rectangle, target).complete, true);
  const overlapping = rectangle.map(p => p.pieceId === 'large-b' ? { ...rectangle[0], pieceId: 'large-b' } : p);
  assert.ok(G.evaluatePlacement(overlapping, target).overlap > 1);
  assert.equal(G.evaluatePlacement(overlapping, target).complete, false);
  assert.equal(G.evaluatePlacement(rectangle.slice(1), target).complete, false);
  assert.equal(G.evaluatePlacement([], target).complete, false);
});

test('eş üçgenleri değiştirme ve gerçekten farklı bir bölünme kabul edilir', () => {
  const swapped = rectangle.map(p => ({ ...p, pieceId:
    p.pieceId === 'large-a' ? 'large-b' : p.pieceId === 'large-b' ? 'large-a' : p.pieceId }));
  assert.equal(G.evaluatePlacement(swapped, target).complete, true);
  // Sağdaki 2×2 kareyi öteki çaprazdan bölen iki büyük üçgen.
  const alternate = rectangle.map(p => p.pieceId === 'large-a'
    ? { ...p, x: 10 / 3, y: 2 / 3, rotation: 2 }
    : p.pieceId === 'large-b' ? { ...p, x: 8 / 3, y: 4 / 3, rotation: 6 } : p);
  assert.notDeepEqual(alternate, rectangle);
  assert.equal(G.evaluatePlacement(alternate, target).complete, true);
});

test('toleransın iki tarafındaki boşluk ve taşma ayrılır', () => {
  const shifted = dx => rectangle.map(p => ({ ...p, x: p.x + dx }));
  const accepted = G.evaluatePlacement(shifted(1e-6), target);
  assert.equal(accepted.complete, true);
  const rejected = G.evaluatePlacement(shifted(1e-4), target);
  assert.equal(rejected.complete, false);
  assert.ok(rejected.outside > G.COMPLETION_EPSILON);
  assert.ok(rejected.uncovered > G.COMPLETION_EPSILON);
});

test('hedef deliği dolu kalamaz; eş alan tek başına yeterli değildir', () => {
  // Saf Boolean testi: aynı alanlı, delikli yapay hedef; kataloğa dahil değil.
  const outer = [[0, 0], [4, 0], [4, 2], [0, 2]];
  const hole = [[1, .5], [1.5, .5], [1.5, 1], [1, 1]];
  const extra = [[4, 0], [4.5, 0], [4.5, .5], [4, .5]];
  const holed = [[outer, hole], [extra]];
  near(G.area(holed), 8);
  const result = G.evaluatePlacement(rectangle, holed);
  assert.equal(result.complete, false);
  near(result.outside, .25); near(result.uncovered, .25);
  assert.equal(holed[0].length, 2);
});

test('alan ölçümleri ekran ölçeği almaz; öteleme ve dönüş sonucu değiştirmez', () => {
  for (let rotation = 0; rotation < 8; rotation++) {
    const [c, s] = G.rotations[rotation];
    const moved = rectangle.map(p => ({ ...p, x: p.x * c - p.y * s + 5.123,
      y: p.x * s + p.y * c - 2.456, rotation: (p.rotation + rotation) % 8 }));
    assert.equal(G.evaluatePlacement(moved, G.deriveTarget(moved)).complete, true);
  }
});

test('köşe/kenar teması alan çakışması oluşturmaz; sınırı aşınca oluşturur', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  near(G.intersectionArea(square, [[1, 0], [2, 0], [2, 1], [1, 1]]), 0);
  near(G.intersectionArea(square, [[1, 1], [2, 1], [2, 2], [1, 2]]), 0);
  near(G.intersectionArea(square, [[.9, 0], [2, 0], [2, 1], [.9, 1]]), .1);
});

test('bozuk pozlar ve sayısal olmayan alanlar başarı üretmez', () => {
  for (const bad of [null, {}, [null], rectangle.map((p, i) => i ? p : { ...p, x: NaN })]) {
    assert.equal(G.evaluatePlacement(bad, target).complete, false);
  }
});
