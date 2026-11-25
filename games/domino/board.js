// Pure double-six draw-domino rules. No DOM, timers, storage or random source.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Domino ||= {}).board = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const tiles = Object.freeze(Array.from({ length: 7 }, (_, a) =>
    Array.from({ length: 7 - a }, (_, n) => Object.freeze({ id: `${a}-${a + n}`, a, b: a + n }))).flat());
  const byId = Object.freeze(Object.fromEntries(tiles.map(t => [t.id, t])));
  const points = hand => hand.reduce((n, t) => n + t.a + t.b, 0);
  const matches = (tile, value) => tile.a === value || tile.b === value;
  function ends(state) {
    return state.chain.length ? [state.chain[0].inValue, state.chain.at(-1).outValue] : [];
  }
  function opening(hands) {
    return hands.flatMap((hand, player) => hand.map(tile => ({ player, tile })))
      .sort((x, y) => Number(y.tile.a === y.tile.b) - Number(x.tile.a === x.tile.b) ||
        (y.tile.a + y.tile.b) - (x.tile.a + x.tile.b) || y.tile.b - x.tile.b)
      .map(x => ({ player: x.player, tileId: x.tile.id }))[0];
  }
  function legal(state, player = state.active) {
    if (state.result || player !== state.active) return [];
    if (!state.chain.length) return state.hands[player]
      .filter(t => t.id === state.opening.tileId && player === state.opening.player)
      .map(t => ({ tileId: t.id, end: 'start' }));
    const [left, right] = ends(state);
    return state.hands[player].flatMap(tile => [
      ...(matches(tile, left) ? [{ tileId: tile.id, end: 'left' }] : []),
      ...(matches(tile, right) ? [{ tileId: tile.id, end: 'right' }] : []),
    ]);
  }
  function create(hands, stock) {
    const first = opening(hands);
    const state = { hands: hands.map(h => h.slice()), stock: stock.slice(), chain: [],
      active: first.player, opening: first, anchorId: null, passes: 0, drawing: false,
      result: null, history: [], revision: 0 };
    assertConservation(state);
    return state;
  }
  function assertConservation(state) {
    const ids = [...state.hands.flat().map(t => t.id), ...state.stock.map(t => t.id),
      ...state.chain.map(p => p.tileId)];
    if (ids.length !== 28 || new Set(ids).size !== 28 || ids.some(id => !byId[id]))
      throw new Error('Taş korunumu bozuldu.');
    if (state.hands.flat().concat(state.stock).some(t => t.a !== byId[t.id].a || t.b !== byId[t.id].b))
      throw new Error('Geçersiz taş değerleri.');
    return true;
  }
  function reject(message) { const error = new Error(message); error.name = 'RuleError'; throw error; }
  function result(state, winner, reason) {
    const tallies = state.hands.map(points);
    return { winner, reason, tallies, points: winner === null ? 0 :
      reason === 'empty' ? tallies[1 - winner] : Math.abs(tallies[0] - tallies[1]) };
  }
  function apply(state, action) {
    if (state.result) reject('Bu el bitti.');
    if (action.player !== state.active) reject('Sıra bu oyuncuda değil.');
    const player = action.player, options = legal(state);
    const next = { ...state, hands: state.hands.map(h => h.slice()), stock: state.stock.slice(),
      chain: state.chain.slice(), history: state.history.slice(), revision: state.revision + 1 };
    const events = [];
    if (action.type === 'play') {
      if (!options.some(m => m.tileId === action.tileId && m.end === action.end)) reject('Taş bu uca oynanamaz.');
      const tile = byId[action.tileId], edge = action.end;
      let placement;
      if (edge === 'start') {
        placement = { tileId: tile.id, inValue: tile.a, outValue: tile.b };
        next.anchorId = tile.id;
      } else {
        const value = ends(state)[edge === 'left' ? 0 : 1];
        const other = tile.a === value ? tile.b : tile.a;
        placement = { tileId: tile.id, inValue: edge === 'left' ? other : value,
          outValue: edge === 'left' ? value : other };
      }
      next.hands[player] = next.hands[player].filter(t => t.id !== tile.id);
      if (edge === 'left') next.chain.unshift(placement); else next.chain.push(placement);
      next.passes = 0; next.drawing = false;
      events.push({ type: 'play', player, end: edge, ...placement });
      if (!next.hands[player].length) next.result = result(next, player, 'empty');
      else next.active = 1 - player;
    } else if (action.type === 'draw') {
      if (options.length) reject('Oynanabilir taş varken çekilemez.');
      if (!state.stock.length) reject('Havuz boş.');
      if (!state.drawing) events.push({ type: 'drawStart', player, ends: ends(state) });
      next.hands[player].push(next.stock.shift());
      next.drawing = true;
      // Public history deliberately never contains the drawn identity.
      events.push({ type: 'draw', player, count: 1 });
    } else if (action.type === 'pass') {
      if (options.length || state.stock.length) reject('Yalnız havuz boşken ve hamle yokken pas geçilir.');
      next.passes++; next.drawing = false;
      events.push({ type: 'pass', player, ends: ends(state) });
      if (next.passes === 2) {
        const totals = next.hands.map(points);
        next.result = result(next, totals[0] === totals[1] ? null : totals[0] < totals[1] ? 0 : 1, 'blocked');
      } else next.active = 1 - player;
    } else reject('Bilinmeyen işlem.');
    if (next.result) events.push({ type: 'end', ...next.result, tallies: next.result.tallies.slice() });
    next.history.push(...events);
    assertConservation(next);
    return { state: next, events };
  }
  return { tiles, byId, points, matches, ends, opening, legal, create, apply, assertConservation };
});
