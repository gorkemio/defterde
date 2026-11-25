// draw.js — rough.js ile "tükenmez kalem" çizimi. Oyun mantığını bilmez.
// Her çizim ilkeli { node, bitti, sure } döndürür:
//   node  = eklenen SVG düğümü, bitti = çizim animasyonu bitince çözülen Promise,
//   sure  = animasyonun (gecikmeden sonraki) toplam süresi, ms — art arda çizimleri zincirlemek için.
(function () {
  'use strict';

  const AB = (window.AB = window.AB || {});
  const SVG = 'http://www.w3.org/2000/svg';
  const HUCRE = 40;                               // tahta SVG'sinde bir hücre (= 2 defter karesi), birim
  const SUTUN_HARFLERI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* ---------- küçük yardımcılar ---------- */

  // Aynı anahtardan her zaman aynı sayı (FNV-1a). rough.js seed'leri ve titreme için.
  function karma(...p) {
    let h = 2166136261;
    const s = p.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // rough.js'te seed 0 "rastgele" demektir, bu yüzden 1'den başlar.
  const tohum = (...p) => 1 + (karma(...p) % 2147483646);

  // Anahtardan türeyen küçük rastgele sayı üreteci (mulberry32).
  function rastgele(...p) {
    let a = karma(...p);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const aralik = (r, a, b) => a + (b - a) * r();
  const sinir = (v, a, b) => Math.min(b, Math.max(a, v));

  const azHareket = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const animasyonVar = () =>
    AB.config.cizim.animasyon && !azHareket.matches && typeof Element.prototype.animate === 'function';

  function svgEl(ad, oz, ebeveyn) {
    const e = document.createElementNS(SVG, ad);
    if (oz) for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  /* ---------- çizdir: kalemle çiziliyormuş gibi belirt ---------- */

  const HIZ = 1.6;  // birim/ms: bir rough çağrısının süresi = toplam uzunluk / HIZ, sureMs aralığına sıkıştırılır

  // rough.js her şekli çok alt yollu tek <path> yapar; dash deseni her alt yolda baştan başlar.
  // Bu yüzden her alt yolu ayrı <path> yapıp sırayla çizdiriyoruz.
  function altYollar(p) {
    const parcalar = (p.getAttribute('d') || '').split(/(?=M)/).map(s => s.trim()).filter(Boolean);
    if (parcalar.length <= 1) return [p];
    const liste = parcalar.map(d => {
      const q = p.cloneNode(false);
      q.setAttribute('d', d);
      p.parentNode.insertBefore(q, p);
      return q;
    });
    p.remove();
    return liste;
  }

  const taramaMi = (p, c) => {
    const sw = parseFloat(p.getAttribute('stroke-width'));
    return Math.abs(sw - c.fillWeight) < 0.05 && Math.abs(sw - c.strokeWidth) > 0.05;
  };

  // g: rough.js'in döndürdüğü <g> (DOM'a eklenmiş olmalı: uzunluk ölçülüyor).
  // o: { gecikme (ms), anlik (true: animasyonsuz) }
  function cizdir(g, o = {}) {
    if (!animasyonVar() || o.anlik) return { bitti: Promise.resolve(), sure: 0 };
    const c = AB.config.cizim;
    const taban = o.gecikme || 0;
    const bekleyenler = [];
    let bitis = taban;

    const oynat = (p, anahtarlar, secenek) => {
      const a = p.animate(anahtarlar, secenek);
      bitis = Math.max(bitis, secenek.delay + secenek.duration);
      bekleyenler.push(a.finished.then(() => a.cancel(), () => {}));  // bitince kalıcı etkiyi bırak
    };
    const kalemIzi = (q, uzunluk, gecikme, sure) => {
      const A = uzunluk + 4;
      const sw = parseFloat(q.getAttribute('stroke-width')) || 2;
      oynat(q,
        [{ strokeDasharray: A, strokeDashoffset: A + sw }, { strokeDasharray: A, strokeDashoffset: 0 }],
        { duration: Math.max(sure, 16), delay: gecikme, fill: 'both', easing: 'ease-in-out' });
    };

    for (const p of Array.from(g.querySelectorAll('path'))) {
      const dolgu = p.getAttribute('fill');
      if (dolgu && dolgu !== 'none') {                    // dolu şekil: kalem izi değil, yumuşakça belirir
        oynat(p, [{ opacity: 0 }, { opacity: 1 }], { duration: 140, delay: taban, fill: 'both' });
        continue;
      }
      const tarama = taramaMi(p, c);
      const parcalar = altYollar(p);
      const uz = parcalar.map(q => q.getTotalLength());
      const toplam = uz.reduce((a, b) => a + b, 0);
      if (!toplam) continue;

      if (tarama) {                                       // kurşun kalem taraması: kısa, üst üste binen darbeler
        const adim = Math.min(18, 380 / parcalar.length);
        parcalar.forEach((q, i) => kalemIzi(q, uz[i], taban + i * adim, 70));
      } else {                                            // tükenmez darbesi: alt yollar sırayla (ikinci geçiş)
        const T = sinir(toplam / HIZ, c.sureMs[0], c.sureMs[1]);
        let t = taban;
        parcalar.forEach((q, i) => {
          const d = T * uz[i] / toplam;
          kalemIzi(q, uz[i], t, d);
          t += d;
        });
      }
    }
    return { bitti: Promise.all(bekleyenler), sure: bitis - taban };
  }

  /* ---------- kalem: bir SVG için rough.js çizicisi ---------- */

  // Hizalamadan bağımsız el çizimi dokusu: ızgara, menüler ve hamle işaretleri için.
  const elKalemi = (roughness = 1.2) => ({
    roughness, bowing: 1, disableMultiStroke: false, disableMultiStrokeFill: false, preserveVertices: false,
  });

  function kalemYap(svg) {
    const rc = rough.svg(svg);
    const c = AB.config.cizim;

    const secenek = (ek, anahtar) => Object.assign({
      roughness: c.roughness,
      bowing: c.bowing,
      disableMultiStroke: true,
      disableMultiStrokeFill: true,
      preserveVertices: true,
      strokeWidth: c.strokeWidth,
      fillWeight: c.fillWeight,
      stroke: AB.config.renk.mavi,
      seed: tohum(...anahtar),
    }, ek);

    const ekle = (katman, g, o) => {
      katman.appendChild(g);
      const s = cizdir(g, o);
      return { node: g, bitti: s.bitti, sure: s.sure };
    };

    return {
      rc,
      cizgi:      (k, [x1, y1, x2, y2], ek, an, o) => ekle(k, rc.line(x1, y1, x2, y2, secenek(ek, an)), o),
      egri:       (k, noktalar, ek, an, o)         => ekle(k, rc.curve(noktalar, secenek(ek, an)), o),
      yol:        (k, d, ek, an, o)                => ekle(k, rc.path(d, secenek(ek, an)), o),
      daire:      (k, [cx, cy, cap], ek, an, o)    => ekle(k, rc.circle(cx, cy, cap, secenek(ek, an)), o),
      dikdortgen: (k, [x, y, w, h], ek, an, o)     => ekle(k, rc.rectangle(x, y, w, h, secenek(ek, an)), o),
      cokgen:     (k, noktalar, ek, an, o)         => ekle(k, rc.polygon(noktalar, secenek(ek, an)), o),
      elips:      (k, [cx, cy, w, h], ek, an, o)   => ekle(k, rc.ellipse(cx, cy, w, h, secenek(ek, an)), o),
    };
  }

  // Köşelerde hafif taşan dört kalem çizgisi; düğmenin yerleşimi değişmez.
  function kutu(K, katman, x, y, w, h, o = {}) {
    const grup = svgEl('g', null, katman);
    const an = o.tohum || ['kutu'];
    const r = rastgele('kutu', ...an);
    const t = () => aralik(r, 1, 4);
    const j = () => aralik(r, -1, 1);
    const cizgiler = [
      [x - t(), y + j(), x + w + t(), y + j()],
      [x + w + j(), y - t(), x + w + j(), y + h + t()],
      [x + w + t(), y + h + j(), x - t(), y + h + j()],
      [x + j(), y + h + t(), x + j(), y - t()],
    ];
    const baslangic = o.gecikme || 0;
    let gec = baslangic;
    const bit = [];
    cizgiler.forEach((cz, i) => {
      const s = K.cizgi(grup, cz, { ...elKalemi(.8), bowing: .6, strokeWidth: 1, ...o.cizgi }, ['kutu', ...an, i], { gecikme: gec, anlik: o.anlik });
      bit.push(s.bitti);
      gec += s.sure * 0.8;
    });
    return { node: grup, bitti: Promise.all(bit), sure: gec - baslangic + 60 };
  }

  /* ---------- yazı ---------- */

  // SVG el yazısı: hafif kaymış ve dönmüş harfler sırayla belirir; satırın yönü sabit kalır.
  // o: { x, y, boyut, renk, hiza, tohum:[...], gecikme, adim, anlik }
  function metinSvg(katman, yazi, o) {
    const t = svgEl('text', {
      x: o.x, y: o.y,
      'font-size': o.boyut || 26,
      fill: o.renk || AB.config.renk.mavi,
      'text-anchor': o.hiza || 'middle',
    }, katman);
    const r = rastgele('yazi', ...(o.tohum || [yazi]));
    let onceki = 0;
    const harfler = [];
    for (const ch of yazi) {
      const dy = (r() - .5) * 1.8;                      // dy birikimli: yalnız fark verilir
      const ts = svgEl('tspan', {
        dy: (dy - onceki).toFixed(2),
        rotate: ((r() - .5) * 6).toFixed(1),
        'fill-opacity': (.82 + r() * .18).toFixed(2),
      }, t);
      ts.textContent = ch;
      onceki = dy;
      harfler.push(ts);
    }

    const bit = [];
    let sure = 0;
    if (animasyonVar() && !o.anlik) {
      const adim = o.adim ?? 32;
      harfler.forEach((ts, i) => {
        const hedef = parseFloat(ts.getAttribute('fill-opacity'));
        const a = ts.animate([{ fillOpacity: 0 }, { fillOpacity: hedef }],
          { duration: 90, delay: (o.gecikme || 0) + i * adim, fill: 'both' });
        bit.push(a.finished.then(() => a.cancel(), () => {}));
        sure = i * adim + 90;
      });
    }
    return { node: t, bitti: Promise.all(bit), sure };
  }

  // HTML el yazısı: harf başına küçük, sabit kayma/dönme. Kelimeler bölünmez.
  function harfle(kap, yazi, o = {}) {
    yazi = yazi ?? kap.textContent.trim();
    kap.textContent = '';
    kap.removeAttribute('aria-label');
    const okunur = document.createElement('span');      // ekran okuyucu için düz metin (harfler aria-hidden)
    okunur.className = 'gizli';
    okunur.textContent = yazi;
    kap.appendChild(okunur);
    const r = rastgele('harf', ...(o.tohum || [yazi]));
    const harfler = [];
    yazi.split(' ').forEach((kelime, ki) => {
      if (ki) kap.appendChild(document.createTextNode(' '));
      const k = document.createElement('span');
      k.className = 'kelime';
      k.setAttribute('aria-hidden', 'true');
      for (const ch of kelime) {
        const s = document.createElement('span');
        s.className = 'harf';
        s.textContent = ch;
        s.style.transform = `translateY(${((r() - .5) * 1.6).toFixed(2)}px) rotate(${((r() - .5) * 5).toFixed(1)}deg)`;
        k.appendChild(s);
        harfler.push(s);
      }
      kap.appendChild(k);
    });

    const bit = [];
    let sure = 0;
    if (animasyonVar() && !o.anlik) {
      const adim = o.adim ?? 30;
      harfler.forEach((s, i) => {
        const a = s.animate([{ opacity: 0 }, { opacity: 1 }],
          { duration: 90, delay: (o.gecikme || 0) + i * adim, fill: 'both' });
        bit.push(a.finished.then(() => a.cancel(), () => {}));
        sure = i * adim + 90;
      });
    }
    return { node: kap, bitti: Promise.all(bit), sure };
  }

  /* ---------- tahta ---------- */

  // Boş tahta iskeleti: katmanlar + (şeffaf) hücre dokunma hedefleri. Henüz çizim yok.
  // o.klavye: hücreler ARIA ızgarası olur (satır grupları, gridcell, gezinen tabindex).
  function tahtaKur(svg, id, o = {}) {
    const n = AB.config.boyut;
    const boy = HUCRE * (n + 1);
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${boy} ${boy}`);
    const katman = {};
    for (const ad of ['izgara', 'etiket', 'gemiler', 'isaretler', 'efekt', 'hucreler', 'tutamaklar']) {
      katman[ad] = svgEl('g', { class: ad }, svg);
      if (!['hucreler', 'tutamaklar'].includes(ad)) katman[ad].setAttribute('aria-hidden', 'true');
    }
    // fill="none" olsaydı iç alan olay yakalamazdı
    const hucre = [];
    for (let s = 0; s < n; s++) {
      const satir = o.klavye ? svgEl('g', { role: 'row' }, katman.hucreler) : katman.hucreler;
      for (let k = 0; k < n; k++) {
        const oz = {
          class: 'hucre', x: HUCRE * (k + 1), y: HUCRE * (s + 1), width: HUCRE, height: HUCRE,
          fill: 'transparent', 'data-s': s, 'data-k': k,
        };
        if (o.klavye) {
          oz.role = 'gridcell';
          oz.tabindex = s === 0 && k === 0 ? 0 : -1;
          oz['aria-label'] = `${SUTUN_HARFLERI[k]}${s + 1}, atılmadı`;
        }
        hucre[s * n + k] = svgEl('rect', oz, satir);
      }
    }
    return { svg, id, n, K: kalemYap(svg), katman, hucre, gemiG: {} };
  }

  // Izgara: eşit aralıklı 11+11 çizgi, eski çift kalem geçişiyle. Önce dikey, sonra yatay.
  function izgaraCiz(T, gecikme = 0, anlik = false) {
    const n = T.n, bas = HUCRE, son = HUCRE * (n + 1);
    const bit = [];
    let gec = gecikme;
    for (const yon of ['d', 'y']) {
      for (let i = 0; i <= n; i++) {
        const p = HUCRE * (i + 1);
        const cizgi = yon === 'd' ? [p, bas, p, son] : [bas, p, son, p];
        const kalin = i === 0 || i === n;
        const s = T.K.cizgi(T.katman.izgara, cizgi,
          {
            strokeWidth: kalin ? 2.1 : 1.5,
            ...elKalemi(),
          }, ['izgara', T.id, yon, i], { gecikme: gec, anlik });
        bit.push(s.bitti);
        gec += 28;
      }
    }
    return { bitti: Promise.all(bit), sure: gec - gecikme + AB.config.cizim.sureMs[1] };
  }

  // Etiketler: üstte A–J, solda 1–10.
  function etiketYaz(T, gecikme = 0, anlik = false) {
    const n = T.n;
    const bit = [];
    let gec = gecikme;
    const yaz = (yazi, cx, cy, an) => {
      const s = metinSvg(T.katman.etiket, yazi, {
        x: cx, y: cy + 9, boyut: 26, hiza: 'middle',
        tohum: ['etiket', T.id, ...an], gecikme: gec, anlik,
      });
      bit.push(s.bitti);
      gec += 40;
    };
    for (let k = 0; k < n; k++) yaz(SUTUN_HARFLERI[k], HUCRE * (k + 1.5), HUCRE * .5, ['k', k]);
    for (let s = 0; s < n; s++) yaz(String(s + 1), HUCRE * .5, HUCRE * (s + 1.5), ['s', s]);
    return { bitti: Promise.all(bit), sure: gec - gecikme + 100 };
  }

  /* ---------- sayfa başlıkları ---------- */

  function altCizgi(K, katman, x1, x2, y, an, gecikme, anlik) {
    return K.cizgi(katman, [x1, y, x2, y], { strokeWidth: 1.8, ...elKalemi() }, ['altcizgi', ...an], { gecikme, anlik });
  }

  // Başlığın altındaki açıklama; hazırlıkta vurgulanır, her çağrıda eskisinin yerine yazılır.
  function altYaziYaz(svg, yazi, o = {}) {
    const eski = svg.querySelector(':scope > .alt-yazi');
    if (eski) eski.remove();
    const g = svgEl('g', { class: 'alt-yazi' }, svg);
    return metinSvg(g, yazi, {
      x: 4, y: 76, boyut: o.vurgulu ? 20 : 18,
      renk: o.vurgulu ? AB.config.renk.mavi : AB.config.renk.kursun, hiza: 'start',
      tohum: ['alt-ben', yazi], gecikme: o.gecikme || 0, anlik: o.anlik,
    });
  }

  function ustSol(svg, gecikme = 0, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg);
    const renk = AB.config.renk;
    const baslik = metinSvg(svg, 'AMİRAL BATTI', {
      x: 0, y: 44, boyut: 42, hiza: 'start', tohum: ['baslik'], gecikme, adim: 45, anlik,
    });
    const w = baslik.node.getComputedTextLength() || 260;
    const cizgi = altCizgi(K, svg, -2, w + 6, 56, ['baslik'], gecikme + baslik.sure * .8, anlik);
    const alt = altYaziYaz(svg, 'senin donanman', { gecikme: gecikme + baslik.sure, anlik });
    return { bitti: Promise.all([baslik.bitti, cizgi.bitti, alt.bitti]), sure: baslik.sure + 300 };
  }

  // Durum yazısı (sağ sayfanın başlığı). Her çağrıda eskisinin yerine yenisi yazılır.
  const DURUM_BOYUT = 34;
  const DURUM_EN_GENIS = 320;                            // birim; tarih 330 civarında başlıyor
  function durumYaz(svg, yazi, renk = 'mavi', gecikme = 0, anlik = false) {
    const eski = svg.querySelector('.durum');
    if (eski) eski.remove();
    const g = svgEl('g', { class: 'durum' }, svg);
    const m = metinSvg(g, yazi, {
      x: 0, y: 44, boyut: DURUM_BOYUT, renk: AB.config.renk[renk] || renk, hiza: 'start',
      tohum: ['durum', yazi], gecikme, anlik,
    });
    const genislik = m.node.getComputedTextLength();     // sağ üstteki tarihe çarpmasın
    if (genislik > DURUM_EN_GENIS) m.node.setAttribute('font-size', (DURUM_BOYUT * DURUM_EN_GENIS / genislik).toFixed(1));
    return m;
  }

  function ustSag(svg, gecikme = 0, durum = '', anlik = false) {
    svg.textContent = '';
    const renk = AB.config.renk;
    const d = durum ? durumYaz(svg, durum, 'mavi', gecikme, anlik) : { bitti: Promise.resolve(), sure: 0 };
    const alt = metinSvg(svg, 'rakibin donanması', {
      x: 4, y: 76, boyut: 18, renk: renk.kursun, hiza: 'start', tohum: ['alt-rakip'],
      gecikme: gecikme + d.sure, anlik,
    });
    const tarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tr = metinSvg(svg, tarih, {
      x: 440, y: 22, boyut: 20, hiza: 'end', tohum: ['tarih'], gecikme: gecikme + 200, anlik,
    });
    return { bitti: Promise.all([d.bitti, alt.bitti, tr.bitti]), sure: d.sure + 300 };
  }

  /* ---------- düğmeler ---------- */

  // Düğmenin arkasına elle çizilmiş çerçeve. Boyut değişince aynı seed'le yeniden çağrılır.
  function dugmeCerceve(btn, gecikme = 0, anlik = false) {
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return { bitti: Promise.resolve(), sure: 0 };
    let svg = btn.querySelector(':scope > svg.cerceve');
    if (!svg) {
      svg = svgEl('svg', { class: 'cerceve', 'aria-hidden': 'true' });
      btn.insertBefore(svg, btn.firstChild);
    }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.textContent = '';
    const K = kalemYap(svg);
    const ana = svgEl('g', { class: 'ana' }, svg);
    svgEl('g', { class: 'vurgu' }, svg);
    svgEl('g', { class: 'odak' }, svg);
    const sonuc = kutu(K, ana, 4, 4, w - 8, h - 8, { tohum: ['dugme', btn.id], gecikme, anlik });
    if (klavyeOdagi(btn)) dugmeOdak(btn, true, true);     // boyut değişirken odak halkası kaybolmasın
    return sonuc;
  }

  // Odak klavyeden mi geldi? (fareyle tıklamada halka çizilmez)
  function klavyeOdagi(el) {
    if (document.activeElement !== el) return false;
    try { return el.matches(':focus-visible'); } catch (e) { return true; }
  }

  // Klavye odağı: düğmenin çevresine kurşun kalemle halka (hover'daki mavi geçişten ayrı).
  function dugmeOdak(btn, acik, anlik = false) {
    const svg = btn.querySelector(':scope > svg.cerceve');
    if (!svg) return;
    const g = svg.querySelector('.odak');
    g.textContent = '';
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    kalemYap(svg).elips(g, [w / 2, h / 2, w + 16, h + 14],
      { stroke: AB.config.renk.kursun, strokeWidth: 1.1, ...elKalemi(1.4) }, ['odak', btn.id], { anlik });
  }

  // Üzerine gelince/odaklanınca kalem bir kez daha üstünden geçer.
  function dugmeVurgu(btn) {
    const svg = btn.querySelector(':scope > svg.cerceve');
    if (!svg) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    const g = svg.querySelector('.vurgu');
    g.textContent = '';
    const sayac = (parseInt(btn.dataset.vurgu || '0', 10) + 1);
    btn.dataset.vurgu = sayac;
    const K = kalemYap(svg);
    kutu(K, g, 4, 4, w - 8, h - 8, { tohum: ['vurgu', btn.id, sayac], cizgi: { strokeWidth: .7, disableMultiStroke: true } });
  }

  /* ---------- cilt ve köşe karalamaları ---------- */

  function zimbaCiz(svg, id, gecikme = 0, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg);
    return K.dikdortgen(svg, [3, 4, 54, 8], {
      stroke: '#5b5b5b', strokeWidth: 1.3,
      fill: '#8a8a8a', fillStyle: 'hachure', hachureGap: 2.4, fillWeight: AB.config.cizim.fillWeight,
    }, ['zimba', id], { gecikme, anlik });
  }

  // Süsler kurşun kalemle; kendi küçük koordinat kutularında (viewBox) çizilir.
  const SUSLER = {
    gunes(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun, o = { gecikme: gec, anlik };
      const hepsi = [K.daire(g, [50, 50, 34], {
        stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 4, hachureAngle: -40, strokeWidth: 1.5,
      }, ['sus', 'gunes', 'disk', ...an], o)];
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        const r1 = 24, r2 = 39;
        hepsi.push(K.cizgi(g, [50 + r1 * Math.cos(a), 50 + r1 * Math.sin(a), 50 + r2 * Math.cos(a), 50 + r2 * Math.sin(a)],
          { stroke: kur, strokeWidth: 1.5 }, ['sus', 'gunes', 'isin', i, ...an], { gecikme: gec + 220 + i * 40, anlik }));
      }
      hepsi.push(K.daire(g, [44, 47, 3], { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: 1 }, ['sus', 'gunes', 'g1', ...an], o));
      hepsi.push(K.daire(g, [56, 47, 3], { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: 1 }, ['sus', 'gunes', 'g2', ...an], o));
      hepsi.push(K.egri(g, [[43, 55], [50, 60], [57, 55]], { stroke: kur, strokeWidth: 1.4 }, ['sus', 'gunes', 'gulus', ...an], o));
      return hepsi;
    },
    bulut(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun;
      return [K.yol(g,
        'M 25 55 C 5 55, 3 33, 22 31 C 20 12, 48 6, 58 22 C 66 8, 96 12, 94 34 C 112 32, 115 56, 95 55 Z',
        { stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 6, hachureAngle: -30, strokeWidth: 1.5 },
        ['sus', 'bulut', ...an], { gecikme: gec, anlik })];
    },
    kalp(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun;
      return [K.yol(g,
        'M 40 70 C 10 48, 6 20, 24 14 C 33 11, 40 18, 40 24 C 40 18, 47 11, 56 14 C 74 20, 70 48, 40 70 Z',
        { stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 4, hachureAngle: 50, strokeWidth: 1.5 },
        ['sus', 'kalp', ...an], { gecikme: gec, anlik })];
    },
    dalga(K, g, gec, an, anlik) {
      const kalem = { ...elKalemi(.6), stroke: AB.config.renk.kursun, strokeWidth: 1.3 };
      return [
        K.yol(g, 'M 12 25 Q 21 14 30 25 T 48 25 T 66 25 T 84 25', kalem,
          ['sus', 'dalga', 0, ...an], { gecikme: gec, anlik }),
        K.yol(g, 'M 18 40 Q 27 30 36 40 T 54 40 T 72 40 T 90 40', kalem,
          ['sus', 'dalga', 1, ...an], { gecikme: gec + 160, anlik }),
      ];
    },
    yildiz(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun, pts = [];
      for (let i = 0; i < 10; i++) {
        const yaricap = i % 2 ? 7.5 : 17, a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push([20 + yaricap * Math.cos(a), 20 + yaricap * Math.sin(a)]);
      }
      return [K.cokgen(g, pts, { stroke: kur, strokeWidth: 1.4 }, ['sus', 'yildiz', ...an], { gecikme: gec, anlik })];
    },
  };

  function susCiz(svg, ad, an, gecikme = 0, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg);
    const g = svgEl('g', { opacity: .85 }, svg);
    const cizimler = SUSLER[ad](K, g, gecikme, an, anlik);
    return { bitti: Promise.all(cizimler.map(c => c.bitti)), sure: 600 };
  }

  /* ---------- varlıklar: isteğe bağlı elle çizilmiş PNG'ler ---------- */

  // assets/varliklar.js içindeki liste (AB.varliklar = ['gemi-2.png', ...]) yüklenir. Bir dosya
  // yoksa ya da açılamazsa yalnız o parça için prosedürel SVG çizilmeye devam eder.
  const varlik = {};                                       // 'gemi-2' -> HTMLImageElement

  function varlikYukle(sinirMs = 3000) {
    const liste = Array.isArray(AB.varliklar) ? AB.varliklar : [];
    const isler = liste.map(dosya => new Promise(coz => {
      const img = new Image();
      img.onload = () => { if (img.naturalWidth) varlik[dosya.replace(/\.png$/i, '')] = img; coz(); };
      img.onerror = coz;
      img.src = 'assets/' + dosya;
    }));
    return Promise.race([Promise.all(isler), new Promise(r => setTimeout(r, sinirMs))]);
  }

  const sonra = (ms) => new Promise(r => setTimeout(r, ms));

  // PNG'yi SVG içine koyar; çizgi çizilemeyeceği için yumuşakça belirir.
  function resimEkle(katman, ad, x, y, w, h, o = {}) {
    const e = svgEl('image', { href: varlik[ad].src, x, y, width: w, height: h, preserveAspectRatio: 'none' }, katman);
    const hareketli = animasyonVar() && !o.anlik;
    if (hareketli) {
      const a = e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: o.gecikme || 0, fill: 'both' });
      a.finished.then(() => a.cancel(), () => {});
    }
    return { node: e, bitti: hareketli ? sonra((o.gecikme || 0) + 180) : Promise.resolve(), sure: 180 };
  }

  /* ---------- gemiler ---------- */

  const renkDeger = (ad) => AB.config.renk[ad] || ad;

  // Eski gemileri siler; animasyon açıkken önce silinirmiş gibi soluklaşır.
  function gemileriSil(T, anlik = false) {
    const g = T.katman.gemiler;
    T.gemiG = {};
    if (!animasyonVar() || anlik) { g.textContent = ''; return Promise.resolve(); }
    const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    return a.finished.then(() => { g.textContent = ''; a.cancel(); }, () => { g.textContent = ''; });
  }

  // Atılmış hücreyi dokunmaya kapat (CSS .atildi); klavye ızgarasında etiketini güncelle.
  function hucreAtildi(T, s, k, durum) {
    const h = T.hucre[s * T.n + k];
    h.classList.add('atildi');
    if (durum && h.hasAttribute('aria-label')) h.setAttribute('aria-label', `${SUTUN_HARFLERI[k]}${s + 1}, ${durum}`);
  }

  function sarmal(cx, cy, yaricap) {                       // spiral göz için noktalar
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = t * 3.5 * Math.PI;
      pts.push([cx + yaricap * t * Math.cos(a), cy + yaricap * t * Math.sin(a)]);
    }
    return pts;
  }

  // Geminin tahtadaki yeri: yerel koordinatlar (yatay, burun sağda, 1 hücre = 40 birim) -> tahta.
  // Dikeyse burun yukarı bakacak şekilde -90° döndürülür.
  function gemiDonusumu(gemi) {
    const w = HUCRE * gemi.uzunluk;
    const x0 = HUCRE * (gemi.hucreler[0].k + 1), y0 = HUCRE * (gemi.hucreler[0].s + 1);
    if (gemi.yatay) return `translate(${x0} ${y0})`;
    return `translate(${x0 + HUCRE / 2} ${y0 + w / 2}) rotate(-90) translate(${-w / 2} ${-HUCRE / 2})`;
  }

  // Batan gemi hafifçe aşağı kayıp yana yatarak solar.
  function batikSoluklastir(grup, anlik = false) {
    const dis = grup.parentNode;
    if (!dis || dis.dataset.soluk) return;
    dis.dataset.soluk = '1';
    const hareketli = animasyonVar() && !anlik;
    dis.style.transition = hareketli ? 'transform .8s ease-in, opacity .8s' : 'none';
    requestAnimationFrame(() => { dis.style.transform = 'translateY(3px) rotate(6deg)'; dis.style.opacity = '.88'; });
  }

  // Yüz: normal / saskin / batik. Eskisinin yerine yenisi çizilir. Dikey gemide yüz dik durur.
  // PNG'li gemide yüz resmin içindedir: yalnız durum resmi değişir (yoksa normal resim kalır).
  function yuzCiz(T, gemi, durum, gecikme = 0, anlik = false) {
    const grup = T.gemiG[gemi.id];
    if (grup._resimli) {
      const img = varlik[`gemi-${gemi.uzunluk}-${durum}`] || varlik[`gemi-${gemi.uzunluk}`];
      grup.querySelector(':scope > image').setAttribute('href', img.src);
      grup.dataset.durum = durum;
      if (durum === 'batik') batikSoluklastir(grup, anlik);
      return { node: grup, bitti: Promise.resolve(), sure: 0 };
    }
    const eski = grup.querySelector(':scope > .yuz');
    if (eski) eski.remove();
    const yuz = svgEl('g', { class: 'yuz' }, grup);
    const [fx, fy] = grup._yuz;
    if (!gemi.yatay) yuz.setAttribute('transform', `rotate(90 ${fx} ${fy})`);

    const K = T.K, kur = grup._renk, ok = { gecikme, anlik };
    const o = { stroke: kur, strokeWidth: 1.4 };
    const an = ['yuz', T.id, gemi.id, durum];
    const nokta = (x, y, r) => K.daire(yuz, [x, y, r * 2], { ...o, fill: kur, fillStyle: 'solid' }, [...an, 'n', x], ok);
    const bit = [];
    if (durum === 'normal') {
      bit.push(nokta(fx - 6.5, fy - 2.6, 2.2), nokta(fx + 6.5, fy - 2.6, 2.2));
      bit.push(K.egri(yuz, [[fx - 4.5, fy + 4.5], [fx, fy + 7.8], [fx + 4.5, fy + 4.5]], o, [...an, 'agiz'], ok));
    } else if (durum === 'saskin') {
      for (const dx of [-6.5, 6.5]) {
        bit.push(K.daire(yuz, [fx + dx, fy - 3.2, 7.8], o, [...an, 'g', dx], ok));
        bit.push(nokta(fx + dx, fy - 3.2, 1.2));
      }
      bit.push(K.daire(yuz, [fx, fy + 6.3, 5.6], o, [...an, 'agiz'], ok));
    } else {
      for (const dx of [-7, 7]) bit.push(K.egri(yuz, sarmal(fx + dx, fy - 3.2, 4.6), o, [...an, 's', dx], ok));
      bit.push(K.egri(yuz, [[fx - 5.2, fy + 6.5], [fx - 2.6, fy + 4.5], [fx, fy + 6.5], [fx + 2.6, fy + 4.5], [fx + 5.2, fy + 6.5]], o, [...an, 'agiz'], ok));
      batikSoluklastir(grup, anlik);
    }
    grup.dataset.durum = durum;
    return { node: yuz, bitti: Promise.all(bit.map(b => b.bitti)), sure: 300 };
  }

  // Gemi: 1 sandal · 2 römorkör · 3 denizaltı · 4 vapur. o: { renk, gecikme, anlik }
  function gemiCiz(T, gemi, durum = 'normal', o = {}) {
    const L = gemi.uzunluk, w = HUCRE * L;
    const ink = renkDeger(o.renk || 'mavi'), kur = AB.config.renk.kursun;
    const dis = svgEl('g', { class: 'gemi', 'data-id': gemi.id }, T.katman.gemiler);
    dis.style.transformBox = 'fill-box';
    dis.style.transformOrigin = 'center';
    const grup = svgEl('g', { class: 'govde', transform: gemiDonusumu(gemi) }, dis);
    grup._renk = ink;
    T.gemiG[gemi.id] = grup;

    if (varlik['gemi-' + L]) {                             // elle çizilmiş PNG varsa o kullanılır
      grup._resimli = true;
      const r = resimEkle(grup, 'gemi-' + L, 0, 0, w, HUCRE, o);
      yuzCiz(T, gemi, durum, 0, o.anlik);
      return { node: dis, bitti: r.bitti, sure: r.sure };
    }

    const dolgu = { fill: kur, fillStyle: 'hachure', hachureGap: 3.4, hachureAngle: -45, fillWeight: AB.config.cizim.fillWeight };
    const P = [];                                          // [çizici, argüman, ek seçenekler]
    let yuz;
    // Gövdeler hücre yüksekliğinin ~yarısını kaplar (okunurluk); 4 ve üstü w'ye göre ölçeklenir.
    if (L === 1) {
      P.push(['yol', 'M 4 16 L 36 16 C 34 31, 26 37, 20 37 C 14 37, 6 31, 4 16 Z', dolgu]);
      P.push(['cizgi', [20, 16, 20, 3], {}]);
      P.push(['cokgen', [[20, 3], [31, 6.5], [20, 10]], {}]);
      yuz = [20, 24];
    } else if (L === 2) {
      P.push(['cokgen', [[3, 17], [77, 17], [68, 36], [11, 36]], dolgu]);
      P.push(['dikdortgen', [18, 6, 26, 11], {}]);
      P.push(['dikdortgen', [26, 0, 9, 6], {}]);
      yuz = [57, 25.5];
    } else if (L === 3) {
      P.push(['elips', [60, 26, 110, 24], dolgu]);
      P.push(['dikdortgen', [32, 5, 26, 10], {}]);
      P.push(['cizgi', [50, 5, 50, 0], {}]);
      P.push(['cizgi', [50, 0, 57, 0], {}]);
      P.push(['cizgi', [6, 22, 1, 17], {}]);
      P.push(['cizgi', [6, 30, 1, 35], {}]);
      yuz = [86, 26];
    } else {
      P.push(['cokgen', [[3, 18], [w - 3, 18], [w - 14, 37], [15, 37]], dolgu]);
      const kabinX = w * .2, kabinW = w * .45, baca = L >= 5 ? 3 : 2;
      P.push(['dikdortgen', [kabinX, 7, kabinW, 11], {}]);
      for (let i = 0; i < baca; i++) P.push(['dikdortgen', [kabinX + kabinW * (i + 1) / (baca + 1) - 4.5, 0, 9, 7], {}]);
      P.push(['cizgi', [w - 20, 18, w - 20, 3], {}]);
      P.push(['cokgen', [[w - 20, 3], [w - 8, 7], [w - 20, 11]], {}]);
      yuz = [w - 42, 27.5];
    }
    grup._yuz = yuz;

    const K = T.K, bit = [];
    const baslangic = o.gecikme || 0;
    let gec = baslangic;
    P.forEach(([cizici, arg, ek], i) => {
      const s = K[cizici](grup, arg, { stroke: ink, strokeWidth: 1.6, ...ek }, ['gemi', T.id, gemi.id, i], { gecikme: gec, anlik: o.anlik });
      bit.push(s.bitti);
      gec += s.sure * .7;
    });
    const y = yuzCiz(T, gemi, durum, gec, o.anlik);
    bit.push(y.bitti);
    return { node: dis, bitti: Promise.all(bit), sure: gec - baslangic + 300 };
  }

  /* ---------- işaretler ---------- */

  // Elle çizilmiş işaret PNG'si var mı? Kırmızı kalem için '-kirmizi' varyantı, yoksa genel olan.
  const isaretResmi = (ad, renkAd) =>
    (renkAd === 'kirmizi' && varlik[ad + '-kirmizi']) ? ad + '-kirmizi' : (varlik[ad] ? ad : null);

  // İsabet: kalemle iki çizgiden X, ardından küçük patlama çizgileri.
  function isabetCiz(T, s, k, renkAd, o = {}) {
    const ink = renkDeger(renkAd);
    const cx = HUCRE * (k + 1.5), cy = HUCRE * (s + 1.5);
    const grup = svgEl('g', { class: 'isabet' }, T.katman.isaretler);
    const resim = isaretResmi('isabet', renkAd);
    if (resim) {
      const r = resimEkle(grup, resim, cx - HUCRE / 2, cy - HUCRE / 2, HUCRE, HUCRE, o);
      return { node: grup, bitti: r.bitti, sure: r.sure };
    }
    const a = 13;
    const g0 = o.gecikme || 0;
    const stil = { stroke: ink, strokeWidth: 2.2, ...elKalemi() };
    const c1 = T.K.cizgi(grup, [cx - a, cy - a, cx + a, cy + a], stil, ['x1', T.id, s, k], { gecikme: g0, anlik: o.anlik });
    const c2 = T.K.cizgi(grup, [cx + a, cy - a, cx - a, cy + a], stil, ['x2', T.id, s, k], { gecikme: g0 + c1.sure * .85, anlik: o.anlik });
    const bit = [c1.bitti, c2.bitti];
    const gec = g0 + (c1.sure + c2.sure) * .85;
    const ef = svgEl('g', { class: 'patlama' }, T.katman.efekt);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = i * 2 * Math.PI / n + Math.PI / 8;
      const r1 = 16, r2 = 22;
      const p = T.K.cizgi(ef, [cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang), cx + r2 * Math.cos(ang), cy + r2 * Math.sin(ang)],
        { stroke: ink, strokeWidth: 1.5, ...elKalemi(.8) }, ['pat', T.id, s, k, i], { gecikme: gec + i * 25, anlik: o.anlik });
      bit.push(p.bitti);
    }
    return { node: grup, bitti: Promise.all(bit), sure: gec - g0 + n * 25 + 120 };
  }

  // Iska: minik nokta. o.otomatik: gemi batınca çevreye konan daha küçük kurşun kalem noktası.
  function iskaCiz(T, s, k, renkAd, o = {}) {
    const cx = HUCRE * (k + 1.5), cy = HUCRE * (s + 1.5);
    const ink = renkDeger(renkAd);
    const grup = svgEl('g', { class: o.otomatik ? 'oto-iska' : 'iska' }, T.katman.isaretler);
    const resim = !o.otomatik && isaretResmi('iska', renkAd);
    if (resim) {
      const e = resimEkle(grup, resim, HUCRE * (k + 1), HUCRE * (s + 1), HUCRE, HUCRE, o);
      return { node: grup, bitti: e.bitti, sure: e.sure };
    }
    return T.K.daire(grup, [cx, cy, o.otomatik ? 4.4 : 7],
      { stroke: ink, fill: ink, fillStyle: 'solid', strokeWidth: 1, ...elKalemi(1) },
      ['iska', T.id, s, k], { gecikme: o.gecikme, anlik: o.anlik });
  }

  function damlaYolu(x, y) {
    const f = (v) => v.toFixed(1);
    return `M ${f(x)} ${f(y - 4)} C ${f(x + 2.8)} ${f(y - .5)}, ${f(x + 3.2)} ${f(y + 1.8)}, ${f(x)} ${f(y + 3)} ` +
           `C ${f(x - 3.2)} ${f(y + 1.8)}, ${f(x - 2.8)} ${f(y - .5)}, ${f(x)} ${f(y - 4)} Z`;
  }

  // Batık: geminin altında iki dalgalı çizgi, üstünde su damlaları.
  function batikCiz(T, gemi, renkAd, o = {}) {
    const L = gemi.uzunluk, yatay = gemi.yatay, ink = renkDeger(renkAd);
    const x0 = HUCRE * (gemi.hucreler[0].k + 1), y0 = HUCRE * (gemi.hucreler[0].s + 1);
    const uzun = L * HUCRE;
    const r = rastgele('batik', T.id, gemi.id);
    const grup = svgEl('g', { class: 'batik' }, T.katman.efekt);
    // (boyuna, enine) -> tahta koordinatı. Dikeyde gövde altı sağa, burun yukarı bakar.
    const nok = (b, e) => (yatay ? [x0 + b, y0 + e] : [x0 + e, y0 + uzun - b]);
    const bit = [];
    let gec = o.gecikme || 0;
    if (varlik['batik-dalga']) {                           // elle çizilmiş dalga: geminin yerleşimini izler
      const yer = svgEl('g', { transform: gemiDonusumu(gemi) }, grup);
      bit.push(resimEkle(yer, 'batik-dalga', -4, 24, uzun + 8, 18, { gecikme: gec, anlik: o.anlik }).bitti);
    } else {
      for (const e0 of [36.5, 39.5]) {
        const adet = L * 4 + 2, pts = [];
        for (let i = 0; i <= adet; i++) pts.push(nok(-5 + (uzun + 10) * i / adet, e0 + (i % 2 ? -2.6 : 2.6)));
        const c = T.K.egri(grup, pts, { stroke: ink, strokeWidth: 1.7, ...elKalemi() }, ['batikdalga', T.id, gemi.id, e0], { gecikme: gec, anlik: o.anlik });
        bit.push(c.bitti);
        gec += c.sure * .7;
      }
    }
    for (let i = 0; i < 4; i++) {
      const [x, y] = nok(uzun * (.1 + .8 * r()), aralik(r, -9, -2));
      const d = T.K.yol(grup, damlaYolu(x, y), { stroke: ink, strokeWidth: 1.2, ...elKalemi(.6) }, ['damla', T.id, gemi.id, i], { gecikme: gec + i * 60, anlik: o.anlik });
      bit.push(d.bitti);
    }
    return { node: grup, bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) + 300 };
  }

  // Gemi batınca üstünde kısa süre "BATTI!" yazar, sonra soluklaşıp kaybolur.
  function batiYazisi(T, gemi, renkAd, o = {}) {
    const ink = renkDeger(renkAd);
    const orta = gemi.hucreler[Math.floor((gemi.hucreler.length - 1) / 2)];
    const g = svgEl('g', { class: 'batti-yazisi', 'pointer-events': 'none' }, T.katman.efekt);
    const gecikme = o.gecikme || 0;
    const t = metinSvg(g, 'BATTI!', {
      x: HUCRE * (orta.k + 1.5), y: HUCRE * (orta.s + 1.5) - 24, boyut: 26, renk: ink,
      tohum: ['batti', T.id, gemi.id], gecikme, adim: 60, anlik: o.anlik,
    });
    if (animasyonVar() && !o.anlik) {
      const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: gecikme + t.sure + 1300, fill: 'forwards' });
      a.finished.then(() => g.remove(), () => g.remove());
    } else {
      setTimeout(() => g.remove(), 1800);
    }
    return t;
  }

  // Oyun sonu: tahtanın ortasına daktilo düzeltme sıvısı gibi bir leke, üstüne el yazısı sonuç.
  function sonucCiz(T, baslik, alt, renkAd, gecikme = 0, anlik = false) {
    const ink = renkDeger(renkAd);
    const c = HUCRE * (T.n + 1) / 2 + HUCRE / 2;
    const g = svgEl('g', { class: 'sonuc', 'pointer-events': 'none' }, T.katman.efekt);
    const e = T.K.elips(g, [c, c, 380, 170], { stroke: ink, strokeWidth: 2, fill: '#fbf9f2', fillStyle: 'solid' }, ['sonuc', T.id], { gecikme, anlik });
    const t0 = gecikme + e.sure * .6;
    const t1 = metinSvg(g, baslik, { x: c, y: c - 6, boyut: 58, renk: ink, tohum: ['sonuc', baslik], gecikme: t0, adim: 50, anlik });
    const t2 = metinSvg(g, alt, { x: c, y: c + 42, boyut: 26, renk: renkDeger('kursun'), tohum: ['sonuc2', alt], gecikme: t0 + t1.sure, anlik });
    return { node: g, bitti: Promise.all([e.bitti, t1.bitti, t2.bitti]), sure: t0 + t1.sure + t2.sure };
  }

  /* ---------- ses düğmesi simgesi ---------- */

  // Kalemle çizilmiş hoparlör: açıkken ses dalgaları, kapalıyken kırmızı çarpı.
  function sesSimgesiCiz(svg, acik, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg), g = svgEl('g', null, svg), renk = AB.config.renk;
    const ok = { anlik };
    const stil = { stroke: renk.mavi, ...elKalemi() };
    K.cokgen(g, [[5, 15], [12, 15], [21, 7], [21, 33], [12, 25], [5, 25]], { ...stil, strokeWidth: 1.4 }, ['ses', 'hoparlor'], ok);
    if (acik) {
      K.egri(g, [[26, 14], [29.5, 20], [26, 26]], { ...stil, strokeWidth: 1.3 }, ['ses', 'dalga1'], { ...ok, gecikme: 120 });
      K.egri(g, [[30, 9], [36, 20], [30, 31]], { ...stil, strokeWidth: 1.3 }, ['ses', 'dalga2'], { ...ok, gecikme: 220 });
    } else {
      K.cizgi(g, [26, 14, 37, 26], { ...stil, stroke: renk.kirmizi, strokeWidth: 1.5 }, ['ses', 'x1'], { ...ok, gecikme: 120 });
      K.cizgi(g, [37, 14, 26, 26], { ...stil, stroke: renk.kirmizi, strokeWidth: 1.5 }, ['ses', 'x2'], { ...ok, gecikme: 260 });
    }
  }

  /* ---------- dizilimde sürükle-bırak yardımcıları ---------- */

  // Her gemi için görünmez bir tutamaç; dokunmada sayfa kaymasın diye touch-action: none (CSS .tutamak).
  function tutamaklariKur(T, gemiler) {
    const g = T.katman.tutamaklar;
    g.textContent = '';
    for (const gemi of gemiler) {
      svgEl('rect', {
        class: 'tutamak', 'data-gemi': gemi.id, fill: 'transparent',
        role: 'button', tabindex: 0, 'aria-describedby': 'yerlestirme-yardim',
        'aria-label': `${gemi.uzunluk} hücreli gemi, ${SUTUN_HARFLERI[gemi.hucreler[0].k]}${gemi.hucreler[0].s + 1}, ${gemi.yatay ? 'yatay' : 'dikey'}`,
        x: HUCRE * (gemi.hucreler[0].k + 1), y: HUCRE * (gemi.hucreler[0].s + 1),
        width: gemi.yatay ? HUCRE * gemi.uzunluk : HUCRE, height: gemi.yatay ? HUCRE : HUCRE * gemi.uzunluk,
      }, g);
    }
  }
  const tutamaklariKaldir = (T) => { T.katman.tutamaklar.textContent = ''; };

  // Fare/parmak konumunu tahta birimine çevirir (sayfa eğik ve ölçekli olsa da doğru).
  function noktaTahtada(T, e) {
    const m = T.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = T.svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(m.inverse());
  }

  // Sürüklenen gemi parmağı izler; üstte görünsün diye en sona alınır.
  function gemiSurukle(T, gemi, dx, dy) {
    const dis = T.gemiG[gemi.id].parentNode;
    if (dis !== dis.parentNode.lastChild) dis.parentNode.appendChild(dis);
    dis.style.transition = 'none';
    dis.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Bırakılan yer geçerliyse gemi oraya yerleşir (game.js gemiyi zaten taşımış olmalı).
  function gemiYerlestir(T, gemi) {
    const grup = T.gemiG[gemi.id], dis = grup.parentNode;
    grup.setAttribute('transform', gemiDonusumu(gemi));
    dis.style.transition = 'none';
    dis.style.transform = '';
    if (!grup._resimli) yuzCiz(T, gemi, grup.dataset.durum || 'normal', 0, true);   // dik/yatay yüz yönü
  }

  // Geçersiz yere bırakılınca gemi eski yerine kayar.
  function gemiGeriDon(T, gemi) {
    const dis = T.gemiG[gemi.id].parentNode;
    dis.style.transition = animasyonVar() ? 'transform .25s ease-out' : 'none';
    dis.style.transform = '';
  }

  // Döndürme olmadığında gemi "hayır" der gibi titrer.
  function gemiTitret(T, gemi) {
    if (!animasyonVar()) return;
    const dis = T.gemiG[gemi.id].parentNode;
    const a = dis.animate([
      { transform: 'translate(0px, 0px)' }, { transform: 'translate(-4px, 0px)' },
      { transform: 'translate(4px, 0px)' }, { transform: 'translate(-2px, 0px)' }, { transform: 'translate(0px, 0px)' },
    ], { duration: 260 });
    a.finished.catch(() => {});
  }

  // Bırakılacak yer: geçerliyse kurşun kalem, geçersizse kırmızı kalem taraması. (Anında çizilir: sürüklerken gecikmesin.)
  function hedefGoster(T, gemi, s, k, yatay, gecerli) {
    hedefSil(T);
    const g = svgEl('g', { class: 'hedef', 'pointer-events': 'none' }, T.katman.efekt);
    const L = gemi.uzunluk, renk = AB.config.renk;
    const w = (yatay ? L : 1) * HUCRE, h = (yatay ? 1 : L) * HUCRE;
    const c = gecerli ? renk.kursun : renk.kirmizi;
    T.K.dikdortgen(g, [HUCRE * (k + 1) + 2, HUCRE * (s + 1) + 2, w - 4, h - 4], {
      stroke: c, strokeWidth: 1.3,
      fill: c, fillStyle: 'hachure', hachureGap: 5, hachureAngle: -45, fillWeight: AB.config.cizim.fillWeight,
    }, ['hedef', gecerli ? 1 : 0, s, k], { anlik: true });
  }
  function hedefSil(T) {
    const g = T.katman.efekt.querySelector(':scope > .hedef');
    if (g) g.remove();
  }

  /* ---------- rakibin son atışı ve klavye odağı ---------- */

  // Benim tahtamda rakibin son atışının çevresine soluk kurşun kalem halkası; yenisi gelince eskisi silinir.
  function sonAtisIsaretle(T, s, k) {
    sonAtisSil(T);
    const g = svgEl('g', { class: 'son-atis', 'pointer-events': 'none', opacity: .75 }, T.katman.efekt);
    return T.K.daire(g, [HUCRE * (k + 1.5), HUCRE * (s + 1.5), 36],
      { stroke: AB.config.renk.kursun, strokeWidth: 1.3, ...elKalemi(1.6) }, ['son-atis', T.id, s, k]);
  }
  function sonAtisSil(T) {
    const g = T.katman.efekt.querySelector(':scope > .son-atis');
    if (g) g.remove();
  }

  // Klavyeyle seçilen hücrenin çevresine kurşun kalemle kare (anında).
  function hucreOdak(T, s, k, sinif = 'hucre-odak') {
    hucreOdakSil(T, sinif);
    const g = svgEl('g', { class: sinif, 'pointer-events': 'none' }, T.katman.efekt);
    T.K.dikdortgen(g, [HUCRE * (k + 1) + 3, HUCRE * (s + 1) + 3, HUCRE - 6, HUCRE - 6],
      { stroke: AB.config.renk.kursun, strokeWidth: 1.6 }, ['hucre-odak', s, k], { anlik: true });
  }
  function hucreOdakSil(T, sinif = 'hucre-odak') {
    const g = T.katman.efekt.querySelector(':scope > .' + sinif);
    if (g) g.remove();
  }

  /* ---------- rakip düşünürken karalama ---------- */

  // Başlığın sağ altında kurşun kalemle zikzak karalama; ~650 ms'de bir yenisi çizilir.
  function karalamaDurdur(svg) {
    if (svg._karalama) { clearInterval(svg._karalama); svg._karalama = 0; }
    const g = svg.querySelector(':scope > .karalama');
    if (g) g.remove();
  }

  // tik: her yeni zikzakta çağrılır (ses için)
  function karalamaBaslat(svg, tik) {
    karalamaDurdur(svg);
    const K = kalemYap(svg);
    const g = svgEl('g', { class: 'karalama' }, svg);
    let sayac = 0;
    const bir = () => {
      g.textContent = '';
      const r = rastgele('karalama', sayac);
      const pts = [], adet = 12;
      for (let i = 0; i <= adet; i++) {
        pts.push([250 + 180 * i / adet + aralik(r, -4, 4), 64 + (i % 2 ? 9 : -5) + aralik(r, -3, 3)]);
      }
      K.egri(g, pts, { stroke: AB.config.renk.kursun, strokeWidth: 1.5 }, ['karalama', sayac]);
      sayac++;
      if (tik) tik();
    };
    bir();
    svg._karalama = setInterval(bir, 650);
  }

  AB.draw = {
    HUCRE, karma, tohum, rastgele, animasyonVar,
    cizdir, kalemYap, kutu,
    metinSvg, harfle,
    tahtaKur, izgaraCiz, etiketYaz,
    ustSol, ustSag, durumYaz,
    dugmeCerceve, dugmeVurgu,
    zimbaCiz, susCiz,
    gemiCiz, yuzCiz, gemileriSil, hucreAtildi, isabetCiz, iskaCiz, batikCiz, batiYazisi, sonucCiz,
    karalamaBaslat, karalamaDurdur, varlikYukle, sesSimgesiCiz,
    altYaziYaz, tutamaklariKur, tutamaklariKaldir, noktaTahtada,
    gemiSurukle, gemiYerlestir, gemiGeriDon, gemiTitret, hedefGoster, hedefSil,
    dugmeOdak, klavyeOdagi, sonAtisIsaretle, sonAtisSil, hucreOdak, hucreOdakSil,
  };
})();
