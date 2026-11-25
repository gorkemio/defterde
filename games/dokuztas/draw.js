// draw.js — Dokuz Taş'a özgü çizim. Kalem altyapısı kit/kalem.js, malzeme (kurşun kalem) kit/kursunkalem.js.
// Oyun kurallarını bilmez: nokta indeksi (0–23), renk (0 koyu · 1 beyaz) ve layout.js'in kare cinsinden yerlerini alır.
// İki SVG katmanı aynı koordinatlarda (1 defter karesi = 20 birim):
//   #kagit    kâğıda kalemle yapılan her şey: başlık, yapım çizgileri, tahta, noktalar, işaretler, silgi izleri, marj yazıları
//   #nesneler kâğıdın üstünde duran taşlar (gölge, taş, sürüklenen) ve taşların üstünden geçen değirmen çizgileri
(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  const KL = window.Kit.kalem;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger } = KL;
  const B = 20;                                          // bir defter karesi, SVG birimi

  /* ---------- tahta geometrisi (görsel) ---------- */

  // Nokta indeksi: 8·halka + konum (halka 0 dış; konum saat yönünde sol üst köşeden). 7×7 ızgarada yeri:
  const DX = [-1, 0, 1, 1, 1, 0, -1, -1], DY = [-1, -1, -1, 0, 1, 1, 1, 0];
  function izgara(i) {
    const h = 3 - (i >> 3), k = i & 7;
    return [3 + DX[k] * h, 3 + DY[k] * h];
  }
  // Noktanın SVG birimindeki yeri
  function yer(l, i) {
    const [gx, gy] = izgara(i);
    return [(l.tahta.x + 2 * gx) * B, (l.tahta.y + 2 * gy) * B];
  }

  /* ---------- sahne ---------- */

  const KAGIT_KATMAN = ['yapim', 'silgi', 'tahta', 'noktalar', 'notasyon', 'isaret', 'baslik', 'marj', 'tepsi'];
  const NESNE_KATMAN = ['golge', 'taslar', 'tasinan', 'cizgiler', 'ust'];

  function sahneKur(kagit, nesne, l, id) {
    const vb = `0 0 ${l.W * B} ${l.H * B}`;
    const S = { l, id, kagit, nesne, k: {}, n: {}, taslar: new Map() };
    for (const svg of [kagit, nesne]) { svg.textContent = ''; svg.setAttribute('viewBox', vb); }
    for (const ad of KAGIT_KATMAN) S.k[ad] = svgEl('g', { class: ad }, kagit);
    tasTanimlari(nesne);
    for (const ad of NESNE_KATMAN) S.n[ad] = svgEl('g', { class: ad }, nesne);
    S.n.cizgiler.setAttribute('opacity', '.86');
    S.K = KL.kalemYap(kagit);
    S.KN = KL.kalemYap(nesne);
    return S;
  }

  /* ---------- yazı ---------- */

  // metinSvg + sığdırma: maxW (birim) aşılırsa yazı küçülür.
  function yaz(katman, metin, o) {
    const t = metinSvg(katman, metin, Object.assign({ renk: 'ana', hiza: 'start' }, o));
    if (o.maxW) {
      let w = 0;
      try { w = t.node.getComputedTextLength(); } catch (e) { /* görünmüyor */ }
      if (w > o.maxW) t.node.setAttribute('font-size', (o.boyut * o.maxW / w).toFixed(2));
    }
    return t;
  }

  /* ---------- başlık: "DOKUZ TAŞ" kalemle çizilmiş harfler (font değil) ---------- */

  // 10×14'lük harf kutusunda darbeler: ['L', x1, y1, x2, y2] düz · ['C', [[x, y]...]] eğri · ['E', cx, cy, w, h] elips
  const HARFLER = {
    D: [['L', 0, 0, 0, 14], ['C', [[0, .3], [6, .6], [9.6, 4], [9.7, 9.6], [6, 13.4], [0, 13.8]]]],
    O: [['E', 5, 7, 10, 14]],
    K: [['L', 0, 0, 0, 14], ['L', 9.6, .2, .5, 8.4], ['L', 3.3, 5.8, 10, 14]],
    U: [['C', [[0, 0], [.2, 9], [2, 13.2], [5, 14], [8, 13.2], [9.8, 9], [10, 0]]]],
    Z: [['L', 0, .2, 10, 0], ['L', 10, 0, 0, 14], ['L', 0, 14, 10.2, 13.8]],
    T: [['L', -.6, .2, 10.6, 0], ['L', 5, 0, 5.1, 14]],
    A: [['L', 0, 14, 5, 0], ['L', 5, 0, 10, 14], ['L', 2.2, 8.7, 8, 8.5]],
    'Ş': [['C', [[9.6, 2.2], [7, .2], [2.8, .4], [1, 3.2], [3, 6.3], [7.5, 7.6], [9.6, 10.5], [7.8, 13.6], [3, 13.9], [.4, 11.8]]],
          ['C', [[5, 14.4], [6.3, 15.7], [4.5, 17.3]]]],
  };

  function baslikCiz(S, metin, o = {}) {
    const b = S.l.baslik, s = b.h * B / 14;              // harf kutusu ölçeği
    const bit = [];
    let x = b.x * B, gec = o.gecikme || 0, harfNo = 0;
    // Yazı ödevi gibi: harflerin üst ve alt hizasında cetvelle çekilmiş silik kılavuz çizgileri
    const uzun = (metin.replace(/ /g, '').length * b.adim + b.bosluk) * B;
    const kil = svgEl('g', { class: 'kilavuz', opacity: .22 }, S.k.baslik);
    for (const [ad, yy] of [['ust', b.y * B - 1.5], ['alt', b.y * B + 14 * s + 1.5]]) {
      S.K.cizgi(kil, [b.x * B - 10, yy, b.x * B + uzun + 4, yy], { strokeWidth: .7, roughness: .3, disableMultiStroke: true }, ['kilavuz', ad], { anlik: true, baski: false });
    }
    for (const ch of metin) {
      if (ch === ' ') { x += b.bosluk * B; continue; }
      const r = rastgele('baslik', ch, harfNo);
      const ox = x + aralik(r, -1, 1), oy = b.y * B + aralik(r, -1, 1), egim = aralik(r, -.035, .035);
      const P = (px, py) => [ox + (px + (14 - py) * egim) * s, oy + py * s];
      const ek = { strokeWidth: o.kalinlik || 2.3, roughness: .55, bowing: .4, disableMultiStroke: true };
      // ikinci geçiş: kalem harfin üstünden bir kez daha, ince ve biraz kayık (bastırılmış kurşun kalem)
      const ek2 = { strokeWidth: (o.kalinlik || 2.3) * .55, roughness: .7, bowing: .5, disableMultiStroke: true };
      const kay = (q, dx, dy) => [q[0] + dx, q[1] + dy];
      HARFLER[ch].forEach((d, j) => {
        const an = ['baslik', ch, harfNo, j], oo = { gecikme: gec, anlik: o.anlik, sureMs: [120, 200] };
        const oo2 = { gecikme: gec + 60, anlik: o.anlik, sureMs: [110, 170] };
        const dx = aralik(r, -.7, .7), dy = aralik(r, -.5, .5);
        let c;
        if (d[0] === 'L') {
          c = S.K.cizgi(S.k.baslik, [...P(d[1], d[2]), ...P(d[3], d[4])], ek, an, oo);
          S.K.cizgi(S.k.baslik, [...kay(P(d[1], d[2]), dx, dy), ...kay(P(d[3], d[4]), dx, dy)], ek2, [...an, 2], oo2);
        } else if (d[0] === 'C') {
          c = S.K.egri(S.k.baslik, d[1].map(q => P(q[0], q[1])), ek, an, oo);
          S.K.egri(S.k.baslik, d[1].map(q => kay(P(q[0], q[1]), dx, dy)), ek2, [...an, 2], oo2);
        } else {
          const [cx, cy] = P(d[1], d[2]);
          c = S.K.elips(S.k.baslik, [cx, cy, d[3] * s, d[4] * s], ek, an, oo);
          S.K.elips(S.k.baslik, [cx + dx, cy + dy, d[3] * s * .97, d[4] * s * .98], ek2, [...an, 2], oo2);
        }
        bit.push(c.bitti);
        gec += o.anlik ? 0 : 70;
      });
      x += b.adim * B;
      harfNo++;
    }
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) };
  }

  /* ---------- yapım çizgileri: geometri ödevinin silik izleri ---------- */

  // Dış karenin köşegenleri ve orta eksenleri, kenarlarda kare başına ölçü çentiği, merkezde pergel deliği.
  // Çok açık; bakınca fark edilir. Hep anlık çizilir.
  function yapimCiz(S) {
    const g = S.k.yapim, l = S.l;
    g.setAttribute('opacity', '.2');
    const x0 = l.tahta.x * B, y0 = l.tahta.y * B, w = 12 * B, x1 = x0 + w, y1 = y0 + w, cx = x0 + w / 2, cy = y0 + w / 2;
    const ek = { strokeWidth: .8, roughness: .35, bowing: .2, disableMultiStroke: true };
    const o = { anlik: true, baski: false };
    const t = 16;                                        // köşegen ve eksenlerin kareden taşması
    const c = (p, ad) => S.K.cizgi(g, p, ek, ['yapim', S.id, ad], o);
    const kd = t / Math.SQRT2;
    c([x0 - kd, y0 - kd, x1 + kd, y1 + kd], 'k1');
    c([x1 + kd, y0 - kd, x0 - kd, y1 + kd], 'k2');
    c([x0 - t * 1.4, cy, x1 + t * 1.4, cy], 'yatay');
    c([cx, y0 - t * 1.4, cx, y1 + t * 1.4], 'dikey');
    // Ölçü çentikleri: dış karenin dört kenarında, dışa doğru, her karede bir (çift karelerde biraz uzun)
    for (let k = 0; k <= 12; k++) {
      const u = k * B, boy = k % 2 ? 2.6 : 4;
      c([x0 + u, y0, x0 + u, y0 - boy], 'cu' + k);
      c([x0 + u, y1, x0 + u, y1 + boy], 'ca' + k);
      c([x0, y0 + u, x0 - boy, y0 + u], 'cs' + k);
      c([x1, y0 + u, x1 + boy, y0 + u], 'cg' + k);
    }
    // Pergel deliği: merkezde küçük nokta ve çevresinde bastırılmış halka
    svgEl('circle', { cx, cy, r: 1.3, fill: renkDeger('ana') }, g);
    svgEl('circle', { cx, cy, r: 3.2, fill: 'none', stroke: renkDeger('ana'), 'stroke-width': .5 }, g);
  }

  /* ---------- tahta: cetvelle, kurşun kalemle ---------- */

  function tahtaCiz(S, o = {}) {
    const l = S.l, g = S.k.tahta;
    const P = (gx, gy) => [(l.tahta.x + 2 * gx) * B, (l.tahta.y + 2 * gy) * B];
    const cizgiler = [];
    for (let h = 0; h < 3; h++) {                         // üç kare: her kenar ayrı cetvel çizgisi
      const a = h, b = 6 - h;
      cizgiler.push([a, a, b, a], [b, a, b, b], [b, b, a, b], [a, b, a, a]);
    }
    cizgiler.push([3, 0, 3, 2], [6, 3, 4, 3], [3, 6, 3, 4], [0, 3, 2, 3]);   // orta noktaları bağlayan dört çizgi
    if (o.kosegen) cizgiler.push([0, 0, 2, 2], [6, 0, 4, 2], [6, 6, 4, 4], [0, 6, 2, 4]);
    const bit = [];
    let gec = o.gecikme || 0;
    // hiyerarşi: dış kare en bastırılmış, iç kareler ve orta çizgiler biraz daha hafif
    const kalinlik = (k) => (k < 4 ? 1.85 : k < 12 ? 1.45 : 1.4);
    cizgiler.forEach((c, k) => {
      const r = rastgele('tahta', S.id, k);
      const [ax, ay] = P(c[0], c[1]), [bx, by] = P(c[2], c[3]);
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      const t1 = aralik(r, 0, 3), t2 = aralik(r, 0, 3);    // cetvel çizgisi köşeden biraz taşar
      const s = S.K.cizgi(g, [ax - ux * t1, ay - uy * t1, bx + ux * t2, by + uy * t2],
        { strokeWidth: kalinlik(k), roughness: .6, bowing: .3 }, ['tahta', S.id, k], { gecikme: gec, anlik: o.anlik });
      bit.push(s.bitti);
      gec += o.anlik ? 0 : 90;
    });
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) + 380 };
  }

  // 24 nokta: küçük, hafif bastırılmış kalem daireleri
  function noktalarCiz(S, o = {}) {
    for (let i = 0; i < 24; i++) {
      const [x, y] = yer(S.l, i);
      const c = S.K.daire(S.k.noktalar, [x, y, 6.8], { fill: renkDeger('ana'), fillStyle: 'solid', strokeWidth: 1, roughness: .6, disableMultiStroke: true },
        ['nokta', S.id, i], { gecikme: o.gecikme ? o.gecikme + i * 18 : 0, anlik: o.anlik });
      c.node.setAttribute('opacity', '.72');
    }
  }

  // a–g altta, 1–7 solda; silik
  function notasyonCiz(S, acik) {
    const g = S.k.notasyon;
    g.textContent = '';
    if (!acik) return;
    g.setAttribute('opacity', '.38');
    const l = S.l, x0 = l.tahta.x * B, y0 = l.tahta.y * B;
    for (let k = 0; k < 7; k++) {
      yaz(g, 'abcdefg'[k], { x: x0 + 2 * k * B, y: y0 + 12 * B + 24, boyut: 11, hiza: 'middle', tohum: ['not-h', k], anlik: true });
      yaz(g, String(7 - k), { x: x0 - 21, y: y0 + 2 * k * B + 4, boyut: 11, hiza: 'middle', tohum: ['not-s', k], anlik: true });
    }
  }

  /* ---------- taşlar: kâğıdın üstünde duran nesneler (rough.js değil) ---------- */

  // Taş renkleri. çakıl: koyu dere taşı + açık mermer çakıl. fasulye: kara fasulye + kuru beyaz fasulye (köy usulü).
  const TAS_RENK = {
    cakil: [
      { taban: ['#827b73', '#4b4641', '#232120'], yan: [0, 0, 0, .42], kenar: 'rgba(18,14,10,.5)', parlak: .55, benek: ['#9a938b', '#2c2927'], isik: .22 },
      { taban: ['#fffefa', '#ece6d8', '#c4baa6'], yan: [80, 60, 34, .26], kenar: 'rgba(80,66,48,.45)', parlak: .9, benek: ['#b3a996', '#8f8676'], isik: .5 },
    ],
    fasulye: [
      { taban: ['#5b4a45', '#2a201e', '#110c0b'], yan: [0, 0, 0, .45], kenar: 'rgba(10,6,5,.55)', parlak: .85, benek: null, isik: .28 },
      { taban: ['#fffcf3', '#f0e8d7', '#cfc2a7'], yan: [90, 70, 40, .24], kenar: 'rgba(90,72,48,.42)', parlak: .7, benek: null, isik: .45 },
    ],
  };

  function tasTanimlari(svg) {
    const d = svgEl('defs', null, svg);
    const dur = (gr, liste) => liste.forEach(([o, c, op]) => svgEl('stop', { offset: o, 'stop-color': c, 'stop-opacity': op ?? 1 }, gr));
    for (const [set, renkler] of Object.entries(TAS_RENK)) {
      renkler.forEach((t, k) => {
        const id = `${set}-${k}`;
        dur(svgEl('radialGradient', { id: 'tas-taban-' + id, cx: '.4', cy: '.34', r: '.8', fx: '.33', fy: '.26' }, d),
          [[0, t.taban[0]], [.48, t.taban[1]], [1, t.taban[2]]]);
        const [r0, g0, b0, a0] = t.yan;
        dur(svgEl('linearGradient', { id: 'tas-yan-' + id, x1: '.15', y1: '.1', x2: '.85', y2: '.95' }, d),
          [[0, `rgb(${r0},${g0},${b0})`, 0], [.5, `rgb(${r0},${g0},${b0})`, 0], [.9, `rgb(${r0},${g0},${b0})`, a0], [1, `rgb(${r0},${g0},${b0})`, a0 * .7]]);
        // kenar ışığı: gölge tarafının en ucunda kâğıttan yansıyan ışık
        dur(svgEl('linearGradient', { id: 'tas-isik-' + id, x1: '.2', y1: '.15', x2: '.85', y2: '.95' }, d),
          [[0, '#fff', 0], [.7, '#fff', 0], [1, '#fff8ea', t.isik]]);
      });
    }
    dur(svgEl('radialGradient', { id: 'tas-parlak' }, d), [[0, '#fff', .95], [.5, '#fff', .35], [1, '#fff', 0]]);
    // iki katman gölge: sıkı temas gölgesi + geniş, yumuşak ortam gölgesi
    dur(svgEl('radialGradient', { id: 'tas-golge' }, d), [[0, '#1e140a', .62], [.62, '#1e140a', .3], [.86, '#1e140a', .06], [1, '#1e140a', 0]]);
    dur(svgEl('radialGradient', { id: 'tas-ortam' }, d), [[0, '#2a1d10', .18], [.6, '#2a1d10', .08], [1, '#2a1d10', 0]]);
  }

  // Kapalı Catmull-Rom → kübik Bézier (noktalar [x, y])
  function kapaliYol(pts) {
    const n = pts.length;
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let k = 0; k < n; k++) {
      const p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d + ' Z';
  }

  // Tohumlu çakıl dış çizgisi: hafif yamuk, yuvarlak köşeli elips; dönüş koordinatlara işlenir (ışık hep sol üstten).
  function cakilYolu(r, R) {
    const oran = aralik(r, .82, .94), don = aralik(r, -.45, .45);
    const a2 = aralik(r, .02, .06), f2 = aralik(r, 0, 6.28), a3 = aralik(r, .01, .035), f3 = aralik(r, 0, 6.28);
    const n = 16, pts = [];
    for (let k = 0; k < n; k++) {
      const t = k / n * Math.PI * 2;
      const m = 1 + a2 * Math.cos(2 * (t - f2)) + a3 * Math.cos(3 * (t - f3));
      const x = Math.cos(t) * R * m, y = Math.sin(t) * R * oran * m;
      pts.push([x * Math.cos(don) - y * Math.sin(don), x * Math.sin(don) + y * Math.cos(don)]);
    }
    return { d: kapaliYol(pts), oran };
  }

  // Fasulye dış çizgisi: böbrek biçimi (bir kenarı hafif içe çökük), tohumlu boy ve dönüş. Döner: yol, göbeğin yeri
  function fasulyeYolu(r, R) {
    const L = R * aralik(r, 1.08, 1.18), W = R * aralik(r, .66, .74), don = aralik(r, -.7, .7), cuk = aralik(r, .2, .3);
    const n = 18, pts = [];
    for (let k = 0; k < n; k++) {
      const t = k / n * Math.PI * 2;
      let x = Math.cos(t) * L, y = Math.sin(t) * W;
      if (y < 0) y *= 1 - cuk * (1 - Math.abs(Math.cos(t)));                                        // üst kenar içe çökük (böbrek)
      x *= 1 - .06 * Math.sin(t);                                                                    // bir ucu biraz dolgun
      pts.push([x * Math.cos(don) - y * Math.sin(don), x * Math.sin(don) + y * Math.cos(don)]);
    }
    const gy = -W * (1 - cuk) + 2.2;
    const gob = [[-L * .16, gy], [0, gy + .9], [L * .16, gy]].map(([x, y]) => [x * Math.cos(don) - y * Math.sin(don), x * Math.sin(don) + y * Math.cos(don)]);
    return { d: kapaliYol(pts), oran: W / L, gob };
  }

  // Taş: <g class="tas"> (taban, gölge tarafı, kenar ışığı, doku, parlaklık, kenar) + gölge katmanında iki gölge.
  // id: taşın kalıcı kimliği (şekli belirler). Şekil hep tam boyda kurulur; tepside küçülme dönüşümle (o.olcek).
  function tasEkle(S, id, renk, x, y, o = {}) {
    const set = S.tasSeti === 'fasulye' ? 'fasulye' : 'cakil';
    const r = rastgele('tas', set, id);
    const R = aralik(r, 14.6, 16);
    const t = TAS_RENK[set][renk], gid = `${set}-${renk}`;
    const ortam = svgEl('ellipse', { class: 'tas-ortam', fill: 'url(#tas-ortam)' }, S.n.golge);
    const golge = svgEl('ellipse', { class: 'tas-golge', fill: 'url(#tas-golge)' }, S.n.golge);
    const g = svgEl('g', { class: 'tas', 'data-id': id, 'data-renk': renk }, S.n.taslar);
    const govde = svgEl('g', { class: 'govde' }, g);
    const sekil = set === 'fasulye' ? fasulyeYolu(r, R) : cakilYolu(r, R);
    const d = sekil.d;
    svgEl('path', { d, fill: `url(#tas-taban-${gid})` }, govde);
    svgEl('path', { d, fill: `url(#tas-yan-${gid})` }, govde);
    if (t.benek) {                                         // çakılın dokusu: koyu ve açık silik benekler
      const adet = 5 + Math.floor(r() * 5);
      for (let k = 0; k < adet; k++) {
        svgEl('circle', {
          cx: aralik(r, -R * .55, R * .55).toFixed(2), cy: aralik(r, -R * .45, R * .45).toFixed(2), r: aralik(r, .25, .75).toFixed(2),
          fill: t.benek[k % 2], opacity: aralik(r, .18, .4).toFixed(2),
        }, govde);
      }
    }
    if (set === 'fasulye') {                               // göbek (hilum): kara fasulyede açık, beyazda kahverengi
      svgEl('path', {
        d: `M ${sekil.gob[0].map(v => v.toFixed(2)).join(' ')} Q ${sekil.gob[1].map(v => v.toFixed(2)).join(' ')} ${sekil.gob[2].map(v => v.toFixed(2)).join(' ')}`,
        fill: 'none', stroke: renk === 0 ? 'rgba(236,228,214,.85)' : 'rgba(120,92,56,.55)', 'stroke-width': renk === 0 ? 1.5 : 1.1, 'stroke-linecap': 'round',
      }, govde);
    }
    svgEl('path', { d, fill: 'none', stroke: `url(#tas-isik-${gid})`, 'stroke-width': 1.3 }, govde);
    const px = -R * .3, py = -R * .34;
    svgEl('ellipse', {
      cx: px.toFixed(2), cy: py.toFixed(2), rx: (R * (set === 'fasulye' ? .36 : .3)).toFixed(2), ry: (R * .14).toFixed(2),
      transform: `rotate(-28 ${px.toFixed(2)} ${py.toFixed(2)})`, fill: 'url(#tas-parlak)', opacity: t.parlak,
    }, govde);
    if (set === 'cakil') svgEl('circle', { cx: (px - R * .06).toFixed(2), cy: (py - R * .02).toFixed(2), r: (R * .06).toFixed(2), fill: '#fff', opacity: (t.parlak * .55).toFixed(2) }, govde);
    svgEl('path', { d, fill: 'none', stroke: t.kenar, 'stroke-width': .55 }, govde);
    const tas = { id, renk, g, golge, ortam, R, rx: R * 1.04, ry: R * sekil.oran * 1.0, x, y, olcek: o.olcek || 1, kalkik: false, buyu: 1 };
    S.taslar.set(id, tas);
    tasKonumla(tas, x, y, { olcek: tas.olcek, kalkik: !!o.kalkik });
    return tas;
  }

  // Taşı yerine koyar (animasyonsuz). o: { olcek, kalkik (hafif yukarı kalkmış, gölgesi büyümüş), buyu (oturma için) }
  function tasKonumla(tas, x, y, o = {}) {
    tas.x = x; tas.y = y;
    if (o.olcek !== undefined) tas.olcek = o.olcek;
    if (o.kalkik !== undefined) tas.kalkik = o.kalkik;
    if (o.buyu !== undefined) tas.buyu = o.buyu;
    const k = typeof tas.kalkik === 'number' ? tas.kalkik : (tas.kalkik ? 1 : 0), s = tas.olcek * tas.buyu;
    tas.g.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - 3.2 * k * s).toFixed(1)}) scale(${s.toFixed(3)})`);
    // temas gölgesi: taş kalkınca açılır ve silikleşir
    tas.golge.setAttribute('cx', (x + (1.2 + 2.6 * k) * s).toFixed(1));
    tas.golge.setAttribute('cy', (y + (1.8 + 3.4 * k) * s).toFixed(1));
    tas.golge.setAttribute('rx', (tas.rx * s * (1 + .18 * k)).toFixed(2));
    tas.golge.setAttribute('ry', (tas.ry * s * (1 + .18 * k)).toFixed(2));
    tas.golge.setAttribute('opacity', (1 - .45 * k).toFixed(2));
    // ortam gölgesi: geniş, yumuşak; ışık sol üstten
    tas.ortam.setAttribute('cx', (x + (3 + 2 * k) * s).toFixed(1));
    tas.ortam.setAttribute('cy', (y + (4.2 + 2.6 * k) * s).toFixed(1));
    tas.ortam.setAttribute('rx', (tas.rx * s * (1.45 + .15 * k)).toFixed(2));
    tas.ortam.setAttribute('ry', (tas.ry * s * (1.4 + .15 * k)).toFixed(2));
  }

  /* ---------- hareket: küçük ara-kare yardımcısı (rAF; az hareket ayarında anında) ---------- */

  const yumusak = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function oynat(sureMs, adim) {
    if (!KL.animasyonVar() || sureMs <= 0) { adim(1); return Promise.resolve(); }
    return new Promise(coz => {
      const t0 = performance.now();
      const kare = (t) => {
        const f = Math.min(1, (t - t0) / sureMs);
        adim(f);
        if (f < 1) requestAnimationFrame(kare); else coz();
      };
      requestAnimationFrame(kare);
    });
  }

  // Taşı (x, y)'ye kaydırır: kalkar, kayar, iner; varınca hafif "oturur" (1.06 → 1, 120 ms).
  // o: { olcek (varış ölçeği), sure, otur (varsayılan true), ustte (kayarken diğer taşların üstünde), varis (değince çağrılır: ses) }
  async function tasKay(S, tas, x, y, o = {}) {
    const no = tas.hareketNo = (tas.hareketNo || 0) + 1;      // yeni hareket eskisini durdurur
    const x0 = tas.x, y0 = tas.y, s0 = tas.olcek, s1 = o.olcek ?? tas.olcek, k0 = tas.kalkik ? 1 : 0;
    const uzak = Math.hypot(x - x0, y - y0);
    if (uzak < .5 && Math.abs(s1 - s0) < .01) { tasKonumla(tas, x, y, { kalkik: false, olcek: s1 }); return; }
    if (o.ustte !== false) S.n.tasinan.appendChild(tas.g);
    const sure = o.sure ?? Math.max(180, Math.min(420, 150 + uzak * 1.1));
    await oynat(sure, (f) => {
      if (tas.hareketNo !== no) return;
      const e = yumusak(f), kalk = Math.max(k0 * (1 - f), Math.sin(Math.PI * f));
      tasKonumla(tas, x0 + (x - x0) * e, y0 + (y - y0) * e, { olcek: s0 + (s1 - s0) * e, kalkik: kalk });
    });
    if (tas.hareketNo !== no) return;
    tasKonumla(tas, x, y, { olcek: s1, kalkik: false });
    S.n.taslar.appendChild(tas.g);
    if (o.varis) o.varis();
    if (o.otur !== false) await tasOtur(tas);
  }

  // Taş konunca küçük oturma: 1.06 → 1 (120 ms)
  function tasOtur(tas) {
    const no = tas.hareketNo;
    return oynat(120, (f) => { if (tas.hareketNo === no) tasKonumla(tas, tas.x, tas.y, { buyu: 1.06 - .06 * f }); });
  }

  /* ---------- işaretler: hedef, alınabilir taş, değirmen, silgi ---------- */

  function isaretleriSil(S, sinif) {
    for (const e of Array.from(S.k.isaret.querySelectorAll(sinif ? '.' + sinif : ':scope > *'))) e.remove();
  }

  // Gidilebilecek nokta: kesikli, silik kalem dairesi
  function hedefCiz(S, i) {
    const [x, y] = yer(S.l, i);
    const c = S.K.daire(S.k.isaret, [x, y, 19], { strokeWidth: 1.1, roughness: .5, strokeLineDash: [3.2, 2.6], disableMultiStroke: true },
      ['hedef', S.id, i], { anlik: true, baski: false });
    c.node.setAttribute('opacity', '.55');
    c.node.classList.add('hedef');
    return c.node;
  }

  // Alınabilecek rakip taşı: kırmızı kurşunla silik daire (taşın altında kâğıtta; taşın çevresinde görünür)
  function adayCiz(S, i, o = {}) {
    const [x, y] = yer(S.l, i);
    const c = S.K.daire(S.k.isaret, [x, y, 38], { stroke: renkDeger('vurgu'), strokeWidth: 1.4, roughness: .8 },
      ['aday', S.id, i], { anlik: o.anlik, sureMs: [200, 260] });
    c.node.setAttribute('opacity', '.62');
    c.node.classList.add('aday');
    return c.node;
  }

  // Değirmen: üç noktanın üstünden geçen kırmızı kurşun çizgi (uçları biraz taşar), 250 ms'de çizilir.
  function degirmenCiz(S, uclu, o = {}) {
    const [ax, ay] = yer(S.l, uclu[0]), [bx, by] = yer(S.l, uclu[2]);
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, t = 10;
    const noktalar = [ax - ux * t, ay - uy * t, bx + ux * t, by + uy * t];
    const c = S.KN.cizgi(S.n.cizgiler, noktalar, { stroke: renkDeger('vurgu'), strokeWidth: 2.7, roughness: .9, bowing: .6 },
      ['degirmen', S.id, ...uclu], { gecikme: o.gecikme, anlik: o.anlik, sureMs: [250, 250] });
    c.node.dataset.hat = uclu.join(',');
    return Object.assign(c, { noktalar });
  }

  // Değirmen bozulunca çizgi silinir: yerinde silgi izi kalır (kâğıt katmanında), birkaç saniye sonra solar.
  function degirmenSil(S, cizgi, noktalar, o = {}) {
    return window.Kit.malzeme.aktif.silgiIzi(S.k.silgi, cizgi, Object.assign({ noktalar, renk: renkDeger('vurgu') }, o));
  }

  /* ---------- marj: evre, durum, düşünme çizgisi, ipucu çetelesi, tepsiler ---------- */

  const EVRELER = ['1. yerleştirme', '2. hareket', '3. uçma'];

  // aktif: 1 · 2 · 3 — altı çizili olan. Değişince eski çizgi solar, yenisi çizilir.
  function evreYaz(S, aktif, o = {}) {
    const e = S.l.evre, g = S.k.marj;
    let kap = g.querySelector(':scope > .evre');
    if (!kap) {
      kap = svgEl('g', { class: 'evre' }, g);
      let x = e.x * B;
      EVRELER.forEach((ad, k) => {
        const metin = e.yatay ? ad.replace('. ', '. ') : ad;
        const t = yaz(kap, metin, {
          x: e.yatay ? x : e.x * B, y: (e.yatay ? e.y : e.y + k * e.satir) * B, boyut: e.boyut * B,
          tohum: ['evre', k], anlik: o.anlik, gecikme: o.gecikme ? o.gecikme + k * 150 : 0,
          maxW: e.yatay ? null : (S.l.marjX - e.x - .5) * B,
        });
        t.node.dataset.evre = k + 1;
        if (e.yatay) x += t.node.getComputedTextLength() + e.aralik * B;
      });
      svgEl('g', { class: 'evre-cizgi' }, kap);
    }
    const cz = kap.querySelector('.evre-cizgi');
    for (const eski of Array.from(cz.children)) KL.soldur(eski, 200);
    const t = kap.querySelector(`[data-evre="${aktif}"]`);
    if (!t) return;
    const bb = t.getBBox();
    KL.altiCiz(S.K, cz, bb.x, bb.x + bb.width, (e.yatay ? e.y : e.y + (aktif - 1) * e.satir) * B + 4.5,
      { tohum: ['evre-alti', aktif], anlik: o.anlik, gecikme: o.gecikme ? o.gecikme + 500 : 0, ek: { strokeWidth: 1.5 } });
  }

  // Durum satırı (kurşun kalem). renk: 'ana' · 'vurgu'
  function durumYaz(S, metin, o = {}) {
    const g = S.k.marj, d = S.l.durum;
    const eski = g.querySelector(':scope > .durum');
    if (eski) eski.remove();
    const kap = svgEl('g', { class: 'durum' }, g);
    return yaz(kap, metin, { x: d.x * B, y: d.y * B, boyut: d.boyut * B, renk: o.renk || 'ana', tohum: ['durum', metin], anlik: o.anlik, gecikme: o.gecikme });
  }

  // Bilgisayar düşünürken marjda yavaşça uzayan ince kalem çizgisi. sureMs: uzama süresi; oran (0–1): statik çizim için.
  function dusunmeCiz(S, o = {}) {
    dusunmeSil(S);
    const d = S.l.dusunme;
    const g = svgEl('g', { class: 'dusunme' }, S.k.marj);
    S.K.cizgi(g, [d.x * B, d.y * B, (d.x + d.w) * B, d.y * B + aralik(rastgele('dusunme', S.id), -1, 1)],
      { strokeWidth: 1, roughness: .5, bowing: .4, disableMultiStroke: true }, ['dusunme', S.id], { anlik: true, baski: false });
    g.setAttribute('opacity', '.7');
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'left center';
    if (o.oran !== undefined) g.style.transform = `scaleX(${o.oran})`;
    else if (KL.animasyonVar()) g.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: o.sureMs || 1500, easing: 'linear', fill: 'forwards' });
    return g;
  }
  function dusunmeSil(S) {
    const g = S.k.marj.querySelector(':scope > .dusunme');
    if (g) KL.soldur(g, 200);
  }

  // "ipucu" sözcüğü ve altında (ya da yanında) çetele: dört dikey, beşincisi çapraz
  function ipucuCetele(S, n, o = {}) {
    const p = S.l.ipucu, g = S.k.marj;
    let kap = g.querySelector(':scope > .ipucu-cetele');
    if (kap) kap.remove();
    if (!n && !o.hep) return;
    kap = svgEl('g', { class: 'ipucu-cetele' }, g);
    const boyut = p.boyut * B;
    const yazi = yaz(kap, 'ipucu', { x: p.x * B, y: p.y * B, boyut, hiza: p.sag ? 'end' : 'start', tohum: ['ipucu'], anlik: true });
    const w = yazi.node.getComputedTextLength();
    // defter: çetele yazının altında · dikey: yazının solunda
    const x0 = p.sag ? p.x * B - w - 8 - Math.min(n, 5) * 5 : p.x * B + 2, y0 = p.sag ? p.y * B - boyut * .78 : p.y * B + 6, boy = p.sag ? boyut * .85 : 13;
    for (let k = 0; k < n; k++) {
      const grup = Math.floor(k / 5), j = k % 5, r = rastgele('cetele', k);
      const gx = x0 + grup * 34;
      const c = j < 4
        ? [gx + j * 5 + aralik(r, -.6, .6), y0 + aralik(r, -.8, .8), gx + j * 5 + aralik(r, -.6, .6), y0 + boy + aralik(r, -.8, .8)]
        : [gx - 3, y0 + boy - 2, gx + 18, y0 + 2];
      S.K.cizgi(kap, c, { strokeWidth: 1.3, roughness: .8, disableMultiStroke: true }, ['cetele', k], { anlik: o.anlik !== false ? true : false });
    }
  }

  // Tepsiler: "alınan" daireleri ve etiketler (taşlar ayrıca tasEkle ile konur). etiketler: ['sen', 'bilgisayar']
  function tepsiCiz(S, etiketler, o = {}) {
    const t = S.l.tepsi, g = S.k.tepsi;
    g.textContent = '';
    if (t.etiket) t.etiket.forEach((e, k) => yaz(g, etiketler[k], { x: e.x * B, y: e.y * B, boyut: 13, hiza: 'middle', tohum: ['tepsi', etiketler[k]], anlik: o.anlik }));
    t.alinan.forEach((a, k) => {
      const c = S.K.daire(g, [a.x * B, a.y * B, a.cap * B], { strokeWidth: 1.3, roughness: .7 }, ['alinan', k], { anlik: o.anlik, gecikme: o.gecikme });
      c.node.setAttribute('opacity', '.8');
    });
    const e = t.alinanEtiket;
    if (e) {
      const y = yaz(g, 'alınan', { x: e.x * B, y: e.y * B, boyut: e.dik ? 11 : 13, hiza: 'middle', tohum: ['alinan-yazi'], anlik: o.anlik });
      if (e.dik) y.node.setAttribute('transform', `rotate(-90 ${e.x * B} ${e.y * B})`);
    }
  }

  // Elde bekleyen k. taşın yeri (birim). oy: 0 ben · 1 bilgisayar
  function elYeri(l, oy, k) {
    const e = l.tepsi.el[oy];
    return [(e.x + (k % e.sutun) * e.dx) * B, (e.y + Math.floor(k / e.sutun) * e.dy) * B];
  }
  // Alınan k. taşın yeri: dairenin içinde tohumlu yığın
  function alinanYeri(l, oy, k) {
    const a = l.tepsi.alinan[oy], r = rastgele('yigin', oy, k);
    const yar = a.cap * B * .26, aci = k * 2.4 + aralik(r, -.4, .4), d = k === 0 ? 0 : yar * (.55 + .45 * ((k * .37) % 1));
    return [a.x * B + Math.cos(aci) * d, a.y * B + Math.sin(aci) * d];
  }

  // Fareyle boş noktanın üstüne gelince: o noktaya konacak taşın silik hayali (yalnız fare; dokunmada yok)
  function onizleme(S, i, renk) {
    onizlemeSil(S);
    if (i < 0) return;
    const [x, y] = yer(S.l, i);
    const set = S.tasSeti === 'fasulye' ? 'fasulye' : 'cakil';
    const r = rastgele('onizleme', set, renk), R = 15;
    const sekil = set === 'fasulye' ? fasulyeYolu(r, R) : cakilYolu(r, R);
    const g = svgEl('g', { class: 'onizleme', 'pointer-events': 'none', transform: `translate(${x} ${y})`, opacity: .32 }, S.n.tasinan);
    svgEl('path', { d: sekil.d, fill: `url(#tas-taban-${set}-${renk})` }, g);
    svgEl('path', { d: sekil.d, fill: 'none', stroke: renkDeger('ana'), 'stroke-width': .8, 'stroke-dasharray': '2.5 2' }, g);
  }
  function onizlemeSil(S) { for (const e of Array.from(S.n.tasinan.querySelectorAll('.onizleme'))) e.remove(); }

  /* ---------- oyun sonu ve ipucu ---------- */

  // Kırmızı kurşunla büyük sonuç yazısı tahtanın ortasına (taşların üstünde okunur: kâğıt renginde ince hale)
  function sonucYaz(S, metin, o = {}) {
    sonucSil(S);
    const l = S.l, cx = (l.tahta.x + 6) * B, cy = (l.tahta.y + 6) * B;
    const g = svgEl('g', { class: 'sonuc', 'pointer-events': 'none' }, S.n.ust);
    const t = yaz(g, metin, { x: cx, y: cy + 14, boyut: l.mod === 'defter' ? 46 : 42, renk: 'vurgu', hiza: 'middle', aci: -3, tohum: ['sonuc', metin], gecikme: o.gecikme, anlik: o.anlik, adim: 70 });
    t.node.setAttribute('stroke', renkDeger('kagit') || '#fbf9f2');
    t.node.setAttribute('stroke-width', '5');
    t.node.setAttribute('stroke-linejoin', 'round');
    t.node.setAttribute('paint-order', 'stroke');
    t.node.setAttribute('stroke-opacity', '.8');
    let w = 0;
    try { w = t.node.getComputedTextLength(); } catch (e) { /* görünmüyor */ }
    if (w) KL.altiCiz(KL.kalemYap(S.nesne), g, cx - w / 2, cx + w / 2, cy + 24, { tohum: ['sonuc-alti', metin], anlik: o.anlik, gecikme: (o.gecikme || 0) + t.sure, ek: { stroke: renkDeger('vurgu'), strokeWidth: 2 } });
    return t;
  }
  function sonucSil(S) { for (const e of Array.from(S.n.ust.querySelectorAll('.sonuc'))) e.remove(); }

  // İpucu: hedef noktada silik kesikli taş hayali; hareketse kaynaktan ince silik ok; alma varsa alınacak taşa silik çarpı.
  function ipucuGoster(S, m) {
    ipucuSil(S);
    const g = svgEl('g', { class: 'ipucu-hayal', 'pointer-events': 'none' }, S.k.isaret);
    g.setAttribute('opacity', '.55');
    const [hx, hy] = yer(S.l, m.hedef);
    S.K.daire(g, [hx, hy, 27], { strokeWidth: 1.1, roughness: .6, strokeLineDash: [2.4, 2.4], disableMultiStroke: true }, ['ipucu', m.hedef], { anlik: true, baski: false });
    if (m.kaynak >= 0) {
      const [kx, ky] = yer(S.l, m.kaynak);
      const L = Math.hypot(hx - kx, hy - ky), ux = (hx - kx) / L, uy = (hy - ky) / L;
      const a = [kx + ux * 17, ky + uy * 17], b = [hx - ux * 16, hy - uy * 16];
      S.K.cizgi(g, [...a, ...b], { strokeWidth: 1, roughness: .5, disableMultiStroke: true }, ['ipucu-ok', m.kaynak, m.hedef], { anlik: true, baski: false });
      const kol = (s) => [b[0], b[1], b[0] - 6 * (ux * Math.cos(s) - uy * Math.sin(s)), b[1] - 6 * (uy * Math.cos(s) + ux * Math.sin(s))];
      S.K.cizgi(g, kol(.5), { strokeWidth: 1, roughness: .4, disableMultiStroke: true }, ['ipucu-k1', m.kaynak, m.hedef], { anlik: true, baski: false });
      S.K.cizgi(g, kol(-.5), { strokeWidth: 1, roughness: .4, disableMultiStroke: true }, ['ipucu-k2', m.kaynak, m.hedef], { anlik: true, baski: false });
    }
    for (const a of [m.al, m.al2]) {
      if (a < 0) continue;
      const [ax, ay] = yer(S.l, a);
      S.K.daire(g, [ax, ay, 40], { stroke: renkDeger('vurgu'), strokeWidth: 1, roughness: .6, strokeLineDash: [2.4, 2.4], disableMultiStroke: true }, ['ipucu-al', a], { anlik: true, baski: false });
    }
    return g;
  }
  function ipucuSil(S) { for (const e of Array.from(S.k.isaret.querySelectorAll('.ipucu-hayal'))) e.remove(); }

  DT.draw = {
    B, izgara, yer,
    sahneKur, yaz, baslikCiz, yapimCiz, tahtaCiz, noktalarCiz, notasyonCiz,
    tasEkle, tasKonumla, tasKay, tasOtur, oynat, onizleme, onizlemeSil,
    hedefCiz, adayCiz, isaretleriSil, degirmenCiz, degirmenSil, sonucYaz, sonucSil, ipucuGoster, ipucuSil,
    evreYaz, durumYaz, dusunmeCiz, dusunmeSil, ipucuCetele, tepsiCiz, elYeri, alinanYeri,
  };
})();
