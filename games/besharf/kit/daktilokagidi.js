// kit/daktilokagidi.js — deftere iki ZIMBAYLA tutturulmuş ince DAKTİLO KÂĞIDI, DÜZELTİCİ SIVI lekesi ve küçük FİŞ.
// Kâğıdın üstünde duran nesneler (rough.js yok): düz SVG dolgu, gradyan, tek statik gölge süzgeci. Hangi oyun olduğunu bilmez.
//
//   const k = Kit.daktilokagidi.kur(el, { tohum: ['kagit', 1], zimba: 2, saydamlik: .9, fis: false, gren: 'kit/gren.png' })
//       → { node: svg.daktilo-kagit-zemin, yenile() }   el: position relative kutu; içerik zeminin üstünde durur.
//         Kâğıt ince ve hafif saydam: altındaki defterin kareleri çok silik seçilir. Boyut değişince k.yenile().
//         fis: true → dar fiş: üst kenarı yırtılmış (dişli), zımbasız.
//   Kit.daktilokagidi.duzeltici(katman, { x, y, w, h, tohum, anlik, gecikme }) → { node, bitti }   // düzeltici sıvı lekesi
//   Kit.daktilokagidi.sol(node, 300) → Promise                                                    // lekeyi soldurup siler
//   Kit.daktilokagidi.sesler = { duzeltici }
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const NS = 'http://www.w3.org/2000/svg';
  const KL = () => Kit.kalem;
  const RENK = { kagit: '#f3efe3', fis: '#f6f3ea', duzeltici: '#fdfcf8' };

  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    if (oz) for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }
  const yolYap = (pts) => 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L') + ' Z';

  /* ---------- kâğıt kenarı ---------- */

  // Makinede kesilmiş kâğıt: kenarlar düz, ±.35 px titrek; köşeler gönyede. fis: üst kenar yırtık dişli.
  function kenar(w, h, r, fis) {
    const k = KL(), j = () => k.aralik(r, -.35, .35);
    const pts = [];
    if (fis) {
      const dis = 5;
      for (let x = 0; x <= w + .01; x += dis) pts.push([Math.min(x, w), (Math.round(x / dis) % 2 ? 2.6 : 0) + k.aralik(r, -.5, .5)]);
    } else {
      pts.push([j(), j()]);
      [.33, .67].forEach(f => pts.push([w * f, j()]));
    }
    pts.push([w + j(), j() + (fis ? 1.3 : 0)]);
    [.5].forEach(f => pts.push([w + j(), h * f]));
    pts.push([w + j(), h + j()]);
    [.5].forEach(f => pts.push([w * f, h + j()]));
    pts.push([j(), h + j()]);
    pts.push([j(), h * .5]);
    return pts;
  }

  /* ---------- zımba ---------- */

  let tanimNo = 0;
  // Krom tel: silindir gibi parlayan gradyan; iki ucunda kâğıda giren bacakların izi, altında ince gölge.
  function zimba(g, x, y, aci, uzunluk, on) {
    const z = el('g', { class: 'zimba', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${aci.toFixed(1)})` }, g);
    const L = uzunluk, H = 3.1;
    el('path', { d: `M${-L / 2 - 1.2} -1 q 1.2 2.2 2.4 0 M${L / 2 - 1.2} -1 q 1.2 2.2 2.4 0`, fill: 'none',
      stroke: 'rgba(90, 76, 56, .28)', 'stroke-width': .7 }, z);                                        // kâğıdın büzüldüğü yer
    el('rect', { x: -L / 2 + .6, y: -H / 2 + 1.1, width: L, height: H, rx: H / 2, fill: 'rgba(40, 30, 20, .32)', filter: `url(#${on}zg)` }, z);
    el('rect', { x: -L / 2, y: -H / 2, width: L, height: H, rx: H / 2, fill: `url(#${on}krom)` }, z);
    el('line', { x1: -L / 2 + 1.4, y1: -H / 2 + .55, x2: L / 2 - 1.4, y2: -H / 2 + .55, stroke: 'rgba(255,255,255,.85)', 'stroke-width': .45, 'stroke-linecap': 'round' }, z);
    for (const s of [-1, 1]) el('circle', { cx: s * (L / 2 - .9), cy: 0, r: .75, fill: 'rgba(70, 70, 68, .55)' }, z);
    return z;
  }

  /* ---------- kur ---------- */

  function kur(el0, o = {}) {
    const k = KL();
    const P = 14;                                                  // gölge için taşma payı
    const svg = el('svg', { class: 'daktilo-kagit-zemin', 'aria-hidden': 'true' });
    el0.insertBefore(svg, el0.firstChild);

    function ciz() {
      const w = el0.offsetWidth, h = el0.offsetHeight;
      svg.textContent = '';
      if (!w || !h) return;
      svg.setAttribute('viewBox', `${-P} ${-P} ${w + 2 * P} ${h + 2 * P}`);
      svg.setAttribute('width', w + 2 * P);
      svg.setAttribute('height', h + 2 * P);
      svg.style.left = svg.style.top = -P + 'px';
      const on = 'dkk' + (++tanimNo);
      const r = k.rastgele('daktilo-kagit', ...(o.tohum || ['kagit']));
      const fis = !!o.fis;
      const pts = kenar(w, h, r, fis);
      const d = yolYap(pts);
      const defs = el('defs', {}, svg);

      // Gölge yalnız kâğıdın dışında görünür (kâğıt saydamken altından gölge sızmasın)
      const fg = el('filter', { id: on + 'g', x: -P, y: -P, width: w + 2 * P, height: h + 2 * P, filterUnits: 'userSpaceOnUse' }, defs);
      el('feGaussianBlur', { stdDeviation: 3.2 }, fg);
      const fz = el('filter', { id: on + 'zg', x: '-30%', y: '-200%', width: '160%', height: '500%' }, defs);
      el('feGaussianBlur', { stdDeviation: .55 }, fz);
      const m = el('mask', { id: on + 'd', maskUnits: 'userSpaceOnUse', x: -P, y: -P, width: w + 2 * P, height: h + 2 * P }, defs);
      el('rect', { x: -P, y: -P, width: w + 2 * P, height: h + 2 * P, fill: 'white' }, m);
      el('path', { d, fill: 'black' }, m);
      const cp = el('clipPath', { id: on + 'k' }, defs);
      el('path', { d }, cp);
      const kr = el('linearGradient', { id: on + 'krom', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      [['0', '#f7f7f5'], ['.35', '#c9c9c6'], ['.6', '#8e8e8a'], ['1', '#d3d3cf']].forEach(([a, c]) => el('stop', { offset: a, 'stop-color': c }, kr));
      const sar = el('radialGradient', { id: on + 's', cx: '50%', cy: '45%', r: '75%' }, defs);
      el('stop', { offset: '.55', 'stop-color': '#d8c79d', 'stop-opacity': 0 }, sar);
      el('stop', { offset: '1', 'stop-color': '#c9b27e', 'stop-opacity': .2 }, sar);
      const gp = el('pattern', { id: on + 'gr', patternUnits: 'userSpaceOnUse', width: 256, height: 256 }, defs);
      el('image', { href: o.gren || 'kit/gren.png', width: 256, height: 256 }, gp);

      const golge = el('g', { mask: `url(#${on}d)` }, svg);
      el('path', { d, fill: 'rgba(58, 40, 18, .3)', transform: 'translate(2 4)', filter: `url(#${on}g)` }, golge);
      el('path', { d, fill: 'none', stroke: 'rgba(58, 40, 18, .22)', 'stroke-width': 1.2, transform: 'translate(.5 .9)' }, golge);

      const kagit = el('g', { class: 'kagit', 'clip-path': `url(#${on}k)` }, svg);
      el('path', { d, fill: fis ? RENK.fis : RENK.kagit, 'fill-opacity': o.saydamlik ?? (fis ? .96 : .78) }, kagit);
      el('rect', { x: 0, y: 0, width: w, height: h, fill: `url(#${on}gr)`, opacity: .4, style: 'mix-blend-mode: multiply' }, kagit);
      el('rect', { x: 0, y: 0, width: w, height: h, fill: `url(#${on}s)` }, kagit);
      const leke = 4 + Math.floor(r() * 4);                       // birkaç silik benek
      for (let i = 0; i < leke; i++) {
        el('ellipse', { cx: (r() * w).toFixed(1), cy: (r() * h).toFixed(1), rx: k.aralik(r, .4, 1.2).toFixed(2), ry: k.aralik(r, .3, .8).toFixed(2),
          fill: '#6b5536', 'fill-opacity': k.aralik(r, .07, .18).toFixed(2) }, kagit);
      }
      el('path', { d, fill: 'none', stroke: 'rgba(120, 104, 76, .28)', 'stroke-width': .6 }, svg);   // kesik kenar

      if (!fis) {
        const n = o.zimba ?? 2, L = Math.max(16, Math.min(21, w * .055));
        const yerler = n === 1 ? [.5] : [.15, .85];
        yerler.slice(0, n).forEach((f, i) => zimba(svg, w * f + k.aralik(r, -6, 6), 9 + k.aralik(r, -1.5, 2),
          k.aralik(r, -7, 7) + (i ? 3 : -3), L, on));
      }
    }
    ciz();
    return { node: svg, yenile: ciz };
  }

  /* ---------- düzeltici sıvı ---------- */

  // Kapalı, yumuşak, düzensiz leke yolu (Catmull-Rom → Bézier)
  function lekeYolu(cx, cy, rx, ry, r, n = 10) {
    const k = KL(), pts = [];
    const don = k.aralik(r, 0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = don + i * Math.PI * 2 / n, f = k.aralik(r, .74, 1.14);
      pts.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]);
    }
    let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d + ' Z';
  }

  function duzeltici(katman, o) {
    const k = KL();
    const r = k.rastgele('duzeltici', ...(o.tohum || [o.x, o.y]));
    const cx = o.x + o.w / 2 + k.aralik(r, -1.5, 1.5), cy = o.y + o.h / 2 + k.aralik(r, -1.5, 1.5);
    const rx = o.w * k.aralik(r, .36, .42), ry = o.h * k.aralik(r, .33, .4);
    const d = lekeYolu(cx, cy, rx, ry, r);
    const g = el('g', { class: 'duzeltici' }, katman);
    el('path', { d, fill: 'rgba(96, 80, 52, .13)', transform: 'translate(.7 1)' }, g);           // kurumuş kenarın gölgesi
    el('path', { d, fill: RENK.duzeltici, stroke: 'rgba(150, 134, 104, .3)', 'stroke-width': .7 }, g);
    for (let i = 0; i < 3; i++) {                                                                // fırça izleri
      const y = cy + (i - 1) * ry * .45 + k.aralik(r, -1, 1);
      const x1 = cx - rx * k.aralik(r, .45, .7), x2 = cx + rx * k.aralik(r, .45, .7);
      el('path', { d: `M${x1.toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${(y + k.aralik(r, -1.5, 1.5)).toFixed(1)} ${x2.toFixed(1)} ${(y + k.aralik(r, -1, 1)).toFixed(1)}`,
        fill: 'none', stroke: 'rgba(200, 190, 168, .45)', 'stroke-width': .6, 'stroke-linecap': 'round' }, g);
    }
    el('ellipse', { cx: (cx - rx * .3).toFixed(1), cy: (cy - ry * .45).toFixed(1), rx: (rx * .2).toFixed(1), ry: (ry * .08).toFixed(1),
      fill: 'white', 'fill-opacity': .45 }, g);                                                   // kurumuş sıvının hafif parlaması
    let bitti = Promise.resolve();
    if (!o.anlik && k.animasyonVar()) {
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = 'center';
      const a = g.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 90, delay: o.gecikme || 0, easing: 'ease-out', fill: 'backwards' });
      bitti = a.finished.then(() => {}, () => {});
    }
    return { node: g, bitti };
  }

  function sol(node, ms = 300) {
    if (!node || !node.parentNode) return Promise.resolve();
    if (!KL().animasyonVar()) { node.remove(); return Promise.resolve(); }
    const a = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    return a.finished.then(() => node.remove(), () => node.remove());
  }

  /* ---------- ses ---------- */

  const sesler = {
    // Düzeltici sıvının yumuşak dokunuşu: fırçanın kâğıda değmesi
    duzeltici(c, h, t0) {
      Kit.ses.parazit(c, h, t0, 'lowpass', 800, 300, .7, .075, .12);
      Kit.ses.parazit(c, h, t0 + .01, 'bandpass', 1600, 1100, .8, .05, .035);
    },
  };

  Kit.daktilokagidi = { RENK, kur, duzeltici, sol, lekeYolu, sesler };
})();
