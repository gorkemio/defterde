// data/defterler.js — kategori defterleri (albüm sırası ve kapak rengi)
(typeof window !== "undefined" ? window : globalThis).KK_DEFTERLER = [
  { id: 'mutfak', ad: 'Mutfak', sira: 1, kapak: 'kirmizi' },
  { id: 'hayvanlar', ad: 'Hayvanlar', sira: 2, kapak: 'kahve' },
  { id: 'sehir', ad: 'Şehir', sira: 3, kapak: 'lacivert' },
  { id: 'doga', ad: 'Doğa', sira: 4, kapak: 'koyuyesil' },
  { id: 'okul', ad: 'Okul', sira: 5, kapak: 'hardal' },
  { id: 'defterde', ad: 'Defterde', sira: 6, kapak: 'gri' },
  { id: 'tasitlar', ad: 'Taşıtlar', sira: 7, kapak: 'turuncu' },
  { id: 'muzik', ad: 'Müzik aletleri', sira: 8, kapak: 'mor' },
];
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.KK_DEFTERLER;
