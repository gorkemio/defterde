// audio/sesler.js — Web Audio sentezi (ses dosyası yok). Kibrit nesnelerinin seslerini ve defter seslerini Kit.ses.sentez'e ekler.
// Kibrit çakma, alev, cızırtı yok; müzik ve jingle yok. Kısık başlar (.35), "Ses" simgesiyle kapatılır.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  function kur() {
    const S = Kit.ses;
    Object.assign(S.sentez, Kit.kibrit.sesler, {
      // kalem çentiği: kısa, kuru bir grafit çizgisi
      centik(c, h, t0) {
        S.parazit(c, h, t0, 'bandpass', 3400, 2600, 1.6, .045, .07);
        S.parazit(c, h, t0 + .01, 'highpass', 5200, 6000, .7, .03, .025);
      },
      // kırmızı kalemle işaret (eski adıyla "damga"): iki hızlı kalem darbesi
      damga(c, h, t0) {
        S.parazit(c, h, t0, 'bandpass', 2800, 4200, 1.1, .11, .12);
        S.parazit(c, h, t0 + .13, 'bandpass', 3600, 2200, 1.3, .16, .1);
      },
      // yeni bulmaca: defter sayfası (eski adıyla "hışırtı"): yumuşak kâğıt sesi
      hisirti(c, h, t0) {
        S.parazit(c, h, t0, 'bandpass', 1400, 3200, .7, .3, .1);
        S.parazit(c, h, t0 + .08, 'highpass', 2600, 5200, .6, .22, .05);
      },
    });
  }
  KB.sesler = { kur };
})();
