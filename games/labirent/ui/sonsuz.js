// ui/sonsuz.js — Sonsuz mod: Eller'le aşağı doğru akan 12 sütunlu labirent; sayfa kalem ucuyla birlikte kayar.
// Yukarıdan pembe kauçuk bir silgi iner ve giderek hızlanır; kalemin ucuna yetişirse oyun biter. Skor: inilen satır.
// Labirent ve yol, dünyanın tamamı yerine 8 satırlık bantlarda (küçük offscreen canvas'lar) çizilir; görünen bantlar her
// karede kopyalanır. Silinen yer gri lekeli sayfa olur, jel mürekkebinin izi soluk kalır, kırıntılar dökülür.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const $ = (id) => document.getElementById(id);
  const J = () => window.Kit.jel, S = () => LB.sahne, M = () => LB.marj, P = () => LB.path, C = () => LB.config;

  const Z = {
    aktif: false, a: null, lab: null, d: null, y: null, tohum: 0,
    bantlar: new Map(), pts: [], kaynak: [], Sx: [], bas: 0, bitis: 0, bitti: false, enCok: 0, satir: 0,
    silgi: null, leke: null, yolKirli: false,
  };
  let sayac = 0;

  const renk = () => J().SIMLI[LB.oyun.ayar.renk];
  const yolK = () => Z.y.koridor * C().yolOrani;
  const sure = () => (Z.bas ? ((Z.bitti ? Z.bitis : performance.now()) - Z.bas) / 1000 : 0);
  const silgiSatir = () => (Z.bas ? C().silgiYol(sure()) : C().sonsuz.silgiBas);
  const satirY = (r) => Z.y.oy + r * Z.y.birim;           // satırın dünyadaki üst kenarı (px)

  /* ---------- yerleşim ---------- */

  function yerlestir() {
    const alan = $('alan'), w = alan.clientWidth, h = alan.clientHeight, s = C().sonsuz;
    S().boyutla(w, h);
    const birim = Math.max(18 + 2, (w - 24) / s.W), kl = LB.maze.kalinlik(birim);
    Z.y = {
      w: Math.ceil(s.W * birim + 24), h: Math.ceil(46 + s.H * birim), birim, ox: 12, oy: 46, kalinlik: kl, koridor: birim - kl,
      bukum: J().bukum(['izgara', Z.lab.kod], Math.min(1.8, birim * .055), birim * 4.2),
    };
    Z.d.pay = (yolK() / 2 * 1.1 + kl / 2 * 1.15 + 1.2) / birim;
    S().kameraKur(Z.y.w, Z.y.h, 999, [Z.y.w / 2, 0]);    // ölçek 1: genişlik sığar, yakınlaşma yok
    S().kam.smax = S().kam.smin = S().kam.s;
    Z.bantlar.clear();
    Z.leke = null;
    yolTam();
    S().kirli();
  }

  /* ---------- bantlar ---------- */

  function bantCanvas() {
    const cv = document.createElement('canvas'), o = S().dpr * S().kam.s, bh = C().sonsuz.bant * Z.y.birim;
    cv.width = Math.ceil(Z.y.w * o); cv.height = Math.ceil(bh * o);
    return cv;
  }
  function bant(b) {
    let x = Z.bantlar.get(b);
    const r0 = b * C().sonsuz.bant, r1 = r0 + C().sonsuz.bant;
    if (!x) { x = { b, r0, r1, maze: bantCanvas(), yol: bantCanvas(), tamam: false }; Z.bantlar.set(b, x); yolBantCiz(x); }
    if (!x.tamam && Z.a.satir >= r1) {
      const ctx = x.maze.getContext('2d'), o = S().dpr * S().kam.s;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, x.maze.width, x.maze.height);
      ctx.setTransform(o, 0, 0, o, 0, -satirY(r0) * o);
      LB.maze.duvarCiz(ctx, Z.a.duvarlar(r0, r1), Z.y, { tohum: Z.lab.kod });
      if (b === 0) LB.maze.etiket(ctx, Z.lab, 'giris', Z.y);
      x.tamam = true;
    }
    return x;
  }
  const bantCtx = (x, tuval) => { const ctx = tuval.getContext('2d'), o = S().dpr * S().kam.s; ctx.setTransform(o, 0, 0, o, 0, -satirY(x.r0) * o); return ctx; };

  /* ---------- yol (bantlara) ---------- */

  function yolParca(ctx, a, b) { if (b - a >= 2) J().yol(ctx, Z.pts.slice(a, b), { renk: renk(), kalinlik: yolK(), tohum: ['yol', Z.lab.kod], s0: Z.Sx[a] }); }
  // Bant için yolun o banda değen kısımları
  function yolBantCiz(x) {
    const ctx = x.yol.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, x.yol.width, x.yol.height); ctx.restore();
    const c = bantCtx(x, x.yol), y0 = satirY(x.r0) - Z.y.birim, y1 = satirY(x.r1) + Z.y.birim;
    let a = -1;
    for (let i = 0; i <= Z.pts.length; i++) {
      const ic = i < Z.pts.length && Z.pts[i][1] >= y0 && Z.pts[i][1] <= y1;
      if (ic && a < 0) a = Math.max(0, i - 1);
      if (!ic && a >= 0) { yolParca(c, a, Math.min(Z.pts.length, i + 1)); a = -1; }
    }
  }
  const bantNo = (yy) => Math.floor((yy - Z.y.oy) / (C().sonsuz.bant * Z.y.birim));
  function yolTam() { for (const x of Z.bantlar.values()) yolBantCiz(x); }

  function yolGuncelle() {
    const iz = Z.d.iz, n = Math.min(iz.length, Z.kaynak.length);
    let k = 0;
    while (k < n && Z.kaynak[k] === iz[k]) k++;
    const kesildi = k < Z.kaynak.length, eskiUzunluk = Z.pts.length;
    let yEn = Infinity, yBuyuk = -Infinity;
    if (kesildi) for (let i = k; i < eskiUzunluk; i++) { yEn = Math.min(yEn, Z.pts[i][1]); yBuyuk = Math.max(yBuyuk, Z.pts[i][1]); }
    Z.kaynak.length = k; Z.pts.length = k; Z.Sx.length = k;
    for (let i = k; i < iz.length; i++) {
      const p = LB.maze.dunya(Z.y, iz[i]), o = Z.pts[i - 1];
      Z.kaynak.push(iz[i]); Z.pts.push(p); Z.Sx.push(o ? Z.Sx[i - 1] + Math.hypot(p[0] - o[0], p[1] - o[1]) : 0);
    }
    if (kesildi) {                                          // geri sarma: etkilenen bantları baştan çiz
      for (let b = bantNo(yEn) - 1; b <= bantNo(yBuyuk) + 1; b++) { const x = Z.bantlar.get(b); if (x) yolBantCiz(x); }
    }
    const a = Math.max(0, (kesildi ? k : eskiUzunluk) - 1);
    if (Z.pts.length - a >= 2) {
      let yl = Infinity, yh = -Infinity;
      for (let i = a; i < Z.pts.length; i++) { yl = Math.min(yl, Z.pts[i][1]); yh = Math.max(yh, Z.pts[i][1]); }
      for (let b = bantNo(yl - Z.y.birim); b <= bantNo(yh + Z.y.birim); b++) { const x = Z.bantlar.get(b); if (x) yolParca(bantCtx(x, x.yol), a, Z.pts.length); }
    }
  }

  /* ---------- silinmiş sayfa ---------- */

  function lekeDoku() {
    const w = Z.y.w, h = 240, o = S().dpr * S().kam.s, cv = document.createElement('canvas');
    cv.width = Math.ceil(w * o); cv.height = Math.ceil(h * o);
    const ctx = cv.getContext('2d');
    ctx.setTransform(o, 0, 0, o, 0, 0);
    window.Kit.silgi.leke(ctx, { x: 0, y: 0, w, h }, ['sonsuz', Z.tohum]);
    window.Kit.silgi.kirinti(ctx, { x: 6, y: 0, w: w - 12, h }, ['sonsuz', Z.tohum], 16);
    return { cv, h };
  }

  /* ---------- kare ---------- */

  function ciz(ctx) {
    if (!Z.aktif) return false;
    const k = S().kam, ust = -k.ty / k.s, alt = ust + S().h / k.s, sY = satirY(silgiSatir()), dw = Z.y.w;
    const b0 = Math.max(0, bantNo(ust)), b1 = Math.max(0, bantNo(alt));
    for (let b = b0; b <= b1; b++) {
      const x = bant(b), y0 = satirY(x.r0), bh = C().sonsuz.bant * Z.y.birim;
      if (y0 + bh <= sY) { ctx.save(); ctx.globalAlpha = .1; ctx.drawImage(x.maze, 0, y0, dw, bh); ctx.drawImage(x.yol, 0, y0, dw, bh); ctx.restore(); continue; }
      if (y0 < sY) {                                     // silgi bu bandın içinde: üstü soluk, altı tam
        const f = (sY - y0) / bh, o = S().dpr * k.s;
        ctx.save(); ctx.globalAlpha = .1; ctx.drawImage(x.maze, 0, 0, x.maze.width, x.maze.height * f, 0, y0, dw, bh * f); ctx.drawImage(x.yol, 0, 0, x.yol.width, x.yol.height * f, 0, y0, dw, bh * f); ctx.restore();
        ctx.drawImage(x.maze, 0, x.maze.height * f, x.maze.width, x.maze.height * (1 - f), 0, sY, dw, bh * (1 - f));
        ctx.drawImage(x.yol, 0, x.yol.height * f, x.yol.width, x.yol.height * (1 - f), 0, sY, dw, bh * (1 - f));
        void o;
        continue;
      }
      ctx.drawImage(x.maze, 0, y0, dw, bh);
      ctx.drawImage(x.yol, 0, y0, dw, bh);
    }
    // silinmiş bölge: gri lekeli, sürtülmüş sayfa (döşenir)
    if (sY > ust) {
      if (!Z.leke) Z.leke = lekeDoku();
      for (let yy = Math.floor(ust / Z.leke.h) * Z.leke.h; yy < Math.min(sY, alt); yy += Z.leke.h) {
        const h2 = Math.min(Z.leke.h, sY - yy);
        if (h2 > 0) ctx.drawImage(Z.leke.cv, 0, 0, Z.leke.cv.width, Z.leke.cv.height * h2 / Z.leke.h, 0, yy, dw, h2);
      }
    }
    // kalem ucu
    if (!Z.bitti && Z.pts.length) {
      const [x, yy] = Z.pts[Z.pts.length - 1];
      if (!Z.d.aktif) { ctx.save(); ctx.strokeStyle = renk(); ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, yy, yolK() * .95, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
    return !!Z.bas && !Z.bitti;
  }

  // Silgi nesnesi ekranda: silen kenarı silginin satırında, sağa sola sürtünerek
  function silgiKonumla() {
    if (!Z.silgi) return;
    const k = S().kam, yEkran = k.ty + satirY(silgiSatir()) * k.s, t = sure();
    Z.silgi.node.style.display = yEkran > -10 ? '' : 'none';
    const x = S().w / 2 + Math.sin(t * 5.3) * S().w * .26;
    Z.silgi.konumla(x, Math.min(yEkran, S().h + 60), Math.sin(t * 5.3 + 1) * 4);
  }

  function kareOncesi() {
    if (!Z.aktif) return false;
    if (Z.yolKirli) { Z.yolKirli = false; yolGuncelle(); }
    // sayfa uçla kayar: uç ekranın üst %40'ında
    if (Z.pts.length) {
      const k = S().kam, uy = Z.pts[Z.pts.length - 1][1], hedef = S().h * C().sonsuz.ucOrani - uy * k.s;
      k.ty += (Math.min(0, hedef) - k.ty) * .12;
    }
    // satırları önden üret
    const ucSatir = Math.floor(Z.d.hucreler[Z.d.hucreler.length - 1] / C().sonsuz.W);
    if (ucSatir + C().sonsuz.onden > Z.a.satir) Z.a.uret(ucSatir + C().sonsuz.onden + C().sonsuz.bant);
    if (ucSatir > Z.enCok) { Z.enCok = ucSatir; skorYaz(); }
    // silgi yetişti mi
    if (Z.bas && !Z.bitti && Z.pts.length && satirY(silgiSatir()) >= Z.pts[Z.pts.length - 1][1] - yolK() * .3) bitir();
    silgiKonumla();
    if (Z.bas && !Z.bitti) LB.ses.silgi(C().silgiHizi(sure()));
    // eski bantları bırak
    const ust = -S().kam.ty / S().kam.s;
    for (const b of [...Z.bantlar.keys()]) if (b < bantNo(ust) - 2) Z.bantlar.delete(b);
    return !!Z.bas && !Z.bitti;
  }

  function skorYaz() {
    const rekor = LB.depo.oku('sonsuz');
    M().sonuc([[{ metin: `${Z.enCok} satır`, sinif: 'beyaz' }].concat(rekor ? [{ metin: `en çok ${rekor.satir}` }] : [])]);
  }

  /* ---------- akış ---------- */

  function bitir() {
    Z.bitti = true; Z.bitis = performance.now(); Z.d.aktif = false;
    LB.ses.cizBitir();
    clearInterval(sayac);
    M().kronometre(sure());
    const rekor = LB.depo.oku('sonsuz'), yeni = !rekor || Z.enCok > rekor.satir;
    if (yeni) LB.depo.yaz('sonsuz', { satir: Z.enCok, sure: sure(), tarih: Date.now() });
    try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch (e) { /* yoksay */ }
    M().sonuc([[{ metin: 'silgi yetişti', sinif: 'beyaz' }, { metin: `${Z.enCok} satır` }], [{ metin: yeni ? (rekor ? `önceki en çok ${rekor.satir}` : 'ilk kayıt') : `en çok ${rekor.satir}` }, { metin: M().sureYaz(sure()) }]]);
    LB.oyun.duyur(`Silgi yetişti. ${Z.enCok} satır indin.`);
    S().kirli();
  }

  function yukle(tohum) {
    if (!Z.aktif) gir();
    Z.tohum = tohum;
    Z.a = LB.eller.akis(LB.topology, C().sonsuz.W, C().sonsuz.H, tohum);
    Z.a.uret(C().sonsuz.onden + C().sonsuz.bant);
    Z.lab = Z.a.lab;
    Z.d = P().yeni(Z.lab);
    Z.pts = []; Z.kaynak = []; Z.Sx = []; Z.bas = 0; Z.bitis = 0; Z.bitti = false; Z.enCok = 0;
    clearInterval(sayac);
    M().kronometre(0); M().cemberSil();
    const rekor = LB.depo.oku('sonsuz');
    M().kunye(['Sonsuz', `${C().sonsuz.W} sütun`].concat(rekor ? [`en çok ${rekor.satir} satır`] : []).join(' · '));
    M().sonuc([[{ metin: 'çizmeye başlayınca silgi iner' }]]);
    yerlestir();
    Z.yolKirli = true;
    S().kirli();
  }

  function gir() {
    Z.aktif = true;
    LB.ayarlar.notKapat();
    LB.aktif = Z;
    for (const k of S().katmanlar.values()) k.gizli = true;
    LB.yolCiz.hayaletKur([]); LB.yolCiz.ipucuSil(); LB.yolCiz.cozumGoster(null);
    LB.yolCiz.Y.d = null; LB.yolCiz.Y.lab = null;           // olağan kalem ucu, rehberler ve hayalet çizilmesin
    S().ustler.push(ciz); S().oncesi.push(kareOncesi);
    Z.silgi = window.Kit.silgi.kur($('alan'), { genislik: 150, tohum: ['sonsuz'] });
    Z.silgi.node.classList.add('sonsuz-silgi');
    ['k-ipucu', 'k-cozum', 'k-hayalet', 'k-yazdir'].forEach(id => { $(id).disabled = true; });
    LB.modlar.sonrasiGizle();
    ['k-ipucu', 'k-cozum', 'k-hayalet', 'k-yazdir'].forEach(id => M().altCiz($(id)));
    document.querySelectorAll('#modlar .dugme').forEach(x => M().etkin(x, x.dataset.mod === 'sonsuz'));
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// */ }
  }
  function cik() {
    if (!Z.aktif) return;
    Z.aktif = false;
    clearInterval(sayac);
    S().ustler = S().ustler.filter(f => f !== ciz); S().oncesi = S().oncesi.filter(f => f !== kareOncesi);
    for (const k of S().katmanlar.values()) k.gizli = false;
    if (Z.silgi) { Z.silgi.kaldir(); Z.silgi = null; }
    Z.bantlar.clear();
    ['k-ipucu', 'k-cozum', 'k-hayalet', 'k-yazdir'].forEach(id => { $(id).disabled = false; });
    LB.aktif = LB.oyun;
  }

  function saatBaslat() {
    if (Z.bas || Z.bitti) return;
    Z.bas = performance.now();
    sayac = setInterval(() => M().kronometre(sure()), 200);
    skorYaz();
    S().kirli();
  }
  const izgara = (p) => LB.maze.izgaraya(Z.y, p);
  function olaylar() {
    for (const o of Z.d.olay.splice(0)) {
      if (o.tip === 'takildi') { LB.ses.takildi(); S().sars(80); try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* yoksay */ } }
    }
    Z.yolKirli = true;
    S().kirli();
  }

  Object.assign(Z, {
    yukle, gir, cik, yerlestir: () => yerlestir(),
    basla(p) { if (Z.bitti) return false; LB.ayarlar.notKapat(); const ok = P().basla(Z.d, izgara(p)); if (ok) { saatBaslat(); LB.ses.cizBasla(); } olaylar(); return ok; },
    surukle(p) { if (Z.bitti) return; P().surukle(Z.d, izgara(p)); if (Z.d.aktif) LB.ses.cizNokta(p, Z.y.birim); olaylar(); },
    birak() { P().birak(Z.d); LB.ses.cizBitir(); olaylar(); },
    ok(yon) { if (Z.bitti) return; const n = Z.d.hucreler.length; P().ok(Z.d, yon); if (Z.d.hucreler.length !== n) saatBaslat(); olaylar(); },
    bastan() { LB.oyun.sayfaCevir(() => yukle(Z.tohum)); },
    yeni() { LB.oyun.sayfaCevir(() => yukle(Math.floor(Math.random() * 1e9))); },
  });
  LB.sonsuz = Z;
})();
