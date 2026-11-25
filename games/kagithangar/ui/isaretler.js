// Dünyaya ait katlama işaretleri: tükenmez kalemle (rough.js). Kağıdın üstüne çizilir ama kağıda ait değildir.
// Origami geleneği: vadi kesikli çizgi, dağ nokta-çizgi; tut'tan hedefe kıvrık ok; tut'ta kurşun kalem halkası;
// hedefte silik hayalet işaret.
const KL = () => window.Kit.kalem;

export function vadiCizgisi(K, g, [a, b], an, o = {}) {
  return K.cizgi(g, [a[0], a[1], b[0], b[1]],
    { stroke: KL().renkDeger('mavi'), strokeWidth: 1.5, strokeLineDash: [8, 6], roughness: .8 },
    ['vadi', ...an], { anlik: true, ...o });
}

export function dagCizgisi(K, g, [a, b], an, o = {}) {
  return K.cizgi(g, [a[0], a[1], b[0], b[1]],
    { stroke: KL().renkDeger('mavi'), strokeWidth: 1.5, strokeLineDash: [10, 4, 2, 4], roughness: .8 },
    ['dag', ...an], { anlik: true, ...o });
}

// a'dan b'ye kıvrık ok. bukum: oka dik sapma oranı (işaret yönü belirler).
export function kivrikOk(K, g, a, b, an, o = {}) {
  const bukum = o.bukum ?? .28;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const orta = [mx - dy * bukum, my + dx * bukum];
  const renk = { stroke: KL().renkDeger(o.renk || 'mavi'), strokeWidth: 1.4 };
  const govde = K.egri(g, [a, orta, b], renk, ['ok', ...an], { gecikme: o.gecikme, anlik: o.anlik });
  // uç: son teğete göre iki kısa çizgi
  const tx = b[0] - orta[0], ty = b[1] - orta[1];
  const L = Math.hypot(tx, ty) || 1, ux = tx / L, uy = ty / L, u = o.uc ?? 9;
  const sol = [b[0] - u * (ux * .87 - uy * .5), b[1] - u * (uy * .87 + ux * .5)];
  const sag = [b[0] - u * (ux * .87 + uy * .5), b[1] - u * (uy * .87 - ux * .5)];
  const gec = (o.gecikme || 0) + govde.sure;
  K.cizgi(g, [b[0], b[1], sol[0], sol[1]], renk, ['ok-u1', ...an], { gecikme: gec, anlik: o.anlik });
  K.cizgi(g, [b[0], b[1], sag[0], sag[1]], renk, ['ok-u2', ...an], { gecikme: gec, anlik: o.anlik });
  return govde;
}

// Origami "ters çevir" işareti: yatık, neredeyse kapanan bir halka ok (kağıt dikey eksen etrafında döner).
// c: merkez, r: yatay yarıçap.
export function cevirOku(K, g, c, r, an, o = {}) {
  const renk = { stroke: KL().renkDeger(o.renk || 'mavi'), strokeWidth: 1.5 };
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = -0.15 * Math.PI + (i / 18) * 1.6 * Math.PI;
    pts.push([c[0] + r * Math.cos(t), c[1] - r * 0.5 * Math.sin(t)]);
  }
  const govde = K.egri(g, pts, renk, ['cevir-ok', ...an], { anlik: o.anlik });
  const b = pts[pts.length - 1], a = pts[pts.length - 2];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, u = o.uc ?? 10;
  const gec = govde.sure;
  K.cizgi(g, [b[0], b[1], b[0] - u * (ux * .87 - uy * .5), b[1] - u * (uy * .87 + ux * .5)], renk, ['cevir-u1', ...an], { gecikme: gec, anlik: o.anlik });
  K.cizgi(g, [b[0], b[1], b[0] - u * (ux * .87 + uy * .5), b[1] - u * (uy * .87 - ux * .5)], renk, ['cevir-u2', ...an], { gecikme: gec, anlik: o.anlik });
  return govde;
}

// Tutma yeri: kurşun kalem halkası.
export function tutHalkasi(K, g, p, an, o = {}) {
  return K.daire(g, [p[0], p[1], o.cap ?? 22], { stroke: KL().renkDeger('kursun'), strokeWidth: 1.6, roughness: 1.4 },
    ['tut', ...an], o);
}

// Hedef: silik hayalet işaret (kurşun, kesikli küçük daire + nokta).
export function hayalet(K, g, p, an, o = {}) {
  const k = KL().renkDeger('kursun');
  const grup = KL().svgEl('g', { opacity: .55 }, g);
  K.daire(grup, [p[0], p[1], o.cap ?? 16], { stroke: k, strokeWidth: 1.1, strokeLineDash: [2, 3] }, ['hayalet', ...an], { anlik: true });
  K.daire(grup, [p[0], p[1], 3], { stroke: k, fill: k, fillStyle: 'solid', strokeWidth: .8 }, ['hayalet-n', ...an], { anlik: true });
  return grup;
}

// Beşli çetele: dört dik çizgi + çapraz. Karakter puanı gibi sayılar için.
export function cetele(K, g, x, y, n, an, o = {}) {
  const h = o.yukseklik ?? 16, ara = o.ara ?? 5.5;
  const renk = { strokeWidth: o.kalinlik ?? 1.3, ...(o.renk ? { stroke: KL().renkDeger(o.renk) } : {}) };
  let cx = x;
  for (let i = 0; i < n; i++) {
    if (i % 5 === 4) {
      K.cizgi(g, [cx - ara * 4 - 3, y + h * .8, cx + 1, y + h * .15], renk, ['cetele', ...an, i], { anlik: o.anlik });
      cx += ara * 1.6;
    } else {
      K.cizgi(g, [cx, y, cx + .8, y + h], renk, ['cetele', ...an, i], { anlik: o.anlik });
      cx += ara;
    }
  }
  return cx;
}

// Sonsuz katlama çizgisini kutunun (biraz taşarak) içine kırp.
export function cizgiyiKirp([a, b], [x0, y0, x1, y1], tasma = 0.05) {
  const d = [b[0] - a[0], b[1] - a[1]];
  let t0 = -Infinity, t1 = Infinity;
  const sinirlar = [[d[0], a[0], x0 - tasma, x1 + tasma], [d[1], a[1], y0 - tasma, y1 + tasma]];
  for (const [di, ai, lo, hi] of sinirlar) {
    if (Math.abs(di) < 1e-12) { if (ai < lo || ai > hi) return null; continue; }
    let ta = (lo - ai) / di, tb = (hi - ai) / di;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (t1 <= t0) return null;
  return [[a[0] + d[0] * t0, a[1] + d[1] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1]];
}
