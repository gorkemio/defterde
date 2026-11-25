// kit/kibrit.js — kâğıdın üstünde duran gerçek nesneler: tahta KİBRİT ÇÖPÜ, çekmeceli KİBRİT KUTUSU ve boş yuva izi.
// Basılı/nesne katmanı: düz SVG dolgu (rough.js yok). Hangi oyun olduğunu bilmez (yedi yuva, eşitlik yok).
//
//   const c = Kit.kibrit.cop(svg, { uzunluk: 56, tohum: ['cop', 3] })   // → { node: g.cop, uzunluk }; yerel: merkez orijin, x ekseni
//   Kit.kibrit.konumla(c.node, x, y, aci, { kayma: true, tohum, yon: 1|-1, olcek })   // elle konmuş gibi ±1.5 px, ±2°
//   const y = Kit.kibrit.yuva(svg, { x, y, aci, uzunluk }); Kit.kibrit.yuvaDurum(y, 0|1|2|3)   // gizli / silik / vurgulu / uzak
//   const k = Kit.kibrit.kutu(kap, { acik: false, tohum, etiket: 'KİBRİT' })   // → { node, ac(), kapa(), acik() }
// Gölge: aynı silüetin kaydırılmış yarı saydam kopyası (filter yok); konumla dönüşe göre gölgeyi hep sağ-alta düşürür.
(function () {
  'use strict';
  const Kit = (window.Kit = window.Kit || {});
  const NS = 'http://www.w3.org/2000/svg';
  const KL = () => Kit.kalem;
  let sayac = 0;
  const tanim = new WeakMap();          // svg → ortak gradyan kimlikleri

  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  // Bir svg'de bir kez: ahşap gövde ve kırmızı baş gradyanları (objectBoundingBox: her çöpte aynı tanım)
  function tanimlar(svg) {
    let t = tanim.get(svg);
    if (t && t.defs.isConnected) return t;
    const id = 'kb' + (++sayac);
    const defs = el('defs', {}, null);
    svg.insertBefore(defs, svg.firstChild);
    // ahşap: üstte ince ışık, altta gölgeli yuvarlak kenar
    const ah = el('linearGradient', { id: id + 'a', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#f4dcaa'], [.14, '#ecca8c'], [.5, '#dcae67'], [.82, '#c38f4a'], [1, '#9a6a33']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, ah));
    // baş: sol üstten ışık alan küçük bir küre
    const bs = el('radialGradient', { id: id + 'b', cx: .4, cy: .32, r: .78 }, defs);
    [[0, '#e56152'], [.3, '#c73d30'], [.7, '#922419'], [1, '#56130d']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, bs));
    // yumuşak gölge: tek bulanıklık süzgeci (svg başına bir kez)
    const f = el('filter', { id: id + 'g', x: '-30%', y: '-120%', width: '160%', height: '340%' }, defs);
    el('feGaussianBlur', { stdDeviation: 1.25 }, f);
    t = { defs, ahsap: `url(#${id}a)`, bas: `url(#${id}b)`, bulanik: `url(#${id}g)` };
    tanim.set(svg, t);
    return t;
  }

  // Çöp gövdesi + baş yolu (yerel, merkez orijin). r: tohumlu rastgele. Döner { govde, bas, ucX, kal }
  function bicim(L, r, basit) {
    const kal = Math.max(3.4, L * .1);                        // gövde kalınlığı (okunurluk için kalın)
    const basU = L * (.13 + r() * .02), basK = kal * (1.28 + r() * .1);
    const x0 = -L / 2, x1 = L / 2 - basU * .55;                // gövde baştan biraz içeri girer
    const j = () => (basit ? 0 : (r() - .5) * .5);
    const h = kal / 2;
    const govde = `M${f1(x0 + h * .5)} ${f1(-h + j())} L${f1(x1)} ${f1(-h + j())} L${f1(x1)} ${f1(h + j())} L${f1(x0 + h * .5)} ${f1(h + j())}` +
      ` Q${f1(x0 - h * .15)} ${f1(h)} ${f1(x0 - h * .1)} 0 Q${f1(x0 - h * .15)} ${f1(-h)} ${f1(x0 + h * .5)} ${f1(-h + j())} Z`;
    // baş: arkası gövdeye oturan, ucu yuvarlak, hafif asimetrik damla
    const bx0 = L / 2 - basU, bx1 = L / 2, bh = basK / 2, sk = (r() - .5) * .25 * bh;
    const bas = `M${f1(bx0)} ${f1(-h * .9)} C${f1(bx0 + basU * .25)} ${f1(-bh * 1.02 + sk)} ${f1(bx1 - basU * .2)} ${f1(-bh + sk)} ${f1(bx1)} ${f1(sk * .4)}` +
      ` C${f1(bx1 - basU * .2)} ${f1(bh + sk)} ${f1(bx0 + basU * .25)} ${f1(bh * 1.02 + sk)} ${f1(bx0)} ${f1(h * .9)} Z`;
    return { govde, bas, x0, x1, bx0, bx1, kal, bh };
  }

  function cop(svg, o = {}) {
    const tohum = o.tohum || ['cop', o.id || 0];
    const r = KL().rastgele('kibrit', ...tohum);
    const L = (o.uzunluk || 56) * (1 + (r() * 2 - 1) * .02);
    const t = tanimlar(svg);
    const B = bicim(L, r, o.basit);
    const g = el('g', { class: 'cop' + (o.sinif ? ' ' + o.sinif : '') }, null);
    // gölge: bulanık yumuşak gölge + çöpün hemen altında ince temas gölgesi (konumla dönüşe göre ofsetler)
    const golge = el('g', { class: 'cop-golge' }, g);
    if (!o.basit) golge.setAttribute('filter', t.bulanik);
    el('path', { d: B.govde, fill: 'rgba(40,24,8,.4)' }, golge);
    el('path', { d: B.bas, fill: 'rgba(40,24,8,.42)' }, golge);
    const temas = el('g', { class: 'cop-temas' }, g);
    el('path', { d: B.govde, fill: 'rgba(40,24,8,.28)' }, temas);
    const govde = el('g', { class: 'cop-govde' }, g);
    el('path', { d: B.govde, fill: t.ahsap, stroke: 'rgba(104,68,28,.72)', 'stroke-width': .7 }, govde);
    // tohumlu ton farkı: her çöp biraz farklı ahşap
    const ton = r();
    el('path', { d: B.govde, fill: ton < .5 ? '#c79a55' : '#f6ead0', 'fill-opacity': (.04 + r() * .1).toFixed(3) }, govde);
    if (!o.basit) {
      // damarlar: gövde boyunca ince, hafif dalgalı çizgiler
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const y = (r() - .5) * B.kal * .62, xa = B.x0 + B.kal * (.4 + r() * 2), xb = B.x1 - r() * B.kal * 2;
        const ym = y + (r() - .5) * .7;
        el('path', { d: `M${f1(xa)} ${f1(y)} Q${f1((xa + xb) / 2)} ${f1(ym)} ${f1(xb)} ${f1(y + (r() - .5) * .4)}`,
          stroke: 'rgba(140,96,44,' + (.22 + r() * .2).toFixed(2) + ')', 'stroke-width': (.35 + r() * .3).toFixed(2), fill: 'none' }, govde);
      }
      // kuyruk ucunda kesik ahşap (kesit biraz koyu)
      el('ellipse', { cx: f1(B.x0 + B.kal * .12), cy: 0, rx: f1(B.kal * .2), ry: f1(B.kal * .42), fill: 'rgba(150,110,60,.32)' }, govde);
    }
    // baş: koyu uç, kırmızı gövde, küçük parlaklık
    el('path', { d: B.bas, fill: t.bas, stroke: 'rgba(70,16,12,.6)', 'stroke-width': .5 }, govde);
    if (!o.basit) {
      el('ellipse', { cx: f1(B.bx1 - (B.bx1 - B.bx0) * .2), cy: f1(B.bh * .1), rx: f1((B.bx1 - B.bx0) * .2), ry: f1(B.bh * .55), fill: '#4e110d', 'fill-opacity': .45 }, govde);
      el('ellipse', { cx: f1(B.bx0 + (B.bx1 - B.bx0) * .55), cy: f1(-B.bh * .42), rx: f1((B.bx1 - B.bx0) * .16), ry: f1(B.bh * .16), fill: '#fff4ec', 'fill-opacity': .55 }, govde);
    }
    g.__kibrit = { L, golgeX: o.golge?.[0] ?? 1.8, golgeY: o.golge?.[1] ?? 2.6, golge, temas };
    (o.ebeveyn || svg).appendChild(g);
    konumla(g, 0, 0, 0, { kayma: false });
    return { node: g, uzunluk: L };
  }

  // Dönüş/konum: aci derece. kayma: elle konmuş gibi tohumlu küçük sapma. yon: -1 başı ters uca çevirir.
  function konumla(g, x, y, aci, o = {}) {
    let dx = 0, dy = 0, da = 0;
    if (o.kayma) {
      const r = KL().rastgele('kibrit-kayma', ...(o.tohum || [x, y, aci]));
      dx = (r() * 2 - 1) * 1.5; dy = (r() * 2 - 1) * 1.5; da = (r() * 2 - 1) * 2;
    }
    const a = aci + da + (o.yon === -1 ? 180 : 0);
    const s = o.olcek || 1;
    g.setAttribute('transform', `translate(${f1(x + dx)} ${f1(y + dy)}) rotate(${f1(a)}) scale(${s})`);
    const k = g.__kibrit;
    if (k) {
      // gölge dünya ekseninde sağ-alta: yerel ofset = R(-a) · (gx, gy); kalkmış çöpte gölge büyür
      const yuk = o.yukseklik || 1;
      const gx = k.golgeX * yuk, gy = k.golgeY * yuk;
      const rad = -a * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
      k.golge.setAttribute('transform', `translate(${f1((gx * c - gy * sn) / s)} ${f1((gx * sn + gy * c) / s)})`);
      k.golge.setAttribute('opacity', yuk > 1 ? '.62' : '1');
      // temas gölgesi: yerdeyken çöpün hemen altında, kalkınca kaybolur
      k.temas.setAttribute('transform', `translate(${f1((.45 * c - .7 * sn) / s)} ${f1((.45 * sn + .7 * c) / s)})`);
      k.temas.setAttribute('opacity', yuk > 1 ? '0' : '1');
    }
    return { x: x + dx, y: y + dy, aci: a };
  }

  // Baş yönü: yatay çöpte baş sağda, dikey ve çapraz çöpte yukarıda (tutarlı, sakin görünüm)
  function basYonu(aci) {
    const r = aci * Math.PI / 180, sn = Math.sin(r), c = Math.cos(r);
    if (Math.abs(sn) < .3) return c >= 0 ? 1 : -1;
    return sn < 0 ? 1 : -1;
  }
  // Boş yuva: çöp boyunda ve kalınlığında soluk bir iz (zemin) üstünde matbaa noktaları; vurguluyken altında sıcak bir ışık.
  // Kalınlık ve nokta aralığı çöp boyuyla ölçeklenir (renk ve görünürlük kibrit.css'te).
  function yuva(svg, o) {
    const L = o.uzunluk * .8, k = Math.max(3.4, L * .1);
    const g = el('g', { class: 'yuva', transform: `translate(${f1(o.x)} ${f1(o.y)}) rotate(${f1(o.aci || 0)})` }, o.ebeveyn || svg);
    const cizgi = (sinif, oz) => el('line', Object.assign({ x1: f1(-L / 2), y1: 0, x2: f1(L / 2), y2: 0, class: sinif }, oz), g);
    cizgi('yuva-vurgu', { 'stroke-width': f1(k * 1.7) });
    cizgi('yuva-zemin', { 'stroke-width': f1(k) });
    cizgi('yuva-iz', { 'stroke-width': f1(Math.max(1.7, k * .36)), 'stroke-dasharray': `.1 ${f1(Math.max(3.8, L * .085))}` });
    yuvaDurum(g, o.durum ?? 0);
    return g;
  }
  function yuvaDurum(g, d) { g.dataset.durum = String(d); }

  /* ---------- kutu ---------- */
  // Kutu yandan-üstten bakışla: kılıf (etiketli) ve sağa kayan çekmece. viewBox 0 0 200 112.
  function kutu(kap, o = {}) {
    const r = KL().rastgele('kibrit-kutu', ...(o.tohum || ['kutu']));
    const svg = el('svg', { class: 'kibrit-kutu', viewBox: '-6 -8 216 132', 'aria-hidden': 'true' }, null);
    const id = 'kk' + (++sayac);
    const defs = el('defs', {}, svg);
    const mk = el('linearGradient', { id: id + 'm', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#d8c59c'], [1, '#bea477']].forEach(([of, c]) => el('stop', { offset: of, 'stop-color': c }, mk));
    const ic = el('linearGradient', { id: id + 'i', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#a98e60'], [.18, '#cdb889'], [1, '#c3ab7b']].forEach(([of, c]) => el('stop', { offset: of, 'stop-color': c }, ic));
    const sr = el('pattern', { id: id + 's', width: 3, height: 3, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 3, height: 3, fill: '#5a3a26' }, sr);
    el('circle', { cx: 1, cy: 1.2, r: .7, fill: '#7a5238' }, sr);
    el('circle', { cx: 2.4, cy: 2.5, r: .45, fill: '#3b2416' }, sr);
    // gölge
    el('rect', { x: 4, y: 7, width: 124, height: 84, rx: 3, fill: 'rgba(52,34,14,.22)' }, svg);
    // çekmece (kılıfın altında; açılınca sağa kayar)
    const cekmece = el('g', { class: 'cekmece' }, svg);
    el('rect', { x: 6, y: 6, width: 116, height: 72, rx: 2, fill: 'rgba(52,34,14,.18)', transform: 'translate(2 3)' }, cekmece);
    el('rect', { x: 6, y: 6, width: 116, height: 72, rx: 2, fill: `url(#${id}i)`, stroke: '#9c8255', 'stroke-width': .8 }, cekmece);
    el('rect', { x: 10, y: 10, width: 108, height: 64, rx: 1.5, fill: 'none', stroke: 'rgba(110,84,44,.45)', 'stroke-width': .7 }, cekmece);
    const icerik = el('g', { class: 'cekmece-ici' }, cekmece);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const c = cop(svg, { uzunluk: 96, tohum: ['kutu-cop', ...(o.tohum || []), i], ebeveyn: icerik, golge: [.8, 1.2] });
      konumla(c.node, 66 + (r() - .5) * 3, 18 + i * 8.2 + (r() - .5) * 1.5, (r() - .5) * 3.5, { yon: i % 3 === 1 ? -1 : 1 });
    }
    // kılıf
    const kilif = el('g', { class: 'kilif' }, svg);
    el('rect', { x: 0, y: 0, width: 124, height: 84, rx: 3, fill: `url(#${id}m)`, stroke: '#9a8156', 'stroke-width': .9 }, kilif);
    el('rect', { x: 0, y: 0, width: 124, height: 9, rx: 2, fill: `url(#${id}s)` }, kilif);           // sürtme şeridi
    el('rect', { x: 0, y: 75, width: 124, height: 9, rx: 2, fill: `url(#${id}s)`, opacity: .9 }, kilif);
    // sade, uydurma etiket
    const et = el('g', { class: 'etiket' }, kilif);
    el('rect', { x: 12, y: 17, width: 100, height: 50, fill: '#efe6cf', stroke: '#2d4a6b', 'stroke-width': 1.6 }, et);
    el('rect', { x: 15.5, y: 20.5, width: 93, height: 43, fill: 'none', stroke: '#2d4a6b', 'stroke-width': .6 }, et);
    const yaz = (t, y, b, k, ek = {}) => { const e = el('text', Object.assign({ x: 62, y, 'text-anchor': 'middle', 'font-size': b, fill: k }, ek), et); e.textContent = t; return e; };
    yaz((o.etiket || 'KİBRİT').toLocaleUpperCase('tr-TR'), 43, 18, '#a3271f', { 'font-weight': 700, 'letter-spacing': 2.2, style: "font-family:'Archivo Narrow','Arial Narrow',sans-serif" });
    yaz('★', 28.5, 7.5, '#2d4a6b');
    yaz('ortalama 40 çöp', 52.5, 6.6, '#2d4a6b', { style: "font-family:'PT Serif',Georgia,serif" });
    yaz('ÇOCUKLARDAN UZAK TUTUNUZ', 60.5, 4.9, '#a3271f', { 'font-weight': 700, 'letter-spacing': .5, style: "font-family:'Archivo Narrow','Arial Narrow',sans-serif" });
    // aşınma lekeleri
    for (let i = 0; i < 5; i++) el('ellipse', { cx: r() * 124, cy: 10 + r() * 64, rx: 2 + r() * 7, ry: 1 + r() * 3, fill: '#8d7448', 'fill-opacity': (.05 + r() * .07).toFixed(2) }, kilif);
    kap.appendChild(svg);
    let acikMi = false;
    const durum = (v) => {
      acikMi = v;
      cekmece.style.transform = v ? 'translateX(78px)' : 'translateX(0px)';
      svg.classList.toggle('acik', v);
    };
    durum(!!o.acik);
    return { node: svg, cekmece, kilif, ac: () => durum(true), kapa: () => durum(false), acik: () => acikMi };
  }

  // Sesler: Kit.ses.sentez'e oyun ekler (c: bağlam, h: hedef, t0: s, arg)
  const sesler = {
    // çöpü kaldırma: hafif ahşap sürtmesi
    kaldir(c, h, t0) {
      Kit.ses.parazit(c, h, t0, 'bandpass', 900, 1700, 1.1, .07, .14);
      Kit.ses.parazit(c, h, t0 + .015, 'highpass', 2600, 4200, .7, .04, .04);
    },
    // çöpü koyma: kuru, kısa tıkırtı; arg (0–1) perdeyi ±%12 oynatır
    koy(c, h, t0, arg) {
      const p = 1 + ((typeof arg === 'number' ? arg : Math.random()) - .5) * .24;
      Kit.ses.nota(c, h, t0, 'triangle', 1350 * p, 760 * p, .028, .16);
      Kit.ses.parazit(c, h, t0, 'bandpass', 2600 * p, 1500 * p, 2.4, .022, .2);
      Kit.ses.parazit(c, h, t0 + .004, 'lowpass', 900 * p, 500 * p, 1, .03, .07);
    },
    // çekmece: kayma ve kapanma tıkırtısı
    cekmece(c, h, t0) {
      Kit.ses.parazit(c, h, t0, 'bandpass', 700, 1300, .9, .18, .09);
      Kit.ses.parazit(c, h, t0 + .02, 'highpass', 2000, 3200, .6, .15, .03);
      Kit.ses.nota(c, h, t0 + .19, 'triangle', 420, 260, .035, .14);
      Kit.ses.parazit(c, h, t0 + .19, 'bandpass', 1800, 1100, 2, .03, .12);
    },
  };

  Kit.kibrit = { cop, konumla, basYonu, yuva, yuvaDurum, kutu, sesler };
})();
