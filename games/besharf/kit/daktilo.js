// kit/daktilo.js — DAKTİLO YAZISI: şerit mürekkebiyle basılmış harfler. Basılı yazıdır (rough.js yok); hangi oyun olduğunu bilmez.
// Her harf: tohumlu ±1 px taban kayması, ±.5 px yatay kayma, ±1° dönme, düzensiz baskı yoğunluğu (bazen bir kenarı açık),
// ~1/10 harf daha koyu vurulmuş. Mürekkep dokusu svg başına tek süzgeç (benekli kaplama, hafif yayılma, pürüzlü kenar).
// Vuruş: harf 60 ms'de 1.08 → 1 küçülür, mürekkep koyu basılıp oturur.
//
//   Kit.daktilo.harf(katman, 'Ş', { x, y, boyut: 26, tohum: ['kutu', 2, 3], serit: 'siyah' | 'kirmizi', anlik, gecikme })
//       → { node: g.daktilo-harf, metin: <text>, bitti, sure }       x: harfin ortası, y: taban çizgisi
//   Kit.daktilo.yaz(katman, 'BEŞ HARF', { x, y, boyut, hiza: 'sol' | 'orta' | 'sag', adim: .6, tohum, serit, anlik, gecikme,
//       aralikMs: 70, ses: false }) → { node, harfler, bitti, sure, genislik }   (eşaralıklı: her harf boyut × adim yer kaplar)
//   Kit.daktilo.metin(el, 'Nasıl oynanır?', { tohum, serit, anlik, gecikme, aralikMs }) → HTML: harf başına span
//   Kit.daktilo.ortaTaban(cy, boyut) → büyük harfi cy'de dikey ortalayan taban çizgisi
//   Kit.daktilo.sesler = { vurus, kayis, zil, cekme }  (Web Audio sentezi)
// Font: Courier Prime (kit/daktilo.css, ../assets/fonts/). Yükleme: kit/kalem.js → kit/ses.js → … → kit/daktilo.js
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const KL = () => Kit.kalem;
  const NS = 'http://www.w3.org/2000/svg';
  const SERIT = { siyah: '#262321', kirmizi: '#b02a24' };
  const ADIM = 0.6;              // Courier Prime: her karakter 0.6 em
  const BUYUK_YARI = 0.29;       // büyük harf yüksekliğinin yarısı (em)

  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    if (oz) for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  /* ---------- svg başına tanımlar: mürekkep süzgeci ve baskı gradyanları ---------- */

  let svgNo = 0;
  function tanimlar(svg) {
    if (svg._daktilo) return svg._daktilo;
    const no = ++svgNo, on = 'dk' + no;
    const defs = el('defs', { class: 'daktilo' });
    svg.insertBefore(defs, svg.firstChild);
    // Mürekkep: kenarı çok hafif pürüzlü (yer değiştirme), şerit dokusu kadar yayılmış (bulanıklık), yer yer eksik (benek).
    const f = el('filter', { id: on + 'm', x: '-25%', y: '-25%', width: '150%', height: '150%', 'color-interpolation-filters': 'sRGB' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .07, numOctaves: 1, seed: 11 + no, result: 'd' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'd', scale: 1.1, xChannelSelector: 'R', yChannelSelector: 'G', result: 'k' }, f);
    el('feGaussianBlur', { in: 'k', stdDeviation: .32, result: 'b' }, f);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .9, numOctaves: 2, seed: 3 + no, result: 'n' }, f);
    el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.4 0 0 0 -0.62', result: 'a' }, f);
    el('feComposite', { in: 'b', in2: 'a', operator: 'in' }, f);
    svg._daktilo = { defs, on, suzgec: on + 'm', gradyan: {} };
    return svg._daktilo;
  }

  // Bir kenarı açık basılmış harf (şerit ya da harf kolu eğik vurmuş): objectBoundingBox gradyanı, renk + yön başına bir kez.
  const YONLER = { ust: [0, 0, 0, 1], alt: [0, 1, 0, 0], sol: [0, 0, 1, 0], sag: [1, 0, 0, 0] };
  function gradyan(t, renk, yon) {
    const id = `${t.on}g-${yon}-${renk.slice(1)}`;
    if (!t.gradyan[id]) {
      const [x1, y1, x2, y2] = YONLER[yon];
      const g = el('linearGradient', { id, x1, y1, x2, y2 }, t.defs);
      el('stop', { offset: 0, 'stop-color': renk, 'stop-opacity': .42 }, g);
      el('stop', { offset: .55, 'stop-color': renk, 'stop-opacity': .9 }, g);
      el('stop', { offset: 1, 'stop-color': renk, 'stop-opacity': 1 }, g);
      t.gradyan[id] = true;
    }
    return `url(#${id})`;
  }

  /* ---------- tek harf ---------- */

  const ortaTaban = (cy, boyut) => cy + boyut * BUYUK_YARI;

  function harf(katman, ch, o = {}) {
    const k = KL();
    const svg = katman.ownerSVGElement || katman;
    const t = tanimlar(svg);
    const r = k.rastgele('daktilo', ...(o.tohum || [ch, o.x, o.y]));
    const boyut = o.boyut || 26;
    const renk = SERIT[o.serit || 'siyah'] || o.serit;
    const dx = k.aralik(r, -.5, .5), dy = k.aralik(r, -1, 1), aci = k.aralik(r, -1, 1);
    const g = el('g', {
      class: 'daktilo-harf',
      transform: `translate(${(o.x + dx).toFixed(2)} ${(o.y + dy).toFixed(2)}) rotate(${aci.toFixed(2)})`,
      filter: `url(#${t.suzgec})`,
    }, katman);
    const metin = el('text', { x: 0, y: 0, 'font-size': boyut, 'text-anchor': 'middle' }, g);
    metin.textContent = ch;
    const koyu = o.kalin ?? r() < .1;                         // daha koyu vurulmuş harf
    const z = r();
    if (koyu) {
      metin.setAttribute('fill', renk);
      metin.setAttribute('stroke', renk);
      metin.setAttribute('stroke-width', (boyut * .016).toFixed(2));
    } else if (z < .42) {
      metin.setAttribute('fill', gradyan(t, renk, ['ust', 'alt', 'sol', 'sag'][Math.floor(r() * 4)]));
    } else {
      metin.setAttribute('fill', renk);
      metin.setAttribute('fill-opacity', k.aralik(r, .8, .97).toFixed(2));
    }

    let bitti = Promise.resolve(), sure = 0;
    if (!o.anlik && k.animasyonVar()) {
      const ms = o.vurusMs || 60;
      metin.style.transformBox = 'fill-box';
      metin.style.transformOrigin = '50% 60%';
      const a = metin.animate([
        { transform: 'scale(1.08)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1, offset: .55 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: ms, delay: o.gecikme || 0, easing: 'cubic-bezier(.3,0,.6,1)', fill: 'backwards' });
      // Mürekkep oturması: ilk an daha koyu ve keskin, 200 ms'de yerine oturur
      const b = g.animate([{ filter: 'none' }, { filter: 'none', offset: .3 }, { filter: `url(#${t.suzgec})` }],
        { duration: 240, delay: o.gecikme || 0 });
      bitti = Promise.all([a.finished, b.finished]).then(() => {}, () => {});
      sure = ms;
    }
    return { node: g, metin, bitti, sure };
  }

  /* ---------- satır ---------- */

  function yaz(katman, yazi, o = {}) {
    const k = KL();
    const boyut = o.boyut || 18, adim = boyut * (o.adim || ADIM);
    const karakterler = Array.from(String(yazi));
    const genislik = karakterler.length * adim;
    const hiza = o.hiza || 'sol';
    const x0 = hiza === 'orta' ? o.x - genislik / 2 : hiza === 'sag' ? o.x - genislik : o.x;
    const g = el('g', { class: 'daktilo-satir', 'aria-hidden': 'true' }, katman);
    const r = k.rastgele('daktilo-ritim', ...(o.tohum || [yazi]));
    const harfler = [], bit = [];
    let t = o.gecikme || 0;
    const hareket = !o.anlik && k.animasyonVar();
    karakterler.forEach((ch, i) => {
      if (ch.trim()) {
        const h = harf(g, ch, { x: x0 + adim * (i + .5), y: o.y, boyut, serit: o.serit, anlik: o.anlik, gecikme: t,
          tohum: [...(o.tohum || [yazi]), i] });
        harfler.push(h); bit.push(h.bitti);
        if (o.ses && hareket && Kit.ses) Kit.ses.cal('vurus', t, i);
      }
      if (hareket) t += (o.aralikMs ?? 70) * k.aralik(r, .7, 1.4);
    });
    return { node: g, harfler, bitti: Promise.all(bit), sure: hareket ? t - (o.gecikme || 0) : 0, genislik };
  }

  /* ---------- HTML metin ---------- */

  // Kit.kalem.harfle'nin daktilo karşılığı: harf başına span, tohumlu kayma, dönme, yoğunluk. Kelimeler bölünmez.
  function metin(kap, yazi, o = {}) {
    const k = KL();
    yazi = yazi ?? kap.textContent.trim();
    kap.textContent = '';
    kap.classList.add('daktilo');
    if (o.serit === 'kirmizi') kap.classList.add('kirmizi-serit');
    const dugme = kap.closest('button, a, [role="button"]');
    if (dugme && dugme !== kap) dugme.setAttribute('aria-label', dugme.dataset.etiket || yazi);
    else {
      const okunan = document.createElement('span');
      okunan.className = 'gizli';
      okunan.textContent = yazi;
      kap.appendChild(okunan);
    }
    const r = k.rastgele('daktilo-html', ...(o.tohum || [yazi]));
    const harfler = [];
    yazi.split(' ').forEach((kelime, ki) => {
      if (ki) kap.appendChild(document.createTextNode(' '));
      const s = document.createElement('span');
      s.className = 'kelime';
      s.setAttribute('aria-hidden', 'true');
      for (const ch of kelime) {
        const h = document.createElement('span');
        h.className = 'dh' + (r() < .1 ? ' koyu' : '');
        h.textContent = ch;
        h.style.transform = `translate(${k.aralik(r, -.4, .4).toFixed(2)}px, ${k.aralik(r, -.9, .9).toFixed(2)}px) rotate(${k.aralik(r, -1, 1).toFixed(2)}deg)`;
        h.style.opacity = k.aralik(r, .78, 1).toFixed(2);
        s.appendChild(h);
        harfler.push(h);
      }
      kap.appendChild(s);
    });
    const bit = [];
    let sure = 0;
    if (!o.anlik && k.animasyonVar()) {
      const adim = o.aralikMs ?? 45;
      harfler.forEach((h, i) => {
        const a = h.animate([{ opacity: 0, scale: 1.08 }, { opacity: h.style.opacity, scale: 1 }],
          { duration: 60, delay: (o.gecikme || 0) + i * adim, fill: 'backwards' });
        bit.push(a.finished.then(() => {}, () => {}));
        sure = i * adim + 60;
      });
    }
    return { node: kap, bitti: Promise.all(bit), sure };
  }

  /* ---------- sesler: Web Audio sentezi (dosya yok). Müzik, jingle, kutlama yok. ---------- */

  const S = () => Kit.ses;
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;

  const sesler = {
    // Tuş vuruşu: tuşun inişi (tok) + harf kolunun savrulması (kısa hışırtı) + kâğıda darbe (keskin çıt + merdane).
    vurus(c, h, t0) {
      const p = sapma(.08), g = sapma(.15);
      S().nota(c, h, t0, 'sine', 170 * p, 95 * p, .05, .2 * g);
      S().parazit(c, h, t0 + .006, 'bandpass', 1300 * p, 2600 * p, .7, .028, .05 * g);
      const d = t0 + .026 + Math.random() * .006;
      S().parazit(c, h, d, 'bandpass', 3700 * p, 2500 * p, 1.6, .02, .5 * g);
      S().nota(c, h, d, 'triangle', 980 * p, 640 * p, .022, .08 * g);
      S().nota(c, h, d + .002, 'sine', 125 * p, 70 * p, .07, .28 * g);
    },
    // Satır başı kayışı: şaryo geri kayar (uzun hışırtı + cırcır), sonda tok durma.
    kayis(c, h, t0) {
      S().parazit(c, h, t0, 'bandpass', 900, 320, .6, .3, .13);
      for (let i = 0; i < 6; i++) S().parazit(c, h, t0 + .02 + i * .038, 'highpass', 3200, 2600, .8, .012, .07);
      S().nota(c, h, t0 + .3, 'sine', 150, 80, .09, .24);
      S().parazit(c, h, t0 + .3, 'lowpass', 900, 300, .8, .05, .12);
    },
    // Satır başı zili: tek, kısa çan (melodi değil)
    zil(c, h, t0) {
      S().nota(c, h, t0, 'sine', 2637, 2630, 1, .1);
      S().nota(c, h, t0, 'sine', 5274, 5260, .45, .03);
      S().nota(c, h, t0, 'sine', 3951, 3945, .6, .035);
    },
    // Kâğıdı makineden çekme: merdane cırcırı (10 tık) + kâğıt kayması
    cekme(c, h, t0) {
      for (let i = 0; i < 10; i++) {
        const t = t0 + i * .042 + Math.random() * .006;
        S().parazit(c, h, t, 'bandpass', 2600, 2100, 2, .012, .12);
        S().nota(c, h, t, 'square', 1700, 1150, .008, .025);
      }
      S().parazit(c, h, t0, 'lowpass', 1300, 500, .7, .45, .05);
    },
  };

  Kit.daktilo = { SERIT, ADIM, tanimlar, harf, yaz, metin, ortaTaban, sesler };
})();
