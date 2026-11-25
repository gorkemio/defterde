// ui/yerlesim.js — sayfa yerleşimi, DOM'suz (node'da test edilir). Bütün ölçüler defter karesi (sq) cinsinden.
// İki düzen: 'defter' (geniş ekran; solda marj sütunu) ve 'dikey' (telefon; sayfa ekran genişliğinde, 16 kare).
// Tahta alanında dünya = ipucu bantları + ızgara; s = 1'de bir bulmaca karesi bir defter karesidir.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const R = node ? require('../kit/rakam.js') : window.Kit.rakam;
  const C = node ? require('../config.js') : window.KK.config;

  // Bir satır ipucunun genişliği (sayılar arası boşluk C.ipucuAralik · rakam boyu); zemin.js aynı ölçüyü kullanır
  function satirIpucuGenislik(ip, boyut) {
    let w = 0;
    ip.forEach((v, j) => { w += R.genislik(String(v), boyut) + (j ? C.ipucuAralik * boyut : 0); });
    return w;
  }
  // İpucu bantlarının boyu (kare): satır ipuçları yan yana, sütun ipuçları üst üste
  function bantlar(b) {
    let w = 0, n = 0;
    for (const ip of b.ipuclari.satir) w = Math.max(w, satirIpucuGenislik(ip, C.ipucuBoyut));
    for (const ip of b.ipuclari.sutun) n = Math.max(n, ip.length);
    return { Lw: Math.max(1, Math.ceil(w + .55)), Lh: Math.max(1, Math.ceil(n * C.ipucuAdim + .4)) };
  }

  // o: { vw, vh, en, boy, Lw, Lh, dokunmatik, cocuk }
  function yerlesim(o) {
    const dar = o.vw < 720;
    const minPx = o.cocuk ? C.minHucrePx.cocuk : o.dokunmatik ? C.minHucrePx.dokunmatik : C.minHucrePx.fare;
    const DW = o.Lw + o.en, DH = o.Lh + o.boy;          // dünya (kare)
    if (!dar) {
      const marj = 6, Wsq = Math.max(28, marj + 2 + DW), Hsq = 3 + DH + 2 + 3 + 1;
      const sq = Math.max(12, Math.min(32, Math.floor(Math.min((o.vw - 24) / Wsq, (o.vh - 24) / Hsq))));
      const icW = Wsq - marj - 2, ax = marj + 1 + Math.floor((icW - DW) / 2);
      let s0 = 1;
      if (sq < minPx) s0 = minPx / sq;
      return {
        duzen: 'defter', sq, Wsq, Hsq, marjX: marj,
        baslik: { x: marj + 1, y: .6, w: icW, h: 2.2 },
        marj: { x: .5, y: 3, w: marj - 1, h: Hsq - 4 },
        alan: { x: ax, y: 3, w: DW, h: DH },
        ad: { x: marj + 1, y: 3 + DH, w: icW, h: 2 },
        komutlar: { x: marj + 1, y: Hsq - 4, w: icW, h: 3 },
        s0, smin: 1, smax: Math.max(s0 * 1.8, 2.4),
      };
    }
    const Wsq = 16, sq = Math.max(16, Math.min(34, Math.floor(o.vw / Wsq)));
    const Hsq = Math.max(18, Math.floor(o.vh / sq));
    const alanH = Math.max(8, Hsq - 8);
    const fit = Math.min(Wsq / DW, alanH / DH);
    const s0 = fit * sq >= minPx ? Math.min(fit, 60 / sq) : minPx / sq;
    return {
      duzen: 'dikey', sq, Wsq, Hsq, marjX: 1,
      baslik: { x: 1.3, y: 0, w: 14.4, h: 2 },
      marj: { x: 1.3, y: 2, w: 14.4, h: 2 },
      alan: { x: 0, y: 4, w: Wsq, h: alanH },
      ad: { x: 1.3, y: 4 + alanH, w: 14.4, h: 1 },
      komutlar: { x: 1.3, y: 5 + alanH, w: 14.4, h: Hsq - 5 - alanH },
      s0, smin: Math.min(fit, s0), smax: Math.max(s0 * 1.8, 64 / sq),
    };
  }

  // Defterler (albüm) ekranı
  function albumYerlesim(o) {
    const dar = o.vw < 720;
    if (dar) { const sq = Math.max(16, Math.min(34, Math.floor(o.vw / 16))); return { duzen: 'dikey', sq, Wsq: 16, Hsq: Math.max(18, Math.floor(o.vh / sq)), marjX: 1 }; }
    const Wsq = 34, sq = Math.max(14, Math.min(30, Math.floor((o.vw - 24) / Wsq)));
    return { duzen: 'defter', sq, Wsq, Hsq: Math.max(26, Math.floor((o.vh - 24) / sq)), marjX: 5 };
  }

  const Y = { bantlar, yerlesim, albumYerlesim, satirIpucuGenislik };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).yerlesim = Y;
  if (node) module.exports = Y;
})();
