// draw.js — SOS'a özgü çizim: ızgara, S/O harfleri, SOS çizgisi, çetele, harf seçici, başlık, ayar işaretleri, sonuç.
// Kalem altyapısı kit/kalem.js'te. Oyun kurallarını bilmez: hücre indeksi (i = satır*n + sütun), harf ('S'|'O') ve
// sahip (0 mavi · 1 kırmızı) alır. Her çizim ilkeli { node, bitti, sure } döndürür (bkz. kit/kalem.js).
(function () {
  'use strict';

  const SOS = (window.SOS = window.SOS || {});
  const KL = window.Kit.kalem;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger } = KL;
  const HUCRE = 40;                                  // tahta SVG'sinde bir hücre (= 2 defter karesi), birim
  const mürekkep = (sahip) => renkDeger(sahip === 1 ? 'kirmizi' : 'mavi');

  /* ---------- tahta ---------- */

  // Boş çizim katmanları. Etkileşim hedefleri board.js içindeki semantik düğmelerdir.
  function tahtaKur(svg, id, n) {
    const boy = HUCRE * n;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${boy} ${boy}`);
    const katman = {};
    for (const ad of ['izgara', 'ipucu', 'son', 'onizleme', 'harfler', 'cizgiler', 'efekt', 'imlec']) {
      katman[ad] = svgEl('g', { class: ad }, svg);
    }
    return { svg, id, n, boy, K: KL.kalemYap(svg), katman, harfG: {} };
  }

  // Izgara: n+1 dikey + n+1 yatay çizgi, uçlar biraz taşar, dış çerçeve daha kalın. Önce dikey, sonra yatay.
  // Kurşun kalemle: defterde tablo önce kurşunla çizilir; böylece mavi ve kırmızı harfler (kim yazdı) öne çıkar.
  function izgaraCiz(T, gecikme = 0, anlik = false) {
    const n = T.n, boy = T.boy;
    const bit = [];
    let gec = gecikme;
    for (const yon of ['d', 'y']) {
      for (let i = 0; i <= n; i++) {
        const p = HUCRE * i;
        const r = rastgele('izgara', T.id, yon, i);
        const a = -aralik(r, 0, 6), b = boy + aralik(r, 0, 6);
        const k1 = aralik(r, -1.2, 1.2), k2 = aralik(r, -1.2, 1.2);
        const cizgi = yon === 'd' ? [p + k1, a, p + k2, b] : [a, p + k1, b, p + k2];
        const kalin = i === 0 || i === n;
        const s = T.K.cizgi(T.katman.izgara, cizgi,
          { stroke: renkDeger('kursun'), strokeWidth: kalin ? 2.0 : 1.4 }, ['izgara', T.id, yon, i], { gecikme: gec, anlik });
        bit.push(s.bitti);
        gec += 28;
      }
    }
    return { bitti: Promise.all(bit), sure: gec - gecikme + KL.ayar.cizim.sureMs[1] };
  }

  /* ---------- harfler: font değil, çizim ---------- */

  // S: tek yol, iki kavis (40 birimlik hücrenin içinde). Her harfte uç noktalar biraz oynar.
  const S_NOKTALAR = [28, 10, 24, 5, 12, 6, 13, 13, 14, 19, 27, 19, 27, 27, 27, 34, 14, 36, 11, 30];
  function sYolu(r) {
    const p = S_NOKTALAR.map(v => (v + aralik(r, -1.3, 1.3)).toFixed(1));
    return `M ${p[0]} ${p[1]} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]} ` +
           `C ${p[8]} ${p[9]}, ${p[10]} ${p[11]}, ${p[12]} ${p[13]} C ${p[14]} ${p[15]}, ${p[16]} ${p[17]}, ${p[18]} ${p[19]}`;
  }

  // Harfi 40×40'lık yerel kutuya çizer (hücrede de seçicide de aynı şekil). r: o harfin rastgele üreteci.
  function harfGrubu(K, g, harf, ink, an, r, o = {}) {
    const cizOz = { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs };
    if (harf === 'S') {
      return K.yol(g, sYolu(r), { stroke: ink, strokeWidth: 2.2, roughness: .9, bowing: 1.4 }, an, cizOz);
    }
    // O: düz duran bir elips; rough'un iki geçişi kapanmayan, el yazısı bir O verir
    return K.elips(g, [20, 20, 21 + aralik(r, -2, 2), 26 + aralik(r, -2, 2)],
      { stroke: ink, strokeWidth: 2.2, roughness: 1 }, an, cizOz);
  }

  // Hücreye harf yazar. Aynı hücre aynı harf aynı çizgiyi üretir (tohum: oyun, hücre, harf).
  // Dış <g> konumsuzdur (titreme animasyonu onu oynatır); yerleşim iç <g>'nin transform'unda.
  function harfCiz(T, i, harf, sahip, o = {}) {
    const n = T.n, satir = Math.floor(i / n), sutun = i % n;
    const r = rastgele('harf', T.id, i, harf);
    const dx = aralik(r, -1.5, 1.5), dy = aralik(r, -1.5, 1.5), olcek = aralik(r, .94, 1.06);
    const dis = svgEl('g', { class: 'harf', 'data-i': i }, T.katman.harfler);
    const g = svgEl('g', {
      transform: `translate(${(HUCRE * sutun + dx).toFixed(1)} ${(HUCRE * satir + dy).toFixed(1)}) ` +
                 `translate(20 20) scale(${olcek.toFixed(3)}) translate(-20 -20)`,
    }, dis);
    const s = harfGrubu(T.K, g, harf, mürekkep(sahip), ['harf', T.id, i, harf], r, o);
    T.harfG[i] = dis;
    return { node: dis, bitti: s.bitti, sure: s.sure };
  }

  function harfSil(T, i, anlik) {
    const g = T.harfG[i];
    delete T.harfG[i];
    return anlik ? (g && g.remove(), Promise.resolve()) : KL.soldur(g, 220);
  }

  // Dolu hücreye dokunulunca harf "hayır" der gibi kısa titrer.
  function harfTitret(T, i) {
    const g = T.harfG[i];
    if (!g || !KL.animasyonVar()) return;
    const a = g.animate([
      { transform: 'translate(0px, 0px)' }, { transform: 'translate(-3px, 0px)' }, { transform: 'translate(3px, -1px)' },
      { transform: 'translate(-2px, 1px)' }, { transform: 'translate(0px, 0px)' },
    ], { duration: 260 });
    a.finished.catch(() => {});
  }

  /* ---------- son hamle işareti ---------- */

  // Karşı tarafın son turda yazdığı harflerin altına kısa, dalgalı kurşun kalem çizgisi. liste: hücre indeksleri.
  function sonHamleIsaretle(T, liste, anlik = false) {
    sonHamleSil(T);
    const n = T.n;
    liste.forEach((i, k) => {
      const x = HUCRE * (i % n), y = HUCRE * Math.floor(i / n);
      const r = rastgele('son', T.id, i);
      const pts = [11, 15.5, 20, 24.5, 29].map((dx, j) => [x + dx + aralik(r, -.6, .6), y + 36 + (j % 2 ? -1.3 : .6) + aralik(r, -.4, .4)]);
      T.K.egri(T.katman.son, pts, { stroke: renkDeger('kursun'), strokeWidth: 1.6, roughness: .8 },
        ['son', T.id, i], { anlik, gecikme: anlik ? 0 : k * 80, sureMs: [140, 180] });
    });
  }
  function sonHamleSil(T) { T.katman.son.textContent = ''; }

  /* ---------- klavye imleci ---------- */

  // Klavyeyle oynarken seçili hücrenin çevresinde kurşun kalem kare (anında çizilir).
  function imlecCiz(T, i) {
    imlecSil(T);
    const n = T.n, x = HUCRE * (i % n), y = HUCRE * Math.floor(i / n);
    T.K.dikdortgen(T.katman.imlec, [x + 3, y + 3, HUCRE - 6, HUCRE - 6],
      { stroke: renkDeger('kursun'), strokeWidth: 1.6, roughness: 1.2 }, ['imlec', T.id, i], { anlik: true });
  }
  function imlecSil(T) { T.katman.imlec.textContent = ''; }

  /* ---------- önizleme ve ipucu ---------- */

  // Fareyle boş hücrenin üstüne gelince seçili harf kurşun kalemle silik görünür (dokunmada hover yoktur).
  function onizlemeGoster(T, i, harf) {
    onizlemeSil(T);
    const n = T.n, satir = Math.floor(i / n), sutun = i % n;
    const r = rastgele('onizleme', T.id, i, harf);
    const g = svgEl('g', {
      class: 'onizleme-harf', opacity: .36, 'pointer-events': 'none',
      transform: `translate(${HUCRE * sutun} ${HUCRE * satir})`,
    }, T.katman.onizleme);
    harfGrubu(T.K, g, harf, renkDeger('kursun'), ['onizleme', harf], r, { anlik: true });
  }
  function onizlemeSil(T) { T.katman.onizleme.textContent = ''; }

  // İpucu modu: tehlikeli hücrelerin sağ üst köşesine minik kurşun kalem noktası. liste: hücre indeksleri.
  // Yalnız değişenler çizilir/silinir, böylece harf değişince tüm noktalar baştan yazılmaz.
  function ipucuCiz(T, liste) {
    const n = T.n, istenen = new Set(liste);
    T.ipucuG = T.ipucuG || new Map();
    for (const [i, g] of T.ipucuG) if (!istenen.has(i)) { g.remove(); T.ipucuG.delete(i); }
    for (const i of liste) {
      if (T.ipucuG.has(i)) continue;
      const g = svgEl('g', { class: 'ipucu-nokta', 'pointer-events': 'none' }, T.katman.ipucu);
      const r = rastgele('ipucu', T.id, i);
      const x = HUCRE * (i % n) + 31 + aralik(r, -1, 1), y = HUCRE * Math.floor(i / n) + 9 + aralik(r, -1, 1);
      T.K.daire(g, [x, y, 5], { stroke: renkDeger('kursun'), fill: renkDeger('kursun'), fillStyle: 'solid', strokeWidth: 1, roughness: .8 },
        ['ipucu', T.id, i], {});
      T.ipucuG.set(i, g);
    }
  }

  /* ---------- SOS çizgisi ---------- */

  // cizgi: { hucreler: [i, j, k], sahip }. Üç hücrenin merkezinden geçer, iki ucu 12 birim taşar; puanı alanın mürekkebi.
  // Yanına küçük "SOS!" notu yazılır ve (o.kalici değilse) ~1,5 sn sonra solar.
  function sosCiz(T, cizgi, o = {}) {
    const n = T.n, boy = T.boy;
    const mer = (i) => [HUCRE * (i % n) + HUCRE / 2, HUCRE * Math.floor(i / n) + HUCRE / 2];
    const [x1, y1] = mer(cizgi.hucreler[0]), [x2, y2] = mer(cizgi.hucreler[2]);
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, tasma = 12;
    const ink = mürekkep(cizgi.sahip);
    const anahtar = cizgi.hucreler.join(',');
    const g = svgEl('g', { class: 'sos-cizgi', 'data-anahtar': anahtar }, T.katman.cizgiler);
    const gecikme = o.gecikme || 0;
    const c = T.K.cizgi(g, [x1 - ux * tasma, y1 - uy * tasma, x2 + ux * tasma, y2 + uy * tasma],
      { stroke: ink, strokeWidth: 2.8, roughness: 1.6, bowing: 1.5 },
      ['sos', T.id, anahtar], { gecikme, anlik: o.anlik, sureMs: [250, 250] });

    // Not, çizginin iki ucundan tahtanın dışına daha az taşan yanına yazılır.
    const aday = (ex, ey, yon) => {
      const x = ex + yon * ux * 30 - uy * 12 * yon, y = ey + yon * uy * 30 + ux * 12 * yon;
      const tas = Math.max(0, -x, x - boy, -y, y - boy);
      return { x, y, tas };
    };
    const a = aday(x2, y2, 1), b = aday(x1, y1, -1);
    const yer = b.tas < a.tas ? b : a;
    const not = svgEl('g', { class: 'sos-not', 'pointer-events': 'none' }, g);
    const yazi = metinSvg(not, 'SOS!', {
      x: yer.x, y: yer.y + 5, boyut: 17, renk: ink,
      tohum: ['sosnot', T.id, anahtar], gecikme: gecikme + c.sure * .85, adim: 55, anlik: o.anlik,
    });
    if (!o.kalici) {
      if (KL.animasyonVar() && !o.anlik) {
        const an = not.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: gecikme + c.sure + yazi.sure + 1300, fill: 'forwards' });
        an.finished.then(() => not.remove(), () => not.remove());
      } else {
        setTimeout(() => not.remove(), 1500);
      }
    }
    return { node: g, cizgiBitti: c.bitti, bitti: Promise.all([c.bitti, yazi.bitti]), sure: c.sure + yazi.sure };
  }

  function sosSil(T, anahtar, anlik) {
    const g = T.katman.cizgiler.querySelector(`[data-anahtar="${anahtar}"]`);
    return anlik ? (g && g.remove(), Promise.resolve()) : KL.soldur(g, 220);
  }

  /* ---------- marj: iki oyuncunun çeteleleri ---------- */

  const SUTUN_X = [19, 58];                          // iki sütunun ortası (marj SVG'sinde, birim; 80 birim = 4 kare)
  const CETELE = { ust: 50, adim: 28, yukseklik: 22, aralik: 7 };

  // o: { id, kh (sayfanın kare cinsinden boyu: marj SVG'sinin yüksekliği), n (tahta boyutu), etiketler: ['ben', 'rakip'],
  //      gecikme, anlik }
  function marjKur(svg, o) {
    svg.textContent = '';
    const yuk = (o.kh - 2) * 20;
    svg.setAttribute('viewBox', `0 0 80 ${yuk}`);
    const K = KL.kalemYap(svg);
    // Çetele aralığı bu üst sınıra göre hesaplanır; bir oyuncu gerçek oyunlarda nadiren n²/3 puanı geçer.
    const M = { svg, id: o.id, K, yuk, puanMax: Math.ceil(o.n * o.n / 3), adim: [28, 28], cizimler: [[], []], baslik: svgEl('g', { class: 'basliklar' }, svg) };
    etiketle(M, o.etiketler, o.gecikme || 0, o.anlik);
    return M;
  }

  // Sütun başlıkları. Yazı uzunsa küçülür ("kırmızı" 2,1 karelik sütuna sığmalı).
  function etiketle(M, etiketler, gecikme = 0, anlik = false) {
    M.baslik.textContent = '';
    etiketler.forEach((e, oy) => {
      metinSvg(M.baslik, e, {
        x: SUTUN_X[oy], y: 20, boyut: e.length > 5 ? 14 : 17, hiza: 'middle',
        renk: oy === 0 ? 'mavi' : 'kirmizi', tohum: ['marj-baslik', e, oy], gecikme: gecikme + oy * 120, anlik,
      });
    });
  }

  // Çok puan olursa gruplar aralarını daraltır, sayfanın altından taşmaz.
  function ceteleKonumu(M, oy, i) {
    const grup = Math.floor(i / 5), j = i % 5;
    const adim = M.adim[oy];
    const x0 = SUTUN_X[oy] - 11, y0 = CETELE.ust + grup * adim;
    return { x0, y0, j };
  }

  // i. puanın çizgisi: ilk dördü dikey, beşincisi hepsini çapraz keser.
  function ceteleCizgisi(M, oy, i, o = {}) {
    const { x0, y0, j } = ceteleKonumu(M, oy, i);
    const yukseklik = Math.min(CETELE.yukseklik, M.adim[oy] - 5);
    const r = rastgele('cetele', M.id, oy, i);
    const ink = oy === 0 ? renkDeger('mavi') : renkDeger('kirmizi');
    const ek = { stroke: ink, strokeWidth: 2, roughness: 1.2 };
    const g = svgEl('g', { class: 'cetele-cizgi' }, M.svg);
    const yon = { gecikme: o.gecikme, anlik: o.anlik, sureMs: [150, 150] };
    let c;
    if (j < 4) {
      const x = x0 + j * CETELE.aralik + aralik(r, -.8, .8);
      c = M.K.cizgi(g, [x + aralik(r, -.8, .8), y0 + aralik(r, -1, 1), x + aralik(r, -.8, .8), y0 + yukseklik + aralik(r, -1, 1)], ek, ['cetele', M.id, oy, i], yon);
    } else {
      c = M.K.cizgi(g, [x0 - 4 + aralik(r, -1, 1), y0 + yukseklik - 3, x0 + 3 * CETELE.aralik + 5 + aralik(r, -1, 1), y0 + 3 + aralik(r, -1, 1)], ek, ['cetele', M.id, oy, i], yon);
    }
    return { node: g, bitti: c.bitti, sure: c.sure };
  }

  // Çeteleyi puanlara eşitler: eksik çizgileri çizer, fazlalarını (geri alma) soldurup siler.
  function ceteleGuncelle(M, puan, o = {}) {
    const bit = [];
    let gec = o.gecikme || 0;
    for (let oy = 0; oy < 2; oy++) {
      const liste = M.cizimler[oy];
      const gruplar = Math.max(1, Math.ceil(Math.max(M.puanMax, puan[oy]) / 5));
      const adim = Math.min(CETELE.adim, (M.yuk - CETELE.ust - 30) / gruplar);
      if (adim !== M.adim[oy]) {
        const eski = Math.min(liste.length, puan[oy]);
        liste.forEach(c => c.node.remove());
        liste.length = 0;
        M.adim[oy] = adim;
        for (let i = 0; i < eski; i++) liste.push(ceteleCizgisi(M, oy, i, { anlik: true }));
      }
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

  // "bir daha!" notu: fazla tur kazanan oyuncunun mürekkebiyle marja yazılır. oy: null → siler.
  function birDahaYaz(M, oy, anlik) {
    for (const g of Array.from(M.svg.querySelectorAll(':scope > .bir-daha'))) KL.soldur(g, 200);
    if (oy === null || oy === undefined) return Promise.resolve();
    const g = svgEl('g', { class: 'bir-daha' }, M.svg);
    const t = metinSvg(g, 'bir daha!', {
      x: 40, y: 34, boyut: 15, hiza: 'middle', renk: oy === 0 ? 'mavi' : 'kirmizi',
      tohum: ['bir-daha', M.id, oy], anlik,
    });
    return t.bitti;
  }

  /* ---------- sayfa başlıkları ---------- */

  function altCizgi(K, katman, x1, x2, y, an, gecikme, anlik) {   // dalgalı altı çizili çizgi
    const genis = x2 - x1;
    const pts = [[x1, y + 1], [x1 + genis * .25, y - 2], [x1 + genis * .5, y + 2], [x1 + genis * .75, y - 1.5], [x2, y + 1]];
    return K.egri(katman, pts, { strokeWidth: 2 }, ['altcizgi', ...an], { gecikme, anlik });
  }

  // Sol üstte "SOS" başlığı (altı çizili), sağ üstte tarih. Durum satırı ayrı: durumYaz.
  // genis: başlık bandının birim cinsinden eni (= tahtanın eni, 40n).
  function ustYaz(svg, genis, gecikme = 0, anlik = false, kucuk = false) {
    svg.textContent = '';
    svg.dataset.kucuk = String(kucuk);
    svg.setAttribute('viewBox', `0 0 ${genis} ${kucuk ? 64 : 120}`);
    const K = KL.kalemYap(svg);
    const baslik = metinSvg(svg, 'SOS', {
      x: 0, y: kucuk ? 34 : 60, boyut: kucuk ? 42 : 58, hiza: 'start', tohum: ['baslik'], gecikme, adim: 90, anlik,
    });
    const w = baslik.node.getComputedTextLength() || 120;
    const cizgi = altCizgi(K, svg, -3, w + 8, kucuk ? 42 : 71, ['baslik'], gecikme + baslik.sure * .7, anlik);
    const tarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tr = metinSvg(svg, tarih, {
      x: genis, y: kucuk ? 12 : 20, boyut: kucuk ? 16 : 17, hiza: 'end', tohum: ['tarih'], gecikme: gecikme + 250, anlik,
    });
    return { bitti: Promise.all([baslik.bitti, cizgi.bitti, tr.bitti]), sure: baslik.sure + 300 };
  }

  // Durum satırı (kurşun kalem, defterin satırına oturur). Her çağrıda eskisinin yerine yenisi yazılır.
  function durumYaz(svg, yazi, renk = 'kursun', gecikme = 0, anlik = false) {
    const eski = svg.querySelector(':scope > .durum');
    if (eski) eski.remove();
    const g = svgEl('g', { class: 'durum' }, svg);
    return metinSvg(g, yazi, {
      x: 0, y: svg.dataset.kucuk === 'true' ? 61 : 100, boyut: svg.dataset.kucuk === 'true' ? 16 : 20, renk, hiza: 'start', tohum: ['durum', yazi], gecikme, anlik,
    });
  }

  /* ---------- harf seçici ---------- */

  // Düğmenin içine büyük S ya da O çizer (sıradaki oyuncunun mürekkebiyle).
  function seciciCiz(btn, harf, sahip, gecikme = 0, anlik = false) {
    const svg = btn.querySelector('svg');
    svg.textContent = '';
    const K = KL.kalemYap(svg);
    const g = svgEl('g', { class: 'secici-harf', transform: 'translate(30 35) scale(1.5) translate(-20 -20)' }, svg);
    svgEl('g', { class: 'cember' }, svg);
    const s = harfGrubu(K, g, harf, mürekkep(sahip), ['secici', harf, sahip], rastgele('secici', harf, sahip), { gecikme, anlik, sureMs: [220, 300] });
    return { bitti: s.bitti, sure: s.sure };
  }

  // Seçili harfin etrafına kurşun kalem çemberi; öncekinin çemberi solar. Her seçimde çember farklı tohumla çizilir.
  function seciciSec(dugmeler, secili, gecikme = 0, anlik = false) {
    for (const btn of dugmeler) {
      const acik = btn.dataset.harf === secili;
      btn.setAttribute('aria-pressed', String(acik));
      const kap = btn.querySelector('svg .cember');
      if (!kap) continue;
      for (const eski of Array.from(kap.children)) KL.soldur(eski, 180);
      if (!acik) continue;
      const sayac = (parseInt(btn.dataset.cember || '0', 10) + 1);
      btn.dataset.cember = sayac;
      const g = svgEl('g', null, kap);
      KL.kalemYap(btn.querySelector('svg')).elips(g, [30, 35, 54, 63],
        { stroke: renkDeger('kursun'), strokeWidth: 1.8, roughness: 1.7 },
        ['cember', btn.dataset.harf, sayac], { gecikme, anlik, sureMs: [260, 320] });
    }
  }

  /* ---------- ayar notları ---------- */

  // Onay kutusu: elle çizilmiş kare, işaretliyse mavi kalemle çarpı (kutudan taşar).
  function kutucukCiz(svg, anahtar, isaretli, anlik = false) {
    svg.textContent = '';
    const K = KL.kalemYap(svg);
    K.dikdortgen(svg, [3, 3, 14, 14], { stroke: renkDeger('kursun'), strokeWidth: 1.5, roughness: 1.3 },
      ['kutucuk', anahtar], { anlik, sureMs: [150, 200] });
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
    // Kalem çemberi yazıyı sarar; geniş dokunma alanı çemberi gereksiz yere uzatmaz.
    const yaziBoyu = parseFloat(getComputedStyle(btn).fontSize);
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w + 6, Math.min(h * 1.05, yaziBoyu * 1.4)],
      { stroke: renkDeger('kursun'), strokeWidth: 1.4, roughness: 1.5 },
      ['ayar-cember', btn.dataset.ayar, btn.dataset.deger], { anlik, sureMs: [200, 260] });
  }

  // Oyun bitince "Yeni sayfa" düğmesinin çevresine kurşun kalem çemberi; acik=false siler. Kendi svg'sinde durur,
  // böylece hover vurgusu ya da çerçevenin yeniden çizimi onu silmez.
  function dugmeIsaretle(btn, acik, anlik = false) {
    const eski = btn.querySelector(':scope > svg.isaret');
    if (eski) eski.remove();
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'isaret', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.appendChild(svg);
    KL.kalemYap(svg).elips(svg, [w / 2, h / 2, w * 1.14, h * 1.55],
      { stroke: renkDeger('kursun'), strokeWidth: 1.6, roughness: 1.7 },
      ['dugme-isaret', btn.id], { anlik, gecikme: anlik ? 0 : 500, sureMs: [320, 420] });
  }

  /* ---------- sonuç ---------- */

  // Oyun sonu: tahtanın ortasına kağıt renginde bir leke, üstüne büyük el yazısı sonuç.
  function sonucCiz(T, baslik, alt, renkAd, gecikme = 0, anlik = false) {
    const ink = renkDeger(renkAd);
    const boy = T.boy, c = boy / 2;
    const w = boy * .92, h = Math.min(boy * .5, 170);
    const g = svgEl('g', { class: 'sonuc', 'pointer-events': 'none' }, T.katman.efekt);
    const e = T.K.elips(g, [c, c, w, h], { stroke: ink, strokeWidth: 2, fill: '#fbf9f2', fillStyle: 'solid' }, ['sonuc', T.id], { gecikme, anlik });
    const t0 = gecikme + e.sure * .6;
    const boyut = Math.max(22, Math.min(58, boy * .15, (w * .74) / (baslik.length * .58)));
    const t1 = metinSvg(g, baslik, { x: c, y: c - 2, boyut, renk: ink, tohum: ['sonuc', baslik], gecikme: t0, adim: 50, anlik });
    const t2 = metinSvg(g, alt, { x: c, y: c + h * .26, boyut: Math.max(16, Math.min(28, boy * .08)), renk: 'kursun', tohum: ['sonuc2', alt], gecikme: t0 + t1.sure, anlik });
    return { node: g, bitti: Promise.all([e.bitti, t1.bitti, t2.bitti]), sure: t0 + t1.sure + t2.sure };
  }

  SOS.draw = {
    HUCRE,
    tahtaKur, izgaraCiz,
    harfCiz, harfSil, harfTitret, imlecCiz, imlecSil, sonHamleIsaretle, sonHamleSil, onizlemeGoster, onizlemeSil, ipucuCiz, sosCiz, sosSil,
    marjKur, etiketle, ceteleGuncelle, birDahaYaz,
    ustYaz, durumYaz,
    seciciCiz, seciciSec,
    kutucukCiz, ayarCemberi, dugmeIsaretle,
    sonucCiz,
  };
})();
