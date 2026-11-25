// layout.js — DOM'suz sayfa yerleşimi. Girdi: kullanılabilir alan (CSS px). Çıktı: düzen adı, defter karesi (sq, px)
// ve sayfadaki her şeyin yeri DEFTER KARESİ cinsinden. Çizim katmanlarında 1 kare = 20 SVG birimi.
// Tahta: üç iç içe kare, halkalar arası 2 kare (dış kare 12×12); 24 nokta defterin kare kesişimlerine oturur.
//   defter: geniş ekran; sol marjda evre + düşünme çizgisi + ipucu çetelesi, sağ marjda eldeki taşlar ve "alınan".
//   dikey:  dar ekran; tahta sayfa genişliğinde, evre ve durum üstte, taşlar ve "alınan" altta.
(function () {
  'use strict';

  const SQ_MIN = 20, SQ_MAX = 26;          // 2 kare nokta aralığı → en az 40 px
  const DEFTER_W = 28, DEFTER_H = 25;

  function defter(sq) {
    return {
      mod: 'defter', sq, W: DEFTER_W, H: DEFTER_H, marjX: 6,
      baslik: { x: 7.7, y: 1.0, h: 2.2, adim: 1.85, bosluk: .9 },
      durum: { x: 8, y: 4.75, boyut: .85 },
      evre: { x: .7, y: 7.3, satir: 1.35, boyut: .68, yatay: false },
      dusunme: { x: .7, y: 11.6, w: 4.6 },
      ipucu: { x: .7, y: 14.2, boyut: .68 },
      tahta: { x: 8, y: 6 },
      tepsi: {
        etiket: [{ x: 24.25, y: 12.5 }, { x: 24.25, y: 6.1 }],              // [ben, bilgisayar]
        el: [{ x: 22.6, y: 13.9, dx: 1.65, dy: 1.6, sutun: 3, olcek: 1 },
             { x: 22.6, y: 7.5, dx: 1.65, dy: 1.6, sutun: 3, olcek: 1 }],
        alinanEtiket: { x: 24.25, y: 19.1 },
        alinan: [{ x: 22.65, y: 21.0, cap: 3.0, olcek: .9 }, { x: 25.85, y: 21.0, cap: 3.0, olcek: .9 }],   // [benim aldıklarım, onun aldıkları]
      },
      komutlar: { x: 7.2, y: 20.3, w: 13.6 },
    };
  }

  function dikey(sq) {
    return {
      mod: 'dikey', sq, W: 15, H: 27, marjX: 1,
      baslik: { x: 1.6, y: .7, h: 1.5, adim: 1.28, bosluk: .6 },
      durum: { x: 1.6, y: 3.55, boyut: .78 },
      evre: { x: 1.6, y: 5.05, boyut: .62, yatay: true, aralik: .9 },
      dusunme: { x: 1.6, y: 3.98, w: 6 },
      ipucu: { x: 13.6, y: 3.55, boyut: .62, sag: true },
      tahta: { x: 1.5, y: 6.3 },
      tepsi: {
        etiket: null,
        el: [{ x: 1.95, y: 22.25, dx: 1.06, dy: 0, sutun: 9, olcek: .72 },
             { x: 1.95, y: 20.65, dx: 1.06, dy: 0, sutun: 9, olcek: .72 }],
        alinanEtiket: { x: 11.95, y: 21.45, dik: true },
        alinan: [{ x: 13.35, y: 22.3, cap: 1.42, olcek: .55 }, { x: 13.35, y: 20.6, cap: 1.42, olcek: .55 }],
      },
      komutlar: { x: 1.1, y: 23.6, w: 12.8 },
    };
  }

  const sinir = (v, a, b) => Math.min(b, Math.max(a, v));

  // vw, vh: kullanılabilir alan
  function hesapla(vw, vh) {
    const sqD = Math.floor(Math.min((vw - 24) / DEFTER_W, (vh - 16) / DEFTER_H));
    if (vw >= 600 && sqD >= SQ_MIN) return Object.assign(defter(Math.min(SQ_MAX, sqD)), { kaydir: false });
    const sq = sinir(Math.floor((vw - 8) / 15), SQ_MIN, SQ_MAX);
    const l = dikey(sq);
    return Object.assign(l, { kaydir: l.W * sq > vw || l.H * sq > vh - 8 });
  }

  // Tahta noktasının sayfadaki yeri (kare): ızgara (x, y ∈ 0..6) → sayfa
  const noktaYeri = (l, gx, gy) => [l.tahta.x + 2 * gx, l.tahta.y + 2 * gy];

  const L = { hesapla, noktaYeri, SQ_MIN, SQ_MAX };
  if (typeof window !== 'undefined') (window.DT = window.DT || {}).layout = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
