// ui/yazdir.js — Yazdır: aynı labirent beyaz zeminde siyah çizgiyle, A4 sayfaya; üstünde labirent kodu ve günün tarihi.
// Öğretmenler ve gerçek kalemle çözmek isteyenler için. Ekrandaki defter yazdırılmaz; yalnız #yazdir kabı (@media print).
// Duvarlar ekrandakiyle aynı kalem koşularından, hafif elle çizilmiş titremeyle SVG'ye yazılır; yol yazdırılmaz.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const J = () => window.Kit.jel;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(ad, oz, ebeveyn) { const e = document.createElementNS(SVGNS, ad); for (const k in oz) e.setAttribute(k, oz[k]); if (ebeveyn) ebeveyn.appendChild(e); return e; }

  function hazirla(lab) {
    const kap = document.getElementById('yazdir'), g = lab.grid, k = g.kutu, B = 40;      // 1 ızgara birimi = 40 SVG birimi
    kap.textContent = '';
    const d = new Date(), tarih = `${d.getDate()} ${LB.kod.AYLAR[d.getMonth()]} ${d.getFullYear()}`;
    const bas = document.createElement('p');
    bas.className = 'yazdir-bas';
    bas.textContent = `Labirent · ${lab.kod} · ${tarih}`;
    kap.appendChild(bas);
    // büyük labirentte etiket ve ok sayfaya göre küçülmesin: ölçek labirent genişliğiyle büyür
    const f = Math.max(1, (k.x1 - k.x0) / 18), pay = 2.6 * f, w = (k.x1 - k.x0 + 2 * pay) * B, h = (k.y1 - k.y0 + 2 * pay) * B;
    const svg = el('svg', { viewBox: `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`, class: 'yazdir-svg', 'aria-label': 'Yazdırılacak labirent' }, kap);
    const px = ([x, y]) => [(x - k.x0 + pay) * B, (y - k.y0 + pay) * B];
    const cizgi = el('g', { fill: 'none', stroke: '#111', 'stroke-width': (B * .065).toFixed(2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    LB.maze.kosular(LB.topology.duvarlar(lab), 8 / B).forEach((kosu, i) => {
      const nok = J().roughYol(kosu.map(px), { tohum: ['yazdir', lab.kod, i], roughness: .5, bowing: .5 });
      el('polyline', { points: nok.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') }, cizgi);
    });
    // giriş / çıkış: ağzın dışında kısa ok ve yazı (dairede çıkış merkezde)
    const yazi = (metin, [x, y], hiza) => { const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': hiza, class: 'yazdir-etiket', 'font-size': (22 * f).toFixed(1) }, svg); t.textContent = metin; };
    for (const ad of ['giris', 'cikis']) {
      const a = LB.maze.agiz(lab, lab[ad]), metin = ad === 'giris' ? 'giriş' : 'çıkış';
      if (!a) { yazi(metin, px(g.merkez(lab[ad].hucre)).map((v, i) => v + (i ? B * .18 : 0)), 'middle'); continue; }
      const [x, y] = px(a.p), [nx, ny] = a.n, L = B * .8 * f, u = B * .22 * f;
      const p0 = ad === 'giris' ? [x + nx * (L + 6), y + ny * (L + 6)] : [x + nx * 6, y + ny * 6], p1 = ad === 'giris' ? [x + nx * 6, y + ny * 6] : [x + nx * (L + 6), y + ny * (L + 6)];
      const aci = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      el('path', { d: `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} M${(p1[0] - u * Math.cos(aci + .5)).toFixed(1)} ${(p1[1] - u * Math.sin(aci + .5)).toFixed(1)} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${(p1[0] - u * Math.cos(aci - .5)).toFixed(1)} ${(p1[1] - u * Math.sin(aci - .5)).toFixed(1)}`, fill: 'none', stroke: '#111', 'stroke-width': (B * .045 * f).toFixed(2), 'stroke-linecap': 'round' }, svg);
      const uz = [x + nx * (L + 14 * f), y + ny * (L + 14 * f)];
      if (Math.abs(ny) >= Math.abs(nx) * .8) yazi(metin, [uz[0], ny < 0 ? uz[1] - 4 * f : uz[1] + B * .5 * f], 'middle');
      else yazi(metin, [x + nx * 8 * f, uz[1] - B * .35 * f], nx < 0 ? 'end' : 'start');
    }
    // sayfa yönü: labirent genişse yatay A4
    let stil = document.getElementById('yazdir-sayfa');
    if (!stil) { stil = document.createElement('style'); stil.id = 'yazdir-sayfa'; document.head.appendChild(stil); }
    stil.textContent = `@page { size: A4 ${w > h * 1.1 ? 'landscape' : 'portrait'}; margin: 12mm; }`;
    kap.dataset.yon = w > h * 1.1 ? 'yatay' : 'dikey';
    return kap;
  }

  function yazdir() {
    const O = LB.oyun;
    if (LB.sonsuz && LB.sonsuz.aktif) return;
    hazirla(O.lab);
    const yaz = () => window.print();
    document.fonts && document.fonts.ready ? document.fonts.ready.then(yaz) : yaz();
  }

  LB.yazdir = { hazirla, yazdir };
})();
