// Tam turlar üzerinden arama. DOM, işçi, ağ veya modül yükleyici gerektirmez.
(function (root) {
  'use strict';
  const TD = root.TD, B = TD.board, WIN = 100000;
  const profiles = TD.config.aiProfiles;
  const keyMove = m => m.from + ':' + m.landings.join(',');

  function evaluate(p) {
    let value = 0;
    for (let i = 0; i < 64; i++) {
      const piece = p.cells[i];
      if (!piece) continue;
      const side = Math.sign(piece), king = Math.abs(piece) === 2;
      const x = i % 8, y = i >> 3, progress = side > 0 ? y : 7 - y;
      let mobility = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, side], ...(king ? [[0, -side]] : [])]) {
        let a = x + dx, b = y + dy;
        while (a >= 0 && a < 8 && b >= 0 && b < 8 && !p.cells[b * 8 + a]) {
          mobility++;
          if (!king) break;
          a += dx; b += dy;
        }
      }
      value += side * ((king ? 360 : 100 + progress * 5) + mobility * 2 + Math.min(x, 7 - x));
    }
    return value * p.turn;
  }

  function createTable(limit = 2000) {
    const entries = new Map(), ordering = new Map();
    function boundedSet(map, key, value) {
      if (!map.has(key) && map.size >= limit) map.delete(map.keys().next().value);
      map.set(key, value);
    }
    return Object.freeze({
      get size() { return entries.size; },
      get: key => entries.get(key),
      set: (key, value) => boundedSet(entries, key, value),
      best: key => ordering.get(key),
      order: (key, value) => boundedSet(ordering, key, value),
    });
  }

  async function analyze(game, options = {}) {
    const profile = profiles[options.level || 'medium'];
    if (!profile) throw new TypeError('Bilinmeyen zorluk.');
    const budgetMs = options.budgetMs ?? profile.budgetMs;
    const maxDepth = options.maxDepth ?? profile.maxDepth;
    if (!Number.isFinite(budgetMs) || budgetMs < 0 || !Number.isInteger(maxDepth) || maxDepth < 1) throw new TypeError('Geçersiz arama bütçesi.');
    const now = options.now || (() => root.performance.now());
    const yieldTask = options.yieldTask || (() => new Promise(r => root.setTimeout(r, 0)));
    const signal = options.signal, sliceMs = options.sliceMs ?? 8;
    const table = options.table || createTable();
    const useTT = options.transpositions ?? profile.transpositions;
    const started = now(), deadline = started + budgetMs;
    let sliceStart = started, nodes = 0, yields = 0, maxSliceMs = 0, ttHits = 0, generated = 0;
    const timeout = {};
    function checkpoint(rootWork = false) {
      if (signal?.aborted) {
        const e = new Error('Arama iptal edildi.'); e.name = 'AbortError'; throw e;
      }
      const time = now();
      if (!rootWork && time >= deadline) throw timeout;
      const elapsed = time - sliceStart;
      if (elapsed < sliceMs) return null;
      maxSliceMs = Math.max(maxSliceMs, elapsed);
      yields++;
      return yieldTask().then(() => { sliceStart = now(); checkpointAfterYield(rootWork); });
    }
    function checkpointAfterYield(rootWork) {
      if (signal?.aborted) {
        const e = new Error('Arama iptal edildi.'); e.name = 'AbortError'; throw e;
      }
      if (!rootWork && now() >= deadline) throw timeout;
    }
    async function moves(p, rootWork = false) {
      const iterator = B.generateMoves(p);
      try {
        for (;;) {
          const wait = checkpoint(rootWork); if (wait) await wait;
          const item = iterator.next();
          generated++;
          if (item.done) return item.value;
        }
      } finally { iterator.return(); }
    }
    function child(g, m, legal) {
      const p = B.applyMove(g.position, m, legal), key = B.positionKey(p);
      return {
        position: p, repetitions: { ...g.repetitions, [key]: (g.repetitions[key] || 0) + 1 },
      };
    }
    function ordered(legal, p, preferred) {
      const priority = m => (keyMove(m) === preferred ? 10000 : 0) +
        (m.promotion ? 300 : 0) + m.captures.reduce((sum, c) => sum + Math.abs(c.piece) * 100, 0) +
        ((m.landings.at(-1) >> 3) - (m.from >> 3)) * p.turn;
      return [...legal].sort((a, b) => priority(b) - priority(a));
    }
    async function search(g, depth, alpha, beta) {
      const wait = checkpoint(); if (wait) await wait;
      nodes++;
      const p = g.position, legal = await moves(p);
      const out = B.outcome(p, g.repetitions, legal);
      if (out) return out.winner * p.turn * WIN;
      // Alma zorunluyken mevcut değerlendirmede durulmaz: bütün cevaplar araştırılır.
      if (depth <= 0 && !legal[0].captures.length) return evaluate(p);
      const positionKey = B.positionKey(p);
      const contextKey = useTT ? positionKey + '|' + B.repetitionContext(g.repetitions) : '';
      const originalAlpha = alpha, originalBeta = beta, entry = useTT && table.get(contextKey);
      if (entry && entry.depth >= Math.max(0, depth)) {
        ttHits++;
        if (entry.bound === 'exact') return entry.score;
        if (entry.bound === 'lower') alpha = Math.max(alpha, entry.score);
        if (entry.bound === 'upper') beta = Math.min(beta, entry.score);
        if (alpha >= beta) return entry.score;
      }
      let best = -Infinity, bestMove = null;
      for (const m of ordered(legal, p, table.best(positionKey))) {
        const score = -await search(child(g, m, legal), depth - 1, -beta, -alpha);
        if (score > best) { best = score; bestMove = m; }
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      if (useTT) {
        table.set(contextKey, { depth: Math.max(0, depth), score: best, best: keyMove(bestMove),
          bound: best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact' });
        table.order(positionKey, keyMove(bestMove));
      }
      return best;
    }

    // Kök liste asla bütçe uğruna yarım bırakılmaz. İptal bu sırada da etkindir.
    const legal = options.legal || await moves(game.position, true);
    checkpointAfterYield(true);
    const rootMs = now() - started, out = game.result || B.outcome(game.position, game.repetitions, legal);
    let candidates = options.candidates || legal;
    if (candidates.some(m => !legal.includes(m)) || (!out && !candidates.length)) throw new TypeError('Geçersiz kök adayları.');
    let selected = out ? null : candidates[0], score = out ? out.winner * game.position.turn * WIN : null;
    let completedDepth = 0, timedOut = false;
    try {
      if (!out) for (let depth = 1; depth <= maxDepth; depth++) {
        const scores = [];
        let alpha = -Infinity;
        for (const m of ordered(candidates, game.position, selected && keyMove(selected))) {
          // Kolay seviyede yakın adayların gerçek puanı gerektiğinden tam pencere kullanılır.
          const value = -await search(child(game, m, legal), depth - 1, -Infinity, profile.variety ? Infinity : -alpha);
          scores.push({ move: m, score: value });
          alpha = Math.max(alpha, value);
        }
        scores.sort((a, b) => b.score - a.score);
        let chosen = scores[0];
        if (profile.variety && options.variety !== false) {
          const near = scores.filter(s => s.score >= chosen.score - profile.variety);
          let seed = options.seed ?? 719;
          for (const c of B.positionKey(game.position)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
          chosen = near[(seed >>> 0) % near.length];
        }
        selected = chosen.move; score = chosen.score; completedDepth = depth;
        if (Math.abs(score) === WIN) break;
      }
    } catch (e) {
      if (e !== timeout) throw e;
      timedOut = true;
    }
    const finished = now();
    maxSliceMs = Math.max(maxSliceMs, finished - sliceStart);
    return Object.freeze({
      move: selected, depth: completedDepth, score, timedOut, rootMs,
      searchMs: finished - started - rootMs, elapsedMs: finished - started,
      nodes, generated, yields, maxSliceMs, ttHits, tableSize: table.size,
    });
  }
  TD.ai = Object.freeze({ analyze, evaluate, createTable, profiles, WIN });
})(globalThis);
