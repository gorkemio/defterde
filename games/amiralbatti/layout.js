// DOM'dan bağımsız yerleşim hesabı. Bütün ölçüler CSS pikselidir.
(function () {
  'use strict';
  const tahta = (alan) => Math.floor(alan / 22) * 22; // hücre = iki tam defter karesi
  function hesapla({ width, height, insets = {} }) {
    const w = Math.max(0, width - (insets.left || 0) - (insets.right || 0));
    const h = Math.max(0, height - (insets.top || 0) - (insets.bottom || 0));
    // Dikey tablette büyük çalışma tahtası; altta 220px genel görünüm ve kontroller.
    // 40px ana başlık/kenar + 260px alt bölüm + 16px boşluk/kenar = 316px.
    const tablet = tahta(Math.min(726, w - 32, h - 336));
    if (w >= 600 && h > w && tablet >= 528) {
      return { mod: 'tablet', ana: tablet, diger: 220, width: tablet + 16, height: tablet + 316, duraklat: false };
    }

    const sq = Math.min(19, Math.floor((w - 24) / 54), Math.floor((h - 16) / 34));
    if (sq >= 18) return { mod: 'defter', sq, ana: 22 * sq, diger: 22 * sq, width: 54 * sq + 24, height: 34 * sq + 16, duraklat: false };

    // Kompakt sayfa: tahta + 8px kenar + 32px başlık. Alt araç çubuğu 44px.
    const esit = tahta(Math.min(418, (w - 32) / 2, h - 100));
    if (esit >= 264) return { mod: 'yatay', ana: esit, diger: esit, width: 2 * esit + 32, height: esit + 100, duraklat: false };

    // Küçük tahta 132px (12px hücre); yanındaki kontroller 156×140px.
    const dikey = tahta(Math.min(418, w - 16, h - 216));
    if (w >= 312 && dikey >= 264) return { mod: 'dikey', ana: dikey, diger: 132, width: Math.max(dikey + 16, 312), height: dikey + 216, duraklat: false };

    const yan = tahta(Math.min(418, w - 188, h - 48));
    if (h >= 316 && yan >= 264) return { mod: 'yan', ana: yan, diger: 132, width: yan + 188, height: Math.max(yan + 48, 316), duraklat: false };
    return { mod: 'dikey', ana: 264, diger: 132, width: 312, height: 480, duraklat: true };
  }
  const L = { hesapla };
  if (typeof window !== 'undefined') (window.AB = window.AB || {}).layout = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
