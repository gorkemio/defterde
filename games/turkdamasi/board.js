// Saf Türk Daması motoru. a1=0, h8=63; mavi +1/+2, kırmızı -1/-2.
// Sözleşme ve kaynak kararları: docs/kural-motoru.md, PLAN.md.
(function (root) {
  'use strict';
  const TD = root.TD = root.TD || {};
  const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const legalPositions = new WeakMap();
  const freeze = Object.freeze;

  function validatePosition(p) {
    if (!p || !Array.isArray(p.cells) || p.cells.length !== 64 ||
        (p.turn !== 1 && p.turn !== -1)) throw new TypeError('Geçersiz konum.');
    for (let i = 0; i < 64; i++) {
      if (!Number.isInteger(p.cells[i]) || Math.abs(p.cells[i]) > 2) {
        throw new TypeError('Hücre yalnız 0, ±1 veya ±2 olabilir.');
      }
    }
  }

  function position(cells, turn) {
    validatePosition({ cells, turn });
    return freeze({ cells: freeze(cells.slice()), turn });
  }

  function initialPosition() {
    const cells = Array(64).fill(0);
    cells.fill(1, 8, 24);
    cells.fill(-1, 40, 56);
    return position(cells, 1);
  }

  function positionKey(p) {
    validatePosition(p);
    return p.cells.map(n => String(n + 2)).join('') + (p.turn === 1 ? '+' : '-');
  }

  function neighbor(square, direction) {
    const [dx, dy] = DIRECTIONS[direction];
    const x = square % 8 + dx, y = Math.floor(square / 8) + dy;
    return x < 0 || x > 7 || y < 0 || y > 7 ? -1 : y * 8 + x;
  }

  function promotes(piece, square) {
    return Math.abs(piece) === 1 && Math.floor(square / 8) === (piece === 1 ? 7 : 0);
  }

  function makeMove(from, landings, captures, piece) {
    return freeze({
      from, landings: freeze(landings.slice()),
      captures: freeze(captures.map(c => freeze({ ...c }))),
      promotion: promotes(piece, landings[landings.length - 1]),
    });
  }

  /**
   * Her ray/kare/dal küçük bir ilerleme adımıdır. Ara yield'ler hamle vermez.
   * Kökün tamamı bitmeden global maksimum bilinmediğinden sonuç yalnız return'dedir.
   */
  function* generateMoves(p) {
    validatePosition(p);
    const key = positionKey(p), cells = p.cells.slice(), side = p.turn;
    let best = [], maximum = 0;

    function* capture(from, current, piece, previousDirection, landings, taken) {
      let extended = false;
      const king = Math.abs(piece) === 2;
      for (let d = 0; d < 4; d++) {
        yield;
        if (!king && d === (side === 1 ? 2 : 0)) continue;
        if (king && previousDirection >= 0 && d === (previousDirection + 2) % 4) continue;
        let enemy = neighbor(current, d);
        if (king) {
          while (enemy >= 0 && cells[enemy] === 0) { yield; enemy = neighbor(enemy, d); }
        }
        if (enemy < 0 || cells[enemy] * side >= 0) continue;
        let landing = neighbor(enemy, d);
        while (landing >= 0 && cells[landing] === 0) {
          yield;
          extended = true;
          const capturedPiece = cells[enemy];
          cells[current] = 0;
          cells[enemy] = 0; // TÜDAF Örnek 3: alınmış e2 üzerinden yeniden geçilebilir.
          cells[landing] = piece; // Zincir boyunca normal taş normal kalır.
          landings.push(landing);
          taken.push({ square: enemy, piece: capturedPiece });
          try {
            yield* capture(from, landing, piece, d, landings, taken);
          } finally {
            taken.pop();
            landings.pop();
            cells[landing] = 0;
            cells[enemy] = capturedPiece;
            cells[current] = piece;
          }
          if (!king) break;
          landing = neighbor(landing, d);
        }
      }
      if (!extended && taken.length > 0 && taken.length >= maximum) {
        if (taken.length > maximum) { maximum = taken.length; best = []; }
        best.push(makeMove(from, landings, taken, piece));
      }
    }

    for (let from = 0; from < 64; from++) {
      yield;
      if (cells[from] * side > 0) yield* capture(from, from, cells[from], -1, [], []);
    }
    if (maximum === 0) {
      for (let from = 0; from < 64; from++) {
        yield;
        const piece = cells[from], king = Math.abs(piece) === 2;
        if (piece * side <= 0) continue;
        for (let d = 0; d < 4; d++) {
          yield;
          if (!king && d === (side === 1 ? 2 : 0)) continue;
          let landing = neighbor(from, d);
          while (landing >= 0 && cells[landing] === 0) {
            yield;
            best.push(makeMove(from, [landing], [], piece));
            if (!king) break;
            landing = neighbor(landing, d);
          }
        }
      }
    }
    freeze(best);
    legalPositions.set(best, key);
    return best;
  }

  function legalMoves(p) {
    const iterator = generateMoves(p);
    let item;
    do { item = iterator.next(); } while (!item.done);
    return item.value;
  }

  function requireLegal(p, legal) {
    if (legal === undefined) return legalMoves(p);
    if (legalPositions.get(legal) !== positionKey(p)) {
      throw new RangeError('Yasal liste bu konum için tamamlanmış olmalıdır.');
    }
    return legal;
  }

  function sameMove(a, b) {
    return b && a.from === b.from && a.promotion === b.promotion &&
      Array.isArray(b.landings) && a.landings.length === b.landings.length &&
      a.landings.every((n, i) => n === b.landings[i]) &&
      Array.isArray(b.captures) && a.captures.length === b.captures.length &&
      a.captures.every((c, i) => c.square === b.captures[i]?.square && c.piece === b.captures[i]?.piece);
  }

  function advanceCells(p, move, length) {
    const cells = p.cells.slice(), piece = cells[move.from];
    let current = move.from;
    for (let i = 0; i < length; i++) {
      cells[current] = 0;
      if (move.captures[i]) cells[move.captures[i].square] = 0;
      current = move.landings[i];
      cells[current] = piece;
    }
    return cells;
  }

  function applyMove(p, move, legal) {
    const candidate = requireLegal(p, legal).find(m => sameMove(m, move));
    if (!candidate) throw new RangeError('Hamle tam ve yasal bir dizi olmalıdır.');
    const cells = advanceCells(p, candidate, candidate.landings.length);
    if (candidate.promotion) cells[candidate.landings[candidate.landings.length - 1]] = 2 * p.turn;
    return position(cells, -p.turn);
  }

  function continuations(legal, from, prefix = []) {
    if (!legalPositions.has(legal)) throw new TypeError('Tamamlanmış yasal liste gerekiyor.');
    if (!Number.isInteger(from) || from < 0 || from > 63 || !Array.isArray(prefix) ||
        prefix.some(n => !Number.isInteger(n) || n < 0 || n > 63)) {
      throw new TypeError('Geçersiz başlangıç veya iniş öneki.');
    }
    const matches = legal.filter(m => m.from === from && m.landings.length >= prefix.length &&
      prefix.every((n, i) => m.landings[i] === n));
    const next = [...new Set(matches.filter(m => m.landings.length > prefix.length).map(m => m.landings[prefix.length]))];
    return freeze({
      matches: freeze(matches), next: freeze(next),
      complete: matches.find(m => m.landings.length === prefix.length) || null,
    });
  }

  function preview(p, legal, from, prefix = []) {
    requireLegal(p, legal);
    const matches = continuations(legal, from, prefix).matches;
    if (!matches.length) throw new RangeError('Bu önek yasal bir hamlenin başlangıcı değil.');
    return position(advanceCells(p, matches[0], prefix.length), p.turn);
  }

  /** Ağ/DOM gerektirmeyen görev dilimleyici; iptal hiçbir kısmi listeyi yayımlamaz. */
  async function collectMoves(p, {
    signal, sliceMs = 8,
    yieldTask = () => new Promise(resolve => root.setTimeout(resolve, 0)),
    now = () => root.performance ? root.performance.now() : Date.now(),
  } = {}) {
    if (!Number.isFinite(sliceMs) || sliceMs <= 0 || typeof now !== 'function' ||
        typeof yieldTask !== 'function') throw new TypeError('Geçersiz üretim bütçesi.');
    const iterator = generateMoves(p), started = now();
    const stats = { steps: 0, slices: 0, yields: 0, elapsedMs: 0, maxSliceMs: 0 };
    const checkAbort = () => {
      if (signal?.aborted) {
        const error = new Error('Hamle üretimi iptal edildi.');
        error.name = 'AbortError';
        throw error;
      }
    };
    try {
      for (;;) {
        checkAbort();
        const start = now();
        stats.slices++;
        let item, elapsed;
        do {
          checkAbort();
          item = iterator.next();
          stats.steps++;
          elapsed = now() - start;
        } while (!item.done && elapsed < sliceMs);
        stats.maxSliceMs = Math.max(stats.maxSliceMs, elapsed);
        checkAbort();
        if (item.done) {
          stats.elapsedMs = now() - started;
          return freeze({ moves: item.value, stats: freeze(stats) });
        }
        stats.yields++;
        await yieldTask();
      }
    } finally {
      iterator.return();
    }
  }

  function outcome(p, repetitions = {}, legal) {
    validatePosition(p);
    // Birer taş beraberliğinden önce galibiyet koşulları değerlendirilir.
    // Normal bir oyunda ikisinin aynı anda gerçekleşmesi mümkün değildir.
    let own = 0, opponent = 0;
    for (const piece of p.cells) {
      if (piece * p.turn > 0) own++;
      else if (piece) opponent++;
    }
    // Sağlanan eski listenin erken sonuç durumlarında da kabul edilmemesi gerekir.
    if (legal !== undefined) requireLegal(p, legal);
    if (own === 0) return freeze({ winner: -p.turn, reason: 'no-pieces' });
    if (opponent === 0) return freeze({ winner: p.turn, reason: 'no-pieces' });
    if (requireLegal(p, legal).length === 0) return freeze({ winner: -p.turn, reason: 'blocked' });
    if (own === 1 && opponent === 1) return freeze({ winner: 0, reason: 'one-each' });
    if ((repetitions[positionKey(p)] || 0) >= 3) return freeze({ winner: 0, reason: 'repetition' });
    return null;
  }

  function createGame(p = initialPosition(), legal) {
    const owned = position(p.cells, p.turn), repetitions = Object.create(null);
    repetitions[positionKey(owned)] = 1;
    freeze(repetitions);
    return freeze({
      position: owned, repetitions, history: freeze([]),
      result: outcome(owned, repetitions, legal),
    });
  }

  function play(game, move, { legal, nextLegal } = {}) {
    if (game.result) throw new RangeError('Oyun zaten bitmiş.');
    const currentLegal = requireLegal(game.position, legal);
    const canonical = currentLegal.find(m => sameMove(m, move));
    const nextPosition = applyMove(game.position, canonical, currentLegal);
    const repetitions = Object.assign(Object.create(null), game.repetitions);
    const key = positionKey(nextPosition);
    repetitions[key] = (repetitions[key] || 0) + 1;
    freeze(repetitions);
    const result = outcome(nextPosition, repetitions, nextLegal);
    // Önceki durumlar değiştirilemez; geçmiş kare dizilerini yeniden kopyalamaz.
    const frame = freeze({
      position: game.position, repetitions: game.repetitions,
      result: game.result, move: canonical,
    });
    return freeze({
      position: nextPosition, repetitions,
      history: freeze([...game.history, frame]), result,
    });
  }

  function undo(game, count = 1) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError('Geri alma sayısı negatif olmayan tam sayı olmalı.');
    const length = Math.max(0, game.history.length - count);
    if (length === game.history.length) return game;
    const frame = game.history[length];
    return freeze({
      position: frame.position, repetitions: frame.repetitions, result: frame.result,
      history: freeze(game.history.slice(0, length)),
    });
  }

  function agreeDraw(game) {
    if (game.result) throw new RangeError('Oyun zaten bitmiş.');
    return freeze({ ...game, result: freeze({ winner: 0, reason: 'agreement' }) });
  }

  function repetitionContext(repetitions) {
    return Object.keys(repetitions).sort().map(key => key + ':' + repetitions[key]).join('|');
  }

  TD.board = freeze({
    position, initialPosition, positionKey, generateMoves, legalMoves,
    applyMove, continuations, preview, collectMoves,
    outcome, createGame, play, undo, agreeDraw, repetitionContext,
  });
})(globalThis);
