// kit/kursunkalem.js — "kurşun kalem" malzemesi. Hangi oyun olduğunu bilmez.
// Grafit grisi, cetvelle çizilmiş gibi az titrek çizgi; baskı çizgi boyunca değişir, yer yer kalem iki kez geçer.
// Vurgu kırmızı kurşun kalem. Silgi izi: silinen çizginin yerinde açık leke + birkaç kırıntı, sonra solar.
// Karakter yok. Sesler (taş, kayma, grafit) bu dosyada tanımlanır.
// Yükleme: kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/kursunkalem.js; CSS: kit/kursunkalem.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl, animasyonVar } = KL;

  const GRAFIT = '#4a4a4a', KIRMIZI_KURSUN = '#b4382e';

  /* ---------- baskı: kalem izini işleme ---------- */

  // Rough seçeneği: çoğu çizgi tek geçiş (cetvelle, kalem kâğıda bir kez sürülür); %35'inde ikinci geçiş kalır.
  function secenek(s, anahtar, ek) {
    const r = rastgele('kursun', ...anahtar);
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = !(r() < .35);
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.roughness === undefined) s.roughness = Math.max(.2, s.roughness + aralik(r, -.1, .1));
    return s;
  }

  let gradyanNo = 0;
  function tanimlar(svg) {
    let d = svg.querySelector(':scope > defs.kursun');
    if (!d) { d = svgEl('defs', { class: 'kursun' }); svg.insertBefore(d, svg.firstChild); }
    return d;
  }

  // Her kalem izine tohumlu opaklık (baskı farkı); uzun çizgilerde opaklık çizgi boyunca da değişir (gradyan).
  // o.baski === false: dokunma. Dolgulu şekiller (fill) olduğu gibi kalır.
  function bitir(g, anahtar, o) {
    if (o.baski === false) return;
    const r = rastgele('baski', ...anahtar);
    const svg = g.ownerSVGElement;
    for (const p of g.querySelectorAll('path')) {
      const dolgu = p.getAttribute('fill');
      const renk = p.getAttribute('stroke');
      if ((dolgu && dolgu !== 'none') || !renk || renk === 'none') continue;
      const op = aralik(r, .75, .95);
      let L = 0;
      try { L = p.getTotalLength(); } catch (e) { /* görünmeyen svg */ }
      if (L > 80 && svg) {
        const a = p.getPointAtLength(0), b = p.getPointAtLength(L);
        const id = 'kb' + (++gradyanNo);
        const gr = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, tanimlar(svg));
        [0, aralik(r, .3, .7), 1].forEach((ofs, i) => svgEl('stop', {
          offset: ofs.toFixed(2), 'stop-color': renk,
          'stop-opacity': (i === 1 ? aralik(r, .82, .97) : aralik(r, .68, .9)).toFixed(2),
        }, gr));
        p.setAttribute('stroke', `url(#${id})`);
      } else {
        p.setAttribute('stroke-opacity', op.toFixed(2));
      }
    }
  }

  /* ---------- silgi izi ---------- */

  // node: silinecek çizim (solar, kaldırılır; null olabilir). o: { noktalar: [x1, y1, x2, y2] (zorunlu), genislik,
  // solmaMs (iz ne kadar kalır, varsayılan 3000), kalici (hiç solmaz), tohum: [...], renk (silinen çizginin rengi) }
  // İz `katman`a (kâğıt) çizilir; kâğıdın kareleri ve marjı lekenin altında hafifçe açılır.
  function silgiIzi(katman, node, o = {}) {
    if (node) KL.soldur(node, 200);
    const [x1, y1, x2, y2] = o.noktalar;
    const an = o.tohum || o.noktalar.map(v => Math.round(v));
    const r = rastgele('silgi', ...an);
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
    const w = (o.genislik || 12) / 2, tas = 7;
    const g = svgEl('g', { class: 'silgi-izi', 'pointer-events': 'none' }, katman);
    const K = KL.kalemYap(katman.ownerSVGElement || katman);

    // Leke: çizgi boyunca hafif dalgalı, uçları yuvarlanmış açık bant (iki kat: yumuşak kenar)
    const bant = (yari, opak, ad) => {
      const pts = [];
      const adim = 6;
      for (let k = 0; k <= adim; k++) {
        const f = -tas + (L + 2 * tas) * k / adim, d = yari * aralik(r, .8, 1.15);
        pts.push([x1 + ux * f + nx * d, y1 + uy * f + ny * d]);
      }
      for (let k = adim; k >= 0; k--) {
        const f = -tas + (L + 2 * tas) * k / adim, d = yari * aralik(r, .8, 1.15);
        pts.push([x1 + ux * f - nx * d, y1 + uy * f - ny * d]);
      }
      const s = K.cokgen(g, pts, { stroke: 'none', fill: '#fffdf8', fillStyle: 'solid', roughness: .5 }, ['silgi', ad, ...an], { anlik: true, baski: false });
      s.node.setAttribute('opacity', opak);
      return s.node;
    };
    bant(w * 1.35, .3, 'dis');
    bant(w, .5, 'ic');

    // Kalan iz: silgi grafiti tam kaldırmaz
    const hayal = K.cizgi(g, [x1, y1, x2, y2], { stroke: o.renk || KIRMIZI_KURSUN, strokeWidth: 2, roughness: .9, disableMultiStroke: true },
      ['silgi', 'hayal', ...an], { anlik: true, baski: false });
    hayal.node.setAttribute('opacity', '.1');

    // Kırıntılar: yuvarlanmış, grafit bulaşmış küçük silgi parçaları
    const adet = 3 + Math.floor(r() * 4);
    for (let k = 0; k < adet; k++) {
      const f = aralik(r, -.05, 1.05) * L, d = aralik(r, -w - 6, w + 6);
      const cx = x1 + ux * f + nx * d, cy = y1 + uy * f + ny * d;
      svgEl('ellipse', {
        cx: cx.toFixed(1), cy: cy.toFixed(1), rx: aralik(r, 1.6, 3.2).toFixed(2), ry: aralik(r, .8, 1.4).toFixed(2),
        transform: `rotate(${(aralik(r, 0, 180)).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})`,
        fill: '#d4c9bf', stroke: 'rgba(70,64,58,.45)', 'stroke-width': .45,
      }, g);
    }

    let bitti = Promise.resolve();
    if (!o.kalici) {
      const sol = o.solmaMs ?? 3000;
      if (animasyonVar()) {
        const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, delay: sol, fill: 'forwards' });
        bitti = a.finished.then(() => g.remove(), () => g.remove());
      } else {
        bitti = new Promise(c => setTimeout(() => { g.remove(); c(); }, sol));
      }
    }
    return { node: g, bitti };
  }

  /* ---------- sesler: Web Audio ile sentez (dosya yok). Melodi, efekt, "başarı" sesi yok. ---------- */

  // c: AudioContext, h: hedef düğüm, t0: başlangıç (sn). Kit.ses.parazit(c, h, t0, tip, f0, f1, q, sure, tepe) gürültü,
  // Kit.ses.nota(c, h, t0, tur, f0, f1, sure, tepe) osilatör verir.
  const S = () => Kit.ses;
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;        // her seferinde küçük perde farkı

  // Gürültü kaynağı + filtre + elle zarf (kayma ve grafit için: uzun, yumuşak, tanecikli)
  function surtunme(c, h, t0, o) {
    const sure = o.sure, s = c.createBufferSource();
    const uz = Math.ceil(c.sampleRate * (sure + .05)), b = c.createBuffer(1, uz, c.sampleRate), v = b.getChannelData(0);
    // tanecik: gürültünün genliği küçük rastgele adımlarla oynar (kâğıt/çakıl pürüzü)
    let g = .6, adim = Math.floor(c.sampleRate * (o.tanecik || .006));
    for (let i = 0; i < uz; i++) {
      if (i % adim === 0) g = .35 + Math.random() * .65;
      v[i] = (Math.random() * 2 - 1) * g;
    }
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = o.tip; f.Q.value = o.q;
    f.frequency.setValueAtTime(o.f0, t0);
    f.frequency.linearRampToValueAtTime(o.f1, t0 + sure);
    const z = c.createGain();
    z.gain.setValueAtTime(0.0001, t0);
    z.gain.linearRampToValueAtTime(o.tepe, t0 + Math.min(.03, sure * .25));
    z.gain.setValueAtTime(o.tepe * .85, t0 + sure * .7);
    z.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    s.connect(f); f.connect(z); z.connect(h);
    s.start(t0); s.stop(t0 + sure + .05);
  }

  const SESLER = {
    // Taş konma: kısa, tok, hafif rezonanslı tıkırtı. arg: 'yigin' (alınan taşların üstüne düşerken biraz daha tiz)
    tas(c, h, t0, arg) {
      const p = sapma(.08) * (arg === 'yigin' ? 1.25 : 1);
      S().parazit(c, h, t0, 'bandpass', 3200 * p, 2400 * p, 2.2, .018, .55);        // temas tıkırtısı
      S().nota(c, h, t0, 'sine', 1150 * p, 1040 * p, .045, .12);                    // taşın kısa çınlaması
      S().nota(c, h, t0 + .002, 'sine', 210 * p, 150 * p, .07, .32);                // masanın tok cevabı
    },
    // Taş kayma: kâğıtta kısa sürtünme hışırtısı. arg: 'silgi' (silgi sürtmesi: biraz daha uzun, kalın),
    // 'sayfa' (defter sayfası çevrilirken kâğıdın uzun, yumuşak hışırtısı)
    kayma(c, h, t0, arg) {
      if (arg === 'sayfa') {
        surtunme(c, h, t0, { sure: .55, tip: 'bandpass', f0: 2600, f1: 700, q: .55, tepe: .16, tanecik: .018 });
        surtunme(c, h, t0 + .05, { sure: .4, tip: 'lowpass', f0: 900, f1: 300, q: .7, tepe: .1, tanecik: .03 });
        return;
      }
      const silgi = arg === 'silgi';
      surtunme(c, h, t0, { sure: silgi ? .22 : .16 * sapma(.15), tip: 'bandpass', f0: silgi ? 700 : 1300 * sapma(.1), f1: silgi ? 500 : 800, q: .9, tepe: silgi ? .2 : .26, tanecik: silgi ? .012 : .005 });
    },
    // Kalem çizgisi: yumuşak grafit sürtmesi. arg: çizginin süresi (ms)
    grafit(c, h, t0, arg) {
      const sure = Math.max(.12, Math.min(.45, (arg || 250) / 1000));
      surtunme(c, h, t0, { sure, tip: 'bandpass', f0: 1700 * sapma(.1), f1: 1400, q: .7, tepe: .12, tanecik: .004 });
      surtunme(c, h, t0, { sure: sure * .9, tip: 'highpass', f0: 3500, f1: 3000, q: .5, tepe: .04, tanecik: .003 });
    },
  };

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('kursunkalem', {
    cizim: { roughness: .65, bowing: .5, strokeWidth: 1.5, fillWeight: .7, sureMs: [220, 380], animasyon: true },
    renk: { ana: GRAFIT, vurgu: KIRMIZI_KURSUN, kursun: GRAFIT, mavi: GRAFIT, kirmizi: KIRMIZI_KURSUN, kagit: '#fbf9f2' },
    yazi: { aile: 'Kalam', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, bitir },
    silgiIzi,
    ses: SESLER,
    sesSeviye: 0.35,
    karakter: false,
  });
})();
