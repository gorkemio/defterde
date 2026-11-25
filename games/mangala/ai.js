(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./board.js'));
  else root.Mangala.ai = factory(root.Mangala.board);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  function seeded(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  function opportunities(state, player) {
    let gain = 0, extra = 0;
    const view = { ...state, player };
    for (const move of B.legalMoves(view)) {
      const child = B.applyMove(view, move, { events: false }).state;
      gain = Math.max(gain, child.lastMove.captured);
      if (child.lastMove.extraTurn) extra++;
    }
    return { gain, extra };
  }
  function evaluate(state, root) {
    const difference = state.counts[B.store(root)] - state.counts[B.store(1 - root)];
    if (state.status === 'finished') {
      return state.result.winner === null ? 0 : (state.result.winner === root ? 1000000 : -1000000) + difference;
    }
    const own = opportunities(state, root), other = opportunities(state, 1 - root);
    return 10 * difference + 2 * (own.gain - other.gain) + own.extra - other.extra;
  }
  async function search(state, options = {}) {
    const now = options.now || (() => performance.now());
    const yieldControl = options.yieldControl || (() => new Promise(resolve => setTimeout(resolve, 0)));
    const signal = options.signal, random = options.random || Math.random;
    const difficulty = options.difficulty || 'medium';
    const legal = B.legalMoves(state);
    if (signal?.aborted || !legal.length) return null;
    const started = now(), budget = options.budget ?? (difficulty === 'hard' ? 800 : 200);
    const deadline = started + budget, root = state.player;
    let nodes = 0, maxSlice = 0, sliceStart = started;
    let best = { move: legal[0], score: null, depth: 0, solved: false };
    if (difficulty === 'easy') {
      const choices = legal.map(move => ({
        move, score: evaluate(B.applyMove(state, move, { events: false }).state, root),
      }));
      const high = Math.max(...choices.map(c => c.score));
      const pool = random() < .8 ? choices.filter(c => c.score === high) : choices;
      const choice = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
      return signal?.aborted ? null : { ...choice, depth: 1, solved: false, nodes: choices.length,
        elapsed: now() - started, maxSlice: now() - started };
    }
    const hard = difficulty === 'hard', table = new Map();
    // A TT value depends on both ordinary depth and remaining extension budget.
    function* visit(node, depth, alpha, beta, extensions) {
      nodes++;
      yield;
      if (node.status === 'finished') return { score: evaluate(node, root), limited: false };
      if (depth === 0) return { score: evaluate(node, root), limited: true };
      const key = `${node.player}:${node.counts.join(',')}:${extensions}`;
      const cached = hard ? table.get(key) : null;
      const originalAlpha = alpha, originalBeta = beta;
      if (cached && cached.depth >= depth) {
        if (cached.bound === 'exact') return cached;
        if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score);
        if (cached.bound === 'upper') beta = Math.min(beta, cached.score);
        if (alpha >= beta) return cached;
      }
      const maximize = node.player === root;
      const children = B.legalMoves(node).map(move => ({
        move, state: B.applyMove(node, move, { events: false }).state,
      }));
      if (hard) children.sort((a, b) => {
        const rank = child => (child.move === cached?.move ? 10000 : 0) +
          child.state.lastMove.captured * 10 + (child.state.lastMove.extraTurn ? 5 : 0) +
          (child.state.status === 'finished' && child.state.result.winner === node.player ? 1000 : 0);
        return rank(b) - rank(a);
      });
      let value = maximize ? -Infinity : Infinity, move = children[0].move, limited = false;
      for (const child of children) {
        const tactical = child.state.lastMove.captured > 0 || child.state.lastMove.extraTurn;
        const extension = hard && depth === 1 && extensions > 0 && tactical ? 1 : 0;
        const result = yield* visit(child.state, depth - 1 + extension, alpha, beta, extensions - extension);
        limited ||= result.limited;
        if (maximize ? result.score > value : result.score < value) { value = result.score; move = child.move; }
        if (maximize) alpha = Math.max(alpha, value); else beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      const entry = { score: value, move, limited, depth,
        bound: value <= originalAlpha ? 'upper' : value >= originalBeta ? 'lower' : 'exact' };
      // Reached only on a completed node. Abandoned generators never write partial nodes.
      if (hard) {
        if (table.size > 60000) table.clear();
        table.set(key, entry);
      }
      return entry;
    }
    const maximum = options.maxDepth ?? (hard ? 64 : 6);
    outer: for (let depth = 1; depth <= maximum; depth++) {
      const iterator = visit(state, depth, -Infinity, Infinity, hard ? 2 : 0);
      while (true) {
        if (signal?.aborted) return null;
        const time = now();
        if (time >= deadline) { iterator.return(); break outer; }
        if (time - sliceStart >= 8) {
          maxSlice = Math.max(maxSlice, time - sliceStart);
          await yieldControl();
          if (signal?.aborted) return null;
          sliceStart = now();
        }
        const step = iterator.next();
        if (step.done) {
          best = { move: step.value.move, score: step.value.score, depth, solved: !step.value.limited };
          if (best.solved) break outer;
          break;
        }
      }
    }
    const finished = now();
    return signal?.aborted ? null : { ...best, nodes, elapsed: finished - started,
      maxSlice: Math.max(maxSlice, finished - sliceStart) };
  }
  function explain(state, move) {
    const next = B.applyMove(state, move, { events: false }).state, last = next.lastMove;
    if (next.status === 'finished') return `Set biter: hazineler ${next.counts[6]}–${next.counts[13]}.`;
    if (last.captured) return `${last.captured} taş kazanırsın; sıra karşı tarafa geçer.`;
    if (last.extraTurn) return 'Son taş hazinene düşer; yeniden oynarsın.';
    return `${last.stones} taş dağıtılır; sıra karşı tarafa geçer.`;
  }
  return { search, evaluate, seeded, explain };
});
