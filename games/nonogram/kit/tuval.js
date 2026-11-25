// kit/tuval.js — canvas tarafının ortak parçaları: DPR'li boyutlama, dünya uzayında offscreen katman, rough.js
// generator çıktısını Path2D darbelerine çevirme ve kısmi (ilerlemeli) çizim, tohumlu desenler, kare süresi ölçümü.
// rough.canvas kullanılmaz: geometri bir kez üretilir, saklanır, aynı darbe birçok katmana ve büyütece çizilir.
// Hangi oyun olduğunu bilmez. Gerektirir: rough (global), Kit.kalem (tohum yardımcıları).
//   const d = Kit.tuval.parcalar(Kit.tuval.gen().line(0, 0, 100, 0, { seed }));   Kit.tuval.cizParcalar(ctx, d, { ilerleme: .5 })
(function () {
  'use strict';
  const Kit = (window.Kit = window.Kit || {});
  let G = null;
  const gen = () => G || (G = rough.generator());
  const KENAR = 4096, PIKSEL = 8e6;

  function boyutla(cv, w, h, tavan = 2) {
    const dpr = Math.min(tavan, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    return dpr;
  }

  // Dünya uzayında (ww × wh birim) offscreen katman; o = birim başına piksel (dpr · sr). Sınırlara göre o düşürülür.
  function katmanOlcegi(ww, wh, o) {
    return Math.max(.25, Math.min(o, KENAR / ww, KENAR / wh, Math.sqrt(PIKSEL / (ww * wh))));
  }
  function katman(ww, wh, o) {
    const cv = document.createElement('canvas'), k = { cv, ctx: cv.getContext('2d'), ww: 0, wh: 0, o: 1 };
    katmanBoyutla(k, ww, wh, o);
    return k;
  }
  function katmanBoyutla(k, ww, wh, o) {
    k.o = katmanOlcegi(ww, wh, o); k.ww = ww; k.wh = wh;
    k.cv.width = Math.max(1, Math.ceil(ww * k.o)); k.cv.height = Math.max(1, Math.ceil(wh * k.o));
    k.ctx.setTransform(k.o, 0, 0, k.o, 0, 0);
  }
  function temizle(k) { const c = k.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.cv.width, k.cv.height); c.restore(); }

  // rough ops → darbeler. drawable.sets[i].ops: move / lineTo / bcurveTo
  function parcalar(dr, o = {}) {
    const enAz = o.enAz ?? 2, s = [];
    for (const set of dr.sets) {
      if (set.type === 'fillPath') {
        const p = new Path2D();
        for (const op of set.ops) yolEkle(p, op);
        p.closePath();
        s.push({ tip: 'dolgu', yol: p, L: 0 });
        continue;
      }
      let p = null, L = 0, x = 0, y = 0;
      const bitir = () => { if (p && L >= enAz) s.push({ tip: 'cizgi', yol: p, L }); p = null; L = 0; };
      for (const op of set.ops) {
        const d = op.data;
        if (op.op === 'move') { bitir(); p = new Path2D(); p.moveTo(d[0], d[1]); x = d[0]; y = d[1]; }
        else if (op.op === 'lineTo') { p.lineTo(d[0], d[1]); L += Math.hypot(d[0] - x, d[1] - y); x = d[0]; y = d[1]; }
        else if (op.op === 'bcurveTo') {
          p.bezierCurveTo(d[0], d[1], d[2], d[3], d[4], d[5]);
          let px = x, py = y;
          for (let t = .25; t <= 1.001; t += .25) {
            const u = 1 - t, qx = u * u * u * x + 3 * u * u * t * d[0] + 3 * u * t * t * d[2] + t * t * t * d[4];
            const qy = u * u * u * y + 3 * u * u * t * d[1] + 3 * u * t * t * d[3] + t * t * t * d[5];
            L += Math.hypot(qx - px, qy - py); px = qx; py = qy;
          }
          x = d[4]; y = d[5];
        }
      }
      bitir();
    }
    return s;
  }
  function yolEkle(p, op) {
    const d = op.data;
    if (op.op === 'move') p.moveTo(d[0], d[1]);
    else if (op.op === 'lineTo') p.lineTo(d[0], d[1]);
    else if (op.op === 'bcurveTo') p.bezierCurveTo(d[0], d[1], d[2], d[3], d[4], d[5]);
  }
  function birlesik(ps) { const p = new Path2D(); for (const x of ps) if (x.tip === 'cizgi') p.addPath(x.yol); return p; }
  const toplamUzunluk = (ps) => ps.reduce((a, x) => a + x.L, 0);

  // Darbeleri sırayla çizer; ilerleme < 1 ise ilk kısmı (kalemin o ana kadar çizdiği). Stil önceden ctx'e kurulur.
  // o.alfalar: darbe başına alfa çarpanı (baskı); o.renk dolgu için
  function cizParcalar(ctx, ps, o = {}) {
    const il = o.ilerleme ?? 1, T = il < 1 ? toplamUzunluk(ps) * il : Infinity, a0 = ctx.globalAlpha;
    let gidilen = 0;
    for (let i = 0; i < ps.length; i++) {
      const x = ps[i];
      if (x.tip === 'dolgu') { if (il >= 1) ctx.fill(x.yol); continue; }
      if (gidilen >= T) break;
      if (o.alfalar) ctx.globalAlpha = a0 * o.alfalar[i % o.alfalar.length];
      const kalan = T - gidilen;
      if (kalan < x.L) { ctx.setLineDash([Math.max(.01, kalan), x.L + 10]); ctx.lineDashOffset = 0; ctx.stroke(x.yol); ctx.setLineDash([]); }
      else ctx.stroke(x.yol);
      gidilen += x.L;
    }
    ctx.globalAlpha = a0;
  }

  // Bir drawable'ı noktalara (düzleştirilmiş) çevirir: kalınlığı değişen çizgiler için
  function noktalar(dr, adim = 6) {
    const s = [];
    for (const set of dr.sets) {
      let x = 0, y = 0, liste = null;
      for (const op of set.ops) {
        const d = op.data;
        if (op.op === 'move') { liste = [[d[0], d[1]]]; s.push(liste); x = d[0]; y = d[1]; }
        else if (op.op === 'lineTo') { liste.push([d[0], d[1]]); x = d[0]; y = d[1]; }
        else if (op.op === 'bcurveTo') {
          const L = Math.hypot(d[4] - x, d[5] - y), n = Math.max(2, Math.ceil(L / adim));
          for (let k = 1; k <= n; k++) {
            const t = k / n, u = 1 - t;
            liste.push([u * u * u * x + 3 * u * u * t * d[0] + 3 * u * t * t * d[2] + t * t * t * d[4], u * u * u * y + 3 * u * u * t * d[1] + 3 * u * t * t * d[3] + t * t * t * d[5]]);
          }
          x = d[4]; y = d[5];
        }
      }
    }
    return s;
  }

  // Tohumlu desenler (bir kez üretilir). uret(ctx, N) N×N canvas'a çizer.
  const desenler = new Map();
  function desen(ad, N, uret) {
    if (desenler.has(ad)) return desenler.get(ad);
    const c = document.createElement('canvas'); c.width = c.height = N;
    uret(c.getContext('2d'), N);
    const p = c.getContext('2d').createPattern(c, 'repeat');
    const k = { cv: c, desen: p };
    desenler.set(ad, k);
    return k;
  }

  const olcum = { n: 0, toplam: 0, en: 0, son: [] };
  function olc(ms) { olcum.n++; olcum.toplam += ms; olcum.en = Math.max(olcum.en, ms); olcum.son.push(ms); if (olcum.son.length > 240) olcum.son.shift(); }
  function olcumSifirla() { olcum.n = 0; olcum.toplam = 0; olcum.en = 0; olcum.son.length = 0; }
  function olcumOzet() {
    const s = olcum.son.slice().sort((a, b) => a - b);
    return { n: olcum.n, ort: olcum.n ? olcum.toplam / olcum.n : 0, en: olcum.en, p95: s.length ? s[Math.floor(s.length * .95)] : 0 };
  }

  Kit.tuval = { gen, boyutla, katman, katmanBoyutla, katmanOlcegi, temizle, parcalar, birlesik, toplamUzunluk, cizParcalar, noktalar, desen, olcum, olc, olcumSifirla, olcumOzet };
})();
