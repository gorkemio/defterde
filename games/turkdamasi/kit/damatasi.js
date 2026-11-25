// Kuru boya taşı. Oyun kuralları, hücreler veya oyuncu sırası bilmez.
// Her SVG'de ortak doku; her kimlikte bir gövde. Yüz yalnız istenirse çizilir; taç ayrı güncellenir.
(function () {
  'use strict';
  const Kit = window.Kit, KL = Kit.kalem;
  const { svgEl, rastgele, tohum } = KL;
  const ciziciler = new WeakMap();
  const RENK = {
    mavi: { ana: '#2b4a9f', taban: '#6688be', kenar: '#23467e', yuz: '#172a46', iz: '#c9dbec' },
    kirmizi: { ana: '#c0392b', taban: '#dc8c78', kenar: '#94412e', yuz: '#4a261f', iz: '#f3d2ac' },
  };

  function kur(svg) {
    if (ciziciler.has(svg)) return ciziciler.get(svg);
    const rc = rough.svg(svg), taslar = new Map();

    function ciz(katman, tur, args, id, parca, ek = {}) {
      const o = Object.assign({
        seed: tohum('damatasi', id, parca), roughness: .48, bowing: .35,
        strokeWidth: 1.4, disableMultiStroke: true,
      }, ek);
      const node = rc[tur](...args, o);
      katman.appendChild(node);
      return node;
    }

    function yuz(tas, ifade) {
      tas.yuz.replaceChildren();
      tas.ifade = ifade;
      const k = tas.yuz, c = RENK[tas.takim].yuz, id = tas.id;
      const yol = (d, ad, ek = {}) => ciz(k, 'path', [d], id, ad, { stroke: c, strokeWidth: 2.5, roughness: .27, ...ek });
      const goz = (x, ad) => ciz(k, 'ellipse', [x, -5, 4.5, 6.5], id, ad, { stroke: c, fill: c, fillStyle: 'solid', strokeWidth: 1, roughness: .25 });
      if (ifade === 1) {
        yol('M-15 -5 Q-11 -12 -7 -5', 'sol-goz');
        yol('M7 -5 Q11 -12 15 -5', 'sag-goz');
      } else if (ifade === 2) {
        goz(-11, 'sol-goz');
        yol('M7 -8 L14 -5 L7 -2', 'sag-goz');
      } else if (ifade === 4) {
        goz(-11, 'sol-goz'); goz(11, 'sag-goz');
        yol('M-15 -14 Q-10 -18 -6 -14', 'sol-kas', { strokeWidth: 1.6 });
        yol('M7 -16 L14 -14', 'sag-kas', { strokeWidth: 1.6 });
      } else if (ifade === 5) {
        yol('M-15 -10 L-7 -7', 'sol-kas', { strokeWidth: 1.8 });
        yol('M7 -7 L15 -10', 'sag-kas', { strokeWidth: 1.8 });
        goz(-11, 'sol-goz'); goz(11, 'sag-goz');
      } else {
        goz(-11, 'sol-goz'); goz(11, 'sag-goz');
      }
      if (ifade === 3) {
        yol('M-11 6 Q0 10 12 5 Q10 21 -1 20 Q-9 18 -11 6Z', 'agiz', { fill: c, fillStyle: 'solid', strokeWidth: 1.2 });
        yol('M-8 8 Q0 10 9 7 L7 12 Q0 14 -6 12Z', 'dis', { stroke: 'none', fill: '#f7e9cf', fillStyle: 'solid', roughness: .15 });
      } else if (ifade === 4) {
        yol('M-7 10 Q2 18 11 8', 'agiz');
      } else if (ifade === 5) {
        yol('M-10 10 Q1 18 12 5', 'agiz');
      } else {
        yol('M-10 7 Q-1 23 12 7', 'agiz');
      }
    }

    function tac(tas, acik) {
      tas.tac.replaceChildren();
      tas.node.dataset.dama = String(Boolean(acik));
      if (!acik) return;
      ciz(tas.tac, 'path', ['M-19 -27 L-25 -41 L-10 -35 L-2 -46 L7 -35 L23 -42 L18 -25 Z'],
        tas.id, 'tac-dolgu', { fill: '#d6b65f', fillStyle: 'solid', stroke: '#79623b', strokeWidth: 1.5, roughness: .65 });
      ciz(tas.tac, 'path', ['M-19 -27 L-25 -41 L-10 -35 L-2 -46 L7 -35 L23 -42 L18 -25 Z'],
        tas.id, 'tac-tarama', { fill: '#8e6d31', fillStyle: 'hachure', hachureGap: 3, fillWeight: .7, stroke: 'none', roughness: .6 });
      ciz(tas.tac, 'path', ['M-16 -28 Q0 -24 16 -27'], tas.id, 'tac-alt', { stroke: '#79623b', strokeWidth: 1.3 });
    }

    function olustur(id, { takim = 'mavi', dama = false, ifade } = {}) {
      if (taslar.has(id)) return taslar.get(id);
      const c = RENK[takim], r = rastgele('damatasi', id);
      const node = svgEl('g', { class: 'tas', 'data-id': id, 'data-takim': takim }, svg);
      const govde = svgEl('g', { class: 'tas-govde' }, node);
      const aci = (r() - .5) * 8;
      govde.setAttribute('transform', `rotate(${aci.toFixed(2)})`);

      // Gölge ve dar alt kenar: boya çizimi, plastik bir ışık lekesi değil.
      svgEl('ellipse', { cx: 1, cy: 9, rx: 37, ry: 33, fill: '#514938', opacity: .12 }, govde);
      svgEl('ellipse', { cx: 1, cy: 7, rx: 35.5, ry: 33, fill: '#514938', opacity: .12 }, govde);
      ciz(govde, 'ellipse', [0, 4, 72, 69], id, 'alt', { fill: c.kenar, fillStyle: 'solid', stroke: c.kenar, roughness: .65 });

      const boya = Kit.kuruboya.katman(svg, govde, 'tas-boya');
      ciz(boya, 'ellipse', [0, 0, 71, 69], id, 'taban', { fill: c.taban, fillStyle: 'solid', stroke: c.kenar, strokeWidth: 1.4, roughness: .55 });
      ciz(boya, 'ellipse', [0, 0, 69, 67], id, 'tarama', {
        fill: c.ana, fillStyle: 'hachure', stroke: 'none', hachureAngle: -38 + r() * 18,
        hachureGap: 1.7, fillWeight: 1.8, roughness: .7, disableMultiStrokeFill: true,
      }).setAttribute('opacity', '.78');
      ciz(boya, 'ellipse', [0, 0, 65, 63], id, 'capraz', {
        fill: c.ana, fillStyle: 'hachure', stroke: 'none', hachureAngle: 43,
        hachureGap: 3.3, fillWeight: .8, roughness: .8, disableMultiStrokeFill: true,
      }).setAttribute('opacity', '.45');

      // Tek bileşik yol: kalem ucunun bıraktığı açık kâğıt dişleri.
      let dis = '';
      for (let i = 0; i < 125; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 32;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        dis += `M${x.toFixed(1)} ${y.toFixed(1)}l${(r() * 1.8 + .3).toFixed(1)} -${(r() * .7 + .2).toFixed(1)}`;
      }
      svgEl('path', { d: dis, fill: 'none', stroke: c.iz, 'stroke-width': .85, opacity: .44 }, boya);
      ciz(boya, 'path', ['M-27 2 Q-31 -21 -8 -29'], id, 'acik-kenar', { stroke: c.iz, strokeWidth: 1.8, roughness: .9 }).setAttribute('opacity', '.65');
      ciz(boya, 'path', ['M-24 21 Q-1 40 27 18'], id, 'koyu-kenar', { stroke: c.kenar, strokeWidth: 1.5, roughness: .85 }).setAttribute('opacity', '.7');

      const isaret = svgEl('g', { class: 'takim-isareti', opacity: .85 }, govde);
      ciz(isaret, 'path', ['M-7 27 L5 24'], id, 'takim-tek', { stroke: c.iz, strokeWidth: 1.9, roughness: .35 });
      if (takim === 'kirmizi') ciz(isaret, 'path', ['M-3 22 L2 29'], id, 'takim-capraz', { stroke: c.iz, strokeWidth: 1.9, roughness: .35 });
      const tas = { id, takim, node, govde, yuz: svgEl('g', { class: 'tas-yuz' }, node), tac: svgEl('g', { class: 'tas-tac' }, node) };
      if (ifade != null) yuz(tas, ifade);
      tac(tas, dama);
      taslar.set(id, tas);
      return tas;
    }

    const api = {
      olustur, yuz, tac,
      konumla(tas, x, y, olcek = 1) { tas.node.setAttribute('transform', `translate(${x} ${y}) scale(${olcek})`); },
    };
    ciziciler.set(svg, api);
    return api;
  }
  Kit.damatasi = { kur };
})();
