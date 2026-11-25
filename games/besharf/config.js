// config.js — Beş Harf sabitleri (UI ve modlar). Motor tabloları kendi dosyalarında.
(function () {
  'use strict';
  const C = {
    yayinGunu: '2026-10-20',          // No. 1 (Europe/Istanbul takvim günü)
    saatDilimi: 'Europe/Istanbul',
    hak: 6,
    uzunluk: 5,
    gecmis: 500,                      // Serbest: son kaç cevap tekrar gelmez
    havuz: 6000,                      // çözücü öneri havuzu (tahmin listesinin en sık N'i)
    duello: { secenek: [3, 5], varsayilan: 3, seviye: 'orta' },
    isaretGecikmeMs: 150,             // işaretler soldan sağa bu arayla çizilir
    vurusMs: 60,                      // daktilo vuruşu
    depoOnek: 'bh-',
    port: 8146,
  };
  if (typeof window !== 'undefined') (window.BH = window.BH || {}).config = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})();
