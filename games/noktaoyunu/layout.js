// layout.js — DOM'suz sayfa yerleşimi. Girdi: kullanılabilir alan (CSS px) ve tahta (m satır × n sütun nokta).
// Çıktı: düzen adı, birim (sq, px: yarım nokta aralığı; noktalar 2·sq arayla) ve sayfadaki her şeyin yeri sq cinsinden.
// Çizim katmanında 1 sq = 20 SVG birimi. Tahtanın noktaları sayfanın basılı nokta örgüsüyle çakışır.
//   defter: geniş ekran; solda marj (iki oyuncunun harfi ve puanı), üstte başlık ve durum, tahtanın altında komutlar.
//   dikey:  dar ekran; başlık ve durum üstte, iki oyuncu yan yana, tahta sayfa genişliğinde, komutlar altta.
(function () {
  'use strict';

  const SQ_MIN = 24, SQ_MAX = 40, SQ_MAX_DIKEY = 36;     // nokta aralığı en az 48 px
  const DEFTER = { marj: 6, sag: 3, ust: 5, alt: 6 };
  const DIKEY = { yan: 1, ust: 5.8, alt: 5.6 };

  function defter(m, n, sq) {
    const tw = 2 * (n - 1), th = 2 * (m - 1);
    const W = DEFTER.marj + tw + DEFTER.sag, H = DEFTER.ust + th + DEFTER.alt;
    const tahta = { x: DEFTER.marj, y: DEFTER.ust, w: tw, h: th };
    const blok = (y) => ({
      x: .8, y, harf: 1.7,
      etiket: { dx: 1.75, dy: -.62, boyut: .55 },
      birDaha: { dx: 1.75, dy: .3, boyut: .58 },
      puan: { dx: 0, dy: 2.15, boyut: 1.25, enCok: 3, genislik: DEFTER.marj - 1.1 },
    });
    return {
      mod: 'defter', sq, W, H, tahta,
      baslik: { x: tahta.x, y: 2.15, boyut: 1.25 },
      durum: { x: tahta.x, y: 3.45, boyut: .62 },
      dusunme: { x: tahta.x, y: 3.85, w: 4.5 },
      oyuncu: [blok(7.2), blok(12.4)],
      komutlar: { x: tahta.x - .35, y: tahta.y + th + 1, w: W - tahta.x - .1 },
      not: { x: .5, y: tahta.y - .5, w: W - 1 },
    };
  }

  function dikey(m, n, sq) {
    const tw = 2 * (n - 1), th = 2 * (m - 1);
    const W = tw + 2 * DIKEY.yan, H = DIKEY.ust + th + DIKEY.alt;
    const tahta = { x: DIKEY.yan, y: DIKEY.ust, w: tw, h: th };
    const blok = (x) => ({
      x, y: 4.45, harf: 1.45,
      etiket: { dx: 1.6, dy: -1.15, boyut: .5 },
      birDaha: { dx: 0, dy: .8, boyut: .5 },
      puan: { dx: 1.6, dy: 0, boyut: 1.05, enCok: 3, genislik: W / 2 - 1.6 - .5 },
    });
    return {
      mod: 'dikey', sq, W, H, tahta,
      baslik: { x: .8, y: 1.5, boyut: 1.05 },
      durum: { x: .8, y: 2.5, boyut: .56 },
      dusunme: { x: .8, y: 2.85, w: 4 },
      oyuncu: [blok(.8), blok(W / 2 + .2)],
      komutlar: { x: .5, y: tahta.y + th + .9, w: W - 1 },
      not: { x: .4, y: tahta.y - .5, w: W - .8 },
    };
  }

  // vw, vh: kullanılabilir alan (px); m, n: nokta satırı ve sütunu
  function hesapla(vw, vh, m = 5, n = 5) {
    const tw = 2 * (n - 1), th = 2 * (m - 1);
    const Wd = DEFTER.marj + tw + DEFTER.sag, Hd = DEFTER.ust + th + DEFTER.alt;
    const sqD = Math.floor(Math.min((vw - 24) / Wd, (vh - 16) / Hd));
    if (vw >= 600 && sqD >= SQ_MIN) return Object.assign(defter(m, n, Math.min(SQ_MAX, sqD)), { kaydir: false });
    const Wk = tw + 2 * DIKEY.yan, Hk = DIKEY.ust + th + DIKEY.alt;
    const sq = Math.max(SQ_MIN, Math.min(SQ_MAX_DIKEY, Math.floor((vw - 8) / Wk), Math.floor((vh - 8) / Hk)));
    const l = dikey(m, n, sq);
    return Object.assign(l, { kaydir: l.W * sq > vw - 8 || l.H * sq > vh - 8 });
  }

  // Tahta noktasının (r satır, c sütun) sayfadaki yeri (sq)
  const noktaYeri = (l, r, c) => [l.tahta.x + 2 * c, l.tahta.y + 2 * r];

  const L = { hesapla, noktaYeri, SQ_MIN, SQ_MAX, SQ_MAX_DIKEY };
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).layout = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
