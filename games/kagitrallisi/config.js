// config.js — Kağıt Rallisi varsayılan ayarları (DOM yok; node'da da okunur). Oyuncunun seçimleri localStorage 'kr-ayar'da.
(function () {
  'use strict';
  const C = {
    // yarış kuralları
    kural: {
      tur: 1,                       // 1–3
      carpma: 'okul',               // okul: yerinde kal, hız 0, bir tur bekle · sert: elenir
      kesisme: true,                // yollar kesişebilir mi
      yerindeDurma: 'zorunlu',      // zorunlu: yalnız başka yasal aday yokken · serbest
    },
    mod: 'bilgisayar',              // bilgisayar · aynicihaz · solo · gunun
    pist: 'ilk-viraj',
    zorluk: 'orta',                 // kolay · orta · zor
    rakip: 1,                       // bilgisayara karşı rakip sayısı (1–3)
    seri: false,                    // 3 pistlik seri
    oyuncuSayisi: 2,                // aynı cihaz: 2–4
    adlar: ['Mavi', 'Kırmızı', 'Yeşil', 'Turuncu'],
    renkler: ['mavi', 'kirmizi', 'yesil', 'turuncu'],
    frenIzi: false,
    yarisModu: false,               // geri alma kapalı
    kontrolGoster: false,
    ai: { dusunmeMs: [400, 800] },
    bfs: { hizSiniri: 9, dilimMs: 12 },
    gen: { W: 40, H: 26, parAlt: 18, parUst: 40, enCokDeneme: 40 },
    cizim: {},                      // keçeli kalem malzemesinin üstüne yazım (boş: malzemenin değerleri)
    renk: {},
  };
  if (typeof window !== 'undefined') (window.KR = window.KR || {}).config = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})();
