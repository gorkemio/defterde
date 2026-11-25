// Ekran ölçüsü tek yerde: tahta karesi ile dokunma hedefleri birbirinden bağımsızdır.
(function () {
  'use strict';
  const MIN = 14, MAX = 26;

  function aday(width, height, n, touch) {
    const v = Math.max(n, 16);
    if (!touch && width >= 700 && height >= 560) {
      const square = Math.min(MAX, Math.floor(Math.min((width - 24) / (n + 13), (height - 24) / (v + 12.4))));
      if (square >= 18) return { mode: 'genis', square, width: (n + 13) * square + 12, height: (v + 12.4) * square + 12 };
    }
    const mode = width > height ? 'alcak' : 'dar';
    // Yatay: 44 px çetele + 8 px boşluk + tahta + 220 px kumanda + 8 px kenar.
    // Dikey: başlık/zar 124 px, alt kumanda 188 px (sayı paneli) ya da 92 px.
    const footer = touch ? 188 : 92;
    const square = Math.min(MAX, Math.floor(mode === 'alcak'
      ? Math.min((width - 280) / n, (height - 8) / n)
      : Math.min((width - 52) / n, (height - 132 - footer) / n)));
    const size = Math.max(MIN, square), board = n * size;
    return { mode, square: size,
      width: mode === 'alcak' ? board + 280 : Math.max(284, board + 52),
      height: mode === 'alcak' ? Math.max(312, board + 8) : board + 132 + footer,
    };
  }

  function hesapla({ width, height, n, touch = false, safe = {} }) {
    const w = Math.max(0, width - (safe.left || 0) - (safe.right || 0) - 8);
    const h = Math.max(0, height - (safe.top || 0) - (safe.bottom || 0) - 8);
    const d = aday(w, h, n, touch);
    const blocked = d.width > w || d.height > h;
    const other = aday(h, w, n, touch);
    return { ...d, blocked, rotate: blocked && other.width <= h && other.height <= w };
  }

  function olc(n) {
    const vv = window.visualViewport, s = getComputedStyle(document.body);
    const safe = {};
    for (const k of ['top', 'right', 'bottom', 'left']) safe[k] = Math.max(0, parseFloat(s.getPropertyValue('padding-' + k)) - 4);
    const width = document.documentElement.clientWidth;
    // Yakınlaştırmayı yeniden küçültmeyiz. Yalnız ölçek 1'ken görünür alan daralmalarını izleriz.
    const height = vv && Math.abs(vv.scale - 1) < .01 ? Math.min(window.innerHeight, vv.height) : window.innerHeight;
    const touch = window.matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return { ...hesapla({ width, height, n, touch, safe }), touch, safe, viewportHeight: height };
  }

  const api = { hesapla, olc };
  if (typeof window !== 'undefined') (window.AB = window.AB || {}).layout = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
