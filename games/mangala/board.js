// Türk Mangala'sı: tek kural çözümü, DOM ve rastgelelik içermez.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Mangala = root.Mangala || {}).board = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const store = player => player === 0 ? 6 : 13;
  const owns = (player, pit) => player === 0 ? pit >= 0 && pit < 6 : pit >= 7 && pit < 13;
  const pitsFor = player => player === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];

  function createInitialState(firstPlayer = 0) {
    if (firstPlayer !== 0 && firstPlayer !== 1) throw new Error('Başlayan oyuncu 0 veya 1 olmalı.');
    return { counts: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0],
      player: firstPlayer, status: 'playing', lastMove: null, result: null };
  }
  function assertState(state) {
    if (!state || !Array.isArray(state.counts) || state.counts.length !== 14 ||
      !state.counts.every(n => Number.isInteger(n) && n >= 0) ||
      state.counts.reduce((a, b) => a + b, 0) !== 48 ||
      ![0, 1].includes(state.player) || !['playing', 'finished'].includes(state.status)) {
      throw new Error('Geçersiz tahta: 14 konumda toplam 48 taş olmalı.');
    }
  }
  function legalMoves(state) {
    return state.status === 'playing' ? pitsFor(state.player).filter(i => state.counts[i] > 0) : [];
  }
  function applyMove(input, pit, options = {}) {
    assertState(input);
    if (!Number.isInteger(pit) || !legalMoves(input).includes(pit)) {
      throw new Error('Bu kuyu oynanamaz. Sıradaki oyuncunun dolu bir kuyusunu seç.');
    }
    const counts = input.counts.slice(), player = input.player, ownStore = store(player);
    const events = [], emit = event => { if (options.events !== false) events.push(event); };
    const stones = counts[pit];
    counts[pit] = 0;
    emit({ type: 'pickup', pit, count: stones });
    let position = pit, beforeLast = 0;
    for (let n = 0; n < stones; n++) {
      if (n > 0 || stones === 1) {
        do { position = (position + 1) % 14; } while (position === store(1 - player));
      }
      beforeLast = counts[position];
      counts[position]++;
      emit({ type: 'drop', pit: position });
    }
    let captured = 0, captureKind = null;
    function collect(type, pits, receiver, kind) {
      const amount = pits.reduce((total, i) => total + counts[i], 0);
      for (const i of pits) counts[i] = 0;
      counts[store(receiver)] += amount;
      emit({ type, pits, store: store(receiver), player: receiver, count: amount, kind });
      return amount;
    }
    if (owns(1 - player, position) && counts[position] % 2 === 0) {
      captureKind = 'even';
      captured = collect('capture', [position], player, captureKind);
    } else if (owns(player, position) && beforeLast === 0 && counts[12 - position] > 0) {
      captureKind = 'opposite';
      captured = collect('capture', [position, 12 - position], player, captureKind);
    }
    const empty = [0, 1].map(p => pitsFor(p).every(i => counts[i] === 0));
    let result = null, status = 'playing';
    if (empty[0] || empty[1]) {
      status = 'finished';
      if (empty[0] !== empty[1]) {
        const receiver = empty[0] ? 0 : 1;
        collect('sweep', pitsFor(1 - receiver).filter(i => counts[i] > 0), receiver, 'empty-side');
      }
      result = { winner: counts[6] === counts[13] ? null : counts[6] > counts[13] ? 0 : 1,
        scores: [counts[6], counts[13]] };
      emit({ type: 'result', result });
    }
    const extraTurn = status === 'playing' && position === ownStore;
    if (extraTurn) emit({ type: 'extraTurn', player });
    return { state: { counts, player: status === 'finished' || extraTurn ? player : 1 - player,
      status, result, lastMove: { player, pit, stones, lastPit: position, captured, captureKind, extraTurn } }, events };
  }
  return { createInitialState, assertState, legalMoves, applyMove, store, owns, pitsFor };
});
