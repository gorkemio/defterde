// kit/bulmaca/ipucu.js — açıklamalı ipucu iskeleti: tekniklerin basamak sırası (merdiven). Bulmaca türünü bilmez.
//   const m = Kit.bulmaca.Merdiven([{ ad, bant, bul(durum, bulmaca) → adim | null }, ...], { uygula(durum, adim), bitti(durum, bulmaca) })
//   m.sonrakiAdim(durum, bulmaca) → en basit tekniğin bulduğu ilk adım
//   m.cozumKaydi(durum, bulmaca) → { adimlar, durum, bitti }   (durumun kopyası üstünde baştan sona)
// adim: { teknik, bant, bolge: { tur, i }, hucreler: [{ r, c, v }], veri }
(function () {
  'use strict';
  const BANTLAR = ['kolay', 'orta', 'zor', 'uzman'];

  function Merdiven(teknikler, o) {
    const enYuksek = (sinir) => sinir == null ? teknikler : teknikler.filter(t => BANTLAR.indexOf(t.bant) <= BANTLAR.indexOf(sinir));
    function sonrakiAdim(durum, bulmaca, sinir) {
      for (const t of enYuksek(sinir)) {
        const a = t.bul(durum, bulmaca);
        if (a) { a.teknik = a.teknik || t.ad; a.bant = t.bant; return a; }
      }
      return null;
    }
    function cozumKaydi(durum, bulmaca, sinir, enCokAdim = 5000) {
      const d = durum.slice(), adimlar = [];
      while (!o.bitti(d, bulmaca) && adimlar.length < enCokAdim) {
        const a = sonrakiAdim(d, bulmaca, sinir);
        if (!a) break;
        o.uygula(d, a, bulmaca);
        adimlar.push(a);
      }
      return { adimlar, durum: d, bitti: o.bitti(d, bulmaca) };
    }
    return { teknikler, sonrakiAdim, cozumKaydi };
  }

  const api = { Merdiven, BANTLAR };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).ipucu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
