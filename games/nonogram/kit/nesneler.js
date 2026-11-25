// kit/nesneler.js — marjda duran nesneler (SVG, kalemle çizilmiş): 12'li kuru boya kutusu (kapağı açılan teneke),
// kurşun kalem, silgi parçası, küçük cetvel. Gerektirir: Kit.kalem (kalemYap ile K), Kit.boyama.PALET12 (renkler).
//   const kutu = Kit.nesne.kuruBoyaKutusu(K, katman, { x, y, w, tohum: ['kutu'] }); kutu.ac(); kutu.vurgula('kirmizi')
(function () {
  'use strict';
  const Kit = window.Kit;
  const KL = Kit.kalem;
  const GRAFIT = '#4a4a4a', AHSAP = '#e9cf9f', TENEKE = '#b9bec4';

  function kuruBoyaKutusu(K, katman, o = {}) {
    const w = o.w || 120, h = w * .62, x = o.x || 0, y = o.y || 0, t = o.tohum || ['kutu'], an = !!o.anlik;
    const renkler = o.renkler || Object.keys(Kit.boyama ? Kit.boyama.PALET12 : {});
    const hex = (r) => (Kit.boyama ? Kit.boyama.renk(r) : r);
    const g = KL.svgEl('g', { class: 'kuruboya-kutusu', transform: `translate(${x} ${y})` }, katman);
    const tepsi = KL.svgEl('g', { class: 'tepsi' }, g);
    const op = { anlik: true, baski: false };
    // tepsi: alt yarı, teneke
    K.dikdortgen(tepsi, [0, h * .42, w, h * .58], { stroke: GRAFIT, strokeWidth: 1.3, fill: TENEKE, fillStyle: 'hachure', hachureGap: 4, fillWeight: .6, hachureAngle: 60 }, [...t, 'tepsi'], op);
    const kalemler = {};
    const n = renkler.length, pw = (w - 8) / n;
    renkler.forEach((r, i) => {
      const kg = KL.svgEl('g', { class: 'boya-kalemi', 'data-renk': r }, tepsi);
      const kx = 4 + i * pw, ust = h * .2;
      K.dikdortgen(kg, [kx + .6, ust, pw - 1.2, h * .74], { stroke: GRAFIT, strokeWidth: .8, fill: hex(r), fillStyle: 'solid', roughness: .6 }, [...t, 'k', i], op);
      K.cokgen(kg, [[kx + .6, ust], [kx + pw / 2, ust - h * .13], [kx + pw - .6, ust]], { stroke: GRAFIT, strokeWidth: .7, fill: AHSAP, fillStyle: 'solid', roughness: .5 }, [...t, 'u', i], op);
      K.cokgen(kg, [[kx + pw * .36, ust - h * .085], [kx + pw / 2, ust - h * .13], [kx + pw * .64, ust - h * .085]], { stroke: hex(r), strokeWidth: .7, fill: hex(r), fillStyle: 'solid', roughness: .3 }, [...t, 'uc', i], op);
      kalemler[r] = kg;
    });
    // tepsinin ön kenarı kalemlerin altını örter
    K.dikdortgen(tepsi, [0, h * .7, w, h * .3], { stroke: GRAFIT, strokeWidth: 1.3, fill: '#c6cacf', fillStyle: 'solid', roughness: .7 }, [...t, 'on'], op);
    KL.metinSvg(tepsi, '12 renk', { x: w / 2, y: h * .9, boyut: h * .16, renk: GRAFIT, hiza: 'middle', anlik: true });
    // kapak (kapalıyken bütün kutuyu örter)
    const kapak = KL.svgEl('g', { class: 'kapak' }, g);
    K.dikdortgen(kapak, [-1, -1, w + 2, h + 2], { stroke: GRAFIT, strokeWidth: 1.4, fill: '#cfd3d7', fillStyle: 'solid', roughness: .7 }, [...t, 'kapak'], op);
    K.dikdortgen(kapak, [w * .12, h * .22, w * .76, h * .5], { stroke: GRAFIT, strokeWidth: .9, fill: '#f3ead6', fillStyle: 'solid', roughness: .8 }, [...t, 'etiket'], op);
    KL.metinSvg(kapak, 'kuru boya', { x: w / 2, y: h * .5, boyut: h * .2, renk: GRAFIT, hiza: 'middle', anlik: true });
    KL.metinSvg(kapak, '12', { x: w / 2, y: h * .67, boyut: h * .14, renk: GRAFIT, hiza: 'middle', anlik: true });
    let acik = false;
    const api = {
      node: g, kalemler,
      ac(anlik = an) {
        acik = true;
        kapak.style.transition = anlik || !KL.animasyonVar() ? 'none' : 'transform .42s cubic-bezier(.3,.7,.3,1.1)';
        kapak.style.transformBox = 'fill-box'; kapak.style.transformOrigin = '50% 0%';
        kapak.style.transform = `translateY(${-h * .62}px) scaleY(.22)`;
      },
      kapat(anlik = an) {
        acik = false;
        kapak.style.transition = anlik || !KL.animasyonVar() ? 'none' : 'transform .3s ease-in';
        kapak.style.transform = '';
        api.vurgula(null);
      },
      vurgula(r) {
        for (const [k, kg] of Object.entries(kalemler)) {
          kg.style.transition = 'transform .18s';
          kg.style.transform = k === r ? `translateY(${-h * .12}px)` : '';
        }
      },
      get acik() { return acik; },
    };
    if (o.acik) api.ac(true);
    return api;
  }

  // Kurşun kalem (araç simgesi): x, y sol uç; aci derece
  function kalem(K, katman, o = {}) {
    const L = o.uzunluk || 60, k = L * .14, t = o.tohum || ['kalem'];
    const g = KL.svgEl('g', { class: 'kursun-kalem', transform: `translate(${o.x || 0} ${o.y || 0}) rotate(${o.aci || 0})` }, katman);
    const op = { anlik: true, baski: false };
    K.cokgen(g, [[0, 0], [L * .16, -k / 2], [L * .16, k / 2]], { stroke: GRAFIT, strokeWidth: 1, fill: AHSAP, fillStyle: 'solid' }, [...t, 'uc'], op);
    K.cokgen(g, [[0, 0], [L * .06, -k * .19], [L * .06, k * .19]], { stroke: GRAFIT, strokeWidth: .8, fill: GRAFIT, fillStyle: 'solid' }, [...t, 'grafit'], op);
    K.dikdortgen(g, [L * .16, -k / 2, L * .66, k], { stroke: GRAFIT, strokeWidth: 1, fill: '#d9c27a', fillStyle: 'hachure', hachureGap: 3, fillWeight: .7, hachureAngle: 0 }, [...t, 'govde'], op);
    K.dikdortgen(g, [L * .82, -k / 2, L * .07, k], { stroke: GRAFIT, strokeWidth: 1, fill: '#a9adb2', fillStyle: 'solid' }, [...t, 'bilezik'], op);
    K.dikdortgen(g, [L * .89, -k / 2, L * .11, k], { stroke: GRAFIT, strokeWidth: 1, fill: '#e3a9a0', fillStyle: 'solid' }, [...t, 'silgi'], op);
    return { node: g };
  }

  // Silgi parçası (Üç Silgi hakları)
  function silgi(K, katman, o = {}) {
    const w = o.w || 26, h = o.h || 15, t = o.tohum || ['silgi'];
    const g = KL.svgEl('g', { class: 'silgi-parcasi', transform: `translate(${o.x || 0} ${o.y || 0}) rotate(${o.aci ?? -8})` }, katman);
    const op = { anlik: true, baski: false };
    K.dikdortgen(g, [0, 0, w, h], { stroke: GRAFIT, strokeWidth: 1.1, fill: '#f1d2c9', fillStyle: 'solid', roughness: 1.1 }, [...t, 'g'], op);
    K.cizgi(g, [w * .62, 1, w * .58, h - 1], { stroke: GRAFIT, strokeWidth: .6 }, [...t, 'kesik'], op);
    let kullanildi = false;
    return {
      node: g,
      kullan(anlik = false) {
        if (kullanildi) return;
        kullanildi = true;
        K.cizgi(g, [-4, h * .9, w + 4, h * .1], { stroke: '#b4382e', strokeWidth: 1.6 }, [...t, 'ustu'], { anlik, sureMs: [220, 220], baski: false });
        g.style.transition = anlik ? 'none' : 'opacity .6s .25s';
        g.style.opacity = '.35';
      },
      get kullanildi() { return kullanildi; },
    };
  }

  // Küçük cetvel (bulmaca başı)
  function cetvelCiz(K, katman, o = {}) {
    const w = o.w || 90, h = o.h || 12, t = o.tohum || ['cetvel'];
    const g = KL.svgEl('g', { class: 'cetvel', transform: `translate(${o.x || 0} ${o.y || 0}) rotate(${o.aci || 0})` }, katman);
    const op = { anlik: o.anlik ?? true, baski: false };
    K.dikdortgen(g, [0, 0, w, h], { stroke: GRAFIT, strokeWidth: 1, fill: '#efe6c8', fillStyle: 'solid', roughness: .5 }, [...t, 'g'], op);
    for (let i = 1; i < 10; i++) K.cizgi(g, [i * w / 10, 0, i * w / 10, h * (i % 5 ? .35 : .6)], { stroke: GRAFIT, strokeWidth: .6, roughness: .3 }, [...t, i], op);
    return { node: g };
  }

  Kit.nesne = { kuruBoyaKutusu, kalem, silgi, cetvelCiz };
})();
