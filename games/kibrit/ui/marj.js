// ui/marj.js — defter marjı, kurşun kalemle: Sen | Bilgisayar çetelesi, süre, tur, puan, hamle sayacı ("1/1"),
// notlar ("olmadı", öğretici, bulunan çözümler) ve altı çizili komut sözcükleri.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const svgEl = (ad, oz, eb) => { const e = document.createElementNS(NS, ad); for (const k in oz) e.setAttribute(k, oz[k]); if (eb) eb.appendChild(e); return e; };
  const satirlar = {};
  let cizim = null;          // mevcut düzen
  const boyut = () => (document.body.dataset.duzen === 'dar' ? 15 : Math.round(KB.sahne.O.sq * .92));

  // Rakam glifleri (Kit.rakam) bir svg'ye, anında; eski çizim silinir
  function glif(svg, metin, o = {}) {
    svg.innerHTML = '';
    const b = o.boyut || boyut();
    const K = Kit.kalem.kalemYap(svg);
    const w = Kit.rakam.genislik(metin, b);
    svg.setAttribute('viewBox', `-2 -2 ${w + 6} ${b + 6}`);
    svg.setAttribute('width', w + 6); svg.setAttribute('height', b + 6);
    Kit.rakam.yaz(K, svg, metin, { x: 1, y: b + 1, boyut: b, renk: o.renk || 'kursun', anlik: o.anlik !== false, tohum: o.tohum || ['marj', metin], kalinlik: 1.25 });
  }

  function satir(ad, etiket) {
    const d = document.createElement('div');
    d.className = 'marj-satir';
    d.dataset.ad = ad;
    if (etiket) { const s = document.createElement('span'); s.className = 'etiket'; s.textContent = etiket; d.appendChild(s); }
    const svg = svgEl('svg', { 'aria-hidden': 'true', width: 0, height: 0 }, d);
    const g = document.createElement('span'); g.className = 'gizli'; d.appendChild(g);
    satirlar[ad] = { el: d, svg, gizli: g, metin: null };
    return d;
  }
  function deger(ad, metin, o = {}) {
    const s = satirlar[ad];
    if (!s) return;
    const anahtar = metin + '|' + (o.renk || '') + '|' + boyut();
    if (s.metin === anahtar) return;
    s.metin = anahtar;
    glif(s.svg, metin, Object.assign({ tohum: ['marj', ad, metin] }, o));
    s.gizli.textContent = o.sesli || metin;
  }

  // Çetele: beşli gruplar (dört dikey + bir çapraz)
  function cetele(svg, n, tohum, enGen) {
    svg.innerHTML = '';
    const h = Math.round(boyut() * 1.05), adim = h * .32, grupW = adim * 4 + h * .62;
    const sigan = enGen ? Math.max(1, Math.floor((enGen + h * .3) / grupW)) : 99;
    const grup = Math.max(1, Math.ceil(n / 5));
    const satir = Math.ceil(grup / sigan), sutun = Math.min(grup, sigan);
    const W = Math.max(h, sutun * grupW), H = satir * h + (satir - 1) * h * .35;
    svg.setAttribute('viewBox', `-3 -3 ${W + 6} ${H + 6}`);
    svg.setAttribute('width', W + 6); svg.setAttribute('height', H + 6);
    const K = Kit.kalem.kalemYap(svg);
    if (!n) K.cizgi(svg, [1, h * .55, h * .7, h * .5], { strokeWidth: 1.1, stroke: '#8a8783' }, [...tohum, 'bos'], { anlik: true });
    for (let i = 0; i < n; i++) {
      const g = Math.floor(i / 5), j = i % 5;
      const x0 = (g % sigan) * grupW, y0 = Math.floor(g / sigan) * h * 1.35;
      if (j < 4) K.cizgi(svg, [x0 + j * adim + 2, y0 + 1, x0 + j * adim + 2.6, y0 + h - 1], { strokeWidth: 1.3 }, [...tohum, i], { anlik: true });
      else K.cizgi(svg, [x0 - adim * .4, y0 + h * .78, x0 + adim * 3.9, y0 + h * .2], { strokeWidth: 1.3 }, [...tohum, i], { anlik: true });
    }
  }
  // Kalemle çizgi: kabın genişliğinde yatay (kural) ya da skor tablosunun ayraçları
  function kural(kap, tohum) {
    let svg = kap.querySelector(':scope > svg.kural-iz');
    if (!svg) { svg = svgEl('svg', { class: 'kural-iz', 'aria-hidden': 'true' }); kap.appendChild(svg); }
    svg.innerHTML = '';
    const w = kap.clientWidth, h = kap.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    const K = Kit.kalem.kalemYap(svg);
    const ek = { strokeWidth: 1.1, stroke: '#7d7a76', roughness: .8 };
    if (kap.classList.contains('skor')) {
      const ad = kap.querySelector('.ad');
      const yA = ad ? ad.offsetTop + ad.offsetHeight + 2 : h * .4;
      K.cizgi(svg, [0, yA, w - 2, yA + .6], ek, [...tohum, 'yatay'], { anlik: true });
      K.cizgi(svg, [w / 2, 2, w / 2 + .5, h - 1], ek, [...tohum, 'dikey'], { anlik: true });
    } else K.cizgi(svg, [0, h / 2, w - 4, h / 2 + .8], ek, [...tohum, 'kural'], { anlik: true });
  }
  function cizgileriCiz() {
    if (document.body.dataset.duzen === 'dar') return;
    document.querySelectorAll('.skor-bas .skor').forEach((k, i) => kural(k, ['skor-kural', i]));
  }

  // Düzeni kur. o: { cetele: [adSen, adO] | null, sure, tur, puan, hamle, seri, cozum }
  // Yerleşim: çetele, tur, puan, seri, çözüm sayısı sağ sayfanın skor kartında; süre ve hamle sol sayfanın marjında
  function kur(o) {
    cizim = o;
    const kap = $('skor-bas'), marj = $('marj-kalem');
    kap.innerHTML = ''; marj.innerHTML = '';
    for (const k in satirlar) delete satirlar[k];
    if (o.cetele) {
      // Sen | Bilgisayar: kalemle çizilmiş küçük çetele tablosu
      const c = document.createElement('div');
      c.className = 'cetele skor';
      o.cetele.forEach((ad, i) => {
        const s = document.createElement('div');
        s.className = 'skor-sutun';
        const a = document.createElement('div'); a.className = 'ad'; a.textContent = ad; s.appendChild(a);
        const svg = svgEl('svg', { 'aria-hidden': 'true', width: 0, height: 0 }, s);
        const g = document.createElement('span'); g.className = 'gizli'; s.appendChild(g);
        satirlar['cetele' + i] = { el: s, svg, gizli: g };
        c.appendChild(s);
      });
      kap.appendChild(c);
    }
    const alt = document.createElement('div');
    alt.className = 'skor-alt';
    if (o.tur) alt.appendChild(satir('tur', 'tur'));
    if (o.cozum) alt.appendChild(satir('cozum', 'çözüm'));
    if (o.seri) alt.appendChild(satir('seri', 'seri'));
    if (o.puan) alt.appendChild(satir('puan', 'puan'));
    if (alt.children.length) kap.appendChild(alt);
    if (o.sure) marj.appendChild(satir('sure', 'süre'));
    if (o.hamle) marj.appendChild(satir('hamle', 'hamle'));
    requestAnimationFrame(cizgileriCiz);
  }
  function ceteleYaz(i, n, ad) {
    const s = satirlar['cetele' + i];
    if (!s) return;
    const dar = document.body.dataset.duzen === 'dar';
    s.n = n; s.ad = ad;
    cetele(s.svg, n, ['cetele', i], dar ? 0 : s.el.clientWidth - 4);
    s.gizli.textContent = `${ad || ''} ${n}`;
  }
  const sureMetin = (sn) => { sn = Math.max(0, Math.floor(sn)); return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`; };
  const sure = (sn, kirmizi) => deger('sure', sureMetin(sn), { renk: kirmizi ? 'vurgu' : 'kursun', sesli: `${Math.floor(sn)} saniye` });
  const tur = (i, n) => deger('tur', `${i}/${n}`, { sesli: `tur ${i} / ${n}` });
  const puan = (p) => deger('puan', String(p), { sesli: `puan ${p}` });
  const seri = (n) => deger('seri', String(n), { sesli: `seri ${n}` });
  const cozum = (a, b) => deger('cozum', `${a}/${b}`, { sesli: `${a} çözüm / ${b}` });
  const hamle = (sayac, hak, asildi) => deger('hamle', `${sayac}/${hak}`, { renk: asildi ? 'vurgu' : 'kursun', sesli: `hamle ${sayac} / ${hak}${asildi ? ', hak aşıldı' : ''}` });

  // Notlar
  function not(metin, o = {}) {
    const ul = $('marj-not');
    const li = document.createElement('li');
    if (o.kirmizi) li.classList.add('kirmizi');
    if (o.matbaa) { li.classList.add('matbaa'); li.innerHTML = metin; } else li.textContent = metin;
    if (o.anahtar) { li.dataset.anahtar = o.anahtar; ul.querySelectorAll(`[data-anahtar="${o.anahtar}"]`).forEach(x => x.remove()); }
    ul.appendChild(li);
    if (!o.matbaa && !o.sessiz) { const h = document.createElement('span'); void h; }
    if (o.sure) setTimeout(() => { li.classList.add('soluk'); setTimeout(() => li.remove(), 650); }, o.sure);
    return li;
  }
  function notlarTemizle(anahtar) {
    const ul = $('marj-not');
    if (anahtar) ul.querySelectorAll(`[data-anahtar="${anahtar}"]`).forEach(x => x.remove());
    else ul.innerHTML = '';
  }

  /* ---------- komutlar ---------- */
  const KOMUT = ['k-sonraki', 'k-geri', 'k-bastan', 'k-ipucu', 'k-pes', 'k-paylas', 'k-yeni', 'k-modlar', 'k-ayarlar', 'k-ses'];
  function komutlar(goster, yeniAd) {
    for (const id of KOMUT) {
      const b = $(id);
      if (!b) continue;
      const g = goster[id] !== undefined ? goster[id] : !['k-sonraki', 'k-paylas'].includes(id);
      b.hidden = !g;
    }
    if (yeniAd) { const y = $('k-yeni').querySelector('.yazi'); if (y.dataset.metin !== yeniAd) { y.dataset.metin = yeniAd; y.textContent = yeniAd; } }
    ciz(true);
  }
  function sesCiz() {
    const b = $('k-ses'), svg = b && b.querySelector('svg.ses-simge');
    if (!svg) return;
    Kit.kalem.sesSimgesiCiz(svg, !Kit.ses.sessiz, true);
  }
  function ciz(anlik) {
    let i = 0;
    sesCiz();
    for (const id of KOMUT) {
      const b = $(id);
      if (!b || b.hidden || b.classList.contains('ikon')) continue;
      const y = b.querySelector('.yazi');
      const metin = y.dataset.metin || y.textContent.trim();
      y.dataset.metin = metin;
      if (y.dataset.cizili !== metin) { Kit.kalem.harfle(y, metin, { tohum: ['komut', metin], anlik: true }); y.dataset.cizili = metin; }
      Kit.kalem.dugmeAltiCiz(b, anlik ? 0 : 200 + i * 90, anlik, { stroke: b.classList.contains('vurgulu') ? '#b4382e' : '#4a4a4a', strokeWidth: 1.3 });
      i++;
    }
  }
  function vurgula(id, acik) {
    const b = $(id);
    if (!b) return;
    b.classList.toggle('vurgulu', !!acik);
    const svg = b.querySelector(':scope > svg.cerceve');
    if (svg) svg.remove();
    Kit.kalem.dugmeAltiCiz(b, 0, true, { stroke: acik ? '#b4382e' : '#4a4a4a', strokeWidth: acik ? 1.8 : 1.3 });
  }
  function yenidenCiz() {
    for (const k in satirlar) if (satirlar[k].metin) { const m = satirlar[k].metin; satirlar[k].metin = null; const [metin, renk] = m.split('|'); deger(k, metin, { renk: renk || undefined }); }
    for (const id of KOMUT) { const b = $(id); const s = b && b.querySelector(':scope > svg.cerceve'); if (s) s.remove(); }
    ciz(true);
    cizgileriCiz();
  }
  // Çeteleler kabın genişliğine göre sarılır: genişlik değişince yeniden
  function ceteleYenile() { for (const k in satirlar) if (k.startsWith('cetele') && satirlar[k].n !== undefined) ceteleYaz(+k.slice(6), satirlar[k].n, satirlar[k].ad); }

  /* ---------- maç defteri (sağ sayfa): tur tur kurşun kalem kayıt ---------- */
  function gecmisKur(baslik) { $('gecmis-baslik').textContent = baslik || ''; $('tur-gecmisi').innerHTML = ''; }
  // o: { no, ne (html), sure, sinif: 'kazandi' | 'kaybetti' | '', basa }
  function gecmisEkle(o) {
    const ol = $('tur-gecmisi');
    const li = document.createElement('li');
    if (o.sinif) li.className = o.sinif;
    const no = document.createElement('span'); no.className = 'no'; no.textContent = o.no || ''; li.appendChild(no);
    const ne = document.createElement('span'); ne.className = 'ne'; ne.innerHTML = o.ne || ''; li.appendChild(ne);
    const su = document.createElement('span'); su.className = 'sure'; su.textContent = o.sure || ''; li.appendChild(su);
    if (o.basa) ol.insertBefore(li, ol.firstChild); else ol.appendChild(li);
    while (ol.children.length > 12) ol.removeChild(o.basa ? ol.lastChild : ol.firstChild);
    // defter sığmazsa liste kendi içinde kayar; en yeni kayıt görünür kalır, yukarıda kalanlar silikleşir
    ol.scrollTop = o.basa ? 0 : ol.scrollHeight;
    if (!ol.dataset.kayar) { ol.dataset.kayar = '1'; ol.addEventListener('scroll', () => ol.classList.toggle('kaymis', ol.scrollTop > 2), { passive: true }); }
    ol.classList.toggle('kaymis', ol.scrollTop > 2);
    return li;
  }

  KB.marj = { kur, kural, cizgileriCiz, ceteleYenile, sesCiz, gecmisKur, gecmisEkle, ceteleYaz, sure, sureMetin, tur, puan, seri, cozum, hamle, not, notlarTemizle, komutlar, vurgula, ciz, yenidenCiz, glif, cetele };
})();
