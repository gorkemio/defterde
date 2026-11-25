// kit/kopyakalemi.js — "kopya kalemi" malzemesi ve üç işaret. Hangi oyun olduğunu bilmez.
// Kopya kalemi: kuru çizgide gri-mor grafit; bastırılan yerde canlı mor (anilin boyası). Çizgi az titrek, tek ya da iki
// geçişli; uzun izlerde baskı çizgi boyunca değişir ve bir yerde mor canlanır.
// İşaretler (hepsi Kit.kalem.kalemYap(svg) çizicisiyle, { node, bitti, sure } döner):
//   Kit.kopyakalemi.tara(K, katman, { x, y, w, h }, { tohum, oyuk, bosluk: 2, bicim: 'kutu' | 'daire', gecikme, anlik })
//   Kit.kopyakalemi.cember(K, katman, { cx, cy, r }, o)       // uçları birbirine binen elle çizilmiş çember
//   Kit.kopyakalemi.ustunuCiz(K, katman, { x1, y1, x2, y2 }, o) // tek, hafif eğik, açık grafit çizgi
//   Kit.kopyakalemi.dalga(K, katman, { x1, x2, y }, o)        // altına dalgalı çizgi
// oyuk: taramanın açık bırakacağı düğüm (ör. daktilo harfi); taramayla aynı koordinat düzleminde olmalı. Çevresinde
// `bosluk` px tarama yapılmaz, harf her zaman okunur. Üç işaret biçimle ayrışır (dolgu / çevre / çizgi): gri tonlamada da.
// Yükleme: kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/kopyakalemi.js; CSS: kit/kopyakalemi.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl } = KL;

  const RENK = { grafit: '#5d4a7a', canli: '#6b3fb0', acik: '#958aa8' };

  /* ---------- baskı: kalem izini işleme ---------- */

  // Çizgilerin yarısında ikinci geçiş kalır (kutu köşelerinde çift çizgi); işaretler kendi seçeneğini verir.
  function secenek(s, anahtar, ek) {
    const r = rastgele('kopya', ...anahtar);
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = !(r() < .5);
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.roughness === undefined) s.roughness = Math.max(.2, s.roughness + aralik(r, -.15, .15));
    return s;
  }

  let gradyanNo = 0;
  function tanimlar(svg) {
    let d = svg.querySelector(':scope > defs.kopya');
    if (!d) { d = svgEl('defs', { class: 'kopya' }); svg.insertBefore(d, svg.firstChild); }
    return d;
  }
  const kalinlik = (p) => parseFloat(p.getAttribute('stroke-width')) || 1;

  // Çok parçalı tarama yolunu tek tek izlere böler (animasyonsuz çizimde de her iz kendi baskısını alsın).
  function bol(p) {
    const parcalar = (p.getAttribute('d') || '').split(/(?=M)/).map(s => s.trim()).filter(Boolean);
    if (parcalar.length <= 1) return [p];
    const liste = parcalar.map(d => { const q = p.cloneNode(false); q.setAttribute('d', d); p.parentNode.insertBefore(q, p); return q; });
    p.remove();
    return liste;
  }

  // Her ize tohumlu opaklık; uzun izlerde çizgi boyunca gradyan ve %35 olasılıkla bir "bastırılmış" canlı mor nokta.
  // Tarama izleri (ince dolgu kalınlığı) canlı morda kalır, yalnız opaklıkları oynar. o.baski === false: dokunma.
  function bitir(g, anahtar, o) {
    if (o.baski === false) return;
    const r = rastgele('kopya-baski', ...anahtar);
    const svg = g.ownerSVGElement;
    const cizim = KL.ayar.cizim;
    for (const p0 of Array.from(g.querySelectorAll('path'))) {
      const dolgu = p0.getAttribute('fill');
      const renk = p0.getAttribute('stroke');
      if ((dolgu && dolgu !== 'none') || !renk || renk === 'none' || renk.startsWith('url(')) continue;
      const tarama = Math.abs(kalinlik(p0) - cizim.fillWeight) < .05 && Math.abs(kalinlik(p0) - cizim.strokeWidth) > .05;
      if (tarama) {
        for (const p of bol(p0)) p.setAttribute('stroke-opacity', aralik(r, .62, 1).toFixed(2));
        continue;
      }
      let L = 0;
      try { L = p0.getTotalLength(); } catch (e) { /* görünmeyen svg */ }
      if (L > 70 && svg) {
        const a = p0.getPointAtLength(0), b = p0.getPointAtLength(L);
        const id = 'kk' + (++gradyanNo);
        const gr = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, tanimlar(svg));
        const bas = r() < .35 && renk === RENK.grafit ? aralik(r, .25, .75) : -1;   // renkler kit içinde küçük harfle yazılır
        [0, .25, .5, .75, 1].forEach((ofs) => {
          const canli = bas >= 0 && Math.abs(ofs - bas) < .2;
          svgEl('stop', {
            offset: ofs, 'stop-color': canli ? RENK.canli : renk,
            'stop-opacity': (canli ? aralik(r, .9, 1) : aralik(r, .7, .92)).toFixed(2),
          }, gr);
        });
        p0.setAttribute('stroke', `url(#${id})`);
      } else {
        p0.setAttribute('stroke-opacity', aralik(r, .74, .94).toFixed(2));
      }
    }
  }

  /* ---------- işaretler ---------- */

  let maskeNo = 0;
  // Taramanın harfi açık bırakması: beyaz zemin, üstünde harfin `bosluk` px kalınlaştırılmış siyah kopyası.
  function oyukMaskesi(svg, kutu, oyuk, bosluk) {
    const id = 'kko' + (++maskeNo);
    const p = 6;
    const m = svgEl('mask', { id, maskUnits: 'userSpaceOnUse', x: kutu.x - p, y: kutu.y - p, width: kutu.w + 2 * p, height: kutu.h + 2 * p }, tanimlar(svg));
    svgEl('rect', { x: kutu.x - p, y: kutu.y - p, width: kutu.w + 2 * p, height: kutu.h + 2 * p, fill: 'white' }, m);
    const kopya = oyuk.cloneNode(true);
    const boya = (e) => {
      e.removeAttribute('filter'); e.removeAttribute('style'); e.removeAttribute('opacity');
      if (e.getAnimations) e.getAnimations().forEach(a => a.cancel());
      if (e.tagName && /^(text|tspan|path|circle|ellipse|rect|polygon)$/i.test(e.tagName)) {
        e.setAttribute('fill', 'black'); e.setAttribute('fill-opacity', '1');
        e.setAttribute('stroke', 'black'); e.setAttribute('stroke-opacity', '1');
        e.setAttribute('stroke-width', 2 * bosluk); e.setAttribute('stroke-linejoin', 'round');
      }
    };
    boya(kopya);
    kopya.querySelectorAll('*').forEach(boya);
    m.appendChild(kopya);
    return id;
  }

  // İki yönlü yoğun tarama: kutunun içi bastırılmış canlı morla; harfin çevresi açık.
  function tara(K, katman, kutu, o = {}) {
    const an = o.tohum || ['tara', kutu.x, kutu.y];
    const r = rastgele('tara', ...an);
    const g = svgEl('g', { class: 'isaret tarama' }, katman);
    const svg = katman.ownerSVGElement || katman;
    if (o.oyuk) g.setAttribute('mask', `url(#${oyukMaskesi(svg, kutu, o.oyuk, o.bosluk ?? 2)})`);
    const ic = o.ic ?? Math.max(2, kutu.w * .07);
    const aci = aralik(r, 35, 55) * (r() < .5 ? 1 : -1);
    const sec = {
      stroke: 'none', fill: RENK.canli, fillStyle: 'cross-hatch',
      hachureGap: o.aralik ?? Math.max(2.6, kutu.w * .068), hachureAngle: aci,
      roughness: .9, disableMultiStrokeFill: true,
    };
    const ciz = { gecikme: o.gecikme, anlik: o.anlik };
    const s = o.bicim === 'daire'                                   // yuvarlak tuş başlığı gibi daire içi tarama
      ? K.elips(g, [kutu.x + kutu.w / 2, kutu.y + kutu.h / 2, kutu.w - 2 * ic, kutu.h - 2 * ic], sec, ['tara', ...an], ciz)
      : K.dikdortgen(g, [kutu.x + ic, kutu.y + ic, kutu.w - 2 * ic, kutu.h - 2 * ic], sec, ['tara', ...an], ciz);
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  // Elle çizilmiş çember: saat yönünün tersine ~1 tam tur + 20–35°; bitiş yarıçapı biraz büyük, uçlar üst üste biner.
  function cember(K, katman, c, o = {}) {
    const an = o.tohum || ['cember', c.cx, c.cy];
    const r = rastgele('cember', ...an);
    const g = svgEl('g', { class: 'isaret cember' }, katman);
    const a0 = aralik(r, -2.6, -1.2);
    const tur = Math.PI * 2 + aralik(r, .35, .6);
    const rx = c.r * aralik(r, 1, 1.07), ry = c.r * aralik(r, .93, 1);
    const egim = aralik(r, -.15, .15);
    const n = 16, pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, a = a0 - tur * f;
      const k = aralik(r, .985, 1.015) * (.97 + .09 * f);              // sonda dışa kaçar
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([c.cx + x * Math.cos(egim) - y * Math.sin(egim), c.cy + x * Math.sin(egim) + y * Math.cos(egim)]);
    }
    const s = K.egri(g, pts, {
      stroke: RENK.grafit, strokeWidth: o.kalinlik ?? 1.7, roughness: .55, bowing: .4, disableMultiStroke: true,
    }, ['cember', ...an], { gecikme: o.gecikme, anlik: o.anlik, sureMs: [260, 340] });
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  // Kelimede olmayan harf: üstünden tek, hafif eğik çizgi; açık grafit.
  function ustunuCiz(K, katman, c, o = {}) {
    const an = o.tohum || ['ciz', c.x1, c.y1];
    const g = svgEl('g', { class: 'isaret ustu-cizili' }, katman);
    const s = K.cizgi(g, [c.x1, c.y1, c.x2, c.y2], {
      stroke: o.renk || RENK.acik, strokeWidth: o.kalinlik ?? 1.5, roughness: .7, bowing: 1.2, disableMultiStroke: true,
    }, ['ciz', ...an], { gecikme: o.gecikme, anlik: o.anlik, sureMs: [110, 160] });
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  // Altına dalgalı çizgi (ör. "listede yok"): 6–7 px'te bir tepe, ±2 px.
  function dalga(K, katman, c, o = {}) {
    const an = o.tohum || ['dalga', c.x1, c.y];
    const r = rastgele('dalga', ...an);
    const g = svgEl('g', { class: 'isaret dalga' }, katman);
    const adim = o.adim ?? 6.5, gen = o.genlik ?? 2;
    const pts = [];
    for (let x = c.x1, i = 0; x <= c.x2 + .1; x += adim, i++) pts.push([x, c.y + (i % 2 ? gen : -gen) * aralik(r, .7, 1.15)]);
    const s = K.egri(g, pts, {
      stroke: o.renk || RENK.grafit, strokeWidth: o.kalinlik ?? 1.3, roughness: .4, bowing: .3, disableMultiStroke: true,
    }, ['dalga', ...an], { gecikme: o.gecikme, anlik: o.anlik, sureMs: [240, 420] });
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  /* ---------- sesler: Web Audio ile sentez (dosya yok). Melodi, efekt, "başarı" sesi yok. ---------- */

  const S = () => Kit.ses;
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;

  // Tanecikli sürtünme (kalem ucunun kâğıtta gezmesi): genliği küçük adımlarla oynayan süzgeçli gürültü
  function surtunme(c, h, t0, o) {
    const sure = o.sure, s = c.createBufferSource();
    const uz = Math.ceil(c.sampleRate * (sure + .05)), b = c.createBuffer(1, uz, c.sampleRate), v = b.getChannelData(0);
    let gen = .6;
    const adim = Math.max(1, Math.floor(c.sampleRate * (o.tanecik || .005)));
    for (let i = 0; i < uz; i++) {
      if (i % adim === 0) gen = .3 + Math.random() * .7;
      const zarf = o.vurus ? Math.abs(Math.sin(Math.PI * o.vurus * i / uz)) : 1;   // tarama: ileri geri darbeler
      v[i] = (Math.random() * 2 - 1) * gen * zarf;
    }
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = o.tip; f.Q.value = o.q;
    f.frequency.setValueAtTime(o.f0, t0);
    f.frequency.linearRampToValueAtTime(o.f1, t0 + sure);
    const z = c.createGain();
    z.gain.setValueAtTime(0.0001, t0);
    z.gain.linearRampToValueAtTime(o.tepe, t0 + Math.min(.02, sure * .2));
    z.gain.setValueAtTime(o.tepe * .85, t0 + sure * .75);
    z.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    s.connect(f); f.connect(z); z.connect(h);
    s.start(t0); s.stop(t0 + sure + .05);
  }

  const SESLER = {
    // Genel kalem çizgisi (kutu, altı çizgi). arg: süre (ms)
    kalem(c, h, t0, arg) {
      const sure = Math.max(.1, Math.min(.4, (arg || 220) / 1000));
      surtunme(c, h, t0, { sure, tip: 'bandpass', f0: 1900 * sapma(.1), f1: 1500, q: .8, tepe: .11, tanecik: .004 });
    },
    // Tarama: hızlı karalama, ileri geri 7–9 darbe
    tarama(c, h, t0) {
      surtunme(c, h, t0, { sure: .2 * sapma(.1), tip: 'bandpass', f0: 2300 * sapma(.08), f1: 1900, q: 1, tepe: .16, tanecik: .003, vurus: 8 });
    },
    // Çember: tek dönüş, süzgeç dönüş boyunca kayar
    cember(c, h, t0) {
      surtunme(c, h, t0, { sure: .24 * sapma(.08), tip: 'bandpass', f0: 1400 * sapma(.08), f1: 2300, q: .9, tepe: .12, tanecik: .005 });
    },
    // Üstünü çizme: tek kısa çizik
    cizik(c, h, t0) {
      surtunme(c, h, t0, { sure: .085, tip: 'bandpass', f0: 2600 * sapma(.1), f1: 1800, q: .9, tepe: .15, tanecik: .003 });
    },
  };

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('kopyakalemi', {
    cizim: { roughness: .95, bowing: .8, strokeWidth: 1.5, fillWeight: 1.05, sureMs: [180, 320], animasyon: true },
    renk: { ana: RENK.grafit, vurgu: RENK.canli, kursun: RENK.acik, mavi: RENK.grafit, kirmizi: RENK.canli, kagit: '#f3efe3' },
    // Bu malzemeyle yazılan metin daktiloyladır (kit/daktilo.js); el yazısı isteyen oyun Kit.kalem.ayarla ile değiştirir.
    yazi: { aile: 'Courier Prime', ornek: 'BEŞ HARF ğşıİçöü 0123456789' },
    isle: { secenek, bitir },
    silgiIzi: null,
    ses: SESLER,
    sesSeviye: 0.3,
    karakter: false,
  });

  Kit.kopyakalemi = { RENK, tara, cember, ustunuCiz, dalga, sesler: SESLER };
})();
