// render/path.js — oyuncunun simli jel kalem yolu (engine/path.js'in görüntü izi). Dünya pikselinde, kendi katmanında.
// Yeni noktalar geldikçe yalnız yeni parça eklenir; sim konumları ve kalınlık gürültüsü yay uzunluğuna bağlı olduğu
// için eklenen parça öncekileri değiştirmez. Geri sarmada iz kısalır: katman baştan çizilir.
// "İz bırak": geri sarılan parça %30 opaklıkta noktalı iz olarak ayrı katmanda kalır.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const J = () => window.Kit.jel;

  const Y = { d: null, y: null, lab: null, renk: '#3fd6c8', kaynak: [], pts: [], S: [], cizilen: 0, izler: [], parla: 0, kesir: 1, uzak: 0, gizli: false,
    ipucu: null, cozum: null };
  const kalinlik = (y) => y.koridor * LB.config.yolOrani;
  const tohum = () => ['yol', Y.lab ? Y.lab.kod : ''];

  // Dokumada yolun alt geçitteki kısmı köprünün altında kalır: iki ucu da alt geçitte olan parça çizilmez
  function altMi(i) {
    const g = Y.lab.grid, d = Y.d;
    if (g.tur !== 'dokuma') return false;
    let k = d.izBas.length - 1;
    while (k > 0 && d.izBas[k] > i) k--;
    const n0 = g.W * g.H, alt = (h) => h >= n0;
    return alt(d.hucreler[k]) || (k >= 1 && i === d.izBas[k] && alt(d.hucreler[k - 1]));
  }
  function parca(ctx, a, b) {
    if (b - a < 2 && Y.pts.length > 1) a = Math.max(0, b - 2);
    if (b <= a) return;
    const ciz = (x, y) => { if (y - x >= 2) J().yol(ctx, Y.pts.slice(x, y), { renk: Y.renk, kalinlik: kalinlik(Y.y), tohum: tohum(), s0: Y.S[x], parla: Y.parla }); };
    if (Y.lab.grid.tur !== 'dokuma') return ciz(a, b);
    // köprünün altı: soluk (kâğıdın altından görünür gibi); üstü tam
    const soluk = (x, y) => { if (y - x < 2) return; ctx.save(); ctx.globalAlpha *= .22; ciz(x, y); ctx.restore(); };
    let bas = a, altta = false;
    for (let i = a; i < b - 1; i++) {
      const al = altMi(i) && altMi(i + 1);
      if (al !== altta) { (altta ? soluk : ciz)(bas, i + 1); bas = i; altta = al; }
    }
    (altta ? soluk : ciz)(bas, b);
  }
  function tamCiz(ctx) {
    if (!Y.d || Y.gizli) return;
    const son = Math.max(1, Math.round(Y.pts.length * Y.kesir));
    parca(ctx, 0, son);
  }
  // izler ızgara biriminde saklanır: yeniden yerleşimde (döndürme, boyut) korunur
  function izTek(ctx, iz) {
    const k = kalinlik(Y.y);
    J().cizgi(ctx, iz.map(q => LB.maze.dunya(Y.y, q)), { renk: Y.renk, kalinlik: k * .42, kesik: [.1, k * .95], alfa: .3 });
  }
  function izCiz(ctx) { for (const iz of Y.izler) izTek(ctx, iz); }

  // koru: aynı yol yeni yerleşimde (izler korunur)
  function baglan(d, lab, y, renk, koru) {
    const ip = koru ? Y.ipucu : null, cz = koru ? Y.cozum : null;
    Object.assign(Y, { d, lab, y, renk, kaynak: [], pts: [], S: [], cizilen: 0, izler: koru ? Y.izler : [], parla: 0, kesir: 1, gizli: false, ipucu: null, cozum: null });
    if (koru && (ip || cz)) LB.sahne.kirli();         // yeni yerleşimde rehberler oyun tarafından yeniden kurulur
    const S = LB.sahne;
    S.katman('iz', izCiz, 1);
    const kat = S.katman('yol', tamCiz, 2);
    kat.titrer = true;
    guncelle(true);
  }

  function renkDegis(renk) { Y.renk = renk; yenidenCiz(); }
  function yenidenCiz() {
    const S = LB.sahne;
    for (const ad of ['iz', 'yol']) { const k = S.katmanlar.get(ad); if (k) { S.temizle(k); k.ciz(k.ctx); } }
    S.kirli();
  }

  // Motorun izini katmana aktarır: ortak öneki korur, kesilen yerden sonrasını ekler
  function guncelle(tam) {
    const iz = Y.d.iz, n = Math.min(iz.length, Y.kaynak.length);
    let k = 0;
    while (k < n && Y.kaynak[k] === iz[k]) k++;
    if (k < Y.kaynak.length) { Y.kaynak.length = k; Y.pts.length = k; Y.S.length = k; tam = true; }
    for (let i = Y.kaynak.length; i < iz.length; i++) {
      const p = LB.maze.dunya(Y.y, iz[i]), o = Y.pts[i - 1];
      Y.kaynak.push(iz[i]); Y.pts.push(p);
      Y.S.push(o ? Y.S[i - 1] + Math.hypot(p[0] - o[0], p[1] - o[1]) : 0);
    }
    const kat = LB.sahne.katmanlar.get('yol');
    if (tam) { LB.sahne.temizle(kat); tamCiz(kat.ctx); }
    else if (Y.pts.length > Y.cizilen) parca(kat.ctx, Math.max(0, Y.cizilen - 1), Y.pts.length);
    Y.cizilen = Y.pts.length;
    LB.sahne.kirli();
  }

  function izBirak(silinen) {
    if (silinen.length < 2) return;
    Y.izler.push(silinen);
    izTek(LB.sahne.katmanlar.get('iz').ctx, silinen);
    LB.sahne.kirli();
  }
  function izleriSil() { Y.izler = []; const k = LB.sahne.katmanlar.get('iz'); if (k) LB.sahne.temizle(k); LB.sahne.kirli(); }

  const uc = () => Y.pts[Y.pts.length - 1];

  // Kalem ucu: çizilmiyorken nerede kaldığını gösteren soluk halka; uzağa basınca kısa bir parıltı
  function ustCiz(ctx, zaman) {
    if (!Y.d || Y.d.bitti || !Y.pts.length) return false;
    const [x, y] = uc(), k = kalinlik(Y.y), simdi = performance.now();
    if (!Y.d.aktif) {
      ctx.save();
      ctx.strokeStyle = Y.renk; ctx.globalAlpha = .55; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, k * .95, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (simdi < Y.uzak) {
      const f = 1 - (Y.uzak - simdi) / 320, r = k * (1 + f * 1.6);
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.fillStyle = J().acik(Y.renk, .7);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + f; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      return true;
    }
    return false;
  }
  function uzakParilti() { Y.uzak = performance.now() + 320; LB.sahne.kirli(); }

  // Bitiş: yol baştan sona tek, hızlı bir çizgiyle yeniden çizilir (600 ms), sonra sim bir kez parlar (300 ms)
  function bitis() {
    const kat = LB.sahne.katmanlar.get('yol');
    if (!window.Kit.kalem.animasyonVar()) return Promise.resolve();
    return new Promise((coz) => {
      const bas = performance.now(), CIZ = 600, PARLA = 300;
      const adim = (zaman) => {
        const t = performance.now() - bas;
        Y.kesir = Math.min(1, t / CIZ);
        Y.parla = t > CIZ ? Math.max(0, .9 * (1 - (t - CIZ) / PARLA)) : 0;
        LB.sahne.temizle(kat); tamCiz(kat.ctx);
        if (t >= CIZ + PARLA) { Y.kesir = 1; Y.parla = 0; LB.sahne.temizle(kat); tamCiz(kat.ctx); LB.sahne.oncesi = LB.sahne.oncesi.filter(f => f !== adim); coz(); return false; }
        return true;
      };
      LB.sahne.oncesi.push(adim);
      LB.sahne.kirli();
    });
  }

  /* ---------- ipucu ve çözüm: gümüş kesikli çizgi, sapma yerinde halka ---------- */

  // Hücre dizisi → dünyada elle çizilmiş gibi kesikli rota (merkezler ve geçit ortaları üzerinden)
  function rota(hucreler, tohum) {
    const g = Y.lab.grid, P = LB.path, p = [];
    hucreler.forEach((h, i) => {
      if (i) p.push(P.gecitOrta(g, hucreler[i - 1], h));
      p.push(g.merkez(h));
    });
    if (hucreler[hucreler.length - 1] === Y.lab.cikis.hucre && Y.lab.cikis.kenar) p.push(P.agizOrta(g, Y.lab.cikis));
    return J().roughYol(p.map(q => LB.maze.dunya(Y.y, q)), { tohum, roughness: .5, bowing: .4 });
  }
  function halka(h) {
    const [x, y] = LB.maze.dunya(Y.y, Y.lab.grid.merkez(h)), r = Y.y.birim * .42, p = [];
    for (let i = 0; i < 14; i++) { const a = -.4 + i * Math.PI * 2 / 13; p.push([x + Math.cos(a) * r * (1 + (i % 3) * .03), y + Math.sin(a) * r]); }
    return { merkez: [x, y], r, nok: J().roughYol(p, { tohum: ['halka', h], roughness: .7 }) };
  }

  // ip: { sapma, sonraki } (engine/solve.js ipucu). Sapma yoksa yalnız sonraki hücreler.
  function ipucuGoster(ip) {
    Y.ipucu = { cizgi: ip.sonraki.length > 1 ? rota(ip.sonraki, ['ipucu', ip.sonraki[0]]) : null, halka: ip.sapma !== null ? halka(ip.sapma) : null, bas: performance.now() };
    LB.sahne.kirli();
  }
  function ipucuSil() { if (Y.ipucu) { Y.ipucu = null; LB.sahne.kirli(); } }
  function cozumGoster(hucreler) { Y.cozum = hucreler ? rota(hucreler, ['cozum', Y.lab.kod]) : null; LB.sahne.kirli(); }

  function rehberCiz(ctx) {
    const gumus = J().RENK.gumus;
    if (Y.cozum) J().cizgi(ctx, Y.cozum, { renk: gumus, kalinlik: 1.7, kesik: [7, 6], alfa: .8 });
    if (Y.ipucu) {
      if (Y.ipucu.cizgi) J().cizgi(ctx, Y.ipucu.cizgi, { renk: gumus, kalinlik: 2, kesik: [6, 5] });
      if (Y.ipucu.halka) {
        const h = Y.ipucu.halka;
        J().cizgi(ctx, h.nok, { renk: gumus, kalinlik: 1.6, tohum: ['halka'] });
        const boy = Math.max(13, Math.min(17, Y.y.birim * .55));
        J().yazi(ctx, 'buradan saptın', h.merkez[0] + h.r * .8, h.merkez[1] - h.r - 4, { boy, metal: true, aci: -.06, tohum: ['sapti'], zemin: '#1c1b1a' });
      }
    }
    return false;
  }

  /* ---------- hayaletler: gerçek zamanlı ilerleyen kesikli çizgiler ---------- */

  // liste: [{ iz: [{ hucre, t }], renk, alfa, kalin }], zaman: () => saniye (yarışın saati)
  const HY = { liste: [], zaman: () => 0, onbellek: new Map() };
  function hayaletKur(liste, zaman) { HY.liste = liste || []; HY.zaman = zaman || (() => 0); HY.onbellek.clear(); LB.sahne.kirli(); }
  const dw = (p) => LB.maze.dunya(Y.y, p);
  function merkezW(h) { const k = 'm' + h; if (!HY.onbellek.has(k)) HY.onbellek.set(k, dw(Y.lab.grid.merkez(h))); return HY.onbellek.get(k); }
  function gecitW(a, b) { const k = a < b ? a + ':' + b : b + ':' + a; if (!HY.onbellek.has(k)) HY.onbellek.set(k, dw(LB.path.gecitOrta(Y.lab.grid, a, b))); return HY.onbellek.get(k); }
  const ara2 = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];

  function hayaletNoktalari(y) {
    const h = y.hucreler, pts = [dw(LB.path.agizOrta(Y.lab.grid, Y.lab.giris)), merkezW(h[0])];
    const son = y.geri ? h.length - 1 : h.length;
    for (let i = 1; i < son; i++) pts.push(gecitW(h[i - 1], h[i]), merkezW(h[i]));
    if (y.geri) {                                           // son adımı geri sarıyor: uç geri doğru kısalır
      const a = h[h.length - 2], b = h[h.length - 1], g = gecitW(a, b), f = 1 - y.f;
      pts.push(f > .5 ? g : ara2(merkezW(a), g, f * 2));
      if (f > .5) pts.push(ara2(g, merkezW(b), (f - .5) * 2));
    } else if (y.sonraki !== null) {                       // sonraki hücreye doğru yarı yolda
      const a = h[h.length - 1], g = gecitW(a, y.sonraki);
      pts.push(y.f < .5 ? ara2(merkezW(a), g, y.f * 2) : g);
      if (y.f >= .5) pts.push(ara2(g, merkezW(y.sonraki), (y.f - .5) * 2));
    } else if (h[h.length - 1] === Y.lab.cikis.hucre && Y.lab.cikis.kenar) pts.push(dw(LB.path.agizOrta(Y.lab.grid, Y.lab.cikis)));
    return pts;
  }

  function hayaletCiz(ctx) {
    if (!HY.liste.length || !Y.lab) return false;
    const t = HY.zaman(), k = kalinlik(Y.y);
    let devam = false;
    for (const hy of HY.liste) {
      const y = LB.ghost.yeri(hy.iz, t), pts = hayaletNoktalari(y);
      ctx.save();
      ctx.globalAlpha = hy.alfa;
      J().cizgi(ctx, pts, { renk: hy.renk, kalinlik: k * (hy.kalin || .45), kesik: [k * .9, k * .8] });
      const u = pts[pts.length - 1];
      ctx.fillStyle = hy.renk;
      ctx.beginPath(); ctx.arc(u[0], u[1], k * .32, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (!y.bitti && t > 0) devam = true;
    }
    return devam;
  }

  LB.yolCiz = { Y, kalinlik, hayaletKur, hayaletCiz, baglan, guncelle, renkDegis, yenidenCiz, izBirak, izleriSil, uc, ustCiz, uzakParilti, bitis, ipucuGoster, ipucuSil, cozumGoster, rehberCiz };
})();
