// kit/karakter.js — sayfanın köşesindeki rakip karakter. Hangi oyun olduğunu bilmez.
// Kendi renginde bir tükenmez kalemle çizilmiş yüz; ruh haline göre yüzü yeniden çizilir.
// Düşünürken baloncukta kurşun kalemle "..." belirir. assets/karakter-<ruh>.png varsa onlar kullanılır.
//
//   const k = Kit.karakter.kur(svg, { renk: '#c62828', kursun: '#7a7a7a', tohum: 'rakip' });
//   k.ruh('sirit', 1200)   // 1,2 sn sırıtır, sonra normale döner
//   k.dusun(true) / k.dusun(false)   // düşünme baloncuğu
//   k.konus('hehe', 1500)  // kısa yazılı baloncuk
//   k.gizle() / k.goster()
// Ruhlar: normal · dusunuyor · sirit · somurt.   viewBox 0 0 120 140; baloncuk sol üstte.
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const RUHLAR = ['normal', 'dusunuyor', 'sirit', 'somurt'];

  function damlaYolu(x, y) {
    const f = (v) => v.toFixed(1);
    return `M ${f(x)} ${f(y - 4)} C ${f(x + 2.8)} ${f(y - .5)}, ${f(x + 3.2)} ${f(y + 1.8)}, ${f(x)} ${f(y + 3)} ` +
           `C ${f(x - 3.2)} ${f(y + 1.8)}, ${f(x - 2.8)} ${f(y - .5)}, ${f(x)} ${f(y - 4)} Z`;
  }

  // Yüz merkezi (66, 82). Her ruh, yüz grubuna çizen bir fonksiyondur.
  const YUZLER = {
    normal(K, g, ink, an, ok) {
      const o = { stroke: ink, strokeWidth: 1.8, roughness: .7 };
      const nokta = (x, y, ad) => K.daire(g, [x, y, 4.2], { ...o, fill: ink, fillStyle: 'solid', strokeWidth: 1 }, [...an, ad], ok);
      return [
        nokta(56, 78, 'g1'), nokta(76, 78, 'g2'),
        K.egri(g, [[55, 91], [66, 97], [77, 91]], o, [...an, 'agiz'], ok),
      ];
    },
    dusunuyor(K, g, ink, an, ok) {
      const o = { stroke: ink, strokeWidth: 1.8, roughness: .7 };
      const goz = (x, ad) => [
        K.daire(g, [x, 77, 9], o, [...an, ad], ok),
        K.daire(g, [x + 1, 74.5, 3.4], { ...o, fill: ink, fillStyle: 'solid', strokeWidth: 1 }, [...an, ad + 'p'], ok),
      ];
      return [
        ...goz(56, 'g1'), ...goz(77, 'g2'),
        K.cizgi(g, [49, 64, 63, 60], o, [...an, 'kas1'], ok),            // tek kaş yukarıda
        K.cizgi(g, [71, 66, 85, 66], o, [...an, 'kas2'], ok),
        K.daire(g, [68, 95, 6], o, [...an, 'agiz'], ok),
      ];
    },
    sirit(K, g, ink, an, ok) {
      const o = { stroke: ink, strokeWidth: 1.9, roughness: .7 };
      return [
        K.egri(g, [[50, 81], [56, 73], [62, 81]], o, [...an, 'g1'], ok),
        K.egri(g, [[71, 81], [77, 73], [83, 81]], o, [...an, 'g2'], ok),
        K.yol(g, 'M 50 89 Q 66 108 82 89 Z', o, [...an, 'agiz'], ok),
        K.cizgi(g, [52, 91.5, 80, 91.5], { ...o, strokeWidth: 1.1 }, [...an, 'dis'], ok),
        K.cizgi(g, [66, 91.5, 66, 99], { ...o, strokeWidth: 1.1 }, [...an, 'dis2'], ok),
      ];
    },
    somurt(K, g, ink, an, ok) {
      const o = { stroke: ink, strokeWidth: 1.8, roughness: .7 };
      const nokta = (x, y, ad) => K.daire(g, [x, y, 4.2], { ...o, fill: ink, fillStyle: 'solid', strokeWidth: 1 }, [...an, ad], ok);
      return [
        nokta(56, 80, 'g1'), nokta(76, 80, 'g2'),
        K.cizgi(g, [47, 66, 62, 73], o, [...an, 'kas1'], ok),            // içe eğik kaşlar
        K.cizgi(g, [85, 66, 70, 73], o, [...an, 'kas2'], ok),
        K.egri(g, [[56, 99], [66, 92], [76, 99]], o, [...an, 'agiz'], ok),
        K.yol(g, damlaYolu(95, 62), { ...o, strokeWidth: 1.2 }, [...an, 'ter'], ok),
      ];
    },
  };

  function kur(svg, o = {}) {
    const KL = Kit.kalem;
    const ink = KL.renkDeger(o.renk || 'kirmizi'), kursun = KL.renkDeger(o.kursun || 'kursun');
    const oz = o.tohum || 'karakter';
    svg.textContent = '';
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 120 140');
    const K = KL.kalemYap(svg);
    const govde = KL.svgEl('g', { class: 'k-govde' }, svg);
    const yuzG = KL.svgEl('g', { class: 'k-yuz' }, svg);
    const balonG = KL.svgEl('g', { class: 'k-balon' }, svg);
    const resimli = !!KL.varlik('karakter-normal');
    let ruhAdi = null, ruhJeton = 0, balonJeton = 0, nokta = 0, resimEl = null;

    /* ---- gövde: bir kez çizilir ---- */
    if (resimli) {
      resimEl = KL.svgEl('image', { x: 10, y: 38, width: 100, height: 100, preserveAspectRatio: 'xMidYMid meet' }, govde);
      resimEl.setAttribute('href', KL.varlik('karakter-normal').src);
    } else {
      const s = { stroke: ink, strokeWidth: 2 };
      const a = (ad) => [oz, ad];
      const g0 = o.gecikme || 0, anlik = o.anlik;
      K.elips(govde, [66, 82, 56, 62], s, a('bas'), { gecikme: g0, anlik });
      K.egri(govde, [[41, 77], [34, 79], [33, 88], [41, 92]], { ...s, strokeWidth: 1.7 }, a('kulak1'), { gecikme: g0 + 120, anlik });
      K.egri(govde, [[91, 77], [98, 79], [99, 88], [91, 92]], { ...s, strokeWidth: 1.7 }, a('kulak2'), { gecikme: g0 + 140, anlik });
      // dağınık saç
      const sac = [[52, 56, 47, 45], [59, 53, 58, 41], [66, 52, 69, 40], [74, 53, 81, 43], [82, 58, 91, 52]];
      sac.forEach((c, i) => K.cizgi(govde, c, { ...s, strokeWidth: 1.7, roughness: 1.1 }, a('sac' + i), { gecikme: g0 + 200 + i * 60, anlik }));
      // boyun ve omuzlar (sayfanın altına doğru açık kalır)
      K.cizgi(govde, [58, 110, 57, 120], { ...s, strokeWidth: 1.7 }, a('boyun1'), { gecikme: g0 + 480, anlik });
      K.cizgi(govde, [75, 110, 76, 120], { ...s, strokeWidth: 1.7 }, a('boyun2'), { gecikme: g0 + 520, anlik });
      K.egri(govde, [[14, 140], [24, 126], [46, 119], [66, 118], [86, 119], [108, 126], [118, 140]], s, a('omuz'), { gecikme: g0 + 560, anlik });
    }

    /* ---- yüz: ruh haline göre yeniden çizilir ---- */
    function yuzCiz(ad, anlik) {
      if (!RUHLAR.includes(ad)) ad = 'normal';
      ruhAdi = ad;
      if (resimli) {
        const img = KL.varlik('karakter-' + ad) || KL.varlik('karakter-normal');
        resimEl.setAttribute('href', img.src);
        return;
      }
      yuzG.textContent = '';
      YUZLER[ad](K, yuzG, ink, [oz, 'yuz', ad], { anlik });
    }

    // ad: ruh; geriMs verilirse o kadar sonra normale döner
    function ruh(ad, geriMs, anlik) {
      const j = ++ruhJeton;
      yuzCiz(ad, anlik);
      if (geriMs) setTimeout(() => { if (j === ruhJeton) yuzCiz('normal'); }, geriMs);
    }

    /* ---- baloncuk ---- */
    function balonuKaldir() {
      balonJeton++;
      clearInterval(nokta);
      nokta = 0;
      const eski = Array.from(balonG.children);
      eski.forEach(e => KL.soldur(e, 180));
    }

    // Baloncuk gövdesi: elips + iki küçük düşünce kabarcığı. genislik metne göre büyür.
    function balonCiz(genislik, anlik) {
      const w = Math.max(62, genislik), cx = w / 2 + 3, cy = 24;
      const s = { stroke: kursun, strokeWidth: 1.6, roughness: 1.2 };
      const ok = { anlik };
      const g = KL.svgEl('g', { class: 'k-balon-sekil' }, balonG);
      K.elips(g, [cx, cy, w, 38], s, [oz, 'balon', Math.round(w)], ok);
      K.daire(g, [Math.min(cx + w / 2 - 8, 52), 50, 6], s, [oz, 'kabarcik1'], { ...ok, gecikme: 160 });
      K.daire(g, [Math.min(cx + w / 2 - 2, 58), 58, 4], s, [oz, 'kabarcik2'], { ...ok, gecikme: 220 });
      return { cx, cy };
    }

    // Düşünürken baloncukta kurşun kalemle "." ".." "..." döner.
    function dusun(acik, anlik) {
      balonuKaldir();
      if (!acik) { if (ruhAdi === 'dusunuyor') ruh('normal', 0, anlik); return; }
      const j = ++balonJeton;
      ruh('dusunuyor', 0, anlik);
      const { cx, cy } = balonCiz(62, anlik);
      const noktalar = KL.svgEl('g', { class: 'k-noktalar' }, balonG);
      let n = 0;
      const tik = () => {
        if (j !== balonJeton) return;
        n = n % 3 + 1;
        noktalar.textContent = '';
        for (let i = 0; i < n; i++) {
          K.daire(noktalar, [cx - 14 + i * 14, cy + 4, 4.6],
            { stroke: kursun, fill: kursun, fillStyle: 'solid', strokeWidth: 1, roughness: .8 },
            [oz, 'nokta', i, n], { gecikme: i * 40 });
        }
      };
      setTimeout(tik, anlik ? 0 : 260);
      nokta = setInterval(tik, 420);
    }

    // Kısa yazılı baloncuk; sureMs sonra solar.
    function konus(metin, sureMs = 1500, anlik) {
      balonuKaldir();
      const j = ++balonJeton;
      const gen = metin.length * 7.6 + 24;
      const { cx, cy } = balonCiz(gen, anlik);
      KL.metinSvg(balonG, metin, {
        x: cx, y: cy + 6, boyut: 16, renk: kursun, hiza: 'middle', aci: -2,
        tohum: [oz, 'konus', metin], gecikme: anlik ? 0 : 200, anlik,
      });
      setTimeout(() => { if (j === balonJeton) balonuKaldir(); }, sureMs);
    }

    function gizle() { svg.setAttribute('hidden', ''); }
    function goster() { svg.removeAttribute('hidden'); }

    ruh('normal', 0, o.anlik);
    return { ruh, dusun, konus, gizle, goster, get ruhAdi() { return ruhAdi; } };
  }

  Kit.karakter = { kur, RUHLAR };
})();
