// Ayarlar tek yerde. Tarayıcıda window.NK.config olur; node'da require edilebilir.
// Sayfadaki "Ayarlar" notu mod, zorluk, boyut, baş harfler ve paletin üstüne yazar; gerisi yalnız burada.
(function () {
  'use strict';

  const config = {
    boyut: '5x5',                               // nokta sayısı (satır × sütun)
    boyutlar: { '4x4': [4, 4], '5x5': [5, 5], '6x6': [6, 6], '7x7': [7, 7], '6x8': [6, 8] },
    mod: 'bilgisayar',                          // bilgisayar · ikiKisi · bulmaca
    zorluk: 'orta',                             // kolay · orta · zor
    basHarf: ['S', 'B'],                        // bilgisayara karşı: sen · bilgisayar
    ikiKisiHarf: ['A', 'B'],                    // aynı cihazda iki kişi
    palet: 'yesil-turuncu',                     // yesil-turuncu · mor-sari (kit/kuruboya.js)
    tehlike: null,                              // null: zorluğa göre (yalnız kolayda açık) · true · false
    zincirler: false,                           // zincirleri kalemle çevrele (öğretmek için)
    ai: {
      zor: { butceMs: 800, derinlik: 4 },
      ipucu: { butceMs: 500 },
      enAzBekleMs: [400, 700],                  // bilgisayarın çizgisi en erken bu kadar sonra
      zincirAraMs: 450,                         // art arda kutu alırken çizgiler arası
    },
    dokunma: { esikPx: 24, ayrimPx: 2 },        // en yakın çizgi en çok 24 px uzakta; iki aday 2 px'ten yakınsa hiçbiri
    animasyon: { cizgiMs: [120, 160], kutuMs: 250, harfGecikmeMs: 40, kutuArasi: .85 },   // kalem çizgisi, kuru boya karalaması
    izle: { bekleMs: [700, 900], tohumlar: [2, 7, 5, 8] },   // "izle": düşünme süresi; üç anın (zincir, bir daha, ikisi hariç)
                                                // hepsinin çıktığı tohumlu oyunlar, her izleyişte sıradaki
    cizim: { strokeWidth: 1.4 },                // kurşun kalem malzemesinin üstüne yazım (kit/kursunkalem.js)
    renk: {},
  };

  if (typeof window !== 'undefined') (window.NK = window.NK || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
