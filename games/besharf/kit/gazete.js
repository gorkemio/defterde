// kit/gazete.js — deftere bantla yapıştırılmış GAZETE KUPÜRÜ. Kâğıt/nesne katmanı (malzeme değil); hangi oyun olduğunu bilmez.
// Kupür basılı bir nesnedir: kenarı makasla kesilmiş, gazete kâğıdı rengi, raster nokta dokusu, hafif sararmış kenar,
// kâğıda düşen ince gölge. Hepsi düz SVG dolgusu (rough.js yok: kalemle çizilmiş değil). `.kupur` sınıfına filter/clip-path
// verilmez; kesik biçim, kupürün içinde arkaya konan bir SVG'dir.
//
//   const k = Kit.gazete.kur(el, { tohum: ['kupur', 7], bant: 2, yanik: 1 })   // el: .kupur; boyut değişince k.yenile()
//                                                                     // yanik: 0–2 köşe ya da [köşe…]; bantlı köşeler yanmaz
//   Kit.gazete.arka(el, { tohum, satir: 14 })                          // ters duran kupür: arka sayfanın ters, silik satırları
//   Kit.gazete.bant(el, { x, y, w, aci, tohum })                       // sarımsı yarı saydam bant parçası
//   Kit.gazete.kenar(w, h, tohum) → [[x, y], …]                        // makasla kesilmiş dikdörtgen
// Ses: Kit.gazete.sesler.hisirti (yeni bulmaca: gazete hışırtısı). Oyun Kit.ses.sentez'e ekler.
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

  // Makasla kesilmiş dikdörtgen: her kenar 2–4 uzun, düzce parça; kenar başına 0–2 küçük makas ısırığı; köşeler gönyesiz.
  function kenar(w, h, tohum, yanik) {
    const P = kesik(w, h, tohum);
    return yanik && yanik.length ? yak(P, w, h, tohum, yanik) : P;
  }
  // Yanık köşe: köşe dalgalı bir çeyrek elips yayıyla kopmuş gibi; P.yanik = [{ kose, yay: [[x, y]…], a, b }]
  // Köşe yakma kit/yanik.js'te (Kit.yanik.kose); yüklü değilse yanık çizilmez
  function yak(P, w, h, tohum, koseler, o) { return Kit.yanik ? Kit.yanik.kose(P, w, h, tohum, koseler, o) : P; }
  function kesik(w, h, tohum) {
    const r = KL().rastgele('kupur-kenar', ...(tohum || ['kupur']));
    const a = (x, y) => [x, y];
    const j = (v) => (r() * 2 - 1) * v;
    const koseler = [a(j(1.6), j(1.6)), a(w + j(1.6), j(1.6)), a(w + j(1.6), h + j(1.6)), a(j(1.6), h + j(1.6))];
    const P = [];
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = koseler[i], [x1, y1] = koseler[(i + 1) % 4];
      const L = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;           // dışa değil içe dönük normal (saat yönünde)
      const parca = 2 + Math.floor(r() * 3);
      const isirikSay = r() < .55 ? Math.floor(r() * 3) : 0;
      const isirikYer = Array.from({ length: isirikSay }, () => .12 + r() * .76);
      P.push([x0, y0]);
      // ara kırılma noktaları: makas her açılıp kapanışta çizgiyi biraz saptırır
      const kir = Array.from({ length: parca - 1 }, (_, k) => (k + 1) / parca + j(.06)).sort((p, q) => p - q);
      const noktalar = kir.map(t => ({ t, d: j(1.1) }));
      isirikYer.forEach(t => noktalar.push({ t, isirik: true }));
      noktalar.sort((p, q) => p.t - q.t);
      for (const n of noktalar) {
        const bx = x0 + (x1 - x0) * n.t, by = y0 + (y1 - y0) * n.t;
        if (n.isirik) {
          const derin = 1.6 + r() * 2.4, gen = 2.5 + r() * 3;
          const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
          P.push([bx - ux * gen / 2, by - uy * gen / 2]);
          P.push([bx + nx * derin, by + ny * derin]);
          P.push([bx + ux * gen / 2, by + uy * gen / 2]);
        } else P.push([bx + nx * n.d, by + ny * n.d]);
      }
    }
    return P;
  }

  const nokta = (P) => P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  // Gazete kâğıdı dokusu (256×256, döşenir): ince ışık-gölge benekleri, kısa lifler, geniş hafif dalgalanma.
  // Kanvasla bir kez üretilir (tohumlu); PNG veri adresi olarak SVG desenine verilir.
  let doku = null;
  function dokuResmi() {
    if (doku) return doku;
    const N = 256, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const r = KL().rastgele('gazete-doku');
    // geniş dalgalanma
    for (let i = 0; i < 26; i++) {
      const cx = r() * N, cy = r() * N, R = 30 + r() * 70;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
      const koyu = r() < .5;
      g.addColorStop(0, koyu ? 'rgba(130,110,70,.022)' : 'rgba(255,255,250,.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { x.save(); x.translate(dx, dy); x.fillRect(cx - R, cy - R, 2 * R, 2 * R); x.restore(); }
    }
    // benekler
    const im = x.getImageData(0, 0, N, N), d = im.data;
    for (let i = 0; i < N * N; i++) {
      const v = r();
      if (v < .05) { d[i * 4] = 100; d[i * 4 + 1] = 88; d[i * 4 + 2] = 68; d[i * 4 + 3] = Math.max(d[i * 4 + 3], 6 + r() * 12); }
      else if (v > .955) { d[i * 4] = 255; d[i * 4 + 1] = 254; d[i * 4 + 2] = 248; d[i * 4 + 3] = Math.max(d[i * 4 + 3], 14 + r() * 20); }
    }
    x.putImageData(im, 0, 0);
    // lifler
    x.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      const sx = r() * N, sy = r() * N, a = r() * Math.PI, L = 3 + r() * 11;
      x.strokeStyle = r() < .55 ? `rgba(120,100,68,${(.035 + r() * .055).toFixed(3)})` : `rgba(255,253,246,${(.12 + r() * .16).toFixed(3)})`;
      x.lineWidth = .4 + r() * .5;
      x.beginPath(); x.moveTo(sx, sy);
      x.quadraticCurveTo(sx + Math.cos(a) * L / 2 + (r() - .5) * 2, sy + Math.sin(a) * L / 2 + (r() - .5) * 2, sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      x.stroke();
    }
    doku = c.toDataURL('image/png');
    return doku;
  }

  // Kupürün kâğıdı. el: position relative bir kutu (.kupur). o: { tohum, bant: 0|1|2|[{x, y, aci, w}], renk }
  function kur(kutu, o = {}) {
    const tohum = o.tohum || ['kupur'];
    let svg = kutu.querySelector(':scope > svg.kupur-kagit');
    if (!svg) {
      svg = el('svg', { class: 'kupur-kagit', 'aria-hidden': 'true' });
      kutu.insertBefore(svg, kutu.firstChild);
    }
    function yenile() {
      const w = kutu.offsetWidth, h = kutu.offsetHeight;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      const id = 'kp' + (++sayac);
      const r = KL().rastgele('kupur-doku', ...tohum);
      // yanık köşe sayısı ya da köşe listesi (0 sol üst, 1 sağ üst, 2 sağ alt, 3 sol alt); bantlı köşeler (0 ve 2) yanmaz
      let yk = [];
      if (Array.isArray(o.yanik)) yk = o.yanik;
      else if (o.yanik) { const ry = KL().rastgele('yanik-sec', ...tohum); yk = (ry() < .5 ? [1, 3] : [3, 1]).slice(0, Math.min(2, o.yanik)); }
      const P = kenar(w, h, tohum, yk);
      const defs = el('defs', {}, svg);
      const kp = el('clipPath', { id: id + 'k' }, defs);
      el('polygon', { points: nokta(P) }, kp);
      // gazete kâğıdı dokusu: lif, benek ve hafif dalgalanma (kanvasla bir kez üretilir, döşenir)
      const pat = el('pattern', { id: id + 'r', width: 256, height: 256, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${Math.floor(r() * 256)} ${Math.floor(r() * 256)})` }, defs);
      el('image', { href: dokuResmi(), width: 256, height: 256 }, pat);
      // sararmış kenar: çok hafif, yalnız kenarda
      const rg = el('radialGradient', { id: id + 's', cx: .5 + (r() - .5) * .1, cy: .5 + (r() - .5) * .1, r: .8 }, defs);
      el('stop', { offset: .7, 'stop-color': '#d9ccaa', 'stop-opacity': 0 }, rg);
      el('stop', { offset: .95, 'stop-color': '#d6c69c', 'stop-opacity': .35 }, rg);
      el('stop', { offset: 1, 'stop-color': '#c8b487', 'stop-opacity': .5 }, rg);
      // gölge: kâğıt deftere yapışık; yumuşak bulanık gölge + kenarda ince temas gölgesi (statik, kupür başına bir süzgeç)
      const gf = el('filter', { id: id + 'b', x: '-6%', y: '-6%', width: '112%', height: '116%' }, defs);
      el('feGaussianBlur', { stdDeviation: 3.2 }, gf);
      el('polygon', { points: nokta(P), transform: 'translate(2.5 4.5)', fill: 'rgba(48,30,12,.24)', filter: `url(#${id}b)` }, svg);
      el('polygon', { points: nokta(P), transform: 'translate(.6 .9)', fill: 'rgba(48,30,12,.2)' }, svg);
      const g = el('g', { 'clip-path': `url(#${id}k)` }, svg);
      el('rect', { x: -4, y: -4, width: w + 8, height: h + 8, fill: o.renk || 'var(--gazete-kagit, #ebe7dc)' }, g);
      el('rect', { x: -4, y: -4, width: w + 8, height: h + 8, fill: `url(#${id}r)` }, g);
      el('rect', { x: -4, y: -4, width: w + 8, height: h + 8, fill: `url(#${id}s)` }, g);
      // katlanma izi: gazete katlanmış durmuş (tohumlu, her kupürde değil)
      if (o.kat !== false && r() < .6) {
        const yatay = w > h ? r() < .35 : r() < .7;
        const t = .3 + r() * .4, e = (r() - .5) * 6;
        const d = yatay ? `M-4 ${(h * t).toFixed(1)} Q${(w / 2).toFixed(1)} ${(h * t + e).toFixed(1)} ${w + 4} ${(h * t + e * .4).toFixed(1)}`
          : `M${(w * t).toFixed(1)} -4 Q${(w * t + e).toFixed(1)} ${(h / 2).toFixed(1)} ${(w * t + e * .4).toFixed(1)} ${h + 4}`;
        el('path', { d, fill: 'none', stroke: 'rgba(255,253,246,.55)', 'stroke-width': 1.4 }, g);
        el('path', { d, fill: 'none', stroke: 'rgba(90,70,40,.10)', 'stroke-width': 1.1, transform: yatay ? 'translate(0 1.3)' : 'translate(1.3 0)' }, g);
      }
      // yanık köşe: içeri doğru solan is ve kavrulmuş kâğıt rengi
      for (const y of (P.yanik || [])) {
        const R = Math.max(y.a, y.b) * 2.6;
        const rg2 = el('radialGradient', { id: id + 'y' + y.kose, cx: y.kx, cy: y.ky, r: R, gradientUnits: 'userSpaceOnUse' }, defs);
        el('stop', { offset: .38, 'stop-color': '#3d2410', 'stop-opacity': .62 }, rg2);
        el('stop', { offset: .55, 'stop-color': '#8a5a2b', 'stop-opacity': .32 }, rg2);
        el('stop', { offset: .78, 'stop-color': '#c49a5e', 'stop-opacity': .14 }, rg2);
        el('stop', { offset: 1, 'stop-color': '#c49a5e', 'stop-opacity': 0 }, rg2);
        el('circle', { cx: y.kx, cy: y.ky, r: R, fill: `url(#${id}y${y.kose})` }, g);
      }
      // birkaç çok silik leke (yaşlı kâğıt)
      const leke = 1 + Math.floor(r() * 3);
      for (let i = 0; i < leke; i++) {
        el('ellipse', { cx: r() * w, cy: r() * h, rx: 10 + r() * 30, ry: 8 + r() * 20,
          fill: '#b9a273', 'fill-opacity': (.02 + r() * .03).toFixed(3) }, g);
      }
      // kesik kenar: koyu ince kâğıt kenarı + içinde açık lif çizgisi
      el('polygon', { points: nokta(P), fill: 'none', stroke: 'rgba(110,92,60,.3)', 'stroke-width': .6 }, svg);
      el('polygon', { points: nokta(P), fill: 'none', stroke: 'rgba(255,252,240,.55)', 'stroke-width': .8,
        transform: `translate(.6 .6) scale(${((w - 1.2) / w).toFixed(4)} ${((h - 1.2) / h).toFixed(4)})` }, svg);
      // kömürleşmiş kenar: yay boyunca yumuşak kahve, üstünde ince koyu çizgi
      for (const y of (P.yanik || [])) {
        const d = 'M' + y.yay.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
        el('path', { d, fill: 'none', stroke: '#6b4220', 'stroke-opacity': .32, 'stroke-width': 4, 'stroke-linejoin': 'round', 'clip-path': `url(#${id}k)` }, svg);
        el('path', { d, fill: 'none', stroke: '#2a180b', 'stroke-opacity': .75, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, svg);
      }
      // bantlar
      kutu.querySelectorAll(':scope > .bant').forEach(b => b.remove());
      // bantlar: iki karşı köşeyi çapraz tutar (yazıya binmez); tek bant üst kenarın ortasında
      const bw = Math.min(78, Math.max(52, w * .13));
      const bantlar = Array.isArray(o.bant) ? o.bant
        : o.bant === 0 ? [] : o.bant === 1 ? [{ x: .5, y: 0, aci: -3 + r() * 4 }]
          : [{ px: [3, 2], aci: -38 - r() * 8 }, { px: [w - 3, h - 2], aci: -38 - r() * 8 }];
      bantlar.forEach((b, i) => {
        const x = b.px ? b.px[0] : b.x * w, y = b.px ? b.px[1] : b.y * h;
        bant(kutu, { x, y, w: b.w || (b.px ? bw : Math.min(86, Math.max(54, w * .2))), aci: b.aci, tohum: [...tohum, 'bant', i] });
      });
      return P;
    }
    const noktalar = yenile();
    return { svg, noktalar, yenile };
  }

  // Bant: kenarları dişli kesilmiş, sarımsı yarı saydam, üstünde bir iki kırışık. Kupüre (ya da başka kutuya) eklenir.
  function bant(kutu, o) {
    const r = KL().rastgele('bant', ...(o.tohum || ['bant']));
    const w = o.w || 70, h = o.h || Math.round(w * .3);
    const d = document.createElement('div');
    d.className = 'bant';
    d.setAttribute('aria-hidden', 'true');
    d.style.width = w + 'px'; d.style.height = h + 'px';
    d.style.left = (o.x - w / 2) + 'px'; d.style.top = (o.y - h / 2) + 'px';
    d.style.transform = `rotate(${(o.aci ?? (r() * 10 - 5)).toFixed(1)}deg)`;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }, null);
    // uçlar elle koparılmış: küçük dişler
    const P = [];
    const dis = (x, yon) => { for (let y = 0; y <= h; y += 2.5 + r() * 2) P.push([x + yon * r() * 2.2, Math.min(y, h)]); };
    P.push([1.5, 0]); P.push([w - 1.5, 0]);
    dis(w - 1.5, 1); P.push([w - 1.5, h]); P.push([1.5, h]);
    const sol = []; for (let y = h; y >= 0; y -= 2.5 + r() * 2) sol.push([1.5 - r() * 2.2, Math.max(y, 0)]);
    P.push(...sol);
    const id = 'bt' + (++sayac);
    const defs = el('defs', {}, svg);
    const lg = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#efe0ae', 'stop-opacity': .62 }, lg);
    el('stop', { offset: .5, 'stop-color': '#e6d39a', 'stop-opacity': .5 }, lg);
    el('stop', { offset: 1, 'stop-color': '#e9d8a4', 'stop-opacity': .6 }, lg);
    el('polygon', { points: nokta(P.map(p => [p[0] + .8, p[1] + 1.1])), fill: 'rgba(60,40,10,.10)' }, svg);
    el('polygon', { points: nokta(P), fill: `url(#${id})`, stroke: 'rgba(150,125,60,.28)', 'stroke-width': .6 }, svg);
    const kir = 1 + Math.floor(r() * 2);
    for (let i = 0; i < kir; i++) {
      const x = w * (.2 + r() * .6);
      el('path', { d: `M${x.toFixed(1)} 1 L${(x + (r() - .5) * 8).toFixed(1)} ${h - 1}`, stroke: 'rgba(255,255,245,.55)', 'stroke-width': .9, fill: 'none' }, svg);
    }
    el('rect', { x: 2, y: 1.5, width: w - 4, height: 1.2, fill: 'rgba(255,255,250,.35)' }, svg);
    d.appendChild(svg);
    kutu.appendChild(d);
    return d;
  }

  // Arka yüz: başka bir gazete sayfasının okunmayan, ters ve silik satırları. Metin zararsız dolgu sözcüklerden tohumlu dizilir.
  const SOZ = ('belediye pazar yarın akşam hava sıcaklık mahalle çarşı sergi konser tiyatro köprü yol tren vapur liman ' +
    'okul kitap ilan satılık kiralık daire bahçe fırın ekmek fiyat sebze meyve balık hasat bayram toplantı meclis ' +
    'kulüp maç tribün antrenör sezon gol puan lig yağmur rüzgâr kar güneş haftasonu dergi radyo program saat ' +
    'sinema film salon bilet gişe müze kütüphane park çınar bulvar meydan cadde sokak durak otobüs vapuru iskele').split(' ');
  // Dolgu metni: zararsız gazete sözcüklerinden tohumlu cümle (kesik satırlar, komşu sütun)
  function dolgu(r, n) {
    const t = Array.from({ length: n }, () => SOZ[Math.floor(r() * SOZ.length)]).join(' ');
    return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
  }
  function arka(kutu, o = {}) {
    const r = KL().rastgele('kupur-arka', ...(o.tohum || ['arka']));
    let a = kutu.querySelector(':scope > .kupur-arka');
    if (a) a.remove();
    a = document.createElement('div');
    a.className = 'kupur-arka';
    a.setAttribute('aria-hidden', 'true');
    const satir = o.satir || 14;
    const baslik = document.createElement('div');
    baslik.className = 'arka-baslik';
    baslik.textContent = Array.from({ length: 3 }, () => SOZ[Math.floor(r() * SOZ.length)]).join(' ');
    a.appendChild(baslik);
    const sutunlar = document.createElement('div');
    sutunlar.className = 'arka-sutunlar';
    for (let s = 0; s < 2; s++) {
      const sut = document.createElement('div');
      for (let i = 0; i < satir; i++) {
        const p = document.createElement('p');
        const n = 4 + Math.floor(r() * 5);
        p.textContent = Array.from({ length: n }, () => SOZ[Math.floor(r() * SOZ.length)]).join(' ');
        if (r() < .2) p.style.width = (40 + r() * 50).toFixed(0) + '%';
        sut.appendChild(p);
      }
      sutunlar.appendChild(sut);
    }
    a.appendChild(sutunlar);
    kutu.appendChild(a);
    return a;
  }

  // Yeni bulmaca: kısa gazete hışırtısı (iki kat süpürülen gürültü + iki çıtırtı)
  const sesler = {
    hisirti(c, h, t0) {
      const S = Kit.ses;
      S.parazit(c, h, t0, 'bandpass', 1800, 4200, .8, .28, .16);
      S.parazit(c, h, t0 + .07, 'highpass', 3000, 6000, .7, .22, .08);
      S.parazit(c, h, t0 + .12, 'bandpass', 5200, 3000, 2.2, .03, .1);
      S.parazit(c, h, t0 + .21, 'bandpass', 4600, 2600, 2.2, .025, .08);
    },
  };

  // Yuvarlak köşeli dikdörtgen çokgeni (saat yönünde, sol üstten); yuvarlak: köşe listesi
  // Defter sayfası yanığı kit/yanik.js'e taşındı (Kit.yanik.sayfa); eski ad geriye uyumluluk için
  const sayfaYak = (sayfa, o) => (Kit.yanik ? Kit.yanik.sayfa(sayfa, o) : null);

  Kit.gazete = { kenar, kur, bant, arka, dolgu, yak, sayfaYak, dokuResmi, sesler };
})();
