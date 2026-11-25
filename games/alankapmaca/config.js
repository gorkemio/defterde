// Ayarlar tek yerde. Tarayıcıda window.AB.config olur; node'da require edilebilir.
(function () {
  'use strict';

  const config = {
    boyut: 16,                                  // N×N tahta (ayar panelinden 12 / 16 / 20)
    zar: [1, 6],                                // [en az, en çok]; 1–9 / 1–12 büyükler için
    bitisiklik: false,                          // kendi alanına bitişik olma zorunluluğu
    hesap: { acik: true, deneme: 1, ceza: true },   // çarpım kontrolü: deneme hakkı, yanlışta sıra geçsin mi
    bitisPas: 2,                                // üst üste bu kadar "yer yok" pası oyunu bitirir
    sure: 0,                                    // hamle süresi (sn); 0 = kapalı
    ilkBaslayan: 'ben',
    ai: {
      zorluk: 'zor',                            // 'kolay' = rastgele geçerli yerleşim, 'zor' = heuristik
      dusunmeMs: [500, 900],                    // hamle öncesi bekleme
      agirlik: { engel: 1, kendi: 0.5, temas: 0.05, merkez: 0.05, olu: 0.03 },   // PLAN.md §6
    },
    cizim: {
      duzHiza: true,                            // false: önceki eğik yazı/zar/kontrol görünümüne dön
      roughness: 1.2,
      bowing: 1,
      strokeWidth: 1.6,
      fillWeight: 0.8,                          // tarama çizgisi kalınlığı (çizdir bunu tanır)
      hachureGap: 7,                            // dikdörtgen taraması: seyrek
      sureMs: [150, 300],                       // bir kalem darbesinin süresi
      animasyon: true,                          // false: her şey anında belirir
    },
    renk: {
      mavi: '#1f3b9b',                          // benim tükenmezim
      kirmizi: '#c62828',                       // rakibin tükenmezi
      kursun: '#646464',                        // kurşun kalem
    },
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
