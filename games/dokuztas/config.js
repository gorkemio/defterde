// Ayarlar tek yerde. Tarayıcıda window.DT.config olur; node'da require edilebilir.
// Sayfadaki "Ayarlar" bloğu zorluk, rakip, taş seti, uçma ve notasyonun üstüne yazar; gerisi yalnız burada.
(function () {
  'use strict';

  const config = {
    kurallar: {
      ucma: true,                     // 3 taşı kalan, taşını herhangi bir boş noktaya götürebilir
      kosegen: false,                 // köşegenli varyant (köşeler de bağlı; 4 değirmen hattı daha)
      ciftDegirmenIkiTas: false,      // bir hamlede iki değirmen kurulursa iki taş alınır
      hepsiDegirmendeyseAl: true,     // rakibin bütün taşları değirmendeyse herhangi biri alınabilir
      tekrar: 3,                      // aynı konum bu kadar kez olursa berabere (0: kapalı)
      tassizHamle: 50,                // taş alınmadan bu kadar yarım hamle (hareket/uçma) → berabere (0: kapalı)
    },
    zorluk: 'orta',                   // kolay · orta · zor
    ikiKisi: false,                   // aynı cihazda iki kişi, bilgisayar yok
    tasSeti: 'cakil',                 // cakil (koyu dere taşı + açık çakıl) · fasulye (kara fasulye + kuru beyaz fasulye, köy usulü)
    notasyon: false,                  // a1–g7 tahtanın kenarında silik
    ai: {
      kolay: { derinlik: 2, gurultu: 20, butceMs: 150 },
      orta: { derinlik: 6, butceMs: 500 },
      zor: { derinlik: 32, butceMs: 1500 },
      ipucu: { zorluk: 'zor', butceMs: 500 },
      enAzBekleMs: [500, 900],        // bilgisayar en erken bu kadar sonra oynar
    },
    cizim: {},                        // malzemenin (kit/kursunkalem.js) üstüne yazmak için: { roughness, strokeWidth, ... }
    renk: {},                         // { ana, vurgu, kursun }
  };

  if (typeof window !== 'undefined') (window.DT = window.DT || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
