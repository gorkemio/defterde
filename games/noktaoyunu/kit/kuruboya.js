// kit/kuruboya.js — "kuru boya" boya katmanı. Hangi oyun olduğunu bilmez; kalem malzemesinden bağımsızdır
// (çizgiler kurşun kalem, tükenmez ya da keçeli olabilir; boya onların üstüne sürülür ve altındakiyle çarpılır).
//
//   Kit.kuruboya.kur({ palet: 'yesil-turuncu' })          // <html data-boya="kuruboya">, palet seçimi
//   const g = Kit.kuruboya.katman(svg, ebeveyn, 'kutular') // tane maskeli, multiply boya katmanı (bir kez)
//   Kit.kuruboya.karala(K, g, { x, y, w, h }, { renk: 0, tohum: ['kutu', id, k] })   // kutuyu karala
//   Kit.kuruboya.yaz(g, 'S', { x, y, boyut: 22, renk: 0, bastir: .35 })              // kuru boyayla yazı
//   Kit.kuruboya.ustunuCiz(K, g, bbox, { renk })   ·   Kit.kuruboya.tik(K, g, x, y, { renk: 'tehlike' })
//
// Sesler (kit/ses.js varsa kur() ekler): karalama (mumsu, uzun, arg = süre ms), cizik (baş harf).
// Görünüm: rough.js zigzag/hachure dolgusu, kalın (3.4–4.4 birim) ve yarı saydam darbeler (üst üste binince koyulaşır);
// kâğıdın dişleri: tohumlu gürültüden bir kez üretilen tane maskesi (canvas → PNG desen; feTurbulence her karede
// pahalıydı). Her kutu tohumla farklı açı, aralık, taşma ve ikinci geçiş alır. Renk: 0/1 paletin iki rengi ya da hex.
// Yükleme: kit/kalem.js → [kit/ses.js] → [kit/malzeme.js → kalem malzemesi] → kit/kuruboya.js; CSS: kit/kuruboya.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl, animasyonVar } = KL;

  const PALET = {
    'yesil-turuncu': ['#2e8b57', '#e8842a'],
    'mor-sari': ['#6a4c93', '#e2b23a'],
  };
  const TEHLIKE = '#c4452f';
  let paletAd = 'yesil-turuncu';

  const renk = (r) => (typeof r === 'number' ? PALET[paletAd][r] : r === 'tehlike' ? TEHLIKE : (r || PALET[paletAd][0]));

  // Bastırılmış kuru boya: renk siyaha doğru k kadar koyulaşır (0–1)
  function koyu(hex, k) {
    const n = parseInt(String(hex).slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - k)).toString(16).padStart(2, '0')).join('');
  }

  function kur(o = {}) {
    if (o.palet) palet(o.palet);
    if (typeof document !== 'undefined') document.documentElement.dataset.boya = 'kuruboya';
    if (Kit.ses && o.ses !== false) Object.assign(Kit.ses.sentez, SESLER);
    return Kit.kuruboya;
  }
  function palet(ad) {
    if (!PALET[ad]) throw new Error('Bilinmeyen palet: ' + ad);
    paletAd = ad;
    if (typeof document !== 'undefined') {
      const st = document.documentElement.style;
      st.setProperty('--kuruboya-1', PALET[ad][0]);
      st.setProperty('--kuruboya-2', PALET[ad][1]);
    }
    return PALET[ad];
  }

  /* ---------- tane: kâğıdın dişleri ---------- */

  // 160×160 dikişsiz gri gürültü: ince diş (3×3 bulanık beyaz gürültü) + iri basınç farkı (8×8 yumuşak değer gürültüsü),
  // yumuşak eşik. Beyaz = boya tutar, siyah = boyanın değmediği kâğıt. Tohumlu: her açılışta aynı.
  const TANE = 160, DESEN = 104;            // resim pikseli · desenin birim boyu (~1 px'lik diş)
  let taneURL;
  function taneResmi() {
    if (taneURL !== undefined) return taneURL;
    taneURL = null;
    try {
      const N = TANE, r = rastgele('kuruboya', 'tane');
      const ham = new Float32Array(N * N);
      for (let i = 0; i < ham.length; i++) ham[i] = r();
      const G = 8, iri = new Float32Array(G * G);
      for (let i = 0; i < iri.length; i++) iri[i] = r();
      const yum = (f) => f * f * (3 - 2 * f);
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const x2 = c.getContext('2d'), img = x2.createImageData(N, N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += ham[((y + dy + N) % N) * N + (x + dx + N) % N];
          const gx = x / N * G, gy = y / N * G, i0 = Math.floor(gx), j0 = Math.floor(gy);
          const fx = yum(gx - i0), fy = yum(gy - j0), i1 = (i0 + 1) % G, j1 = (j0 + 1) % G;
          const a = iri[j0 * G + i0] + (iri[j0 * G + i1] - iri[j0 * G + i0]) * fx;
          const b = iri[j1 * G + i0] + (iri[j1 * G + i1] - iri[j1 * G + i0]) * fx;
          const v = .86 * (s / 9) + .14 * (a + (b - a) * fy);
          const L = Math.round(255 * Math.min(1, Math.max(0, (v - .355) / .12)));
          const k = (y * N + x) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = L;
          img.data[k + 3] = 255;
        }
      }
      x2.putImageData(img, 0, 0);
      taneURL = c.toDataURL('image/png');
    } catch (e) { /* canvas yok: boya tanesiz kalır */ }
    return taneURL;
  }

  let svgNo = 0;
  // svg başına bir kez: tane deseni + maske (kullanıcı birimiyle sayfaya sabit; boya eklendikçe tane kaymaz)
  function tanimlar(svg) {
    const t = svg._kuruboya;
    if (t && t.defs.isConnected) return t;
    const url = taneResmi();
    const no = ++svgNo, vb = svg.viewBox && svg.viewBox.baseVal;
    const W = vb && vb.width ? vb.width : 4000, H = vb && vb.height ? vb.height : 4000, x0 = vb ? vb.x : 0, y0 = vb ? vb.y : 0;
    const defs = svgEl('defs', { class: 'kuruboya-tanim' });
    svg.insertBefore(defs, svg.firstChild);
    let maske = null;
    if (url) {
      const desen = svgEl('pattern', { id: 'kbd' + no, patternUnits: 'userSpaceOnUse', width: DESEN, height: DESEN }, defs);
      svgEl('image', { href: url, x: 0, y: 0, width: DESEN, height: DESEN, preserveAspectRatio: 'none' }, desen);
      maske = 'kbm' + no;
      const m = svgEl('mask', { id: maske, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: x0 - 60, y: y0 - 60, width: W + 120, height: H + 120 }, defs);
      svgEl('rect', { x: x0 - 60, y: y0 - 60, width: W + 120, height: H + 120, fill: `url(#kbd${no})` }, m);
    }
    return (svg._kuruboya = { defs, maske });
  }

  // Boya katmanı: tane maskeli, altındakiyle çarpılan <g>. ad: ek sınıf.
  function katman(svg, ebeveyn, ad) {
    const t = tanimlar(svg);
    const g = svgEl('g', { class: 'kuruboya' + (ad ? ' ' + ad : '') }, ebeveyn || svg);
    if (t.maske) g.setAttribute('mask', `url(#${t.maske})`);
    return g;
  }

  // Bir çizimin kalem izlerine tohumlu saydamlık (kuru boya darbesi üst üste binince koyulaşır)
  function saydam(node, r, a, b) {
    for (const p of node.querySelectorAll('path')) {
      const s = p.getAttribute('stroke');
      if (s && s !== 'none') p.setAttribute('stroke-opacity', aralik(r, a, b).toFixed(2));
    }
  }

  /* ---------- karalama ---------- */

  // Kutuyu kuru boyayla karalar. kutu: { x, y, w, h } (birim). o: { renk (0 · 1 · hex), tohum: [...], gecikme, anlik,
  // sureMs (toplam, varsayılan 250), tasma: [en az, en çok] kenar ötelemesi (birim; darbe yarı kalınlığı ayrıca taşar) }
  function karala(K, katmanG, kutu, o = {}) {
    const an = o.tohum || ['kutu', kutu.x, kutu.y];
    const r = rastgele('karala', ...an);
    const c = renk(o.renk ?? 0);
    const [ta, tb] = o.tasma || [-1.6, -.2];
    const { x, y, w, h } = kutu;
    const yan = () => aralik(r, ta, tb), kose = () => aralik(r, 1.5, 4.5);
    const u = yan(), s = yan(), a = yan(), l = yan();
    const cokgen = (i) => [                                 // köşeleri biraz kesik: el köşeye tam girmez
      [x - l + i + kose(), y - u + i], [x + w + s - i - kose(), y - u + i], [x + w + s - i, y - u + i + kose()],
      [x + w + s - i, y + h + a - i - kose()], [x + w + s - i - kose(), y + h + a - i], [x - l + i + kose(), y + h + a - i],
      [x - l + i, y + h + a - i - kose()], [x - l + i, y - u + i + kose()],
    ];
    const g = svgEl('g', { class: 'kutu-boya' }, katmanG);
    const toplam = (o.sureMs && o.sureMs[0]) || 250;
    const ikinci = r() < .55;
    const aci = (r() < .5 ? 1 : -1) * aralik(r, 18, 72);
    const t1 = ikinci ? toplam * .74 : toplam;
    const z = r() < .72;
    const s1 = K.cokgen(g, cokgen(0), {
      stroke: 'none', fill: c, fillStyle: z ? 'zigzag' : 'hachure', hachureAngle: aci,
      hachureGap: aralik(r, 3.5, 4.7), fillWeight: aralik(r, 3.4, 4.4),
      roughness: aralik(r, .85, 1.25), bowing: aralik(r, .5, 1.1), disableMultiStroke: true, disableMultiStrokeFill: r() < .6,
    }, ['kuruboya', ...an, 1], { gecikme: o.gecikme, anlik: o.anlik, sureMs: [t1, t1], baski: false });
    saydam(s1.node, r, .5, .64);
    const bit = [s1.bitti];
    let sure = s1.sure;
    if (ikinci) {                                           // seyrek ikinci geçiş, çapraz yönde
      const s2 = K.cokgen(g, cokgen(1.6), {
        stroke: 'none', fill: c, fillStyle: 'hachure', hachureAngle: aci + aralik(r, 70, 110),
        hachureGap: aralik(r, 6.5, 9.5), fillWeight: aralik(r, 2.2, 3), roughness: 1.5, bowing: 1.2,
        disableMultiStroke: true, disableMultiStrokeFill: true,
      }, ['kuruboya', ...an, 2], { gecikme: (o.gecikme || 0) + t1 * .9, anlik: o.anlik, sureMs: [toplam * .3, toplam * .3], baski: false });
      saydam(s2.node, r, .32, .44);
      bit.push(s2.bitti);
      sure = Math.max(sure, t1 * .9 + s2.sure);
    }
    return { node: g, bitti: Promise.all(bit), sure };
  }

  /* ---------- yazı ---------- */

  // Kuru boyayla yazı: el yazısı (Kit.kalem.metinSvg) + aynı renkte kontur (mumlu, kalın harf), harf harf belirir.
  // o: metinSvg seçenekleri + { renk (0 · 1 · hex), bastir (0–1: koyulaşma), kalinlik (kontur, birim) }
  function yaz(katmanG, metin, o = {}) {
    const c0 = renk(o.renk ?? 0), c = o.bastir ? koyu(c0, o.bastir) : c0;
    const t = KL.metinSvg(katmanG, metin, Object.assign({}, o, { renk: c, sinif: 'kuruboya-yazi', anlik: true }));
    const n = t.node;
    n.setAttribute('stroke', c);
    n.setAttribute('stroke-width', (o.kalinlik ?? (o.boyut || 26) * .05).toFixed(2));
    const r = rastgele('kuruboya-yazi', ...(o.tohum || [metin]));
    const harfler = Array.from(n.querySelectorAll('tspan'));
    harfler.forEach(ts => {
      const h = aralik(r, .8, .92).toFixed(2);
      ts.setAttribute('fill-opacity', h);
      ts.setAttribute('stroke-opacity', h);
    });
    const bit = [];
    let sure = 0;
    if (animasyonVar() && !o.anlik) {
      const adim = o.adim ?? 45;
      harfler.forEach((ts, i) => {
        const h = parseFloat(ts.getAttribute('fill-opacity'));
        const an = ts.animate([{ fillOpacity: 0, strokeOpacity: 0 }, { fillOpacity: h, strokeOpacity: h }],
          { duration: 120, delay: (o.gecikme || 0) + i * adim, fill: 'both' });
        bit.push(an.finished.then(() => an.cancel(), () => {}));
        sure = i * adim + 120;
      });
    }
    return { node: n, bitti: Promise.all(bit), sure };
  }

  // Eski bir yazının (puan) üstüne birkaç kalın, yarı saydam kuru boya darbesi. bbox: { x, y, w, h }
  function ustunuCiz(K, katmanG, bbox, o = {}) {
    const an = o.tohum || ['ustu', Math.round(bbox.x), Math.round(bbox.y)];
    const r = rastgele('ustu', ...an);
    const w = Math.max(bbox.w, bbox.h * .7), x = bbox.x + (bbox.w - w) / 2, y = bbox.y + bbox.h * .36, h = bbox.h * .32;
    const pts = [
      [x - aralik(r, 1.5, 3.5), y + h * aralik(r, .5, .8)], [x + w * aralik(r, .3, .4), y + h * aralik(r, 0, .25)],
      [x + w * aralik(r, .45, .55), y + h * aralik(r, .75, 1)], [x + w * aralik(r, .72, .82), y + h * aralik(r, 0, .25)],
      [x + w + aralik(r, 1.5, 4), y + h * aralik(r, .45, .75)],
    ];
    const s = K.egri(katmanG, pts, { stroke: renk(o.renk ?? 0), strokeWidth: o.kalinlik || 2.6, roughness: 1.2, bowing: 1, disableMultiStroke: true },
      ['ustu', ...an], { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs || [170, 210], baski: false });
    saydam(s.node, r, .6, .74);
    return s;
  }

  // Küçük tik (✓): uyarı işareti. o: { renk (varsayılan 'tehlike'), boyut (birim), opak, tohum, anlik }
  function tik(K, katmanG, x, y, o = {}) {
    const an = o.tohum || ['tik', Math.round(x), Math.round(y)];
    const r = rastgele('tik', ...an), b = o.boyut || 7, c = renk(o.renk || 'tehlike');
    const g = svgEl('g', { class: 'tik', opacity: (o.opak ?? .34).toFixed(2) }, katmanG);
    const dx = aralik(r, -.6, .6), dy = aralik(r, -.6, .6);
    const ek = { stroke: c, strokeWidth: o.kalinlik || 2.2, roughness: .9, bowing: .6, disableMultiStroke: true };
    const oo = { anlik: o.anlik !== false, baski: false, gecikme: o.gecikme };
    K.cizgi(g, [x - b * .5 + dx, y - b * .05 + dy, x - b * .1 + dx, y + b * .42 + dy], ek, ['tik', ...an, 1], oo);
    K.cizgi(g, [x - b * .1 + dx, y + b * .42 + dy, x + b * .62 + dx, y - b * .55 + dy], ek, ['tik', ...an, 2], oo);
    return g;
  }

  /* ---------- sesler: Web Audio ile sentez (dosya yok). Melodi yok; mumsu, boğuk, kısık. ---------- */

  // Kuru boya karalaması: kâğıtta ileri geri sürtülen mum. Tanecikli gürültü (kâğıdın dişleri), alçak geçiren süzgeç
  // (mum boğuk), genliği 11–15 Hz ile dalgalanır (el ileri geri), her darbenin sonunda hafif yükselen tını.
  // arg: karalama süresi (ms). Kit.ses.sentez'e kur() ile eklenir.
  function karalama(c, h, t0, arg) {
    const sure = Math.max(.22, Math.min(.45, (Number(arg) || 250) / 1000 + .04));
    const n = Math.ceil(c.sampleRate * (sure + .05)), b = c.createBuffer(1, n, c.sampleRate), v = b.getChannelData(0);
    const hiz = 11 + Math.random() * 4, faz = Math.random() * Math.PI, adim = Math.floor(c.sampleRate * .004);
    let g = .6;
    for (let i = 0; i < n; i++) {
      if (i % adim === 0) g = .45 + Math.random() * .55;
      const t = i / c.sampleRate, salinim = .35 + .65 * Math.abs(Math.sin(Math.PI * hiz * t + faz));
      v[i] = (Math.random() * 2 - 1) * g * salinim;
    }
    const kaynak = c.createBufferSource();
    kaynak.buffer = b;
    const alcak = c.createBiquadFilter();
    alcak.type = 'lowpass'; alcak.Q.value = .8;
    alcak.frequency.setValueAtTime(900 + Math.random() * 200, t0);
    alcak.frequency.linearRampToValueAtTime(520, t0 + sure);
    const tepe = c.createBiquadFilter();
    tepe.type = 'peaking'; tepe.frequency.value = 1700; tepe.Q.value = 1.1; tepe.gain.value = 4;
    const z = c.createGain();
    z.gain.setValueAtTime(0.0001, t0);
    z.gain.linearRampToValueAtTime(.32, t0 + .025);
    z.gain.setValueAtTime(.28, t0 + sure * .75);
    z.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    kaynak.connect(alcak); alcak.connect(tepe); tepe.connect(z); z.connect(h);
    kaynak.start(t0); kaynak.stop(t0 + sure + .05);
  }

  // Baş harf: kısa, boğuk çizik (mumlu uç kâğıda bastırılıp çekilir)
  function cizik(c, h, t0) {
    if (!Kit.ses) return;
    const p = 1 + (Math.random() * 2 - 1) * .1;
    Kit.ses.parazit(c, h, t0, 'bandpass', 1500 * p, 900 * p, 1.1, .075, .22);
    Kit.ses.parazit(c, h, t0 + .05, 'bandpass', 1200 * p, 800 * p, 1.3, .05, .12);
  }

  const SESLER = { karalama, cizik };

  Kit.kuruboya = { PALET, TEHLIKE, kur, palet, renk, koyu, katman, karala, yaz, ustunuCiz, tik, taneResmi, sesler: SESLER };
})();
