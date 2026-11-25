// bulmacalar.js — tools/bulmaca-uret.js üretti (elle düzenleme). "Bu konumda kazan": sıra sende, güvenli hamle kalmadı.
// Her bulmaca: m × n nokta, bos = çekilmemiş çizgiler (gerisi çekili, henüz kutu alınmadı), deger = en iyi oyunla kutu farkı.
(function () {
  'use strict';
  const BULMACALAR = [ 
  { "m": 4, "n": 4, "zorluk": "kolay", "deger": 3, "parcalar": "5 · 1 · 3", "bos": [ "C1-D1", "B2-C2", "A3-B3", "C3-D3", "B4-C4", "C4-D4", "A1-A2", "B1-B2", "D1-D2", "A2-A3", "C2-C3", "B3-B4" ] }, 
  { "m": 4, "n": 4, "zorluk": "kolay", "deger": 7, "parcalar": "1 · 8", "bos": [ "A1-B1", "B2-C2", "C2-D2", "A3-B3", "B3-C3", "C3-D3", "A1-A2", "C1-C2", "A2-A3", "B3-B4", "D3-D4" ] }, 
  { "m": 4, "n": 5, "zorluk": "kolay", "deger": 6, "parcalar": "7 · 2 · 2 · 1", "bos": [ "B2-C2", "C2-D2", "D2-E2", "A3-B3", "B4-C4", "C4-D4", "D4-E4", "A1-A2", "B1-B2", "D1-D2", "A2-A3", "C2-C3", "E2-E3", "A3-A4", "C3-C4", "E3-E4" ] }, 
  { "m": 4, "n": 5, "zorluk": "kolay", "deger": 2, "parcalar": "1 · 3 · döngü 4 · döngü 4", "bos": [ "A1-B1", "B1-C1", "A3-B3", "B3-C3", "C3-D3", "D3-E3", "A1-A2", "C1-C2", "D1-D2", "E1-E2", "B2-B3", "D2-D3", "B3-B4", "D3-D4" ] }, 
  { "m": 5, "n": 5, "zorluk": "kolay", "deger": 2, "parcalar": "5 · 6 · döngü 4 · 1", "bos": [ "A1-B1", "D1-E1", "B2-C2", "C2-D2", "A3-B3", "D3-E3", "B4-C4", "C4-D4", "D4-E4", "A5-B5", "B1-B2", "D1-D2", "B2-B3", "D2-D3", "A3-A4", "C3-C4", "A4-A5", "C4-C5", "E4-E5" ] }, 
  { "m": 5, "n": 5, "zorluk": "kolay", "deger": 6, "parcalar": "4 · 8 · 3 · 1", "bos": [ "A3-B3", "C3-D3", "D3-E3", "B4-C4", "C4-D4", "D4-E4", "A5-B5", "B5-C5", "C5-D5", "A1-A2", "B1-B2", "C1-C2", "D1-D2", "E1-E2", "B2-B3", "C2-C3", "E2-E3", "B3-B4", "A4-A5", "E4-E5" ] }, 
  { "m": 5, "n": 5, "zorluk": "kolay", "deger": 10, "parcalar": "11 · 4 · 1", "bos": [ "C2-D2", "D2-E2", "A3-B3", "B3-C3", "C3-D3", "D3-E3", "B4-C4", "C4-D4", "D4-E4", "A5-B5", "D5-E5", "A1-A2", "B1-B2", "C1-C2", "E1-E2", "B2-B3", "A3-A4", "A4-A5", "C4-C5" ] }, 
  { "m": 4, "n": 4, "zorluk": "orta", "deger": 1, "parcalar": "2 · 3 · 4", "bos": [ "B1-C1", "C1-D1", "C2-D2", "A3-B3", "B3-C3", "C3-D3", "B4-C4", "C4-D4", "A1-A2", "B1-B2", "B2-B3", "A3-A4" ] }, 
  { "m": 4, "n": 4, "zorluk": "orta", "deger": 3, "parcalar": "4 · 4 · 1", "bos": [ "C2-D2", "B3-C3", "A4-B4", "A1-A2", "B1-B2", "C1-C2", "A2-A3", "B2-B3", "D2-D3", "A3-A4", "C3-C4", "D3-D4" ] }, 
  { "m": 4, "n": 5, "zorluk": "orta", "deger": 4, "parcalar": "3 · 2 · 7", "bos": [ "C1-D1", "D1-E1", "D2-E2", "A3-B3", "C3-D3", "B4-C4", "D4-E4", "A1-A2", "B1-B2", "C1-C2", "B2-B3", "C2-C3", "E2-E3", "B3-B4", "D3-D4" ] }, 
  { "m": 4, "n": 5, "zorluk": "orta", "deger": 4, "parcalar": "2 · 6 · 4", "bos": [ "A1-B1", "A2-B2", "B2-C2", "C1-C2", "D1-D2", "E1-E2", "A2-A3", "C2-C3", "D2-D3", "E2-E3", "A3-A4", "B3-B4", "C3-C4", "D3-D4", "E3-E4" ] }, 
  { "m": 4, "n": 5, "zorluk": "orta", "deger": 6, "parcalar": "4 · 7 · 1", "bos": [ "A1-B1", "B1-C1", "A2-B2", "B2-C2", "C2-D2", "D2-E2", "C3-D3", "D3-E3", "A4-B4", "B4-C4", "D4-E4", "D1-D2", "B2-B3", "A3-A4", "C3-C4" ] }, 
  { "m": 5, "n": 6, "zorluk": "orta", "deger": 12, "parcalar": "6 · 2 · 12", "bos": [ "D1-E1", "E1-F1", "A2-B2", "B2-C2", "E2-F2", "C3-D3", "D3-E3", "A4-B4", "E4-F4", "B5-C5", "A1-A2", "C1-C2", "D1-D2", "B2-B3", "D2-D3", "F2-F3", "B3-B4", "C3-C4", "E3-E4", "A4-A5", "C4-C5", "D4-D5", "E4-E5" ] }, 
  { "m": 5, "n": 6, "zorluk": "orta", "deger": 14, "parcalar": "8 · 1 · 11", "bos": [ "A1-B1", "D1-E1", "E1-F1", "A2-B2", "B2-C2", "C2-D2", "D2-E2", "E3-F3", "A4-B4", "B4-C4", "C4-D4", "D4-E4", "E4-F4", "A5-B5", "C1-C2", "F1-F2", "B2-B3", "D2-D3", "F2-F3", "B3-B4", "D3-D4", "C4-C5", "E4-E5" ] }, 
  { "m": 4, "n": 5, "zorluk": "zor", "deger": 2, "parcalar": "1 · 3 · 2 · 4 · 2", "bos": [ "A1-B1", "B1-C1", "C1-D1", "D1-E1", "B2-C2", "C3-D3", "B4-C4", "A1-A2", "D1-D2", "A2-A3", "B2-B3", "D2-D3", "E2-E3", "A3-A4", "B3-B4", "D3-D4", "E3-E4" ] }, 
  { "m": 5, "n": 5, "zorluk": "zor", "deger": 6, "parcalar": "1 · 5 · 2 · 6 · 2", "bos": [ "A1-B1", "B1-C1", "C1-D1", "D1-E1", "B2-C2", "A3-B3", "C3-D3", "A4-B4", "B4-C4", "D4-E4", "A5-B5", "C5-D5", "D5-E5", "A1-A2", "D1-D2", "B2-B3", "D2-D3", "E2-E3", "C3-C4", "E3-E4", "C4-C5" ] }, 
  { "m": 5, "n": 5, "zorluk": "zor", "deger": 6, "parcalar": "3 · 5 · 1 · 7", "bos": [ "C1-D1", "D1-E1", "A2-B2", "B2-C2", "A3-B3", "B4-C4", "D4-E4", "A5-B5", "C5-D5", "A1-A2", "C1-C2", "E1-E2", "C2-C3", "D2-D3", "E2-E3", "A3-A4", "C3-C4", "D3-D4", "B4-B5", "D4-D5" ] }, 
  { "m": 5, "n": 6, "zorluk": "zor", "deger": 8, "parcalar": "2 · 8 · 4 · 6", "bos": [ "A1-B1", "B1-C1", "C1-D1", "E1-F1", "D2-E2", "E2-F2", "C3-D3", "D3-E3", "E3-F3", "D4-E4", "E4-F4", "B1-B2", "D1-D2", "A2-A3", "B2-B3", "C2-C3", "A3-A4", "B3-B4", "C3-C4", "A4-A5", "B4-B5", "C4-C5", "D4-D5", "F4-F5" ] }, 
  { "m": 5, "n": 6, "zorluk": "zor", "deger": 4, "parcalar": "7 · 7 · döngü 4 · 2", "bos": [ "A1-B1", "E1-F1", "D2-E2", "E2-F2", "C3-D3", "A4-B4", "B4-C4", "E4-F4", "C5-D5", "D5-E5", "E5-F5", "B1-B2", "C1-C2", "D1-D2", "A2-A3", "B2-B3", "C2-C3", "E2-E3", "B3-B4", "D3-D4", "E3-E4", "B4-B5", "D4-D5" ] }, 
  { "m": 6, "n": 6, "zorluk": "zor", "deger": 9, "parcalar": "8 · 7 · 3 · 5 · 2", "bos": [ "C1-D1", "D1-E1", "A2-B2", "B2-C2", "E2-F2", "A3-B3", "D3-E3", "C4-D4", "A5-B5", "B5-C5", "C6-D6", "D6-E6", "A1-A2", "C1-C2", "E1-E2", "C2-C3", "D2-D3", "F2-F3", "B3-B4", "C3-C4", "E3-E4", "F3-F4", "B4-B5", "D4-D5", "E4-E5", "F4-F5", "A5-A6", "C5-C6", "E5-E6", "F5-F6" ] }
];
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).bulmacalar = BULMACALAR;
  if (typeof module !== 'undefined' && module.exports) module.exports = BULMACALAR;
})();
