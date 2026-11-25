// config.js — arayüz ve mod sabitleri tek yerde (motor tabloları kendi dosyalarında). Node'da da okunur.
(function () {
  'use strict';
  const C = {
    surum: 1,
    mac: { tur: 5, secenek: [3, 5, 7], seviye: 'orta', sureS: 90, ipucuCezaS: 15, ozelTur: { 3: [1], 5: [3], 7: [2, 5] } },
    hepsini: { sureS: 75 },
    boz: { tur: 3, sureS: 90, dusunmeMs: [2200, 3600] },
    yaris: { sureS: 90 },
    gecmis: 500,
    kitapBoyu: 100,
    gunun: { kategori: 'tek', bant: 'orta', enCokHucre: 6, baslangic: '2026-10-01' },
    sonsuz: { karisim: { tek: .65, iki: .1, ekle: .1, cikar: .1, romen: .05 } },
    // Ölçü: çöp boyu L (px). Telefonda en az 44 px; dar ekranda (< 360 px) en az 38 px.
    olcu: { enAzL: 44, enAzLDar: 38, enAzLMasa: 54, enCokL: 84, acikPx: 1180 },
    copOrani: .82,               // görünen çöp / yuva boyu (birleşim yerlerinde boşluk: rakam okunur)
    yakalama: .62,               // en yakın boş yuvanın yakalanma yarıçapı (L cinsinden)
    dokunmaYukari: 30,           // dokunmatikte çöp parmağın kaç px üstünde taşınır
    notSureMs: 1800,
    sesSeviye: .35,
    anahtar: 'kb',
  };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).config = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})();
