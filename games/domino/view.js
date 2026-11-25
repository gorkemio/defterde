(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./board.js') : root.Domino.board);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Domino ||= {}).view = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  function publicEvent(e) {
    if (e.type === 'play') return { type: 'play', player: e.player, tileId: e.tileId,
      end: e.end, inValue: e.inValue, outValue: e.outValue };
    if (e.type === 'draw') return { type: 'draw', player: e.player, count: e.count };
    if (e.type === 'drawStart' || e.type === 'pass')
      return { type: e.type, player: e.player, ends: e.ends.slice() };
    return { type: 'end', winner: e.winner, points: e.points, reason: e.reason, tallies: e.tallies.slice() };
  }
  function player(match, seat) {
    const state = match.board;
    // Intentionally explicit: adding a field to a rule state cannot leak it here.
    return { player: seat, active: state.active,
      hand: state.hands[seat].map(t => ({ id: t.id, a: t.a, b: t.b })),
      chain: state.chain.map(p => ({ tileId: p.tileId, inValue: p.inValue, outValue: p.outValue })),
      ends: B.ends(state), opponentCount: state.hands[1 - seat].length,
      stockCount: state.stock.length, passes: state.passes,
      opening: state.chain.length || state.active !== seat ? null : { tileId: state.opening.tileId },
      options: B.legal(state, seat).map(m => ({ tileId: m.tileId, end: m.end })),
      scores: match.scores.slice(), target: match.settings.target,
      history: state.history.map(publicEvent),
      finished: Boolean(state.result), revision: state.revision };
  }
  return { player, publicEvent };
});
