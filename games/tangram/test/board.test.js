const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry.js');
const B = require('../board.js');
const puzzle = require('../puzzles/catalog.js').find(p => p.id === 'dikdortgen');

test('bir sürükleme tek geri alma adımı; iptal başlangıcı aynen geri getirir', () => {
  const board = B.create(puzzle), before = board.snapshot();
  board.select('large-a');
  board.begin();
  for (let i = 0; i < 40; i++) board.preview({ ...board.pieces[0], zone: 'board', x: i / 10, y: 1 });
  board.commit();
  assert.equal(board.history.length, 1);
  assert.equal(board.undo(), true);
  assert.deepEqual(board.pieces, before.pieces);
  board.begin(); board.preview({ ...board.pieces[0], zone: 'board', x: 2, y: 2 }); board.cancel();
  assert.deepEqual(board.pieces, before.pieces);
  assert.equal(board.history.length, 0);
});

test('dönüş ve iki çevirme merkez değiştirmez; kare çevrilemez', () => {
  const board = B.create(puzzle);
  board.select('parallelogram');
  board.place({ ...board.current(), zone: 'board', x: 1.2, y: -2.4 });
  const start = { ...board.current() };
  for (let i = 0; i < 8; i++) board.rotate(1);
  board.flip(); board.flip();
  assert.deepEqual(board.current(), start);
  board.select('square');
  assert.equal(board.flip(), false);
});

test('baştan tek adımda geri alınabilir; tepsi parçası tamamlanmaya sayılmaz', () => {
  const board = B.create(puzzle);
  for (const pose of puzzle.solutions[0]) { board.select(pose.pieceId); board.place({ ...pose, zone: 'board' }); }
  assert.equal(board.result.complete, true);
  const solved = board.snapshot();
  board.reset();
  assert.equal(board.result.complete, false);
  assert.ok(board.pieces.every(p => p.zone === 'tray'));
  board.undo();
  assert.deepEqual(board.pieces, solved.pieces);
  assert.equal(board.result.complete, true);
  board.returnToTray();
  assert.equal(board.result.complete, false);
});

test('seçim ve gerçek değişiklik olmayan işlemler geri alma geçmişini doldurmaz', () => {
  const board = B.create(puzzle);
  board.select('small-a');
  board.place({ ...board.current() });
  board.begin(); board.commit();
  assert.equal(board.history.length, 0);
  assert.equal(board.undo(), false);
});

test('hizalama yakın köşeye gider, eşik dışında gitmez, ekran ölçeğine göre aynı px', () => {
  const pose = puzzle.solutions[0].find(p => p.pieceId === 'square');
  const target = G.deriveTarget(puzzle.solutions[0]);
  for (const scale of [25, 50, 100]) {
    const near = { ...pose, x: pose.x - 6 / scale };
    const snapped = B.snap(near, [], target, { scale, pointerType: 'mouse' });
    assert.equal(snapped.snapped, true);
    assert.ok(Math.abs(snapped.pose.x - pose.x) < 1e-7);
    const far = B.snap({ ...pose, x: pose.x - 16 / scale, y: pose.y - .23 }, [], target, { scale, pointerType: 'mouse' });
    assert.ok(!far.snapped || Math.hypot(far.pose.x - (pose.x - 16 / scale), far.pose.y - (pose.y - .23)) <= 10 / scale);
  }
  const p = { pieceId: 'square', x: 20, y: 20, rotation: 0, flipped: false };
  assert.equal(B.snap(p, [], target, { scale: 40 }).snapped, false);
});

test('dokunma eşiği 14px, fare 10px; kenar ortasına hizalama yapılır', () => {
  const emptyTarget = [];
  const reference = { pieceId: 'large-a', x: 2 / 3, y: 2 / 3, rotation: 0, flipped: false };
  const pose = { pieceId: 'square', x: .9, y: -.5 - 12 / 100, rotation: 0, flipped: false };
  assert.equal(B.snap(pose, [reference], emptyTarget, { scale: 100, pointerType: 'mouse' }).snapped, false);
  const touch = B.snap(pose, [reference], emptyTarget, { scale: 100, pointerType: 'touch' });
  assert.equal(touch.snapped, true);
  assert.ok(Math.abs(touch.pose.y + .5) < 1e-7);
});

test('hizalama küçük bırakma titremesinde tutunur, 14px dışında serbest kalır', () => {
  const target = [[[[0,0],[4,0],[4,2],[0,2],[0,0]]]];
  const p = { pieceId: 'square', x: .53, y: .54, rotation: 0, flipped: false };
  const first = B.snap(p, [], target, { scale: 100 });
  assert.equal(first.snapped, true);
  const retained = B.snap({ ...p, x: .61, y: .54 }, [], target, { scale: 100, previous: first });
  assert.equal(retained.pose.x, .5);
  assert.equal(retained.pose.y, .5);
  const released = B.snap({ ...p, x: .68, y: .54 }, [], target, { scale: 100, previous: first });
  assert.notEqual(released.pose.x, .5);
});

test('önceki hizalama yeni dönüşe veya sonradan dolan alana uygulanmaz', () => {
  const target = [[[[0,0],[4,0],[4,2],[0,2],[0,0]]]];
  const p = { pieceId: 'square', x: .53, y: .54, rotation: 0, flipped: false };
  const first = B.snap(p, [], target, { scale: 100 });
  const rotated = B.snap({ ...p, rotation: 1 }, [], target, { scale: 100, previous: first });
  assert.equal(rotated.pose.rotation, 1);
  const occupied = B.snap(p, [first.pose], target, { scale: 100, previous: first });
  assert.equal(occupied.snapped, false);
});

test('hizalama çakışma üretemez ve gizli çözüm verisi almaz', () => {
  const square = { pieceId: 'square', x: .5, y: .5, rotation: 0, flipped: false };
  const triangle = { pieceId: 'small-a', x: .34, y: .34, rotation: 0, flipped: false };
  const snap = B.snap(triangle, [square], [], { scale: 50 });
  assert.equal(snap.snapped, false);
  assert.deepEqual(snap.pose, triangle);
});

test('iki farklı kenar kısıtı birlikte kesin köşe yerleşimi verir', () => {
  const p = { pieceId: 'square', x: .53, y: .54, rotation: 0, flipped: false };
  const target = [[[[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]]]];
  const snap = B.snap(p, [], target, { scale: 50 });
  assert.equal(snap.snapped, true);
  assert.ok(Math.abs(snap.pose.x - .5) < 1e-7);
  assert.ok(Math.abs(snap.pose.y - .5) < 1e-7);
});

test('boyut değişikliği mantıksal pozlara dokunmaz; hedef ve tepsi aynı ölçekte', () => {
  const board = B.create(puzzle);
  for (const p of puzzle.solutions[0]) { board.select(p.pieceId); board.place({ ...p, zone: 'board' }); }
  const original = board.snapshot();
  for (const width of [256, 296, 326, 366, 1019]) {
    const layout = B.layout(board.target, width, board.pieces);
    const screen = layout.toScreen(board.current()), back = layout.toLogical(...screen);
    assert.ok(Math.abs(back.x - board.current().x) < 1e-8);
    assert.ok(Math.abs(back.y - board.current().y) < 1e-8);
    for (const p of board.pieces) {
      const slot = layout.slots[p.pieceId];
      assert.ok(Number.isFinite(slot.x) && Number.isFinite(slot.y));
    }
    assert.deepEqual(board.snapshot(), original);
    assert.equal(board.result.complete, true);
  }
});

test('tahtadaki parçayı döndürmek tepsidekilerin yerini oynatmaz', () => {
  const board = B.create(puzzle);
  board.select('large-a');
  board.rotate(1);
  board.place({ ...board.current(), zone: 'board', x: 2, y: 1 });
  const slots = B.layout(board.target, 326, board.pieces).slots;
  board.rotate(1);
  assert.deepEqual(B.layout(board.target, 326, board.pieces).slots, slots);
});

test('defter tepsisi iki ayrı sırada sığar; hedef ortalanır ve parça ölçüsü korunur', () => {
  const board = B.create(puzzle), original = board.snapshot();
  for (const width of [550, 650, 800]) {
    const layout = B.layout(board.target, width, board.pieces, { twoRowTray: true, centerTarget: true });
    const target = G.bounds(board.target.flat(2).map(([x, y]) => layout.toScreen({ x, y })));
    assert.ok(Math.abs(target.minX + target.width / 2 - width / 2) < 1e-8);
    const boxes = board.pieces.map(pose => {
      const vertices = G.transformPiece({ ...pose, ...layout.slots[pose.pieceId] });
      const box = G.bounds(vertices.map(([x, y]) => layout.toScreen({ x, y })));
      assert.ok(box.minX >= 0 && box.maxX <= width);
      assert.ok(box.minY > layout.separatorY && box.maxY < layout.height);
      const logicalBox = G.bounds(vertices);
      assert.ok(Math.abs(box.width / logicalBox.width - layout.scale) < 1e-8);
      return box;
    });
    assert.ok(Math.max(...boxes.slice(0, 3).map(b => b.maxY)) < Math.min(...boxes.slice(3).map(b => b.minY)));
    assert.deepEqual(board.snapshot(), original);
  }
});

test('kompakt oyun 120 hedefi mevcut yüksekliğe ortak ölçekte sığdırır', () => {
  const puzzles = require('../puzzles/catalog.js');
  for (const puzzle of puzzles) {
    const board = B.create(puzzle), before = board.snapshot();
    for (const [width, maxHeight] of [[884, 410], [884, 510], [342, 460], [272, 400]]) {
      const layout = B.layout(board.target, width, board.pieces, { compact: true, centerTarget: true, maxHeight });
      assert.ok(layout.height <= maxHeight + 1e-6, `${puzzle.id}: ${width} × ${maxHeight} (${layout.height})`);
      assert.ok(layout.scale >= Math.min(24, (width - 14) / Math.max(7.2, G.bounds(board.target.flat(2)).width + 1)) - 1e-8);
      const target = G.bounds(board.target.flat(2).map(([x, y]) => layout.toScreen({ x, y })));
      assert.ok(target.minX >= 0 && target.maxX <= width);
      assert.ok(target.minY >= 0 && target.maxY < layout.separatorY);
      const boxes = board.pieces.map(pose => {
        const vertices = G.transformPiece({ ...pose, ...layout.slots[pose.pieceId] });
        const box = G.bounds(vertices.map(([x, y]) => layout.toScreen({ x, y })));
        assert.ok(box.minX >= 0 && box.maxX <= width);
        assert.ok(box.minY > layout.separatorY && box.maxY < layout.height);
        assert.ok(Math.abs(box.width / G.bounds(vertices).width - layout.scale) < 1e-8);
        return box;
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        assert.ok(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY);
      }
      assert.deepEqual(board.snapshot(), before);
    }
  }
});

test('çok kısa ekranda parçayı aşırı küçültmek yerine doğal kaydırma kalır', () => {
  const board = B.create(puzzle);
  const layout = B.layout(board.target, 320, board.pieces, { compact: true, maxHeight: 100 });
  assert.equal(layout.scale, 24);
  assert.ok(layout.height > 100);
  for (const pose of board.pieces) assert.ok(layout.toScreen(layout.slots[pose.pieceId])[1] < layout.height);
});
