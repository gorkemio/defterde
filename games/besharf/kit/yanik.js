// kit/yanik.js — kâğıt yanıkları: defter sayfasının yanık köşeleri (fraktal kenar, katmanlı is, kül, alttaki yaprakta
// kavrulma) ve herhangi bir çokgen köşesini yakan genel yardımcı. Kâğıt katmanıdır (rough.js yok); oyunu bilmez.
//
//   Kit.yanik.sayfa(sayfaEl, { tohum, koseler: [1], yaricap: 7, yuvarlak: [1, 2], derin, altKap: defterEl })
//   Kit.yanik.kose(P, w, h, tohum, koseler, { derin, nokta, titreme, fraktal, anahtar })   // P'yi yerinde değiştirir; P.yanik
//   Kit.yanik.yuvarlakDikdortgen(w, h, R, yuvarlak) → [[x, y], …]
// Sayfaya px cinsinden clip-path polygon verilir; yalnız dış gölgesi alttaki yaprakta olan sayfalarda kullan.
(function () {
  'use strict';
  const Kit = (window.Kit = window.Kit || {});
  const NS = 'http://www.w3.org/2000/svg';
  let sayac = 0;
  const KL = () => Kit.kalem;
  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  function yak(P, w, h, tohum, koseler, o = {}) {
    const r = KL().rastgele(o.anahtar || 'kupur-yanik', ...(tohum || ['kupur']));
    const K = [[0, 0], [w, 0], [w, h], [0, h]];
    const yanik = [];
    for (const c of koseler) {
      const [kx, ky] = K[c];
      const once = K[(c + 3) % 4], sonra = K[(c + 1) % 4];
      const uz = (q) => { const L = Math.hypot(q[0] - kx, q[1] - ky); return [(q[0] - kx) / L, (q[1] - ky) / L]; };
      const ui = uz(once), uo = uz(sonra);
      const yatay = (u) => Math.abs(u[0]) > Math.abs(u[1]);
      // varsayılan hafif: küçük bir kutunun iç boşluğunu aşmaz (yatayda 9–15 px, dikeyde 8–13 px)
      const [yd, dd] = o.derin || [[9, 15], [8, 13]];
      const derin = (u) => (yatay(u) ? yd[0] + r() * (yd[1] - yd[0]) : dd[0] + r() * (dd[1] - dd[0]));
      const a = derin(ui), b = derin(uo);
      const icinde = (p) => {
        const dx = p[0] - kx, dy = p[1] - ky;
        const pi = dx * ui[0] + dy * ui[1], po = dx * uo[0] + dy * uo[1];
        return pi >= -2 && po >= -2 && (pi / a) ** 2 + (po / b) ** 2 < 1.05;
      };
      const n = P.length;
      const at = P.map(icinde);
      let bas = -1;
      for (let i = 0; i < n; i++) if (at[i] && !at[(i - 1 + n) % n]) { bas = i; break; }
      if (bas < 0) continue;
      let m = 0; while (m < n && at[(bas + m) % n]) m++;
      // dalgalı yay: gelen kenardaki noktadan giden kenardaki noktaya, köşeye doğru içbükey
      const yay = [];
      const N = o.nokta || 14;
      const A = o.titreme || .28;
      // kenar biçimi: 'fraktal' (beş oktav değer gürültüsü + birkaç ısırık; gerçek yanık) ya da yumuşak dalga
      let bicimF;
      if (o.fraktal) {
        const oktav = [[2, .55], [5, .34], [11, .14], [23, .06], [47, .025]];
        const kafes = oktav.map(([F]) => Array.from({ length: F + 2 }, () => r() * 2 - 1));
        const isirik = Array.from({ length: 1 + Math.floor(r() * 2) }, () => ({ c: .2 + r() * .6, w: .06 + r() * .08, d: (r() < .65 ? -1 : 1) * (.06 + r() * .1) }));
        bicimF = (t) => {
          let v = 0;
          oktav.forEach(([F, Ag], k) => { const xx = t * F, i0 = Math.floor(xx), u = xx - i0, sm = u * u * (3 - 2 * u); v += Ag * (kafes[k][i0] * (1 - sm) + kafes[k][i0 + 1] * sm); });
          for (const b of isirik) v += b.d * Math.exp(-(((t - b.c) / b.w) ** 2)) / A;
          return v;
        };
      } else {
        const dalga = [[2 + r() * 1.5, r() * 6.3, .5], [4.5 + r() * 2, r() * 6.3, .32], [9 + r() * 3, r() * 6.3, .18]];
        bicimF = (t) => .6 * dalga.reduce((top, [fr, ph, ag]) => top + ag * Math.sin(fr * Math.PI * t + ph), 0) + (r() < .1 ? -.1 : 0);
      }
      for (let i = 0; i <= N; i++) {
        const f = i / N * Math.PI / 2, t = i / N;
        const zarf = Math.pow(Math.sin(Math.PI * t), o.fraktal ? .5 : 1);
        const j = (i === 0 || i === N) ? 1 : 1 + A * bicimF(t) * zarf;
        yay.push([kx + (Math.cos(f) * a * ui[0] + Math.sin(f) * b * uo[0]) * j, ky + (Math.cos(f) * a * ui[1] + Math.sin(f) * b * uo[1]) * j]);
      }
      const yeni = [];
      for (let i = 0; i < n - m; i++) yeni.push(P[(bas + m + i) % n]);
      yeni.push(...yay);
      P.length = 0; P.push(...yeni);
      yanik.push({ kose: c, yay, a, b, kx, ky });
    }
    P.yanik = yanik;
    return P;
  }

  function yuvarlakDikdortgen(w, h, R, yuvarlak) {
    const P = [];
    const yay = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = (a0 + i * 15) * Math.PI / 180; P.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
    const k = (i) => R > 0 && yuvarlak.includes(i);
    if (k(0)) yay(R, R, 180); else P.push([0, 0]);
    if (k(1)) yay(w - R, R, 270); else P.push([w, 0]);
    if (k(2)) yay(w - R, h - R, 0); else P.push([w, h]);
    if (k(3)) yay(R, h - R, 90); else P.push([0, h]);
    return P;
  }

  // Defter sayfasının yanık köşeleri: üst yaprak köşede yanıp kopmuş; kenar fraktal (gerçek yanık gibi düzensiz), kenarı
  // izleyen katmanlı kömür → kahve → sarımsı is bandı (bant sınırları türbülansla bozulur), kenarda kömür ve kül benekleri.
  // Sayfaya px cinsinden clip-path polygon verilir (dış gölge alttaki yaprakta olmalı), üstüne tıklanmaz SVG konur.
  //   Kit.yanik.sayfa(sayfaEl, { tohum, koseler: [1], yaricap: 6, yuvarlak, derin, altKap: defterEl })
  function sayfaYak(sayfa, o = {}) {
    const w = sayfa.offsetWidth, h = sayfa.offsetHeight;
    if (!w || !h) return null;
    const tohum = o.tohum || ['sayfa'];
    const koseler = o.koseler || [1];
    const P = yuvarlakDikdortgen(w, h, o.yaricap ?? 0, o.yuvarlak || [0, 1, 2, 3]);
    const k = Math.max(.55, Math.min(1.15, w / 700));
    const derin = o.derin || [[52 * k, 92 * k], [44 * k, 78 * k]];
    yak(P, w, h, tohum, koseler, { anahtar: 'sayfa-yanik', derin, nokta: 110, titreme: .3, fraktal: true });
    sayfa.style.clipPath = `polygon(${P.map(q => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(', ')})`;
    let svg = sayfa.querySelector(':scope > svg.sayfa-yanik');
    if (!svg) { svg = el('svg', { class: 'sayfa-yanik', 'aria-hidden': 'true' }); sayfa.appendChild(svg); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    const id = 'sy' + (++sayac);
    const defs = el('defs', {}, svg);
    const r = KL().rastgele('sayfa-is', ...tohum);
    // süzgeç bölgesi sayfanın tamamı (varsayılan sınırlar bulanık bandı dikdörtgen keserdi)
    const f = el('filter', { id: id + 'f', filterUnits: 'userSpaceOnUse', x: -40, y: -40, width: w + 80, height: h + 80 }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .028, numOctaves: 3, seed: Math.floor(r() * 999), result: 'n' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 16, xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, f);
    el('feGaussianBlur', { in: 'd', stdDeviation: 5 }, f);
    const fk = el('filter', { id: id + 'k', filterUnits: 'userSpaceOnUse', x: -20, y: -20, width: w + 40, height: h + 40 }, defs);
    el('feGaussianBlur', { stdDeviation: 1.4 }, fk);
    const BANT = [[96, 'rgba(196,156,92,.16)'], [64, 'rgba(170,122,62,.22)'], [40, 'rgba(128,82,38,.3)'], [22, 'rgba(82,48,20,.5)'], [10, 'rgba(40,22,9,.75)']];
    for (const y of P.yanik) {
      const d = 'M' + y.yay.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
      const g = el('g', { filter: `url(#${id}f)` }, svg);
      for (const [gen, renk] of BANT) el('path', { d, fill: 'none', stroke: renk, 'stroke-width': (gen * k).toFixed(1), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      // kenarın kendisi: yumuşak kömür bandı, üstünde ince kömür çizgisi ve kül grisi
      el('path', { d, fill: 'none', stroke: 'rgba(24,13,5,.8)', 'stroke-width': 6, 'stroke-linejoin': 'round', filter: `url(#${id}k)` }, svg);
      el('path', { d, fill: 'none', stroke: 'rgba(12,7,3,.92)', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, svg);
      el('path', { d, fill: 'none', stroke: 'rgba(110,104,96,.5)', 'stroke-width': .8, 'stroke-linejoin': 'round' }, svg);
      // kenara yakın kömür ve kül benekleri
      for (let i = 0; i < 34; i++) {
        const q = y.yay[Math.floor(r() * y.yay.length)];
        const vx = q[0] - y.kx, vy = q[1] - y.ky, L = Math.hypot(vx, vy) || 1;
        const ic = 3 + r() * 16 * k;
        const px = q[0] + vx / L * ic, py = q[1] + vy / L * ic;
        const kul = r() < .3;
        el('ellipse', { cx: px.toFixed(1), cy: py.toFixed(1), rx: (.4 + r() * 1.5).toFixed(2), ry: (.3 + r() * 1).toFixed(2),
          transform: `rotate(${Math.floor(r() * 180)} ${px.toFixed(1)} ${py.toFixed(1)})`,
          fill: kul ? 'rgba(120,114,106,.5)' : `rgba(30,17,7,${(.25 + r() * .5).toFixed(2)})` }, svg);
      }
    }
    if (o.altKap) altYaprakIsi(o.altKap, sayfa, P.yanik, k, tohum);
    return { svg, noktalar: P, yanik: P.yanik };
  }

  // Alttaki yaprak: üst yaprağın yanıp koptuğu yerde görünen kavrulma (defter kabında, sayfanın altında duran SVG)
  function altYaprakIsi(kap, sayfa, yaniklar, k, tohum) {
    const ad = 'alt-yanik-' + (sayfa.id || 'sayfa');
    let svg = kap.querySelector(`:scope > svg.alt-yanik[data-sayfa="${ad}"]`);
    if (!svg) { svg = el('svg', { class: 'alt-yanik', 'data-sayfa': ad, 'aria-hidden': 'true' }); kap.insertBefore(svg, kap.firstChild); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = kap.offsetWidth, H = kap.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    const ox = sayfa.offsetLeft, oy = sayfa.offsetTop;
    const id = 'ay' + (++sayac);
    const r = KL().rastgele('alt-yanik', ...tohum);
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: id + 'f', filterUnits: 'userSpaceOnUse', x: -40, y: -40, width: W + 80, height: H + 80 }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .035, numOctaves: 3, seed: Math.floor(r() * 999), result: 'n' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 20, xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, f);
    el('feGaussianBlur', { in: 'd', stdDeviation: 8 }, f);
    for (const y of yaniklar) {
      // alttaki yaprak daha az yanmış: aynı biçim köşeye doğru küçültülmüş, yalnız kavrulma
      const yay = y.yay.map(q => [ox + y.kx + (q[0] - y.kx) * .6, oy + y.ky + (q[1] - y.ky) * .6]);
      const d = 'M' + yay.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
      const g = el('g', { filter: `url(#${id}f)` }, svg);
      for (const [gen, renk] of [[80, 'rgba(180,134,72,.18)'], [44, 'rgba(140,92,42,.24)'], [16, 'rgba(70,40,16,.45)']]) {
        el('path', { d, fill: 'none', stroke: renk, 'stroke-width': (gen * k).toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      }
    }
  }

  Kit.yanik = { kose: yak, yuvarlakDikdortgen, sayfa: sayfaYak };
})();
