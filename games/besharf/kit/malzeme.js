// kit/malzeme.js — malzeme (tema) katmanı. Hangi oyun olduğunu bilmez.
// Bir malzeme: kalem çizgisinin stili (renk, baskı, çift çizgi, roughness), yazı ailesi, vurgu rengi, silgi efekti,
// ses seti ve karakter kullanılıp kullanılmayacağı. Oyun bir kez seçer; seçmeyen oyun bugünkü tükenmez kalemle kalır.
//
//   Kit.malzeme.sec('kursunkalem', { cizim: config.cizim, renk: config.renk })   // ikinci parametre: oyunun üst yazımı
//   Kit.malzeme.aktif.silgiIzi(katman, cizgiNode, { noktalar: [x1, y1, x2, y2] })
//
// Tanım şeması:
//   { ad, cizim: {roughness, bowing, strokeWidth, fillWeight, sureMs, animasyon},
//     renk: {ana, vurgu, kursun, mavi, kirmizi},     // mavi/kirmizi eski adlar; kurşun kalemde ana/vurguya eşlenir
//     yazi: {aile, ornek}, isle: {secenek, bitir} | null, silgiIzi | null,
//     ses: {ad: sentez(c, hedef, t0, arg)} | null, sesSeviye, karakter: bool }
// Script sırası: kit/kalem.js → kit/ses.js (isteğe bağlı) → kit/malzeme.js → malzeme dosyaları (kit/kursunkalem.js …)
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const KL = Kit.kalem;
  const kayit = {};

  // Tükenmez: kalem.js ve ses.js'in bugünkü varsayılanları (yüklendiği an kopyalanır). sec('tukenmez') eski görünümü verir.
  const tukenmez = {
    ad: 'tukenmez',
    cizim: Object.assign({}, KL.ayar.cizim),
    renk: Object.assign({ ana: KL.ayar.renk.mavi, vurgu: KL.ayar.renk.kirmizi }, KL.ayar.renk),
    yazi: Object.assign({}, KL.ayar.yazi),
    isle: null,
    silgiIzi: null,
    ses: Kit.ses ? Object.assign({}, Kit.ses.sentez) : null,
    sesSeviye: 0.6,
    karakter: true,
  };

  const M = {
    aktif: tukenmez,
    tanimla(ad, tanim) { kayit[ad] = Object.assign({ ad }, tanim); return kayit[ad]; },
    al(ad) { return kayit[ad]; },
    // ust: { cizim, renk } — oyunun config'i malzemenin üstüne yazar (yalnız verilen alanlar)
    sec(ad, ust = {}) {
      const t = kayit[ad];
      if (!t) throw new Error('Bilinmeyen malzeme: ' + ad);
      KL.ayarla(Object.assign({}, t.cizim, ust.cizim), Object.assign({}, t.renk, ust.renk), { isle: t.isle || null, yazi: t.yazi });
      if (Kit.ses) {
        if (t.ses) Object.assign(Kit.ses.sentez, t.ses);
        if (Kit.ses.seviye) Kit.ses.seviye(t.sesSeviye ?? 0.6);
      }
      if (typeof document !== 'undefined') document.documentElement.dataset.malzeme = ad;
      M.aktif = t;
      return t;
    },
  };
  M.aktif = M.tanimla('tukenmez', tukenmez);

  Kit.malzeme = M;
})();
