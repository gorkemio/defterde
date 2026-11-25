// kit/rakamtuval.js — kalem rakamları canvas'ta: Kit.rakam.GLIF verisi (10×14 kutuda darbeler), rough.js generator.
// Kit.rakam.ciz ile aynı tohumlu el yazısı dönüşümü (ölçek, kayma, ±3.5° eğim). Gerektirir: Kit.rakam, Kit.tuval, Kit.kalem.
//   Kit.rakamTuval.yaz(ctx, '12', x, y, { boyut: 16, hiza: 'sag', tohum: ['satir', 3, 0] })   // y: taban çizgisi
(function () {
  'use strict';
  const Kit = window.Kit;
  const R = Kit.rakam, T = Kit.tuval, KL = Kit.kalem;
  const onbellek = new Map();

  // Glif darbeleri birim kutuda (yükseklik 14, taban y = 14); tohum el yazısı farkını verir
  function glif(ch, tohum) {
    const k = ch + '|' + tohum.join('|');
    let g = onbellek.get(k);
    if (g) return g;
    const darbe = R.GLIF[ch] || [], r = KL.rastgele('rakam', ...tohum);
    const s = KL.aralik(r, .95, 1.05), ox = KL.aralik(r, -1, 1) * .6, oy = KL.aralik(r, -.8, .8) * .5, egim = KL.aralik(r, -.06, .06);
    const P = (px, py) => [ox + (px + (14 - py) * egim) * s, 14 + oy - (14 - py) * s];
    const o = { roughness: .45, bowing: .3, disableMultiStroke: true };
    const ps = [];
    darbe.forEach((d, j) => {
      const seed = KL.tohum('rakam', ...tohum, j), oo = Object.assign({ seed }, o);
      let dr;
      if (d[0] === 'L') dr = T.gen().line(...P(d[1], d[2]), ...P(d[3], d[4]), oo);
      else if (d[0] === 'C') dr = T.gen().curve(d[1].map(q => P(q[0], q[1])), oo);
      else { const [cx, cy] = P(d[1], d[2]); dr = T.gen().ellipse(cx, cy, d[3] * s, d[4] * s, Object.assign({ fill: '#000', fillStyle: 'solid' }, oo)); }
      ps.push(...T.parcalar(dr, { enAz: 0 }));
    });
    g = { parcalar: ps, en: R.EN[ch] ?? 10 };
    onbellek.set(k, g);
    if (onbellek.size > 5000) onbellek.delete(onbellek.keys().next().value);
    return g;
  }

  const genislik = (metin, boyut) => R.genislik(metin, boyut);

  // o: { boyut (px yükseklik), renk, tohum, hiza: 'sol' | 'orta' | 'sag', alfa, kalinlik (px), zemin (hale rengi), ilerleme }
  function yaz(ctx, metin, x, y, o = {}) {
    const boyut = o.boyut || 16, b = boyut / 14, p = R.parcala(String(metin)), w = genislik(String(metin), boyut);
    let sx = o.hiza === 'sag' ? x - w : o.hiza === 'orta' ? x - w / 2 : x;
    const kal = (o.kalinlik || Math.max(1.1, boyut * .085)) / b;
    const tohum = o.tohum || ['yaz', metin];
    const ciz = (renk, ek, alfa) => {
      let cx = sx;
      p.forEach((ch, i) => {
        if (ch !== ' ') {
          const g = glif(ch, [...tohum, i]);
          ctx.save();
          ctx.translate(cx, y - boyut); ctx.scale(b, b);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = renk; ctx.fillStyle = renk;
          ctx.lineWidth = kal + ek; ctx.globalAlpha = alfa;
          T.cizParcalar(ctx, g.parcalar, { ilerleme: o.ilerleme ?? 1 });
          ctx.restore();
        }
        cx += ((R.EN[ch] ?? 10) + R.ARALIK) * b;
      });
    };
    if (o.zemin) ciz(o.zemin, 3.2 / b, .92);
    ciz(o.renk || '#4a4a4a', 0, o.alfa ?? 1);
    return w;
  }

  Kit.rakamTuval = { glif, yaz, genislik };
})();
