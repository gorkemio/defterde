// Small UI operations kept independent of the game controller.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Domino ||= {}).uiSupport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function reconcileChildren(parent, nodes) {
    const document = parent.ownerDocument;
    const focused = parent.contains(document.activeElement) ? document.activeElement : null;
    const retained = new Set(nodes);
    for (const node of [...parent.children]) if (!retained.has(node)) node.remove();
    nodes.forEach((node, index) => {
      if (parent.children[index] !== node) parent.insertBefore(node, parent.children[index] || null);
    });
    // insertBefore detaches a moved node in browsers that lack moveBefore.
    if (focused && parent.contains(focused) && document.activeElement !== focused)
      focused.focus({ preventScroll: true });
  }
  function resultCopy(match) {
    const result = match.board.result;
    if (!result) return null;
    const names = match.settings.names;
    const winner = result.winner === null ? 'Berabere' : `${names[result.winner]} kazandı`;
    const title = match.result ? `${winner} · Maç bitti` : `${winner}!`;
    const totals = `${names[0]}: ${result.tallies[0]}, ${names[1]}: ${result.tallies[1]} nokta.`;
    const points = result.winner === null ? 'Puan verilmedi.' :
      `${names[result.winner]} +${result.points} puan aldı.${result.points === 0 ? ' Bu da bir galibiyet.' : ''}`;
    const detail = `${result.reason === 'empty' ? 'El bitti.' : 'İki pas: el kilitlendi.'} ${totals} ${points}`;
    return { title, detail, announcement: `${title}${title.endsWith('!') ? '' : '.'} ${detail}` };
  }
  function announceResult(document, copy) {
    const live = document.getElementById('announcement');
    if (live.textContent !== copy.announcement) live.textContent = copy.announcement;
    const heading = document.getElementById('result-title');
    // Do not steal focus from help/setup dialogs opened during an AI turn.
    if (!document.querySelector('dialog[open]')) heading.focus({ preventScroll: true });
  }
  return { reconcileChildren, resultCopy, announceResult };
});
