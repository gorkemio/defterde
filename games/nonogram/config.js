// config.js — Kare Karalamaca ayarları (tarayıcıda KK.config, node'da module.exports).
(function () {
  'use strict';
  const C = {
    dprTavan: 2,
    minHucrePx: { dokunmatik: 28, fare: 18, cocuk: 40 },
    cizimMs: 120,              // dolu karenin taranma süresi
    kirintiMs: 900,
    uzunBasmaMs: 350,
    kilitEsik: .45,            // sürükleme yön kilidi (kare cinsinden hareket)
    yenidenOran: .25,          // yakınlaşma durunca katmanları yeniden çizme eşiği
    buyutec: { cap: 112, oran: 2, yukari: 44 },
    haritaPx: 78,
    ipucuMs: 6000,
    ipucuBoyut: .56,           // ipucu rakamının kare boyuna oranı
    ipucuAdim: .72,            // sütun ipuçlarında rakamlar arası (kare)
    ipucuAralik: .7,           // satır ipuçlarında sayılar arası boşluk (rakam yüksekliğine oran)
    modlar: ['klasik', 'rahat', 'ucsilgi'],
    modAdi: { klasik: 'Klasik', rahat: 'Rahat', ucsilgi: 'Üç Silgi' },
    araclar: ['kalem', 'carpi', 'silgi'],
    varsayilanAyar: { mod: 'klasik', arac: 'kalem', otoCarpi: false, ustunuCiz: true, buyutec: true, ses: true, cocuk: false },
    // Günün karalaması: haftanın günü (0 pazar … 6 cumartesi) → boy
    gunluk: { baslangic: '2026-10-19', takvim: { 1: [10, 10], 2: [10, 15], 3: [15, 15], 4: [15, 20], 5: [20, 20], 6: 'kilim', 0: [25, 25] }, yedek: { '10x15': [10, 10], '15x20': [15, 15] } },
    kilimBoylari: [11, 15, 19, 21],
    hedefBant: { 5: 'kolay', 10: 'orta', 15: 'zor', 20: 'uzman', 25: 'uzman' },
  };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).config = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})();
