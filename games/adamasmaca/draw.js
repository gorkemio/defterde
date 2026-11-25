// draw.js — Adam Asmaca'ya özgü çizim: kelime çizgileri, harf yazımı, darağacı ve yüz, alfabe işaretleri, kategori etiketi,
// çetele, İçindekiler çizimleri. Kalem altyapısı kit/kalem.js'te. Oyun kurallarını bilmez: metin, indeks, sayı alır.
// Her çizim ilkeli { node, bitti, sure } döndürür (bkz. kit/kalem.js). 1 defter karesi = 20 SVG birimi.
(function () {
  'use strict';

  const AA = (window.AA = window.AA || {});
  const KL = window.Kit.kalem;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger } = KL;
  const C = AA.config;
  const tr = AA.tr;

  const mavi = () => renkDeger('mavi');
  const kirmizi = () => renkDeger('kirmizi');
  const kursun = () => renkDeger('kursun');
  const bekle = KL.bekle;

  /* ---------- kelime çizgileri ---------- */

  const SATIR_Y = 46;                                 // iki satır arası (birim)
  const SATIR_ALT = 40;                               // satırın çizgisinin satır üstünden uzaklığı

  // gosterim: "KİTAP" ya da "AĞAÇ YAŞKEN EĞİLİR". genis: alanın eni (birim). Kelimeler satıra sarılır; her satır ortalanır.
  // o.enCokSatir (2): satır sayısı bunu geçerse harf adımı küçülür; alan sabit kalır, sayfa uzamaz. Tek kelimede harfler daha iri.
  // Dönen T: { svg, K, id, poz: [{x, y}|null], yukseklik (birim), adim, katman }
  function kelimeKur(svg, gosterim, id, genis, o = {}) {
    svg.textContent = '';
    const kelimeler = gosterim.split(' ');
    const enUzun = Math.max(...kelimeler.map((w) => Array.from(w).length));
    const enCokSatir = o.enCokSatir || 2;

    // satırlara böl (açgözlü)
    const bol = (adim) => {
      const bosluk = adim * 0.8, satirlar = [];
      let simdi = [], genisSimdi = 0;
      for (const w of kelimeler) {
        const gw = Array.from(w).length * adim;
        const ek = simdi.length ? bosluk + gw : gw;
        if (simdi.length && genisSimdi + ek > genis) { satirlar.push(simdi); simdi = []; genisSimdi = 0; }
        genisSimdi += simdi.length ? bosluk + gw : gw;
        simdi.push(w);
      }
      satirlar.push(simdi);
      return satirlar;
    };
    let adim = Math.min(gosterim.includes(' ') ? 19 : 28, genis / enUzun);
    let satirlar = bol(adim);
    while (satirlar.length > enCokSatir && adim > 9) { adim -= 0.5; satirlar = bol(adim); }
    const bosluk = adim * 0.8;

    const poz = [];
    let indeks = 0;
    satirlar.forEach((satir, r) => {
      const toplam = satir.reduce((t, w) => t + Array.from(w).length * adim, 0) + bosluk * (satir.length - 1);
      let x = (genis - toplam) / 2;
      satir.forEach((w, wi) => {
        for (let k = 0; k < Array.from(w).length; k++) { poz[indeks++] = { x: x + adim * (k + 0.5), y: r * SATIR_Y + SATIR_ALT }; }
        x += Array.from(w).length * adim + bosluk;
        if (wi < satir.length - 1 || r < satirlar.length - 1) poz[indeks++] = null;       // boşluk
      });
    });

    const yukseklik = satirlar.length * SATIR_Y;
    svg.setAttribute('viewBox', `0 0 ${genis} ${yukseklik}`);
    const K = KL.kalemYap(svg);
    const katman = { cizgiler: svgEl('g', { class: 'cizgiler' }, svg), harfler: svgEl('g', { class: 'harfler' }, svg) };
    return { svg, K, id, poz, yukseklik, adim, katman, harfG: {} };
  }

  // Her harf için kısa, hafif eğik tükenmez çizgisi
  function cizgileriCiz(T, anlik) {
    const bit = [];
    let gec = 0;
    T.poz.forEach((p, i) => {
      if (!p) return;
      const r = rastgele('cizgi', T.id, i);
      const w = T.adim * 0.84, y0 = p.y + aralik(r, -.8, .8);
      const s = T.K.cizgi(T.katman.cizgiler, [p.x - w / 2, y0, p.x + w / 2, y0 - aralik(r, .8, 2)],
        { stroke: mavi(), strokeWidth: 1.6, roughness: 1.1 }, ['cizgi', T.id, i], { gecikme: anlik ? 0 : gec, anlik, sureMs: [120, 160] });
      bit.push(s.bitti);
      gec += 22;
    });
    return Promise.all(bit);
  }

  // Harfi çizginin üstüne mavi (ya da kırmızı) kalemle yazar: soldan sağa açılarak, ~200 ms.
  function harfYaz(T, i, ch, renk = 'mavi', o = {}) {
    const p = T.poz[i];
    const r = rastgele('harf', T.id, i, ch);
    const boyut = Math.min(40, T.adim * 1.5);
    const t = svgEl('text', {
      x: p.x, y: p.y - 5 + aralik(r, -1.2, 1.2), 'font-size': boyut.toFixed(1), fill: renkDeger(renk), 'text-anchor': 'middle',
      transform: `rotate(${aralik(r, -5, 5).toFixed(1)} ${p.x.toFixed(1)} ${(p.y - 5).toFixed(1)})`,
    }, T.katman.harfler);
    t.textContent = ch;
    T.harfG[i] = t;
    if (KL.animasyonVar() && !o.anlik) {
      const a = t.animate([{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0% -10% 0)' }],
        { duration: 210, delay: o.gecikme || 0, fill: 'backwards', easing: 'ease-out' });
      return { node: t, bitti: a.finished.then(() => {}, () => {}), sure: 210 };
    }
    return { node: t, bitti: Promise.resolve(), sure: 0 };
  }

  /* ---------- darağacı ve adam (mavi tükenmez) ---------- */

  // Parçalar game.PARCALAR sırasıyla. viewBox 150×220; adam 110. sütunda asılı, ayakları zeminden ~25 birim yukarıda.
  const DAR = {
    taban:    (K, g, an, o) => K.cizgi(g, [10, 205, 100, 205], {}, an, o),
    direk:    (K, g, an, o) => K.cizgi(g, [40, 205, 40, 20], {}, an, o),
    kiris:    (K, g, an, o) => K.cizgi(g, [40, 20, 110, 20], {}, an, o),
    ip:       (K, g, an, o) => K.cizgi(g, [110, 20, 110, 50], { strokeWidth: 1.4 }, an, o),
    kafa:     (K, g, an, o) => K.daire(g, [110, 68, 36], {}, an, o),
    govde:    (K, g, an, o) => K.cizgi(g, [110, 86, 110, 140], {}, an, o),
    solKol:   (K, g, an, o) => K.cizgi(g, [110, 98, 85, 125], {}, an, o),
    sagKol:   (K, g, an, o) => K.cizgi(g, [110, 98, 135, 125], {}, an, o),
    solBacak: (K, g, an, o) => K.cizgi(g, [110, 140, 90, 180], {}, an, o),
    sagBacak: (K, g, an, o) => K.cizgi(g, [110, 140, 130, 180], {}, an, o),
  };

  function daragaciKur(svg, id) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 150 220');
    const K = KL.kalemYap(svg);
    return { svg, K, id, grup: {}, yuz: svgEl('g', { class: 'yuz' }, svg) };
  }

  function parcaCiz(T, ad, o = {}) {
    if (T.grup[ad]) return { bitti: Promise.resolve(), sure: 0 };
    const g = svgEl('g', { class: 'parca', 'data-parca': ad }, T.svg);
    T.svg.insertBefore(g, T.yuz);                                          // yüz her zaman üstte
    T.grup[ad] = g;
    const s = DAR[ad](T.K, g, ['daragaci', T.id, ad], { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs || C.cizim.sureMs });
    return { node: g, bitti: s.bitti, sure: s.sure };
  }

  // Yüz: başta sakin; çizgi arttıkça kaşlar çatılır; son iki çizgide ter damlası; kayıpta şaşkın "o" ağız.
  //   kalan ≥ 5 sakin · 3–4 hafif kaş · 2 çatık kaş, düz ağız, ter · 1 dalgalı ağız, iki ter · 0 şaşkın
  function yuzSeviyesi(kalan) { return kalan >= 5 ? 0 : kalan >= 3 ? 1 : kalan === 2 ? 2 : kalan === 1 ? 3 : 4; }

  function damla(x, y) {
    const f = (v) => v.toFixed(1);
    return `M ${f(x)} ${f(y - 5)} C ${f(x + 3.4)} ${f(y - .6)}, ${f(x + 3.8)} ${f(y + 2.2)}, ${f(x)} ${f(y + 3.6)} ` +
           `C ${f(x - 3.8)} ${f(y + 2.2)}, ${f(x - 3.4)} ${f(y - .6)}, ${f(x)} ${f(y - 5)} Z`;
  }

  function yuzCiz(T, kalan, o = {}) {
    T.yuz.textContent = '';
    if (!T.grup.kafa) return { bitti: Promise.resolve(), sure: 0 };
    const sv = yuzSeviyesi(kalan), ink = mavi();
    const e = { stroke: ink, strokeWidth: 1.5, roughness: .8 };
    const an = (ad) => ['yuz', T.id, sv, ad];
    const y = { anlik: o.anlik, sureMs: [90, 140], gecikme: o.gecikme };
    const bit = [];
    const ekle = (s) => { bit.push(s.bitti); return s; };
    const goz = (x, yy) => ekle(T.K.daire(T.yuz, [x, yy, 4.4], { ...e, fill: ink, fillStyle: 'solid', strokeWidth: 1 }, an('g' + x), y));
    if (sv === 4) {                                                           // şaşkın: iri gözler, "o" ağız
      for (const x of [103, 117]) { ekle(T.K.daire(T.yuz, [x, 64, 8], e, an('gc' + x), y)); ekle(T.K.daire(T.yuz, [x, 64, 3], { ...e, fill: ink, fillStyle: 'solid', strokeWidth: 1 }, an('gn' + x), y)); }
      ekle(T.K.daire(T.yuz, [110, 77, 6], e, an('agiz'), y));
      ekle(T.K.cizgi(T.yuz, [97, 53, 106, 51], e, an('k1'), y)); ekle(T.K.cizgi(T.yuz, [123, 53, 114, 51], e, an('k2'), y));
    } else {
      goz(103, 64); goz(117, 64);
      if (sv === 0) ekle(T.K.egri(T.yuz, [[102, 74], [110, 79], [118, 74]], e, an('agiz'), y));
    }
    if (sv === 1) {
      ekle(T.K.cizgi(T.yuz, [98, 57, 107, 59], e, an('k1'), y)); ekle(T.K.cizgi(T.yuz, [122, 57, 113, 59], e, an('k2'), y));
      ekle(T.K.egri(T.yuz, [[103, 77], [110, 76], [117, 77]], e, an('agiz'), y));
    }
    if (sv >= 2 && sv <= 3) {
      ekle(T.K.cizgi(T.yuz, [96, 54, 107, 60], e, an('k1'), y)); ekle(T.K.cizgi(T.yuz, [124, 54, 113, 60], e, an('k2'), y));
      if (sv === 2) ekle(T.K.cizgi(T.yuz, [103, 77, 117, 77], e, an('agiz'), y));
      else ekle(T.K.egri(T.yuz, [[102, 78], [106, 75], [110, 78], [114, 75], [118, 78]], e, an('agiz'), y));
    }
    if (sv >= 2) ekle(T.K.yol(T.yuz, damla(129, 55), { ...e, strokeWidth: 1.2 }, an('ter'), y));
    if (sv >= 3) ekle(T.K.yol(T.yuz, damla(92, 52), { ...e, strokeWidth: 1.2 }, an('ter2'), y));
    return { bitti: Promise.all(bit), sure: 220 };
  }

  /* ---------- alfabe: gerçek düğmeler + üstünde kalem izi ---------- */

  function alfabeKur(kap, id) {
    kap.textContent = '';
    const dugmeler = {};
    for (const h of tr.ALFABE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'harf-tus';
      b.dataset.harf = h;
      b.id = 'tus-' + h;
      b.setAttribute('aria-label', h + ' harfi');
      const r = rastgele('tus', id, h);
      const span = document.createElement('span');
      span.className = 'h';
      span.textContent = h;
      span.style.transform = `translateY(${aralik(r, -1, 1).toFixed(2)}px) rotate(${aralik(r, -5, 5).toFixed(1)}deg)`;
      b.appendChild(span);
      b.appendChild(svgEl('svg', { class: 'isaret', viewBox: '0 0 32 38', 'aria-hidden': 'true' }));
      kap.appendChild(b);
      dugmeler[h] = b;
    }
    return dugmeler;
  }

  // durum: 'dogru' (mavi çember) | 'yanlis' (kırmızı karalama) | null (temiz)
  function tusIsaretle(btn, durum, id, o = {}) {
    const svg = btn.querySelector('svg.isaret');
    svg.textContent = '';
    btn.classList.toggle('yanlis', durum === 'yanlis');
    if (!durum) return Promise.resolve();
    const K = KL.kalemYap(svg), h = btn.dataset.harf;
    const y = { anlik: o.anlik, sureMs: [90, 130] };
    if (durum === 'dogru') {
      const s = K.elips(svg, [16, 19, 29, 33], { stroke: mavi(), strokeWidth: 1.6, roughness: 1.4 }, ['tus-dogru', id, h], { anlik: o.anlik, sureMs: [200, 260] });
      return s.bitti;
    }
    const e = { stroke: kirmizi(), strokeWidth: 1.9, roughness: 1.2 };
    const a = K.cizgi(svg, [6, 28, 27, 9], e, ['tus-y1', id, h], { ...y });
    const b = K.cizgi(svg, [7, 12, 26, 30], e, ['tus-y2', id, h], { ...y, gecikme: 70 });
    const c = K.cizgi(svg, [5, 20, 28, 17], e, ['tus-y3', id, h], { ...y, gecikme: 140 });
    return Promise.all([a.bitti, b.bitti, c.bitti]);
  }

  /* ---------- kategori etiketi ve yıldızlar ---------- */

  function yildizNoktalari(cx, cy, dis, ic, donuk) {
    const p = [];
    for (let i = 0; i < 10; i++) { const r = i % 2 ? ic : dis, a = -Math.PI / 2 + donuk + i * Math.PI / 5; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return p;
  }

  // Çember içinde kategori adı + zorluk yıldızları (kolay 1, orta 2, zor 3 dolu). svg görünür olmalı (metin ölçülür).
  function etiketCiz(svg, kategori, zorluk, id, genis, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${genis} 52`);
    const K = KL.kalemYap(svg);
    const t = metinSvg(svg, kategori, { x: 18, y: 34, boyut: 24, hiza: 'start', renk: 'mavi', tohum: ['etiket', kategori], gecikme: o.gecikme || 0, adim: 28, anlik: o.anlik });
    let w = t.node.getComputedTextLength() || kategori.length * 11;
    const yer = genis - 18 - 30 - 3 * 27 - 4;                              // etiket + üç yıldız satıra sığmazsa yazı küçülür
    if (w > yer) { t.node.setAttribute('font-size', (24 * yer / w).toFixed(1)); w = t.node.getComputedTextLength() || yer; }
    K.elips(svg, [18 + w / 2, 27, w + 30, 42], { stroke: mavi(), strokeWidth: 1.6, roughness: 1.4 }, ['etiket', id, kategori], { anlik: o.anlik, gecikme: o.gecikme || 0, sureMs: [350, 450] });
    const dolu = { kolay: 1, orta: 2, zor: 3 }[zorluk] || 1;
    const x0 = 18 + w + 30;
    for (let k = 0; k < 3; k++) {
      const r = rastgele('yildiz', id, k);
      const pts = yildizNoktalari(x0 + k * 27, 26, 11, 4.8, aralik(r, -.25, .25));
      K.cokgen(svg, pts, k < dolu ? { stroke: mavi(), strokeWidth: 1.3, fill: mavi(), fillStyle: 'hachure', hachureGap: 3, fillWeight: .8 } : { stroke: kursun(), strokeWidth: 1.2 },
        ['yildiz', id, k], { anlik: o.anlik, gecikme: (o.gecikme || 0) + 300 + k * 90, sureMs: [160, 220] });
    }
  }

  /* ---------- çetele: kurtarılan adamlar ---------- */

  const CETELE_MAX = 30;                                                   // 6 beşli grup
  // adet: kurtarılan adam sayısı. Son çizgi yeniyse (yeni: true) kalemle çizilir, diğerleri anında belirir.
  // o.yukseklik (52): viewBox boyu · o.y0: ilk satırın üstü · o.satirBasi: bir satırdaki beşli sayısı (marjda alt alta dizilir)
  function ceteleCiz(svg, adet, id, genis, o = {}) {
    svg.textContent = '';
    const satirBasi = o.satirBasi || 99, y0 = o.y0 || 0, ara = o.satirAra || 34;
    svg.setAttribute('viewBox', `0 0 ${genis} ${o.yukseklik || 52}`);
    const K = KL.kalemYap(svg);
    const goster = Math.min(adet, o.enCok ?? CETELE_MAX);
    for (let n = 0; n < goster; n++) {
      const grup = Math.floor(n / 5), j = n % 5;
      const r = rastgele('cetele', id, n);
      const x0 = (o.x0 ?? 6) + (grup % satirBasi) * 42, yy = y0 + Math.floor(grup / satirBasi) * ara, ink = mavi();
      const yeni = o.yeni && n === goster - 1;
      const ek = { stroke: ink, strokeWidth: 1.9, roughness: 1.1 };
      const y = { anlik: !yeni, sureMs: [160, 200] };
      if (j < 4) {
        const x = x0 + j * 7 + aralik(r, -.7, .7);
        K.cizgi(svg, [x, yy + 8 + aralik(r, -1, 1), x + aralik(r, -.8, .8), yy + 36 + aralik(r, -1, 1)], ek, ['cetele', id, n], y);
      } else {
        K.cizgi(svg, [x0 - 4, yy + 33 + aralik(r, -1, 1), x0 + 26, yy + 11 + aralik(r, -1, 1)], ek, ['cetele', id, n], y);
      }
    }
    return goster;
  }

  /* ---------- oklu "içindekiler" bağlantısı ve seçim çemberi ---------- */

  function okCiz(svg) {
    svg.textContent = '';
    const K = KL.kalemYap(svg), e = { stroke: kursun(), strokeWidth: 1.5, roughness: 1.2 };
    K.cizgi(svg, [28, 10, 3, 10], e, ['geri', 'g'], { anlik: true });
    K.cizgi(svg, [3, 10, 11, 3], e, ['geri', 'k1'], { anlik: true });
    K.cizgi(svg, [3, 10, 11, 17], e, ['geri', 'k2'], { anlik: true });
  }

  // İçindekiler'de seçili öğenin çevresine kurşun kalem çemberi (yoksa siler)
  function cemberCiz(btn, acik, anahtar, anlik = false) {
    const eski = btn.querySelector(':scope > svg.cerceve');
    if (eski) eski.remove();
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'cerceve', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.insertBefore(svg, btn.firstChild);
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w + 6, h * 0.98], { stroke: kursun(), strokeWidth: 1.4, roughness: 1.5 },
      ['ic-cember', anahtar], { anlik, sureMs: [220, 300] });
  }

  /* ---------- sayfa başı: başlık, dalgalı altı çizgi, sağ üst köşede tarih, altında durum satırı ---------- */

  // Birim: 1 kare = 20. tip: oyun / oyunK (telefon) / ic / icK. Tarih ayrı bir satırda, başlığın üstünde sağda (çakışmaz).
  const UST = {
    oyun:  { h: 88,  tarihY: 15, tarihB: 16, baslikY: 50, baslikB: 42, cizgiY: 58, durumY: 82, durumB: 19 },
    oyunK: { h: 76,  tarihY: 13, tarihB: 14, baslikY: 42, baslikB: 34, cizgiY: 49, durumY: 70, durumB: 16 },
    ic:    { h: 100, tarihY: 15, tarihB: 17, baslikY: 64, baslikB: 56, cizgiY: 74, durumY: 96, durumB: 19 },
    icK:   { h: 84,  tarihY: 13, tarihB: 14, baslikY: 52, baslikB: 42, cizgiY: 60, durumY: 80, durumB: 15 },
  };

  // o.altYazi: başlığın altındaki kurşun satır (İçindekiler'de alt başlık). Durum satırı durumYaz ile ayrıca yazılır.
  function ustBantCiz(svg, genis, tip, o = {}) {
    svg.textContent = '';
    svg.dataset.tip = tip;
    const u = UST[tip], anlik = !!o.anlik, g = o.gecikme || 0;
    svg.setAttribute('viewBox', `0 0 ${genis} ${u.h}`);
    const K = KL.kalemYap(svg);
    const tarihMetni = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tarih = metinSvg(svg, tarihMetni, { x: genis - 2, y: u.tarihY, boyut: u.tarihB, hiza: 'end', renk: 'kursun', aci: 1.4, tohum: ['tarih'], gecikme: g + 350, anlik });
    const b = metinSvg(svg, 'ADAM ASMACA', { x: 0, y: u.baslikY, boyut: u.baslikB, hiza: 'start', aci: -1.2, tohum: ['baslik', tip], adim: 55, gecikme: g, anlik });
    let w = b.node.getComputedTextLength() || genis * .75;
    if (w > genis - 10) { b.node.setAttribute('font-size', (u.baslikB * (genis - 10) / w).toFixed(1)); w = genis - 10; }
    const y = u.cizgiY;
    const cizgi = K.egri(svg, [[-3, y], [w * .25, y - 3], [w * .5, y + 1.5], [w * .75, y - 2], [w + 8, y]], { strokeWidth: 2 }, ['altcizgi', tip],
      { gecikme: anlik ? 0 : g + b.sure * .7, anlik });
    const bit = [tarih.bitti, b.bitti, cizgi.bitti];
    if (o.altYazi) bit.push(metinSvg(svg, o.altYazi, { x: 2, y: u.durumY, boyut: u.durumB, hiza: 'start', renk: 'kursun', tohum: ['alt', tip], gecikme: g + 650, anlik }).bitti);
    return { bitti: Promise.all(bit), sure: b.sure + 300 };
  }

  // Durum satırı (kurşun ya da mürekkep): eskisi silinir, yenisi yazılır. ustBantCiz'den sonra çağrılır.
  function durumYaz(svg, yazi, renk = 'kursun', o = {}) {
    const eski = svg.querySelector(':scope > .durum');
    if (eski) eski.remove();
    const u = UST[svg.dataset.tip || 'oyun'];
    if (!yazi) return { bitti: Promise.resolve(), sure: 0 };
    const g = svgEl('g', { class: 'durum' }, svg);
    return metinSvg(g, yazi, { x: 2, y: u.durumY, boyut: u.durumB, hiza: 'start', renk, tohum: ['durum', yazi], gecikme: o.gecikme || 0, adim: 22, anlik: o.anlik });
  }

  /* ---------- İçindekiler'in kahramanı: ipi kopmuş, yerde el sallayan adam; altında "_ A _ A _" ---------- */

  function kahramanCiz(svg, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 150 220');
    const K = KL.kalemYap(svg), an = (ad) => ['kahraman', ad], ink = mavi();
    const e = { stroke: ink, strokeWidth: 1.8 };
    const bit = [];
    let gec = o.gecikme || 0;
    const ciz = (s, ara = 110) => { bit.push(s.bitti); if (!o.anlik) gec += ara; };
    const y = (sureMs = [170, 240]) => ({ anlik: o.anlik, gecikme: gec, sureMs });
    ciz(K.cizgi(svg, [8, 172, 142, 172], e, an('taban'), y()));
    ciz(K.cizgi(svg, [32, 172, 32, 14], e, an('direk'), y()));
    ciz(K.cizgi(svg, [32, 14, 102, 14], e, an('kiris'), y()));
    ciz(K.cizgi(svg, [102, 14, 102, 31], { ...e, strokeWidth: 1.4 }, an('ip'), y([100, 140])), 60);
    ciz(K.cizgi(svg, [102, 31, 98, 38], { ...e, strokeWidth: 1.2 }, an('ip1'), y([60, 90])), 40);
    ciz(K.cizgi(svg, [102, 31, 105, 39], { ...e, strokeWidth: 1.2 }, an('ip2'), y([60, 90])), 90);
    ciz(K.daire(svg, [116, 92, 30], e, an('kafa'), y()));
    ciz(K.cizgi(svg, [116, 107, 116, 142], e, an('govde'), y()), 80);
    ciz(K.cizgi(svg, [116, 116, 99, 135], e, an('solKol'), y()), 80);
    ciz(K.cizgi(svg, [116, 116, 135, 95], e, an('sagKol'), y()), 80);
    ciz(K.cizgi(svg, [116, 142, 104, 172], e, an('solBacak'), y()), 80);
    ciz(K.cizgi(svg, [116, 142, 128, 172], e, an('sagBacak'), y()));
    const yz = { stroke: ink, strokeWidth: 1.4, roughness: .8 }, dolu = { ...yz, fill: ink, fillStyle: 'solid', strokeWidth: 1 };
    ciz(K.daire(svg, [111, 89, 4], dolu, an('g1'), y([60, 90])), 30);
    ciz(K.daire(svg, [121, 89, 4], dolu, an('g2'), y([60, 90])), 30);
    ciz(K.egri(svg, [[109, 96], [116, 101], [123, 96]], yz, an('agiz'), y([90, 120])), 60);
    const el = { stroke: kursun(), strokeWidth: 1.3, roughness: 1 };
    ciz(K.cizgi(svg, [139, 86, 145, 80], el, an('el1'), y([60, 90])), 50);
    ciz(K.cizgi(svg, [141, 94, 149, 92], el, an('el2'), y([60, 90])), 80);
    const xs = [18, 46, 74, 102, 130];
    xs.forEach((x, i) => ciz(K.cizgi(svg, [x - 10, 208, x + 10, 207], { stroke: ink, strokeWidth: 1.6, roughness: 1.1 }, an('c' + i), y([90, 120])), 40));
    for (const i of [1, 3]) ciz(metinSvg(svg, 'A', { x: xs[i], y: 202, boyut: 26, renk: 'mavi', tohum: ['kahraman-a', i], gecikme: gec, anlik: o.anlik }), 140);
    return { bitti: Promise.all(bit), sure: gec };
  }

  /* ---------- küçük kurşun simgeler (mod satırları, kart sayfası); viewBox 40×40 ---------- */

  // (x, y): başın üstü; s: ölçek. Çubuk adam.
  function cop(K, g, x, y, s, e, an, o) {
    return [
      K.daire(g, [x, y + 5 * s, 10 * s], e, [...an, 'k'], o),
      K.cizgi(g, [x, y + 10 * s, x, y + 22 * s], e, [...an, 'g'], o),
      K.cizgi(g, [x, y + 13 * s, x - 7 * s, y + 18 * s], e, [...an, 'k1'], o),
      K.cizgi(g, [x, y + 13 * s, x + 7 * s, y + 18 * s], e, [...an, 'k2'], o),
      K.cizgi(g, [x, y + 22 * s, x - 6 * s, y + 31 * s], e, [...an, 'b1'], o),
      K.cizgi(g, [x, y + 22 * s, x + 6 * s, y + 31 * s], e, [...an, 'b2'], o),
    ];
  }

  const SIMGE = {
    tek: (K, g, e, an, o) => cop(K, g, 20, 3, 1.15, e, an, o),
    okul: (K, g, e, an, o) => [...cop(K, g, 12, 5, .95, e, [...an, 1], o), ...cop(K, g, 28, 5, .95, e, [...an, 2], o)],
    hileci: (K, g, e, an, o) => {
      const dolu = { ...e, fill: e.stroke, fillStyle: 'solid', strokeWidth: .8 };
      return [
        K.daire(g, [20, 23, 27], e, [...an, 'kafa'], o),
        K.cizgi(g, [13, 11, 11, 4], e, [...an, 's1'], o), K.cizgi(g, [20, 9, 20, 2], e, [...an, 's2'], o), K.cizgi(g, [27, 11, 29, 4], e, [...an, 's3'], o),
        K.daire(g, [15, 22, 3], dolu, [...an, 'g1'], o), K.daire(g, [25, 22, 3], dolu, [...an, 'g2'], o),
        K.cizgi(g, [11, 17, 17, 17.5], e, [...an, 'k1'], o), K.cizgi(g, [22, 16, 29, 13], e, [...an, 'k2'], o),
        K.egri(g, [[13, 28], [20, 31], [28, 26]], e, [...an, 'a'], o),
      ];
    },
    gunun: (K, g, e, an, o) => [
      K.dikdortgen(g, [7, 9, 26, 27], e, [...an, 'y'], o),
      K.cizgi(g, [7, 16, 33, 16], e, [...an, 'c'], o),
      K.cizgi(g, [14, 5, 14, 12], e, [...an, 'h1'], o), K.cizgi(g, [26, 5, 26, 12], e, [...an, 'h2'], o),
      metinSvg(g, String(new Date().getDate()), { x: 20, y: 32, boyut: 14, renk: o.renkAd, tohum: ['simge-gun'], anlik: true }),
    ],
    maraton: (K, g, e, an, o) => {
      const ince = { ...e, strokeWidth: e.strokeWidth * .8 };
      return [
        K.daire(g, [26, 8, 9], e, [...an, 'k'], o),
        K.cizgi(g, [24.5, 12.5, 19, 24], e, [...an, 'g'], o),
        K.cizgi(g, [23, 16, 30, 20], e, [...an, 'k1'], o), K.cizgi(g, [23, 16, 15, 14], e, [...an, 'k2'], o),
        K.cizgi(g, [19, 24, 27, 29], e, [...an, 'b1'], o), K.cizgi(g, [27, 29, 25, 37], e, [...an, 'b2'], o),
        K.cizgi(g, [19, 24, 12, 33], e, [...an, 'b3'], o),
        K.cizgi(g, [2, 15, 9, 15], ince, [...an, 'h1'], o), K.cizgi(g, [1, 21, 8, 21], ince, [...an, 'h2'], o), K.cizgi(g, [3, 27, 10, 27], ince, [...an, 'h3'], o),
      ];
    },
    telefon: (K, g, e, an, o) => [
      K.dikdortgen(g, [9, 4, 15, 31], e, [...an, 'd'], o),
      K.dikdortgen(g, [11.5, 8, 10, 20], { ...e, strokeWidth: e.strokeWidth * .7 }, [...an, 'e'], o),
      K.daire(g, [16.5, 31.5, 3], e, [...an, 'b'], o),
      K.cizgi(g, [28, 19, 38, 19], e, [...an, 'o1'], o), K.cizgi(g, [38, 19, 34, 15.5], e, [...an, 'o2'], o), K.cizgi(g, [38, 19, 34, 22.5], e, [...an, 'o3'], o),
    ],
    goz: (K, g, e, an, o) => [
      K.egri(g, [[3, 20], [20, 9], [37, 20]], e, [...an, 'u'], o), K.egri(g, [[3, 20], [20, 31], [37, 20]], e, [...an, 'a'], o),
      K.daire(g, [20, 20, 10], { ...e, fill: e.stroke, fillStyle: 'hachure', hachureGap: 2.2, fillWeight: .7 }, [...an, 'b'], o),
    ],
    gozKapali: (K, g, e, an, o) => [
      K.egri(g, [[3, 17], [20, 27], [37, 17]], e, [...an, 'a'], o),
      K.cizgi(g, [10, 22, 8, 27], e, [...an, 'l1'], o), K.cizgi(g, [20, 26, 20, 32], e, [...an, 'l2'], o), K.cizgi(g, [30, 22, 32, 27], e, [...an, 'l3'], o),
    ],
  };

  // renk: 'kursun' | 'mavi' | 'kirmizi'. Döner { bitti }.
  function simgeCiz(svg, ad, renk = 'kursun', o = {}) {
    svg.textContent = '';
    if (!SIMGE[ad]) return { bitti: Promise.resolve() };
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 40 40');
    const K = KL.kalemYap(svg), g = svgEl('g', null, svg);
    const e = { stroke: renkDeger(renk), strokeWidth: o.kalin || 1.6, roughness: 1.1 };
    const cizimler = SIMGE[ad](K, g, e, ['simge', ad, renk], { anlik: o.anlik, gecikme: o.gecikme || 0, sureMs: [90, 140], renkAd: renk });
    return { bitti: Promise.all(cizimler.map((c) => c.bitti)) };
  }

  // Zorluk satırındaki küçük yıldızlar: dolu tane mürekkeple taranır. viewBox 66×22.
  function yildizlarCiz(svg, dolu, renk, id, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 66 22');
    const K = KL.kalemYap(svg);
    for (let k = 0; k < 3; k++) {
      const r = rastgele('ic-yildiz', id, k);
      const pts = yildizNoktalari(11 + k * 22, 11, 9, 3.9, aralik(r, -.25, .25));
      const e = k < dolu ? { stroke: renkDeger(renk), strokeWidth: 1.1, fill: renkDeger(renk), fillStyle: 'hachure', hachureGap: 2.6, fillWeight: .7 } : { stroke: kursun(), strokeWidth: 1, roughness: 1 };
      K.cokgen(svg, pts, e, ['ic-yildiz', id, k, renk], { anlik: o.anlik !== false });
    }
  }

  // Oyun bitince sıradaki adımın düğmesi kurşun kalemle çember içine alınır (kardeş oyunlardaki gibi).
  function dugmeIsaretle(btn, acik, anlik = false) {
    const eski = btn.querySelector(':scope > svg.isaret');
    if (eski) eski.remove();
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'isaret', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.appendChild(svg);
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w * 1.12, h * 1.5], { stroke: kursun(), strokeWidth: 1.5, roughness: 1.7 },
      ['dugme-isaret', btn.id], { anlik, gecikme: anlik ? 0 : 450, sureMs: [320, 420] });
  }

  /* ---------- kurtuluş: ip kopar, adam yere atlar, tozu silkeler, koşarak çıkar ---------- */

  // g'nin içeriğini (cx, cy) çevresinde döndürülebilir/ölçeklenebilir sarmalayıcıya koyar. Dış g konumlar, iç g (ic) animasyon alır:
  // transform-origin'e güvenmeyiz (Safari'de SVG'de tutarsız), pivot kaydırma ile elde edilir.
  function pivotSar(ebeveyn, cx, cy, cocuklar) {
    const dis = svgEl('g', { transform: `translate(${cx} ${cy})` }, ebeveyn);
    const ic = svgEl('g', null, dis);
    const geri = svgEl('g', { transform: `translate(${-cx} ${-cy})` }, ic);
    for (const c of cocuklar) if (c) geri.appendChild(c);
    return { dis, ic, geri };
  }

  // Adam parçalarını (kafa, gövde, kollar, bacaklar, yüz) tek bir hareket ağacına toplar.
  function adamKur(T) {
    const svg = T.svg;
    const kol1 = pivotSar(svg, 110, 98, [T.grup.solKol]), kol2 = pivotSar(svg, 110, 98, [T.grup.sagKol]);
    const bac1 = pivotSar(svg, 110, 140, [T.grup.solBacak]), bac2 = pivotSar(svg, 110, 140, [T.grup.sagBacak]);
    const konum = svgEl('g', { class: 'adam' }, svg);                       // düşme
    const kos = svgEl('g', null, konum);                                     // koşma ve sekme
    const ezil = pivotSar(kos, 110, 205, [T.grup.kafa, T.grup.govde, kol1.dis, kol2.dis, bac1.dis, bac2.dis, T.yuz]);   // yere inince ezilme
    return { konum, kos, ezil: ezil.ic, geri: ezil.geri, kol: [kol1.ic, kol2.ic], bacak: [bac1.ic, bac2.ic] };
  }

  const anim = (el, kare, secenek) => {
    const a = el.animate(kare, { fill: 'forwards', ...secenek });
    return a.finished.then(() => {}, () => {});
  };

  function tozCiz(T) {
    const g = svgEl('g', { class: 'toz', 'pointer-events': 'none' }, T.svg);
    const noktalar = [[94, 201, 10, -9], [126, 201, 11, 10], [84, 198, 7, -14], [136, 198, 8, 14], [110, 203, 6, 0]];
    const bit = noktalar.map(([x, y, cap, dx], i) => {
      const s = T.K.daire(g, [x, y, cap], { stroke: kursun(), fill: kursun(), fillStyle: 'hachure', hachureGap: 2.5, strokeWidth: 1.1, roughness: 1 },
        ['toz', T.id, i], { anlik: true });
      return anim(s.node, [{ opacity: .9, transform: 'translate(0px, 0px)' }, { opacity: 0, transform: `translate(${dx}px, -9px)` }], { duration: 650, delay: i * 40 });
    });
    return Promise.all(bit).then(() => g.remove());
  }

  // "Kurtuldu!" karalaması: sayfaya büyük, eğik, altı çizili; etrafında kıvılcım çizgileri
  function kurtulduYaz(T, ses) {
    if (ses) ses('kazan');
    const g = svgEl('g', { class: 'kurtuldu', 'pointer-events': 'none' }, T.svg);
    const t = metinSvg(g, 'Kurtuldu!', { x: 75, y: 122, boyut: 30, hiza: 'middle', renk: 'mavi', aci: -8, tohum: ['kurtuldu', T.id], adim: 60 });
    const alt = T.K.egri(g, [[14, 134], [45, 128], [80, 136], [112, 126], [138, 130]], { stroke: mavi(), strokeWidth: 2, roughness: 1.4 }, ['kurtuldu-alt', T.id], { gecikme: t.sure * .6 });
    const kivilcim = [[22, 92, 12, 80], [44, 84, 50, 72], [75, 82, 75, 70], [104, 84, 98, 72], [128, 92, 138, 80]];
    const k = kivilcim.map(([x1, y1, x2, y2], i) => T.K.cizgi(g, [x1, y1, x2, y2], { stroke: mavi(), strokeWidth: 1.6 }, ['kivilcim', T.id, i], { gecikme: t.sure * .7 + i * 70, sureMs: [90, 130] }).bitti);
    return Promise.all([t.bitti, alt.bitti, ...k]);
  }

  // darağacının dört ucu kalır; ip kopar, adam yere iner, kollarını sallar, sayfanın sağından koşarak çıkar.
  async function kurtulus(T, o = {}) {
    if (!T.grup.kafa) { await kurtulduYaz(T, o.ses); return; }          // hiç yanlış yapılmadı: adam çizilmemişti, yalnız yazı
    const hareket = KL.animasyonVar() && !o.anlik;
    const bitirOlmadan = () => { for (const ad of ['kafa', 'govde', 'solKol', 'sagKol', 'solBacak', 'sagBacak', 'ip']) if (T.grup[ad]) T.grup[ad].remove(); T.yuz.textContent = ''; };
    if (!hareket) { bitirOlmadan(); await kurtulduYaz(T, o.ses); return; }

    const a = adamKur(T);
    // 1. ip kopar: üstte kısa uç, adamın başında sarkan kopuk parça, "çat!"
    if (T.grup.ip) anim(T.grup.ip, [{ opacity: 1 }, { opacity: 0 }], { duration: 90 });
    T.K.cizgi(T.svg, [110, 20, 110, 30], { strokeWidth: 1.4 }, ['kopuk-ust', T.id], { anlik: true });
    T.K.cizgi(a.geri, [110, 50, 110, 38], { strokeWidth: 1.4 }, ['kopuk-alt', T.id], { anlik: true });
    if (o.ses) o.ses('ip');
    const cat = metinSvg(T.svg, 'çat!', { x: 130, y: 34, boyut: 14, renk: 'kursun', aci: -10, tohum: ['cat', T.id], adim: 45 });
    await KL.bekle(260);

    // 2. düşüş (25 birim) ve yere çarpma
    await anim(a.konum, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(0px, 25px)' }], { duration: 330, easing: 'cubic-bezier(.5, 0, 1, .6)' });
    anim(a.ezil, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.07, .9)' }, { transform: 'scale(1, 1)' }], { duration: 260 });
    const toz = tozCiz(T);
    await KL.bekle(220);

    // 3. tozu silkeler: kollar iki kez havaya
    await Promise.all([
      anim(a.kol[0], [{ transform: 'rotate(0deg)' }, { transform: 'rotate(75deg)' }, { transform: 'rotate(0deg)' }], { duration: 520, iterations: 2 }),
      anim(a.kol[1], [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-75deg)' }, { transform: 'rotate(0deg)' }], { duration: 520, iterations: 2 }),
    ]);
    anim(cat.node, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });

    // 4. koşarak çıkar: bacaklar makas, kollar sallanır, adam sekerek sağa gider (sayfanın dışına)
    const kosuSure = 1000;
    if (o.ses) o.ses('adim');
    anim(a.bacak[0], [{ transform: 'rotate(28deg)' }, { transform: 'rotate(-28deg)' }], { duration: 120, iterations: 9, direction: 'alternate' });
    anim(a.bacak[1], [{ transform: 'rotate(-28deg)' }, { transform: 'rotate(28deg)' }], { duration: 120, iterations: 9, direction: 'alternate' });
    anim(a.kol[0], [{ transform: 'rotate(-25deg)' }, { transform: 'rotate(30deg)' }], { duration: 120, iterations: 9, direction: 'alternate' });
    anim(a.kol[1], [{ transform: 'rotate(25deg)' }, { transform: 'rotate(-30deg)' }], { duration: 120, iterations: 9, direction: 'alternate' });
    const adimlar = 10, yol = 190;
    const kare = Array.from({ length: adimlar + 1 }, (_, k) => ({ transform: `translate(${(yol * (k / adimlar) ** 1.6).toFixed(1)}px, ${k % 2 ? -4 : 0}px)` }));
    await anim(a.kos, kare, { duration: kosuSure, easing: 'linear' });
    a.konum.remove();
    await toz;

    // 5. "Kurtuldu!" karalaması
    await kurtulduYaz(T, o.ses);
  }

  /* ---------- kayıp: adam elinde kelimenin yazdığı tabelayı tutar ---------- */

  function kayip(T, kelime, o = {}) {
    const n = Array.from(kelime).length;
    const w = Math.min(76, Math.max(44, n * 8 + 18)), h = 30, top = 98;
    const x = 110 - w / 2;
    const g = svgEl('g', { class: 'tabela' }, T.svg);
    const kare = T.K.dikdortgen(g, [x, top, w, h], { stroke: mavi(), strokeWidth: 1.7, roughness: 1.1, fill: '#fbf9f2', fillStyle: 'solid' },
      ['tabela', T.id], { anlik: o.anlik, gecikme: o.gecikme || 0, sureMs: [320, 400] });
    const boyut = Math.min(17, (w - 10) / (n * 0.6));
    const yazi = metinSvg(g, kelime, { x: 110, y: top + h / 2 + boyut * 0.34, boyut, renk: 'mavi', aci: -2, tohum: ['tabela-yazi', T.id], gecikme: (o.gecikme || 0) + (o.anlik ? 0 : 280), adim: 40, anlik: o.anlik });
    return { node: g, bitti: Promise.all([kare.bitti, yazi.bitti]), sure: 280 + yazi.sure };
  }

  /* ---------- rozet karalamaları (kurşun; kazanılan mavi) ---------- */

  const ROZET_SIRA = ['ilkOn', 'tekAtis', 'uzunKelime', 'atalarSozu', 'yediGun'];
  // Her karalama 28×28'lik kutuda çizilir
  const KARALAMA = {
    ilkOn: (K, g, e, an) => K.cokgen(g, yildizNoktalari(14, 14, 12, 5.2, .1), e, an, { anlik: true }),
    tekAtis: (K, g, e, an) => {                                                // ok: hedefe saplanmış
      K.egri(g, [[3, 24], [8, 8], [18, 6], [25, 12]], e, [...an, 'g'], { anlik: true });
      K.cizgi(g, [25, 12, 17, 12], e, [...an, 'k1'], { anlik: true });
      K.cizgi(g, [25, 12, 24, 20], e, [...an, 'k2'], { anlik: true });
    },
    uzunKelime: (K, g, e, an) => K.yol(g, 'M 7 22 C 1 22, 0 13, 7 12 C 7 4, 18 2, 20 9 C 27 8, 29 19, 22 22 Z', e, an, { anlik: true }),
    atalarSozu: (K, g, e, an) => K.yol(g, 'M 14 25 C 3 17, 2 6, 9 4 C 12 3, 14 6, 14 9 C 14 6, 16 3, 19 4 C 26 6, 25 17, 14 25 Z', e, an, { anlik: true }),
    yediGun: (K, g, e, an) => {
      K.daire(g, [14, 14, 13], e, an, { anlik: true });
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; K.cizgi(g, [14 + 10 * Math.cos(a), 14 + 10 * Math.sin(a), 14 + 16 * Math.cos(a), 14 + 16 * Math.sin(a)], e, [...an, 'i' + i], { anlik: true }); }
    },
  };

  // kazanilan: Set(rozet kodu). etiket: adı da yazılır (İçindekiler); yoksa yalnız küçük karalamalar (oyun sayfasının marjı).
  function rozetCiz(svg, kazanilan, id, genis, o = {}) {
    svg.textContent = '';
    const hucre = genis / ROZET_SIRA.length;
    svg.setAttribute('viewBox', `0 0 ${genis} ${o.etiket ? 64 : 34}`);
    const K = KL.kalemYap(svg);
    const adlar = AA.game.ROZETLER;
    ROZET_SIRA.forEach((kod, i) => {
      const var_ = kazanilan.has(kod), cx = hucre * i + hucre / 2;
      const g = svgEl('g', { transform: `translate(${(cx - 14).toFixed(1)} 3)`, opacity: var_ ? 1 : .55, 'data-rozet': kod }, svg);
      KARALAMA[kod](K, g, { stroke: var_ ? mavi() : kursun(), strokeWidth: 1.6, roughness: 1.2 }, ['rozet', id, kod]);
      if (o.etiket) {
        adlar[kod].split(' ').forEach((s, k) => metinSvg(svg, s, { x: cx, y: 46 + k * 14, boyut: 13, hiza: 'middle', renk: var_ ? 'mavi' : 'kursun', tohum: ['rozet-ad', kod, k], anlik: true }));
      }
      const baslik = svgEl('title', null, g);
      baslik.textContent = `${adlar[kod]}${var_ ? ' (kazanıldı)' : ''}`;
    });
  }


  /* ---------- Okul modu: iki oyuncunun çetelesi (marjda) ---------- */

  // puan: [mavi, kırmızı] kurtarılan kelime sayısı. sira: şu an tahmin eden (adı kurşun çemberle işaretlenir).
  function okulCeteleCiz(svg, puan, sira, adlar, id, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 150 140');
    const K = KL.kalemYap(svg);
    const merkez = [38, 112], ink = [mavi(), kirmizi()];
    adlar.forEach((ad, oy) => {
      metinSvg(svg, ad, { x: merkez[oy], y: 20, boyut: ad.length > 5 ? 15 : 18, hiza: 'middle', renk: oy ? 'kirmizi' : 'mavi', aci: oy ? 2 : -2, tohum: ['okul-ad', ad, oy], anlik: true });
      if (oy === sira) K.elips(svg, [merkez[oy], 14, Math.max(52, ad.length * 11 + 14), 28], { stroke: kursun(), strokeWidth: 1.4, roughness: 1.5 }, ['okul-cember', id, oy, puan[oy]], { anlik: o.anlik });
      const goster = Math.min(puan[oy], 20);
      for (let n = 0; n < goster; n++) {
        const grup = Math.floor(n / 5), j = n % 5, r = rastgele('okul-cetele', oy, n);
        const x0 = merkez[oy] - 22, y0 = 38 + grup * 26;
        const ek = { stroke: ink[oy], strokeWidth: 1.9, roughness: 1.1 };
        const yy = { anlik: !(o.yeni === oy && n === goster - 1), sureMs: [150, 190] };
        if (j < 4) { const x = x0 + j * 11 + aralik(r, -.7, .7); K.cizgi(svg, [x, y0 + aralik(r, -1, 1), x + aralik(r, -.8, .8), y0 + 20 + aralik(r, -1, 1)], ek, ['okul-c', id, oy, n], yy); }
        else K.cizgi(svg, [x0 - 4, y0 + 17 + aralik(r, -1, 1), x0 + 40, y0 + 3 + aralik(r, -1, 1)], ek, ['okul-c', id, oy, n], yy);
      }
    });
  }

  AA.draw = {
    kelimeKur, cizgileriCiz, harfYaz,
    daragaciKur, parcaCiz, yuzCiz, yuzSeviyesi,
    alfabeKur, tusIsaretle,
    etiketCiz, ceteleCiz, CETELE_MAX,
    okCiz, cemberCiz, ustBantCiz, durumYaz, kahramanCiz, simgeCiz, yildizlarCiz, dugmeIsaretle,
    kurtulus, kayip, rozetCiz, ROZET_SIRA, okulCeteleCiz,
  };
})();
