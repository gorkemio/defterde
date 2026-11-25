// audio/ses.js — oyun olaylarını jel kalem seslerine bağlar (sentez kit/jelkalem.js'te). Sesler kısık başlar (malzeme
// düzeyi .3) ve ses simgesi ya da Ayarlar'dan kapatılır. Kronometre tiki, müzik ve jingle yok.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const KS = () => window.Kit.ses, KY = () => window.Kit.jel.kayis;

  let son = null, geriSon = 0, tikSon = 0, silgiSon = 0;

  const S = {
    // çizim başladı: kayış kurulur (sessizse hiçbir şey olmaz)
    cizBasla() { KY().kur(); son = null; },
    // p: dünya noktası (px), birim: hücre pikseli → hız hücre/s
    cizNokta(p, birim) {
      const t = performance.now();
      if (son) {
        const dt = Math.max(1, t - son.t), v = Math.hypot(p[0] - son.p[0], p[1] - son.p[1]) / birim / (dt / 1000);
        son.v = son.v * .6 + v * .4;
      }
      son = { p, t, v: son ? son.v : 0 };
      KY().hiz(son.v, t - geriSon < 160);
    },
    cizBitir() { KY().dur(); son = null; },
    takildi() { const t = performance.now(); if (t - tikSon > 140) { tikSon = t; KS().cal('tik'); } },
    geri() { geriSon = performance.now(); },
    bitis() { KY().dur(); KS().cal('kapak'); },
    sayfa() { KS().cal('sayfa'); },
    uv() { KS().cal('uv'); },
    // Sonsuz: silgi hızlandıkça sürtünme sıklaşır (hız satır/s)
    silgi(hiz) { const t = performance.now(), ara = Math.max(70, 420 / Math.max(.6, hiz / .6)); if (t - silgiSon > ara) { silgiSon = t; KS().cal('silgi'); } },
  };
  LB.ses = S;
})();
