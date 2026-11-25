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

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('kursunkalem', {
    cizim: { roughness: .65, bowing: .5, strokeWidth: 1.5, fillWeight: .7, sureMs: [220, 380], animasyon: true },
    renk: { ana: GRAFIT, vurgu: KIRMIZI_KURSUN, kursun: GRAFIT, mavi: GRAFIT, kirmizi: KIRMIZI_KURSUN, kagit: '#fbf9f2' },
    yazi: { aile: 'Kalam', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, bitir },
    silgiIzi,
    ses: {},                 // taş, kayma, grafit — Faz 6'da
    sesSeviye: 0.35,
    karakter: false,
  });
})();
