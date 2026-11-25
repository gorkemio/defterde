// render/sahne.js — görünen tek canvas, offscreen katmanlar, kamera ve kare döngüsü.
// Görünen alan w × h css px; dünya ww × wh px (labirent kutusu, s = 1'de alana sığar). Kamera dünyayı s kat büyütüp
// (tx, ty) kaydırır; dünya bir eksende alandan küçükse o eksende ortalanır.
// Katmanlar dünyanın üstünde, kameranın o anki ölçeğine yakın çözünürlükte tutulur (sr); yakınlaşma bitince ölçek
// %25'ten çok değiştiyse katmanlar yeniden çizilir. Bir katman en çok 4096 px kenar ve 8 Mpx.
// Kare yalnız gerektiğinde çizilir (kirli ya da süren animasyon). Her karenin iş süresi ölçülür (LB.sahne.olcum).
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});

  const KENAR = 4096, PIKSEL = 8e6, YENIDEN = .25;
  const S = {
    cv: null, ctx: null, w: 0, h: 0, ww: 1, wh: 1, dpr: 1,
    kam: { s: 1, tx: 0, ty: 0, s0: 1, smin: 1, smax: 4 }, sr: 1,
    katmanlar: new Map(),                    // ad → { cv, ctx, ciz(ctx) }
    ustler: [],                               // her kare dünyanın üstüne çizilenler: (ctx, zaman) → devam? (true)
    sarsinti: 0,                              // takılma titremesi bitiş zamanı
    hedef: null,                              // kamera takip hedefi (ekran px)
    olcum: { n: 0, toplam: 0, en: 0, son: [] },
  };
  let istek = 0, yenidenZaman = 0;

  function kur(cv) { S.cv = cv; S.ctx = cv.getContext('2d'); }

  // Görünen alanın boyu
  function boyutla(w, h) {
    S.w = w; S.h = h; S.dpr = Math.min(LB.config.dprTavan, window.devicePixelRatio || 1);
    S.cv.width = Math.round(w * S.dpr); S.cv.height = Math.round(h * S.dpr);
    S.cv.style.width = w + 'px'; S.cv.style.height = h + 'px';
  }

  // Kamera: s0 varsayılan yakınlık (koridor ≥ minHucrePx), smin = bütün labirent, smax = koridor ~56 px
  function kameraKur(ww, wh, koridor, odak) {
    const k = S.kam;
    S.ww = ww; S.wh = wh;
    k.smin = 1;
    k.s0 = Math.max(1, LB.config.minHucrePx / koridor);
    if (k.s0 < 1.03) k.s0 = 1;                 // birkaç piksel için labirenti kesmektense bütün göster (koridor ≥ %97)
    k.smax = Math.max(k.s0 * 1.5, 56 / koridor);
    k.s = k.s0;
    odakla(odak, true);
    srAyarla(k.s);
  }

  function sinirla() {
    const k = S.kam, gw = S.ww * k.s, gh = S.wh * k.s;
    k.tx = gw <= S.w ? (S.w - gw) / 2 : Math.min(0, Math.max(S.w - gw, k.tx));
    k.ty = gh <= S.h ? (S.h - gh) / 2 : Math.min(0, Math.max(S.h - gh, k.ty));
  }
  // Dünya noktasını ekranın ortasına getirir
  function odakla([x, y], anlik) {
    const k = S.kam;
    k.tx = S.w / 2 - x * k.s; k.ty = S.h / 2 - y * k.s;
    sinirla();
    if (anlik) S.hedef = null;
    kirli();
  }
  const ekrana = ([x, y]) => [S.kam.tx + x * S.kam.s, S.kam.ty + y * S.kam.s];
  const dunyaya = ([x, y]) => [(x - S.kam.tx) / S.kam.s, (y - S.kam.ty) / S.kam.s];

  // Ekrandaki (ox, oy) noktası yerinde kalarak ölçeği s yap
  function yakinlas(s, [ox, oy]) {
    const k = S.kam, s2 = Math.min(k.smax, Math.max(k.smin, s)), [wx, wy] = dunyaya([ox, oy]);
    k.s = s2; k.tx = ox - wx * s2; k.ty = oy - wy * s2;
    sinirla(); kirli();
    clearTimeout(yenidenZaman);
    yenidenZaman = setTimeout(() => { if (Math.abs(k.s / S.sr - 1) > YENIDEN) { srAyarla(k.s); katmanlariCiz(); } }, 220);
  }
  function kaydir(dx, dy) { S.kam.tx += dx; S.kam.ty += dy; sinirla(); S.hedef = null; kirli(); }

  // Kalem ucu ekranın orta bandından (%30–%70) çıkınca kamera yumuşakça izler
  function takip(p) {
    const k = S.kam;
    if (S.ww * k.s <= S.w + 1 && S.wh * k.s <= S.h + 1) return;
    const [x, y] = ekrana(p), a = .3, b = .7;
    let dx = 0, dy = 0;
    if (x < S.w * a) dx = S.w * a - x; else if (x > S.w * b) dx = S.w * b - x;
    if (y < S.h * a) dy = S.h * a - y; else if (y > S.h * b) dy = S.h * b - y;
    if (dx || dy) { S.hedef = [k.tx + dx, k.ty + dy]; kirli(); }
  }

  function srAyarla(s) {
    const tavan = Math.min(KENAR / (S.ww * S.dpr), KENAR / (S.wh * S.dpr), Math.sqrt(PIKSEL / (S.ww * S.wh * S.dpr * S.dpr)));
    S.sr = Math.max(.5, Math.min(s, tavan));
    for (const k of S.katmanlar.values()) boyutKatman(k);
  }
  function boyutKatman(k) {
    k.cv.width = Math.ceil(S.ww * S.dpr * S.sr); k.cv.height = Math.ceil(S.wh * S.dpr * S.sr);
    k.ctx.setTransform(S.dpr * S.sr, 0, 0, S.dpr * S.sr, 0, 0);
  }

  // Katman: dünya koordinatında çizilen offscreen canvas. ciz(ctx) baştan çizer (çözünürlük değişince çağrılır).
  function katman(ad, ciz, sira = 0) {
    let k = S.katmanlar.get(ad);
    if (!k) {
      const cv = document.createElement('canvas');
      k = { cv, ctx: cv.getContext('2d'), ciz, sira, gizli: false };
      S.katmanlar.set(ad, k);
      boyutKatman(k);
    }
    k.ciz = ciz; k.sira = sira;
    return k;
  }
  function temizle(k) { k.ctx.save(); k.ctx.setTransform(1, 0, 0, 1, 0, 0); k.ctx.clearRect(0, 0, k.cv.width, k.cv.height); k.ctx.restore(); }
  function katmanlariCiz() { for (const k of S.katmanlar.values()) { temizle(k); if (k.ciz) k.ciz(k.ctx); } kirli(); }

  function sars(ms = 80) { S.sarsinti = performance.now() + ms; kirli(); }

  function kirli() { if (!istek) istek = requestAnimationFrame(kare); }

  function kare(zaman) {
    istek = 0;
    const t0 = performance.now(), k = S.kam, ctx = S.ctx;
    let devam = false;
    if (S.hedef) {
      k.tx += (S.hedef[0] - k.tx) * .22; k.ty += (S.hedef[1] - k.ty) * .22;
      if (Math.abs(S.hedef[0] - k.tx) < .5 && Math.abs(S.hedef[1] - k.ty) < .5) S.hedef = null; else devam = true;
      sinirla();
    }
    for (const f of S.oncesi || []) if (f(zaman)) devam = true;
    let ox = 0, oy = 0;
    if (t0 < S.sarsinti) { ox = (Math.random() - .5) * 2; oy = (Math.random() - .5) * 2; devam = true; }
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);
    // Yalnız görünen dünya dikdörtgeni kopyalanır (yakınlaşınca katmanın küçük bir parçası)
    const wx0 = Math.max(0, -k.tx / k.s), wy0 = Math.max(0, -k.ty / k.s);
    const wx1 = Math.min(S.ww, (S.w - k.tx) / k.s), wy1 = Math.min(S.wh, (S.h - k.ty) / k.s), o2 = S.dpr * S.sr;
    const liste = [...S.katmanlar.values()].filter(x => !x.gizli).sort((a, b) => a.sira - b.sira);
    if (wx1 > wx0 && wy1 > wy0) for (const kat of liste) {
      const titre = kat.titrer ? 1 : 0;
      const sx = wx0 * o2, sy = wy0 * o2, sw = Math.min(kat.cv.width - sx, (wx1 - wx0) * o2), sh = Math.min(kat.cv.height - sy, (wy1 - wy0) * o2);
      if (sw > 0 && sh > 0) ctx.drawImage(kat.cv, sx, sy, sw, sh, k.tx + wx0 * k.s + ox * titre, k.ty + wy0 * k.s + oy * titre, sw / o2 * k.s, sh / o2 * k.s);
    }
    ctx.setTransform(S.dpr * k.s, 0, 0, S.dpr * k.s, S.dpr * (k.tx + ox), S.dpr * (k.ty + oy));
    for (const f of S.ustler) if (f(ctx, zaman)) devam = true;
    const is = performance.now() - t0, o = S.olcum;
    o.n++; o.toplam += is; o.en = Math.max(o.en, is); o.son.push(is); if (o.son.length > 120) o.son.shift();
    if (devam) kirli();
  }

  function olcumSifirla() { S.olcum = { n: 0, toplam: 0, en: 0, son: [] }; }

  Object.assign(S, { kur, boyutla, kameraKur, odakla, yakinlas, kaydir, takip, ekrana, dunyaya, katman, temizle, katmanlariCiz, srAyarla, sars, kirli, olcumSifirla, oncesi: [] });
  LB.sahne = S;
})();
