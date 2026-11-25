// layout.js — üç düzen modu ve kare boyu. DOM'a dokunmaz: ekran ölçüsünü alır, sayfanın kare cinsinden ölçüsünü ve
// bir karenin piksel boyunu döndürür. İçindekiler, oyun ve kart sayfaları AYNI kutuyu kullanır (sayfa çevirince boyut değişmez).
//   defter  ≥ 900 px: 26 × 35 kare, sayfa hafif eğik, köşe karalamaları var
//   tablet  600–899 px: aynı yerleşim, eğim yok, kare boyu genişliğe göre büyür
//   kompakt < 600 px: 22 × 39 kare, marj ince, alfabe altta tam genişlik klavye, süs yok
(function () {
  'use strict';

  const MODLAR = {
    defter:  { kw: 26, kh: 35, marjK: 8.5, ix: 9.2, iw: 16,   egim: -0.6, susler: true,  hucre: { w: 1.6, h: 1.8 } },
    tablet:  { kw: 26, kh: 35, marjK: 8.5, ix: 9.2, iw: 16,   egim: 0,    susler: true,  hucre: { w: 1.6, h: 1.8 } },
    kompakt: { kw: 22, kh: 39, marjK: 1.5, ix: 2.1, iw: 19.3, egim: 0,    susler: false, hucre: { w: 19.3 / 8, h: 2.4 } },
  };

  const sinirla = (v, a, b) => Math.max(a, Math.min(b, v));

  function modSec(vw) { return vw >= 900 ? 'defter' : vw >= 600 ? 'tablet' : 'kompakt'; }

  // vw, vh: kullanılabilir alan (CSS px). Döner: { mod, sq, kw, kh, marjK, ix, iw, egim, susler, hucre }
  function hesapla({ vw, vh }) {
    const mod = modSec(vw), m = MODLAR[mod];
    let sq;
    if (mod === 'defter') sq = sinirla(Math.floor(Math.min((vw - 64) / m.kw, (vh - 40) / m.kh)), 16, 24);
    else if (mod === 'tablet') sq = sinirla(Math.floor(Math.min((vw - 32) / m.kw, Math.max((vh - 24) / m.kh, 0))), 16, 26);
    else sq = sinirla(Math.floor((vw - 8) / m.kw), 12, 24);
    return { mod, sq, ...m, hucre: { ...m.hucre } };
  }

  const L = { hesapla, modSec, MODLAR };
  if (typeof window !== 'undefined') ((window.AA = window.AA || {}).layout = L);
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
