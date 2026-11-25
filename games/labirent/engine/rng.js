// engine/rng.js — tohumlu rastgelelik ve labirent kodunun tohum alfabesi. DOM'a dokunmaz; tarayıcının rastgelesine hiç başvurmaz.
//   const r = R.rng(R.karma('labirent', 'D', 'O', 'W', 12345))   // r() → [0, 1)
//   R.tohumYaz(123456) → '7KQ9'   R.tohumOku('7KQ9') → 123456   (4 harf, 20 bit; I, O, 0, 1 yok)
(function () {
  'use strict';

  // FNV-1a: aynı parçalardan hep aynı 32 bit (kit/kalem.js'teki karma ile aynı)
  function karma(...p) {
    let h = 2166136261;
    const s = p.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // sfc32: küçük, hızlı, iyi dağılımlı. Tohum 32 bit sayı ya da dize.
  function rng(tohum) {
    let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = (typeof tohum === 'number' ? tohum : karma(tohum)) >>> 0;
    const r = () => {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ (b >>> 9);
      b = c + (c << 3) | 0;
      c = (c << 21) | (c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 12; i++) r();                   // ilk değerler tohuma çok bağlı: ısıt
    return r;
  }

  const tamsayi = (r, n) => Math.floor(r() * n);
  const sec = (r, dizi) => dizi[Math.floor(r() * dizi.length)];

  // Standart normal (Box–Muller)
  function gauss(r) {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }

  const ALFABE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // 32 harf: karışan I/1, O/0 yok
  const TOHUM_UZUNLUK = 4, TOHUM_EN = 32 ** TOHUM_UZUNLUK;   // 1 048 576 tohum

  function tohumYaz(n) {
    let s = '', v = ((n % TOHUM_EN) + TOHUM_EN) % TOHUM_EN;
    for (let i = 0; i < TOHUM_UZUNLUK; i++) { s = ALFABE[v % 32] + s; v = Math.floor(v / 32); }
    return s;
  }
  function tohumOku(s) {
    if (typeof s !== 'string' || s.length !== TOHUM_UZUNLUK) return null;
    let v = 0;
    for (const ch of s.toUpperCase()) { const i = ALFABE.indexOf(ch); if (i < 0) return null; v = v * 32 + i; }
    return v;
  }

  const M = { karma, rng, tamsayi, sec, gauss, ALFABE, TOHUM_EN, tohumYaz, tohumOku };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).rng = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})();
