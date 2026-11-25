// kit/boyama.js — "kuru boya boyama" (canvas): bir kareyi verilen renkle iki üç yönlü, mumsu ve taneli vuruşlarla boyar;
// kenardan 1–2 px taşar (kırpılmaz). Katman multiply ile bindirilir; maskele() kağıdın dişlerini açar.
// Kit.kuruboya.karala'nın (SVG) canvas karşılığı. Gerektirir: Kit.tuval, Kit.kalem.
//   Kit.boyama.hucre(ctx, x, y, b, { renk: '#a8322d', tohum: ['boya', r, c] })
(function () {
  'use strict';
  const Kit = window.Kit;
  const T = Kit.tuval, KL = Kit.kalem;
  // 12'li kuru boya kutusu
  const PALET12 = {
    siyah: '#2b2b2b', gri: '#8d8d8d', kahve: '#6b4423', kirmizi: '#a8322d', turuncu: '#e07a1f', hardal: '#c9a227',
    acikyesil: '#7dbb57', koyuyesil: '#2e7d32', acikmavi: '#5dade2', lacivert: '#23395d', mor: '#6a4c93', pembe: '#e8a0bf',
  };
  const SIRA = Object.keys(PALET12);
  const AD = { siyah: 'siyah', gri: 'gri', kahve: 'kahverengi', kirmizi: 'kırmızı', turuncu: 'turuncu', hardal: 'hardal', acikyesil: 'açık yeşil', koyuyesil: 'koyu yeşil', acikmavi: 'açık mavi', lacivert: 'lacivert', mor: 'mor', pembe: 'pembe' };
  const KREM = '#f3e8d0';
  const renk = (r) => PALET12[r] || r;

  const onbellek = new Map();
  function vurus(tohum) {
    const k = tohum.join('|');
    if (onbellek.has(k)) return onbellek.get(k);
    const r = KL.rastgele('boyama', ...tohum), s = KL.tohum('boyama', ...tohum);
    const kose = () => KL.aralik(r, 3, 9);
    const cokgen = (i, t) => {
      const u = t[0], s2 = t[1], a = t[2], l = t[3];
      return [[-l + i + kose(), -u + i], [100 + s2 - i - kose(), -u + i], [100 + s2 - i, -u + i + kose()], [100 + s2 - i, 100 + a - i - kose()],
        [100 + s2 - i - kose(), 100 + a - i], [-l + i + kose(), 100 + a - i], [-l + i, 100 + a - i - kose()], [-l + i, -u + i + kose()]];
    };
    const aci = (r() < .5 ? 1 : -1) * KL.aralik(r, 18, 72), z = r() < .72;
    const t = [KL.aralik(r, .3, 1), KL.aralik(r, .3, 1), KL.aralik(r, .3, 1), KL.aralik(r, .3, 1)];
    const v = {
      t, aci, z, ikinci: r() < .55,
      gap1: KL.aralik(r, 10, 13), w1: KL.aralik(r, 10, 12.5), a1: KL.aralik(r, .55, .7), rough1: KL.aralik(r, .85, 1.25), bow1: KL.aralik(r, .5, 1.1),
      gap2: KL.aralik(r, 15, 22), w2: KL.aralik(r, 6, 8), a2: KL.aralik(r, .32, .44), aci2: aci + KL.aralik(r, 70, 110),
      cokgen, seed: s, r,
    };
    onbellek.set(k, v);
    return v;
  }
  const yapilmis = new Map();
  function sekil(tohum, tasmaBirim) {
    const k = tohum.join('|') + '|' + tasmaBirim.toFixed(1);
    if (yapilmis.has(k)) return yapilmis.get(k);
    const v = vurus(tohum);
    const t = v.t.map(x => x * tasmaBirim);
    const p1 = v.cokgen(0, t), p2 = v.cokgen(4, t);
    const d1 = T.gen().polygon(p1, { stroke: 'none', fill: '#000', fillStyle: v.z ? 'zigzag' : 'hachure', hachureAngle: v.aci, hachureGap: v.gap1, fillWeight: v.w1, roughness: v.rough1, bowing: v.bow1, disableMultiStroke: true, seed: v.seed });
    const d2 = v.ikinci ? T.gen().polygon(p2, { stroke: 'none', fill: '#000', fillStyle: 'hachure', hachureAngle: v.aci2, hachureGap: v.gap2, fillWeight: v.w2, roughness: 1.5, bowing: 1.2, disableMultiStrokeFill: true, seed: v.seed + 1 }) : null;
    const s = { p1: T.parcalar(d1, { enAz: 3 }), p2: d2 ? T.parcalar(d2, { enAz: 3 }) : [], v };
    yapilmis.set(k, s);
    if (yapilmis.size > 4000) yapilmis.delete(yapilmis.keys().next().value);
    return s;
  }

  // o: { renk, tohum, tasma: [1, 2] px, ilerleme }
  function hucre(ctx, x, y, b, o = {}) {
    const [ta, tb] = o.tasma || [1, 2], tasmaBirim = ((ta + tb) / 2) * 100 / b;
    const s = sekil(o.tohum || ['boya', x, y], tasmaBirim), il = o.ilerleme ?? 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(b / 100, b / 100);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = renk(o.renk || 'kirmizi');
    const ilk = s.p2.length ? Math.min(1, il / .74) : il;
    ctx.lineWidth = s.v.w1; ctx.globalAlpha = s.v.a1 * (o.alfa ?? 1);
    T.cizParcalar(ctx, s.p1, { ilerleme: ilk });
    if (s.p2.length && il > .7) {
      ctx.lineWidth = s.v.w2; ctx.globalAlpha = s.v.a2 * (o.alfa ?? 1);
      T.cizParcalar(ctx, s.p2, { ilerleme: (il - .7) / .3 });
    }
    ctx.restore();
  }
  // Zemin yıkaması: boş karelerde çok hafif renk
  function yikama(ctx, x, y, b, o = {}) {
    const r = KL.rastgele('yikama', ...(o.tohum || [x, y]));
    ctx.save();
    ctx.fillStyle = renk(o.renk || KREM); ctx.globalAlpha = (o.alfa ?? .35) * KL.aralik(r, .8, 1.1);
    ctx.fillRect(x - .5, y - .5, b + 1, b + 1);
    ctx.restore();
  }

  // Tane: kağıdın dişleri (boya tutmayan küçük noktalar); destination-out ile boyadan silinir
  function tane() {
    return T.desen('kuruboya-tane', 160, (c, N) => {
      const r = KL.rastgele('kuruboya', 'tane'), ham = new Float32Array(N * N);
      for (let i = 0; i < ham.length; i++) ham[i] = r();
      const G = 8, iri = new Float32Array(G * G);
      for (let i = 0; i < iri.length; i++) iri[i] = r();
      const yum = (f) => f * f * (3 - 2 * f), img = c.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += ham[((y + dy + N) % N) * N + (x + dx + N) % N];
        const gx = x / N * G, gy = y / N * G, i0 = Math.floor(gx), j0 = Math.floor(gy);
        const fx = yum(gx - i0), fy = yum(gy - j0), i1 = (i0 + 1) % G, j1 = (j0 + 1) % G;
        const a = iri[j0 * G + i0] + (iri[j0 * G + i1] - iri[j0 * G + i0]) * fx, bb = iri[j1 * G + i0] + (iri[j1 * G + i1] - iri[j1 * G + i0]) * fx;
        const v = .86 * (s / 9) + .14 * (a + (bb - a) * fy), L = Math.min(1, Math.max(0, (v - .355) / .12));
        const k = (y * N + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(255 * (1 - L) * .85);
      }
      c.putImageData(img, 0, 0);
    });
  }
  // Boya katmanında kağıt dişlerini aç (dünya biriminde ölçek: grenin bir pikseli ≈ .65 birim)
  function maskele(ctx, x, y, w, h, olcek = .65) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = tane().desen;
    if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(olcek, olcek));
    ctx.fillStyle = p; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  Kit.boyama = { PALET12, SIRA, AD, KREM, renk, hucre, yikama, maskele, tane };
})();
