// render/maze.js — labirentin sabit katmanı: beyaz jel kalemle duvarlar, gümüş "giriş"/"çıkış" ve okları.
// Bir kez (offscreen, dünya pikselinde) çizilir. Doğru duvarlar aynı doğrultuda art arda gidiyorsa, yaylar aynı çemberde
// art arda gidiyorsa tek kalem darbesine (koşu) birleşir. Koşunun köşeleri rough.js'te sabit kalır (preserveVertices) ve
// bütün çizime aynı el bükümü uygulanır: kesişimlerde uçlar hep buluşur. Kalemin durduğu, döndüğü ya da duvarların
// birleştiği her düğümde küçük bir mürekkep birikmesi var.
//   const y = LB.maze.yerlesim(lab, w, h)   // w × h alana sığdırır; dünya y.w × y.h px; y.birim = ızgara biriminin pikseli
//   LB.maze.ciz(ctx, lab, y, { renk, etiket })
//   LB.maze.dunya(y, [gx, gy]) → [x, y] (büküm dahil) · LB.maze.izgaraya(y, [x, y]) → [gx, gy]
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const J = () => window.Kit.jel;
  const T = () => LB.topology;
  const anahtar = (x, y) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
  const TUR = 2 * Math.PI;

  /* ---------- koşular ---------- */

  // geo listesi → kalem darbeleri: [[x, y], …] köşe listeleri (ızgara biriminde)
  function kosular(geolar, yayAdim) {
    const yatay = new Map(), dikey = new Map(), yaylar = new Map(), sonuc = [];
    for (const e of geolar) {
      if (e.tip === 'y') {
        const k = anahtar(e.m[0], e.m[1]) + ':' + Math.round(e.r * 1e4);
        if (!yaylar.has(k)) yaylar.set(k, { m: e.m, r: e.r, l: [] });
        yaylar.get(k).l.push([e.t0, e.t1]);
        continue;
      }
      const [x1, y1] = e.a, [x2, y2] = e.b;
      if (Math.abs(y1 - y2) < 1e-9) { const k = anahtar(0, y1); if (!yatay.has(k)) yatay.set(k, { c: y1, l: [] }); yatay.get(k).l.push([Math.min(x1, x2), Math.max(x1, x2)]); }
      else if (Math.abs(x1 - x2) < 1e-9) { const k = anahtar(x1, 0); if (!dikey.has(k)) dikey.set(k, { c: x1, l: [] }); dikey.get(k).l.push([Math.min(y1, y2), Math.max(y1, y2)]); }
      else sonuc.push([e.a, e.b]);
    }
    const birlestir = (grup, nokta) => {
      for (const { c, l } of grup.values()) {
        l.sort((p, q) => p[0] - q[0]);
        let kosu = [nokta(c, l[0][0]), nokta(c, l[0][1])], son = l[0][1];
        for (let i = 1; i < l.length; i++) {
          if (Math.abs(l[i][0] - son) < 1e-9) kosu.push(nokta(c, l[i][1]));
          else { sonuc.push(kosu); kosu = [nokta(c, l[i][0]), nokta(c, l[i][1])]; }
          son = l[i][1];
        }
        sonuc.push(kosu);
      }
    };
    birlestir(yatay, (c, v) => [v, c]);
    birlestir(dikey, (c, v) => [c, v]);
    // Yaylar: aynı çemberde uç uca gelenler tek darbe; açılar 0…2π'ye taşınır, tam çember ise bir yerden açılır
    for (const { m, r, l } of yaylar.values()) {
      const n = l.map(([a, b]) => { const a2 = ((a % TUR) + TUR) % TUR; return [a2, a2 + (b - a)]; }).sort((p, q) => p[0] - q[0]);
      const parca = [];
      for (const [a, b] of n) {
        const s = parca[parca.length - 1];
        if (s && Math.abs(a - s[1]) < 1e-9) s[1] = b; else parca.push([a, b]);
      }
      if (parca.length > 1) { const s = parca[parca.length - 1], f = parca[0]; if (Math.abs(s[1] - TUR - f[0]) < 1e-9) { f[0] = s[0] - TUR; parca.pop(); } }
      for (const [a, b] of parca) {
        const k = Math.max(2, Math.ceil((b - a) * r / yayAdim)), pts = [];
        for (let i = 0; i <= k; i++) { const t = a + (b - a) * i / k; pts.push([m[0] + r * Math.cos(t), m[1] + r * Math.sin(t)]); }
        sonuc.push(pts);
      }
    }
    return sonuc;
  }

  // Düğümler: her geo ucunda, oradan çıkan teğet yönü. Düz geçen (tam iki karşıt yön) düğümde birikme yok.
  function birikimler(geolar) {
    const d = new Map();
    const ekle = ([x, y], a) => { const k = anahtar(x, y); if (!d.has(k)) d.set(k, { x, y, a: [] }); d.get(k).a.push(a); };
    for (const e of geolar) {
      if (e.tip === 'd') { ekle(e.a, Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0])); ekle(e.b, Math.atan2(e.a[1] - e.b[1], e.a[0] - e.b[0])); }
      else {
        const [p0, p1] = T().geoUclar(e);
        ekle(p0, e.t0 + Math.PI / 2); ekle(p1, e.t1 - Math.PI / 2);
      }
    }
    const liste = [];
    for (const v of d.values()) {
      const fark = v.a.length === 2 ? Math.abs(((v.a[0] - v.a[1]) % TUR + TUR) % TUR - Math.PI) : 1;
      if (fark > 1e-3) liste.push(v);
    }
    return liste;
  }

  /* ---------- yerleşim ---------- */

  const kalinlik = (birim) => Math.min(2.6, Math.max(1.6, birim / 12));
  const okBoy = (b) => Math.max(14, Math.min(26, b * .8));
  const yaziBoy = (b) => Math.max(15, Math.min(21, b * .66));
  const yanYazi = (b) => Math.max(13, Math.min(19, b * .6));   // yandaki etiket: dar ekranda yer kazanmak için biraz küçük
  const yanOk = (b) => Math.max(12, Math.min(22, b * .7));

  // Ağzın orta noktası ve dışa bakan birim normal (ızgara biriminde)
  function agiz(lab, a) {
    const g = lab.grid;
    if (!a || !a.kenar) return null;
    const p = T().geoOrta(g.sinir[a.hucre].find(s => s.yon === a.kenar).geo), m = g.merkez(a.hucre);
    const L = Math.hypot(p[0] - m[0], p[1] - m[1]) || 1;
    return { p, n: [(p[0] - m[0]) / L, (p[1] - m[1]) / L] };
  }
  const dikMi = (n) => Math.abs(n[1]) >= Math.abs(n[0]) * .8;

  // Labirenti w × h alana sığdırır; etiketli kenarlara yer ayırır.
  function yerlesim(lab, w, h) {
    const g = lab.grid, k = g.kutu, kw = k.x1 - k.x0, kh = k.y1 - k.y0;
    const tahmin = Math.min(w / kw, h / kh);
    const pay = { K: 12, G: 12, B: 12, D: 12 };
    // yanda: ok ya da yazı (Mynerve'de "giriş"/"çıkış" ≈ 2.3 × punto) hangisi genişse; üstte/altta: yazı + ok
    const dikPay = yaziBoy(tahmin) + okBoy(tahmin) + 12, yanPay = Math.ceil(Math.max(yanOk(tahmin) + 10, yanYazi(tahmin) * 2.15 + 7));
    for (const a of [agiz(lab, lab.giris), agiz(lab, lab.cikis)]) {
      if (!a) continue;
      if (dikMi(a.n)) pay[a.n[1] < 0 ? 'K' : 'G'] = dikPay; else pay[a.n[0] < 0 ? 'B' : 'D'] = yanPay;
    }
    const birim = Math.max(4, Math.min((w - pay.B - pay.D) / kw, (h - pay.K - pay.G) / kh));
    // Dünya: labirentin kutusu + etiket payları (sığdırınca görünen alanda ortalanır, yakınlaşınca boşluk kalmaz)
    const ww = Math.ceil(kw * birim + pay.B + pay.D), wh = Math.ceil(kh * birim + pay.K + pay.G);
    const ox = pay.B - k.x0 * birim, oy = pay.K - k.y0 * birim;
    const kl = kalinlik(birim);
    return {
      w: ww, h: wh, birim, ox, oy, kalinlik: kl,
      koridor: birim - kl,                                        // geçit genişliği (px); yol bunun %45'i
      // varsayılan yakınlık için koridor: altıgende düz bir koridorun ortalama genişliği 1.5 birim (geçit 1 birim)
      gorunurKoridor: (g.tur === 'altigen' ? 1.5 : 1) * birim - kl,
      bukum: J().bukum(['izgara', lab.kod || 'elle'], Math.min(1.8, birim * .055), birim * 4.2),
    };
  }

  const dunyaHam = (y, [gx, gy]) => [y.ox + gx * y.birim, y.oy + gy * y.birim];
  const dunya = (y, p) => { const [x, yy] = dunyaHam(y, p); return y.bukum(x, yy); };
  const izgaraya = (y, [x, yy]) => [(x - y.ox) / y.birim, (yy - y.oy) / y.birim];

  /* ---------- çizim ---------- */

  function duvarCiz(ctx, geolar, y, o = {}) {
    const jel = J(), renk = o.renk || jel.RENK.beyaz, k = y.kalinlik, px = (p) => dunya(y, p);
    kosular(geolar, 6 / y.birim).forEach((kosu) => {
      const tohum = ['duvar', o.tohum, kosu[0][0].toFixed(3), kosu[0][1].toFixed(3), kosu.length];
      const nok = jel.roughYol(kosu.map(px), { tohum, roughness: .6, bowing: .6 });
      jel.cizgi(ctx, nok, { renk, kalinlik: k, tohum });
    });
    birikimler(geolar).forEach(v => { const [x, yy] = px([v.x, v.y]); jel.birikim(ctx, x, yy, k, { renk }); });
  }

  const ETIKET = { giris: 'giriş', cikis: 'çıkış' };

  // Ağzın dışında kısa gümüş ok ve el yazısı etiket. Giriş içeri, çıkış dışarı gösterir.
  function etiket(ctx, lab, ad, y) {
    const jel = J(), a = agiz(lab, lab[ad]);
    if (!a) return;
    const b = y.birim, dik = dikMi(a.n), L = dik ? okBoy(b) : yanOk(b), boy = dik ? yaziBoy(b) : yanYazi(b), bosluk = 5, [px, py] = dunyaHam(y, a.p), [nx, ny] = a.n;
    const yakin = [px + nx * bosluk, py + ny * bosluk], uzak = [px + nx * (bosluk + L), py + ny * (bosluk + L)];
    const [p0, p1] = ad === 'cikis' ? [yakin, uzak] : [uzak, yakin];
    const renk = jel.RENK.gumus, k = 1.5, tohum = ['ok', ad];
    jel.cizgi(ctx, jel.roughYol([p0, p1], { tohum, roughness: .8, bowing: 1.2 }), { renk, kalinlik: k, tohum });
    const aci = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), u = Math.min(8, L * .42);
    [.5, -.5].forEach((s, i) => {
      const uc = [p1[0] - u * Math.cos(aci + s), p1[1] - u * Math.sin(aci + s)];
      jel.cizgi(ctx, jel.roughYol([p1, uc], { tohum: [...tohum, i], roughness: .5 }), { renk, kalinlik: k, tohum: [...tohum, i] });
    });
    let tx, ty, hiza;
    if (dik) { tx = uzak[0]; ty = ny < 0 ? uzak[1] - 6 : uzak[1] + boy * .95; hiza = 'orta'; }
    else { tx = yakin[0]; ty = uzak[1] - 9; hiza = nx < 0 ? 'sag' : 'sol'; }
    jel.yazi(ctx, ETIKET[ad], tx, ty, { boy, hiza, metal: true, tohum: ['etiket', ad] });
  }

  // Dairede hedef merkezde: ağzı yok, "çıkış" merkez hücrenin içine küçük yazılır
  function merkezEtiket(ctx, lab, y) {
    if (lab.cikis.kenar) return;
    const [x, yy] = dunya(y, lab.grid.merkez(lab.cikis.hucre)), boy = Math.max(10, Math.min(18, y.birim * .6));
    J().yazi(ctx, ETIKET.cikis, x, yy + boy * .32, { boy, hiza: 'orta', metal: true, tohum: ['etiket', 'merkez'] });
  }

  function etiketler(ctx, lab, y) { etiket(ctx, lab, 'giris', y); etiket(ctx, lab, 'cikis', y); merkezEtiket(ctx, lab, y); }

  function ciz(ctx, lab, y, o = {}) {
    duvarCiz(ctx, T().duvarlar(lab), y, { renk: o.renk, tohum: lab.kod || 'elle' });
    if (o.etiket !== false) { etiket(ctx, lab, 'giris', y); etiket(ctx, lab, 'cikis', y); merkezEtiket(ctx, lab, y); }
  }

  LB.maze = { kosular, birikimler, kalinlik, yerlesim, agiz, dunya, dunyaHam, izgaraya, duvarCiz, etiket, etiketler, ciz };
})();
