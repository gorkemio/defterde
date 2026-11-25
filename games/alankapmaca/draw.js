// draw.js — rough.js ile "tükenmez kalem" çizimi. Oyun mantığını bilmez.
// Her çizim ilkeli { node, bitti, sure } döndürür:
//   node  = eklenen SVG düğümü, bitti = çizim animasyonu bitince çözülen Promise,
//   sure  = animasyonun (gecikmeden sonraki) toplam süresi, ms — art arda çizimleri zincirlemek için.
(function () {
  'use strict';

  const AB = (window.AB = window.AB || {});
  const SVG = 'http://www.w3.org/2000/svg';
  const HUCRE = 20;                               // bir oyun hücresi = 1 defter karesi, SVG birimi

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
  // Süs eğimini kaldır; dar dikdörtgenlerde gerekli olan 90° yazı yönünü koru.
  const egim = (aci) => AB.config.cizim.duzHiza ? Math.round(aci / 90) * 90 : aci;

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

  function kalemYap(svg) {
    const rc = rough.svg(svg);
    const c = AB.config.cizim;

    const secenek = (ek, anahtar) => Object.assign({
      roughness: c.roughness,
      bowing: c.bowing,
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

  // Köşelerde taşan dört çizgiden elle çizilmiş kutu (düğme çerçevesi vb.)
  function kutu(K, katman, x, y, w, h, o = {}) {
    const grup = svgEl('g', null, katman);
    const an = o.tohum || ['kutu'];
    const r = rastgele('kutu', ...an);
    const t = () => aralik(r, 1, o.tasma ?? 4);
    const j = () => {
      const kayma = aralik(r, -1, 1);
      return AB.config.cizim.duzHiza ? 0 : kayma;
    };
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
      const s = K.cizgi(grup, cz, o.cizgi || {}, ['kutu', ...an, i], { gecikme: gec, anlik: o.anlik });
      bit.push(s.bitti);
      gec += s.sure * 0.8;
    });
    return { node: grup, bitti: Promise.all(bit), sure: gec - baslangic + 60 };
  }

  /* ---------- yazı ---------- */

  // SVG el yazısı: her harf ayrı <tspan>; düz hizalı kipte kayma/dönme yok, harf harf belirme sürer.
  // o: { x, y, boyut, renk, hiza, aci, tohum:[...], gecikme, adim, anlik }
  function metinSvg(katman, yazi, o) {
    const t = svgEl('text', {
      x: o.x, y: o.y,
      'font-size': o.boyut || 26,
      fill: o.renk || AB.config.renk.mavi,
      'text-anchor': o.hiza || 'middle',
    }, katman);
    const aci = egim(o.aci || 0);
    if (aci) t.setAttribute('transform', `rotate(${aci} ${o.x} ${o.y})`);

    const r = rastgele('yazi', ...(o.tohum || [yazi]));
    let onceki = 0;
    const harfler = [];
    for (const ch of yazi) {
      const dy = (r() - .5) * 1.8;                      // dy birikimli: fark verilir
      const donus = (r() - .5) * 6;
      const ts = svgEl('tspan', {
        dy: AB.config.cizim.duzHiza ? 0 : (dy - onceki).toFixed(2),
        rotate: AB.config.cizim.duzHiza ? 0 : donus.toFixed(1),
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
        const a = ts.animate([{ fillOpacity: 0, strokeOpacity: 0 }, { fillOpacity: hedef, strokeOpacity: 1 }],
          { duration: 90, delay: (o.gecikme || 0) + i * adim, fill: 'both' });
        bit.push(a.finished.then(() => a.cancel(), () => {}));
        sure = i * adim + 90;
      });
    }
    return { node: t, bitti: Promise.all(bit), sure };
  }

  // HTML el yazısı: harf başına <span>, seed'li küçük kayma/dönme. Kelimeler bölünmez.
  function harfle(kap, yazi, o = {}) {
    yazi = yazi ?? kap.textContent.trim();
    kap.textContent = '';
    kap.setAttribute('aria-label', yazi);
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
        const kayma = ((r() - .5) * 1.6).toFixed(2), donus = ((r() - .5) * 5).toFixed(1);
        s.style.transform = AB.config.cizim.duzHiza ? 'none' : `translateY(${kayma}px) rotate(${donus}deg)`;
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

  /* ---------- sayfa başlıkları ---------- */

  function altCizgi(K, katman, x1, x2, y, an, gecikme, anlik) {   // dalgalı altı çizili çizgi
    const genis = x2 - x1;
    const pts = [[x1, y + 1], [x1 + genis * .25, y - 2], [x1 + genis * .5, y + 2], [x1 + genis * .75, y - 1.5], [x2, y + 1]];
    return K.egri(katman, pts, { strokeWidth: 1.8 }, ['altcizgi', ...an], { gecikme, anlik });
  }

  /* ---------- düğmeler ---------- */

  // Düğmenin arkasına elle çizilmiş çerçeve. Boyut değişince aynı seed'le yeniden çağrılır.
  function dugmeCerceve(btn, gecikme = 0, anlik = false) {
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) {                                        // görünmüyor: önceki turdan kalan çerçeve silinir
      const eski = btn.querySelector(':scope > svg.cerceve');
      if (eski) eski.textContent = '';
      return { bitti: Promise.resolve(), sure: 0 };
    }
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
    const cizgi = btn.dataset.murekkep === 'kirmizi' ? { stroke: AB.config.renk.kirmizi } : {};
    return kutu(K, ana, 4, 4, w - 8, h - 8, { tohum: ['dugme', btn.id], gecikme, anlik, tasma: 4, cizgi });
  }

  // Üzerine gelince/odaklanınca kalem bir kez daha üstünden geçer.
  function dugmeVurgu(btn) {
    const svg = btn.querySelector(':scope > svg.cerceve');
    if (!svg) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    const g = svg.querySelector('.vurgu');
    if (!g) return;
    g.textContent = '';
    const sayac = (parseInt(btn.dataset.vurgu || '0', 10) + 1);
    btn.dataset.vurgu = sayac;
    const K = kalemYap(svg);
    kutu(K, g, 5, 5, w - 10, h - 10, { tohum: ['vurgu', btn.id, sayac], tasma: 3, cizgi: { strokeWidth: 1.2 } });
  }

  function dugmeVurguSil(btn) {
    const g = btn.querySelector(':scope > svg.cerceve .vurgu');
    if (g) g.textContent = '';
  }

  // Klavye odağı: öğenin çevresine kurşun kalemle ikinci bir kutu (CSS outline yerine). acik=false siler.
  function odakHalkasi(el, acik) {
    let svg = el.querySelector(':scope > svg.odak-halka');
    if (!acik) { if (svg) svg.textContent = ''; return; }
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    if (!svg) { svg = svgEl('svg', { class: 'odak-halka', 'aria-hidden': 'true' }); el.appendChild(svg); }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.textContent = '';
    const K = kalemYap(svg);
    K.dikdortgen(svg, [-5, -4, w + 10, h + 8], { stroke: AB.config.renk.kursun, strokeWidth: 2.1, roughness: 1.5, bowing: 2 },
      ['odak', el.id || el.dataset.deger || '', w, h], {});
  }

  // Uçlu kalem oku: noktalar boyunca eğri, son iki noktanın yönünde iki kısa kol. ek: { stroke, strokeWidth, kol }
  function okCiz(K, g, noktalar, ek, an, o = {}) {
    const [x1, y1] = noktalar[noktalar.length - 2], [x2, y2] = noktalar[noktalar.length - 1];
    const a = Math.atan2(y2 - y1, x2 - x1), L = ek.kol || 9, gecikme = o.gecikme || 0;
    const kol = (s) => [x2, y2, x2 - L * Math.cos(a + s), y2 - L * Math.sin(a + s)];
    const stil = { stroke: ek.stroke, strokeWidth: ek.strokeWidth || 1.6 };
    return [
      K.egri(g, noktalar, stil, [...an, 'govde'], o),
      K.cizgi(g, kol(.5), stil, [...an, 'k1'], { ...o, gecikme: gecikme + 200 }),
      K.cizgi(g, kol(-.5), stil, [...an, 'k2'], { ...o, gecikme: gecikme + 260 }),
    ];
  }

  // Süsler kurşun kalemle; kendi küçük koordinat kutularında (viewBox) çizilir.
  const SUSLER = {
    gunes(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun, r = rastgele('sus', 'gunes', ...an), o = { gecikme: gec, anlik };
      const hepsi = [K.daire(g, [50, 50, 34], {
        stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 4, hachureAngle: -40, strokeWidth: 1.5,
      }, ['sus', 'gunes', 'disk', ...an], o)];
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 + aralik(r, -.08, .08);
        const r1 = 24 + aralik(r, 0, 3), r2 = 36 + aralik(r, 0, 6);
        hepsi.push(K.cizgi(g, [50 + r1 * Math.cos(a), 50 + r1 * Math.sin(a), 50 + r2 * Math.cos(a), 50 + r2 * Math.sin(a)],
          { stroke: kur, strokeWidth: 1.5 }, ['sus', 'gunes', 'isin', i, ...an], { gecikme: gec + 220 + i * 40, anlik }));
      }
      hepsi.push(K.daire(g, [44, 47, 3], { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: 1 }, ['sus', 'gunes', 'g1', ...an], o));
      hepsi.push(K.daire(g, [56, 47, 3], { stroke: kur, fill: kur, fillStyle: 'solid', strokeWidth: 1 }, ['sus', 'gunes', 'g2', ...an], o));
      hepsi.push(K.egri(g, [[43, 55], [50, 60], [57, 55]], { stroke: kur, strokeWidth: 1.4 }, ['sus', 'gunes', 'gulus', ...an], o));
      return hepsi;
    },
    kalp(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun;
      return [K.yol(g,
        'M 40 70 C 10 48, 6 20, 24 14 C 33 11, 40 18, 40 24 C 40 18, 47 11, 56 14 C 74 20, 70 48, 40 70 Z',
        { stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 4, hachureAngle: 50, strokeWidth: 1.5 },
        ['sus', 'kalp', ...an], { gecikme: gec, anlik })];
    },
    ok(K, g, gec, an, anlik) {
      return okCiz(K, g, [[6, 46], [30, 14], [62, 16], [88, 38]], { stroke: AB.config.renk.kursun, kol: 16 }, ['sus', 'ok', ...an], { gecikme: gec, anlik });
    },
    yildiz(K, g, gec, an, anlik) {
      const kur = AB.config.renk.kursun, r = rastgele('sus', 'yildiz', ...an);
      const donuk = aralik(r, -.3, .3), pts = [];
      for (let i = 0; i < 10; i++) {
        const yaricap = i % 2 ? 7.5 : 17, a = -Math.PI / 2 + donuk + i * Math.PI / 5;
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

  // assets/varliklar.js içindeki liste (AB.varliklar = ['zar-3.png', ...]) yüklenir. Bir dosya
  // yoksa ya da açılamazsa yalnız o parça için prosedürel SVG çizilmeye devam eder.
  const varlik = {};                                       // 'zar-3' -> HTMLImageElement

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

  /* ---------- ses düğmesi simgesi ---------- */

  // Kalemle çizilmiş hoparlör: açıkken ses dalgaları, kapalıyken kırmızı çarpı.
  function sesSimgesiCiz(svg, acik, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg), g = svgEl('g', null, svg), renk = AB.config.renk;
    const ok = { anlik };
    K.cokgen(g, [[5, 15], [12, 15], [21, 7], [21, 33], [12, 25], [5, 25]], { stroke: renk.mavi, strokeWidth: 1.7 }, ['ses', 'hoparlor'], ok);
    if (acik) {
      K.egri(g, [[26, 14], [29.5, 20], [26, 26]], { stroke: renk.mavi, strokeWidth: 1.6 }, ['ses', 'dalga1'], { ...ok, gecikme: 120 });
      K.egri(g, [[30, 9], [36, 20], [30, 31]], { stroke: renk.mavi, strokeWidth: 1.6 }, ['ses', 'dalga2'], { ...ok, gecikme: 220 });
    } else {
      K.cizgi(g, [26, 14, 37, 26], { stroke: renk.kirmizi, strokeWidth: 1.9 }, ['ses', 'x1'], { ...ok, gecikme: 120 });
      K.cizgi(g, [37, 14, 26, 26], { stroke: renk.kirmizi, strokeWidth: 1.9 }, ['ses', 'x2'], { ...ok, gecikme: 260 });
    }
  }

  /* ======================================================================
     Alan Kapmaca'ya özgü çizimler
     ====================================================================== */

  const renkDeger = (ad) => AB.config.renk[ad] || ad;
  // Sayfanın kâğıt rengi (style.css --kagit); çizimdeki dolgular kâğıtla aynı tonda kalsın.
  const kagitRengi = () => (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--kagit').trim()) || '#fbf9f2';
  const bitenler = (liste) => Promise.all(liste.map(c => c.bitti));

  /* ---------- formül karalaması (köşe süsü) ---------- */

  SUSLER.formul = function (K, g, gec, an, anlik) {
    return [metinSvg(g, 'alan = en × boy', {
      x: 2, y: 22, boyut: 21, renk: AB.config.renk.kursun, hiza: 'start', aci: -1.2,
      tohum: ['sus', 'formul', ...an], gecikme: gec, anlik,
    })];
  };

  /* ---------- tahta ---------- */

  // Boş tahta iskeleti: katmanlar + tek şeffaf dokunma hedefi. 1 hücre = HUCRE (20) birim = 1 defter karesi.
  function tahtaKur(svg, n) {
    const boy = HUCRE * n;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${boy} ${boy}`);
    const katman = {};
    for (const ad of ['cerceve', 'dikdortgenler', 'hayalet', 'efekt', 'dokunma']) {
      katman[ad] = svgEl('g', { class: ad }, svg);
    }
    // fill="none" olsaydı iç alan olay yakalamazdı
    svgEl('rect', { class: 'hedef', x: 0, y: 0, width: boy, height: boy, fill: 'transparent' }, katman.dokunma);
    return { svg, n, boy, K: kalemYap(svg), katman };
  }

  // Tahta sınırı: köşelerde taşan dört çizgi, üstünden bir kez daha ince geçiş (basılı karelere oturur).
  function cerceveCiz(T, gecikme = 0, anlik = false) {
    const a = kutu(T.K, T.katman.cerceve, 0, 0, T.boy, T.boy,
      { tohum: ['cerceve', T.n, 1], gecikme, anlik, tasma: 6, cizgi: { strokeWidth: 2.1 } });
    const b = kutu(T.K, T.katman.cerceve, 0, 0, T.boy, T.boy,
      { tohum: ['cerceve', T.n, 2], gecikme: gecikme + a.sure * .7, anlik, tasma: 4, cizgi: { strokeWidth: 1.1 } });
    return { node: T.katman.cerceve, bitti: Promise.all([a.bitti, b.bitti]), sure: a.sure * .7 + b.sure };
  }

  /* ---------- zar ---------- */

  const ZAR_PIPLERI = {
    1: [[22, 22]],
    2: [[14, 14], [30, 30]],
    3: [[14, 14], [22, 22], [30, 30]],
    4: [[14, 14], [30, 14], [14, 30], [30, 30]],
    5: [[14, 14], [30, 14], [22, 22], [14, 30], [30, 30]],
    6: [[14, 13], [14, 22], [14, 31], [30, 13], [30, 22], [30, 31]],
  };
  const ZAR_GOVDE = 'M 11 4 L 33 4 C 38 4 40 6 40 11 L 40 33 C 40 38 38 40 33 40 L 11 40 C 6 40 4 38 4 33 L 4 11 C 4 6 6 4 11 4 Z';
  const ZAR_GOLGE = 'M 8 43 L 33 43 C 41 43 43 41 43 33 L 43 10';

  // Karalama zar (44×44 kutu): yuvarlak köşeli gövde iki geçişle, pipler elle taranmış küçük daireler.
  // 7–12 yüzleri (ya da o.rakam) pip yerine el yazısı rakamla gösterilir. zar-N.png varsa o kullanılır.
  // o: { renk, tohum:[...], rakam, gecikme, anlik }
  function zarCiz(svg, deger, o = {}) {
    if (!o._yuvarlama) svg._yuvarla = (svg._yuvarla || 0) + 1;   // dışarıdan çizim süren yuvarlamayı durdurur
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 44 44');
    if (varlik['zar-' + deger]) return resimEkle(svg, 'zar-' + deger, 0, 0, 44, 44, o);

    const gecikme = o.gecikme || 0, anlik = o.anlik;
    const K = kalemYap(svg), ink = renkDeger(o.renk || 'mavi');
    const an = ['zar', deger, ...(o.tohum || [])];
    const r = rastgele(...an);
    const g = svgEl('g', { transform: `rotate(${egim(aralik(r, -7, 7)).toFixed(1)} 22 22)` }, svg);

    const parcalar = [];
    parcalar.push(K.yol(g, ZAR_GOLGE, { stroke: AB.config.renk.kursun, strokeWidth: 1.1 }, [...an, 'golge'], { gecikme, anlik }));
    const c1 = K.yol(g, ZAR_GOVDE, { stroke: ink, strokeWidth: 1.6, roughness: 1 }, [...an, 'c1'], { gecikme, anlik });
    const c2 = K.yol(g, ZAR_GOVDE, { stroke: ink, strokeWidth: .65, roughness: 1.1 }, [...an, 'c2'], { gecikme: gecikme + c1.sure * .6, anlik });
    parcalar.push(c1, c2);

    const t = gecikme + (c1.sure + c2.sure) * .6;
    if (deger == null) {
      parcalar.push(metinSvg(g, '?', {
        x: 22, y: 31, boyut: 26, renk: AB.config.renk.kursun, aci: aralik(r, -6, 6), tohum: [...an, 'soru'], gecikme: t, anlik,
      }));
    } else if (o.rakam || deger > 6) {
      parcalar.push(metinSvg(g, String(deger), {
        x: 22, y: 31, boyut: 27, renk: ink, aci: aralik(r, -6, 6), tohum: [...an, 'rakam'], gecikme: t, anlik,
      }));
    } else {
      ZAR_PIPLERI[deger].forEach(([x, y], i) => {
        parcalar.push(K.daire(g, [x + aralik(r, -1.2, 1.2), y + aralik(r, -1.2, 1.2), 6.4],
          { stroke: ink, strokeWidth: 1.1, roughness: 1, fill: ink, fillStyle: 'hachure', hachureGap: 1.7, hachureAngle: aralik(r, 20, 70) },
          [...an, 'pip', i], { gecikme: t + i * 70, anlik }));
      });
    }
    return { node: g, bitti: bitenler(parcalar), sure: t - gecikme + 300 };
  }

  /* ---------- rakip karakter: tombul hesap makinesi ---------- */

  const TUSLAR = ['7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '=', '÷'];
  const KARAKTER_GOVDE = 'M 20 6 L 80 6 C 92 6 97 12 97 24 L 97 106 C 97 118 92 122 80 122 L 20 122 C 8 122 3 118 3 106 L 3 24 C 3 12 8 6 20 6 Z';

  // 100×140 kutu. Gövde bir kez çizilir; durum değişince yalnız yüz ve kollar yenilenir.
  // durum: 'normal' | 'dusunuyor' | 'saskin' | 'sevincli' | 'uzgun'. rakip-<durum>.png varsa o kullanılır.
  function karakterCiz(svg, durum = 'normal', o = {}) {
    const ink = AB.config.renk.kirmizi, anlik = o.anlik;
    const resimAdi = ['rakip-' + durum, 'rakip-normal'].find(a => varlik[a]);
    if (resimAdi) {
      svg.textContent = '';
      svg.setAttribute('viewBox', '0 0 100 140');
      return resimEkle(svg, resimAdi, 0, 0, 100, 140, o);
    }

    const bit = [];
    let t = o.gecikme || 0;
    let govde = svg.querySelector(':scope > .govde');
    if (!govde) {
      svg.textContent = '';
      svg.setAttribute('viewBox', '0 0 100 140');
      govde = svgEl('g', { class: 'govde' }, svg);
      svgEl('g', { class: 'kollar' }, svg);
      svgEl('g', { class: 'yuz' }, svg);
      svg._K = kalemYap(svg);
      const K = svg._K;

      // soluk kırmızı tarama (135°) + kalın dış çizgi
      const dolgu = svgEl('g', { opacity: .5 }, govde);
      bit.push(K.yol(dolgu, KARAKTER_GOVDE, { stroke: 'none', fill: ink, fillStyle: 'hachure', hachureAngle: 135, hachureGap: 6 }, ['kar', 'dolgu'], { gecikme: t, anlik }));
      const dis = K.yol(govde, KARAKTER_GOVDE, { stroke: ink, strokeWidth: 1.9 }, ['kar', 'govde'], { gecikme: t, anlik });
      bit.push(dis);
      t += dis.sure * .7;

      // bacaklar ve ayaklar
      [[36, 122, 34, 136], [34, 136, 26, 137], [64, 122, 66, 136], [66, 136, 74, 137]].forEach((c, i) => {
        bit.push(K.cizgi(govde, c, { stroke: ink, strokeWidth: 1.6 }, ['kar', 'bacak', i], { gecikme: t + i * 40, anlik }));
      });

      // ekran (kâğıt renginde, tarama üstüne biner) ve 4×4 tuş
      bit.push(K.dikdortgen(govde, [18, 14, 64, 36], { stroke: ink, strokeWidth: 1.5, fill: '#f1ecda', fillStyle: 'solid' }, ['kar', 'ekran'], { gecikme: t, anlik }));
      TUSLAR.forEach((tus, i) => {
        const x = 14 + (i % 4) * 19, y = 58 + Math.floor(i / 4) * 14, g0 = t + 120 + i * 25;
        bit.push(K.dikdortgen(govde, [x, y, 15, 10], { stroke: ink, strokeWidth: 1, roughness: .8 }, ['kar', 'tus', i], { gecikme: g0, anlik }));
        bit.push(metinSvg(govde, tus, { x: x + 7.5, y: y + 8, boyut: 9, renk: ink, tohum: ['kar', 'tus', i], gecikme: g0, anlik, adim: 0 }));
      });
      t += 450;
    }

    const K = svg._K, kol = svg.querySelector(':scope > .kollar'), yuz = svg.querySelector(':scope > .yuz');
    kol.textContent = '';
    yuz.textContent = '';
    const an = ['kar', durum];
    const cizgi = (ek = {}) => ({ stroke: ink, strokeWidth: 1.5, roughness: .9, ...ek });
    const yg = (d) => ({ gecikme: t + d, anlik });
    const nokta = (x, y, cap, i) => K.daire(yuz, [x, y, cap], cizgi({ fill: ink, fillStyle: 'solid', strokeWidth: 1 }), [...an, 'n', i], yg(i * 40));

    // yüz (ekranın içi: x 18–82, y 14–50)
    if (durum === 'dusunuyor') {
      [38, 62].forEach((x, i) => {
        bit.push(K.daire(yuz, [x, 28, 9], cizgi({ strokeWidth: 1.2 }), [...an, 'g', i], yg(i * 40)));
        bit.push(nokta(x + 2, 26, 3.6, i + 2));
      });
      bit.push(K.egri(yuz, [[42, 41], [46, 38.5], [50, 41], [54, 38.5], [58, 41]], cizgi(), [...an, 'agiz'], yg(120)));
    } else if (durum === 'saskin') {
      [38, 62].forEach((x, i) => {
        bit.push(K.daire(yuz, [x, 30, 11], cizgi({ strokeWidth: 1.2 }), [...an, 'g', i], yg(i * 40)));
        bit.push(nokta(x, 30, 3.4, i + 2));
        bit.push(K.egri(yuz, [[x - 8, 20], [x, 16], [x + 8, 20]], cizgi({ strokeWidth: 1.3 }), [...an, 'k', i], yg(80 + i * 40)));
      });
      bit.push(K.daire(yuz, [50, 43, 7], cizgi({ strokeWidth: 1.4 }), [...an, 'agiz'], yg(160)));
    } else if (durum === 'sevincli') {
      bit.push(K.egri(yuz, [[31, 31], [38, 24], [45, 31]], cizgi({ strokeWidth: 1.8 }), [...an, 'g1'], yg(0)));
      bit.push(K.egri(yuz, [[55, 31], [62, 24], [69, 31]], cizgi({ strokeWidth: 1.8 }), [...an, 'g2'], yg(40)));
      bit.push(K.yol(yuz, 'M 38 36 C 42 49, 58 49, 62 36 Z', cizgi({ fill: ink, fillStyle: 'solid' }), [...an, 'agiz'], yg(100)));
    } else if (durum === 'uzgun') {
      bit.push(nokta(38, 30, 5.2, 0), nokta(62, 30, 5.2, 1));
      bit.push(K.cizgi(yuz, [30, 26, 44, 21], cizgi({ strokeWidth: 1.3 }), [...an, 'k1'], yg(80)));
      bit.push(K.cizgi(yuz, [56, 21, 70, 26], cizgi({ strokeWidth: 1.3 }), [...an, 'k2'], yg(110)));
      bit.push(K.egri(yuz, [[40, 44], [50, 38], [60, 44]], cizgi(), [...an, 'agiz'], yg(140)));
      bit.push(K.yol(yuz, 'M 71 36 C 74 40, 74 43, 71 44 C 68 43, 68 40, 71 36 Z', cizgi({ strokeWidth: 1.1 }), [...an, 'gozyasi'], yg(200)));
    } else {
      bit.push(nokta(38, 28, 5.2, 0), nokta(62, 28, 5.2, 1));
      bit.push(K.egri(yuz, [[39, 38], [50, 44], [61, 38]], cizgi(), [...an, 'agiz'], yg(100)));
    }

    // kollar
    const kollar = {
      normal:    [[[6, 64], [-4, 76], [-2, 92]], [[94, 64], [104, 76], [102, 92]]],
      dusunuyor: [[[6, 64], [-4, 76], [-2, 92]], [[94, 64], [106, 54], [88, 46]]],
      sevincli:  [[[6, 56], [-6, 42], [0, 28]], [[94, 56], [106, 42], [100, 28]]],
      saskin:    [[[6, 60], [-6, 50], [-4, 36]], [[94, 60], [106, 50], [104, 36]]],
      uzgun:     [[[6, 64], [-1, 78], [2, 90]], [[94, 64], [101, 78], [98, 90]]],
    }[durum] || [];
    kollar.forEach((pts, i) => bit.push(K.egri(kol, pts, cizgi({ strokeWidth: 1.6 }), [...an, 'kol', i], yg(i * 60))));

    return { node: svg, bitti: bitenler(bit), sure: 900 };
  }

  /* ---------- düşünme baloncuğu ---------- */

  const BALON_BULUT = 'M 25 44 C 5 44, 3 26.4, 22 24.8 C 20 9.6, 48 4.8, 58 17.6 C 66 6.4, 96 9.6, 94 27.2 C 112 25.6, 115 44.8, 95 44 Z';

  // Kurşun kalem karalaması (zikzak). sayfa her yenilemede başka bir tohumla çizilir.
  function balonKaralama(svg, sayac = 0, o = {}) {
    let g = svg.querySelector(':scope > .karalama');
    if (!g) g = svgEl('g', { class: 'karalama' }, svg);
    g.textContent = '';
    const K = svg._K || (svg._K = kalemYap(svg)), r = rastgele('balon', 'karalama', sayac);
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push([34 + 48 * i / 10 + aralik(r, -2, 2), 27 + (i % 2 ? 6 : -6) + aralik(r, -2, 2)]);
    return K.egri(g, pts, { stroke: AB.config.renk.kursun, strokeWidth: 1.4, roughness: 1.8 }, ['balon', 'karalama', sayac], o);
  }

  // Bulut biçimli baloncuk + iki küçük daire (kuyruk) + içinde karalama. 120×60 kutu.
  function balonCiz(svg, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 120 60');
    svg._K = kalemYap(svg);
    const K = svg._K, kur = AB.config.renk.kursun, gecikme = o.gecikme || 0, anlik = o.anlik;
    const g = svgEl('g', null, svg);
    const bulut = K.yol(g, BALON_BULUT, { stroke: kur, strokeWidth: 1.5 }, ['balon', 'bulut'], { gecikme, anlik });
    const d1 = K.daire(g, [84, 50, 6.5], { stroke: kur, strokeWidth: 1.3 }, ['balon', 'd1'], { gecikme: gecikme + bulut.sure * .8, anlik });
    const d2 = K.daire(g, [92, 57, 4], { stroke: kur, strokeWidth: 1.2 }, ['balon', 'd2'], { gecikme: gecikme + bulut.sure * .8 + 80, anlik });
    const kr = balonKaralama(svg, o.sayac || 0, { gecikme: gecikme + bulut.sure, anlik });
    return { node: g, bitti: bitenler([bulut, d1, d2, kr]), sure: bulut.sure + 400 };
  }

  /* ---------- zar yuvarlama ---------- */

  // Zar yuvarlanır: yüzler hızla değişir (aralık uzar), kutu sallanır, sonunda son yüz kalemle çizilir.
  // o: { aralik:[en az, en çok], rakam, tohum, sure (ms), gecikme }. Döner Promise (son yüz çizilince çözülür).
  // Yuvarlama kimliği SVG'de tutulur: bu sırada dışarıdan zarCiz çağrılırsa (yeni oyun, yeniden çizim) döngü durur.
  function zarYuvarla(svg, son, o = {}) {
    const [en, cok] = o.aralik || [1, 6];
    const kap = svg.parentNode;
    const kimlik = (svg._yuvarla = (svg._yuvarla || 0) + 1);
    const cizSon = () => zarCiz(svg, son, { rakam: o.rakam, tohum: o.tohum, _yuvarlama: true }).bitti;
    if (!animasyonVar()) return Promise.resolve(cizSon());

    const sure = o.sure || 520 + Math.random() * 280;
    const sallan = kap.animate([
      { transform: 'rotate(0deg) translateY(0px)' },
      { transform: 'rotate(-16deg) translateY(-4px)', offset: .25 },
      { transform: 'rotate(12deg) translateY(1px)', offset: .5 },
      { transform: 'rotate(-7deg) translateY(0px)', offset: .75 },
      { transform: 'rotate(0deg) translateY(0px)' },
    ], { duration: sure, easing: 'ease-out', delay: o.gecikme || 0 });
    sallan.finished.catch(() => {});

    return new Promise((coz) => {
      let gecen = 0, arada = 55, onceki = -1, i = 0;
      const adim = () => {
        if (svg._yuvarla !== kimlik) { sallan.cancel(); coz(); return; }     // iptal edildi
        if (gecen >= sure) { cizSon().then(coz); return; }
        let yuz;
        do { yuz = en + Math.floor(Math.random() * (cok - en + 1)); } while (yuz === onceki && cok > en);
        onceki = yuz;
        zarCiz(svg, yuz, { rakam: o.rakam, anlik: true, tohum: ['yuvarla', i++], _yuvarlama: true });
        const bekle = arada;
        gecen += bekle;
        arada = Math.min(arada * 1.2, 150);
        setTimeout(adim, bekle);
      };
      setTimeout(adim, o.gecikme || 0);
    });
  }

  /* ---------- tahtada dikdörtgenler ---------- */

  // Fare/parmak konumunu tahta birimine çevirir (sayfa eğik ve ölçekli olsa da doğru).
  function noktaTahtada(T, e) {
    const m = T.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = T.svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(m.inverse());
  }

  // İçine ne yazılır: sığıyorsa "en×boy=alan" (köşedeki "alan = en × boy" notuyla aynı sıra), değilse yalnız
  // "20"; dar ve uzunsa dik yazılır.
  function etiketBicimi(d) {
    const W = d.w * HUCRE - 6, H = d.h * HUCRE - 6;
    const tam = `${d.w}×${d.h}=${d.alan}`, kisa = String(d.alan);
    const genislik = (yazi, boyut) => yazi.length * boyut * .52;
    let boyut = Math.min(16, H / 1.15);
    if (genislik(tam, boyut) <= W) return { yazi: tam, boyut, don: false };
    if (genislik(kisa, boyut) <= W) return { yazi: kisa, boyut, don: false };
    boyut = Math.min(16, W / 1.15);
    if (boyut >= 8 && genislik(kisa, boyut) <= H) return { yazi: kisa, boyut, don: true };
    return { yazi: kisa, boyut: Math.max(8, Math.min(W / (kisa.length * .52), H / 1.15)), don: false };
  }

  // Dikdörtgen: sahibinin mürekkebiyle kenar + seyrek tarama (ben 45°, rakip 135°) + el yazısı etiket.
  // d: oyun.dikdortgenler öğesi. o: { tohum:[...], gecikme, anlik }
  function dikdortgenCiz(T, d, o = {}) {
    const ink = renkDeger(d.sahip === 'ben' ? 'mavi' : 'kirmizi');
    const gecikme = o.gecikme || 0, anlik = o.anlik;
    const x = d.k * HUCRE, y = d.s * HUCRE, W = d.w * HUCRE, H = d.h * HUCRE;
    const g = svgEl('g', { class: 'dik', 'data-id': d.id }, T.katman.dikdortgenler);
    const an = ['dik', ...(o.tohum || []), d.s, d.k, d.w, d.h];
    const kutu4 = [x + 1.5, y + 1.5, W - 3, H - 3];

    const cerceve = T.K.dikdortgen(g, kutu4, { stroke: ink, strokeWidth: 1.9 }, [...an, 'cerceve'], { gecikme, anlik });
    const tarama = svgEl('g', { opacity: .55 }, g);
    const t1 = gecikme + cerceve.sure * .8;
    const dolgu = T.K.dikdortgen(tarama, kutu4,
      { stroke: 'none', fill: ink, fillStyle: 'hachure', hachureAngle: d.sahip === 'ben' ? 45 : 135, hachureGap: AB.config.cizim.hachureGap },
      [...an, 'dolgu'], { gecikme: t1, anlik });

    const e = etiketBicimi(d), r = rastgele(...an, 'yazi');
    const cx = x + W / 2, cy = y + H / 2;
    const yazi = metinSvg(g, e.yazi, Object.assign(e.don
      ? { x: cx + e.boyut * .33, y: cy, boyut: e.boyut, aci: -90 + aralik(r, -2, 2) }
      : { x: cx, y: cy + e.boyut * .33, boyut: e.boyut, aci: aralik(r, -2.5, 2.5) },
      { renk: ink, tohum: [...an, 'e'], gecikme: t1 + dolgu.sure * .6, anlik }));
    return { node: g, bitti: bitenler([cerceve, dolgu, yazi]), sure: t1 - gecikme + dolgu.sure * .6 + yazi.sure };
  }

  // Hayalet: kurşun kalem kesikli dikdörtgen (içinde "en×boy"); geçersizse üstüne kırmızı karalama X.
  // Anında çizilir; yalnız hücre/yön değişince çağrılır. Aynı konum aynı çizgiyi üretir.
  function hayaletSil(T) { T.katman.hayalet.textContent = ''; }

  function hayaletGoster(T, s, k, w, h, gecerli, yazi) {
    hayaletSil(T);
    const g = svgEl('g', { class: 'hayalet-ic', 'pointer-events': 'none' }, T.katman.hayalet);
    const x = k * HUCRE, y = s * HUCRE, W = w * HUCRE, H = h * HUCRE, renk = AB.config.renk;
    const an = ['hayalet', s, k, w, h];
    T.K.dikdortgen(g, [x + 1.5, y + 1.5, W - 3, H - 3],
      { stroke: renk.kursun, strokeWidth: 1.3, roughness: 1.4, strokeLineDash: [5, 4] }, an, { anlik: true });
    if (yazi) {
      const boyut = Math.max(9, Math.min(15, H / 1.3, W / (yazi.length * .52)));
      metinSvg(g, yazi, { x: x + W / 2, y: y + H / 2 + boyut * .33, boyut, renk: renk.kursun, tohum: ['hayalet', yazi], anlik: true });
    }
    if (!gecerli) {
      const x1 = T.K.cizgi(g, [x + 3, y + 3, x + W - 3, y + H - 3], { stroke: renk.kirmizi, strokeWidth: 2, roughness: 2.5 }, [...an, 'x1'], { anlik: true });
      const x2 = T.K.cizgi(g, [x + W - 3, y + 3, x + 3, y + H - 3], { stroke: renk.kirmizi, strokeWidth: 2, roughness: 2.5 }, [...an, 'x2'], { anlik: true });
      return [x1, x2];
    }
    return [];
  }

  /* ---------- sol marj: çetele ve hesap sütunu ---------- */

  // SEN / MAKİNE başlıkları, altlarında kalem çizgisi; ikisi arasında kurşun kalem ayracı.
  // Her bölüm: başlık (0–26) · çetele (30'dan, 1–3 satır beşerli grup) · hesap satırları (ayraca kadar).
  // o: { genis, yuk } (birim; 1 kare = 20 birim), gecikme, anlik
  function ceteleKur(svg, o) {
    const { genis, yuk } = o, gecikme = o.gecikme || 0, anlik = o.anlik;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${genis} ${yuk}`);
    const K = svg._K = kalemYap(svg), renk = AB.config.renk;
    const yari = yuk / 2, orta = genis / 2, boyut = genis < 60 ? 14 : 17;
    const dar = genis < 60, satirAraligi = dar ? 44 : 15;
    const hedefSatir = yari >= 190 ? 3 : 2;
    // Başlık, bir hesap kaydı ve ayraç için yer ayır; kısa sütunda çetele bir satırdır.
    const ceteleSatir = dar ? Math.min(hedefSatir, Math.max(1, Math.floor((yari - 30 - satirAraligi - 12) / 17))) : hedefSatir;
    const hesapBas = 30 + ceteleSatir * 17 + (dar ? 0 : 6);
    svg._duzen = {
      genis, yuk, yari, ceteleSatir, hesapBas, dar, satirAraligi,
      kapasite: Math.max(dar ? 1 : 2, Math.floor((yari - hesapBas - 12) / satirAraligi)), yaziBoyut: dar ? 12 : 14,
    };
    svg._fazla = { ben: null, rakip: null };
    svg._hesap = {
      ben: { satirlar: [], toplam: 0, onceki: null },
      rakip: { satirlar: [], toplam: 0, onceki: null },
    };

    const bolum = (ad, yazi, ink, y0, g0, aci) => {
      const t = metinSvg(svg, yazi, { x: orta, y: y0 + 18, boyut, renk: ink, aci, tohum: ['hesap', ad], gecikme: g0, anlik, adim: 40 });
      const w = t.node.getComputedTextLength() || 40;
      const c = K.egri(svg, [[orta - w / 2 - 2, y0 + 24], [orta - w / 4, y0 + 26], [orta + w / 4, y0 + 23], [orta + w / 2 + 2, y0 + 25]],
        { stroke: ink, strokeWidth: 1.4 }, ['hesap', 'alt', ad], { gecikme: g0 + t.sure * .8, anlik });
      return [t, c];
    };
    const parcalar = [
      ...bolum('ben', 'SEN', renk.mavi, 0, gecikme, -2),
      ...bolum('rakip', 'MAKİNE', renk.kirmizi, yari, gecikme + 200, 1.5),
      K.cizgi(svg, [2, yari - (dar ? 4 : 8), genis - 2, yari - (dar ? 6 : 10)], { stroke: renk.kursun, strokeWidth: 1.1 }, ['hesap', 'ayrac'], { gecikme: gecikme + 150, anlik }),
    ];
    return { bitti: bitenler(parcalar), sure: 600 };
  }

  // Çetele: n. dikdörtgen için bir çizgi; beşinci çizgi dördünü çapraz keser.
  function ceteleEkle(svg, sahip, n, o = {}) {
    const d = svg._duzen, K = svg._K, renk = AB.config.renk;
    const ink = sahip === 'ben' ? renk.mavi : renk.kirmizi;
    const ARA = 17;                                         // grup başlangıçları arası
    const satirdaGrup = Math.max(1, Math.floor((d.genis - 6) / ARA));
    const m = n - 1, grup = Math.floor(m / 5), i = m % 5;
    const satir = Math.floor(grup / satirdaGrup), sutun = grup % satirdaGrup;
    if (satir >= d.ceteleSatir) {                          // çeteleye yer kalmadı: son satırın sonuna "+N"
      const fazla = n - d.ceteleSatir * satirdaGrup * 5;
      if (svg._fazla[sahip]) svg._fazla[sahip].remove();
      const g = svg._fazla[sahip] = svgEl('g', { class: 'fazla' }, svg);
      const y = (sahip === 'ben' ? 0 : d.yari) + 30 + (d.ceteleSatir - 1) * ARA + 12;
      return metinSvg(g, '+' + fazla, { x: d.genis - 2, y, boyut: 11, renk: ink, hiza: 'end', tohum: ['fazla', sahip, fazla], anlik: o.anlik });
    }
    const gx = 4 + sutun * ARA, gy = (sahip === 'ben' ? 0 : d.yari) + 30 + satir * ARA;
    const r = rastgele('cetele', sahip, n), j = () => aralik(r, -.8, .8);
    const cizgi = i < 4
      ? [gx + i * 3.6 + j(), gy + j(), gx + i * 3.6 + j(), gy + 13 + j()]
      : [gx - 2 + j(), gy + 10 + j(), gx + 15 + j(), gy + 2 + j()];
    return K.cizgi(svg, cizgi, { stroke: ink, strokeWidth: 1.6 }, ['cetele', sahip, n], o);
  }

  // Hesap sütunu: yeni satır "+20 ... 84"; önceki toplamın üstü çizilir. Sütun dolunca eski satırlar
  // solar, ilk satıra kurşun kalemle "…84" (devir) yazılır.
  // ekle: '+20' | 'pas' | 'yanlış' | 'süre'; yeni: yeni toplam ya da null (toplam değişmezse).
  function hesapYaz(svg, sahip, ekle, yeni, o = {}) {
    const d = svg._duzen, K = svg._K, st = svg._hesap[sahip], renk = AB.config.renk;
    const ink = sahip === 'ben' ? renk.mavi : renk.kirmizi;
    const anlik = o.anlik, boyut = d.yaziBoyut, SATIR = d.satirAraligi;
    const y0 = (sahip === 'ben' ? 0 : d.yari) + d.hesapBas;
    const satirY = (i) => y0 + i * SATIR + 12;
    const hizli = !animasyonVar() || anlik;
    const parcalar = [];
    const baslangic = o.gecikme || 0;
    let t = baslangic;

    if (st.satirlar.length >= d.kapasite) {                 // devir
      for (const s of st.satirlar.splice(0)) {
        if (hizli) s.g.remove();
        else { const a = s.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }); a.finished.then(() => s.g.remove(), () => s.g.remove()); }
      }
      st.onceki = null;
      if (st.toplam && d.kapasite > 1) {
        const g = svgEl('g', { class: 'satir' }, svg), y = satirY(0);
        const m = metinSvg(g, '…' + st.toplam, { x: d.genis - 3, y, boyut, renk: renk.kursun, hiza: 'end', aci: -1, tohum: ['hesap', sahip, 'devir', st.toplam], gecikme: t, anlik });
        st.satirlar.push({ g, y });
        st.onceki = { g, y, w: m.node.getComputedTextLength() };
        parcalar.push(m);
        t += m.sure * .7;
      }
    }

    if (yeni != null && st.onceki) {                        // eski toplamın üstünü çiz
      const p = st.onceki;
      const c = K.cizgi(p.g, [d.genis - 3 - p.w - 2, p.y - 4, d.genis - 1, p.y - 8],
        { stroke: ink, strokeWidth: 1.4 }, ['hesap', sahip, 'sil', st.satirlar.length], { gecikme: t, anlik });
      parcalar.push(c);
      t += c.sure * .8;
    }

    const g = svgEl('g', { class: 'satir' }, svg);
    const i = st.satirlar.length, y = satirY(i);
    const soluk = !ekle.startsWith('+');                   // pas · yanlış · süre: kurşun kalem
    const e = metinSvg(g, ekle, {
      x: 3, y, boyut, renk: soluk ? renk.kursun : ink, hiza: 'start', aci: -1.5 + (i % 2) * 2,
      tohum: ['hesap', sahip, i, ekle, st.toplam], gecikme: t, anlik,
    });
    parcalar.push(e);
    t += e.sure * .7;
    st.satirlar.push({ g, y });
    if (yeni != null) {
      // Dar çetelede artış ve üç basamaklı toplam aynı satıra sığmaz.
      const toplamY = y + (d.dar ? 22 : 0);
      const m = metinSvg(g, String(yeni), {
        x: d.genis - 3, y: toplamY, boyut: boyut + 1, renk: ink, hiza: 'end', aci: -1,
        tohum: ['hesap', sahip, i, 'toplam', yeni], gecikme: t, anlik,
      });
      st.toplam = yeni;
      st.onceki = { g, y: toplamY, w: m.node.getComputedTextLength() };
      parcalar.push(m);
      t += m.sure;
    }
    return { bitti: bitenler(parcalar), sure: t - baslangic };
  }

  /* ---------- düşünme baloncuğu: karalama döngüsü ---------- */

  function balonDurdur(svg) {
    if (svg._karalama) { clearInterval(svg._karalama); svg._karalama = 0; }
  }

  // Baloncuk çizilir, içindeki karalama ~650 ms'de bir yenilenir. tik: her yeni zikzakta çağrılır (ses için).
  function balonBaslat(svg, tik) {
    balonDurdur(svg);
    balonCiz(svg);
    let sayac = 1;
    svg._karalama = setInterval(() => { balonKaralama(svg, sayac++); if (tik) tik(); }, 650);
  }

  /* ---------- çarpım sorusu: cevap yazısı ve işaretler ---------- */

  // Karalama kutuya biner; doğru cevap tiki CSS ile kutunun dışındaki ayrı alana yerleşir.
  function isaretKatmani(kap) {
    let svg = kap.querySelector(':scope > svg.isaret');
    if (!svg) svg = svgEl('svg', { class: 'isaret', 'aria-hidden': 'true' }, kap);
    const w = kap.offsetWidth, h = kap.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    return { svg, w, h };
  }

  function isaretTemizle(kap) {
    const s = kap.querySelector(':scope > svg.isaret');
    if (s) { s.textContent = ''; s.classList.remove('dogru'); }
    const y = kap.querySelector(':scope > .yanit');
    if (y) y.textContent = '';
  }

  // Kırmızı el yazısı: konum 'ic' = kutunun içine (rakibin cevabı), 'ust' = yanlış cevabın üstüne (düzeltme).
  function cevapYaz(kap, yazi, konum = 'ic', o = {}) {
    let y = kap.querySelector(':scope > .yanit');
    if (!y) {
      y = document.createElement('span');
      y.setAttribute('aria-hidden', 'true');
      kap.appendChild(y);
    }
    y.className = 'yanit ' + konum;
    return harfle(y, yazi, Object.assign({ tohum: ['yanit', yazi, konum], adim: 70 }, o));
  }

  // sonuc: 'dogru' (mavi tik) | 'yanlis' (kırmızı karalama) | 'ceza' / 'affedildi' (karalama + doğru cevap kırmızıyla üstüne)
  function cevapIsaretle(kap, sonuc, dogruCevap, o = {}) {
    const { svg, w, h } = isaretKatmani(kap);
    svg.textContent = '';
    svg.classList.toggle('dogru', sonuc === 'dogru');
    const K = kalemYap(svg), renk = AB.config.renk, anlik = o.anlik;
    const an = ['isaret', sonuc, dogruCevap];
    if (sonuc === 'dogru') {
      svg.setAttribute('viewBox', '0 0 32 32');
      const t = K.egri(svg, [[6, 16], [13, 23], [26, 7]],
        { stroke: renk.mavi, strokeWidth: 2.4, roughness: .8 }, an, { anlik });
      return { bitti: t.bitti, sure: t.sure };
    }
    const c1 = K.cizgi(svg, [4, h * .72, w - 4, h * .28], { stroke: renk.kirmizi, strokeWidth: 2, roughness: 2 }, [...an, 1], { anlik });
    const c2 = K.cizgi(svg, [w - 6, h * .78, 8, h * .25], { stroke: renk.kirmizi, strokeWidth: 1.6, roughness: 2 }, [...an, 2], { anlik, gecikme: c1.sure * .8 });
    const parcalar = [c1, c2];
    let sure = c1.sure * .8 + c2.sure;
    if (sonuc === 'ceza' || sonuc === 'affedildi') {
      const d = cevapYaz(kap, String(dogruCevap), 'ust', { gecikme: sure + 100, anlik });
      parcalar.push(d);
      sure += 100 + d.sure;
    }
    return { bitti: bitenler(parcalar), sure };
  }

  /* ---------- tahtada notlar ve oyun sonu ---------- */

  // Tahtanın ortasına kâğıt şeritli kısa bir not düşer ("yer yok, pas"); notKaldir ile solup kaybolur.
  function notDus(T, yazi, renkAd, o = {}) {
    const ink = renkDeger(renkAd), k = T.boy / 320, c = T.boy / 2, y = c - 30 * k;
    const g = svgEl('g', { class: 'not', 'pointer-events': 'none', transform: `rotate(${egim(-6)} ${c} ${y})` }, T.katman.efekt);
    const gecikme = o.gecikme || 0, anlik = o.anlik;
    const t = metinSvg(g, yazi, { x: c, y, boyut: 26 * k, renk: ink, tohum: ['not', yazi, ...(o.tohum || [])], gecikme: gecikme + 200, adim: 45, anlik });
    const w = t.node.getComputedTextLength() || 120 * k;
    const serit = T.K.dikdortgen(g, [c - w / 2 - 12 * k, y - 26 * k, w + 24 * k, 40 * k],
      { stroke: AB.config.renk.kursun, strokeWidth: 1.3, fill: kagitRengi(), fillStyle: 'solid' }, ['not', 'serit', yazi, ...(o.tohum || [])], { gecikme, anlik });
    g.insertBefore(serit.node, g.firstChild);                // şerit yazının altında kalsın
    return { node: g, bitti: Promise.all([serit.bitti, t.bitti]), sure: 200 + t.sure };
  }

  function notKaldir(node) {
    if (!node || !node.parentNode) return;
    if (!animasyonVar()) { node.remove(); return; }
    const a = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
    a.finished.then(() => node.remove(), () => node.remove());
  }

  // Oyun sonu: tahtanın ortasına daktilo düzeltme sıvısı gibi bir leke, üstüne el yazısı sonuç.
  function sonucCiz(T, baslik, alt, renkAd, gecikme = 0, anlik = false) {
    const ink = renkDeger(renkAd), k = T.boy / 320, c = T.boy / 2;
    const g = svgEl('g', { class: 'sonuc', 'pointer-events': 'none' }, T.katman.efekt);
    const e = T.K.elips(g, [c, c, 256 * k, 116 * k], { stroke: ink, strokeWidth: 2, fill: kagitRengi(), fillStyle: 'solid' }, ['sonuc', T.n], { gecikme, anlik });
    const t0 = gecikme + e.sure * .6;
    const t1 = metinSvg(g, baslik, { x: c, y: c - 2 * k, boyut: 42 * k, renk: ink, aci: -5, tohum: ['sonuc', baslik], gecikme: t0, adim: 50, anlik });
    const t2 = metinSvg(g, alt, { x: c, y: c + 32 * k, boyut: 18 * k, renk: renkDeger('kursun'), aci: -4, tohum: ['sonuc2', alt], gecikme: t0 + t1.sure, anlik });
    return { node: g, bitti: Promise.all([e.bitti, t1.bitti, t2.bitti]), sure: t0 + t1.sure + t2.sure };
  }

  /* ---------- görsel iyileştirmeler: skor, son hamle, ipucu, oyun sonu ---------- */

  // Skor (V1). Masaüstünde sol üst marj köşesinde tabela: küçük "skor" ve altında büyük mavi–kırmızı sayılar
  // (sığmazsa küçülür); telefonda başlığın altında tek satır "SEN 84 · MAKİNE 72". Önde olanın altı çizilir.
  // o: { genis, yuk, dar, anlik }
  function skorYaz(svg, puan, o) {
    const { genis, yuk, dar } = o, anlik = o.anlik;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${genis} ${yuk}`);
    const K = kalemYap(svg), renk = AB.config.renk;
    const g = svgEl('g', null, svg);
    const yaz = (yazi, x, y, boyut, ink, an, hiza = 'start') =>
      metinSvg(g, yazi, { x, y, boyut, renk: ink, hiza, aci: -1.5, tohum: ['skor', ...an], anlik, adim: 25 });
    let ben, rak, xb, xr, y;
    if (dar) {
      y = 16; xb = 3;
      ben = yaz(`SEN ${puan.ben}`, xb, y, 16, renk.mavi, ['ben', puan.ben]);
      const wb = ben.node.getComputedTextLength() || 50;
      yaz('·', xb + wb + 8, y, 16, renk.kursun, ['ara'], 'middle');
      xr = xb + wb + 16;
      rak = yaz(`MAKİNE ${puan.rakip}`, xr, y, 16, renk.kirmizi, ['rakip', puan.rakip]);
    } else {
      yaz('skor', genis / 2, 15, 13, renk.kursun, ['baslik'], 'middle');
      y = 48;
      for (const boyut of [30, 26, 22, 18]) {               // en büyük sığan boyut
        g.querySelectorAll(':scope > .sayi').forEach(e => e.remove());
        ben = yaz(String(puan.ben), 0, y, boyut, renk.mavi, ['ben', puan.ben]);
        const tire = yaz('–', 0, y, boyut * .8, renk.kursun, ['tire']);
        rak = yaz(String(puan.rakip), 0, y, boyut, renk.kirmizi, ['rakip', puan.rakip]);
        [ben, tire, rak].forEach(p => p.node.classList.add('sayi'));
        const wb = ben.node.getComputedTextLength() || boyut, wt = tire.node.getComputedTextLength() || boyut * .4;
        const wr = rak.node.getComputedTextLength() || boyut, ara = 3, toplam = wb + wt + wr + 2 * ara;
        xb = (genis - toplam) / 2; xr = xb + wb + ara + wt + ara;
        ben.node.setAttribute('x', xb); rak.node.setAttribute('x', xr); tire.node.setAttribute('x', xb + wb + ara);
        [ben, tire, rak].forEach(p => p.node.setAttribute('transform', `rotate(${egim(-1.5)} ${p.node.getAttribute('x')} ${y})`));
        if (toplam <= genis - 4) break;
      }
    }
    const parcalar = [ben, rak];
    if (puan.ben !== puan.rakip) {                          // önde olanın altı kendi mürekkebiyle çizili
      const ondeBen = puan.ben > puan.rakip, t = ondeBen ? ben : rak;
      const x1 = (ondeBen ? xb : xr) - 1, x2 = x1 + (t.node.getComputedTextLength() || 30) + 3, w = x2 - x1, yc = y + 5;
      parcalar.push(K.egri(g, [[x1, yc + 1], [x1 + w * .3, yc - 1.5], [x1 + w * .65, yc + 1.5], [x2, yc]],
        { stroke: ondeBen ? renk.mavi : renk.kirmizi, strokeWidth: 1.8 }, ['skor', 'alt', ondeBen, puan.ben, puan.rakip], { gecikme: anlik ? 0 : 250, anlik }));
    }
    return { bitti: bitenler(parcalar), sure: 400 };
  }

  // Makinenin son hamlesi (V2): dikdörtgenin çevresine kurşun kalem halkası; çağıran notKaldir ile soldurur.
  function sonHamleIsaret(T, d, o = {}) {
    const x = d.k * HUCRE, y = d.s * HUCRE, W = d.w * HUCRE, H = d.h * HUCRE;
    const g = svgEl('g', { class: 'son-hamle', 'pointer-events': 'none' }, T.katman.efekt);
    const e = T.K.elips(g, [x + W / 2, y + H / 2, Math.max(W * 1.25, W + 16), Math.max(H * 1.25, H + 16)],
      { stroke: AB.config.renk.kursun, strokeWidth: 1.8, roughness: 1.7 }, ['son', d.id, d.s, d.k], { gecikme: o.gecikme, anlik: o.anlik });
    return { node: g, bitti: e.bitti, sure: e.sure };
  }

  // İlk tur ipucu (V3): "zarlara dokun!" ve zarları gösteren kalem oku. o: { genis, yuk, dar, anlik }
  function ipucuCiz(svg, o) {
    const { genis, yuk, dar } = o, anlik = o.anlik, kur = AB.config.renk.kursun;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${genis} ${yuk}`);
    const K = kalemYap(svg);
    const t = o.kompakt
      ? metinSvg(svg, 'zarlara', { x: 20, y: 16, boyut: 16, renk: kur, anlik, tohum: ['ipucu', 0] })
      : metinSvg(svg, 'zarlara dokun!', dar
        ? { x: 26, y: 27, boyut: 19, renk: kur, hiza: 'start', aci: -2, tohum: ['ipucu'], anlik, adim: 35 }
        : { x: genis / 2, y: 40, boyut: 21, renk: kur, hiza: 'middle', aci: -2, tohum: ['ipucu'], anlik, adim: 35 });
    const alt = o.kompakt ? metinSvg(svg, 'dokun!', { x: 20, y: 34, boyut: 16, renk: kur, anlik, tohum: ['ipucu', 1] }) : null;
    const ok = dar
      ? okCiz(K, svg, [[22, 20], [8, 14], [-12, 17]], { stroke: kur }, ['ipucu', 'ok', 'dar'], { gecikme: anlik ? 0 : t.sure, anlik })   // sola: zarlar
      : okCiz(K, svg, [[genis / 2 + 12, 24], [genis / 2 + 4, 10], [genis / 2, -6]], { stroke: kur }, ['ipucu', 'ok'], { gecikme: anlik ? 0 : t.sure, anlik }); // yukarı: zarların ortası
    return { bitti: bitenler([t, ...(alt ? [alt] : []), ...ok]), sure: t.sure + 400 };
  }

  // Oyun sonu lekesini (V6) tahtanın sağ üst köşesine küçültür (kucuk=true) ya da ortaya büyütür.
  function sonucKucult(T, kucuk, o = {}) {
    const g = T.katman.efekt.querySelector(':scope > .sonuc');
    if (!g) return;
    const k = T.boy / 320, c = T.boy / 2, olcek = .42;
    const hx = T.boy - (128 * olcek + 4) * k, hy = (58 * olcek + 4) * k;   // küçük lekenin merkezi
    const hedef = kucuk ? `translate(${(hx - c * olcek).toFixed(1)}px, ${(hy - c * olcek).toFixed(1)}px) scale(${olcek})` : 'translate(0px, 0px) scale(1)';
    const once = g.style.transform || 'translate(0px, 0px) scale(1)';
    g.style.transformOrigin = '0px 0px';
    g.style.transform = hedef;
    g.dataset.kucuk = kucuk ? '1' : '';
    if (animasyonVar() && !o.anlik) {
      g.animate([{ transform: once }, { transform: hedef }], { duration: 450, easing: 'ease-in-out' }).finished.catch(() => {});
    }
  }

  // Oyun sonunda hesap sütunundaki son toplamların altına muhasebe usulü çift çizgi (V6).
  function toplamCiz(svg, o = {}) {
    const d = svg._duzen, K = svg._K, renk = AB.config.renk, parcalar = [];
    for (const sahip of ['ben', 'rakip']) {
      const p = svg._hesap[sahip].onceki;
      if (!p) continue;
      const ink = sahip === 'ben' ? renk.mavi : renk.kirmizi, x1 = d.genis - 3 - p.w - 3, x2 = d.genis - 1;
      [3.5, 6.5].forEach((dy, i) => parcalar.push(K.cizgi(p.g, [x1, p.y + dy, x2, p.y + dy + (i ? -.5 : .5)],
        { stroke: ink, strokeWidth: 1.2 }, ['toplam', sahip, i], { gecikme: (o.gecikme || 0) + i * 160, anlik: o.anlik })));
    }
    return { bitti: bitenler(parcalar), sure: 450 };
  }

  /* ---------- ayar paneli ve geri sayım ---------- */

  // Ayar kutucuğu (24×24 kutu): elle çizilmiş kare; seçiliyse kutunun dışına taşan mavi kalem tiki.
  function ayarKutusu(svg, secili, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 24 24');
    const K = kalemYap(svg), renk = AB.config.renk, an = ['ayarkutu', ...(o.tohum || [])];
    const gecikme = o.gecikme || 0, anlik = o.anlik;
    const kare = K.dikdortgen(svg, [3, 4, 17, 17], { stroke: renk.mavi, strokeWidth: 1.5 }, an, { gecikme, anlik });
    const parcalar = [kare];
    if (secili) {
      parcalar.push(K.egri(svg, [[5, 12], [10, 19], [22, 1]], { stroke: renk.mavi, strokeWidth: 2.3 }, [...an, 'tik'],
        { gecikme: gecikme + kare.sure * .7, anlik }));
    }
    return { bitti: bitenler(parcalar), sure: kare.sure + (secili ? 200 : 0) };
  }

  // Kısa başlık: el yazısı + dalgalı alt çizgi (ayar paneli için).
  function baslikCiz(svg, yazi, o = {}) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${o.genis || 160} ${o.yuk || 40}`);
    const K = kalemYap(svg), gecikme = o.gecikme || 0, anlik = o.anlik;
    const t = metinSvg(svg, yazi, { x: 2, y: 28, boyut: 28, hiza: 'start', aci: -1.5, tohum: ['baslik', yazi], gecikme, adim: 45, anlik });
    const w = t.node.getComputedTextLength() || 120;
    const c = altCizgi(K, svg, -2, w + 6, 35, ['baslik', yazi], gecikme + t.sure * .8, anlik);
    return { bitti: bitenler([t, c]), sure: t.sure + 300 };
  }

  // Hamle süresi: başlık satırının sağında kurşun kalem "süre 18" (son 5 saniye kırmızı). null: siler.
  // Her saniye yeniden yazıldığı için harfler anında belirir.
  function sureYaz(svg, saniye) {
    const eski = svg.querySelector(':scope > .sure');
    if (eski) eski.remove();
    if (saniye == null) return null;
    const d = svg._duzen || { genis: 480, yuk: 72, dar: false };
    const g = svgEl('g', { class: 'sure' }, svg);
    return metinSvg(g, `süre ${saniye}`, {
      x: d.kompakt ? 216 : d.genis - 4, y: d.kompakt ? 64 : d.dar ? 25 : 38, boyut: d.kompakt ? 16 : d.dar ? 17 : 22,
      renk: renkDeger(saniye <= 5 ? 'kirmizi' : 'kursun'), hiza: 'end', aci: 1.2, tohum: ['sure', saniye], anlik: true,
    });
  }

  // Sayfa çevirme (V10): sayfanın kopyası sağ alt köşesinden kalkıp cilt tarafına (sola) çevrilir, arkasında
  // boş kâğıt yüzü; çağıran altındaki gerçek sayfaya yeni oyunu hemen çizer. Kopya DOM'da gerçek sayfadan
  // SONRA durur: kimlikler (CSS düzeni onlara bağlı) aynı kalır ama getElementById / $('#…') gerçeği bulur.
  // Kopya inert ve aria-hidden; animasyon bitince silinir. Döner: { bitti }.
  function sayfaCevir(sayfa) {
    const yaprak = document.createElement('div');
    yaprak.className = 'yaprak';
    yaprak.setAttribute('aria-hidden', 'true');
    yaprak.inert = true;
    const on = sayfa.cloneNode(true);
    on.removeAttribute('aria-label');
    const golge = document.createElement('div');
    golge.className = 'yaprak-golge';
    on.append(golge);
    const arka = document.createElement('div');
    arka.className = 'yaprak-arka';
    yaprak.append(on, arka);
    sayfa.after(yaprak);
    const p = 'perspective(2600px) ';
    const a = yaprak.animate([
      { transform: p + 'rotateY(0deg)', opacity: 1 },
      { transform: p + 'rotateY(-12deg) rotateX(4deg) skewY(-1.5deg)', opacity: 1, offset: .25 },   // köşe kalkar
      { transform: p + 'rotateY(-100deg) rotateX(2deg)', opacity: 1, offset: .75 },
      { transform: p + 'rotateY(-130deg)', opacity: 0 },                                // 90°'den sonra masaya düşer: solar
    ], { duration: 850, easing: 'ease-in-out', fill: 'forwards' });
    golge.animate([{ opacity: 0 }, { opacity: .2, offset: .3 }, { opacity: .55 }], { duration: 640, fill: 'forwards' });
    const bitti = a.finished.catch(() => {}).then(() => yaprak.remove());
    return { node: yaprak, bitti, sure: 850 };
  }

  /* ---------- sayfa başlığı ve durum yazısı ---------- */

  // Durum yazısı: her çağrıda eskisinin yerine yenisi yazılır. Konum ustCiz'in kaydettiği düzenden gelir.
  function durumYaz(svg, yazi, renk = 'mavi', o = {}) {
    const eski = svg.querySelector(':scope > .durum');
    if (eski) eski.remove();
    const d = svg._duzen || { genis: 480, yuk: 72, dar: false };
    const g = svgEl('g', { class: 'durum' }, svg);
    // Geniş düzende zarlarla aynı eksen; uzun mesajlar sağ kenara sığacak kadar sola kayar.
    const x = d.dar ? 2 : d.genis - 3 * HUCRE;
    const metin = metinSvg(g, yazi, {
      x, y: d.kompakt ? 43 : d.dar ? 60 : d.yuk - 6, boyut: d.kompakt ? 16 : d.dar ? 19 : 25,
      renk: renkDeger(renk), hiza: d.dar ? 'start' : 'middle', aci: d.dar ? -1 : -1.2,
      tohum: ['durum', yazi], gecikme: o.gecikme || 0, anlik: o.anlik,
    });
    if (!d.dar) {
      const kayma = Math.min(0, d.genis - 4 - x - metin.node.getComputedTextLength() / 2);
      if (kayma) g.setAttribute('transform', `translate(${kayma} 0)`);
    }
    return metin;
  }

  // Başlık "ALAN KAPMACA" + dalgalı alt çizgi, sağ üstte tarih, altta durum yazısı.
  // o: { genis, yuk, dar, durum, gecikme, anlik }
  function ustCiz(svg, o) {
    const { genis, yuk, dar } = o, gecikme = o.gecikme || 0, anlik = o.anlik;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${genis} ${yuk}`);
    svg._duzen = { genis, yuk, dar, kompakt: o.kompakt };
    const K = kalemYap(svg);
    const y = o.kompakt ? 20 : dar ? 25 : 36;
    const baslik = metinSvg(svg, 'ALAN KAPMACA', {
      x: 2, y, boyut: o.kompakt ? 20 : dar ? 27 : 38, hiza: 'start', aci: -1.2, tohum: ['baslik'], gecikme, adim: 45, anlik,
    });
    const w = baslik.node.getComputedTextLength() || 240;
    const cizgi = altCizgi(K, svg, -2, w + 8, y + (dar ? 6 : 9), ['baslik'], gecikme + baslik.sure * .8, anlik);
    const parcalar = [baslik, cizgi];
    if (o.durum) parcalar.push(durumYaz(svg, o.durum, o.renk || 'mavi', { gecikme: gecikme + baslik.sure, anlik }));
    if (!dar) {
      const tarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      parcalar.push(metinSvg(svg, tarih, { x: genis - 2, y: 14, boyut: 16, renk: AB.config.renk.kursun, hiza: 'end', aci: 1.6, tohum: ['tarih'], gecikme: gecikme + 200, anlik }));
    }
    return { bitti: bitenler(parcalar), sure: baslik.sure + 300 };
  }

  AB.draw = {
    HUCRE, karma, tohum, rastgele, animasyonVar,
    cizdir, kalemYap, kutu, metinSvg, harfle,
    tahtaKur, cerceveCiz, zarCiz, zarYuvarla, karakterCiz, balonCiz, balonKaralama, balonBaslat, balonDurdur,
    dikdortgenCiz, hayaletGoster, hayaletSil, noktaTahtada, ceteleKur, ceteleEkle, hesapYaz, ustCiz, durumYaz,
    cevapYaz, cevapIsaretle, isaretTemizle, notDus, notKaldir, sonucCiz,
    ayarKutusu, baslikCiz, sureYaz, skorYaz, sonHamleIsaret, ipucuCiz, sonucKucult, toplamCiz, okCiz, sayfaCevir,
    dugmeCerceve, dugmeVurgu, dugmeVurguSil, odakHalkasi, susCiz, varlikYukle, sesSimgesiCiz,
  };
})();
