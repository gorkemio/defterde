const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const A = require('../ai.js');
function position(counts, player = 0) {
  return { ...B.createInitialState(player), counts };
}
test('all difficulties choose legal moves without mutating input', async () => {
  const s = B.createInitialState(1), original = JSON.stringify(s);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const result = await A.search(s, { difficulty, budget: 25, random: A.seeded(42) });
    assert.ok(B.legalMoves(s).includes(result.move));
  }
  assert.equal(JSON.stringify(s), original);
});
test('terminal sweep outcome is preferred over heuristic gain', async () => {
  // Pit 5 empties the moving side only after another pit is captured later;
  // compare actual terminal values on a small solved position.
  const s = position([0, 0, 0, 0, 1, 1, 22, 0, 0, 0, 0, 0, 2, 22]);
  const expected = exhaustive(s, 0, 10).move;
  const result = await A.search(s, { difficulty: 'hard', budget: 200, maxDepth: 10 });
  assert.equal(result.move, expected);
});
function exhaustive(s, root, depth) {
  if (s.status === 'finished' || depth === 0) return { score: A.evaluate(s, root) };
  let best = { score: s.player === root ? -Infinity : Infinity, move: null };
  for (const move of B.legalMoves(s)) {
    const child = exhaustive(B.applyMove(s, move, { events: false }).state, root, depth - 1);
    if (best.move === null || (s.player === root ? child.score > best.score : child.score < best.score)) {
      best = { score: child.score, move };
    }
  }
  return best;
}
test('alpha-beta uses actual active player across extra turns', async () => {
  const s = position([1, 0, 0, 2, 0, 1, 20, 1, 0, 0, 1, 0, 1, 21]);
  const expected = exhaustive(s, 0, 5);
  const result = await A.search(s, { difficulty: 'medium', budget: 10000, maxDepth: 5 });
  assert.equal(result.depth, 5);
  assert.equal(result.score, expected.score);
});
test('fake clock timeout returns legal fallback before completing depth', async () => {
  let time = 0;
  const s = B.createInitialState(0);
  const result = await A.search(s, { difficulty: 'hard', budget: 1, now: () => time++ });
  assert.equal(result.depth, 0);
  assert.ok(B.legalMoves(s).includes(result.move));
  assert.equal(result.solved, false);
});
test('cancel before or during a slice returns no move', async () => {
  const pre = new AbortController(); pre.abort();
  assert.equal(await A.search(B.createInitialState(), { signal: pre.signal }), null);
  const ctl = new AbortController();
  let time = 0, yielded = 0;
  const result = await A.search(B.createInitialState(), {
    difficulty: 'hard', budget: 800, now: () => time++,
    signal: ctl.signal, yieldControl: async () => { yielded++; ctl.abort(); },
  });
  assert.ok(yielded > 0);
  assert.equal(result, null);
});
test('easy randomness is seedable and terminal draw is zero', async () => {
  const a = await A.search(B.createInitialState(), { difficulty: 'easy', random: A.seeded(99) });
  const b = await A.search(B.createInitialState(), { difficulty: 'easy', random: A.seeded(99) });
  assert.equal(a.move, b.move);
  assert.equal(A.evaluate({ ...B.createInitialState(), status: 'finished', result: { winner: null, scores: [24, 24] } }, 0), 0);
});
test('hard TT bounds match independent exhaustive tactical search on sparse boards', async () => {
  function reference(state, root, depth, extensions) {
    if (state.status === 'finished' || !depth) return A.evaluate(state, root);
    const values = B.legalMoves(state).map(move => {
      const child = B.applyMove(state, move, { events: false }).state;
      const extend = depth === 1 && extensions > 0 && (child.lastMove.captured || child.lastMove.extraTurn) ? 1 : 0;
      return reference(child, root, depth - 1 + extend, extensions - extend);
    });
    return state.player === root ? Math.max(...values) : Math.min(...values);
  }
  const random = A.seeded(7341);
  for (let sample = 0; sample < 12; sample++) {
    const counts = Array(14).fill(0);
    counts[6] = 20; counts[13] = 20; counts[0] = 1; counts[7] = 1;
    for (let stone = 0; stone < 6; stone++) {
      const pit = Math.floor(random() * 12); counts[pit < 6 ? pit : pit + 1]++;
    }
    const state = position(counts, sample % 2);
    const result = await A.search(state, { difficulty: 'hard', budget: 10000, maxDepth: 4 });
    assert.equal(result.score, reference(state, state.player, result.depth, 2));
  }
});
