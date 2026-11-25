// kit/bulmaca/gecmis.js — sınırsız geri al / yinele. Bir işlem birden çok kare değişikliği taşır (bir sürükleme = bir işlem).
// Değişmeyen işlem kaydedilmez. Yeni işlem yinele yığınını siler.
//   const g = Kit.bulmaca.gecmis.Gecmis(); g.islem([{ i, eski, yeni }], 'surukle'); g.geriAl() → değişiklikler (eski değerlere dön)
(function () {
  'use strict';
  function Gecmis(kayit) {
    let geri = kayit ? kayit.geri.slice() : [], ileri = kayit ? kayit.ileri.slice() : [];
    return {
      islem(degisiklikler, etiket) {
        const d = degisiklikler.filter(x => x.eski !== x.yeni);
        if (!d.length) return false;
        geri.push({ d, etiket }); ileri = [];
        return true;
      },
      geriAl() { const x = geri.pop(); if (!x) return null; ileri.push(x); return x.d.slice().reverse().map(k => ({ i: k.i, deger: k.eski })); },
      yinele() { const x = ileri.pop(); if (!x) return null; geri.push(x); return x.d.map(k => ({ i: k.i, deger: k.yeni })); },
      get geriVar() { return geri.length > 0; },
      get ileriVar() { return ileri.length > 0; },
      get uzunluk() { return geri.length; },
      temizle() { geri = []; ileri = []; },
      yaz: () => ({ geri: geri.slice(-400), ileri: ileri.slice(-400) }),
    };
  }
  const api = { Gecmis };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).gecmis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
