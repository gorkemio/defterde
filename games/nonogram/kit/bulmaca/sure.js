// kit/bulmaca/sure.js — oyun kronometresi: sekme gizlenince duraklar. ms() toplam oyun süresi.
(function () {
  'use strict';
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function Kronometre(baslangicMs = 0) {
    let toplam = baslangicMs, bas = null;
    const k = {
      baslat() { if (bas == null) bas = simdi(); return k; },
      duraklat() { if (bas != null) { toplam += simdi() - bas; bas = null; } return k; },
      devam() { return k.baslat(); },
      sifirla(ms = 0) { toplam = ms; bas = null; return k; },
      ms: () => toplam + (bas != null ? simdi() - bas : 0),
      get calisiyor() { return bas != null; },
    };
    return k;
  }
  // Sekme gizlenince/sayfa kapanınca durdur ve haber ver
  function gorunurlukBagla(kr, kaydet) {
    if (typeof document === 'undefined') return;
    let calisiyordu = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { calisiyordu = kr.calisiyor; kr.duraklat(); kaydet && kaydet(); } else if (calisiyordu) kr.devam();
    });
    addEventListener('pagehide', () => { kaydet && kaydet(); });
  }
  const api = { Kronometre, gorunurlukBagla };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).sure = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
