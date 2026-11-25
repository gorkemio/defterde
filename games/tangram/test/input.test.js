const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const G = require('../geometry.js'), B = require('../board.js');
const puzzle = require('../puzzles/catalog.js').find(p => p.id === 'dikdortgen');

// Gerçek board/geometri, yalnız DOM ve ekran matrisi için küçük bellek sahnesi.
function harness() {
  const board = B.create(puzzle), layout = B.layout(board.target, 390, board.pieces);
  const listeners = new Map(), keys = new Map(), frames = new Map(), captures = new Set();
  const group = { focus() {}, dataset: {} };
  const svg = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    getScreenCTM: () => ({ inverse: () => ({}) }),
    getBoundingClientRect: () => ({ width: layout.width }),
    querySelector: () => group, classList: { add() {}, remove() {} },
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  let serial = 0, moves = [], changed = 0, preview = false;
  const window = { Tangram: { geometry: G, board: B, draw: {
    displayPose: (p, l) => p.zone === 'tray' ? { ...p, ...l.slots[p.pieceId] } : p,
  } }, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../input.js'), 'utf8'), {
    window, document: { addEventListener: (name, fn) => keys.set(name, fn) },
    DOMPoint: class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } },
    requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const input = window.Tangram.input.attach(svg, {
    context: () => ({ board, layout, preview }),
    changed: () => changed++, moving: (...args) => moves.push(args), message() {},
  });
  const event = (point, extra = {}) => ({ clientX: point[0], clientY: point[1], pointerId: 1,
    pointerType: 'touch', button: 0, isPrimary: true, timeStamp: 10, preventDefault() {}, ...extra });
  function emit(name, p, extra) {
    listeners.get(name)?.(event(p, extra));
    if (name === 'pointermove') { for (const fn of frames.values()) fn(); frames.clear(); }
  }
  return { board, layout, input, emit, captures, get moves() { return moves; }, get changed() { return changed; },
    at: (id, dx = 0, dy = 0) => layout.toScreen({ ...layout.slots[id], x: layout.slots[id].x + dx, y: layout.slots[id].y + dy }),
    key: (key, extra = {}) => keys.get('keydown')({ key, target: { closest: () => null }, preventDefault() {}, ...extra }),
    preview: value => { preview = value; } };
}

test('dokunma sürüklemesi tutulan noktayı korur; tek işlem olur', () => {
  const h = harness(), start = h.at('large-a', .1, .1);
  const end = h.layout.toScreen({ x: -.3, y: -.9 });
  h.emit('pointerdown', start);
  h.emit('pointermove', end);
  assert.equal(h.moves.at(-1)[3].pointerType, 'touch');
  assert.equal(h.board.history.length, 0);
  h.emit('pointerup', end);
  assert.ok(Math.abs(h.board.current().x + .4) < 1e-7);
  assert.ok(Math.abs(h.board.current().y + 1) < 1e-7);
  assert.equal(h.board.history.length, 1);
  assert.equal(h.captures.size, 0);
  h.board.undo();
  assert.equal(h.board.current().zone, 'tray');
});

test('fareyle tıkla al, basılı tutmadan taşı, tekrar tıkla bırak tek geri alma adımıdır', () => {
  const h = harness(), start = h.at('square'), end = h.layout.toScreen({ x: 2, y: 1 });
  const mouse = { pointerType: 'mouse' };
  h.emit('pointerdown', start, mouse); h.emit('pointerup', start, mouse);
  h.emit('pointermove', end, { ...mouse, buttons: 0 });
  assert.equal(h.board.current().zone, 'board');
  assert.ok(Math.abs(h.board.current().x - 2) < 1e-8);
  assert.equal(h.board.history.length, 0);
  assert.equal(h.captures.size, 0);
  h.emit('pointerdown', end, mouse); h.emit('pointerup', end, mouse);
  assert.equal(h.board.history.length, 1);
  const placed = h.board.snapshot();
  h.emit('pointermove', start, mouse);
  assert.deepEqual(h.board.snapshot(), placed);
  h.input.action('undo');
  assert.equal(h.board.current().zone, 'tray');
});

test('sürüklerken döndürmek parçayı geri götürmez, merkez ve tutuş korunur', () => {
  const h = harness(), end = h.layout.toScreen({ x: 2, y: 1 });
  h.emit('pointerdown', h.at('parallelogram', .1, .1), { pointerType: 'mouse' });
  h.emit('pointermove', end, { pointerType: 'mouse' });
  const before = { ...h.board.current() };
  h.key('e');
  assert.equal(h.board.current().zone, 'board');
  assert.equal(h.board.current().x, before.x);
  assert.equal(h.board.current().y, before.y);
  assert.equal(h.board.current().rotation, (before.rotation + 1) % 8);
  h.key('f');
  assert.equal(h.board.current().flipped, true);
  h.emit('pointerup', end, { pointerType: 'mouse' });
  assert.equal(h.board.history.length, 1);
  h.input.action('undo'); assert.equal(h.board.current().zone, 'tray');
});

test('eldeki parçanın trackpad hareketi tek açı atlar; momentum ve pinch onu savurmaz', () => {
  const h = harness(), mouse = { pointerType: 'mouse' }, start = h.at('small-a');
  h.emit('pointerdown', start, mouse); h.emit('pointerup', start, mouse);
  const end = h.layout.toScreen({ x: 2, y: 1 });
  h.emit('pointermove', end, mouse);
  const rotation = h.board.current().rotation;
  for (let i = 0; i < 10; i++) h.emit('wheel', end, { deltaY: 6, deltaMode: 0, timeStamp: 100+i*20 });
  assert.equal(h.board.current().rotation, (rotation+1)%8);
  h.emit('wheel', end, { deltaY: -40, deltaMode: 0, timeStamp: 600 });
  assert.equal(h.board.current().rotation, rotation);
  h.emit('wheel', end, { deltaY: 100, ctrlKey: true, timeStamp: 900 });
  assert.equal(h.board.current().rotation, rotation);
  h.key('Escape');
  assert.equal(h.board.current().zone, 'tray');
  assert.equal(h.board.history.length, 0);
});

test('sağ tık yerindeki parçayı döndürür; boş alanda sayfa menüsünü engellemez', () => {
  const h = harness(), start = h.at('square');
  let prevented = 0;
  h.emit('contextmenu', start, { preventDefault: () => prevented++ });
  assert.equal(h.board.selected, 'square');
  assert.equal(h.board.current().rotation, 1);
  h.emit('contextmenu', start, { shiftKey: true, preventDefault: () => prevented++ });
  assert.equal(h.board.current().rotation, 0);
  h.emit('contextmenu', [-100,-100], { preventDefault: () => prevented++ });
  assert.equal(prevented, 2);
});

test('normal kaydırma serbesttir; eldeyken sağ tık bırakmaz ve geri al yalnız taşımayı iptal eder', () => {
  const h = harness(), mouse = { pointerType: 'mouse' }, start = h.at('square');
  h.key('6'); h.key('e');
  const saved = h.board.snapshot(), history = h.board.history.length;
  let prevented = false;
  h.emit('wheel', start, { deltaY: 60, timeStamp: 1, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  h.emit('pointerdown', start, mouse); h.emit('pointerup', start, mouse);
  h.emit('pointermove', h.layout.toScreen({ x: 2, y: 1 }), mouse);
  h.emit('contextmenu', start);
  h.emit('pointerup', start, { ...mouse, button: 2 });
  assert.equal(h.board.history.length, history);
  assert.equal(h.input.carrying(), true);
  h.input.action('undo');
  assert.deepEqual(h.board.snapshot(), saved);
  assert.equal(h.board.history.length, history);
});

test('hizalanan parça hareket sırasında gerçek bırakılacak yerde görünür', () => {
  const h = harness(), pose = puzzle.solutions[0].find(p => p.pieceId === 'square');
  h.board.select('square'); h.board.rotate(pose.rotation);
  const p = h.layout.toScreen({ x: pose.x - 4/h.layout.scale, y: pose.y });
  h.emit('pointerdown', h.at('square'));
  h.emit('pointermove', p);
  const [display, snap] = h.moves.at(-1);
  assert.equal(snap.snapped, true);
  assert.equal(display.x, snap.pose.x);
  assert.equal(display.y, snap.pose.y);
  h.emit('pointerup', p);
  assert.equal(h.board.current().x, display.x);
  assert.equal(h.board.current().y, display.y);
});

test('kenarından tutulan parça merkezi tahtadayken imleç tepsiye geçse de geri atılmaz', () => {
  const h = harness(), start = h.at('large-a', 0, .5);
  const end = h.layout.toScreen({ x: 2, y: h.layout.bounds.maxY - .1 + .5 });
  assert.ok(end[1] > h.layout.separatorY);
  h.emit('pointerdown', start);
  h.emit('pointermove', end);
  h.emit('pointerup', end);
  assert.equal(h.board.current().zone, 'board');
});

test('pointercancel ve Escape hareket öncesi poza döner', () => {
  for (const cancelKind of ['pointercancel', 'Escape']) {
    const h = harness(), initial = h.board.snapshot();
    h.emit('pointerdown', h.at('parallelogram'));
    h.emit('pointermove', h.layout.toScreen({ x: 1, y: 1 }));
    if (cancelKind === 'Escape') h.key('Escape');
    else h.emit('pointercancel', [0, 0]);
    assert.deepEqual(h.board.pieces, initial.pieces);
    assert.equal(h.board.history.length, 0);
    assert.equal(h.captures.size, 0);
  }
});

test('parça seçip boş yere dokunma merkezden yerleştirir, kaydırma yerleştirmez', () => {
  const h = harness(), square = h.at('square');
  h.emit('pointerdown', square); h.emit('pointerup', square);
  const target = h.layout.toScreen({ x: 2, y: 1 });
  h.emit('pointerdown', target); h.emit('pointerup', target);
  assert.equal(h.board.current().zone, 'board');
  assert.equal(h.board.current().x, 2);
  assert.ok(Math.abs(h.board.current().y - 1) < 1e-8);
  const saved = h.board.snapshot();
  h.emit('pointerdown', h.layout.toScreen({ x: -.8, y: -1 }));
  h.emit('pointermove', h.layout.toScreen({ x: -.8, y: -.2 }));
  h.emit('pointerup', h.layout.toScreen({ x: -.8, y: -.2 }));
  assert.deepEqual(h.board.snapshot(), saved);
});

test('ikinci parmak sürüklemeyi ele geçiremez; tepsiye bırakma ve geri alma', () => {
  const h = harness(), original = h.at('square');
  h.emit('pointerdown', original);
  h.emit('pointerdown', h.at('large-a'), { pointerId: 2, isPrimary: false });
  h.emit('pointermove', h.layout.toScreen({ x: 2, y: 1 }));
  h.emit('pointerup', h.layout.toScreen({ x: 2, y: 1 }));
  assert.equal(h.board.selected, 'square');
  h.emit('pointerdown', h.layout.toScreen(h.board.current()));
  h.emit('pointermove', original);
  h.emit('pointerup', original);
  assert.equal(h.board.current().zone, 'tray');
  h.board.undo();
  assert.equal(h.board.current().zone, 'board');
});

test('üst üste duran parçalar tekrar dokunmayla seçilebilir', () => {
  const h = harness();
  for (const id of ['square', 'parallelogram']) {
    h.board.select(id); h.board.place({ ...h.board.current(), zone: 'board', x: 2, y: 1 });
  }
  const p = h.layout.toScreen({ x: 2, y: 1 });
  h.emit('pointerdown', p, { timeStamp: 100 }); h.emit('pointerup', p, { timeStamp: 110 });
  const first = h.board.selected;
  h.emit('pointerdown', p, { timeStamp: 200 }); h.emit('pointerup', p, { timeStamp: 210 });
  assert.notEqual(h.board.selected, first);
});

test('klavye ince taşıma; metin alanı ve çözüm önizlemesi oyuncuyu değiştirmez', () => {
  const h = harness();
  h.key('6'); h.key('ArrowRight');
  const before = h.board.current().x;
  h.key('ArrowLeft', { shiftKey: true });
  assert.ok(Math.abs(h.board.current().x - before + .01) < 1e-8);
  const saved = h.board.snapshot();
  h.key('e', { target: { closest: () => ({ tagName: 'INPUT' }) } });
  assert.deepEqual(h.board.snapshot(), saved);
  h.preview(true);
  h.key('f'); h.emit('pointerdown', h.at('large-a')); h.emit('pointerup', h.at('large-a'));
  assert.deepEqual(h.board.snapshot(), saved);
});

test('Enter veya erişilebilirlik tıklamasıyla seçim eldeki taşıma işlemini kapatır', () => {
  for (const method of ['Enter', ' ', 'click']) {
    const h = harness(), before = h.board.snapshot(), start = h.at('square');
    const mouse = { pointerType: 'mouse' };
    h.emit('pointerdown', start, mouse); h.emit('pointerup', start, mouse);
    h.emit('pointermove', h.layout.toScreen({ x: 2, y: 1 }), mouse);
    const target = { closest: selector => selector === '[data-piece]' ? { dataset: { piece: 'small-a' } } : null };
    if (method === 'click') h.emit('click', start, { detail: 0, target });
    else h.key(method, { target });
    assert.equal(h.input.carrying(), false);
    assert.equal(h.board.transaction, null);
    assert.equal(h.board.selected, 'small-a');
    assert.deepEqual(h.board.pieces, before.pieces);
    h.key('e');
    assert.equal(h.board.current().rotation, 7);
    assert.equal(h.board.history.length, 1);
    h.input.action('undo');
    assert.deepEqual(h.board.pieces, before.pieces);
  }
});

test('yakalama kaybı aktif sürüklemeyi iptal eder; tıkla taşımayı kesmez', () => {
  const drag = harness(), before = drag.board.snapshot();
  drag.emit('pointerdown', drag.at('square'));
  drag.emit('pointermove', drag.layout.toScreen({ x: 2, y: 1 }));
  drag.emit('lostpointercapture', [0, 0]);
  assert.equal(drag.board.transaction, null);
  assert.deepEqual(drag.board.pieces, before.pieces);
  assert.equal(drag.board.history.length, 0);

  const carry = harness(), start = carry.at('square'), mouse = { pointerType: 'mouse' };
  carry.emit('pointerdown', start, mouse); carry.emit('pointerup', start, mouse);
  carry.emit('lostpointercapture', start, mouse);
  assert.equal(carry.input.carrying(), true);
  assert.ok(carry.board.transaction);
  carry.key('Escape');
  assert.equal(carry.board.transaction, null);
});

test('başka işaretçinin iptali veya yakalama kaybı ana sürüklemeyi kesmez', () => {
  for (const kind of ['pointercancel', 'lostpointercapture']) {
    const h = harness();
    h.emit('pointerdown', h.at('square'));
    h.emit('pointermove', h.layout.toScreen({ x: 2, y: 1 }));
    const current = h.board.snapshot();
    h.emit(kind, [0, 0], { pointerId: 2, isPrimary: false });
    assert.ok(h.board.transaction);
    assert.deepEqual(h.board.snapshot(), current);
    h.emit('pointerup', h.layout.toScreen(h.board.current()));
    assert.equal(h.board.history.length, 1);
  }
});
