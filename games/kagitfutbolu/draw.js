// draw.js — Kağıt Futbolu'na özgü çizim: saha, kaleler, kaleciler, top, ok, ipuçları, çetele, başlık, durum.
// Kalem altyapısı kit/kalem.js'te. Oyun kurallarını bilmez: saha adımı koordinatı (x, y) ve sahip (0 mavi · 1 kırmızı) alır.
// Her çizim ilkeli { node, bitti, sure } döndürür (bkz. kit/kalem.js).
(function () {
  'use strict';

  const KF = (window.KF = window.KF || {});
  const KL = window.Kit.kalem;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger } = KL;

  const ADIM = 40;     // saha SVG'sinde bir saha adımı (= 2 defter karesi), birim
  const KENAR = 20;    // sahanın çevresindeki pay (yarım adım = 1 kare): kenar noktalarına da dokunulabilsin
  const lacivert = () => renkDeger('lacivert');
  const kursun = () => renkDeger('kursun');
  const murekkep = (sahip) => renkDeger(sahip === 1 ? 'kirmizi' : 'mavi');
  const hepsi = (liste) => Promise.all(liste.map(s => s.bitti));

  /* ---------- saha ---------- */

  // Saha iskeleti: katmanlar + koordinat dönüşümü. Henüz çizim yok.
  // SVG birimi: 1 saha adımı = 40; (0,0) noktası (KENAR, KENAR + ADIM) — üstte kalenin 1 adım derinliği için yer var.
  function sahaKur(svg, id, W, H) {
    const gen = 2 * KENAR + ADIM * W, yuk = 2 * KENAR + ADIM * (H + 2);
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${gen} ${yuk}`);
    const dunya = svgEl('g', { class: 'dunya' }, svg);
    const katman = {};
    // alttan üste: noktalar, saha çizgileri, kaleciler, hamle çizgileri, ipuçları, top, ok, notlar, geçici
    for (const ad of ['isaret', 'saha', 'kaleci', 'cizgiler', 'ipucu', 'top', 'ok', 'not', 'gecici']) {
      katman[ad] = svgEl('g', { class: ad }, dunya);
    }
    return {
      svg, dunya, id, W, H, gen, yuk, katman, yatay: false, K: KL.kalemYap(svg),
      nok: (x, y) => [KENAR + ADIM * x, KENAR + ADIM * (y + 1)],          // saha noktası → SVG birimi
      sahaNok: (px, py) => [(px - KENAR) / ADIM, (py - KENAR) / ADIM - 1],   // SVG birimi → (kesirli) saha noktası
    };
  }

  // Yalnız görünüm döner; çizgiler, animasyonlar ve motorun koordinatları aynı kalır.
  function yonAyarla(T, yatay) {
    T.yatay = yatay;
    T.svg.setAttribute('viewBox', `0 0 ${yatay ? T.yuk : T.gen} ${yatay ? T.gen : T.yuk}`);
    T.dunya.setAttribute('transform', yatay ? `translate(${T.yuk} 0) rotate(90)` : '');
    T.svg.querySelectorAll('[data-duz-x]').forEach(g => duzTut(T, g, +g.dataset.duzX, +g.dataset.duzY));
  }

  function duzTut(T, g, x, y) {
    g.dataset.duzX = x; g.dataset.duzY = y;
    g.setAttribute('transform', T.yatay ? `rotate(-90 ${x} ${y})` : '');
  }

  // Sınır, kaleler (seyrek tarama), orta çizgi ve orta nokta. Cetvelle çizilmiş gibi düz ama elle: köşelerde uçlar taşar.
  // baslangic: [x, y] başlangıç noktası (orta nokta işareti oraya); verilmezse (W/2, H/2). Orta çizgi her zaman H/2'de.
  function sahaCiz(T, gecikme = 0, anlik = false, baslangic) {
    const { W, H, K, nok } = T;
    const g = T.katman.saha;
    g.textContent = '';
    T.katman.isaret.textContent = '';
    const m = W / 2, ink = lacivert();
    const r = rastgele('saha', T.id);
    const t = () => aralik(r, 1, 4);
    const bit = [];
    let gec = gecikme;

    const cizgi = (a, b, ad, u0, u1, ek) => {
      let [x1, y1] = nok(a[0], a[1]);
      let [x2, y2] = nok(b[0], b[1]);
      const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      x1 -= ux * u0; y1 -= uy * u0; x2 += ux * u1; y2 += uy * u1;
      const s = K.cizgi(g, [x1, y1, x2, y2], Object.assign({ stroke: ink, strokeWidth: 2.2, roughness: .55 }, ek),
        ['saha', T.id, ad], { gecikme: gec, anlik, sureMs: [160, 260] });
      bit.push(s.bitti);
      gec += s.sure * .7;
    };

    // iki yan çizgi ve dört sınır parçası (kale ağızları açık)
    cizgi([0, 0], [0, H], 'sol', t(), t());
    cizgi([W, 0], [W, H], 'sag', t(), t());
    cizgi([0, 0], [m - 1, 0], 'ust-sol', t(), 0);
    cizgi([m + 1, 0], [W, 0], 'ust-sag', 0, t());
    cizgi([0, H], [m - 1, H], 'alt-sol', t(), 0);
    cizgi([m + 1, H], [W, H], 'alt-sag', 0, t());

    // kale: ya = ağız çizgisi, yb = arka çizgi. Ağız çizilmez; içi seyrek tarama.
    const kale = (ya, yb, ad) => {
      const koseler = [[m - 1, yb], [m + 1, yb], [m + 1, ya], [m - 1, ya]].map(p => nok(p[0], p[1]));
      const tarama = svgEl('g', { class: 'kale-tarama', opacity: .6 }, g);
      bit.push(K.cokgen(tarama, koseler,
        { stroke: 'none', fill: ink, fillStyle: 'hachure', hachureGap: 10, hachureAngle: -40, fillWeight: .8 },
        ['saha', T.id, ad, 'tarama'], { gecikme: gec, anlik }).bitti);
      gec += 90;
      cizgi([m - 1, ya], [m - 1, yb], ad + '-sol', 1.5, 1.5);
      cizgi([m - 1, yb], [m + 1, yb], ad + '-arka', 2, 2);
      cizgi([m + 1, yb], [m + 1, ya], ad + '-sag', 1.5, 1.5);
    };
    kale(0, -1, 'ust');
    kale(H, H + 1, 'alt');

    // orta çizgi ve orta nokta
    cizgi([0, H / 2], [W, H / 2], 'orta', t(), t(), { strokeWidth: 1.5 });
    const [cx, cy] = baslangic ? nok(baslangic[0], baslangic[1]) : nok(m, H / 2);
    bit.push(K.daire(g, [cx, cy, 9], { stroke: ink, fill: ink, fillStyle: 'solid', strokeWidth: 1.2, roughness: .6 },
      ['saha', T.id, 'orta-nokta'], { gecikme: gec, anlik }).bitti);

    // oyun noktaları: kurşun kalemle silik küçük noktalar (görünürlük için; tüm saha noktaları + kale içleri)
    const noktalar = svgEl('g', { class: 'noktalar', opacity: .55 }, T.katman.isaret);
    const dr = rastgele('nokta', T.id), kur = kursun();
    const nokta = (x, y) => {
      const [px, py] = nok(x, y);
      K.daire(noktalar, [px + aralik(dr, -.5, .5), py + aralik(dr, -.5, .5), 3.4],
        { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: .7, roughness: .6 }, ['nokta', T.id, x, y], { anlik: true });
    };
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) nokta(x, y);
    for (const x of [m - 1, m, m + 1]) { nokta(x, -1); nokta(x, H + 1); }

    return { bitti: Promise.all(bit), sure: gec - gecikme + 200 };
  }

  /* ---------- kaleciler: dekoratif karalama ---------- */

  // taraf: 0 üst kale · 1 alt kale. ruh: normal · uzgun · sevincli. Kaleci kalenin içinde, kurşun kalemle.
  function kaleciCiz(T, taraf, ruh = 'normal', gecikme = 0, anlik = false) {
    const katman = T.katman.kaleci;
    const eski = katman.querySelector(`:scope > .kaleci-${taraf}`);
    if (eski) eski.remove();
    const g = svgEl('g', { class: `kaleci-${taraf}` }, katman);
    const [cx, yU] = T.nok(T.W / 2, taraf === 0 ? -1 : T.H);       // kalenin üst kenarı (SVG)
    // Alt kaleci ters durur; saha yataya döndüğünde soldaki kaleci sola bakar.
    if (taraf === 1) g.setAttribute('transform', `rotate(180 ${cx} ${yU + ADIM / 2})`);

    const png = KL.varlik('kaleci-' + ruh) ? 'kaleci-' + ruh : (KL.varlik('kaleci-normal') ? 'kaleci-normal' : null);
    if (png) {
      const s = KL.resimEkle(g, png, cx - 30, yU + 2, 60, 36, { gecikme, anlik });
      return { node: g, bitti: s.bitti, sure: s.sure };
    }

    const K = T.K, kur = kursun();
    const o = { stroke: kur, strokeWidth: 1.7, roughness: .7 };
    const dolu = { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: .8, roughness: .5 };
    const an = (ad) => ['kaleci', T.id, taraf, ruh, ad];
    const ek = { gecikme, anlik, sureMs: [80, 140] };
    const hy = yU + 10;                                              // kafa merkezi

    K.daire(g, [cx, hy, 10.5], o, an('bas'), ek);
    // yüz
    K.daire(g, [cx - 2, hy - 1, 1.7], dolu, an('g1'), { anlik: true });
    K.daire(g, [cx + 2, hy - 1, 1.7], dolu, an('g2'), { anlik: true });
    if (ruh === 'uzgun') {
      K.egri(g, [[cx - 2.4, hy + 3.6], [cx, hy + 2.2], [cx + 2.4, hy + 3.6]], { ...o, strokeWidth: 1.1 }, an('agiz'), { anlik: true });
      K.cizgi(g, [cx + 3.4, hy + 1, cx + 3.8, hy + 5], { ...o, strokeWidth: 1 }, an('gozyasi'), { anlik: true });
    } else if (ruh === 'sevincli') {
      K.egri(g, [[cx - 3.2, hy + 1.6], [cx, hy + 4.6], [cx + 3.2, hy + 1.6]], { ...o, strokeWidth: 1.1 }, an('agiz'), { anlik: true });
    } else {
      K.egri(g, [[cx - 2.2, hy + 2.4], [cx, hy + 3.4], [cx + 2.2, hy + 2.4]], { ...o, strokeWidth: 1.1 }, an('agiz'), { anlik: true });
    }

    // gövde, bacaklar
    K.cizgi(g, [cx, yU + 15.5, cx, yU + 28], o, an('govde'), ek);
    K.cizgi(g, [cx, yU + 28, cx - 6, yU + 38], o, an('bacak1'), ek);
    K.cizgi(g, [cx, yU + 28, cx + 6, yU + 38], o, an('bacak2'), ek);
    // kollar ve eldivenler ruh haline göre
    const kol = ruh === 'uzgun' ? [[-7, 30], [7, 30]] : ruh === 'sevincli' ? [[-13, 7], [13, 7]] : [[-14, 14], [14, 14]];
    kol.forEach(([dx, dy], i) => {
      K.cizgi(g, [cx, yU + 18, cx + dx, yU + dy], o, an('kol' + i), ek);
      K.daire(g, [cx + dx, yU + dy, 5], dolu, an('eldiven' + i), { anlik: true });
    });
    return { node: g, bitti: Promise.resolve(), sure: 400 };
  }

  /* ---------- top ve sıra oku ---------- */

  // Karalama futbol topu: (x, y) saha noktasında. Hamlede grup `transform` ile kayar (konum: top.dataset.x/y).
  function topCiz(T, x, y, gecikme = 0, anlik = false) {
    T.katman.top.textContent = '';
    const [px, py] = T.nok(x, y);
    const g = svgEl('g', { class: 'top-grup', transform: `translate(${px} ${py})` }, T.katman.top);
    g.dataset.x = x; g.dataset.y = y;
    const ic = svgEl('g', { class: 'top-ic' }, g);                  // hamlede yuvarlanır (dönme)
    ic.style.transformBox = 'fill-box'; ic.style.transformOrigin = 'center';
    if (KL.varlik('top')) {
      const s = KL.resimEkle(ic, 'top', -14, -14, 28, 28, { gecikme, anlik });
      return { node: g, bitti: s.bitti, sure: s.sure };
    }
    const K = T.K, ink = lacivert();
    const an = (ad) => ['top', T.id, ad];
    const ek = { gecikme, anlik, sureMs: [70, 120] };
    const bit = [];
    bit.push(K.daire(ic, [0, 0, 26], { stroke: ink, strokeWidth: 1.7, roughness: .8, fill: renkDeger('kagit'), fillStyle: 'solid' }, an('dis'), ek).bitti);
    // ortada beşgen yama, köşelerinden kenara beş çizgi
    const R = 5.4, ucuk = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      ucuk.push([R * Math.cos(a), R * Math.sin(a)]);
      K.cizgi(ic, [R * Math.cos(a) * 1.15, R * Math.sin(a) * 1.15, 11.6 * Math.cos(a), 11.6 * Math.sin(a)],
        { stroke: ink, strokeWidth: 1.2, roughness: .7 }, an('c' + i), { gecikme: (gecikme || 0) + 80, anlik, sureMs: [50, 80] });
    }
    bit.push(K.cokgen(ic, ucuk, { stroke: ink, fill: ink, fillStyle: 'solid', strokeWidth: 1, roughness: .5 }, an('yama'), ek).bitti);
    return { node: g, bitti: Promise.all(bit), sure: 260 };
  }

  // Topun yanında sıradaki oyuncunun renginde minik, eğri ok (topa bakar).
  function okCiz(T, x, y, sahip, gecikme = 0, anlik = false) {
    T.katman.ok.textContent = '';
    const [px, py] = T.nok(x, y);
    const g = svgEl('g', { class: 'ok-grup', transform: `translate(${px} ${py})` }, T.katman.ok);
    const ink = murekkep(sahip), K = T.K;
    const o = { stroke: ink, strokeWidth: 1.8, roughness: .8 };
    const uc = [-15, -11], oncesi = [-27, -16];
    const a = Math.atan2(uc[1] - oncesi[1], uc[0] - oncesi[0]);
    const kol = (s) => [uc[0], uc[1], uc[0] - 8 * Math.cos(a + s), uc[1] - 8 * Math.sin(a + s)];
    const ek = { gecikme, anlik, sureMs: [80, 130] };
    const s = [
      K.egri(g, [[-36, -32], [-33, -17], oncesi, uc], o, ['ok', T.id, sahip], ek),
      K.cizgi(g, kol(.55), o, ['ok', T.id, sahip, 'k1'], { ...ek, gecikme: (gecikme || 0) + 120 }),
      K.cizgi(g, kol(-.55), o, ['ok', T.id, sahip, 'k2'], { ...ek, gecikme: (gecikme || 0) + 170 }),
    ];
    return { node: g, bitti: hepsi(s), sure: 300 };
  }

  /* ---------- gidilebilecek noktalar ---------- */

  // liste: [{ x, y, sekme }]. Kurşun kalemle silik çember; sekme olacak noktada çift çember.
  function ipucuCiz(T, liste, gecikme = 0, anlik = false) {
    const katman = T.katman.ipucu;
    katman.textContent = '';
    const kur = kursun(), bit = [];
    liste.forEach((n, i) => {
      const [px, py] = T.nok(n.x, n.y);
      const g = svgEl('g', { class: 'ipucu-nokta', opacity: .7 }, katman);
      g.dataset.x = n.x; g.dataset.y = n.y;
      const o = { stroke: kur, strokeWidth: 1.3, roughness: .9 };
      const ek = { gecikme: gecikme + i * 30, anlik, sureMs: [90, 130] };
      bit.push(T.K.daire(g, [px, py, 24], o, ['ipucu', T.id, n.x, n.y], ek).bitti);
      if (n.sekme) bit.push(T.K.daire(g, [px, py, 35], o, ['ipucu2', T.id, n.x, n.y], { ...ek, gecikme: ek.gecikme + 100 }).bitti);
    });
    return { bitti: Promise.all(bit), sure: 300 + liste.length * 30 };
  }

  /* ---------- marj: iki oyuncunun çeteleleri ---------- */

  const SUTUN_X = [16, 46];                          // iki sütunun ortası (marj SVG'sinde birim; 60 birim = 3 kare)
  const CETELE = { ust: 46, adim: 26, yukseklik: 19, aralik: 5 };

  // etiketler: ['ben', 'rakip']. Marj SVG'si 3 kare × saha yüksekliği; birim = 1/20 kare.
  function marjKur(svg, id, sh, etiketler, gecikme = 0, anlik = false) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 60 ${sh * 20}`);
    const K = KL.kalemYap(svg);
    const M = { svg, id, K, cizimler: [[], []], baslik: svgEl('g', { class: 'basliklar' }, svg) };
    etiketle(M, etiketler, gecikme, anlik);
    return M;
  }

  // Sütun başlıkları. Yazı uzunsa küçülür (sütun 1,5 kare).
  function etiketle(M, etiketler, gecikme = 0, anlik = false) {
    M.baslik.textContent = '';
    etiketler.forEach((e, oy) => {
      metinSvg(M.baslik, e, {
        x: SUTUN_X[oy], y: 20, boyut: e.length > 5 ? 10 : e.length > 3 ? 11.5 : 15, hiza: 'middle',
        renk: oy === 0 ? 'mavi' : 'kirmizi', aci: oy ? 2 : -2, tohum: ['marj-baslik', e, oy], gecikme: gecikme + oy * 120, anlik,
      });
    });
  }

  function ceteleKonumu(oy, i) {
    const grup = Math.floor(i / 5), j = i % 5;
    return { x0: SUTUN_X[oy] - 8, y0: CETELE.ust + grup * CETELE.adim, j };
  }

  // i. golün çizgisi: ilk dördü dikey, beşincisi hepsini çapraz keser.
  function ceteleCizgisi(M, oy, i, o = {}) {
    const { x0, y0, j } = ceteleKonumu(oy, i);
    const r = rastgele('cetele', M.id, oy, i);
    const ek = { stroke: murekkep(oy), strokeWidth: 2, roughness: 1.2 };
    const g = svgEl('g', { class: 'cetele-cizgi' }, M.svg);
    const yon = { gecikme: o.gecikme, anlik: o.anlik, sureMs: [150, 150] };
    let c;
    if (j < 4) {
      const x = x0 + j * CETELE.aralik + aralik(r, -.6, .6);
      c = M.K.cizgi(g, [x + aralik(r, -.6, .6), y0 + aralik(r, -1, 1), x + aralik(r, -.6, .6), y0 + CETELE.yukseklik + aralik(r, -1, 1)], ek, ['cetele', M.id, oy, i], yon);
    } else {
      c = M.K.cizgi(g, [x0 - 3 + aralik(r, -1, 1), y0 + CETELE.yukseklik - 3, x0 + 3 * CETELE.aralik + 3 + aralik(r, -1, 1), y0 + 3 + aralik(r, -1, 1)], ek, ['cetele', M.id, oy, i], yon);
    }
    return { node: g, bitti: c.bitti, sure: c.sure };
  }

  // Çeteleyi puanlara eşitler: eksik çizgileri çizer, fazlalarını (geri alma) soldurup siler.
  function ceteleGuncelle(M, puan, o = {}) {
    const bit = [];
    let gec = o.gecikme || 0;
    for (let oy = 0; oy < 2; oy++) {
      const liste = M.cizimler[oy];
      while (liste.length > puan[oy]) bit.push(KL.soldur(liste.pop().node, 200));
      while (liste.length < puan[oy]) {
        const c = ceteleCizgisi(M, oy, liste.length, { gecikme: gec, anlik: o.anlik });
        liste.push(c);
        bit.push(c.bitti);
        gec += o.adim ?? 140;
      }
    }
    return Promise.all(bit);
  }

  // Marja "sek!" notu (zincir sürerken): sahadaki topun yüksekliğinde, oyuncunun mürekkebiyle. y: saha SVG birimi
  // (marj ve saha SVG'sinde 1 kare = 20 birim, aynı üst çizgi).
  function marjNot(M, yazi, y, renkAd, anlik = false) {
    marjNotSil(M, true);
    const g = svgEl('g', { class: 'marj-sek' }, M.svg);
    return metinSvg(g, yazi, {
      x: 30, y: Math.max(40, y), boyut: yazi.length > 5 ? 11 : 15, renk: renkAd, hiza: 'middle', aci: -10,
      tohum: ['sek', yazi], anlik,
    });
  }
  function marjNotSil(M, anlik) {
    M.svg.querySelectorAll(':scope > .marj-sek').forEach(g => (anlik ? g.remove() : KL.soldur(g, 200)));
  }

  /* ---------- üst: başlık, durum, sayfa numarası ---------- */

  function altCizgi(K, katman, x1, x2, y, an, gecikme, anlik) {   // dalgalı altı çizili çizgi
    const genis = x2 - x1;
    const pts = [[x1, y + 1], [x1 + genis * .25, y - 2], [x1 + genis * .5, y + 2], [x1 + genis * .75, y - 1.5], [x2, y + 1]];
    return K.egri(katman, pts, { strokeWidth: 2.8 }, ['altcizgi', ...an], { gecikme, anlik });
  }

  // Üst SVG yalnız başlığı taşır; durum satırı ayrı HTML metnidir (durumYaz).
  function ustYaz(svg, gecikme = 0, anlik = false) {
    svg.textContent = '';
    svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
    const K = KL.kalemYap(svg);
    const baslik = metinSvg(svg, 'KAĞIT FUTBOLU', {
      x: 0, y: 56, boyut: 52, hiza: 'start', tohum: ['baslik'], gecikme, adim: 60, anlik,
    });
    const w = baslik.node.getComputedTextLength() || 350;
    svg.setAttribute('viewBox', `-6 -3 ${w + 18} 78`);
    const cizgi = altCizgi(K, svg, -2, w + 6, 67, ['baslik'], gecikme + baslik.sure * .8, anlik);
    return { bitti: Promise.all([baslik.bitti, cizgi.bitti]), sure: baslik.sure + 300 };
  }

  function durumYaz(svg, yazi, renk = 'kursun', gecikme = 0, anlik = false) {
    // HTML metni ekranla birlikte küçülmez; aynı içerik ekran okuyucuya da ulaşır.
    const durum = document.getElementById('durum-metni');
    const duyuru = document.getElementById('duyuru');
    if (durum) durum.textContent = yazi;
    if (duyuru) duyuru.textContent = yazi;
    return { bitti: Promise.resolve(), sure: 0 };
  }

  // Sağ üst köşede el yazısıyla sayfa numarası (60×32 birim).
  function sayfaNoYaz(svg, no, gecikme = 0, anlik = false) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 60 32');
    return metinSvg(svg, 'sayfa ' + no, {
      x: 58, y: 22, boyut: 16, renk: 'kursun', hiza: 'end', aci: 3, tohum: ['sayfa-no', no], gecikme, anlik,
    });
  }


  /* ---------- hamle çizgileri ve top ---------- */

  // Hamle çizgisi: a → b (saha noktaları [x, y]). Sahibin renginde, kalemle çiziliyormuş gibi (120–200 ms, config.cizim.sureMs).
  // Seed kenara bağlı: aynı kenar aynı titrek çizgiyi verir. anahtar: kaldırmak için (cizgiSil).
  function cizgiCiz(T, a, b, sahip, kenarId, o = {}) {
    const [x1, y1] = T.nok(a[0], a[1]), [x2, y2] = T.nok(b[0], b[1]);
    const g = svgEl('g', { class: 'hamle' }, T.katman.cizgiler);
    g.dataset.kenar = kenarId;
    const s = T.K.cizgi(g, [x1, y1, x2, y2], { stroke: murekkep(sahip), strokeWidth: 2.3, roughness: 1 },
      ['hamle', T.id, kenarId], { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs });
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  function cizgiSil(T, kenarId, anlik) {
    const g = T.katman.cizgiler.querySelector(`[data-kenar="${kenarId}"]`);
    return anlik ? (g && g.remove(), Promise.resolve()) : KL.soldur(g, 200);
  }

  // Topu anında (x, y) noktasına koyar.
  function topKonumla(T, x, y) {
    const g = T.katman.top.querySelector('.top-grup');
    if (!g) return;
    const [px, py] = T.nok(x, y);
    g.setAttribute('transform', `translate(${px} ${py})`);
    g.dataset.x = x; g.dataset.y = y;
  }

  // Topu çizgiyle birlikte kaydırır (sureMs: çizginin süresi). Biten Promise döner.
  function topTasi(T, x, y, sureMs, gecikme = 0, anlik = false) {
    const g = T.katman.top.querySelector('.top-grup');
    if (!g) return Promise.resolve();
    const [px, py] = T.nok(x, y);
    const [ox, oy] = [+g.dataset.x, +g.dataset.y];
    const [qx, qy] = T.nok(ox, oy);
    g.dataset.x = x; g.dataset.y = y;
    const ic = g.querySelector('.top-ic');
    const a0 = ic ? +(ic.dataset.aci || 0) : 0, a1 = a0 + Math.hypot(px - qx, py - qy) * 3.2;   // yaklaşık 3°/birim yuvarlanır
    if (ic) ic.dataset.aci = a1;
    if (!KL.animasyonVar() || anlik || !sureMs) {
      g.setAttribute('transform', `translate(${px} ${py})`);
      if (ic) ic.style.transform = `rotate(${a1}deg)`;
      return Promise.resolve();
    }
    const sure = Math.max(sureMs, 60), ek = { duration: sure, delay: gecikme, easing: 'ease-in-out', fill: 'both' };
    const a = g.animate([{ transform: `translate(${qx}px, ${qy}px)` }, { transform: `translate(${px}px, ${py}px)` }], ek);
    const b = ic ? ic.animate([{ transform: `rotate(${a0}deg)` }, { transform: `rotate(${a1}deg)` }], ek) : null;
    return a.finished.then(() => {
      g.setAttribute('transform', `translate(${px} ${py})`); a.cancel();
      if (b) { ic.style.transform = `rotate(${a1}deg)`; b.cancel(); }
    }, () => {});
  }

  // Fare üstündeki gidilebilir noktayı koyulaştırır (x/y null: vurguyu kaldırır)
  function ipucuVurgula(T, x, y) {
    for (const g of T.katman.ipucu.children) g.setAttribute('opacity', (+g.dataset.x === x && +g.dataset.y === y) ? 1 : .7);
  }

  function ipucuSil(T) { T.katman.ipucu.textContent = ''; }
  function okSil(T) { T.katman.ok.textContent = ''; }

  /* ---------- notlar, titreşim, sürükleme ---------- */

  // Sahada kısa el yazısı not ("sek!", "GOL!", "sıkıştı!"); kalmaMs sonra solar. (x, y) saha noktası + (dx, dy) birim kayma.
  function notYaz(T, yazi, x, y, o = {}) {
    const [px, py] = T.nok(x, y);
    const g = svgEl('g', { class: 'not-yazi', 'pointer-events': 'none' }, T.katman.not);
    duzTut(T, g, px + (o.dx || 0), py + (o.dy || 0));
    const t = metinSvg(g, yazi, {
      x: px + (o.dx || 0), y: py + (o.dy || 0), boyut: o.boyut || 22, renk: o.renk || 'kursun',
      hiza: 'middle', aci: o.aci ?? -6, tohum: ['not', T.id, yazi, o.tohum || 0], gecikme: o.gecikme, adim: 45, anlik: o.anlik,
    });
    if (o.kalmaMs) t.bitti.then(() => setTimeout(() => KL.soldur(g, 300), o.kalmaMs));
    return { node: g, bitti: t.bitti, sure: t.sure };
  }

  // Topun etrafına el yapımı halka ("sıkıştı!" için)
  function halkaCiz(T, x, y, renkAd, o = {}) {
    const [px, py] = T.nok(x, y);
    const g = svgEl('g', { class: 'halka', 'pointer-events': 'none' }, T.katman.not);
    const e = { stroke: renkDeger(renkAd), strokeWidth: 1.9, roughness: 1.6 };
    const a = T.K.elips(g, [px, py, 52, 48], e, ['halka', T.id, 1], { anlik: o.anlik, sureMs: [160, 200] });
    const b = T.K.elips(g, [px + 1, py - 1, 58, 52], e, ['halka', T.id, 2], { anlik: o.anlik, gecikme: 120, sureMs: [160, 200] });
    return { node: g, bitti: Promise.all([a.bitti, b.bitti]), sure: 400 };
  }

  // Geçersiz dokunuş: dokunulan yerde küçük kurşun kalem çarpısı, hemen solar.
  function vurusCiz(T, px, py) {
    const g = svgEl('g', { class: 'vurus', 'pointer-events': 'none', opacity: .8 }, T.katman.gecici);
    const r = rastgele('vurus', Math.round(px), Math.round(py));
    const e = { stroke: kursun(), strokeWidth: 1.6, roughness: 1.2 };
    const j = () => aralik(r, -1.2, 1.2);
    T.K.cizgi(g, [px - 7 + j(), py - 7 + j(), px + 7 + j(), py + 7 + j()], e, ['vurus', T.id, 1, Math.round(px)], { sureMs: [60, 80] });
    T.K.cizgi(g, [px + 7 + j(), py - 7 + j(), px - 7 + j(), py + 7 + j()], e, ['vurus', T.id, 2, Math.round(py)], { gecikme: 70, sureMs: [60, 80] });
    setTimeout(() => KL.soldur(g, 220), 380);
  }

  // Masaüstünde toptan sürükleme: top ile imleç arasında geçici kurşun kalem çizgisi.
  function surukleCiz(T, a, p) {
    T.katman.gecici.querySelectorAll('.surukle').forEach(n => n.remove());
    const g = svgEl('g', { class: 'surukle', 'pointer-events': 'none', opacity: .75 }, T.katman.gecici);
    const [x1, y1] = T.nok(a[0], a[1]);
    T.K.cizgi(g, [x1, y1, p[0], p[1]], { stroke: kursun(), strokeWidth: 1.4, roughness: .8 }, ['surukle', T.id], { anlik: true });
  }
  function surukleSil(T) { T.katman.gecici.querySelectorAll('.surukle').forEach(n => n.remove()); }

  // Kalenin yanındaki boş bantta büyük "GOL!" (taraf: 0 üst · 1 alt; kazanan: yazı rengi)
  function golYaz(T, taraf, kazanan, gecikme = 0, anlik = false) {
    const y = taraf === 0 ? -0.15 : T.H + 0.9;
    return notYaz(T, 'GOL!', T.W / 2 + 2.5, y, { boyut: 36, renk: kazanan === 1 ? 'kirmizi' : 'mavi', aci: -8, gecikme, anlik, tohum: kazanan });
  }

  /* ---------- sonuç ---------- */

  // Oyun sonu: sahanın ortasına kağıt renginde bir leke, üstüne büyük el yazısı sonuç.
  function sonucCiz(T, baslik, alt, renkAd, gecikme = 0, anlik = false) {
    const ink = renkDeger(renkAd);
    const c = T.gen / 2, cy = T.yuk / 2;
    const w = T.gen * .9, h = 150;
    const g = svgEl('g', { class: 'sonuc', 'pointer-events': 'none' }, T.katman.not);
    duzTut(T, g, c, cy);
    const e = T.K.elips(g, [c, cy, w, h], { stroke: ink, strokeWidth: 2, fill: renkDeger('kagit'), fillStyle: 'solid' }, ['sonuc', T.id], { gecikme, anlik });
    const t0 = gecikme + e.sure * .6;
    const boyut = Math.max(22, Math.min(48, (w * .74) / (baslik.length * .55)));
    const t1 = metinSvg(g, baslik, { x: c, y: cy - 4, boyut, renk: ink, aci: -4, tohum: ['sonuc', baslik], gecikme: t0, adim: 50, anlik });
    const t2 = metinSvg(g, alt, { x: c, y: cy + h * .26, boyut: 17, renk: 'kursun', aci: -3, tohum: ['sonuc2', alt], gecikme: t0 + t1.sure, anlik });
    return { node: g, bitti: Promise.all([e.bitti, t1.bitti, t2.bitti]), sure: t0 + t1.sure + t2.sure };
  }

  /* ---------- ayar notları ---------- */

  // Onay kutusu: elle çizilmiş kare, işaretliyse mavi kalemle çarpı (kutudan taşar).
  function kutucukCiz(svg, anahtar, isaretli, anlik = false) {
    svg.textContent = '';
    const K = KL.kalemYap(svg);
    K.dikdortgen(svg, [3, 3, 14, 14], { stroke: kursun(), strokeWidth: 1.5, roughness: 1.3 }, ['kutucuk', anahtar], { anlik, sureMs: [150, 200] });
    if (isaretli) {
      const ek = { stroke: renkDeger('mavi'), strokeWidth: 2, roughness: 1 };
      K.cizgi(svg, [2, 2, 18, 18], ek, ['kutucuk-x1', anahtar], { anlik, gecikme: 120, sureMs: [100, 140] });
      K.cizgi(svg, [18.5, 3, 3, 17.5], ek, ['kutucuk-x2', anahtar], { anlik, gecikme: 230, sureMs: [100, 140] });
    }
  }

  // Seçili ayar sözcüğünün etrafına küçük kalem çemberi (yoksa siler).
  function ayarCemberi(btn, secili, anlik = false) {
    const eski = btn.querySelector(':scope > svg.cerceve');
    if (eski) eski.remove();
    if (!secili) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'cerceve', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.insertBefore(svg, btn.firstChild);
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w + 6, h * 1.05], { stroke: kursun(), strokeWidth: 1.4, roughness: 1.5 },
      ['ayar-cember', btn.dataset.ayar, btn.dataset.deger], { anlik, sureMs: [200, 260] });
  }


  /* ---------- alt menü: futbol simgeleri ---------- */

  // Her simge 60×44 birimlik kendi SVG'sinde. Benim mürekkebim (mavi); pasifken kurşun gri ve soluk.
  const SIMGELER = {
    // düdük: gövde, ağızlık, delik, halka ve ip; ağızlıktan çıkan ses çizgileri
    duduk(K, g, s, an, ek) {
      K.daire(g, [22, 25, 22], s, an('govde'), ek);
      K.yol(g, 'M 27 15 L 51 13 L 52 21 L 31 23', s, an('agizlik'), { ...ek, gecikme: ek.gecikme + 90 });
      K.daire(g, [21, 25, 6], { ...s, strokeWidth: 1.3 }, an('delik'), { ...ek, gecikme: ek.gecikme + 150 });
      K.daire(g, [11, 13, 7], { ...s, strokeWidth: 1.4 }, an('halka'), { ...ek, gecikme: ek.gecikme + 190 });
      K.egri(g, [[8, 17], [5, 28], [8, 38], [4, 43]], { ...s, strokeWidth: 1.3 }, an('ip'), { ...ek, gecikme: ek.gecikme + 230 });
      [[55, 11, 59, 7], [56, 17, 60, 17], [55, 23, 59, 27]].forEach((c, i) =>
        K.cizgi(g, c, { ...s, strokeWidth: 1.3 }, an('ses' + i), { ...ek, gecikme: ek.gecikme + 280 + i * 40 }));
    },
    // VAR: küçük ekran, içinde el yazısıyla VAR, ayaklı
    var(K, g, s, an, ek, ink) {
      K.dikdortgen(g, [8, 5, 44, 28], s, an('ekran'), ek);
      KL.metinSvg(g, 'VAR', { x: 30, y: 24, boyut: 15, renk: ink, hiza: 'middle', aci: -3, tohum: ['simge-var'], gecikme: ek.gecikme + 120, anlik: ek.anlik });
      K.cizgi(g, [25, 33, 21, 40], s, an('ayak1'), { ...ek, gecikme: ek.gecikme + 200 });
      K.cizgi(g, [35, 33, 39, 40], s, an('ayak2'), { ...ek, gecikme: ek.gecikme + 230 });
      K.cizgi(g, [16, 41, 44, 41], s, an('taban'), { ...ek, gecikme: ek.gecikme + 260 });
    },
    // tekrar: neredeyse tam bir çember ok ve ortada oynat üçgeni
    tekrar(K, g, s, an, ek) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + 0.35 + i * (2 * Math.PI - 0.9) / 10; pts.push([30 + 15 * Math.cos(a), 22 + 15 * Math.sin(a)]); }
      K.egri(g, pts, s, an('yay'), ek);
      const [ux, uy] = pts[pts.length - 1];
      K.cizgi(g, [ux, uy, ux + 7, uy - 3], s, an('uc1'), { ...ek, gecikme: ek.gecikme + 160 });
      K.cizgi(g, [ux, uy, ux + 1, uy + 7], s, an('uc2'), { ...ek, gecikme: ek.gecikme + 190 });
      K.cokgen(g, [[26, 15], [26, 29], [37, 22]], { ...s, strokeWidth: 1.5 }, an('oynat'), { ...ek, gecikme: ek.gecikme + 220 });
    },
    // taktik panosu: pano, mandal, X ve O'lar, kesik okla pas
    pano(K, g, s, an, ek) {
      K.dikdortgen(g, [13, 5, 34, 37], s, an('pano'), ek);
      K.dikdortgen(g, [23, 2, 14, 7], { ...s, strokeWidth: 1.5 }, an('mandal'), { ...ek, gecikme: ek.gecikme + 90 });
      const t = { ...s, strokeWidth: 1.4 };
      K.cizgi(g, [18, 14, 24, 20], t, an('x1'), { ...ek, gecikme: ek.gecikme + 150 });
      K.cizgi(g, [24, 14, 18, 20], t, an('x2'), { ...ek, gecikme: ek.gecikme + 170 });
      K.daire(g, [39, 33, 6.5], t, an('o1'), { ...ek, gecikme: ek.gecikme + 200 });
      K.daire(g, [21, 34, 6], t, an('o2'), { ...ek, gecikme: ek.gecikme + 220 });
      K.egri(g, [[23, 22], [30, 27], [35, 28]], { ...t, strokeLineDash: [2.5, 2.5] }, an('pas'), { ...ek, gecikme: ek.gecikme + 250 });
      K.cizgi(g, [35, 28, 31, 25], t, an('ok1'), { ...ek, gecikme: ek.gecikme + 290 });
      K.cizgi(g, [35, 28, 31, 31], t, an('ok2'), { ...ek, gecikme: ek.gecikme + 300 });
    },
  };

  // svg: düğmenin içindeki <svg class="ikon" viewBox="0 0 60 44">. tur: duduk · var · tekrar · pano
  function simgeCiz(svg, tur, pasif = false, o = {}) {
    svg.textContent = '';
    const K = KL.kalemYap(svg), ink = pasif ? kursun() : renkDeger('mavi');
    const g = svgEl('g', { opacity: pasif ? .55 : 1 }, svg);
    const s = { stroke: ink, strokeWidth: 1.8, roughness: .9 };
    SIMGELER[tur](K, g, s, (ad) => ['simge', tur, ad], { gecikme: o.gecikme || 0, anlik: o.anlik, sureMs: [80, 140] }, ink);
  }

  // Üzerine gelince / odaklanınca simgenin çevresine kurşun kalem halkası (her seferinde yeni tohum). acik: false → siler.
  function simgeHalka(btn, acik, anlik = false) {
    btn.querySelectorAll(':scope > svg.halka-cerceve').forEach(s => s.remove());
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'cerceve halka-cerceve', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.insertBefore(svg, btn.firstChild);
    const n = (+btn.dataset.halka || 0) + 1;
    btn.dataset.halka = n;
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w * 1.04, h * 1.02], { stroke: kursun(), strokeWidth: 1.4, roughness: 1.6 },
      ['simge-halka', btn.id, n], { anlik, sureMs: [180, 240] });
  }

  /* ---------- maç bileti ---------- */

  // 200×76 birimlik bilet: çentikli kenarlar, koçanı ayıran delikli çizgi, başlık, en çok üç satır ve sayfa numarası.
  function biletCiz(svg, satirlar, no, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 200 76');
    const K = KL.kalemYap(svg), kur = kursun();
    const s = { stroke: kur, strokeWidth: 1.5, roughness: 1 };
    const ek = { gecikme: o.gecikme || 0, anlik: o.anlik, sureMs: [220, 320] };
    K.yol(svg, 'M 6 4 L 194 4 L 194 31 A 7 7 0 0 0 194 45 L 194 72 L 6 72 L 6 45 A 7 7 0 0 0 6 31 Z', s, ['bilet', 'dis', no], ek);
    K.cizgi(svg, [151, 9, 151, 67], { ...s, strokeWidth: 1.2, strokeLineDash: [3, 4] }, ['bilet', 'delik', no], { ...ek, gecikme: ek.gecikme + 200 });
    const yazi = (t, x, y, boyut, hiza, tohum, gec) => metinSvg(svg, t, { x, y, boyut, renk: 'kursun', hiza, aci: -1, tohum, gecikme: ek.gecikme + gec, adim: 18, anlik: o.anlik });
    yazi(o.baslik || 'MAÇ BİLETİ', 14, 19, 12, 'start', ['bilet-baslik', o.baslik || ''], 120);
    satirlar.slice(0, 3).forEach((t, i) => yazi(t, 14, 36 + i * 15, 11.5, 'start', ['bilet', t], 200 + i * 80));
    yazi('sayfa', 172, 28, 10, 'middle', ['bilet-sayfa'], 150);
    yazi(String(no), 172, 57, 22, 'middle', ['bilet-no', no], 220);
  }

  /* ---------- taktik notu: not kâğıdının kalem süsü ---------- */

  // svg not kutusunu kaplar (w×h piksel = birim). Kurşun kalemle kenar ve üstte yapışkan bant.
  function notSusCiz(svg, w, h, anlik = false) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const K = KL.kalemYap(svg), kur = kursun();
    K.dikdortgen(svg, [2, 2, w - 4, h - 4], { stroke: kur, strokeWidth: 1.3, roughness: 1.4 }, ['not-kenar', Math.round(w), Math.round(h)], { anlik, sureMs: [260, 360] });
    const bx = w / 2, bw = Math.min(110, w * .38);
    K.cokgen(svg, [[bx - bw / 2, -9], [bx + bw / 2, -13], [bx + bw / 2 + 3, 9], [bx - bw / 2 + 2, 13]],
      { stroke: kur, strokeWidth: 1, roughness: 1.2, fill: kur, fillStyle: 'hachure', hachureGap: 4, fillWeight: .6, hachureAngle: 70 },
      ['not-bant', Math.round(w)], { anlik, gecikme: 150 });
  }

  /* ---------- köşe süsleri: futbol karalamaları (kurşun kalem) ---------- */

  const FUTBOL_SUSLERI = {
    // kupa (viewBox 100×100)
    kupa(K, g, gec, an, anlik) {
      const kur = kursun(), s = { stroke: kur, strokeWidth: 1.6, roughness: 1 }, o = (e = 0) => ({ gecikme: gec + e, anlik });
      K.yol(g, 'M 30 16 L 70 16 Q 71 50 50 58 Q 29 50 30 16 Z', { ...s, fill: kur, fillStyle: 'hachure', hachureGap: 5, fillWeight: .7, hachureAngle: -40 }, [...an, 'govde'], o());
      K.egri(g, [[30, 22], [15, 24], [18, 40], [34, 45]], s, [...an, 'kulp1'], o(160));
      K.egri(g, [[70, 22], [85, 24], [82, 40], [66, 45]], s, [...an, 'kulp2'], o(200));
      K.cizgi(g, [46, 58, 45, 70], s, [...an, 'ayak1'], o(240));
      K.cizgi(g, [54, 58, 55, 70], s, [...an, 'ayak2'], o(260));
      K.dikdortgen(g, [36, 70, 28, 8], s, [...an, 'taban1'], o(300));
      K.dikdortgen(g, [31, 78, 38, 8], s, [...an, 'taban2'], o(340));
    },
    // köşe bayrağı (viewBox 60×60): direk, taramalı üçgen bayrak, köşe yayı
    bayrak(K, g, gec, an, anlik) {
      const kur = kursun(), s = { stroke: kur, strokeWidth: 1.6, roughness: 1 }, o = (e = 0) => ({ gecikme: gec + e, anlik });
      K.cizgi(g, [14, 56, 15, 6], s, [...an, 'direk'], o());
      K.cokgen(g, [[15, 7], [46, 14], [15, 24]], { ...s, fill: kur, fillStyle: 'hachure', hachureGap: 4, fillWeight: .7, hachureAngle: 30 }, [...an, 'bez'], o(150));
      K.egri(g, [[26, 56], [23, 48], [14, 45]], { ...s, strokeWidth: 1.3 }, [...an, 'yay'], o(260));
      K.cizgi(g, [2, 56, 56, 56], { ...s, strokeWidth: 1.3 }, [...an, 'cizgi'], o(300));
    },
    // top (viewBox 80×80)
    top(K, g, gec, an, anlik) {
      const kur = kursun(), s = { stroke: kur, strokeWidth: 1.6, roughness: .9 }, o = (e = 0) => ({ gecikme: gec + e, anlik });
      K.daire(g, [40, 40, 60], s, [...an, 'dis'], o());
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        pts.push([40 + 11 * Math.cos(a), 40 + 11 * Math.sin(a)]);
        K.cizgi(g, [40 + 12.5 * Math.cos(a), 40 + 12.5 * Math.sin(a), 40 + 28 * Math.cos(a), 40 + 28 * Math.sin(a)], { ...s, strokeWidth: 1.3 }, [...an, 'c', i], o(200 + i * 40));
      }
      K.cokgen(g, pts, { ...s, fill: kur, fillStyle: 'hachure', hachureGap: 3, fillWeight: .7 }, [...an, 'yama'], o(150));
    },
  };

  // svg: kendi viewBox'ı olan boş <svg>. 'sus-<ad>.png' varlığı varsa onu kullanır.
  function susCiz(svg, ad, an, gecikme = 0, anlik = false) {
    svg.textContent = '';
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (KL.varlik('sus-' + ad) && vb) return KL.resimEkle(svg, 'sus-' + ad, 0, 0, vb.width, vb.height, { gecikme, anlik });
    const K = KL.kalemYap(svg);
    const g = svgEl('g', { opacity: .85 }, svg);
    FUTBOL_SUSLERI[ad](K, g, gecikme, ['sus', ad, ...an], anlik);
    return { node: g, bitti: Promise.resolve(), sure: 600 };
  }

  KF.draw = {
    ADIM, KENAR,
    sahaKur, yonAyarla, sahaCiz, kaleciCiz, topCiz, okCiz, ipucuCiz, ipucuSil, okSil,
    cizgiCiz, cizgiSil, topKonumla, topTasi, ipucuVurgula, marjNot, marjNotSil,
    notYaz, halkaCiz, vurusCiz, surukleCiz, surukleSil, golYaz, sonucCiz, kutucukCiz, ayarCemberi,
    marjKur, etiketle, ceteleGuncelle,
    ustYaz, durumYaz, sayfaNoYaz,
    simgeCiz, simgeHalka, biletCiz, notSusCiz, susCiz,
  };
})();
