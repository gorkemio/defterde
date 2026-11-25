// Oturum: tamamlanmış oyun ile ekranda ilerleyen alma zincirini ayrı tutar.
// DOM içermez; çizim ve zaman dilimli üretim bağımlılıkları değiştirilebilir.
(function (root) {
  'use strict';
  const TD = root.TD, B = TD.board, freeze = Object.freeze;
  const empty = freeze([]);

  function identities(position) {
    const counts = { mavi: 0, kirmizi: 0 };
    return freeze(position.cells.map(piece => {
      if (!piece) return null;
      const team = piece > 0 ? 'mavi' : 'kirmizi';
      return team + '-' + counts[team]++;
    }));
  }

  function create({ animate = async () => {}, collect = B.collectMoves, onChange = () => {},
    search = TD.ai?.analyze, mode = 'local', human = 1, level = 'medium' } = {}) {
    let game = null, position = B.initialPosition(), legal = empty;
    let committedIds = identities(position), ids = committedIds, frames = [];
    let from = null, prefix = empty, busy = null, error = null;
    let taskId = 0, controller = new root.AbortController();
    let hintMove = null, offer = null, notice = '', metrics = null;

    function read() {
      const continuation = from == null ? null : B.continuations(legal, from, prefix);
      return freeze({
        game, position, ids, legal, from, prefix, busy, error, mode, human, level,
        hint: hintMove, offer, notice, metrics,
        selected: from == null ? null : (prefix.at(-1) ?? from),
        targets: !busy && !game?.result && continuation ? continuation.next : empty,
        selectable: !busy && !game?.result && !prefix.length
          ? freeze([...new Set(legal.map(m => m.from))]) : empty,
        canUndo: mode === 'ai'
          ? (game?.position.turn === human && prefix.length > 0) || !!game?.history.some(f => f.position.turn === human)
          : prefix.length > 0 || !!game?.history.length,
        lastMove: game?.history.at(-1)?.move || null,
      });
    }
    const emit = () => onChange(read());
    function newTask() {
      taskId++;
      controller.abort();
      controller = new root.AbortController();
      error = null;
      hintMove = null;
      offer = null;
      notice = '';
      return { id: taskId, signal: controller.signal };
    }
    const current = task => task.id === taskId && !task.signal.aborted;
    function rollback() {
      if (game) position = game.position;
      ids = committedIds;
      from = null;
      prefix = empty;
      busy = null;
    }
    function failed(task, e) {
      if (!current(task)) return;
      rollback();
      error = e.message || 'Oyun hazırlanamadı.';
      emit();
    }

    async function start(p = B.initialPosition()) {
      const next = B.position(p.cells, p.turn);
      const task = newTask();
      game = null;
      position = next;
      committedIds = ids = identities(next);
      legal = empty;
      frames = [];
      from = null;
      prefix = empty;
      busy = 'moves';
      emit();
      try {
        const result = await collect(next, { signal: task.signal });
        if (!current(task)) return;
        legal = result.moves;
        game = B.createGame(next, legal);
        busy = null;
        emit();
        await computer();
      } catch (e) { failed(task, e); }
    }

    async function choose(square) {
      if (!game || game.result || busy || !Number.isInteger(square) || square < 0 || square > 63) return;
      if (mode === 'ai' && game.position.turn !== human) return;
      const options = from == null ? null : B.continuations(legal, from, prefix);
      if (!options?.next.includes(square)) {
        if (!prefix.length && legal.some(m => m.from === square)) {
          from = square;
          error = null;
          hintMove = null;
          notice = '';
          emit();
        }
        return;
      }
      const task = newTask();
      await advance(square, task);
      if (current(task) && !prefix.length && !error) await computer();
    }

    async function advance(square, task) {
      const previous = prefix.at(-1) ?? from;
      const movingId = ids[previous];
      // İlk await öncesinde kilitle: çift tıklama ikinci bir tur başlatamaz.
      prefix = freeze([...prefix, square]);
      busy = 'animation';
      emit();
      try {
        await animate({ id: movingId, from: previous, to: square, signal: task.signal });
        if (!current(task)) return;
        const continuation = B.continuations(legal, from, prefix);
        const move = continuation.matches[0];
        position = B.preview(game.position, legal, from, prefix);
        const nextIds = ids.slice();
        nextIds[previous] = null;
        if (move.captures.length) nextIds[move.captures[prefix.length - 1].square] = null;
        nextIds[square] = movingId;
        ids = freeze(nextIds);
        if (!continuation.complete) {
          busy = null;
          emit();
          return;
        }
        busy = 'moves';
        emit();
        const next = B.applyMove(game.position, continuation.complete, legal);
        const result = await collect(next, { signal: task.signal });
        if (!current(task)) return;
        const played = B.play(game, continuation.complete, { legal, nextLegal: result.moves });
        frames.push({ ids: committedIds, legal });
        game = played;
        position = game.position;
        committedIds = ids;
        legal = result.moves;
        from = null;
        prefix = empty;
        busy = null;
        emit();
      } catch (e) { failed(task, e); }
    }

    function undo() {
      if (!read().canUndo) return;
      const partial = prefix.length > 0 && (mode !== 'ai' || game.position.turn === human);
      newTask();
      function back() {
        const frame = frames.pop();
        game = B.undo(game);
        committedIds = frame.ids;
        legal = frame.legal;
      }
      if (!partial && game?.history.length) {
        back();
        if (mode === 'ai') while (game.history.length && game.position.turn !== human) back();
      }
      rollback();
      emit();
    }

    async function computer() {
      if (mode !== 'ai' || !game || game.result || game.position.turn === human || busy) return;
      const task = newTask();
      busy = 'ai'; emit();
      try {
        const result = await search(game, { level, legal, signal: task.signal });
        if (!current(task)) return;
        metrics = result;
        if (!legal.includes(result.move)) throw new Error('Bilgisayarın hamlesi doğrulanamadı.');
        from = result.move.from;
        for (const square of result.move.landings) {
          await advance(square, task);
          if (!current(task) || error) return;
        }
      } catch (e) { failed(task, e); }
    }

    async function hint() {
      if (!game || game.result || busy || (mode === 'ai' && game.position.turn !== human)) return;
      const task = newTask();
      busy = 'hint'; emit();
      try {
        const candidates = from == null ? legal : B.continuations(legal, from, prefix).matches;
        const result = await search(game, { level: 'hard', legal, candidates, signal: task.signal });
        if (!current(task)) return;
        hintMove = result.move; metrics = result; busy = null; emit();
      } catch (e) { failed(task, e); }
    }

    async function offerDraw() {
      if (!game || game.result || busy || prefix.length || (mode === 'ai' && game.position.turn !== human)) return;
      const task = newTask();
      offer = mode === 'local' ? game.position.turn : 'computer';
      busy = 'offer'; emit();
      if (mode === 'local') return;
      try {
        const result = await search(game, { level: 'hard', budgetMs: 300, legal, signal: task.signal });
        if (!current(task)) return;
        metrics = result;
        const accept = result.depth > 0 && result.score != null && result.score * game.position.turn * -human <= 0;
        if (accept) { game = B.agreeDraw(game); from = null; }
        notice = accept ? 'Bilgisayar beraberliği kabul etti.' : 'Bilgisayar oynamaya devam etmek istiyor.';
        busy = null; offer = null; emit();
      } catch (e) { failed(task, e); }
    }
    function respondDraw(accept) {
      if (mode !== 'local' || busy !== 'offer') return;
      newTask();
      if (accept) { game = B.agreeDraw(game); from = null; }
      notice = accept ? 'Beraberlik kabul edildi.' : 'Teklif reddedildi; oyun devam ediyor.';
      busy = null; emit();
    }

    async function configure(settings) {
      const nextMode = settings.mode ?? mode, nextHuman = settings.human ?? human, nextLevel = settings.level ?? level;
      if (!['local', 'ai'].includes(nextMode) || ![1, -1].includes(nextHuman) || !['easy', 'medium', 'hard'].includes(nextLevel)) throw new TypeError('Geçersiz oyun ayarı.');
      mode = nextMode; human = nextHuman; level = nextLevel;
      await start();
    }

    function stash() {
      const unstable = busy === 'animation' || (busy === 'moves' && prefix.length);
      newTask();
      if (unstable) rollback();
      busy = null;
      const saved = freeze({ game, position, ids, committedIds, legal, from, prefix,
        frames: freeze(frames.map(f => freeze({ ...f }))), mode, human, level });
      emit();
      return saved;
    }
    async function restore(saved) {
      newTask();
      ({ game, position, ids, committedIds, legal, from, prefix, mode, human, level } = saved);
      frames = [...saved.frames]; busy = null;
      emit();
      if (!game) await start(position);
      else await computer();
    }

    function suspend() {
      newTask();
      rollback();
      emit();
    }
    async function resume() {
      if (!game) await start(position);
      else await computer();
    }

    return freeze({ start, choose, undo, suspend, resume, read, hint, offerDraw, respondDraw, configure, stash, restore });
  }

  TD.session = freeze({ create });
})(globalThis);
