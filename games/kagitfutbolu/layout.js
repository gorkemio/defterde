// Saf görünüm hesabı. Motorun koordinatları ve oyun durumu yön değişiminden etkilenmez.
(function () {
  'use strict';
  function sigdir(W, H, width, height, yatay) {
    const en = yatay ? H + 3 : W + 1, boy = yatay ? W + 1 : H + 3;
    const adim = Math.max(0, Math.min(56, width / en, height / boy));
    return { width: en * adim, height: boy * adim, adim };
  }
  const ekranYon = (dx, dy, yatay) => yatay ? [-dy || 0, dx] : [dx, dy];
  const sahaYon = (dx, dy, yatay) => yatay ? [dy, -dx || 0] : [dx, dy];
  // Baskıyı kâğıdın merkezinde ters döndür; kare başlangıcını saha noktasına bağla.
  function izgaraHizasi(w, h, aci, kare, x, y) {
    const r = -aci * Math.PI / 180, a = Math.cos(r), b = Math.sin(r);
    return {
      x: ((x % kare) + kare) % kare, y: ((y % kare) + kare) % kare,
      matris: [a, b, -b, a, w / 2 - a * w / 2 + b * h / 2, h / 2 - b * w / 2 - a * h / 2],
    };
  }
  const L = { sigdir, ekranYon, sahaYon, izgaraHizasi };
  if (typeof window !== 'undefined') (window.KF = window.KF || {}).layout = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
