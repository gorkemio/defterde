// kit/bulmaca/uretici.js — üretici döngüsü ve zorluk bandı. Bulmaca türünü bilmez.
//   uret({ aday(tohum, i) → bulmaca|null, kontrol(b) → b'|null (tekillik, düzeltme), derece(b) → { bant, puan },
//          hedefBant, butceMs, enCokDeneme, tohum }) → { bulmaca, derece, deneme } | null
// Önce tam bant; 400 denemeden sonra ±1 bant kabul; bütçe bitince en yakın bantlı en iyi aday.
(function () {
  'use strict';
  const BANTLAR = ['kolay', 'orta', 'zor', 'uzman'];
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function uret(o) {
    const t0 = simdi(), hedef = BANTLAR.indexOf(o.hedefBant), enCok = o.enCokDeneme ?? 2000;
    let enIyi = null, enIyiFark = 1e9;
    for (let i = 0; i < enCok; i++) {
      const tohum = `${o.tohum}|${i}`;
      const b0 = o.aday(tohum, i);
      const b = b0 && o.kontrol ? o.kontrol(b0) : b0;
      if (b) {
        const d = o.derece(b), fark = hedef < 0 ? 0 : Math.abs(BANTLAR.indexOf(d.bant) - hedef);
        if (fark === 0 || (i >= 400 && fark <= 1)) return { bulmaca: b, derece: d, deneme: i + 1 };
        if (BANTLAR.indexOf(d.bant) >= 0 && fark < enIyiFark) { enIyi = { bulmaca: b, derece: d, deneme: i + 1 }; enIyiFark = fark; }
      }
      if (o.butceMs && simdi() - t0 > o.butceMs) break;
    }
    return enIyi;
  }
  const api = { uret, BANTLAR };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).uretici = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
