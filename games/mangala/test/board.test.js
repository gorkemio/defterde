const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');

function fixture(pits, player = 0, stores = [0, 0]) {
  const counts = Array(14).fill(0);
  Object.entries(pits).forEach(([i, n]) => { counts[i] = n; });
  counts[6] = stores[0]; counts[13] = stores[1];
  counts[13] += 48 - counts.reduce((a, b) => a + b, 0);
  return { ...B.createInitialState(player), counts };
}
function frozen(state) {
  Object.freeze(state.counts);
  return Object.freeze(state);
}
test('initial board and legal moves for both players', () => {
  assert.deepEqual(B.legalMoves(B.createInitialState(0)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(B.legalMoves(B.createInitialState(1)), [7, 8, 9, 10, 11, 12]);
  assert.equal(B.createInitialState().counts.reduce((a, b) => a + b), 48);
});
test('two specified opening examples', () => {
  const initial = frozen(B.createInitialState(0));
  const a = B.applyMove(initial, 0).state;
  assert.deepEqual(a.counts, [1, 5, 5, 5, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(a.player, 1);
  const b = B.applyMove(initial, 3).state;
  assert.deepEqual(b.counts, [4, 4, 4, 1, 5, 5, 1, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(b.player, 0);
  assert.equal(b.lastMove.extraTurn, true);
});
test('upper row uses increasing indices and own store', () => {
  const next = B.applyMove(B.createInitialState(1), 10).state;
  assert.equal(next.counts[10], 1);
  assert.equal(next.counts[11], 5);
  assert.equal(next.counts[12], 5);
  assert.equal(next.counts[13], 1);
  assert.equal(next.player, 1);
});
test('invalid, empty, opposing, store and finished moves throw without mutation', () => {
  const s = frozen(fixture({ 0: 1, 7: 1 }));
  for (const pit of [-1, 1, 6, 7, 13, 14, 0.5, '0']) assert.throws(() => B.applyMove(s, pit));
  assert.throws(() => B.applyMove({ ...s, status: 'finished' }, 0));
  assert.equal(s.counts[0], 1);
});
test('single stone leaves source empty; empty opposite leaves last stone in place', () => {
  const { state } = B.applyMove(fixture({ 0: 1, 4: 2, 7: 3 }), 0);
  assert.equal(state.counts[0], 0);
  assert.equal(state.counts[1], 1);
  assert.equal(state.lastMove.captured, 0);
  assert.equal(state.player, 1);
});
test('single stone into own store grants extra turn while set continues', () => {
  for (const player of [0, 1]) {
    const s = fixture(player ? { 12: 1, 7: 2, 0: 3 } : { 5: 1, 0: 2, 7: 3 }, player);
    const next = B.applyMove(s, player ? 12 : 5).state;
    assert.equal(next.player, player);
    assert.equal(next.lastMove.extraTurn, true);
  }
});
test('long sowing skips opponent store and revisits source for both sides', () => {
  for (const player of [0, 1]) {
    const pit = player ? 7 : 0;
    const s = fixture({ [pit]: 27, [player ? 0 : 7]: 3 }, player);
    const { events } = B.applyMove(s, pit);
    const drops = events.filter(e => e.type === 'drop');
    assert.equal(drops.length, 27);
    assert.equal(drops.filter(e => e.pit === pit).length, 3);
    assert.equal(drops.some(e => e.pit === (player ? 6 : 13)), false);
  }
});
test('only final even opponent pit is captured; capture does not grant extra turn', () => {
  const s = fixture({ 0: 1, 5: 4, 7: 1, 8: 3, 10: 1 });
  const { state } = B.applyMove(s, 5);
  assert.equal(state.counts[7], 2); // even at an intermediate drop: untouched
  assert.equal(state.counts[8], 0);
  assert.equal(state.counts[6], 5);
  assert.equal(state.lastMove.captured, 4);
  assert.equal(state.player, 1);
});
test('final opponent counts of two, four and six are captured on either side', () => {
  for (const player of [0, 1]) for (const captured of [2, 4, 6]) {
    const s = player === 0
      ? fixture({ 0: 1, 5: 3, 7: captured - 1, 9: 2 })
      : fixture({ 7: 1, 12: 3, 0: captured - 1, 2: 2 }, 1);
    const before = s.counts[B.store(player)];
    const next = B.applyMove(s, player === 0 ? 5 : 12).state;
    assert.equal(next.lastMove.captured, captured);
    assert.equal(next.counts[B.store(player)], before + captured + 1);
    assert.equal(next.player, 1 - player);
  }
});
test('last stone in own empty pit takes opposite and itself', () => {
  const { state } = B.applyMove(fixture({ 0: 1, 4: 2, 11: 6, 7: 3 }), 0);
  assert.equal(state.counts[1], 0);
  assert.equal(state.counts[11], 0);
  assert.equal(state.counts[6], 7);
  assert.equal(state.lastMove.captured, 7);
});
test('temporary source emptying does not end set', () => {
  const { state } = B.applyMove(fixture({ 0: 4, 7: 4 }), 0);
  assert.equal(state.status, 'playing');
  assert.equal(state.counts[0], 1);
});
test('emptying side receives all remaining opponent stones before extra turn', () => {
  const { state, events } = B.applyMove(fixture({ 5: 1, 7: 5, 8: 2 }), 5);
  assert.equal(state.status, 'finished');
  assert.equal(state.counts[6], 8);
  assert.equal(state.lastMove.extraTurn, false);
  assert.equal(events.some(e => e.type === 'extraTurn'), false);
  assert.equal(events.find(e => e.type === 'sweep').player, 0);
});
test('non-moving side can become empty and receives sweep', () => {
  const s = fixture({ 0: 2, 5: 3, 7: 1 });
  const { state } = B.applyMove(s, 5);
  assert.equal(state.status, 'finished');
  assert.equal(state.counts[6], 3);
  assert.equal(state.counts[13], 45);
});
test('both sides empty needs no sweep, and 24–24 is a draw', () => {
  const s = fixture({ 0: 1, 11: 1 }, 0, [22, 24]);
  const { state, events } = B.applyMove(s, 0);
  assert.deepEqual(state.result, { winner: null, scores: [24, 24] });
  assert.equal(events.some(e => e.type === 'sweep'), false);
});
test('events preserve 48 stones across counts and hand and replay to final state', () => {
  const initial = fixture({ 0: 1, 5: 4, 7: 1, 8: 3, 10: 1 });
  const { state, events } = B.applyMove(initial, 5);
  const counts = initial.counts.slice();
  let hand = 0;
  for (const e of events) {
    if (e.type === 'pickup') { hand = counts[e.pit]; counts[e.pit] = 0; }
    if (e.type === 'drop') { counts[e.pit]++; hand--; }
    if (e.type === 'capture' || e.type === 'sweep') {
      for (const pit of e.pits) { counts[e.store] += counts[pit]; counts[pit] = 0; }
    }
    assert.equal(counts.reduce((a, b) => a + b) + hand, 48);
  }
  assert.deepEqual(counts, state.counts);
  assert.deepEqual(B.applyMove(initial, 5, { events: false }).state, state);
  assert.deepEqual(B.applyMove(initial, 5, { events: false }).events, []);
});
test('seeded complete legal games conserve stones and never mutate inputs', () => {
  let seed = 12345;
  for (let game = 0; game < 60; game++) {
    let state = B.createInitialState(game % 2), moves = 0;
    while (state.status === 'playing' && moves++ < 2000) {
      const before = JSON.stringify(state);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const legal = B.legalMoves(state);
      const next = B.applyMove(state, legal[seed % legal.length]).state;
      assert.equal(JSON.stringify(state), before);
      assert.equal(next.counts.reduce((a, b) => a + b), 48);
      assert.ok(next.counts.every(n => Number.isInteger(n) && n >= 0));
      state = next;
    }
    assert.equal(state.status, 'finished');
  }
});
module.exports = { fixture };
