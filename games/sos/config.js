// Ayarlar tek yerde. Tarayıcıda window.SOS.config olur; node'da require edilebilir.
// Sayfadaki ayar notları (zorluk, ipucu, fazla tur, iki kişi) bunların üstüne yazar; boyut ve ilkBaslayan yalnız burada.
(function () {
  'use strict';

  const config = {
    boyut: 8,                                   // N×N ızgara, 5–12
    fazlaTur: true,                             // SOS yapan bir kez daha oynar
    ilkBaslayan: 0,                             // 0 mavi (ben / 1. oyuncu) · 1 kırmızı (rakip / 2. oyuncu)
    zorluk: 'orta',                             // kolay · orta · zor
    ipucu: false,                               // rakibe SOS hazırlayan hücreleri kurşun kalem noktasıyla işaretle
    ikiKisi: false,                             // aynı ekranda iki kişi, bilgisayar yok
    ai: {
      dusunmeMs: [400, 800],                    // hamle öncesi bekleme
      tamAramaBos: 12,                          // zor: bu kadar ya da daha az boş hücre kalınca tam arama
    },
    cizim: {
      roughness: 1.1,
      bowing: 1,
      strokeWidth: 1.6,
      fillWeight: 0.8,                          // tarama çizgisi kalınlığı (cizdir bunu tanır)
      sureMs: [200, 300],                       // bir kalem darbesinin süresi (harf yazma süresi)
      animasyon: true,                          // false: her şey anında belirir
    },
    renk: {
      mavi: '#1f3b9b',                          // benim tükenmezim
      kirmizi: '#c62828',                       // rakibin tükenmezi
      kursun: '#555555',                        // kurşun kalem
    },
  };

  if (typeof window !== 'undefined') (window.SOS = window.SOS || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
