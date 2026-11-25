// kit/cizgili.js — çizgili sayfanın JS tarafı: ölçü değişkenleri ve yırtık üst kenar. Hangi oyun olduğunu bilmez.
//   Kit.cizgili.kur(sayfaEl, { satir: 36, ust: 86, alt: 36, marjX: 79, delik: true, yirtik: true, tohum: [...] })
// Yırtık kenar: sayfanın üstüne yapışık kâğıt şeridi; tırtıklı ucu tohumdan üretilir (aynı tohum aynı kenar). Yeni sayfada
// tohumu değiştir: kenar yeniden "yırtılır". Şerit clip-path ile kesilir; sayfanın kendisine clip-path/filter verilmez.
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});

  // Tırtıklı kenarın noktaları (px). w: genişlik, h: şerit yüksekliği. Dönüş: [[x, y], ...] (y = 0 şeridin tepesi)
  function kenar(w, h, tohum) {
    const r = Kit.kalem.rastgele('yirtik', ...tohum);
    const p = [];
    let x = 0, derin = 0;
    while (x < w) {
      // çoğunlukla ince dişler; arada bir kâğıt daha derin kopmuş (2-3 dişlik çentik)
      if (derin <= 0 && r() < .07) derin = 2 + Math.floor(r() * 2);
      const d = derin > 0 ? h * (.55 + r() * .3) : h * (.08 + r() * .38);
      if (derin > 0) derin--;
      p.push([x, d]);
      x += 4 + r() * 7;
    }
    p.push([w, h * (.1 + r() * .3)]);
    return p;
  }

  function kur(el, o = {}) {
    const st = el.style;
    if (o.satir) st.setProperty('--satir', o.satir + 'px');
    if (o.ust != null) st.setProperty('--satir-ust', o.ust + 'px');
    if (o.alt != null) st.setProperty('--satir-alt', o.alt + 'px');
    if (o.marjX != null) st.setProperty('--marj-x', o.marjX + 'px');
    if (o.delik === false) st.setProperty('--delik-cap', '0px');
    let s = el.querySelector(':scope > .yirtik');
    if (o.yirtik === false) { if (s) s.remove(); return null; }
    const w = el.offsetWidth, h = o.yirtikH || Math.round((o.satir || 36) * .34);
    if (!s) {
      s = document.createElement('div');
      s.className = 'yirtik';
      s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<div class="yirtik-kagit"></div>';
      el.insertBefore(s, el.firstChild);
    }
    s.style.height = h + 'px';
    st.setProperty('--yirtik-h', h + 'px');
    const pts = kenar(w, h, o.tohum || ['sayfa']);
    const poli = [...pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`), `${w}px ${h + 1}px`, `0px ${h + 1}px`];
    s.firstChild.style.clipPath = `polygon(${poli.join(', ')})`;
    // Kopan liflerin açık izi: kenarın biraz içinden, kâğıttan açık bir çizgi
    const svg = s.querySelector('svg') || s.appendChild(Kit.kalem.svgEl('svg', { 'aria-hidden': 'true' }));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.textContent = '';
    Kit.kalem.svgEl('polyline', {
      points: pts.map(([x, y]) => `${x.toFixed(1)},${(y + 1.1).toFixed(1)}`).join(' '),
      fill: 'none', stroke: 'rgba(255,255,255,.75)', 'stroke-width': 1.3, 'stroke-linejoin': 'round',
    }, svg);
    return s;
  }

  Kit.cizgili = { kur, kenar };
})();
