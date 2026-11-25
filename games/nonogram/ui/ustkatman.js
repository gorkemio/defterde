// ui/ustkatman.js — üst katman (her kare, ekran uzayında): parmağın satır/sütun şeridi, ipucu çerçevesi, yanlış kare halkaları,
// klavye imleci, sürükleme sayacı ("4"), genel görünüm haritası ve büyüteç.
(function () {
  'use strict';
  const KK = window.KK;
  const T = Kit.tarama, TV = Kit.tuval, RT = Kit.rakamTuval, KL = Kit.kalem;

  const S = {
    serit: null,          // { r, c }
    ipucu: null,          // { tur: 'satir'|'sutun'|'kare', i, r, c, hucreler, bas }
    yanlislar: [],        // [{ r, c, bas, sure }]
    imlec: null,          // { r, c }
    sayac: null,          // { n, x, y }
    buyutec: null,        // { x, y, hedef: { r, c } }
    haritaKutu: null,     // son çizilen harita dikdörtgeni (dokunma için)
    izleKareler: null,    // İzle: o adımda işlenen kareler
  };

  function izgaraDonusumu(ctx, D) { const dpr = KK.tahta.dpr; ctx.setTransform(dpr * D.s, 0, 0, dpr * D.s, dpr * D.tx, dpr * D.ty); }
  function izgaraKirp(ctx, D) { ctx.beginPath(); ctx.rect(D.gx0, D.gy0, D.w - D.gx0, D.h - D.gy0); ctx.clip(); }

  // ipucu çerçevesi: satırı/sütunu silik kalemle çevreleyen titrek dikdörtgen (dünya biriminde saklanır)
  const cerceveler = new Map();
  function cerceveYol(x, y, w, h, t) {
    const k = [x, y, w, h, t].map(v => (typeof v === 'number' ? v.toFixed(1) : v)).join('|');
    if (!cerceveler.has(k)) cerceveler.set(k, TV.parcalar(TV.gen().rectangle(x, y, w, h, { roughness: 1.1, bowing: 1.4, seed: KL.tohum('ipucu', k) }), { enAz: 0 }));
    return cerceveler.get(k);
  }

  function ciz(ctx, D, zaman) {
    const G = KK.tahta.G, b = G.b, simdi = performance.now();
    let devam = false;
    ctx.save();
    // şerit
    if (S.serit) {
      const { r, c } = S.serit, bb = b * D.s;
      ctx.fillStyle = 'rgba(74, 74, 74, .055)';
      if (r != null && r >= 0) { const y = D.ty + r * bb; if (y + bb > D.gy0) ctx.fillRect(D.bandX, Math.max(y, D.gy0), D.w - D.bandX, y + bb - Math.max(y, D.gy0)); }
      if (c != null && c >= 0) { const x = D.tx + c * bb; if (x + bb > D.gx0) ctx.fillRect(Math.max(x, D.gx0), D.bandY, x + bb - Math.max(x, D.gx0), D.h - D.bandY); }
    }
    ctx.restore();
    if (KK.isaretler.animCiz(ctx, D, zaman)) devam = true;
    ctx.save();
    izgaraKirp(ctx, D);
    izgaraDonusumu(ctx, D);
    // ipucu çerçevesi ve işlenecek kareler
    if (S.ipucu) {
      const p = S.ipucu, f = Math.min(1, (simdi - p.bas) / 380);
      if (f < 1) devam = true;
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(74, 74, 74, .75)'; ctx.lineWidth = Math.max(1.2, b * .06) / Math.sqrt(D.s);
      const pay = b * .12;
      const ps = p.tur === 'satir' ? cerceveYol(-pay, p.i * b - pay, G.W + 2 * pay, b + 2 * pay, 's' + p.i)
        : p.tur === 'sutun' ? cerceveYol(p.i * b - pay, -pay, b + 2 * pay, G.H + 2 * pay, 'u' + p.i)
          : cerceveYol(p.c * b - pay, p.r * b - pay, b + 2 * pay, b + 2 * pay, 'k' + p.r + '.' + p.c);
      TV.cizParcalar(ctx, ps, { ilerleme: f });
      if (p.hucreler) for (const h of p.hucreler) {
        ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(simdi / 220);
        T.kalemKare(ctx, h.c * b, h.r * b, b, { tohum: ['ipk', h.r, h.c], renk: '#4a4a4a', kalinlik: Math.max(1, b * .05) });
        ctx.restore(); devam = true;
      }
    }
    if (S.izleKareler) for (const h of S.izleKareler) T.kalemKare(ctx, h.c * b, h.r * b, b, { tohum: ['izk', h.r, h.c], renk: '#b4382e', alfa: .6, kalinlik: Math.max(1, b * .045) });
    // yanlış kareler: kırmızı kalem halka
    S.yanlislar = S.yanlislar.filter(y => !y.sure || simdi - y.bas < y.sure);
    for (const y of S.yanlislar) {
      const f = Math.min(1, (simdi - y.bas) / 260);
      T.halka(ctx, y.c * b, y.r * b, b, { tohum: ['yanlis', y.r, y.c], ilerleme: f, kalinlik: Math.max(1.4, b * .07) });
      devam = true;
    }
    // klavye imleci
    if (S.imlec) T.kalemKare(ctx, S.imlec.c * b, S.imlec.r * b, b, { tohum: ['imlec', S.imlec.r, S.imlec.c], kalinlik: Math.max(1.4, b * .07) });
    ctx.restore();
    // ekran uzayı: harita, sayaç, büyüteç
    ctx.save();
    harita(ctx, D);
    if (S.sayac && S.sayac.n > 1) {
      const by = 22;
      RT.yaz(ctx, String(S.sayac.n), S.sayac.x, S.sayac.y, { boyut: by, hiza: 'orta', tohum: ['sayac', S.sayac.n], zemin: '#fbf9f2', kalinlik: 2.2 });
    }
    if (S.buyutec) buyutec(ctx, D);
    ctx.restore();
    return devam;
  }

  // Genel görünüm haritası: yalnız ızgaranın tamamı görünmüyorken
  function harita(ctx, D) {
    const G = KK.tahta.G, gw = G.W * D.s, gh = G.H * D.s;
    S.haritaKutu = null;
    if (gw <= D.w - D.gx0 + 1 && gh <= D.h - D.gy0 + 1) return;
    const k = KK.isaretler.kucuk, enUzun = KK.config.haritaPx, o = enUzun / Math.max(G.en, G.boy);
    const w = G.en * o, h = G.boy * o, x = D.w - w - 8, y = D.h - h - 8;
    S.haritaKutu = { x, y, w, h };
    ctx.save();
    ctx.globalAlpha = .93; ctx.fillStyle = '#fbf9f2'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(k, x, y, w, h);
    ctx.strokeStyle = 'rgba(74,74,74,.7)'; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
    // görünen alan
    const vx0 = Math.max(0, (D.gx0 - D.tx) / D.s / G.b), vy0 = Math.max(0, (D.gy0 - D.ty) / D.s / G.b);
    const vx1 = Math.min(G.en, (D.w - D.tx) / D.s / G.b), vy1 = Math.min(G.boy, (D.h - D.ty) / D.s / G.b);
    ctx.strokeStyle = '#b4382e'; ctx.lineWidth = 1.6;
    ctx.strokeRect(x + vx0 * o, y + vy0 * o, (vx1 - vx0) * o, (vy1 - vy0) * o);
    ctx.restore();
  }
  function haritadaMi([px, py]) { const k = S.haritaKutu; return k && px >= k.x - 4 && px <= k.x + k.w + 4 && py >= k.y - 4 && py <= k.y + k.h + 4; }
  function haritaOdak([px, py]) {
    const k = S.haritaKutu, G = KK.tahta.G;
    const c = Math.max(0, Math.min(G.en, (px - k.x) / k.w * G.en)), r = Math.max(0, Math.min(G.boy, (py - k.y) / k.h * G.boy));
    KK.tahta.odakla([c * G.b, r * G.b]);
  }

  // Büyüteç: parmağın biraz üstünde, altındaki kareleri iki kat gösteren daire
  let cerceveResmi = null, cerceveDpr = 0;
  function buyutec(ctx, D) {
    const B = KK.config.buyutec, R = B.cap / 2, m = B.oran, t = KK.tahta, k = t.kam;
    let cx = S.buyutec.x, cy = S.buyutec.y - R - B.yukari;
    if (cy - R < 4) { cy = S.buyutec.y + R + B.yukari * .6; cx = S.buyutec.x + (S.buyutec.x < D.w / 2 ? R * 1.2 : -R * 1.2); }
    cx = Math.max(R + 4, Math.min(D.w - R - 4, cx));
    const kam2 = { s: k.s * m, tx: cx - (S.buyutec.x - k.tx) * m, ty: cy - (S.buyutec.y - k.ty) * m };
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#fbf9f2'; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    t.birlestir(ctx, kam2, { yapiskan: false, kirp: [cx - R, cy - R, 2 * R, 2 * R] });
    const h = S.buyutec.hedef;
    if (h) {
      const dpr = t.dpr, b = t.G.b;
      ctx.setTransform(dpr * kam2.s, 0, 0, dpr * kam2.s, dpr * kam2.tx, dpr * kam2.ty);
      T.kalemKare(ctx, h.c * b, h.r * b, b, { tohum: ['hedef', h.r, h.c], kalinlik: 1.6 / m });
    }
    ctx.restore();
    // çerçeve (bir kez çizilir)
    const dpr = t.dpr;
    if (!cerceveResmi || cerceveDpr !== dpr) {
      cerceveDpr = dpr; cerceveResmi = document.createElement('canvas');
      const N = Math.ceil((B.cap + 24) * dpr); cerceveResmi.width = cerceveResmi.height = N;
      const c = cerceveResmi.getContext('2d'); c.scale(dpr, dpr);
      const o = (B.cap + 24) / 2;
      c.shadowColor = 'rgba(58, 36, 16, .35)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.beginPath(); c.arc(o, o, R + 1.5, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = 'rgba(74,74,74,.9)'; c.stroke();
      c.shadowColor = 'transparent';
      const ps = TV.parcalar(TV.gen().circle(o, o, B.cap + 3, { roughness: .8, seed: 7 }), { enAz: 0 });
      c.lineWidth = 1.4; c.strokeStyle = '#4a4a4a'; TV.cizParcalar(c, ps);
    }
    const o = (B.cap + 24) / 2;
    ctx.drawImage(cerceveResmi, cx - o, cy - o, B.cap + 24, B.cap + 24);
  }

  KK.ust = Object.assign(S, { ciz, haritadaMi, haritaOdak });
})();
