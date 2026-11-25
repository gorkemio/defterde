// kaptan.js — sayfanın sağ altındaki rakip: kırmızı formalı, 10 numaralı kaptan. Kırmızı tükenmezle tam boy çizilir.
// Arayüz kit/karakter.js ile aynıdır, ui.js ikisini de aynı şekilde kullanır:
//   const k = KF.kaptan.kur(svg, { renk: '#c62828', kursun: '#7a7a7a', tohum: 'kaptan', gecikme: 1100 });
//   k.ruh('sirit', 1200)   // 1,2 sn sevinir, sonra normale döner
//   k.dusun(true) / k.dusun(false)   // düşünme: topu ayağında sektirir, başının yanında "..." balonu
//   k.konus('rövanş?', 2600)          // kısa yazılı balon
//   k.gizle() / k.goster()
// Ruhlar: normal (eller belde) · dusunuyor (eli çenede, top sekiyor) · sirit (kollar havada, zıplıyor) · somurt (elleri başında).
// assets/kaptan-<ruh>.png varsa (en az kaptan-normal.png) çizim yerine onlar kullanılır.   viewBox 0 0 120 140.
(function () {
  'use strict';

  const KF = (window.KF = window.KF || {});
  const RUHLAR = ['normal', 'dusunuyor', 'sirit', 'somurt'];

  function damlaYolu(x, y) {
    const f = (v) => v.toFixed(1);
    return `M ${f(x)} ${f(y - 4)} C ${f(x + 2.8)} ${f(y - .5)}, ${f(x + 3.2)} ${f(y + 1.8)}, ${f(x)} ${f(y + 3)} ` +
           `C ${f(x - 3.2)} ${f(y + 1.8)}, ${f(x - 2.8)} ${f(y - .5)}, ${f(x)} ${f(y - 4)} Z`;
  }

  // Duruşlar: kollar ve bacaklar omuz/kalçadan iki eklemli eğri, ayak (krampon) yeri, top yeri.
  const POZ = {
    normal: {
      kol: [[[45, 55], [34, 70], [46, 82]], [[79, 55], [90, 70], [78, 82]]],
      bacak: [[[55, 100], [54, 114], [53, 127]], [[69, 100], [70, 114], [71, 127]]],
      ayak: [[50, 129], [74, 129]], top: [98, 128],
    },
    dusunuyor: {
      kol: [[[45, 55], [34, 70], [46, 82]], [[79, 55], [89, 63], [67, 42]]],
      bacak: [[[55, 100], [54, 114], [53, 127]], [[69, 100], [80, 108], [85, 114]]],
      ayak: [[50, 129], [88, 115]], top: [91, 103], sektir: true,
    },
    sirit: {
      kol: [[[45, 54], [35, 38], [29, 20]], [[79, 54], [89, 38], [95, 20]]],
      bacak: [[[55, 100], [47, 111], [51, 121]], [[69, 100], [77, 111], [73, 121]]],
      ayak: [[49, 123], [75, 123]], top: [100, 129], zipla: true,
    },
    somurt: {
      kol: [[[45, 54], [32, 42], [51, 22]], [[79, 54], [92, 42], [73, 22]]],
      bacak: [[[55, 100], [58, 114], [55, 127]], [[69, 100], [66, 114], [69, 127]]],
      ayak: [[52, 129], [72, 129]], top: [100, 129],
    },
  };

  // Yüzler: kafa merkezi (62, 30)
  const YUZLER = {
    normal(K, g, ink, an, ok, dolu) {
      K.daire(g, [57, 29, 3.4], dolu, [...an, 'g1'], ok); K.daire(g, [67, 29, 3.4], dolu, [...an, 'g2'], ok);
      K.egri(g, [[56, 35], [62, 38.5], [68, 35]], { stroke: ink, strokeWidth: 1.6, roughness: .6 }, [...an, 'agiz'], ok);
    },
    dusunuyor(K, g, ink, an, ok, dolu) {
      const o = { stroke: ink, strokeWidth: 1.5, roughness: .6 };
      K.daire(g, [58, 27, 3.2], dolu, [...an, 'g1'], ok); K.daire(g, [68, 27, 3.2], dolu, [...an, 'g2'], ok);
      K.cizgi(g, [53, 22, 60, 20], o, [...an, 'kas1'], ok);              // tek kaş yukarıda
      K.cizgi(g, [64, 23, 71, 23], o, [...an, 'kas2'], ok);
      K.daire(g, [62, 35.5, 4], o, [...an, 'agiz'], ok);
    },
    sirit(K, g, ink, an, ok) {
      const o = { stroke: ink, strokeWidth: 1.7, roughness: .6 };
      K.egri(g, [[54, 30], [57, 26.5], [60, 30]], o, [...an, 'g1'], ok);
      K.egri(g, [[64, 30], [67, 26.5], [70, 30]], o, [...an, 'g2'], ok);
      K.yol(g, 'M 55 33.5 Q 62 45 69 33.5 Z', o, [...an, 'agiz'], ok);
    },
    somurt(K, g, ink, an, ok, dolu) {
      const o = { stroke: ink, strokeWidth: 1.6, roughness: .6 };
      K.daire(g, [57, 30, 3.2], dolu, [...an, 'g1'], ok); K.daire(g, [67, 30, 3.2], dolu, [...an, 'g2'], ok);
      K.cizgi(g, [52, 24, 59, 27], o, [...an, 'kas1'], ok);              // içe çatık kaşlar
      K.cizgi(g, [72, 24, 65, 27], o, [...an, 'kas2'], ok);
      K.egri(g, [[56, 38.5], [62, 35], [68, 38.5]], o, [...an, 'agiz'], ok);
      K.yol(g, damlaYolu(78, 22), { ...o, strokeWidth: 1.1 }, [...an, 'ter'], ok);
    },
  };

  // Karalama top (kurşun kalem): (0,0) merkezli, çap 13
  function topCiz(K, g, kursun, an, ok) {
    K.daire(g, [0, 0, 13], { stroke: kursun, strokeWidth: 1.4, roughness: .7, fill: '#fbf9f2', fillStyle: 'solid' }, [...an, 'dis'], ok);
    const pts = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; pts.push([2.6 * Math.cos(a), 2.6 * Math.sin(a)]); }
    K.cokgen(g, pts, { stroke: kursun, fill: kursun, fillStyle: 'solid', strokeWidth: .8, roughness: .4 }, [...an, 'yama'], ok);
  }

  function kur(svg, o = {}) {
    const KL = window.Kit.kalem;
    const ink = KL.renkDeger(o.renk || 'kirmizi'), kursun = KL.renkDeger(o.kursun || 'kursun');
    const oz = o.tohum || 'kaptan';
    svg.textContent = '';
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 120 140');
    const K = KL.kalemYap(svg);
    const govde = KL.svgEl('g', { class: 'k-govde' }, svg);
    const pozG = KL.svgEl('g', { class: 'k-poz' }, svg);
    const balonG = KL.svgEl('g', { class: 'k-balon' }, svg);
    const resimli = !!KL.varlik('kaptan-normal');
    let ruhAdi = null, ruhJeton = 0, balonJeton = 0, nokta = 0, resimEl = null, sekme = null;
    let ilkGecikme = (o.gecikme || 0) + 700;                          // ilk duruş gövdeden sonra çizilsin

    /* ---- sabit parçalar: kafa, saç, forma (numara, kaptan bandı), şort ---- */
    if (resimli) {
      resimEl = KL.svgEl('image', { x: 4, y: 4, width: 112, height: 132, preserveAspectRatio: 'xMidYMax meet' }, govde);
      resimEl.setAttribute('href', KL.varlik('kaptan-normal').src);
    } else {
      const s = { stroke: ink, strokeWidth: 1.9, roughness: .8 };
      const a = (ad) => [oz, ad];
      const g0 = o.gecikme || 0, anlik = o.anlik;
      const ok = (ek = 0) => ({ gecikme: g0 + ek, anlik });
      K.daire(govde, [62, 30, 24], s, a('bas'), ok());
      [[52, 21, 49, 13], [57, 19, 56, 10], [63, 18, 65, 9], [69, 20, 74, 12], [73, 24, 79, 19]].forEach((c, i) =>
        K.cizgi(govde, c, { ...s, strokeWidth: 1.6, roughness: 1.1 }, a('sac' + i), ok(120 + i * 40)));
      K.cizgi(govde, [62, 42, 62, 47], s, a('boyun'), ok(260));
      // forma: kısa kollu, seyrek kırmızı tarama; yaka V
      const forma = [[48, 47], [76, 47], [87, 58], [80, 64], [78, 85], [46, 85], [44, 64], [37, 58]];
      K.cokgen(govde, forma, { ...s, fill: ink, fillStyle: 'hachure', hachureGap: 6, fillWeight: .8, hachureAngle: -55 }, a('forma'), ok(300));
      K.egri(govde, [[55, 47], [62, 55], [69, 47]], { ...s, strokeWidth: 1.5 }, a('yaka'), ok(420));
      // göğüste 10: kağıt rengi yama üstünde
      K.elips(govde, [62, 69, 21, 15], { stroke: 'none', fill: '#fbf9f2', fillStyle: 'solid' }, a('yama'), { anlik: true });
      KL.metinSvg(govde, '10', { x: 62, y: 74.5, boyut: 15, renk: ink, hiza: 'middle', aci: -3, tohum: [oz, 'no'], gecikme: g0 + 520, anlik });
      // kaptan bandı: sol kolda kalın şerit ve küçük C
      K.cizgi(govde, [38.5, 56, 44, 62], { ...s, strokeWidth: 3.6, roughness: .5 }, a('bant'), ok(580));
      KL.metinSvg(govde, 'C', { x: 33, y: 55, boyut: 8, renk: ink, hiza: 'middle', tohum: [oz, 'c'], gecikme: g0 + 620, anlik });
      // şort
      K.cokgen(govde, [[47, 85], [77, 85], [79, 100], [66, 100], [62, 93], [58, 100], [45, 100]], { ...s, strokeWidth: 1.7 }, a('sort'), ok(660));
    }

    /* ---- duruş ve yüz: ruh haline göre yeniden çizilir ---- */
    function pozCiz(ad, anlik) {
      if (sekme) { sekme.cancel(); sekme = null; }
      pozG.textContent = '';
      const p = POZ[ad], an = [oz, 'poz', ad];
      const s = { stroke: ink, strokeWidth: 1.9, roughness: .8 };
      const ok = { anlik, gecikme: ilkGecikme, sureMs: [90, 140] };
      ilkGecikme = 0;
      const dolu = { stroke: ink, fill: ink, fillStyle: 'solid', strokeWidth: .8, roughness: .5 };
      p.kol.forEach((k, i) => {
        K.egri(pozG, k, s, [...an, 'kol', i], ok);
        K.daire(pozG, [k[2][0], k[2][1], 6.5], { ...s, strokeWidth: 1.5 }, [...an, 'el', i], ok);
      });
      p.bacak.forEach((b, i) => {
        K.egri(pozG, b, s, [...an, 'bacak', i], ok);
        const [x1, y1] = b[1], [x2, y2] = b[2], t = .55;                 // tozluk çizgisi
        const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
        K.cizgi(pozG, [cx - 4, cy, cx + 4, cy - .5], { ...s, strokeWidth: 1.4 }, [...an, 'tozluk', i], ok);
      });
      p.ayak.forEach(([x, y], i) => K.elips(pozG, [x, y, 12, 5.5], { stroke: kursun, fill: kursun, fillStyle: 'solid', strokeWidth: .8, roughness: .6 }, [...an, 'ayak', i], ok));
      if (p.zipla) {                                                     // sevinç: ayak altında zıplama çizgileri
        [[44, 132, 54, 132], [47, 136, 52, 136], [70, 132, 80, 132], [72, 136, 78, 136]].forEach((c, i) =>
          K.cizgi(pozG, c, { stroke: kursun, strokeWidth: 1.2, roughness: 1 }, [...an, 'zipla', i], ok));
      }
      const topG = KL.svgEl('g', { class: 'k-top', transform: `translate(${p.top[0]} ${p.top[1]})` }, pozG);
      const topIc = KL.svgEl('g', null, topG);
      topCiz(K, topIc, kursun, [...an, 'top'], ok);
      if (p.sektir && KL.animasyonVar() && !anlik) {                      // düşünürken topu ayağında sektirir
        sekme = topIc.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-13px)' }],
          { duration: 380, iterations: Infinity, direction: 'alternate', easing: 'ease-out' });
      }
      YUZLER[ad](K, pozG, ink, [...an, 'yuz'], ok, dolu);
    }

    function cizRuh(ad, anlik) {
      if (!RUHLAR.includes(ad)) ad = 'normal';
      ruhAdi = ad;
      if (resimli) {
        const img = KL.varlik('kaptan-' + ad) || KL.varlik('kaptan-normal');
        resimEl.setAttribute('href', img.src);
        return;
      }
      pozCiz(ad, anlik);
    }

    // ad: ruh; geriMs verilirse o kadar sonra normale döner
    function ruh(ad, geriMs, anlik) {
      const j = ++ruhJeton;
      cizRuh(ad, anlik);
      if (geriMs) setTimeout(() => { if (j === ruhJeton) cizRuh('normal'); }, geriMs);
    }

    /* ---- balon: başın sağında; biletin boşluğunu ve havaya kalkan elleri kapatmaz ---- */
    function balonuKaldir() {
      balonJeton++;
      clearInterval(nokta);
      nokta = 0;
      Array.from(balonG.children).forEach(e => KL.soldur(e, 180));
    }

    function balonCiz(genislik, anlik) {
      const w = Math.max(48, genislik), cx = 100 + w / 2, cy = 24;
      const s = { stroke: kursun, strokeWidth: 1.5, roughness: 1.2 };
      const g = KL.svgEl('g', { class: 'k-balon-sekil' }, balonG);
      K.elips(g, [cx, cy, w, 26], s, [oz, 'balon', Math.round(w)], { anlik });
      K.daire(g, [98, 10, 6], s, [oz, 'kabarcik1'], { anlik, gecikme: 140 });
      K.daire(g, [85, 15, 3.6], s, [oz, 'kabarcik2'], { anlik, gecikme: 200 });
      return { cx, cy };
    }

    function dusun(acik, anlik) {
      balonuKaldir();
      if (!acik) { if (ruhAdi === 'dusunuyor') ruh('normal', 0, anlik); return; }
      const j = ++balonJeton;
      ruh('dusunuyor', 0, anlik);
      const { cx, cy } = balonCiz(48, anlik);
      const noktalar = KL.svgEl('g', { class: 'k-noktalar' }, balonG);
      let n = 0;
      const tik = () => {
        if (j !== balonJeton) return;
        n = n % 3 + 1;
        noktalar.textContent = '';
        for (let i = 0; i < n; i++) {
          K.daire(noktalar, [cx - 10 + i * 10, cy + 2, 4],
            { stroke: kursun, fill: kursun, fillStyle: 'solid', strokeWidth: 1, roughness: .8 }, [oz, 'nokta', i, n], { gecikme: i * 40 });
        }
      };
      setTimeout(tik, anlik ? 0 : 240);
      nokta = setInterval(tik, 420);
    }

    function konus(metin, sureMs = 1500, anlik) {
      balonuKaldir();
      const j = ++balonJeton;
      const { cx, cy } = balonCiz(metin.length * 6.5 + 18, anlik);
      KL.metinSvg(balonG, metin, {
        x: cx, y: cy + 5, boyut: 14, renk: kursun, hiza: 'middle', aci: -2,
        tohum: [oz, 'konus', metin], gecikme: anlik ? 0 : 180, anlik,
      });
      setTimeout(() => { if (j === balonJeton) balonuKaldir(); }, sureMs);
    }

    function gizle() { svg.setAttribute('hidden', ''); if (sekme) sekme.pause(); }
    function goster() { svg.removeAttribute('hidden'); if (sekme) sekme.play(); }

    ruh('normal', 0, o.anlik);
    return { ruh, dusun, konus, gizle, goster, get ruhAdi() { return ruhAdi; } };
  }

  KF.kaptan = { kur, RUHLAR };
})();
