// kit/silgi.js — pembe kauçuk silgi ve sildiği yerin izi. Hangi oyun olduğunu bilmez.
// Silgi bir NESNEDİR (kibrit, damga gibi): kalemle çizilmez, rough.js kullanmaz; düz SVG dolgu ve gradyan.
// Silinen yer canvas'ta kalır: gri lekeli, sürtülmüş kâğıt ve kırıntılar (koyu sayfada jel mürekkebi tam çıkmaz).
//   const s = Kit.silgi.kur(kap, { genislik: 120, tohum: ['silgi'] })   // kap: position relative/absolute
//   s.konumla(x, y, aci)        // silen kenarın ortası (px) ve derece; s.kaldir()
//   Kit.silgi.leke(ctx, { x, y, w, h }, ['bant', 3])                   // silinmiş bant
//   Kit.silgi.kirinti(ctx, { x, y, w, h }, ['kirinti', 3], adet)        // dökülen kırıntılar
(function () {
  'use strict';
  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl } = KL;

  const GOVDE = '#f28ca2', GOVDE_ACIK = '#f9b3c2', KENAR = '#d46f86', KIR = '#8d7479';
  let no = 0;

  // Silgi yukarıdan bakılınca: yuvarlak köşeli kauçuk blok, alt (silen) kenarı aşınmış ve kirli; yanda kalınlık yüzü.
  function kur(kap, o = {}) {
    const w = o.genislik || 120, h = Math.round(w * .42), r = rastgele('silgi', ...(o.tohum || ['silgi']));
    const id = 'sg' + (++no);
    const svg = svgEl('svg', { class: 'silgi', 'aria-hidden': 'true', width: w + 16, height: h + 22, viewBox: `-8 -6 ${w + 16} ${h + 22}` }, kap);
    svg.style.position = 'absolute';
    svg.style.left = '0'; svg.style.top = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    const d = svgEl('defs', null, svg);
    const ust = svgEl('linearGradient', { id: id + 'u', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    [[0, GOVDE_ACIK], [.45, GOVDE], [1, '#e9798f']].forEach(([of, c]) => svgEl('stop', { offset: of, 'stop-color': c }, ust));
    const yan = svgEl('linearGradient', { id: id + 'y', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    [[0, KENAR], [.6, '#c45f77'], [1, '#a94f65']].forEach(([of, c]) => svgEl('stop', { offset: of, 'stop-color': c }, yan));
    const kir = svgEl('linearGradient', { id: id + 'k', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    [[0, 'rgba(141,116,121,0)'], [.7, 'rgba(141,116,121,.45)'], [1, 'rgba(110,92,96,.75)']].forEach(([of, c]) => svgEl('stop', { offset: of, 'stop-color': c }, kir));
    const bul = svgEl('filter', { id: id + 'g', x: '-30%', y: '-30%', width: '160%', height: '180%' }, d);
    svgEl('feGaussianBlur', { stdDeviation: 4 }, bul);

    // Aşınmış alt kenar: hafif dalgalı, köşeleri yuvarlanmış
    const alt = [];
    for (let i = 0; i <= 8; i++) alt.push([w * i / 8, h + aralik(r, -1.2, .8) - (i === 0 || i === 8 ? 3 : 0)]);
    const govde = `M 6 0 L ${w - 6} 0 Q ${w} 0 ${w} 6 L ${w} ${h - 6} ` +
      alt.slice().reverse().map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ` L 0 6 Q 0 0 6 0 Z`;

    svgEl('ellipse', { cx: w / 2 + 6, cy: h + 9, rx: w * .52, ry: h * .3, fill: 'rgba(0,0,0,.55)', filter: `url(#${id}g)` }, svg);
    svgEl('path', { d: govde, transform: 'translate(0 5)', fill: `url(#${id}y)` }, svg);           // kalınlık yüzü
    svgEl('path', { d: govde, fill: `url(#${id}u)` }, svg);                                           // üst yüz
    const gozenek = svgEl('g', { opacity: .35 }, svg);                                                // kauçuk gözenekleri
    for (let i = 0; i < 26; i++) {
      svgEl('circle', { cx: aralik(r, 4, w - 4).toFixed(1), cy: aralik(r, 3, h - 4).toFixed(1), r: aralik(r, .35, .8).toFixed(2), fill: i % 3 ? '#ffd6df' : '#c9667c' }, gozenek);
    }
    svgEl('path', { d: `M 7 2.2 L ${w - 7} 2.2`, stroke: 'rgba(255,255,255,.55)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svg);  // üst kenar ışığı
    // Kir yalnız silen kenarda: silgi gövdesiyle kırpılır
    const kirp = svgEl('clipPath', { id: id + 'c' }, d);
    svgEl('path', { d: govde }, kirp);
    const kirli = svgEl('rect', { x: -2, y: h * .58, width: w + 4, height: h * .5, fill: `url(#${id}k)`, 'clip-path': `url(#${id}c)` }, svg);
    svg.insertBefore(kirli, gozenek);

    return {
      node: svg,
      genislik: w, yukseklik: h,
      // (x, y): silen kenarın ortası; aci derece
      konumla(x, y, aci = 0) {
        svg.style.transform = `translate(${(x - w / 2 - 8).toFixed(1)}px, ${(y - h - 6).toFixed(1)}px) rotate(${aci}deg)`;
        svg.style.transformOrigin = `${w / 2 + 8}px ${h + 6}px`;
      },
      kaldir() { svg.remove(); },
    };
  }

  // Silinmiş bant: koyu sayfada jel mürekkebi tam çıkmaz; geriye gri, sürtülmüş, lekeli bir yüzey kalır.
  function leke(ctx, a, an = ['leke']) {
    const r = rastgele('silgi-leke', ...an);
    ctx.save();
    ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip();
    ctx.fillStyle = 'rgba(58, 56, 54, .3)';                                       // sürtülmüş kâğıt
    ctx.fillRect(a.x, a.y, a.w, a.h);
    for (let i = 0, n = Math.ceil(a.w * a.h / 900); i < n; i++) {                 // silinmeye direnen mürekkep lekeleri
      const x = aralik(r, a.x, a.x + a.w), y = aralik(r, a.y, a.y + a.h), rx = aralik(r, 6, 22), ry = aralik(r, 2, 6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, `rgba(150, 146, 140, ${aralik(r, .05, .12).toFixed(3)})`);
      g.addColorStop(1, 'rgba(150, 146, 140, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, aralik(r, -.25, .25), 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = 'round';                                                         // silginin ileri geri sürtme çizikleri
    for (let i = 0, n = Math.ceil(a.h / 3); i < n; i++) {
      const y = aralik(r, a.y, a.y + a.h), x = aralik(r, a.x - 20, a.x + a.w * .7), L = aralik(r, 20, a.w * .5);
      ctx.strokeStyle = `rgba(120, 116, 112, ${aralik(r, .04, .1).toFixed(3)})`;
      ctx.lineWidth = aralik(r, .6, 1.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + L / 2, y + aralik(r, -2, 2), x + L, y + aralik(r, -1.5, 1.5)); ctx.stroke();
    }
    ctx.restore();
  }

  // Kırıntılar: kıvrılmış, mürekkep bulaşmış küçük kauçuk parçaları (1–3 px).
  function kirinti(ctx, a, an = ['kirinti'], adet = 8) {
    const r = rastgele('silgi-kirinti', ...an);
    ctx.save();
    for (let i = 0; i < adet; i++) {
      const x = aralik(r, a.x, a.x + a.w), y = aralik(r, a.y, a.y + a.h);
      const rx = aralik(r, 1, 3), ry = rx * aralik(r, .35, .7), aci = aralik(r, 0, Math.PI);
      ctx.fillStyle = r() < .6 ? '#d9a1ad' : '#b98d96';
      ctx.strokeStyle = 'rgba(60, 46, 50, .6)';
      ctx.lineWidth = .5;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, aci, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(70, 64, 66, .45)';
      ctx.beginPath(); ctx.ellipse(x + rx * .2, y, rx * .4, ry * .5, aci, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  Kit.silgi = { kur, leke, kirinti, RENK: { GOVDE, KENAR, KIR } };
})();
