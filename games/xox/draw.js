// draw.js — 5'li XOX'a özgü çizim (kit üstüne). DOM'a çizer, oyun kuralını bilmez.
// Tahta SVG'sinde 1 defter karesi = KARE birim; (r, c) karesinin sol üstü (c·KARE, r·KARE).
// Mürekkep (X, O, kazanma çizgisi, "beş", karalama) dolma kalem şerididir; kurşun kalem (önizleme, tehdit,
// köşe işareti, ayar dairesi) { murekkep: false } ile düz kalem izidir.
(function () {
  'use strict';

  const Kit = window.Kit, KL = Kit.kalem, DK = Kit.dolmakalem;
  const { rastgele, aralik, svgEl } = KL;
  const KARE = 40;
  const B_SEMBOL = { 1: 'X', 2: 'O' };
  const KATMANLAR = ['kose', 'iptal', 'semboller', 'tehdit', 'ipucu', 'onizleme', 'kazanma', 'analiz', 'not'];

  const renk = (ad) => KL.renkDeger(ad);
  const kursun = () => KL.renkDeger('kursun');

  /* ---------- tahta ---------- */

  // svg: #tahta. alan: { r0, c0, satir, sutun } (dünya koordinatında görünen alan; sınırsızda r0/c0 negatif olabilir)
  function tahtaKur(svg, alan) {
    svg.textContent = '';
    viewBoxAyarla(svg, alan);
    const T = { svg, K: KL.kalemYap(svg), alan };
    for (const ad of KATMANLAR) T[ad] = svgEl('g', { class: 'k-' + ad }, svg);
    return T;
  }
  function viewBoxAyarla(svg, alan) {
    svg.setAttribute('viewBox', `${alan.c0 * KARE} ${alan.r0 * KARE} ${alan.sutun * KARE} ${alan.satir * KARE}`);
  }
  const merkez = (r, c) => [c * KARE + KARE / 2, r * KARE + KARE / 2];

  // Sabit sayfada yalnız dört köşe: silik kurşun kalemle iki kısa çizgi (çerçeve değil)
  function koseIsaretleri(T, n, oyunId, anlik) {
    T.kose.textContent = '';
    const g = svgEl('g', { opacity: .42 }, T.kose);
    const L = KARE * .55, d = 3;
    const koseler = [[0, 0, 1, 1], [0, n * KARE, 1, -1], [n * KARE, 0, -1, 1], [n * KARE, n * KARE, -1, -1]];
    const s = { stroke: kursun(), strokeWidth: 1.4, roughness: .9 };
    koseler.forEach(([y, x, sy, sx], i) => {
      const x0 = x - sx * d, y0 = y - sy * d;
      T.K.cizgi(g, [x0, y0, x0 + sx * L, y0], s, ['kose', oyunId, i, 'y'], { murekkep: false, anlik, gecikme: i * 60 });
      T.K.cizgi(g, [x0, y0, x0, y0 + sy * L], s, ['kose', oyunId, i, 'd'], { murekkep: false, anlik, gecikme: i * 60 + 40 });
    });
  }

  /* ---------- semboller ---------- */

  // X: iki şerit sırayla (120 ms'er, arada 40 ms kalem kaldırma). O: tek döngü, kapanışta bindirme (180 ms).
  // o: { murekkep: 'mavisiyah' | ..., gecikme, anlik, taze (kuruma), kursun (önizleme/taslak), opaklik, katman }
  function sembolYaz(T, r, c, sembol, oyunId, o = {}) {
    const katman = o.katman || T.semboller;
    const g = svgEl('g', { class: 'sembol', 'data-r': r, 'data-c': c, 'data-s': sembol }, katman);
    if (o.opaklik != null) g.setAttribute('opacity', o.opaklik);
    const rr = rastgele('sembol', oyunId, r, c, sembol);
    const x0 = c * KARE, y0 = r * KARE;
    const ink = o.kursun ? kursun() : renk(o.murekkep || 'mavisiyah');
    const cz = o.kursun
      ? { murekkep: false, anlik: true }
      : { kuruma: !!o.taze, anlik: o.anlik };
    const an = ['sembol', oyunId, r, c, sembol];
    const gec = o.gecikme || 0;
    const ek = { stroke: ink, strokeWidth: o.kursun ? 1.5 : 2.4 };      // şerit 1.4–3.6 birim ≈ 1.2–3 px (kare 32 px)

    if (sembol === 'X') {
      const j = () => aralik(rr, -.06, .06) * KARE;
      const a = [x0 + .2 * KARE + j(), y0 + .2 * KARE + j(), x0 + .8 * KARE + j(), y0 + .8 * KARE + j()];
      const b = [x0 + .8 * KARE + j(), y0 + .2 * KARE + j(), x0 + .2 * KARE + j(), y0 + .8 * KARE + j()];
      const s1 = T.K.cizgi(g, a, ek, [...an, 1], Object.assign({ gecikme: gec, sureMs: [120, 120] }, cz));
      const ara = s1.sure ? s1.sure + 40 : 0;
      const s2 = T.K.cizgi(g, b, ek, [...an, 2], Object.assign({ gecikme: gec + ara, sureMs: [120, 120] }, cz));
      return { node: g, bitti: Promise.all([s1.bitti, s2.bitti]), sure: ara + s2.sure, darbeler: [s1.sure ? 120 : 0, s2.sure ? 120 : 0], arada: ara };
    }
    // O: elipse yakın, 385°'lik tek döngü; sağ üstten başlar, saat yönünün tersine döner, kapanışta biraz bindirir
    const cx = x0 + KARE / 2 + aralik(rr, -1.2, 1.2), cy = y0 + KARE / 2 + aralik(rr, -1.2, 1.2);
    const rx = KARE * (.32 + aralik(rr, -.03, .03)), ry = KARE * (.36 + aralik(rr, -.03, .03));
    const don = (-12 + aralik(rr, -8, 8)) * Math.PI / 180;
    const a0 = -60 * Math.PI / 180, tur = (385 + aralik(rr, -10, 10)) * Math.PI / 180, adim = 14;
    const pts = [];
    for (let i = 0; i <= adim; i++) {
      const t = i / adim, a = a0 - tur * t;
      const k = .94 + .1 * t + aralik(rr, -.015, .015);          // başta biraz içte, sonda biraz dışta: bindirme görünür
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(don) - y * Math.sin(don), cy + x * Math.sin(don) + y * Math.cos(don)]);
    }
    const s = T.K.egri(g, pts, ek, an, Object.assign({ gecikme: gec, sureMs: [180, 180] }, cz));
    return { node: g, bitti: s.bitti, sure: s.sure, darbeler: [s.sure ? 180 : 0], arada: 0 };
  }

  // Kurşun kalem taslağı (önizleme, ipucu): animasyonsuz, silik
  function taslak(T, r, c, sembol, oyunId, opaklik = .35, katman) {
    return sembolYaz(T, r, c, sembol, oyunId, { kursun: true, opaklik, katman: katman || T.onizleme });
  }

  // Geri alınan sembol: iptal katmanına taşınır, üstü ince karalanır, solar ve kalır
  function karala(T, node, r, c, murekkep, oyunId, anlik) {
    T.iptal.appendChild(node);
    const x0 = c * KARE, y0 = r * KARE;
    return DK.karala(T.K, node, { x: x0 + KARE * .08, y: y0 + KARE * .1, w: KARE * .84, h: KARE * .8 },
      { renk: murekkep, tohum: ['karala', oyunId, r, c], anlik });
  }

  /* ---------- kurşun kalem işaretleri ---------- */

  function tehditNokta(T, r, c, anlik = true) {
    const [x, y] = merkez(r, c);
    const s = T.K.daire(T.tehdit, [x, y, 5], { stroke: kursun(), fill: kursun(), fillStyle: 'solid', strokeWidth: .8, roughness: .6 },
      ['nokta', r, c], { murekkep: false, anlik });
    s.node.setAttribute('opacity', .55);
    return s;
  }
  function tehditHalka(T, r, c, anlik = true) {
    const [x, y] = merkez(r, c);
    const s = T.K.daire(T.tehdit, [x, y, KARE * .44], { stroke: kursun(), strokeWidth: 1.1, roughness: .9, disableMultiStroke: false },
      ['halka', r, c], { murekkep: false, anlik });
    s.node.setAttribute('opacity', .6);
    return s;
  }

  /* ---------- kazanma ---------- */

  // besli: [[r, c], ...] (sıralı). İlk ve son taşın merkezinden ±.4 kare taşan tek şerit; "beş" boş kalan ucun ötesine.
  // o.bos(r, c): kare boş ve tahtada mı (yazının sembol üstüne binmemesi için)
  function kazanmaCiz(T, besli, murekkep, oyunId, o = {}) {
    let [a, b] = [besli[0], besli[besli.length - 1]];
    if (o.bos) {
      const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]);
      const sonBos = o.bos(b[0] + dr, b[1] + dc) && o.bos(b[0] + 2 * dr, b[1] + 2 * dc);
      const basBos = o.bos(a[0] - dr, a[1] - dc) && o.bos(a[0] - 2 * dr, a[1] - 2 * dc);
      if (!sonBos && basBos) [a, b] = [b, a];                  // yazı "son" uca gelir
    }
    const [x1, y1] = merkez(a[0], a[1]), [x2, y2] = merkez(b[0], b[1]);
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const t = KARE * .4;
    const r = rastgele('kazanma', oyunId, a[0], a[1]);
    const p = [x1 - ux * t * aralik(r, .8, 1.1), y1 - uy * t * aralik(r, .8, 1.1), x2 + ux * t * aralik(r, .8, 1.1), y2 + uy * t * aralik(r, .8, 1.1)];
    const s = T.K.cizgi(T.kazanma, p, { stroke: renk(murekkep), strokeWidth: 2, roughness: 1.1, bowing: 1.2 },
      ['kazanma', oyunId, a[0], a[1]], { gecikme: o.gecikme || 0, sureMs: [300, 300], kuruma: true, kalinlik: 1.3, anlik: o.anlik });
    // "beş": çizginin bittiği ucun ötesine, çizgiye dik biraz kaymış
    const nx = -uy, ny = ux;
    const yon = ny > 0 ? -1 : 1;                              // yazı çizginin üst tarafında dursun
    const bx = p[2] + ux * KARE * .55 + nx * yon * KARE * .35, by = p[3] + uy * KARE * .55 + ny * yon * KARE * .35;
    const m = KL.metinSvg(T.kazanma, 'beş', {
      x: bx, y: by + KARE * .25, boyut: KARE * .95, renk: murekkep, sinif: 'baslik', hiza: ux < -.3 ? 'end' : 'start',
      aci: aralik(r, -8, 8), tohum: ['bes', oyunId], gecikme: (o.gecikme || 0) + s.sure, adim: 60, anlik: o.anlik,
    });
    DK.metinKurut(m.node, murekkep, { gecikme: (o.gecikme || 0) + s.sure });
    return { node: T.kazanma, bitti: Promise.all([s.bitti, m.bitti]), sure: s.sure + m.sure };
  }

  // Geri alınan kazanma: çizgi ve "beş" silinmez, solar ve iptal katmanında kalır
  function kazanmaSoldur(T, anlik) {
    const g = svgEl('g', { class: 'iptal-kazanma' }, T.iptal);
    while (T.kazanma.firstChild) g.appendChild(T.kazanma.firstChild);
    DK.kurut(g, { sureMs: 0 });
    if (!KL.animasyonVar() || anlik) { g.setAttribute('opacity', .25); return Promise.resolve(); }
    const a = g.animate([{ opacity: 1 }, { opacity: .25 }], { duration: 500, fill: 'forwards' });
    return a.finished.then(() => { g.setAttribute('opacity', .25); a.cancel(); }, () => g.setAttribute('opacity', .25));
  }

  const katmanSil = (T, ad) => { T[ad].textContent = ''; };

  /* ---------- oyun sonu analizi (kurşun kalem) ---------- */

  // a: ai.analiz sonucu. Kaybettiren hamleye halka, oynanması gereken kareye taslak, çatal karesine çarpı ve
  // tehdit doğruları boyunca silik çizgi.
  function analizCiz(T, a, kaybedenSembol, oyunId) {
    T.analiz.textContent = '';
    const g = svgEl('g', { opacity: .85 }, T.analiz);
    const s = { stroke: kursun(), strokeWidth: 1.4, roughness: 1.1, disableMultiStroke: false };
    const [hr, hc] = a.oynanan, [x, y] = merkez(hr, hc);
    T.K.daire(g, [x, y, KARE * .92], s, ['analiz', 'halka', oyunId, hr, hc], { murekkep: false, sureMs: [260, 260] });
    if (a.enIyi) sembolYaz(T, a.enIyi[0], a.enIyi[1], B_SEMBOL[kaybedenSembol], oyunId, { kursun: true, opaklik: .6, katman: g });
    if (a.catal) {
      const [cr, cc] = a.catal.hucre, [cx, cy] = merkez(cr, cc), d = KARE * .22;
      const ince = { stroke: kursun(), strokeWidth: 1.1, roughness: .9 };
      a.catal.yonler.forEach((y2, k) => {
        const [x1, y1] = merkez(y2.bas[0], y2.bas[1]), [x2, y2_] = merkez(y2.son[0], y2.son[1]);
        const L = Math.hypot(x2 - x1, y2_ - y1) || 1, ux = (x2 - x1) / L, uy = (y2_ - y1) / L, t = KARE * .45;
        const c = T.K.cizgi(g, [x1 - ux * t, y1 - uy * t, x2 + ux * t, y2_ + uy * t], ince, ['analiz', 'yon', oyunId, k], { murekkep: false, gecikme: 300 + k * 200 });
        c.node.setAttribute('opacity', .5);
      });
      T.K.cizgi(g, [cx - d, cy - d, cx + d, cy + d], { stroke: kursun(), strokeWidth: 1.6 }, ['analiz', 'carpi', 1], { murekkep: false, gecikme: 700 });
      T.K.cizgi(g, [cx + d, cy - d, cx - d, cy + d], { stroke: kursun(), strokeWidth: 1.6 }, ['analiz', 'carpi', 2], { murekkep: false, gecikme: 780 });
    }
  }

  // Kenar notu oku: kareye sol üstten kıvrılarak gelen kurşun kalem ok (izle modunda terim açıklamaları için)
  function okCiz(T, r, c, tohum) {
    const [x, y] = merkez(r, c), K = T.K, rr = rastgele('ok', ...tohum);
    const g = svgEl('g', { opacity: .7 }, T.not);
    const bas = [x - KARE * aralik(rr, 1.4, 1.8), y - KARE * aralik(rr, 1.1, 1.5)], uc = [x - KARE * .38, y - KARE * .36];
    const s = { stroke: kursun(), strokeWidth: 1.3, roughness: .8 };
    K.egri(g, [bas, [bas[0] + KARE * .5, bas[1] - KARE * .1], uc], s, ['ok', ...tohum], { murekkep: false, sureMs: [220, 220] });
    const a = Math.atan2(uc[1] - bas[1] + KARE * .2, uc[0] - bas[0] - KARE * .3), L = KARE * .25;
    for (const k of [.5, -.5]) {
      K.cizgi(g, [uc[0], uc[1], uc[0] - L * Math.cos(a + k), uc[1] - L * Math.sin(a + k)], s, ['ok', ...tohum, k], { murekkep: false, gecikme: 220 });
    }
    return g;
  }

  /* ---------- sayfa dışı küçük çizimler ---------- */

  // Seçili ayar sözcüğünün etrafına kurşun kalem dairesi (düğmenin içinde kendi svg'si)
  function ayarDairesi(btn, secili) {
    const eski = btn.querySelector(':scope > svg.cerceve');
    if (eski) eski.remove();
    if (!secili) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'cerceve', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.insertBefore(svg, btn.firstChild);
    const K = KL.kalemYap(svg);
    K.elips(svg, [w / 2, h / 2 + 1, w * 1.04, h * .86], { stroke: kursun(), strokeWidth: 1.3, roughness: 1.2, disableMultiStroke: false },
      ['ayar', btn.dataset.ayar, btn.dataset.deger, Math.round(w)], { murekkep: false, anlik: true });
  }

  // Mürekkep lekesi: düzensiz, dolu; birkaç minik sıçrama
  function lekeCiz(svg, murekkep, anlik) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 40 40');
    const K = KL.kalemYap(svg), r = rastgele('leke', murekkep);
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, rr = 12 * aralik(r, .78, 1.12);
      pts.push([20 + Math.cos(a) * rr, 20 + Math.sin(a) * rr * .9]);
    }
    const c = renk(murekkep);
    K.cokgen(svg, pts, { stroke: c, fill: c, fillStyle: 'solid', strokeWidth: 1, roughness: 1.4 }, ['leke', murekkep], { anlik, murekkep: false });
    for (let i = 0; i < 3; i++) {
      const a = aralik(r, 0, Math.PI * 2), d = aralik(r, 15, 19);
      svgEl('circle', { cx: (20 + Math.cos(a) * d).toFixed(1), cy: (20 + Math.sin(a) * d).toFixed(1), r: aralik(r, .7, 1.5).toFixed(2), fill: c }, svg);
    }
  }

  const XOX = (window.XOX = window.XOX || {});
  XOX.draw = { KARE, tahtaKur, viewBoxAyarla, merkez, koseIsaretleri, sembolYaz, taslak, karala, tehditNokta, tehditHalka, kazanmaCiz, kazanmaSoldur, katmanSil, analizCiz, okCiz, ayarDairesi, lekeCiz };
})();
