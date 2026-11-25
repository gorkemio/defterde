// kit/bulmaca/album.js — çözülen bulmacaların kaydı ve istatistik. Depo: Kit.bulmaca.depo.Depo örneği.
//   const a = Album(depo); a.kaydet('mutfak', 'simit', { sure, hata, ipucu, mod, tarih }); a.ozet('mutfak', toplam)
(function () {
  'use strict';
  function Album(depo, anahtar = 'album') {
    let v = depo.oku(anahtar, { kayit: {}, oynanan: 0 });
    const yaz = () => depo.yaz(anahtar, v);
    return {
      kaydet(defter, id, s) {
        const eski = v.kayit[id];
        const yeni = Object.assign({ defter, ilk: s.tarih }, eski, s, { kez: (eski ? eski.kez : 0) + 1 });
        if (eski) { yeni.enIyiSure = Math.min(eski.enIyiSure ?? eski.sure, s.sure); yeni.ilk = eski.ilk; } else yeni.enIyiSure = s.sure;
        v.kayit[id] = yeni; v.oynanan++;
        yaz();
        return yeni;
      },
      kayit: (id) => v.kayit[id] || null,
      cozulduMu: (id) => !!v.kayit[id],
      isaretle(id, alan, deger) { v.kayit[id] = Object.assign({}, v.kayit[id], { [alan]: deger }); yaz(); },
      ozet(defter, toplam) { const c = Object.values(v.kayit).filter(k => k.defter === defter).length; return { cozulen: c, toplam }; },
      liste: (defter) => Object.entries(v.kayit).filter(([, k]) => !defter || k.defter === defter).map(([id, k]) => Object.assign({ id }, k)),
      istatistik() {
        const k = Object.values(v.kayit), s = k.map(x => x.sure).filter(x => x > 0);
        return { cozulen: k.length, oynanan: v.oynanan, hatasiz: k.filter(x => !x.hata && !x.ipucu).length, ortSure: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0 };
      },
      sifirla() { v = { kayit: {}, oynanan: 0 }; yaz(); },
    };
  }
  const api = { Album };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).album = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
