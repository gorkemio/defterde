// kit/rakam.js — kalemle yazılmış rakamlar: 0–9, + − . : ? ve tik. Font değil, rough.js darbeleri. Hangi oyun olduğunu bilmez.
// Glifler 10×14'lük kutuda (y aşağı, taban çizgisi y = 14) darbe listesidir; dokuztas başlık harfleriyle aynı biçim:
//   ['L', x1, y1, x2, y2] düz · ['C', [[x, y], ...]] eğri (kalemin izlediği sırayla) · ['E', cx, cy, w, h] elips
// Türk okul el yazısı: 1 bayraklı, 7 çizgili, 4 açık, 9 düz kuyruklu, 2 düz tabanlı.
//
//   const K = Kit.kalem.kalemYap(svg);
//   Kit.rakam.ciz(K, katman, '7', { x, y, boyut: 22, renk: 'mavi', tohum: ['satir', 3, 1] })   // x: sol, y: taban, boyut: yükseklik
//   Kit.rakam.yaz(K, katman, '+1 -2', { x, y, boyut: 20, renk: 'kirmizi', tohum: ['cevap', 3] }) → { node, bitti, sure, genislik }
//   Kit.rakam.genislik('1234', 22) → px
// Rough seçenekleri aktif malzemeden gelir (kırmızı-mavi kalemde tek geçiş ve baskı). Bir rakam 150–200 ms'de yazılır.
(function () {
  'use strict';

  const GLIF = {
    '0': [['C', [[5.8, .3], [2.4, 1.2], [.7, 5.6], [1.2, 11], [4.4, 13.9], [7.8, 12.8], [9.4, 8], [8.6, 2.6], [6, .3], [4.6, .9]]]],
    '1': [['L', 1.6, 4.4, 6.2, .2], ['L', 6.2, .2, 6.1, 14]],
    '2': [['C', [[1, 3.4], [2.8, .7], [6.2, .3], [8.8, 2.4], [8.4, 5.8], [5.2, 9.4], [.7, 13.9]]], ['L', .7, 13.9, 9.8, 13.7]],
    '3': [['C', [[1.2, 2.4], [4, .2], [7.6, .7], [8.6, 3.4], [6.8, 6.1], [3.6, 6.8]]],
          ['C', [[3.6, 6.8], [7.6, 7.3], [9.4, 10.2], [7.8, 13.3], [3.8, 14], [.6, 12.2]]]],
    '4': [['L', 6.4, .1, .4, 9.6], ['L', .4, 9.6, 9.9, 9.4], ['L', 7.4, 4.4, 7.2, 14]],
    '5': [['L', 2.6, .6, 1.9, 6.5], ['C', [[1.9, 6.5], [4.8, 5.4], [8.1, 6.4], [9.4, 9.6], [7.8, 13.2], [4, 14], [.8, 12.6]]],
          ['L', 2.6, .6, 9.2, .3]],
    '6': [['C', [[8.3, .8], [5, .3], [2, 3], [.6, 8], [1.4, 12.6], [4.8, 14], [8.2, 12.9], [9.1, 9.6], [7.4, 7], [4.4, 6.8], [1.3, 8.8]]]],
    '7': [['L', .4, .7, 9.8, .3], ['L', 9.8, .3, 3.6, 14], ['L', 3, 7.4, 8.8, 7.1]],
    '8': [['C', [[8.1, 2.2], [5.4, .1], [2, 1.2], [2.2, 4.6], [5, 6.8], [8.3, 9.1], [8.8, 12.4], [5.2, 14], [1.6, 12.6], [1.7, 9.3], [5, 6.8], [7.8, 4.6], [8.2, 2.4], [6.9, .9]]]],
    '9': [['C', [[8.7, 3.2], [6.8, .2], [2.6, .5], [1, 3.6], [2.7, 6.7], [6.2, 6.6], [8.6, 3.8]]], ['L', 8.7, 2.6, 8.2, 14]],
    '+': [['L', 5, 3.4, 5.1, 12], ['L', 1.2, 7.8, 9, 7.6]],
    '-': [['L', 1.4, 7.9, 8.8, 7.7]],
    '.': [['E', 2.2, 13, 1.8, 1.8]],
    ':': [['E', 2.2, 5.2, 1.8, 1.8], ['E', 2.2, 12.6, 1.8, 1.8]],
    '?': [['C', [[1.4, 3.6], [2.8, .6], [6.4, .2], [8.6, 2.4], [7.8, 5.4], [5, 7.2], [4.8, 10]]], ['E', 4.8, 13.1, 1.6, 1.6]],
    'tik': [['C', [[0, 7.6], [1.8, 9.6], [3.6, 13.8]]], ['C', [[3.6, 13.8], [6, 6.8], [10.6, -.8]]]],
  };
  // Harf aralığı: glifin kutu genişliği (10 birim üzerinden). Boşluk da bir genişliktir.
  const EN = { '1': 7.4, '.': 4.4, ':': 4.4, ' ': 5, '+': 10, '-': 10, 'tik': 11 };
  const en = (ch) => EN[ch] ?? 10;
  const ARALIK = 1.6;                                        // iki glif arasında boşluk (birim)

  // Darbe uzunluğu (birim): süreyi darbelere bölmek için
  function uzunluk(d) {
    if (d[0] === 'L') return Math.hypot(d[3] - d[1], d[4] - d[2]);
    if (d[0] === 'E') return Math.PI * (d[3] + d[4]) / 2;
    let L = 0;
    for (let i = 1; i < d[1].length; i++) L += Math.hypot(d[1][i][0] - d[1][i - 1][0], d[1][i][1] - d[1][i - 1][1]);
    return L;
  }

  const birim = (boyut) => boyut / 14;
  function genislik(metin, boyut) {
    const p = parcala(metin);
    let w = 0;
    p.forEach((ch, i) => { w += en(ch) + (i < p.length - 1 ? ARALIK : 0); });
    return w * birim(boyut);
  }
  // 'tik' tek parça; gerisi karakter karakter. '−' (eksi işareti) '-' sayılır.
  function parcala(metin) {
    if (metin === 'tik') return ['tik'];
    return Array.from(String(metin)).map(ch => (ch === '−' ? '-' : ch));
  }

  // Tek glif. o: { x (sol), y (taban), boyut (yükseklik px), renk, tohum: [...], gecikme, anlik, sure (ms, toplam), kalinlik, ek }
  function ciz(K, katman, ch, o) {
    const KL = window.Kit.kalem;
    const { rastgele, aralik, svgEl, renkDeger } = KL;
    const darbeler = GLIF[ch];
    const g = svgEl('g', { class: 'glif' }, katman);
    if (!darbeler) return { node: g, bitti: Promise.resolve(), sure: 0 };
    const an = o.tohum || ['rakam', ch, o.x, o.y];
    const r = rastgele('rakam', ...an);
    const s = birim(o.boyut) * aralik(r, .95, 1.05);
    const ox = o.x + aralik(r, -1, 1) * birim(o.boyut) * .6, oy = o.y + aralik(r, -.8, .8) * birim(o.boyut) * .5;
    const egim = aralik(r, -.06, .06);                      // ±3.5°: üst kısım sağa/sola yatar
    const P = (px, py) => [ox + (px + (14 - py) * egim) * s, oy - (14 - py) * s];
    const ek = Object.assign({ stroke: renkDeger(o.renk || 'mavi'), roughness: .45, bowing: .3 },
      o.kalinlik ? { strokeWidth: o.kalinlik } : {}, o.ek);
    const toplam = o.sure ?? aralik(r, 150, 200);
    const uz = darbeler.map(uzunluk), U = uz.reduce((a, b) => a + b, 0);
    const bit = [];
    let gec = o.gecikme || 0;
    darbeler.forEach((d, j) => {
      const sure = Math.max(30, toplam * uz[j] / U);
      const oo = { gecikme: gec, anlik: o.anlik, sureMs: [sure, sure] };
      const da = [...an, j];
      let c;
      if (d[0] === 'L') c = K.cizgi(g, [...P(d[1], d[2]), ...P(d[3], d[4])], ek, da, oo);
      else if (d[0] === 'C') c = K.egri(g, d[1].map(q => P(q[0], q[1])), ek, da, oo);
      else {
        const [cx, cy] = P(d[1], d[2]);
        c = K.elips(g, [cx, cy, d[3] * s, d[4] * s], Object.assign({}, ek, { fill: ek.stroke, fillStyle: 'solid' }), da, oo);
      }
      bit.push(c.bitti);
      if (!o.anlik) gec += sure;
    });
    return { node: g, bitti: Promise.all(bit), sure: o.anlik ? 0 : gec - (o.gecikme || 0) };
  }

  // Bir dizi glif soldan sağa. Her glif bir öncekinin %85'inde başlar. o: ciz seçenekleri + { sinif, adim (ms, sabit aralık) }
  function yaz(K, katman, metin, o) {
    const KL = window.Kit.kalem;
    const g = KL.svgEl('g', { class: o.sinif || 'rakamlar' }, katman);
    const b = birim(o.boyut);
    const bit = [];
    let x = o.x, gec = o.gecikme || 0, son = gec;
    parcala(metin).forEach((ch, i) => {
      if (ch !== ' ') {
        const c = ciz(K, g, ch, Object.assign({}, o, { x, gecikme: gec, tohum: [...(o.tohum || ['yaz', metin]), i] }));
        bit.push(c.bitti);
        son = gec + c.sure;
        if (!o.anlik) gec += o.adim ?? c.sure * .85;
      }
      x += (en(ch) + ARALIK) * b;
    });
    return { node: g, bitti: Promise.all(bit), sure: son - (o.gecikme || 0), genislik: x - o.x - ARALIK * b };
  }

  const R = { GLIF, EN, ARALIK, ciz, yaz, genislik, parcala };
  if (typeof window !== 'undefined') (window.Kit = window.Kit || {}).rakam = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})();
