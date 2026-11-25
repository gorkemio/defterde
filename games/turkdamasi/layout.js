// Çizim, hücre sırası ve klavye aynı a1=0 koordinatlarını kullanır.
(function (root) {
  'use strict';
  const name = i => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1);
  const center = (i, flipped = false) => {
    const n = flipped ? 63 - i : i;
    return [100 * (n % 8) + 50, 100 * (7 - Math.floor(n / 8)) + 50];
  };
  const rows = Object.freeze(Array.from({ length: 8 }, (_, y) =>
    Object.freeze(Array.from({ length: 8 }, (_, x) => (7 - y) * 8 + x))));
  function navigate(i, key, flipped = false) {
    if (flipped) return 63 - navigate(63 - i, key);
    const x = i % 8, y = Math.floor(i / 8);
    switch (key) {
      case 'ArrowLeft': return i - (x > 0 ? 1 : 0);
      case 'ArrowRight': return i + (x < 7 ? 1 : 0);
      case 'ArrowUp': return i + (y < 7 ? 8 : 0);
      case 'ArrowDown': return i - (y > 0 ? 8 : 0);
      case 'Home': return i - x;
      case 'End': return i + 7 - x;
      default: return i;
    }
  }
  root.TD.layout = Object.freeze({ name, center, rows, navigate });
})(globalThis);
