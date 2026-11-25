// sesler.js — Adam Asmaca'ya özgü sesler (Web Audio sentezi; ses dosyası yok). kit/ses.js'in ortak seslerine (kalem, cit, kazan) ek olarak
// Kit.ses.sentez'e eklenir. Hepsi kısa ve yumuşak: kasvetli ses yok.
//   ip     — ip kopması: kısa gürültü patlaması ve düşen ton
//   adim   — koşan adamın ayak sesleri (8 hafif tıkırtı, ~0,9 sn)
//   cevir  — sayfa çevirme: süpürülen gürültü
//   hehe   — kayıpta Hoca'nın kıkırdaması: iki kısa, tiz nota ikilisi
(function () {
  'use strict';

  const S = window.Kit && window.Kit.ses;
  if (!S) return;

  S.sentez.ip = function (c, h, t0) {
    S.parazit(c, h, t0, 'highpass', 3200, 6500, 0.8, 0.05, 0.32);
    S.nota(c, h, t0 + 0.01, 'triangle', 340, 95, 0.2, 0.2);
  };

  S.sentez.adim = function (c, h, t0) {
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * 0.115;
      S.nota(c, h, t, 'sine', i % 2 ? 170 : 140, 70, 0.07, 0.16);
      S.parazit(c, h, t, 'lowpass', 900, 400, 0.7, 0.04, 0.07);
    }
  };

  S.sentez.cevir = function (c, h, t0) {
    S.parazit(c, h, t0, 'bandpass', 500, 2400, 0.6, 0.5, 0.2);
    S.parazit(c, h, t0 + 0.12, 'highpass', 2600, 5200, 0.7, 0.3, 0.05);
  };

  S.sentez.hehe = function (c, h, t0) {
    [[587.33, 0.08], [493.88, 0.08], [587.33, 0.08], [493.88, 0.13]].forEach(([f, s], i) => S.nota(c, h, t0 + i * 0.1, 'square', f, f * 0.99, s, 0.09));
  };
})();
