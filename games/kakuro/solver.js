(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./board.js') : root.Kakuro);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Kakuro, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  const now = () => typeof performance === 'object' ? performance.now() : Date.now();
  // A compact DP over (position, used digits), never an array of permutations.
  function* supportSteps(group, candidates, checkpoint = () => {}) {
    const order = group.cells.map((cell, position) => ({ cell, position, mask: candidates[cell] }))
      .sort((a, b) => B.popcount(a.mask) - B.popcount(b.mask));
    const support = group.cells.map(() => 0), viable = [];
    let work = 0;
    for (const combo of B.combinations[group.cells.length][group.total]) {
      if (order.some(o => !(o.mask & combo))) continue;
      const memo = new Map();
      function* possible(pos, used) {
        if (++work % 128 === 0) { checkpoint(); yield null; }
        if (pos === order.length) return true;
        const key = pos * 512 + used;
        if (memo.has(key)) return memo.get(key);
        let mask = order[pos].mask & combo & ~used;
        while (mask) {
          const b = mask & -mask; mask -= b;
          if (yield* possible(pos + 1, used | b)) { memo.set(key, true); return true; }
        }
        memo.set(key, false); return false;
      }
      if (!(yield* possible(0, 0))) continue;
      viable.push(combo);
      const visited = new Set();
      function* collect(pos, used) {
        if (pos === order.length) return;
        const key = pos * 512 + used;
        if (visited.has(key)) return;
        visited.add(key);
        let mask = order[pos].mask & combo & ~used;
        while (mask) {
          const b = mask & -mask; mask -= b;
          if (yield* possible(pos + 1, used | b)) {
            support[order[pos].position] |= b;
            yield* collect(pos + 1, used | b);
          }
        }
      }
      yield* collect(0, 0);
    }
    checkpoint();
    return { support, combinations: viable, work };
  }
  function drain(iterator) { let r; do { r = iterator.next(); } while (!r.done); return r.value; }
  const groupSupport = (group, candidates) => drain(supportSteps(group, candidates));
  function* solutionSteps(board, values, budget = {}) {
    const started = now(), maxMs = budget.maxMs ?? 2000, maxNodes = budget.maxNodes ?? 1000000;
    const stats = { nodes: 0, propagations: 0, elapsedMs: 0 }, solutions = [];
    function checkpoint() {
      if (budget.signal?.aborted || budget.cancelled?.()) throw { stopped: 'cancelled' };
      if (now() - started >= maxMs || stats.nodes >= maxNodes) throw { stopped: 'budget' };
    }
    function* search(candidates) {
      checkpoint(); stats.nodes++;
      let changed = true;
      while (changed) {
        changed = false;
        for (const g of board.groups) {
          checkpoint(); yield null;
          const result = yield* supportSteps(g, candidates, checkpoint);
          stats.propagations++;
          if (!result.combinations.length) return;
          for (let j = 0; j < g.cells.length; j++) {
            const cell = g.cells[j], next = candidates[cell] & result.support[j];
            if (!next) return;
            if (next !== candidates[cell]) { candidates[cell] = next; changed = true; }
          }
        }
      }
      let cell = -1, count = 10;
      for (const i of board.white) {
        const n = B.popcount(candidates[i]);
        if (n > 1 && n < count) { count = n; cell = i; }
      }
      if (cell === -1) {
        const solution = candidates.map(mask => mask ? B.digits(mask)[0] : 0);
        if (B.validateValues(board, solution).complete) solutions.push(solution);
        return;
      }
      for (const n of B.digits(candidates[cell])) {
        const branch = candidates.slice(); branch[cell] = B.bit(n);
        yield* search(branch);
        if (solutions.length === 2) return;
      }
    }
    let status, reason;
    try {
      checkpoint();
      if (!B.validateValues(board, values).valid) status = 'none';
      else {
        const candidates = values.map((value, i) => board.membership[i] ? value ? B.bit(value) : B.ALL : 0);
        yield* search(candidates);
        status = solutions.length === 0 ? 'none' : solutions.length === 1 ? 'unique' : 'multiple';
      }
    } catch (error) {
      if (!error.stopped) throw error;
      status = 'unknown'; reason = error.stopped;
    }
    stats.elapsedMs = now() - started;
    return { status, reason, cancelled: reason === 'cancelled', solution: solutions[0] || null, solutions, stats };
  }
  async function runSliced(iterator, sliceMs = 8) {
    while (true) {
      const start = now();
      let r;
      do { r = iterator.next(); if (r.done) return r.value; } while (now() - start < sliceMs);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  const countSolutions = (board, values = Array(board.cells.length).fill(0), budget) => drain(solutionSteps(board, values, budget));
  const countSolutionsAsync = (board, values, budget) => runSliced(solutionSteps(board, values, budget));
  return { supportSteps, groupSupport, drain, runSliced, solutionSteps, countSolutions, countSolutionsAsync };
});
