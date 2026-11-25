// config.js — 5'li XOX ayarları. Tarayıcıda XOX.config, node'da require('./config.js').
// UI'deki ayar notları (rakip, zorluk, sayfa, seri, dokunuş) bunların üstüne localStorage'dan yazılır.
(function () {
  'use strict';

  const config = {
    boyut: 15,                      // sabit sayfa: 15 (19 da olur; yalnız buradan)
    sinirsiz: false,                // sınırsız sayfa: taşlar kenara yaklaşınca yeni kareler açılır
    hamleSiniri: 300,               // sınırsız modda berabere
    tamBes: false,                  // false: okul kuralı (altı ve üstü de kazanır) · true: tam beş
    rakip: 'bilgisayar',            // bilgisayar · ikiKisi
    zorluk: 'orta',                 // kolay · orta · zor
    tehditler: null,                // null: kolayda açık, diğerlerinde kapalı · true / false
    geriAl: true,
    yarisma: false,                 // true: geri alma ve ipucu kapalı
    seri: 1,                        // 1: tek oyun · 3: ilk 3 galibiyet
    ikiDokunus: null,               // null: dokunmatikte açık, fareyle kapalı · true / false
    murekkep: { ben: 'mavisiyah', bilgisayar: 'kirmizi' },
    murekkepler: ['mavisiyah', 'kirmizi', 'yesil', 'mor'],
    ai: { ortaMs: 400, zorMs: 1500, ipucuMs: 600, enAzDusunmeMs: 500 },
    cizim: {},                      // dolma kalem malzemesinin üstüne yazılır (ör. { strokeWidth: 2.2 })
    renk: {},
  };

  if (typeof window !== 'undefined') (window.XOX = window.XOX || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
