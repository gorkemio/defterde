// audio/sesler.js — Kare Karalamaca sesleri (Web Audio sentezi, dosya yok). Kit.ses.sentez'e eklenir; müzik yok.
// tarama (kuru grafit sürtmesi) · carpi (iki küçük çizik) · silgi (kauçuk sürtünmesi) · cetvel (bulmaca başı: cetvel ve kalem) ·
// teneke (kuru boya kutusunun kapağı) · boya (mumsu vuruşlar) · sayfa (sayfa çevirme). Hepsi kısık başlar; Ses sözcüğüyle kapanır.
(function () {
  'use strict';
  const Kit = window.Kit, ses = Kit.ses, sentez = ses.sentez;
  const { nota, parazit } = ses;
  let sonTarama = 0;

  // Kısa, kuru grafit sürtmesi (sürüklemede en çok 40 ms'de bir)
  sentez.tarama = (c, h, t0) => {
    const simdi = performance.now();
    if (simdi - sonTarama < 40) return;
    sonTarama = simdi;
    const f = 2200 + Math.random() * 900;
    parazit(c, h, t0, 'bandpass', f, f * .7, 1.4, .07, .22);
    parazit(c, h, t0 + .012, 'highpass', 4200, 3000, .7, .04, .07);
  };
  sentez.carpi = (c, h, t0) => {
    parazit(c, h, t0, 'bandpass', 3400, 2600, 2.2, .035, .2);
    parazit(c, h, t0 + .07, 'bandpass', 3100, 2300, 2.2, .035, .18);
  };
  sentez.silgi = (c, h, t0) => {
    if (sentez.kayma) return sentez.kayma(c, h, t0, 'silgi');
    parazit(c, h, t0, 'lowpass', 900, 500, .9, .18, .25);
  };
  // Bulmaca başı: cetvel tıkı + kalem çizgisi
  sentez.cetvel = (c, h, t0) => {
    nota(c, h, t0, 'triangle', 520, 380, .05, .12);
    parazit(c, h, t0 + .06, 'bandpass', 1800, 1300, 1.1, .32, .12);
    parazit(c, h, t0 + .42, 'bandpass', 1900, 1500, 1.1, .2, .1);
  };
  // Teneke kapak: metalik tınlama + menteşe gıcırtısı
  sentez.teneke = (c, h, t0) => {
    nota(c, h, t0, 'sawtooth', 180, 120, .12, .04);
    for (const [f, a] of [[860, .1], [1370, .07], [2140, .05], [3020, .03]]) nota(c, h, t0 + .1, 'sine', f, f * .985, .55, a);
    parazit(c, h, t0 + .1, 'highpass', 5000, 4000, .8, .05, .06);
  };
  // Mumsu kuru boya vuruşu
  sentez.boya = (c, h, t0, arg) => {
    if (sentez.karalama) return sentez.karalama(c, h, t0, arg || 160);
    parazit(c, h, t0, 'bandpass', 700, 500, .8, .16, .2);
  };
  sentez.sayfa = (c, h, t0) => {
    if (sentez.kayma) return sentez.kayma(c, h, t0, 'sayfa');
    parazit(c, h, t0, 'bandpass', 1200, 400, .6, .4, .2);
  };
  sentez.cizik = sentez.cizik || ((c, h, t0) => parazit(c, h, t0, 'bandpass', 2800, 2000, 3, .05, .2));
  ses.seviye(.35);
})();
