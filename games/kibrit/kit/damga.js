// kit/damga.js — kırmızı LASTİK DAMGA: eğik, çift çerçeveli, mürekkebi yer yer eksik, kenarları hafif dalgalı.
// Basılı nesne (rough.js yok). Hangi oyun olduğunu bilmez.
//
//   const d = Kit.damga.bas(kap, 'Çözüldü', { x, y, aci, tohum: ['damga', 3], boyut: 34, renk, anlik })   // → { node, bitti }
//   Kit.damga.kaldir(kap)                        // kaptaki damgaları siler
// Metin tr-TR büyük harfe çevrilir ("ÇÖZÜLDÜ", "İ"). x/y kabın içinde merkez (px); verilmezse ortası.
// Ses: Kit.damga.sesler.damga (tok basma).
(function () {
  'use strict';
  const Kit = (window.Kit = window.Kit || {});
  const NS = 'http://www.w3.org/2000/svg';
  let sayac = 0;
  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  function bas(kap, metin, o = {}) {
    const KL = Kit.kalem;
    const tohum = o.tohum || ['damga', metin];
    const r = KL.rastgele('damga', ...tohum);
    const renk = o.renk || '#b3261e';
    const boyut = o.boyut || 34;
    const yazi = String(metin).toLocaleUpperCase('tr-TR');
    const id = 'dg' + (++sayac);
    const svg = el('svg', { class: 'damga', 'aria-hidden': 'true' }, null);
    kap.appendChild(svg);
    // Önce metni ölç (font yüklü olmalı; değilse yaklaşık genişlik)
    const t = el('text', { x: 0, y: 0, 'font-size': boyut, 'font-weight': 700, 'letter-spacing': boyut * .06 }, svg);
    t.textContent = yazi;
    let tw = boyut * .55 * yazi.length;
    try { const b = t.getBBox(); if (b.width > 0) tw = b.width; } catch (e) { /* yoksay */ }
    t.remove();
    const pad = boyut * .42, w = tw + pad * 2, h = boyut * 1.36;
    const P = 6;                                             // dalgalı kenar için taşma payı
    svg.setAttribute('viewBox', `${-P} ${-P} ${w + 2 * P} ${h + 2 * P}`);
    svg.setAttribute('width', w + 2 * P); svg.setAttribute('height', h + 2 * P);
    const defs = el('defs', {}, svg);
    // Lastik kenarı: çok hafif yer değiştirme
    const fd = el('filter', { id: id + 'd', x: '-5%', y: '-10%', width: '110%', height: '120%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .09, numOctaves: 2, seed: Math.floor(r() * 999), result: 'n' }, fd);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.2, xChannelSelector: 'R', yChannelSelector: 'G' }, fd);
    // Mürekkep eksikleri: eşiklenmiş gürültü + bir kenarı açık baskı + birkaç leke
    const fm = el('filter', { id: id + 'f', x: 0, y: 0, width: '100%', height: '100%', filterUnits: 'userSpaceOnUse' }, defs);
    fm.setAttribute('x', -P); fm.setAttribute('y', -P); fm.setAttribute('width', w + 2 * P); fm.setAttribute('height', h + 2 * P);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: (.5 + r() * .25).toFixed(2), numOctaves: 2, seed: Math.floor(r() * 999) }, fm);
    el('feColorMatrix', { type: 'matrix', values: '7 0 0 0 -2.1  7 0 0 0 -2.1  7 0 0 0 -2.1  0 0 0 0 1' }, fm);
    const mk = el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: -P, y: -P, width: w + 2 * P, height: h + 2 * P }, defs);
    el('rect', { x: -P, y: -P, width: w + 2 * P, height: h + 2 * P, fill: 'white', filter: `url(#${id}f)` }, mk);
    const yon = r() < .5;
    const lg = el('linearGradient', { id: id + 'g', x1: yon ? 0 : 1, y1: 0, x2: yon ? 1 : 0, y2: .3 }, defs);
    el('stop', { offset: 0, 'stop-color': 'black', 'stop-opacity': .42 }, lg);
    el('stop', { offset: .45, 'stop-color': 'black', 'stop-opacity': 0 }, lg);
    el('rect', { x: -P, y: -P, width: w + 2 * P, height: h + 2 * P, fill: `url(#${id}g)` }, mk);
    const leke = 5 + Math.floor(r() * 5);
    for (let i = 0; i < leke; i++) {
      el('ellipse', { cx: (r() * w).toFixed(1), cy: (r() * h).toFixed(1), rx: (.8 + r() * boyut * .09).toFixed(1), ry: (.5 + r() * boyut * .05).toFixed(1),
        transform: `rotate(${Math.floor(r() * 180)} 0 0)`, fill: 'black', 'fill-opacity': (.5 + r() * .5).toFixed(2) }, mk);
    }
    const g = el('g', { mask: `url(#${id}m)` }, svg);
    const ic = el('g', { filter: `url(#${id}d)`, fill: renk, stroke: renk }, g);
    const rx = boyut * .16;
    if (o.cerceve !== false) {
      el('rect', { x: 1.2, y: 1.2, width: w - 2.4, height: h - 2.4, rx, fill: 'none', 'stroke-width': boyut * .085 }, ic);
      el('rect', { x: boyut * .17, y: boyut * .17, width: w - boyut * .34, height: h - boyut * .34, rx: rx * .6, fill: 'none', 'stroke-width': boyut * .035 }, ic);
    }
    const yt = el('text', { x: w / 2, y: h / 2 + boyut * .35, 'text-anchor': 'middle', 'font-size': boyut, 'font-weight': 700,
      'letter-spacing': boyut * .06, stroke: 'none' }, ic);
    yt.textContent = yazi;
    // Yerleşim: kabın içinde merkez + eğim
    const aci = o.aci ?? ((r() * 2 - 1) * 8);
    const x = o.x ?? kap.clientWidth / 2, y = o.y ?? kap.clientHeight / 2;
    svg.style.left = x + 'px'; svg.style.top = y + 'px';
    const son = `translate(-50%, -50%) rotate(${aci.toFixed(1)}deg)`;
    svg.style.transform = son;
    svg.style.opacity = String(o.opaklik ?? .9);
    let bitti = Promise.resolve();
    if (!o.anlik && KL.animasyonVar()) {
      const a = svg.animate([
        { transform: `${son} scale(1.22)`, opacity: 0 },
        { transform: `${son} scale(.98)`, opacity: o.opaklik ?? .9, offset: .8 },
        { transform: `${son} scale(1)`, opacity: o.opaklik ?? .9 },
      ], { duration: 150, easing: 'cubic-bezier(.5,0,.8,.4)' });
      bitti = a.finished.catch(() => {});
    }
    return { node: svg, bitti };
  }

  function kaldir(kap) { kap.querySelectorAll(':scope > svg.damga').forEach(d => d.remove()); }

  const sesler = {
    // tok bir basma: düşük vuruş + kısa kuru gürültü
    damga(c, h, t0) {
      Kit.ses.nota(c, h, t0, 'sine', 150, 62, .09, .42);
      Kit.ses.parazit(c, h, t0, 'lowpass', 900, 300, .8, .07, .24);
      Kit.ses.parazit(c, h, t0 + .005, 'bandpass', 2200, 1200, 1.4, .03, .06);
    },
  };

  Kit.damga = { bas, kaldir, sesler };
})();
