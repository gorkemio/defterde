// Ayarlar tek yerde. Tarayıcıda window.AB.config olur; node'da require edilebilir.
(function () {
  'use strict';

  const config = {
    boyut: 10,                                  // 10×10 tahta
    gemiler: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],    // uzunluk listesi (okul varyantı)
    degmeYasak: true,                           // gemiler köşegen dahil değemez
    isabetteTekrar: true,                       // isabette aynı oyuncu tekrar atar
    ilkBaslayan: 'ben',
    ai: {
      parite: true,                             // av modunda satranç deseni kullan
      dusunmeMs: [400, 800],                    // hamle öncesi bekleme
    },
    cizim: {
      roughness: 0,                            // düzgün konturlar; rastgele çizgi sapması yok
      bowing: 0,
      strokeWidth: 1.6,
      fillWeight: 0.8,                          // tarama çizgisi kalınlığı (çizdir bunu tanır)
      sureMs: [150, 300],                       // bir kalem darbesinin süresi
      animasyon: true,                          // false: her şey anında belirir
    },
    renk: {
      mavi: '#1f3b9b',                          // benim tükenmezim
      kirmizi: '#c62828',                       // rakibin tükenmezi
      kursun: '#55534e',                        // kurşun kalem
    },
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
