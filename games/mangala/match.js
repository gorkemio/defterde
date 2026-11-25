(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./board.js'));
  else root.Mangala.match = factory(root.Mangala.board);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  function settings(value = {}) {
    return { mode: value.mode === 'local' ? 'local' : 'computer',
      difficulty: ['easy', 'medium', 'hard'].includes(value.difficulty) ? value.difficulty : 'medium',
      sets: Number(value.sets) === 5 ? 5 : 1, preview: value.preview === true };
  }
  function createMatch(options, controls = {}) {
    const firstPlayer = controls.firstPlayer ?? ((controls.random || Math.random)() < .5 ? 0 : 1);
    return { settings: settings(options), firstPlayer, setNumber: 1,
      board: B.createInitialState(firstPlayer), results: [], history: [] };
  }
  const score = match => match.results.reduce((total, r) => {
    if (r.winner === null) { total[0] += .5; total[1] += .5; }
    else total[r.winner]++;
    return total;
  }, [0, 0]);
  const isComplete = match => match.results.length === match.settings.sets;
  function winner(match) {
    const points = score(match);
    return points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1;
  }
  function recordResult(match) {
    if (match.board.status !== 'finished' || match.results.some(r => r.set === match.setNumber)) return match;
    return { ...match, results: [...match.results, { set: match.setNumber, ...match.board.result }] };
  }
  function play(match, pit) {
    const { state, events } = B.applyMove(match.board, pit);
    const decision = match.settings.mode === 'local' || match.board.player === 0;
    // History contains immutable snapshots, never recursively contains older history.
    const { history, ...snapshot } = match;
    const updated = { ...match, board: state,
      history: decision ? [...history, snapshot] : history };
    return { match: recordResult(updated), events };
  }
  function undo(match) {
    if (!match.history.length) return match;
    return { ...match.history[match.history.length - 1], history: match.history.slice(0, -1) };
  }
  function nextSet(match) {
    if (match.board.status !== 'finished' || isComplete(match)) throw new Error('Yeni set henüz başlayamaz.');
    const setNumber = match.setNumber + 1;
    return { ...match, setNumber, history: [],
      board: B.createInitialState((match.firstPlayer + setNumber - 1) % 2) };
  }
  return { settings, createMatch, score, winner, isComplete, recordResult, play, undo, nextSet };
});
