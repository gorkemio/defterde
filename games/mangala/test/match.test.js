const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../match.js');
test('lottery is injectable; starters alternate across all five sets', () => {
  let m = M.createMatch({ sets: 5 }, { random: () => .99 });
  assert.equal(m.firstPlayer, 1);
  for (let set = 1; set <= 5; set++) {
    assert.equal(m.board.player, set % 2);
    m = M.recordResult({ ...m, board: { ...m.board, status: 'finished', result: { winner: 0, scores: [30, 18] } } });
    assert.equal(m.results.length, set);
    if (set < 5) m = M.nextSet(m);
  }
  assert.equal(M.isComplete(m), true);
  assert.deepEqual(M.score(m), [5, 0]);
  assert.throws(() => M.nextSet(m));
});
test('draws award half points; results are recorded once and match may tie', () => {
  let m = M.createMatch({ sets: 5 }, { firstPlayer: 0 });
  for (let i = 0; i < 5; i++) {
    m = { ...m, board: { ...m.board, status: 'finished', result: { winner: null, scores: [24, 24] } } };
    m = M.recordResult(M.recordResult(m));
    assert.equal(m.results.length, i + 1);
    if (i < 4) m = M.nextSet(m);
  }
  assert.deepEqual(M.score(m), [2.5, 2.5]);
  assert.equal(M.winner(m), null);
});
test('human extra turns are separate undo decisions', () => {
  const initial = M.createMatch({ mode: 'computer' }, { firstPlayer: 0 });
  const a = M.play(initial, 3).match;
  const b = M.play(a, 0).match;
  assert.equal(b.history.length, 2);
  assert.deepEqual(M.undo(b), a);
  assert.deepEqual(M.undo(a), initial);
});
test('computer opening has no undo; a user decision and computer chain undo together', () => {
  let m = M.createMatch({ mode: 'computer' }, { firstPlayer: 1 });
  m = M.play(m, 10).match; // computer extra turn
  assert.equal(m.history.length, 0);
  m = M.play(m, 7).match;
  assert.equal(m.history.length, 0);
  const decision = m;
  m = M.play(m, 0).match;
  m = M.play(m, 8).match;
  assert.deepEqual(M.undo(m), decision);
});
test('local players record every decision; undo result and clear at new set', () => {
  let m = M.createMatch({ mode: 'local', sets: 5 }, { firstPlayer: 0 });
  m.board.counts = [0, 0, 0, 0, 0, 1, 22, 1, 0, 0, 0, 0, 0, 24];
  const before = JSON.stringify(m);
  const ended = M.play(m, 5).match;
  assert.equal(ended.results.length, 1);
  assert.equal(JSON.stringify(M.undo(ended)), before);
  const next = M.nextSet(ended);
  assert.equal(next.history.length, 0);
  assert.equal(next.setNumber, 2);
  assert.equal(M.undo(next), next);
});
