(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./board.js') : root.Domino.board);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Domino ||= {}).match = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  function random(seed) {
    let n = seed >>> 0;
    return () => {
      n += 0x6D2B79F5;
      let x = Math.imul(n ^ n >>> 15, 1 | n);
      x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, rng) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function deal(seed, round) {
    const pack = shuffle(B.tiles, random((seed + Math.imul(round, 0x9E3779B9)) >>> 0));
    return B.create([pack.slice(0, 7), pack.slice(7, 14)], pack.slice(14));
  }
  function settings(input = {}) {
    const mode = input.mode === 'local' ? 'local' : 'computer';
    return { mode, difficulty: ['easy', 'medium', 'hard'].includes(input.difficulty) ? input.difficulty : 'medium',
      target: [0, 50, 100].includes(Number(input.target)) ? Number(input.target) : 50,
      names: [(input.names?.[0] || 'Sen').trim().slice(0, 18) || 'Sen',
        mode === 'computer' ? 'Bilgisayar' : (input.names?.[1] || 'İkinci oyuncu').trim().slice(0, 18) || 'İkinci oyuncu'] };
  }
  function create(input, seed) {
    return { settings: settings(input), seed: seed >>> 0, round: 1, scores: [0, 0],
      board: deal(seed >>> 0, 1), result: null };
  }
  function apply(match, action) {
    if (match.result) throw new Error('Maç bitti.');
    const changed = B.apply(match.board, action);
    const next = { ...match, board: changed.state, scores: match.scores.slice() };
    if (changed.state.result) {
      const { winner, points } = changed.state.result;
      if (winner !== null) next.scores[winner] += points;
      if (match.settings.target === 0 || (winner !== null && next.scores[winner] >= match.settings.target))
        next.result = { winner, scores: next.scores.slice() };
    }
    return { state: next, events: changed.events };
  }
  function nextRound(match) {
    if (!match.board.result || match.result) throw new Error('Sonraki el açılamaz.');
    return { ...match, round: match.round + 1, board: deal(match.seed, match.round + 1) };
  }
  return { random, shuffle, settings, create, apply, nextRound, deal };
});
