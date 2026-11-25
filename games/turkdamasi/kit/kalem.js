// kit/kalem.js — rough.js ile kalem çizimi (varsayılan: tükenmez; malzeme katmanı kurşun kalem vb. yapar). Hangi oyun olduğunu bilmez.
// (amiralbatti/draw.js ve main.js'ten çıkarıldı; sonraki defter oyunlarında da aynen kullanılır.)
//
// Kullanım:  Kit.kalem.ayarla(cizim, renk)  →  const K = Kit.kalem.kalemYap(svg)  →  K.cizgi / K.yol / K.elips ...
// Her çizim ilkeli { node, bitti, sure } döndürür:
//   node  = eklenen SVG düğümü, bitti = çizim animasyonu bitince çözülen Promise,
//   sure  = animasyonun (gecikmeden sonraki) toplam süresi, ms — art arda çizimleri zincirlemek için.
// Çizim seçeneği o: { gecikme (ms), anlik (true: animasyonsuz), sureMs: [en az, en çok] (bu çağrıya özel kalem süresi) }
// Malzeme (kit/malzeme.js) ayarla()'nın üçüncü parametresiyle kalem izini işler: { isle: { secenek, bitir }, yazi: { aile, ornek } }.
// Malzeme seçilmezse her şey bugünkü tükenmez kalem gibi kalır.
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const SVG = 'http://www.w3.org/2000/svg';

  // Oyun kendi değerlerini ayarla() ile verir; bunlar amiralbatti'nin varsayılanlarıdır.
  const ayar = {
    cizim: { roughness: 1.2, bowing: 1, strokeWidth: 1.6, fillWeight: 0.8, sureMs: [150, 300], animasyon: true },
    renk: { mavi: '#1f3b9b', kirmizi: '#c62828', kursun: '#555555' },
    isle: null,                                         // malzeme kancası: { secenek(sec, anahtar), bitir(g, anahtar, o) }
    yazi: { aile: 'Patrick Hand', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
  };
  // ek (isteğe bağlı): { isle, yazi } — malzeme katmanı verir. isle: null kancayı kaldırır.
  function ayarla(cizim, renk, ek) {
    Object.assign(ayar.cizim, cizim || {});
    Object.assign(ayar.renk, renk || {});
    if (ek && 'isle' in ek) ayar.isle = ek.isle || null;
    if (ek && ek.yazi) Object.assign(ayar.yazi, ek.yazi);
  }
  const renkDeger = (ad) => ayar.renk[ad] || ad;

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
  const bekle = (ms) => new Promise(r => setTimeout(r, ms));

  const azHareket = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const animasyonVar = () =>
    ayar.cizim.animasyon && !azHareket.matches && typeof Element.prototype.animate === 'function';

  function svgEl(ad, oz, ebeveyn) {
    const e = document.createElementNS(SVG, ad);
    if (oz) for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  // Bir düğümü yumuşakça soldurup siler (animasyon kapalıysa hemen).
  function soldur(e, ms = 220) {
    if (!e || !e.parentNode) return Promise.resolve();
    if (!animasyonVar()) { e.remove(); return Promise.resolve(); }
    const a = e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    return a.finished.then(() => e.remove(), () => e.remove());
  }

  /* ---------- cizdir: kalemle çiziliyormuş gibi belirt ---------- */

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
  function cizdir(g, o = {}) {
    if (!animasyonVar() || o.anlik) return { bitti: Promise.resolve(), sure: 0 };
    const c = ayar.cizim;
    const taban = o.gecikme || 0;
    const sureAraligi = o.sureMs || c.sureMs;
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
        const T = sinir(toplam / HIZ, sureAraligi[0], sureAraligi[1]);
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

    const secenekTaban = (ek, anahtar) => Object.assign({
      roughness: ayar.cizim.roughness,
      bowing: ayar.cizim.bowing,
      strokeWidth: ayar.cizim.strokeWidth,
      fillWeight: ayar.cizim.fillWeight,
      stroke: ayar.renk.ana || ayar.renk.mavi,
      seed: tohum(...anahtar),
    }, ek);
    const secenek = (ek, anahtar) => {
      const s = secenekTaban(ek, anahtar);
      return ayar.isle && ayar.isle.secenek ? ayar.isle.secenek(s, anahtar, ek || {}) : s;
    };

    const ekle = (katman, g, o, anahtar) => {
      katman.appendChild(g);
      const s = cizdir(g, o);
      if (ayar.isle && ayar.isle.bitir) ayar.isle.bitir(g, anahtar, o || {});
      return { node: g, bitti: s.bitti, sure: s.sure };
    };

    return {
      rc,
      cizgi:      (k, [x1, y1, x2, y2], ek, an, o) => ekle(k, rc.line(x1, y1, x2, y2, secenek(ek, an)), o, an),
      egri:       (k, noktalar, ek, an, o)         => ekle(k, rc.curve(noktalar, secenek(ek, an)), o, an),
      yol:        (k, d, ek, an, o)                => ekle(k, rc.path(d, secenek(ek, an)), o, an),
      daire:      (k, [cx, cy, cap], ek, an, o)    => ekle(k, rc.circle(cx, cy, cap, secenek(ek, an)), o, an),
      dikdortgen: (k, [x, y, w, h], ek, an, o)     => ekle(k, rc.rectangle(x, y, w, h, secenek(ek, an)), o, an),
      cokgen:     (k, noktalar, ek, an, o)         => ekle(k, rc.polygon(noktalar, secenek(ek, an)), o, an),
      elips:      (k, [cx, cy, w, h], ek, an, o)   => ekle(k, rc.ellipse(cx, cy, w, h, secenek(ek, an)), o, an),
    };
  }

  // Köşelerde taşan dört çizgiden elle çizilmiş kutu (düğme çerçevesi vb.)
  function kutu(K, katman, x, y, w, h, o = {}) {
    const grup = svgEl('g', null, katman);
    const an = o.tohum || ['kutu'];
    const r = rastgele('kutu', ...an);
    const t = () => aralik(r, 1, o.tasma ?? 4);
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
      const s = K.cizgi(grup, cz, o.cizgi || {}, ['kutu', ...an, i], { gecikme: gec, anlik: o.anlik });
      bit.push(s.bitti);
      gec += s.sure * 0.8;
    });
    return { node: grup, bitti: Promise.all(bit), sure: gec - baslangic + 60 };
  }

  /* ---------- yazı ---------- */

  // SVG el yazısı: her harf ayrı <tspan>, hafif döndürülmüş ve 0.5–1 birim kaymış; harf harf belirir.
  // o: { x, y, boyut, renk, hiza, aci, tohum:[...], gecikme, adim, anlik }
  function metinSvg(katman, yazi, o) {
    const t = svgEl('text', {
      x: o.x, y: o.y,
      'font-size': o.boyut || 26,
      fill: renkDeger(o.renk || 'mavi'),
      'text-anchor': o.hiza || 'middle',
    }, katman);
    if (o.aci) t.setAttribute('transform', `rotate(${o.aci} ${o.x} ${o.y})`);

    const r = rastgele('yazi', ...(o.tohum || [yazi]));
    let onceki = 0;
    const harfler = [];
    for (const ch of yazi) {
      const dy = (r() - .5) * 1.8;                      // dy birikimli: fark verilir
      const ts = svgEl('tspan', {
        dy: (dy - onceki).toFixed(2),
        rotate: ((r() - .5) * 6).toFixed(1),
        'fill-opacity': (.92 + r() * .08).toFixed(2),
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

  // HTML el yazısı: harf başına <span>, seed'li küçük kayma/dönme. Kelimeler bölünmez.
  // Harfler ekran okuyucudan gizlenir. Yazı bir düğmenin içindeyse ad düğmeye aria-label olarak verilir (iç <span>'deki
  // aria-label düğmenin adı sayılmıyordu: "Geri al" adsız kalıyordu); değilse görünmez tek parça bir metin kopyası konur.
  function harfle(kap, yazi, o = {}) {
    yazi = yazi ?? kap.textContent.trim();
    kap.textContent = '';
    kap.removeAttribute('aria-label');
    const dugme = kap.closest('button, a, [role="button"]');
    if (dugme && dugme !== kap) dugme.setAttribute('aria-label', yazi);
    else {
      const okunan = document.createElement('span');
      okunan.className = 'gizli';
      okunan.textContent = yazi;
      kap.appendChild(okunan);
    }
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

  /* ---------- altı çizgi: kutu yerine kalemle altı çizili sözcük ---------- */

  // Hafif dalgalı, uçları biraz taşan altı çizgi. o: { tohum:[...], ek (rough seçenekleri), gecikme, anlik, sureMs,
  // tasma: [en az, en çok] uçların taşması (varsayılan [1.5, 4]) }
  function altiCiz(K, katman, x1, x2, y, o = {}) {
    const r = rastgele('alti', ...(o.tohum || [x1, x2, y]));
    const [ta, tb] = o.tasma || [1.5, 4];
    const t1 = aralik(r, ta, tb), t2 = aralik(r, ta, tb), w = x2 - x1 + t1 + t2, a = x1 - t1;
    const pts = [0, .3, .62, 1].map((f, i) => [a + w * f, y + (i ? aralik(r, -1, 1) : aralik(r, -.4, .4))]);
    return K.egri(katman, pts, Object.assign({ strokeWidth: 1.6, roughness: .7 }, o.ek), ['alti', ...(o.tohum || [x1, x2, y])],
      { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs });
  }

  // Düğme metninin altına kalemle çizgi (dugmeCerceve'nin kutusuz karşılığı). Boyut değişince aynı tohumla yeniden çağrılır.
  // Çizgi .yazi'nın genişliği kadardır; düğmenin dokunma alanı daha geniş olabilir.
  function dugmeAltiCiz(btn, gecikme = 0, anlik = false, ek, tasma) {
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
    const yazi = btn.querySelector('.yazi') || btn;
    const bb = yazi.getBoundingClientRect(), kb = btn.getBoundingClientRect();
    const olcek = kb.width ? w / kb.width : 1;                 // eğik sayfada da yerel piksele çevir
    const x1 = (bb.left - kb.left) * olcek, x2 = x1 + bb.width * olcek;
    const y = Math.min(h - 2, (bb.bottom - kb.top) * olcek + 1);
    const K = kalemYap(svg);
    svgEl('g', { class: 'vurgu' }, svg);
    const ana = svgEl('g', { class: 'ana' }, svg);
    return altiCiz(K, ana, x1, x2, y, { tohum: ['dugme-alti', btn.id || btn.dataset.ayar || '', btn.dataset.deger || ''], gecikme, anlik, ek, tasma });
  }

  // Dokununca altı çizgi kısa bir an koyulaşır: üstünden daha kalın ikinci bir geçiş, sonra solar.
  function dugmeAltiVurgu(btn) {
    const svg = btn.querySelector(':scope > svg.cerceve');
    const ana = svg && svg.querySelector('.ana path');
    if (!ana) return;
    const g = svg.querySelector('.vurgu');
    g.textContent = '';
    const kopya = ana.cloneNode(false);
    kopya.setAttribute('stroke-width', (parseFloat(ana.getAttribute('stroke-width')) || 1.6) * 1.9);
    kopya.setAttribute('stroke-opacity', '1');
    g.appendChild(kopya);
    if (!animasyonVar()) { setTimeout(() => kopya.remove(), 250); return; }
    const a = kopya.animate([{ opacity: 1 }, { opacity: 1, offset: .35 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
    a.finished.then(() => kopya.remove(), () => kopya.remove());
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
    return kutu(K, ana, 4, 4, w - 8, h - 8, { tohum: ['dugme', btn.id], gecikme, anlik, tasma: 4 });
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
    kutu(K, g, 5, 5, w - 10, h - 10, { tohum: ['vurgu', btn.id, sayac], tasma: 3, cizgi: { strokeWidth: 1.2 } });
  }

  // Klavye odağı için kurşun kalemle çerçeve (düz CSS outline yerine). bicim: 'kutu' ya da 'cember'.
  // Kendi svg'sinde (.odak) durur; öğe konumlandırılmış (relative/absolute) olmalı.
  function odakCiz(el, bicim = 'kutu') {
    odakSil(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'odak', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    el.appendChild(svg);
    const K = kalemYap(svg), an = ['odak', el.id || el.dataset.ayar || el.dataset.harf || '', el.dataset.deger || '', w, h];
    const cizgi = { stroke: ayar.renk.kursun, strokeWidth: 1.4, roughness: 1.3 };
    if (bicim === 'cember') K.elips(svg, [w / 2, h / 2, w * 1.06, h * 1.04], cizgi, an, { anlik: true });
    else kutu(K, svg, -3, -3, w + 6, h + 6, { tohum: an, anlik: true, tasma: 3, cizgi });
  }
  function odakSil(el) {
    const e = el && el.querySelector(':scope > svg.odak');
    if (e) e.remove();
  }

  /* ---------- varlıklar: isteğe bağlı elle çizilmiş PNG'ler ---------- */

  // Liste (SOS.varliklar = ['karakter-normal.png', ...]) yüklenir. Bir dosya yoksa ya da açılamazsa
  // yalnız o parça için prosedürel SVG çizilmeye devam eder. `file://`'da fetch çalışmaz, Image çalışır.
  const resimler = {};                                     // 'karakter-normal' -> HTMLImageElement
  const varlik = (ad) => resimler[ad];

  function varlikYukle(liste, klasor = 'assets', sinirMs = 3000) {
    liste = Array.isArray(liste) ? liste : [];
    const isler = liste.map(dosya => new Promise(coz => {
      const img = new Image();
      img.onload = () => { if (img.naturalWidth) resimler[dosya.replace(/\.png$/i, '')] = img; coz(); };
      img.onerror = coz;
      img.src = klasor + '/' + dosya;
    }));
    return Promise.race([Promise.all(isler), bekle(sinirMs)]);
  }

  // PNG'yi SVG içine koyar; çizgi çizilemeyeceği için yumuşakça belirir.
  function resimEkle(katman, ad, x, y, w, h, o = {}) {
    const e = svgEl('image', { href: resimler[ad].src, x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid meet' }, katman);
    const hareketli = animasyonVar() && !o.anlik;
    if (hareketli) {
      const a = e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: o.gecikme || 0, fill: 'both' });
      a.finished.then(() => a.cancel(), () => {});
    }
    return { node: e, bitti: hareketli ? bekle((o.gecikme || 0) + 180) : Promise.resolve(), sure: 180 };
  }

  /* ---------- köşe karalamaları (süsler) ---------- */

  // Süsler kurşun kalemle; kendi küçük koordinat kutularında (viewBox) çizilir.
  const SUSLER = {
    gunes(K, g, gec, an, anlik) {
      const kur = ayar.renk.kursun, r = rastgele('sus', 'gunes', ...an), o = { gecikme: gec, anlik };
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
    bulut(K, g, gec, an, anlik) {
      const kur = ayar.renk.kursun;
      return [K.yol(g,
        'M 25 55 C 5 55, 3 33, 22 31 C 20 12, 48 6, 58 22 C 66 8, 96 12, 94 34 C 112 32, 115 56, 95 55 Z',
        { stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 6, hachureAngle: -30, strokeWidth: 1.5 },
        ['sus', 'bulut', ...an], { gecikme: gec, anlik })];
    },
    kalp(K, g, gec, an, anlik) {
      const kur = ayar.renk.kursun;
      return [K.yol(g,
        'M 40 70 C 10 48, 6 20, 24 14 C 33 11, 40 18, 40 24 C 40 18, 47 11, 56 14 C 74 20, 70 48, 40 70 Z',
        { stroke: kur, fill: kur, fillStyle: 'hachure', hachureGap: 4, hachureAngle: 50, strokeWidth: 1.5 },
        ['sus', 'kalp', ...an], { gecikme: gec, anlik })];
    },
    ok(K, g, gec, an, anlik) {
      const kur = ayar.renk.kursun, o = { gecikme: gec, anlik };
      const uc = [88, 38], a = Math.atan2(38 - 16, 88 - 62), L = 16;
      const kol = (s) => [uc[0], uc[1], uc[0] - L * Math.cos(a + s), uc[1] - L * Math.sin(a + s)];
      return [
        K.egri(g, [[6, 46], [30, 14], [62, 16], uc], { stroke: kur, strokeWidth: 1.6 }, ['sus', 'ok', ...an], o),
        K.cizgi(g, kol(.5), { stroke: kur, strokeWidth: 1.6 }, ['sus', 'ok', 'k1', ...an], { gecikme: gec + 200, anlik }),
        K.cizgi(g, kol(-.5), { stroke: kur, strokeWidth: 1.6 }, ['sus', 'ok', 'k2', ...an], { gecikme: gec + 260, anlik }),
      ];
    },
    yildiz(K, g, gec, an, anlik) {
      const kur = ayar.renk.kursun, r = rastgele('sus', 'yildiz', ...an);
      const donuk = aralik(r, -.3, .3), pts = [];
      for (let i = 0; i < 10; i++) {
        const yaricap = i % 2 ? 7.5 : 17, a = -Math.PI / 2 + donuk + i * Math.PI / 5;
        pts.push([20 + yaricap * Math.cos(a), 20 + yaricap * Math.sin(a)]);
      }
      return [K.cokgen(g, pts, { stroke: kur, strokeWidth: 1.4 }, ['sus', 'yildiz', ...an], { gecikme: gec, anlik })];
    },
  };

  // svg: kendi viewBox'ı olan boş <svg>. 'sus-<ad>.png' varlığı varsa onu kullanır.
  function susCiz(svg, ad, an, gecikme = 0, anlik = false) {
    svg.textContent = '';
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (resimler['sus-' + ad] && vb) {
      const r = resimEkle(svg, 'sus-' + ad, 0, 0, vb.width, vb.height, { gecikme, anlik });
      return { bitti: r.bitti, sure: 400 };
    }
    const K = kalemYap(svg);
    const g = svgEl('g', { opacity: .85 }, svg);
    const cizimler = SUSLER[ad](K, g, gecikme, an, anlik);
    return { bitti: Promise.all(cizimler.map(c => c.bitti)), sure: 600 };
  }

  /* ---------- ses düğmesi simgesi ---------- */

  // Kalemle çizilmiş hoparlör: açıkken ses dalgaları, kapalıyken kırmızı çarpı.
  function sesSimgesiCiz(svg, acik, anlik = false) {
    svg.textContent = '';
    const K = kalemYap(svg), g = svgEl('g', null, svg), renk = ayar.renk;
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

  /* ---------- karalama: kurşun kalemle zikzak (bekleme göstergesi) ---------- */

  function karalamaDurdur(svg) {
    if (svg._karalama) { clearInterval(svg._karalama); svg._karalama = 0; }
    const g = svg.querySelector(':scope > .karalama');
    if (g) g.remove();
  }

  // alan: { x, y, w, h } — zikzağın çizileceği kutu. tik: her yeni zikzakta çağrılır (ses için)
  function karalamaBaslat(svg, alan, tik) {
    karalamaDurdur(svg);
    const K = kalemYap(svg);
    const g = svgEl('g', { class: 'karalama' }, svg);
    let sayac = 0;
    const bir = () => {
      g.textContent = '';
      const r = rastgele('karalama', sayac);
      const pts = [], adet = 12;
      for (let i = 0; i <= adet; i++) {
        pts.push([alan.x + alan.w * i / adet + aralik(r, -4, 4), alan.y + (i % 2 ? alan.h : 0) + aralik(r, -3, 3)]);
      }
      K.egri(g, pts, { stroke: ayar.renk.kursun, strokeWidth: 1.5, roughness: 1.8 }, ['karalama', sayac]);
      sayac++;
      if (tik) tik();
    };
    bir();
    svg._karalama = setInterval(bir, 650);
  }

  /* ---------- sayfa: ölçü, font, rough.js yok uyarısı ---------- */

  // Sayfanın kullanabileceği alan (px): görüntü alanından body'nin güvenli alan boşlukları düşülür.
  function alan() {
    const cs = getComputedStyle(document.body);
    const px = (v) => parseFloat(v) || 0;
    return {
      vw: document.documentElement.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
      vh: (window.visualViewport && Math.abs(window.visualViewport.scale - 1) < .01 ? window.visualViewport.height : window.innerHeight) - px(cs.paddingTop) - px(cs.paddingBottom),
    };
  }

  // 1 defter karesi kaç piksel? o: { genislikKare, yukseklikKare, min, max, darEkranPx }
  // Dar ekranda (telefon) yalnız genişliğe bakılır; geniş ekranda yükseklik de sığmalı.
  function olcuBirimi(o) {
    const { vw, vh } = alan();
    const dar = !!o.darEkranPx && window.matchMedia(`(max-width: ${o.darEkranPx}px)`).matches;
    const enGenislik = Math.floor((vw - (dar ? 0 : 24)) / o.genislikKare);
    const enYukseklik = Math.floor((vh - 16) / o.yukseklikKare);
    let sq = dar ? enGenislik : Math.min(enGenislik, enYukseklik);
    sq = Math.min(o.max, Math.max(o.min, sq));
    document.documentElement.style.setProperty('--sq', sq + 'px');
    return sq;
  }

  // Font yüklenmeden etiketleri yazarsak yedek font parlar ve glif açıları kayar.
  // true: font hazır · false: süre doldu ya da yüklenemedi (oyun yedek fontla başlar; fontGelince ile sonra düzeltilir).
  function fontBekle(aile = ayar.yazi.aile, ornek = ayar.yazi.ornek, zamanAsimiMs = 2500) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(true);
    const yukle = document.fonts.load(`26px "${aile}"`, ornek).then(l => l.length > 0, () => false);
    return Promise.race([yukle, bekle(zamanAsimiMs).then(() => false)]);
  }

  // Font geç gelirse (fontBekle false döndüyse) yüklenince bir kez çağrılır: ölçüye bağlı çizimler yenilenir.
  function fontGelince(geri, aile = ayar.yazi.aile, ornek = ayar.yazi.ornek) {
    if (!document.fonts || !document.fonts.load) return;
    document.fonts.load(`26px "${aile}"`, ornek).then(l => { if (l.length) geri(); }, () => {});
  }

  function kalemYok() {
    const p = document.createElement('p');
    p.className = 'uyari';
    p.textContent = 'Kalemim bulunamadı! Çizim dosyası yüklenemedi. Sayfayı yenile; sorun sürerse oyun dosyalarını yeniden aç.';
    document.body.prepend(p);
  }

  Kit.kalem = {
    ayarla, renkDeger, ayar,
    karma, tohum, rastgele, aralik, sinir, bekle, animasyonVar, svgEl, soldur,
    cizdir, kalemYap, kutu,
    metinSvg, harfle,
    dugmeCerceve, dugmeVurgu, odakCiz, odakSil,
    altiCiz, dugmeAltiCiz, dugmeAltiVurgu,
    varlik, varlikYukle, resimEkle,
    susCiz, sesSimgesiCiz,
    karalamaBaslat, karalamaDurdur,
    alan, olcuBirimi, fontBekle, fontGelince, kalemYok,
  };
})();
