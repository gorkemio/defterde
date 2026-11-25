// kit/bulmaca/izgara.js — dikdörtgen ızgara durumu (Uint8Array) ve metin kodlaması. Değerlerin anlamı bulmaca türüne aittir.
//   const g = Kit.bulmaca.izgara.Izgara(en, boy); g.koy(r, c, v) → değişti mi; g.yaz() → metin; Izgara.oku(metin)
(function () {
  'use strict';
  // Çalışma uzunluğu kodlaması: "değer×adet" parçaları; değer 0–35 base36, adet base36. Örn. "0x2s.1x3.2x1"
  function rle(dizi) {
    const p = [];
    for (let i = 0; i < dizi.length;) {
      let j = i; while (j < dizi.length && dizi[j] === dizi[i]) j++;
      p.push(dizi[i].toString(36) + (j - i > 1 ? 'x' + (j - i).toString(36) : ''));
      i = j;
    }
    return p.join('.');
  }
  function rleOku(s, n) {
    const o = new Uint8Array(n);
    let i = 0;
    if (s) for (const p of s.split('.')) {
      const [v, a] = p.split('x'), adet = a ? parseInt(a, 36) : 1, d = parseInt(v, 36);
      for (let k = 0; k < adet && i < n; k++) o[i++] = d;
    }
    return o;
  }
  function Izgara(en, boy, veri) {
    const d = veri ? Uint8Array.from(veri) : new Uint8Array(en * boy);
    return {
      en, boy, veri: d,
      al: (r, c) => d[r * en + c],
      koy(r, c, v) { const i = r * en + c; if (d[i] === v) return false; d[i] = v; return true; },
      satir: (r) => Array.from(d.subarray(r * en, r * en + en)),
      sutun: (c) => { const o = []; for (let r = 0; r < boy; r++) o.push(d[r * en + c]); return o; },
      kopya: () => Izgara(en, boy, d),
      bilinmeyenSayisi: () => { let k = 0; for (const v of d) if (!v) k++; return k; },
      yaz: () => `${en}.${boy}.${rle(d)}`,
    };
  }
  Izgara.oku = function (s) {
    const [en, boy, ...geri] = String(s).split('.');
    const w = +en, h = +boy;
    return Izgara(w, h, rleOku(geri.join('.'), w * h));
  };
  const api = { Izgara, rle, rleOku };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).izgara = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
