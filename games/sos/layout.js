// DOM'dan bağımsız yerleşim. Bütün ölçüler CSS pikselidir; kontroller tahta ile küçülmez.
(function () {
  'use strict';
  const MIN = 24, MAX = 44, KONTROL = 160;

  function dikey(w, h, n) {
    const pageW = Math.max(n * MIN + 24, Math.min(w - 8, Math.max(320, n * MAX + 24)));
    const board = Math.max(n * MIN, Math.min(n * MAX, pageW - 24, h - 8 - 292));
    return { mod: 'dikey', pageW, pageH: board + 292, board, boardX: (pageW - board) / 2, boardY: 112,
      headerX: 12, headerY: 12, headerW: pageW - 24, headerH: 64,
      scoreX: 12, scoreY: 80, scoreW: pageW - 24,
      controlsX: 12, controlsY: board + 132, controlsW: pageW - 24 };
  }

  function yatay(w, h, n) {
    const board = Math.max(n * MIN, Math.min(n * MAX, h - 32, w - 8 - 268));
    const x = board + 24;
    return { mod: 'yatay', pageW: board + 268, pageH: Math.max(board + 24, 284), board, boardX: 12, boardY: 12,
      headerX: x, headerY: 12, headerW: 232, headerH: 64,
      scoreX: x, scoreY: 80, scoreW: 232,
      controlsX: x, controlsY: 112, controlsW: 232 };
  }

  function aday(w, h, n) {
    const kw = Math.max(2 * n + 8, 24), tahtaAltSatiri = 2 * n + 8;
    // Tahtadan sonra 24 px nefes, kontroller ve sayfa sonunda 24 px pay.
    const altAlan = 24 + KONTROL + 24;
    const sq = Math.min(22, Math.floor(Math.min((w - 40) / (kw + .4), (h - 40 - altAlan) / (tahtaAltSatiri + .4))));
    if (w >= 600 && sq >= 20) return { mod: 'defter', pageW: kw * sq, pageH: tahtaAltSatiri * sq + altAlan, board: 2 * n * sq,
      boardX: 5 * sq, boardY: 8 * sq, headerX: 5 * sq, headerY: sq, headerW: Math.max(2 * n, 14) * sq, headerH: 6 * sq,
      scoreX: 5 * sq, scoreY: 6.5 * sq, scoreW: Math.max(2 * n, 14) * sq,
      // Sağdaki 5 kare genişliğindeki karakterle menü arasında 12 px boşluk bırak.
      controlsX: 5 * sq, controlsY: tahtaAltSatiri * sq + 24, controlsW: Math.min(292, (kw - 10) * sq - 24) };
    const d = dikey(w, h, n), y = yatay(w, h, n);
    const sigar = l => l.pageW <= w - 8 && l.pageH <= h - 8;
    const sirali = w > h ? [y, d] : [d, y];
    return sirali.find(sigar) || { ...d, kaydir: true };
  }

  function hesapla(w, h, n) {
    const l = aday(w, h, n);
    return { ...l, sq: l.board / (n * 2), kaydir: !!l.kaydir,
      cevir: !!l.kaydir && w < h && !aday(h, w, n).kaydir };
  }

  const L = { hesapla, KONTROL };
  if (typeof window !== 'undefined') (window.SOS = window.SOS || {}).layout = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
