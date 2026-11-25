// Ayarlar tek yerde. Tarayıcıda window.KF.config olur; node'da require edilebilir.
// Sayfadaki ayar notları (zorluk, iki kişilik, maç...) bunların üstüne yazar; saha boyutu ve ilkBaslayan yalnız burada.
(function () {
  'use strict';

  const config = {
    saha: { W: 8, H: 10 },                      // varsayılan saha: 8×10 kare (9×11 nokta). W çift olmalı
    sahalar: {                                  // sayfadaki "saha" seçimi
      kucuk: { W: 6, H: 8 },
      normal: { W: 8, H: 10 },
      uzun: { W: 8, H: 11 },                    // tek sayılı boy: başlangıç noktası başlayanın kendi yarısında
    },
    kurallar: {
      agizSeker: true,                          // kale ağzı ortası baştan ziyaretli: oraya varan top seker
      sikismaMac: 'gol',                        // maç modunda sıkışma: 'gol' rakibe gol · 'tekrar' sayfa tekrar · 'mac' maçı bitirir
    },
    surukle: false,                             // telefonda toptan sürükleme (sahada sayfa kaydırması kapanır)
    kesisme: true,                              // çapraz çizgiler birbirini kesebilir
    ilkBaslayan: 0,                             // 0 mavi (ben / 1. oyuncu) · 1 kırmızı (rakip / 2. oyuncu)
    zorluk: 'orta',                             // kolay · orta · zor
    ikiKisi: false,                             // aynı ekranda iki kişi, bilgisayar yok
    evModu: false,                              // sıra rakibe geçtikten sonra da geri alma
    mac: false,                                 // maç modu: ilk macGol gole ulaşan kazanır
    macGol: 3,
    ai: {
      butceMs: { kolay: 200, orta: 400, zor: 800 },   // düşünme zaman bütçesi
      dusunmeMs: [400, 800],                    // hamle öncesi en az bekleme (karakter "..." yapar)
      dilimMs: 12,                              // ana thread'i bu kadar tutup setTimeout ile bırak
    },
    cizim: {
      roughness: 1.1,
      bowing: 1,
      strokeWidth: 1.6,
      fillWeight: 0.8,                          // tarama çizgisi kalınlığı (cizdir bunu tanır)
      sureMs: [120, 200],                       // bir kalem darbesinin süresi (hamle çizgisi 120–200 ms)
      animasyon: true,                          // false: her şey anında belirir
    },
    renk: {
      mavi: '#1f3b9b',                          // benim tükenmezim
      kirmizi: '#c62828',                       // rakibin tükenmezi
      kursun: '#59574f',                        // kurşun kalem
      lacivert: '#16224f',                      // saha çizgileri: koyu lacivert tükenmez
      kagit: '#fbf9f2',
    },
  };

  // W çift ve ≥ 4 (kale 2 kare geniş, yanında çapraz kaçış noktası olsun); H ≥ 2 (tekse başlangıç noktası başlayana göre).
  config.dogrula = function (W, H) {
    if (!Number.isInteger(W) || W < 4 || W % 2) throw new Error('W çift ve en az 4 olmalı: ' + W);
    if (!Number.isInteger(H) || H < 2) throw new Error('H en az 2 olmalı: ' + H);
    return true;
  };
  config.dogrula(config.saha.W, config.saha.H);

  const KF = typeof window !== 'undefined' ? (window.KF = window.KF || {}) : {};
  KF.config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
