// ui/tahta.js — görünen tek canvas, dünya uzayında offscreen katmanlar, kamera ve kare döngüsü (labirent sahne.js kalıbı).
// Dünya: ızgara [0, W] × [0, H] (b birim kare), satır ipucu bandı x ∈ [−Lw, 0], sütun bandı y ∈ [−Lh, 0]; 1 birim = s = 1'de 1 css px.
// Kamera: ekran = t + dünya · s. Yakınlaşınca bantlar yapışkandır: satır bandı yalnız dikeyde, sütun bandı yalnız yatayda kayar.
// Katmanlar kameranın ölçeğine yakın çözünürlükte (o = dpr · sr; b · o tam sayı → kare sınırları tam piksel).
// Kare yalnız gerektiğinde çizilir. Üst katmanlar ekran uzayında: ustler: (ctx, D, zaman) → devam?
(function () {
  'use strict';
  const KK = (window.KK = window.KK || {});
  const T = Kit.tuval;

  const S = {
    cv: null, ctx: null, w: 1, h: 1, dpr: 1,
    G: null,                                           // { b, en, boy, W, H, Lw, Lh }
    kam: { s: 1, tx: 0, ty: 0, s0: 1, smin: 1, smax: 3 },
    o: 1, kat: new Map(), ustler: [], oncesi: [], hedef: null, gizliBant: false,
  };
  let istek = 0, yenidenZaman = 0;

  function kur(cv) { S.cv = cv; S.ctx = cv.getContext('2d'); }
  function boyutla(w, h) { S.w = w; S.h = h; S.dpr = T.boyutla(S.cv, w, h, KK.config.dprTavan); kirli(); }

  // Geometri ve katman tanımları (bulmaca değişince)
  function yukle(G) { S.G = G; for (const k of S.kat.values()) k.boyutsuz = true; }
  function katman(ad, o) {
    let k = S.kat.get(ad);
    if (!k) { const cv = document.createElement('canvas'); k = { cv, ctx: cv.getContext('2d') }; S.kat.set(ad, k); }
    Object.assign(k, { x0: o.x0, y0: o.y0, ww: o.ww, wh: o.wh, ciz: o.ciz, gizli: !!o.gizli, harman: o.harman || null });
    katmanBoyutla(k);
    return k;
  }
  function katmanBoyutla(k) {
    const o = Math.min(S.o, T.katmanOlcegi(k.ww, k.wh, S.o));
    k.o = o;
    k.cv.width = Math.max(1, Math.ceil(k.ww * o)); k.cv.height = Math.max(1, Math.ceil(k.wh * o));
    k.ctx.setTransform(o, 0, 0, o, -k.x0 * o, -k.y0 * o);
  }
  function temizle(k, x, y, w, h) {
    const c = k.ctx;
    if (x == null) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.cv.width, k.cv.height); c.restore(); }
    else c.clearRect(x, y, w, h);
  }
  function yenidenCiz(ad) {
    for (const [n, k] of S.kat) if (!ad || n === ad) { temizle(k); if (k.ciz) k.ciz(k.ctx); }
    kirli();
  }

  // Çözünürlük: o · b tam sayı; en büyük katmana göre sınır
  function srAyarla(s) {
    const G = S.G, b = G.b, istenen = S.dpr * s;
    let o = Math.max(1, Math.round(istenen * b)) / b;
    const tavan = T.katmanOlcegi(G.W + G.Lw, G.H + G.Lh, o);
    if (tavan < o) o = Math.max(1, Math.floor(tavan * b)) / b;
    S.o = o;
    for (const k of S.kat.values()) katmanBoyutla(k);
  }

  function kameraKur(o) {
    const k = S.kam;
    Object.assign(k, { s0: o.s0, smin: o.smin, smax: o.smax });
    k.s = o.s ?? o.s0;
    srAyarla(k.s);
    if (o.odak) odakla(o.odak, true); else { k.tx = 1e9; k.ty = 1e9; sinirla(); }   // odak yoksa sol üst köşe
    yenidenCiz();
  }
  function sinirla() {
    const k = S.kam, G = S.G, s = k.s, bx = G.Lw * s, by = G.Lh * s, gw = G.W * s, gh = G.H * s;
    k.tx = bx + gw <= S.w + .5 ? (S.w - bx - gw) / 2 + bx : Math.min(bx, Math.max(S.w - gw, k.tx));
    k.ty = by + gh <= S.h + .5 ? (S.h - by - gh) / 2 + by : Math.min(by, Math.max(S.h - gh, k.ty));
  }
  // Izgara noktası ekranın görünen ızgara alanının ortasına
  function odakla([x, y], anlik = true) {
    const k = S.kam, G = S.G, bx = G.Lw * k.s, by = G.Lh * k.s;
    const tx = bx + (S.w - bx) / 2 - x * k.s, ty = by + (S.h - by) / 2 - y * k.s;
    if (anlik) { k.tx = tx; k.ty = ty; S.hedef = null; sinirla(); } else S.hedef = [tx, ty];
    kirli();
  }
  const ekrana = ([x, y]) => [S.kam.tx + x * S.kam.s, S.kam.ty + y * S.kam.s];
  const dunyaya = ([x, y]) => [(x - S.kam.tx) / S.kam.s, (y - S.kam.ty) / S.kam.s];

  function yakinlas(s, [ox, oy], anlik) {
    const k = S.kam, s2 = Math.min(k.smax, Math.max(k.smin, s)), [wx, wy] = dunyaya([ox, oy]);
    k.s = s2; k.tx = ox - wx * s2; k.ty = oy - wy * s2;
    sinirla(); kirli();
    clearTimeout(yenidenZaman);
    const yap = () => { if (Math.abs(S.o / (S.dpr * k.s) - 1) > KK.config.yenidenOran) { srAyarla(k.s); yenidenCiz(); } };
    if (anlik) yap(); else yenidenZaman = setTimeout(yap, 220);
  }
  function kaydir(dx, dy) { S.kam.tx += dx; S.kam.ty += dy; sinirla(); S.hedef = null; kirli(); }
  // Klavye imleci görünen ızgaranın orta bandından (%25–%75) çıkarsa kamera yumuşakça izler
  function takip(r, c) {
    const k = S.kam, G = S.G, D = donusum();
    const x = k.tx + (c + .5) * G.b * k.s, y = k.ty + (r + .5) * G.b * k.s;
    const x0 = D.gx0 + (S.w - D.gx0) * .2, x1 = D.gx0 + (S.w - D.gx0) * .8, y0 = D.gy0 + (S.h - D.gy0) * .2, y1 = D.gy0 + (S.h - D.gy0) * .8;
    let dx = 0, dy = 0;
    if (x < x0) dx = x0 - x; else if (x > x1) dx = x1 - x;
    if (y < y0) dy = y0 - y; else if (y > y1) dy = y1 - y;
    if (dx || dy) { S.hedef = [k.tx + dx, k.ty + dy]; kirli(); }
  }

  // Ekran dönüşümü: yapışkan bantların yeri ve görünen ızgara alanı
  function donusum(kam = S.kam, yapiskan = true) {
    const G = S.G, s = kam.s, bx = G.Lw * s, by = G.Lh * s;
    const bandX = yapiskan ? Math.max(0, kam.tx - bx) : kam.tx - bx, bandY = yapiskan ? Math.max(0, kam.ty - by) : kam.ty - by;
    return { s, tx: kam.tx, ty: kam.ty, b: G.b, bx, by, bandX, bandY, gx0: bandX + bx, gy0: bandY + by, w: S.w, h: S.h, G };
  }

  // Dünya katmanlarını ctx'e (ekran css px, dpr dönüşümü kurulmuş) bindirir. o.kirp: [x, y, w, h] ekran
  function birlestir(ctx, kam = S.kam, o = {}) {
    const D = donusum(kam, o.yapiskan !== false), G = S.G, s = D.s;
    const ek = o.kirp || [0, 0, S.w, S.h];
    const blit = (k, wx0, wy0, wx1, wy1, sx, sy) => {
      if (!k || k.gizli || wx1 <= wx0 || wy1 <= wy0) return;
      const px = (wx0 - k.x0) * k.o, py = (wy0 - k.y0) * k.o;
      const pw = Math.min(k.cv.width - px, (wx1 - wx0) * k.o), ph = Math.min(k.cv.height - py, (wy1 - wy0) * k.o);
      if (pw <= 0 || ph <= 0) return;
      if (k.harman) ctx.globalCompositeOperation = k.harman;
      ctx.drawImage(k.cv, px, py, pw, ph, sx, sy, pw / k.o * s, ph / k.o * s);
      if (k.harman) ctx.globalCompositeOperation = 'source-over';
    };
    // ızgara görüş alanı
    const vx0 = Math.max(D.gx0, ek[0]), vy0 = Math.max(D.gy0, ek[1]), vx1 = Math.min(S.w, ek[0] + ek[2]), vy1 = Math.min(S.h, ek[1] + ek[3]);
    const wx0 = Math.max(0, (vx0 - D.tx) / s), wy0 = Math.max(0, (vy0 - D.ty) / s), wx1 = Math.min(G.W, (vx1 - D.tx) / s), wy1 = Math.min(G.H, (vy1 - D.ty) / s);
    ctx.save();
    ctx.beginPath(); ctx.rect(vx0, vy0, Math.max(0, vx1 - vx0), Math.max(0, vy1 - vy0)); ctx.clip();
    for (const ad of ['zemin', 'isaret', 'boya']) blit(S.kat.get(ad), wx0, wy0, wx1, wy1, D.tx + wx0 * s, D.ty + wy0 * s);
    ctx.restore();
    if (S.gizliBant) return D;
    // satır bandı (yalnız dikeyde kayar)
    ctx.save();
    ctx.beginPath(); ctx.rect(Math.max(D.bandX, ek[0]), vy0, D.bx, Math.max(0, vy1 - vy0)); ctx.clip();
    blit(S.kat.get('satir'), -G.Lw, wy0, 0, wy1, D.bandX, D.ty + wy0 * s);
    ctx.restore();
    // sütun bandı (yalnız yatayda kayar)
    ctx.save();
    ctx.beginPath(); ctx.rect(vx0, Math.max(D.bandY, ek[1]), Math.max(0, vx1 - vx0), D.by); ctx.clip();
    blit(S.kat.get('sutun'), wx0, -G.Lh, wx1, 0, D.tx + wx0 * s, D.bandY);
    ctx.restore();
    // köşe
    const kose = S.kat.get('kose');
    if (kose) ctx.drawImage(kose.cv, 0, 0, kose.cv.width, kose.cv.height, D.bandX, D.bandY, D.bx, D.by);
    return D;
  }

  // Ekran noktasındaki şey: { tur: 'izgara', r, c } | { tur: 'satir', r } | { tur: 'sutun', c } | null
  function hucreBul([x, y]) {
    const D = donusum(), G = S.G, b = G.b * D.s;
    if (x >= D.gx0 && y >= D.gy0) {
      const c = Math.floor((x - D.tx) / b), r = Math.floor((y - D.ty) / b);
      if (r >= 0 && r < G.boy && c >= 0 && c < G.en) return { tur: 'izgara', r, c };
      return null;
    }
    if (x >= D.bandX && x < D.gx0 && y >= D.gy0) { const r = Math.floor((y - D.ty) / b); return r >= 0 && r < G.boy ? { tur: 'satir', r } : null; }
    if (y >= D.bandY && y < D.gy0 && x >= D.gx0) { const c = Math.floor((x - D.tx) / b); return c >= 0 && c < G.en ? { tur: 'sutun', c } : null; }
    return null;
  }
  // Izgara kare koordinatı (sınır dışı da olabilir, kesirli)
  const kareKoordinat = ([x, y]) => { const b = S.G.b * S.kam.s; return [(y - S.kam.ty) / b, (x - S.kam.tx) / b]; };

  function kirli() { if (!istek && S.ctx) istek = requestAnimationFrame(kare); }
  function kare(zaman) {
    istek = 0;
    if (!S.G) return;
    const t0 = performance.now(), k = S.kam, ctx = S.ctx;
    let devam = false;
    if (S.hedef) {
      k.tx += (S.hedef[0] - k.tx) * .25; k.ty += (S.hedef[1] - k.ty) * .25;
      if (Math.abs(S.hedef[0] - k.tx) < .5 && Math.abs(S.hedef[1] - k.ty) < .5) S.hedef = null; else devam = true;
      sinirla();
    }
    for (const f of S.oncesi) if (f(zaman)) devam = true;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);
    const D = birlestir(ctx);
    for (const f of S.ustler) if (f(ctx, D, zaman)) devam = true;
    T.olc(performance.now() - t0);
    if (devam) kirli();
  }

  Object.assign(S, { kur, boyutla, yukle, katman, temizle, yenidenCiz, srAyarla, kameraKur, sinirla, odakla, ekrana, dunyaya, yakinlas, kaydir, takip, donusum, birlestir, hucreBul, kareKoordinat, kirli });
  KK.tahta = S;
})();
