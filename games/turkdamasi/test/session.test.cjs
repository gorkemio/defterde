const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fixtures = require('./fixtures/tudaf.cjs');
const scope = vm.createContext({ performance, setTimeout, AbortController });
for (const file of ['board.js', 'session.js', 'layout.js']) {
  const source = file === 'session.js' && process.env.SESSION_TEST_SOURCE
    ? process.env.SESSION_TEST_SOURCE : path.join(__dirname, '..', file);
  vm.runInContext(fs.readFileSync(source, 'utf8'), scope);
}
const B = scope.TD.board, S = scope.TD.session, L = scope.TD.layout;
const sq = s => 'abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1);
const json = x => JSON.parse(JSON.stringify(x));
function position(f) {
  const cells = Array(64).fill(0);
  for (const [list, piece] of [[f.blue, 1], [f.red, -1], [f.blueKings, 2], [f.redKings, -2]]) {
    for (const s of (list || '').split(' ').filter(Boolean)) cells[sq(s)] = piece;
  }
  return B.position(cells, f.turn || 1);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const core = s => json([s.game, s.ids]);

test('initial session has no selection, 32 identities and a complete legal list', async () => {
  const s = S.create();
  await s.start();
  const v = s.read();
  assert.equal(v.busy, null);
  assert.equal(v.from, null);
  assert.equal(v.ids.filter(Boolean).length, 32);
  assert.equal(new Set(v.ids.filter(Boolean)).size, 32);
  assert.equal(v.legal.length, 8);
  assert(Object.isFrozen(v) && Object.isFrozen(v.ids));
});

test('every legal TÜDAF path can be chosen, with unchanged turn/history during a chain', async () => {
  for (const f of fixtures) {
    const p = position(f);
    for (const move of B.legalMoves(p)) {
      const s = S.create();
      await s.start(p);
      const before = core(s.read()), id = s.read().ids[move.from];
      await s.choose(move.from);
      for (let i = 0; i < move.landings.length; i++) {
        const v = s.read();
        assert(v.targets.includes(move.landings[i]), `TÜDAF ${f.number}, step ${i}`);
        await s.choose(move.landings[i]);
        if (i < move.landings.length - 1) {
          assert.equal(s.read().game.position, v.game.position);
          assert.equal(s.read().game.history.length, 0);
          assert.equal(s.read().position.turn, p.turn);
          assert.equal(s.read().ids[move.landings[i]], id);
        }
      }
      assert.deepEqual(json(s.read().position), json(B.applyMove(p, move)));
      assert.equal(s.read().game.history.length, 1);
      assert.equal(s.read().ids[move.landings.at(-1)], id);
      s.undo();
      assert.deepEqual(core(s.read()), before, `TÜDAF ${f.number} exact undo`);
    }
  }
});

test('selection can change before jumping; invalid moves and other pieces cannot break a chain', async () => {
  const s = S.create();
  await s.start();
  await s.choose(sq('a3'));
  await s.choose(sq('b3'));
  assert.equal(s.read().from, sq('b3'));
  await s.choose(sq('b2'));
  assert.equal(s.read().from, sq('b3'));
  await s.start(position(fixtures[0]));
  const before = core(s.read()), move = s.read().legal[0];
  await s.choose(move.from);
  await s.choose(move.landings[0]);
  const partial = s.read();
  const another = partial.position.cells.findIndex((v, i) => v > 0 && i !== partial.selected);
  await s.choose(another);
  await s.choose(-1);
  await s.choose(64);
  assert.equal(s.read().from, partial.from);
  assert.deepEqual(json(s.read().prefix), json(partial.prefix));
  s.undo();
  assert.deepEqual(core(s.read()), before);
  assert.equal(s.read().from, null);
});

test('promotion happens after the whole chain, and undo restores the same uncrowned identity', async () => {
  const s = S.create();
  await s.start(position(fixtures[6]));
  const before = core(s.read()), id = s.read().ids[sq('f6')];
  await s.choose(sq('f6'));
  await s.choose(sq('f8'));
  assert.equal(s.read().position.cells[sq('f8')], 1);
  await s.choose(sq('d8'));
  assert.equal(s.read().position.cells[sq('d8')], 2);
  assert.equal(s.read().ids[sq('d8')], id);
  s.undo();
  assert.deepEqual(core(s.read()), before);
});

test('double input is locked synchronously, and an old animation cannot survive undo/new game', async () => {
  for (const action of ['undo', 'start', 'suspend']) {
    const animation = deferred();
    let calls = 0;
    const s = S.create({ animate: () => { calls++; return animation.promise; } });
    await s.start();
    const before = core(s.read());
    await s.choose(sq('a3'));
    const pending = s.choose(sq('a4'));
    assert.equal(s.read().busy, 'animation');
    assert.equal(s.read().canUndo, true);
    await s.choose(sq('b3'));
    await s.choose(sq('b4'));
    assert.equal(calls, 1);
    await s[action]();
    animation.resolve(); // Deliberately ignores AbortSignal: task ID must reject this stale result.
    await pending;
    assert.deepEqual(core(s.read()), before, action);
    assert.equal(s.read().busy, null);
    assert.equal(s.read().error, null);
  }
});

test('undo during next-turn generation cancels the uncommitted turn, preserving the previous turn', async () => {
  const waiting = deferred();
  let held = false;
  const s = S.create({ collect: async (p, options) => {
    if (held) await waiting.promise;
    return B.collectMoves(p, options);
  } });
  await s.start();
  await s.choose(sq('a3'));
  await s.choose(sq('a4'));
  const before = core(s.read());
  held = true;
  await s.choose(sq('b6'));
  const pending = s.choose(sq('b5'));
  await Promise.resolve();
  assert.equal(s.read().busy, 'moves');
  s.undo();
  waiting.resolve();
  await pending;
  assert.deepEqual(core(s.read()), before);
  s.undo();
  assert.equal(s.read().game.history.length, 0);
});

test('late move-generation success or error from an earlier start cannot replace a new session', async () => {
  for (const fail of [false, true]) {
    const waiting = deferred();
    let calls = 0;
    const s = S.create({ collect: async p => {
      if (++calls === 1) await waiting.promise;
      return B.collectMoves(p);
    } });
    const old = s.start(position(fixtures[0]));
    await s.start();
    const before = core(s.read());
    if (fail) waiting.reject(new Error('Old operation failed'));
    else waiting.resolve();
    await old;
    assert.deepEqual(core(s.read()), before);
    assert.equal(s.read().error, null);
  }
});

test('animation failure rolls back the partial turn and exposes a recoverable error', async () => {
  const s = S.create({ animate: async () => { throw new Error('Drawing failed'); } });
  await s.start();
  const before = core(s.read());
  await s.choose(sq('a3'));
  await s.choose(sq('a4'));
  assert.deepEqual(core(s.read()), before);
  assert.equal(s.read().busy, null);
  assert.equal(s.read().error, 'Drawing failed');
  await s.start();
  assert.equal(s.read().error, null);
});

test('game over locks selection; undo restores result and repetition history', async () => {
  const s = S.create();
  await s.start(position({ blue: 'a2 b2', red: 'a3' }));
  const before = core(s.read());
  await s.choose(sq('a2'));
  await s.choose(sq('a4'));
  assert.equal(s.read().game.result.winner, 1);
  await s.choose(sq('b2'));
  assert.equal(s.read().from, null);
  s.undo();
  assert.deepEqual(core(s.read()), before);
});

test('view coordinates, square names and keyboard edges share one geometry', () => {
  for (let i = 0; i < 64; i++) {
    assert.equal(sq(L.name(i)), i);
    const [x, y] = L.center(i);
    assert.equal(x, i % 8 * 100 + 50);
    assert.equal(y, (7 - Math.floor(i / 8)) * 100 + 50);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      assert(L.navigate(i, key) >= 0 && L.navigate(i, key) < 64);
    }
  }
  assert.equal(L.navigate(sq('a3'), 'ArrowLeft'), sq('a3'));
  assert.equal(L.navigate(sq('h8'), 'ArrowUp'), sq('h8'));
  assert.equal(L.navigate(sq('d3'), 'Home'), sq('a3'));
  assert.equal(L.navigate(sq('d3'), 'End'), sq('h3'));
});
