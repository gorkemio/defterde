// draw.js — Kağıt Rallisi'ne özgü çizim. Kalem altyapısı kit/kalem.js, malzeme kit/kecelikalem.js.
// Kuralları bilmez; pist modeli (track.js) ve kural motorunun verdiği adaylar/izler ile çalışır.
// SVG koordinatı: kafes noktası (x, y) → (x·U, y·U), U = 20 birim = bir defter karesi. viewBox bir hücre pay bırakır.
(function () {
  'use strict';

  const KR = (window.KR = window.KR || {});
  const KL = window.Kit.kalem;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger, soldur, animasyonVar } = KL;
  const T = KR.track;
  const U = 20;
  const KATMAN = ['cim', 'yikama', 'pist', 'bordur', 'cizgiler', 'kontrol', 'ideal', 'izler', 'fren', 'halka', 'adaylar', 'onizleme', 'hayalet', 'arabalar', 'efekt', 'sonuc'];
  const KURSUN = { yayilma: false };
  const AGAC_GOVDE = '#6b5a46';

  function sahne(svg, p, id) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `${-U} ${-U} ${(p.W + 2) * U} ${(p.H + 2) * U}`);
    const S = { svg, p, id, g: {}, K: KL.kalemYap(svg), arabalar: new Map(), halka: null };
    for (const ad of KATMAN) S.g[ad] = svgEl('g', { class: ad }, svg);
    S.g.cim.setAttribute('opacity', '.66');
    S.g.adaylar.setAttribute('opacity', '.85');
    return S;
  }

  /* ---------- çim: tutamlar, çalılar, ağaçlar ---------- */

  function cimCiz(S) {
    const p = S.p, d = T.cimMesafesi(p), r = rastgele('cim', p.kimlik, S.id), K = S.K;
    const bant = ['', '', ''];
    const f = (v) => (v * U).toFixed(1);
    const calilar = [], agaclar = [];
    for (let row = 0; row < p.H; row++) for (let c = 0; c < p.W; c++) {
      const m = d[row * p.W + c];
      if (!m) continue;
      const n = m <= 1 ? 3 : m === 2 ? 2 : m <= 4 ? (r() < .5 ? 1 : 0) : (r() < .14 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const cx = c + r(), cy = row + r();
        const a = (-58 + aralik(r, -14, 14)) * Math.PI / 180, L = aralik(r, .3, .55);
        const ux = Math.cos(a) * L / 2, uy = Math.sin(a) * L / 2, nx = -Math.sin(a) * .13, ny = Math.cos(a) * .13;
        const cizgi = r() < .6 ? 2 : 3;
        for (let t = 0; t < cizgi; t++) {
          const x1 = cx - ux + nx * t, y1 = cy - uy + ny * t, x2 = cx + ux + nx * t, y2 = cy + uy + ny * t;
          if (T.alanDegeri(p, x1, y1) > .22 || T.alanDegeri(p, x2, y2) > .22) continue;
          bant[m <= 2 ? 0 : m <= 4 ? 1 : 2] += `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)} `;
        }
      }
      if (m >= 3 && r() < .04 && c > 0 && row > 0 && c < p.W - 1 && row < p.H - 1) calilar.push([c + .5 + aralik(r, -.3, .3), row + .5 + aralik(r, -.3, .3), aralik(r, .8, 1.3)]);
      if (m >= 4 && r() < .03 && c > 1 && row > 1 && c < p.W - 2 && row < p.H - 2) agaclar.push([c + .5, row + .5, aralik(r, 1.2, 1.8)]);
    }
    bant.forEach((d2, b) => {
      if (!d2) return;
      K.yol(S.g.cim, d2, { stroke: renkDeger('cim'), strokeWidth: 1.15, roughness: .3, bowing: .2, disableMultiStroke: true },
        ['cim', p.kimlik, b], Object.assign({ anlik: true }, KURSUN));
    });
    // çalılar: yeşil kurşun taramalı elipsler (en çok 14)
    calilar.slice(0, 14).forEach(([x, y, w], i) => {
      K.elips(S.g.cim, [x * U, y * U, w * U, w * U * .7], { stroke: renkDeger('cim'), strokeWidth: 1.1, roughness: 1.1, fill: renkDeger('cim'), fillStyle: 'hachure', hachureGap: 3.2, hachureAngle: aralik(r, -70, -30), fillWeight: .9 },
        ['cali', p.kimlik, i], Object.assign({ anlik: true }, KURSUN));
    });
    // ağaçlar: taç + gövde (en çok 6, birbirinden uzak)
    const secilen = [];
    for (const a of agaclar) { if (secilen.length >= 6) break; if (secilen.every(b => Math.hypot(a[0] - b[0], a[1] - b[1]) > 4)) secilen.push(a); }
    secilen.forEach(([x, y, w], i) => {
      K.cizgi(S.g.cim, [x * U, y * U + w * U * .25, x * U, y * U + w * U * .62], { stroke: AGAC_GOVDE, strokeWidth: 2.2, roughness: .6 }, ['agac', p.kimlik, i, 'g'], Object.assign({ anlik: true }, KURSUN));
      K.daire(S.g.cim, [x * U, y * U, w * U], { stroke: renkDeger('cim'), strokeWidth: 1.2, roughness: 1.3, fill: renkDeger('cim'), fillStyle: 'hachure', hachureGap: 2.8, hachureAngle: aralik(r, 20, 60), fillWeight: .9 },
        ['agac', p.kimlik, i, 't'], Object.assign({ anlik: true }, KURSUN));
    });
  }

  /* ---------- pist: yıkama, kenar, bordür, oklar, START ---------- */

  function yikamaCiz(S, halkalar) {
    const p = S.p, g = S.g.yikama;
    const yol = svgEl('path', { d: T.bolgeYolu(halkalar, (x, y) => [x * U, y * U]), fill: renkDeger('siyah'), 'fill-opacity': '.055', 'fill-rule': 'evenodd', stroke: 'none' }, g);
    // asfalt greni: seyrek kısa gri çizgiler
    const r = rastgele('gren', p.kimlik, S.id), f = (v) => (v * U).toFixed(1);
    let d = '';
    for (let row = 0; row < p.H; row++) for (let c = 0; c < p.W; c++) {
      if (!p.asfalt(c, row) || r() > .18) continue;
      const x = c + r(), y = row + r(), a = aralik(r, -.6, .6), L = aralik(r, .15, .32);
      d += `M ${f(x)} ${f(y)} L ${f(x + Math.cos(a) * L)} ${f(y + Math.sin(a) * L)} `;
    }
    if (d) {
      const s = S.K.yol(g, d, { stroke: '#8a8a8a', strokeWidth: .9, roughness: .2, disableMultiStroke: true }, ['gren', p.kimlik], Object.assign({ anlik: true }, KURSUN));
      s.node.setAttribute('opacity', '.45');
    }
    return yol;
  }

  // Virajlarda kırmızı-beyaz bordür: eğri boyunca iç normal yönünde küçük dörtgenler.
  function bordurCiz(S, halkalar, o = {}) {
    const g = S.g.bordur, K = S.K, p = S.p;
    const bit = [];
    halkalar.forEach((h, k) => {
      const ic = k === 0;
      const bolgeler = T.bordurAdaylari(h), orn = T.yayOrnekle(h, .45, ic);
      bolgeler.forEach((z, bi) => {
        const parca = orn.filter(q => q.s >= z.bas && q.s <= z.bit);
        parca.forEach((q, i) => {
          const L = .45 / 2, W1 = .05, W2 = .36;
          const pts = [
            [q.x - q.tx * L + q.nx * W1, q.y - q.ty * L + q.ny * W1], [q.x + q.tx * L + q.nx * W1, q.y + q.ty * L + q.ny * W1],
            [q.x + q.tx * L + q.nx * W2, q.y + q.ty * L + q.ny * W2], [q.x - q.tx * L + q.nx * W2, q.y - q.ty * L + q.ny * W2],
          ].map(([x, y]) => [x * U, y * U]);
          const kirmizi = i % 2 === 0;
          const s = K.cokgen(g, pts, kirmizi
            ? { stroke: renkDeger('kirmizi'), strokeWidth: .7, fill: renkDeger('kirmizi'), fillStyle: 'solid', roughness: .35 }
            : { stroke: renkDeger('siyah'), strokeWidth: .7, roughness: .35 },
          ['bordur', p.kimlik, k, bi, i], { anlik: o.anlik, gecikme: (o.gecikme || 0) + i * 14, yayilma: false });
          bit.push(s.bitti);
        });
      });
    });
    return Promise.all(bit);
  }

  function baslangicIsaretleri(S, o = {}) {
    const z = S.p.bitis, K = S.K, g = S.g.cizgiler, kur = renkDeger('kursun');
    const mx = (z.a[0] + z.b[0]) / 2, my = (z.a[1] + z.b[1]) / 2, [yx, yy] = z.yon;
    [2.2, 4.8].forEach((d, i) => {
      const cx = mx + yx * d, cy = my + yy * d, L = .55;
      const x1 = (cx - yx * L) * U, y1 = (cy - yy * L) * U, x2 = (cx + yx * L) * U, y2 = (cy + yy * L) * U;
      const ok = { stroke: kur, strokeWidth: 1.6, roughness: .5 };
      K.cizgi(g, [x1, y1, x2, y2], ok, ['ok', S.p.kimlik, i], { anlik: o.anlik, gecikme: (o.gecikme || 0) + i * 120, yayilma: false });
      const a = Math.atan2(yy, yx);
      for (const s of [.6, -.6]) K.cizgi(g, [x2, y2, x2 - 8 * Math.cos(a + s), y2 - 8 * Math.sin(a + s)], ok, ['ok', S.p.kimlik, i, s], { anlik: o.anlik, gecikme: (o.gecikme || 0) + 120 + i * 120, yayilma: false });
    });
    // START: çizginin ilk ucunun ötesinde, çimde
    const tx = z.dikey ? z.a[0] : z.a[0] - 1, ty = z.dikey ? z.a[1] - 1 : z.a[1];
    metinSvg(g, 'START', { x: tx * U, y: ty * U + 6, boyut: 17, renk: 'siyah', sinif: 'baslik', hiza: 'middle', aci: z.dikey ? 0 : -90,
      tohum: ['start', S.p.kimlik], gecikme: (o.gecikme || 0) + 200, anlik: o.anlik, adim: 40 });
  }

  // Pist kenarı: kalın siyah keçeli. Dış halka önce, iç halkalar onun %70'inde başlar.
  function pistCiz(S, o = {}) {
    const p = S.p, K = S.K;
    for (const ad of ['cim', 'yikama', 'pist', 'bordur', 'cizgiler']) S.g[ad].textContent = '';
    cimCiz(S);
    const halkalar = T.kenarCokgenleri(p);
    const yikama = yikamaCiz(S, halkalar);
    let gec = o.gecikme || 0, son = 0;
    const bit = [];
    halkalar.forEach((h, k) => {
      const d = T.egriYolu(h, (x, y) => [x * U, y * U]);
      const s = K.yol(S.g.pist, d, { stroke: renkDeger('siyah'), strokeWidth: 3.8, roughness: .75, bowing: .5, preserveVertices: true },
        ['pist', p.kimlik, k], { gecikme: gec, anlik: o.anlik, sureMs: [900, 1400] });
      bit.push(s.bitti);
      son = Math.max(son, gec + s.sure);
      gec += s.sure * .7;
    });
    if (animasyonVar() && !o.anlik) {
      const a = yikama.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: son * .6, fill: 'both' });
      a.finished.then(() => a.cancel(), () => {});
    }
    bit.push(bordurCiz(S, halkalar, { gecikme: son * .5, anlik: o.anlik }));
    const b = bitisCiz(S, { gecikme: son, anlik: o.anlik });
    bit.push(b.bitti);
    baslangicIsaretleri(S, { gecikme: son + b.sure, anlik: o.anlik });
    kontrolCiz(S, o.kontrolGoster);
    return { bitti: Promise.all(bit), sure: son + b.sure };
  }

  // Damalı bitiş çizgisi: çizgi boyunca iki sıra kare, uçlarda yarım hücre taşar.
  function bitisCiz(S, o = {}) {
    const z = S.p.bitis, K = S.K, bit = [];
    const kare = .3, bas = (z.dikey ? z.a[1] : z.a[0]) - .5, uz = (z.dikey ? z.b[1] - z.a[1] : z.b[0] - z.a[0]) + 1;
    const adet = Math.round(uz / kare), k = uz / adet;
    let sure = 0;
    for (let i = 0; i < adet; i++) for (let j = 0; j < 2; j++) {
      if ((i + j) % 2) continue;
      const u = bas + i * k, w = (j - 1) * kare;
      const [x, y, w2, h2] = z.dikey ? [z.a[0] + w, u, kare, k] : [u, z.a[1] + w, k, kare];
      const s = K.dikdortgen(S.g.cizgiler, [x * U, y * U, w2 * U, h2 * U],
        { stroke: renkDeger('siyah'), strokeWidth: .6, fill: renkDeger('siyah'), fillStyle: 'solid', roughness: .35 },
        ['bitis', S.p.kimlik, i, j], { gecikme: (o.gecikme || 0) + i * 12, anlik: o.anlik, yayilma: false });
      bit.push(s.bitti);
      sure = i * 12 + 140;
    }
    const [x, y, w2, h2] = z.dikey ? [z.a[0] - kare, bas, 2 * kare, uz] : [bas, z.a[1] - kare, uz, 2 * kare];
    bit.push(K.dikdortgen(S.g.cizgiler, [x * U, y * U, w2 * U, h2 * U], { stroke: renkDeger('siyah'), strokeWidth: 1.2, roughness: .5 },
      ['bitis-kenar', S.p.kimlik], { gecikme: o.gecikme || 0, anlik: o.anlik, yayilma: false }).bitti);
    return { bitti: Promise.all(bit), sure };
  }

  // Kontrol noktaları normalde görünmez; ayarla kesikli kurşun kalem + sıra numarası.
  function kontrolCiz(S, goster) {
    S.g.kontrol.textContent = '';
    if (!goster) return;
    S.p.kontrol.forEach((z, i) => {
      const [x1, y1, x2, y2] = z.dikey ? [z.a[0], z.a[1] - .3, z.b[0], z.b[1] + .3] : [z.a[0] - .3, z.a[1], z.b[0] + .3, z.b[1]];
      S.K.cizgi(S.g.kontrol, [x1 * U, y1 * U, x2 * U, y2 * U],
        { stroke: renkDeger('kursun'), strokeWidth: 1.2, roughness: .4, strokeLineDash: [6, 5], disableMultiStroke: true },
        ['kontrol', S.p.kimlik, i], Object.assign({ anlik: true }, KURSUN));
      metinSvg(S.g.kontrol, String(i + 1), { x: x1 * U - 6, y: y1 * U - 4, boyut: 15, renk: 'kursun', tohum: ['kontrol', i], anlik: true });
    });
  }

  /* ---------- araba ---------- */

  // Üstten bakış yarış arabası, burun +x yönünde, merkez (0,0); 24×12 birim. o: { kursun (hayalet), no, golge }
  function arabaGovde(K, g, renk, an, o = {}) {
    const siyah = o.kursun ? renk : renkDeger('siyah');
    const cam = o.kursun ? 'none' : '#dfe7ee';
    const bit = [];
    const ek = Object.assign({ anlik: true }, o.kursun ? KURSUN : {});
    if (o.golge !== false && !o.kursun) {
      const s = K.elips(g, [2.5, 3, 27, 13.5], { stroke: 'none', fill: renkDeger('kursun'), fillStyle: 'hachure', hachureGap: 2.2, hachureAngle: 35, fillWeight: .8 }, [...an, 'golge'], { anlik: true, yayilma: false });
      s.node.setAttribute('opacity', '.38');
    }
    const govde = 'M -10.5 -5 Q -11.8 0 -10.5 5 L 5 5.4 Q 9.5 5 11.5 2.4 Q 12.2 0 11.5 -2.4 Q 9.5 -5 5 -5.4 Z';
    const g1 = K.yol(g, govde, o.kursun
      ? { stroke: renk, strokeWidth: 1.6, roughness: .6, fill: renk, fillStyle: 'hachure', hachureGap: 3, fillWeight: .6 }
      : { stroke: renk, strokeWidth: 1.8, roughness: .55, bowing: .4, fill: renk, fillStyle: 'solid' }, [...an, 'govde'], ek);
    bit.push(g1.bitti);
    for (const yol of g1.node.querySelectorAll('path')) { const f = yol.getAttribute('fill'); if (f && f !== 'none') yol.setAttribute('fill-opacity', '.88'); }
    // spoyler
    bit.push(K.cizgi(g, [-12.2, -5.6, -12.2, 5.6], { stroke: siyah, strokeWidth: 1.7, roughness: .3 }, [...an, 'spoyler'], { anlik: true, yayilma: false }).bitti);
    // tekerlekler
    for (const [x, y] of [[-8.5, -6.1], [5.2, -6.1], [-8.5, 6.1], [5.2, 6.1]]) {
      bit.push(K.dikdortgen(g, [x - 2.2, y - 1.15, 4.4, 2.3], { stroke: siyah, strokeWidth: .9, roughness: .25, fill: siyah, fillStyle: 'solid' }, [...an, 'teker', x, y], { anlik: true, yayilma: false }).bitti);
    }
    // camlar ve kabin
    bit.push(K.yol(g, 'M 3.2 -3.2 L 6 -2.6 L 6 2.6 L 3.2 3.2 Z', { stroke: siyah, strokeWidth: .9, roughness: .3, fill: cam, fillStyle: 'solid' }, [...an, 'oncam'], { anlik: true, yayilma: false }).bitti);
    bit.push(K.yol(g, 'M -8.4 -3.7 L -6.2 -3.9 L -6.2 3.9 L -8.4 3.7 Z', { stroke: siyah, strokeWidth: .9, roughness: .3, fill: cam, fillStyle: 'solid' }, [...an, 'arkacam'], { anlik: true, yayilma: false }).bitti);
    bit.push(K.cizgi(g, [-6.2, -3.9, 3.2, -3.2], { stroke: siyah, strokeWidth: .8, roughness: .3 }, [...an, 'kabin1'], { anlik: true, yayilma: false }).bitti);
    bit.push(K.cizgi(g, [-6.2, 3.9, 3.2, 3.2], { stroke: siyah, strokeWidth: .8, roughness: .3 }, [...an, 'kabin2'], { anlik: true, yayilma: false }).bitti);
    // numara
    if (!o.kursun) {
      bit.push(K.daire(g, [-1.5, 0, 6.2], { stroke: siyah, strokeWidth: .8, roughness: .3, fill: '#fbf9f2', fillStyle: 'solid' }, [...an, 'no'], { anlik: true, yayilma: false }).bitti);
      if (o.no) metinSvg(g, String(o.no), { x: -1.5, y: 2.6, boyut: 7.5, renk: 'siyah', sinif: 'baslik', hiza: 'middle', tohum: [...an, 'num'], anlik: true });
      for (const y of [-2.3, 2.3]) svgEl('circle', { cx: 10.9, cy: y, r: .9, fill: '#fff6c8', stroke: siyah, 'stroke-width': .5 }, g);
    }
    return Promise.all(bit);
  }

  const donusum = (x, y, aci) => `translate(${(x * U).toFixed(2)}px, ${(y * U).toFixed(2)}px) rotate(${aci.toFixed(1)}deg)`;

  function arabaKoy(S, i, renk, x, y, aci, o = {}) {
    let e = S.arabalar.get(i);
    if (!e) {
      const g = svgEl('g', { class: 'araba', 'data-i': i }, o.hayalet ? S.g.hayalet : S.g.arabalar);
      const ic = svgEl('g', null, g);
      if (o.hayalet) g.setAttribute('opacity', '.38');
      arabaGovde(S.K, ic, renk, ['araba', i, renk, o.hayalet ? 'h' : ''], { kursun: o.hayalet, no: o.no });
      e = { g, aci, x, y };
      S.arabalar.set(i, e);
    }
    e.x = x; e.y = y; e.aci = aci;
    e.g.style.transform = donusum(x, y, aci);
    return e;
  }

  // Arabayı yeni noktaya kaydırır, burnunu hız yönüne çevirir (en kısa dönüş).
  function arabaTasi(S, i, x, y, aci, sure) {
    const e = S.arabalar.get(i);
    if (!e) return Promise.resolve();
    let d = ((aci - e.aci) % 360 + 540) % 360 - 180;
    const yeniAci = e.aci + d;
    const once = donusum(e.x, e.y, e.aci), sonra = donusum(x, y, yeniAci);
    e.x = x; e.y = y; e.aci = yeniAci;
    e.g.style.transform = sonra;
    if (!animasyonVar() || !sure) return Promise.resolve();
    const a = e.g.animate([{ transform: once }, { transform: sonra }], { duration: sure, easing: 'ease-in-out' });
    return a.finished.then(() => {}, () => {});
  }

  function arabaSil(S, i) { const e = S.arabalar.get(i); if (e) { e.g.remove(); S.arabalar.delete(i); } }

  // Çarpmada küçük sarsıntı (araba grubunun içi; dış grup konum/dönüş taşır)
  function arabaSars(S, i) {
    const e = S.arabalar.get(i);
    if (!e || !animasyonVar()) return Promise.resolve();
    const ic = e.g.firstElementChild;
    const a = ic.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(2px,-1.5px)' }, { transform: 'translate(-2px,1.5px)' }, { transform: 'translate(1.5px,1px)' }, { transform: 'translate(0,0)' }], { duration: 280 });
    return a.finished.then(() => {}, () => {});
  }

  // Marj için mini araba: svg viewBox -14 -8 28 16
  function miniAraba(svg, renk, no, an) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '-14 -8.5 28 17');
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg);
    arabaGovde(K, g, renk, ['mini', ...an], { no, golge: false });
  }

  /* ---------- sıradaki araba halkası, hız çizgileri ---------- */

  function halkaKoy(S, x, y, an) {
    halkaSil(S, true);
    const g = svgEl('g', { class: 'halka' }, S.g.halka);
    g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
    S.K.daire(g, [x * U, y * U, 32], { stroke: renkDeger('kursun'), strokeWidth: 1.3, roughness: .7, strokeLineDash: [6, 4], disableMultiStroke: true }, ['halka', ...an], { anlik: true, yayilma: false });
    g.setAttribute('opacity', '.55');
    if (animasyonVar()) g.animate([{ transform: 'scale(1)', opacity: .55 }, { transform: 'scale(1.08)', opacity: .3 }, { transform: 'scale(1)', opacity: .55 }], { duration: 1800, iterations: Infinity, easing: 'ease-in-out' });
    S.halka = g;
  }
  function halkaSil(S, hemen) {
    const g = S.halka;
    S.halka = null;
    if (!g) return;
    if (hemen) g.remove(); else soldur(g, 200);
  }

  // |v| ≥ 3 iken arabanın arkasında kısa kurşun hız çizgileri (fren katmanında, her turda silinir)
  function hizCizgileri(S, a, an) {
    const L = Math.hypot(a.vx, a.vy);
    if (L < 3) return;
    const ux = a.vx / L, uy = a.vy / L, nx = -uy, ny = ux, r = rastgele('hizc', ...an);
    const uz = Math.min(1.5, .3 * L) * U;
    for (let k = -1; k <= 1; k++) {
      const ofs = k * 5.5, bas = 13 + aralik(r, 0, 4);
      const x1 = a.x * U - ux * bas + nx * ofs, y1 = a.y * U - uy * bas + ny * ofs;
      const s = S.K.cizgi(S.g.fren, [x1, y1, x1 - ux * uz * (k ? .7 : 1), y1 - uy * uz * (k ? .7 : 1)], { stroke: renkDeger('kursun'), strokeWidth: 1.1, roughness: .4 }, [...an, 'hc', k], { anlik: true, yayilma: false });
      s.node.setAttribute('opacity', '.5');
    }
  }

  /* ---------- iz ---------- */

  function izParca(S, renk, x1, y1, x2, y2, an, o = {}) {
    const s = S.K.cizgi(S.g.izler, [x1 * U, y1 * U, x2 * U, y2 * U], { stroke: renk, strokeWidth: 2.3, roughness: .45, bowing: .3 },
      an, { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs || [150, 250] });
    const n = noktaKoy(S, renk, x2, y2, [...an, 'n'], { gecikme: (o.gecikme || 0) + s.sure * .9, anlik: o.anlik });
    return { bitti: Promise.all([s.bitti, n.bitti]), sure: s.sure };
  }
  function noktaKoy(S, renk, x, y, an, o = {}) {
    return S.K.daire(S.g.izler, [x * U, y * U, 5.6], { stroke: renk, fill: renk, fillStyle: 'solid', strokeWidth: 1, roughness: .3 }, an, o);
  }

  // Bütün izleri durumdan anında yeniden çizer (geri alma, yeniden boyutlama).
  function izlerCiz(S, d, renkler) {
    S.g.izler.textContent = '';
    d.arabalar.forEach((a, i) => {
      const renk = renkler[i];
      noktaKoy(S, renk, a.iz[0][0], a.iz[0][1], ['iz', S.id, i, 0], { anlik: true });
      for (let k = 1; k < a.iz.length; k++) izParca(S, renk, ...a.iz[k - 1], ...a.iz[k], ['iz', S.id, i, k], { anlik: true });
      for (const [x, y, cx, cy] of a.carpmalar) carpmaIzi(S, renk, x, y, cx, cy, true);
    });
  }

  /* ---------- adaylar, önizleme, fren izi ---------- */

  function adaylarCiz(S, l, a, an, o = {}) {
    const g = S.g.adaylar, K = S.K;
    g.textContent = '';
    l.forEach((c, k) => {
      const x = c.x * U, y = c.y * U, kur = renkDeger('kursun');
      const ana = !c.ax && !c.ay;
      const gk = svgEl('g', { class: 'aday', 'data-k': k }, g);
      gk.style.transformBox = 'fill-box'; gk.style.transformOrigin = 'center';
      if (c.yasal && c.x === a.x && c.y === a.y) {
        K.daire(gk, [x, y, 22], { stroke: kur, strokeWidth: 1.1, roughness: .5 }, [...an, 'yerinde'], { anlik: true, yayilma: false });
      } else if (c.yasal) {
        K.daire(gk, [x, y, ana ? 7.6 : 5.4], { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: .8, roughness: .3 }, [...an, c.ax, c.ay], { anlik: true, yayilma: false });
        if (ana) K.daire(gk, [x, y, 15], { stroke: kur, strokeWidth: .9, roughness: .6 }, [...an, 'anahalka'], { anlik: true, yayilma: false });
      } else if (c.neden === 'duvar' || c.neden === 'ters') {
        const d = 3.6, r = renkDeger('kirmizi');
        K.cizgi(gk, [x - d, y - d, x + d, y + d], { stroke: r, strokeWidth: 1.4, roughness: .4 }, [...an, c.ax, c.ay, 1], { anlik: true, yayilma: false });
        K.cizgi(gk, [x + d, y - d, x - d, y + d], { stroke: r, strokeWidth: 1.4, roughness: .4 }, [...an, c.ax, c.ay, 2], { anlik: true, yayilma: false });
      } else if (c.neden === 'dolu') {
        K.daire(gk, [x, y, 20], { stroke: kur, strokeWidth: 1, roughness: .5, strokeLineDash: [3, 3], disableMultiStroke: true }, [...an, 'dolu', c.ax, c.ay], { anlik: true, yayilma: false });
      } else if (c.neden === 'kesisme') {
        K.cizgi(gk, [x - 3, y, x + 3, y], { stroke: kur, strokeWidth: 1.2, roughness: .3 }, [...an, 'kes', c.ax, c.ay], { anlik: true, yayilma: false });
      } else { gk.remove(); return; }
      if (animasyonVar() && !o.anlik) {
        const an2 = gk.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 180, delay: k * 25, fill: 'both', easing: 'ease-out' });
        an2.finished.then(() => an2.cancel(), () => {});
      }
    });
  }
  function adaylarSil(S) { S.g.adaylar.textContent = ''; S.g.onizleme.textContent = ''; }
  function adayVurgula(S, k, acik) {
    const gk = S.g.adaylar.querySelector(`.aday[data-k="${k}"]`);
    if (!gk) return;
    gk.style.transition = 'transform 120ms ease-out';
    gk.style.transform = acik ? 'scale(1.3)' : 'scale(1)';
  }

  function onizleme(S, a, c) {
    S.g.onizleme.textContent = '';
    if (!c) return;
    S.K.cizgi(S.g.onizleme, [a.x * U, a.y * U, c.x * U, c.y * U],
      { stroke: renkDeger('kursun'), strokeWidth: 1.3, roughness: .35, strokeLineDash: [5, 4], disableMultiStroke: true },
      ['onizleme', c.x, c.y], { sureMs: [120, 120], yayilma: false });
  }

  // Fren izi: kesikli silik kurşun kalem; durduğu yerde küçük dik çizgi, duvarda çarpı.
  function frenIziCiz(S, f, an, temizle = true) {
    const g = S.g.fren, K = S.K, kur = renkDeger('kursun');
    if (temizle) g.textContent = '';
    if (!f || f.noktalar.length < 2) return;
    const pts = f.noktalar.map(([x, y]) => [x * U, y * U]);
    const d = 'M ' + pts.map(q => q.map(v => v.toFixed(1)).join(' ')).join(' L ');
    const s = K.yol(g, d, { stroke: kur, strokeWidth: 1.2, roughness: .3, strokeLineDash: [4, 5], disableMultiStroke: true }, [...an, 'fren'], { anlik: true, yayilma: false });
    s.node.setAttribute('opacity', '.55');
    const [x, y] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
    const L = Math.hypot(x - px, y - py) || 1, nx = -(y - py) / L * 5, ny = (x - px) / L * 5;
    if (f.carpma >= 0) {
      const r = renkDeger('kirmizi');
      K.cizgi(g, [x - 4, y - 4, x + 4, y + 4], { stroke: r, strokeWidth: 1.2, roughness: .3 }, [...an, 'fx1'], { anlik: true, yayilma: false });
      K.cizgi(g, [x + 4, y - 4, x - 4, y + 4], { stroke: r, strokeWidth: 1.2, roughness: .3 }, [...an, 'fx2'], { anlik: true, yayilma: false });
    } else {
      K.cizgi(g, [x - nx, y - ny, x + nx, y + ny], { stroke: kur, strokeWidth: 1.4, roughness: .3 }, [...an, 'fdur'], { anlik: true, yayilma: false });
    }
  }

  // Telefonda arabanın yanında küçük hız oku (fren katmanında; her turda silinir).
  function kucukOk(S, a, renkI, an) {
    const L = Math.hypot(a.vx, a.vy);
    if (!L) return;
    const boy = Math.min(1.2, .3 * L) * U, ux = a.vx / L, uy = a.vy / L;
    const x1 = a.x * U + ux * 13, y1 = a.y * U + uy * 13, x2 = x1 + ux * boy, y2 = y1 + uy * boy;
    const g = S.g.fren, o = { stroke: renkI, strokeWidth: 1.8, roughness: .3 };
    S.K.cizgi(g, [x1, y1, x2, y2], o, [...an, 'kok'], { anlik: true, yayilma: false });
    const aci = Math.atan2(uy, ux);
    for (const s2 of [.55, -.55]) S.K.cizgi(g, [x2, y2, x2 - 5 * Math.cos(aci + s2), y2 - 5 * Math.sin(aci + s2)], o, [...an, 'kuc', s2], { anlik: true, yayilma: false });
  }

  /* ---------- hız oku (marjda ayrı svg) ---------- */

  // svg viewBox 0 0 100 100; 1 hız birimi = 9 birim, en çok 42.
  function hizOkuCiz(svg, vx, vy, renk, an) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 100 100');
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg);
    const kur = renkDeger('kursun');
    K.cizgi(g, [43, 50, 57, 50], { stroke: kur, strokeWidth: .9, roughness: .3 }, ['hiz', 'artı1'], { anlik: true, yayilma: false });
    K.cizgi(g, [50, 43, 50, 57], { stroke: kur, strokeWidth: .9, roughness: .3 }, ['hiz', 'artı2'], { anlik: true, yayilma: false });
    const L = Math.hypot(vx, vy);
    if (!L) {
      K.daire(g, [50, 50, 13], { stroke: renk, strokeWidth: 2.2, roughness: .5 }, [...an, 'dur'], { anlik: true });
      return;
    }
    const olcek = Math.min(9, 42 / L), x = 50 + vx * olcek, y = 50 + vy * olcek;
    K.cizgi(g, [50, 50, x, y], { stroke: renk, strokeWidth: 3.2, roughness: .5 }, [...an, 'ok'], { sureMs: [180, 220] });
    const a = Math.atan2(y - 50, x - 50), uc = 11;
    for (const s of [.5, -.5]) {
      K.cizgi(g, [x, y, x - uc * Math.cos(a + s), y - uc * Math.sin(a + s)], { stroke: renk, strokeWidth: 3.2, roughness: .4 }, [...an, 'uc', s], { gecikme: 160 });
    }
  }

  // Tur çetelesi: n çizgi, beşerli (dört dik + çapraz). svg viewBox 0 0 (n*8+10) 24
  function ceteleCiz(svg, n, an) {
    svg.textContent = '';
    const gruplar = Math.ceil(n / 5), W = Math.max(1, gruplar) * 34;
    svg.setAttribute('viewBox', `0 0 ${W} 24`);
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg), kur = renkDeger('kursun');
    for (let i = 0; i < n; i++) {
      const grup = Math.floor(i / 5), k = i % 5, x0 = grup * 34 + 4;
      if (k < 4) K.cizgi(g, [x0 + k * 6, 4, x0 + k * 6 + 1, 20], { stroke: kur, strokeWidth: 1.6, roughness: .6 }, [...an, 'c', i], { anlik: true, yayilma: false });
      else K.cizgi(g, [x0 - 2, 18, x0 + 22, 6], { stroke: kur, strokeWidth: 1.6, roughness: .6 }, [...an, 'c', i], { anlik: true, yayilma: false });
    }
  }

  /* ---------- çarpma ---------- */

  // Kalıcı iz: arabadan duvara ince çizgi + duvarda keçeli karalama + çimde yeşil karalama.
  function carpmaIzi(S, renk, x, y, cx, cy, anlik) {
    const K = S.K, g = svgEl('g', { class: 'carpma-izi' }, S.g.izler), r = rastgele('carpma', x, y, cx, cy);
    const bit = [];
    if (Math.hypot(cx - x, cy - y) > .2) {
      const s = K.cizgi(g, [x * U, y * U, cx * U, cy * U], { stroke: renk, strokeWidth: 1.5, roughness: .4 }, ['carpma-yol', x, y, cx, cy], { anlik, yayilma: false });
      s.node.setAttribute('opacity', '.55');
      bit.push(s.bitti);
    }
    const zik = (rad, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([cx * U + aralik(r, -rad, rad), cy * U + aralik(r, -rad, rad)]);
      return pts;
    };
    bit.push(K.egri(g, zik(9, 7), { stroke: renkDeger('cim'), strokeWidth: 1.2, roughness: 1.2 }, ['carpma-cim', x, y, cx, cy], { anlik, gecikme: 60, yayilma: false }).bitti);
    bit.push(K.egri(g, zik(6, 6), { stroke: renk, strokeWidth: 2.2, roughness: 1.4 }, ['carpma-karalama', x, y, cx, cy], { anlik, gecikme: 120, sureMs: [260, 320] }).bitti);
    return Promise.all(bit);
  }

  function carpmaCiz(S, renk, x, y, cx, cy) {
    const b = carpmaIzi(S, renk, x, y, cx, cy, false);
    const t = metinSvg(S.g.efekt, 'çarptı!', { x: cx * U, y: cy * U - 14, boyut: 26, renk: 'kirmizi', sinif: 'baslik',
      aci: aralik(rastgele('carpti', cx, cy), -8, 8), tohum: ['carpti', cx, cy], gecikme: 200 });
    setTimeout(() => soldur(t.node, 400), 1700);
    return b;
  }

  /* ---------- bitiş: bantlı kağıt, bayrak, podyum ---------- */

  // o: { baslik, basamaklar: [{ renk, no, ad, altYazi }] (1., 2., 3. sırayla; en çok 3), satirlar: [{ yazi, renk }], genMax, merkez }
  function bayrakCiz(S, o = {}) {
    const p = S.p, K = S.K, g = S.g.sonuc;
    g.textContent = '';
    const basamak = (o.basamaklar || []).slice(0, 3), satirlar = o.satirlar || [];
    const podW = 60, bosluk = 8, podAlan = basamak.length ? basamak.length * (podW + bosluk) : 0;
    const genis = Math.min(o.genMax || 1e9, Math.max(300, podAlan + 150, ...satirlar.map(s => s.yazi.length * 12 + 80)));
    const yuk = 56 + (basamak.length ? 130 : 0) + satirlar.length * 30 + (o.baslik ? 34 : 0);
    const cx = o.merkez ? o.merkez[0] * U : p.W * U / 2, cy = o.merkez ? o.merkez[1] * U : p.H * U / 2;
    const x0 = cx - genis / 2, y0 = cy - yuk / 2;
    const kart = svgEl('g', { class: 'kart' }, g);
    kart.style.transformBox = 'fill-box'; kart.style.transformOrigin = 'center';
    kart.setAttribute('transform', `rotate(${aralik(rastgele('kart', S.id), -1.5, 1.5).toFixed(2)} ${cx} ${cy})`);
    // kağıt + gölge
    svgEl('rect', { x: x0 + 4, y: y0 + 6, width: genis, height: yuk, fill: '#000', opacity: .16, rx: 2 }, kart);
    K.dikdortgen(kart, [x0, y0, genis, yuk], { stroke: '#cfc8b8', strokeWidth: 1, fill: '#fffdf6', fillStyle: 'solid', roughness: .8 }, ['sonuc-kagit', S.id], { anlik: true, yayilma: false });
    // bant
    svgEl('rect', { x: cx - 34, y: y0 - 7, width: 68, height: 14, fill: '#fff', opacity: .5, transform: `rotate(-3 ${cx} ${y0})` }, kart);
    svgEl('rect', { x: cx - 34, y: y0 - 7, width: 68, height: 14, fill: 'none', stroke: '#b9b09a', 'stroke-width': .6, opacity: .7, transform: `rotate(-3 ${cx} ${y0})` }, kart);
    let y = y0 + 18;
    // bayrak (solda, dalgalanır)
    const bayrak = svgEl('g', { class: 'bayrak' }, kart);
    const bx = x0 + 18, by = y0 + 14, kare = 7;
    K.cizgi(bayrak, [bx, by - 2, bx, by + 50], { stroke: renkDeger('siyah'), strokeWidth: 2.6, roughness: .4 }, ['direk', S.id], { gecikme: 0 });
    const dalga = svgEl('g', null, bayrak);
    dalga.style.transformBox = 'fill-box'; dalga.style.transformOrigin = 'left center';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const w = Math.sin(i * .9) * 2.2;
      K.dikdortgen(dalga, [bx + 2 + i * kare, by + j * kare + w, kare, kare], (i + j) % 2
        ? { stroke: renkDeger('siyah'), strokeWidth: .7, roughness: .3 }
        : { stroke: renkDeger('siyah'), strokeWidth: .7, fill: renkDeger('siyah'), fillStyle: 'solid', roughness: .3 },
      ['bayrak', S.id, i, j], { gecikme: 120 + (i + j) * 25, yayilma: false });
    }
    if (animasyonVar()) dalga.animate([{ transform: 'skewY(-2deg)' }, { transform: 'skewY(2deg)' }, { transform: 'skewY(-2deg)' }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
    if (o.baslik) {
      metinSvg(kart, o.baslik, { x: cx + 20, y: y + 16, boyut: 28, renk: 'siyah', sinif: 'baslik', hiza: 'middle', tohum: ['sonuc-baslik', S.id], gecikme: 300 });
      y += 34;
    }
    // podyum: 2 | 1 | 3 dizilimi
    if (basamak.length) {
      const yer = basamak.length === 1 ? [0] : basamak.length === 2 ? [1, 0] : [1, 0, 2];
      const yukseklik = [54, 38, 24], taban = y + 118;
      const sol = cx + 20 - (basamak.length * (podW + bosluk) - bosluk) / 2;
      basamak.forEach((b, k) => {
        const sira = yer.indexOf(k), px = sol + sira * (podW + bosluk), h = yukseklik[k];
        K.dikdortgen(kart, [px, taban - h, podW, h], { stroke: renkDeger('siyah'), strokeWidth: 1.6, roughness: .6, fill: '#f1ece0', fillStyle: 'solid' }, ['podyum', S.id, k], { gecikme: 400 + k * 180, yayilma: false });
        metinSvg(kart, String(k + 1), { x: px + podW / 2, y: taban - h / 2 + 9, boyut: 26, renk: 'siyah', sinif: 'baslik', hiza: 'middle', tohum: ['podyum-no', S.id, k], gecikme: 700 + k * 180 });
        const ag = svgEl('g', null, kart);
        ag.setAttribute('transform', `translate(${px + podW / 2} ${taban - h - 9}) scale(1.05)`);
        arabaGovde(K, ag, renkDeger(b.renk), ['podyum-araba', S.id, k], { no: b.no, golge: false });
        if (animasyonVar()) { const a = ag.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 900 + k * 180, fill: 'both' }); a.finished.then(() => a.cancel(), () => {}); }
        metinSvg(kart, b.ad, { x: px + podW / 2, y: taban + 18, boyut: 17, renk: b.renk, sinif: 'baslik', hiza: 'middle', tohum: ['podyum-ad', S.id, k], gecikme: 1000 + k * 180 });
        if (b.altYazi) metinSvg(kart, b.altYazi, { x: px + podW / 2, y: taban + 34, boyut: 13, renk: 'kursun', hiza: 'middle', tohum: ['podyum-alt', S.id, k], gecikme: 1100 + k * 180, anlik: true });
      });
      y = taban + 44;
    }
    satirlar.forEach((s, k) => {
      metinSvg(kart, s.yazi, { x: cx + 20, y: y + 18 + k * 30, boyut: 22, renk: s.renk, sinif: 'baslik', hiza: 'middle', tohum: ['sonuc', S.id, k], gecikme: 1200 + k * 220 });
    });
  }

  function idealCiz(S, yol) {
    S.g.ideal.textContent = '';
    if (!yol || yol.length < 2) return;
    const d = 'M ' + yol.map(([x, y]) => `${x * U} ${y * U}`).join(' L ');
    const s = S.K.yol(S.g.ideal, d, { stroke: renkDeger('kursun'), strokeWidth: 1.5, roughness: .3, strokeLineDash: [7, 5], disableMultiStroke: true },
      ['ideal', S.p.kimlik], { anlik: true, yayilma: false });
    s.node.setAttribute('opacity', '.75');
    for (const [x, y] of yol) svgEl('circle', { cx: x * U, cy: y * U, r: 1.8, fill: renkDeger('kursun'), opacity: .7 }, S.g.ideal);
  }

  /* ---------- sayfa dışı nesneler: keçeli kalem, spiral cilt, başlık bayrağı ---------- */

  // Masada duran keçeli kalem. svg viewBox 0 0 220 34; kapak sıradaki oyuncunun renginde.
  function kalemNesnesiCiz(svg, renk, an) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 220 34');
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg), siyah = renkDeger('siyah');
    svgEl('rect', { x: 8, y: 20, width: 206, height: 10, rx: 5, fill: '#000', opacity: .14 }, g);          // masa gölgesi
    K.yol(g, 'M 60 6 L 196 6 Q 206 6 206 17 Q 206 28 196 28 L 60 28 Z', { stroke: siyah, strokeWidth: 1.4, roughness: .4, fill: '#ecebe6', fillStyle: 'solid' }, [...an, 'govde'], { anlik: true, yayilma: false });
    K.yol(g, 'M 10 9 L 62 6 L 62 28 L 10 25 Q 4 17 10 9 Z', { stroke: siyah, strokeWidth: 1.4, roughness: .4, fill: renk, fillStyle: 'solid' }, [...an, 'kapak', renk], { anlik: true, yayilma: false });
    K.cizgi(g, [14, 11, 14, 23], { stroke: siyah, strokeWidth: 1, roughness: .3 }, [...an, 'klips'], { anlik: true, yayilma: false });
    K.dikdortgen(g, [96, 10, 70, 14], { stroke: siyah, strokeWidth: .8, roughness: .3, fill: renk, fillStyle: 'solid' }, [...an, 'etiket', renk], { anlik: true, yayilma: false });
    metinSvg(g, 'keçeli', { x: 131, y: 21, boyut: 11, renk: '#fbf9f2', sinif: 'baslik', hiza: 'middle', tohum: [...an, 'yazi'], anlik: true });
    K.cizgi(g, [206, 12, 212, 14], { stroke: siyah, strokeWidth: 1.2, roughness: .3 }, [...an, 'uc1'], { anlik: true, yayilma: false });
    K.cizgi(g, [206, 22, 212, 20], { stroke: siyah, strokeWidth: 1.2, roughness: .3 }, [...an, 'uc2'], { anlik: true, yayilma: false });
  }

  // Sol kenar spiral cilt: svg yüksekliği sayfa kadar, genişlik 30 px (sayfanın 14 px soluna taşar). sq: halka aralığı (px).
  function ciltCiz(svg, yukseklik, sq) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 30 ${yukseklik}`);
    svg.setAttribute('width', 30); svg.setAttribute('height', yukseklik);
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg), adim = sq * 2;
    for (let y = adim * .8, i = 0; y < yukseklik - adim * .4; y += adim, i++) {
      svgEl('ellipse', { cx: 21, cy: y, rx: 3.2, ry: 2.2, fill: '#6a6050', opacity: .75 }, g);
      K.egri(g, [[22, y - 7], [7, y - 3], [5, y + 4], [16, y + 8]], { stroke: '#44403a', strokeWidth: 2.2, roughness: .5, disableMultiStroke: true }, ['cilt', i], { anlik: true, yayilma: false });
    }
  }

  // Başlığın yanındaki küçük damalı bayrak (logo). svg viewBox 0 0 40 40
  function logoCiz(svg) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 40 40');
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg), siyah = renkDeger('siyah');
    K.cizgi(g, [6, 4, 6, 38], { stroke: siyah, strokeWidth: 2.4, roughness: .4 }, ['logo', 'direk'], { anlik: true });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const w = Math.sin(i * 1.1) * 1.4;
      K.dikdortgen(g, [8 + i * 7, 5 + j * 7 + w, 7, 7], (i + j) % 2 ? { stroke: siyah, strokeWidth: .8, roughness: .3 } : { stroke: siyah, strokeWidth: .8, fill: siyah, fillStyle: 'solid', roughness: .3 }, ['logo', i, j], { anlik: true, yayilma: false });
    }
  }

  KR.draw = {
    U, sahne, pistCiz, cimCiz, bitisCiz, kontrolCiz, arabaGovde, arabaKoy, arabaTasi, arabaSil, arabaSars, miniAraba,
    halkaKoy, halkaSil, hizCizgileri,
    izParca, noktaKoy, izlerCiz, adaylarCiz, adaylarSil, adayVurgula, onizleme, frenIziCiz, kucukOk, hizOkuCiz, ceteleCiz,
    carpmaIzi, carpmaCiz, bayrakCiz, idealCiz, kalemNesnesiCiz, ciltCiz, logoCiz,
  };
})();
