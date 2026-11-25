// kart.js — "kart" sayfası: Okul modunun adımları (telefonu ver, gizli giriş, telefonu geri ver), günün sonucu, maraton özeti.
// Yalnız DOM kurar; oyun durumuna dokunmaz (ui.js düğmelere eylem bağlar). Tarayıcıda AA.kart.
(function () {
  'use strict';

  const AA = (window.AA = window.AA || {});
  const KL = window.Kit.kalem;
  const $ = (s, k = document) => k.querySelector(s);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const renkDeger = (ad) => KL.renkDeger(ad);

  // o: { baslik, renk: 'mavi'|'kirmizi'|'kursun', metinler: [...], paylasim: 'satır', govde: (kap) => void,
  //      dugmeler: [{ id, yazi, ikincil }], simge: 'telefon'|'goz'|'gunun'|'maraton'|… (marjda kurşun karalama) }
  // Sayfa başı (başlık, tarih, durum) ui.js'te çizilir; burada yalnız içerik alanı kurulur.
  // Döner: { baslik, govde, dugmeler: { id: <button> } }
  function kur(o) {
    const s = $('#kart-icerik');
    s.textContent = '';
    $('#kart-simge').textContent = '';
    $('#kart-simge').dataset.simge = o.simge || '';
    const h = document.createElement('h2');
    h.className = 'kart-baslik';
    h.style.color = renkDeger(o.renk || 'mavi');
    KL.harfle(h, o.baslik, { tohum: ['kart', o.baslik], anlik: true });
    s.appendChild(h);
    for (const t of o.metinler || []) {
      const p = document.createElement('p');
      p.className = 'kart-metin';
      p.textContent = t;
      s.appendChild(p);
    }
    if (o.paylasim) {
      const p = document.createElement('p');
      p.className = 'kart-metin paylasim';
      p.textContent = o.paylasim;
      s.appendChild(p);
    }
    let govde = null;
    if (o.govde) { govde = document.createElement('div'); govde.className = 'kart-govde'; o.govde(govde); s.appendChild(govde); }
    const kap = document.createElement('div');
    kap.className = 'kart-dugmeler';
    const dugmeler = {};
    for (const d of o.dugmeler || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = d.id;
      b.className = 'dugme' + (d.ikincil ? ' ikincil' : '');
      b.dataset.yazi = d.yazi;
      const y = document.createElement('span');
      y.className = 'yazi';
      y.textContent = d.yazi;
      b.appendChild(y);
      kap.appendChild(b);
      dugmeler[d.id] = b;
    }
    s.appendChild(kap);
    return { baslik: h, govde, dugmeler };
  }

  // Düğme çerçeveleri ve el yazısı etiketleri sayfa görünür olduktan sonra çizilir (boyut ölçülür). Marjdaki simge de.
  function cerceveleriCiz(anlik = false) {
    [...document.querySelectorAll('#s-kart .dugme')].forEach((b, i) => {
      const y = b.querySelector('.yazi');
      if (y && !anlik) KL.harfle(y, b.dataset.yazi || y.textContent, { tohum: ['kart-dugme', b.id], gecikme: 150 + i * 120 });
      KL.dugmeCerceve(b, anlik ? 0 : 150 + i * 120, anlik);
    });
    const simge = $('#kart-simge');
    if (simge.dataset.simge) AA.draw.simgeCiz(simge, simge.dataset.simge, 'kursun', { anlik, gecikme: anlik ? 0 : 500, kalin: 1.4 });
  }

  // Gizli kelime girişi: maskeli alan + göster/gizle, sözlük kontrolü ve kategori etiketi seçenekleri. Eylemleri ui.js bağlar.
  function okulGirisi(kap, o) {
    kap.innerHTML = '';
    const alan = document.createElement('div');
    alan.className = 'kart-alan';
    const sar = document.createElement('div');
    sar.className = 'alan';
    const giris = document.createElement('input');
    giris.id = 'okul-kelime';
    giris.className = 'kart-giris';
    giris.type = 'password';
    giris.name = 'okul-gizli';
    giris.setAttribute('autocomplete', 'off');
    giris.setAttribute('autocapitalize', 'characters');
    giris.setAttribute('autocorrect', 'off');
    giris.setAttribute('spellcheck', 'false');
    giris.setAttribute('maxlength', '60');
    giris.setAttribute('aria-label', 'Gizli kelime');
    giris.placeholder = 'kelime ya da söz';
    const cizgi = document.createElementNS(SVGNS, 'svg');
    cizgi.setAttribute('class', 'alan-cizgi');
    cizgi.setAttribute('viewBox', '0 0 300 14');
    cizgi.setAttribute('preserveAspectRatio', 'none');
    cizgi.setAttribute('aria-hidden', 'true');
    KL.kalemYap(cizgi).cizgi(cizgi, [0, 8, 300, 7], { stroke: renkDeger(o.renk || 'mavi'), strokeWidth: 1.8, roughness: 1.3 }, ['okul-alan'], { anlik: true });
    sar.appendChild(giris);
    sar.appendChild(cizgi);
    const goster = document.createElement('button');
    goster.type = 'button';
    goster.id = 'okul-goster';
    goster.className = 'kart-not-dugme';
    goster.setAttribute('aria-pressed', 'false');
    goster.innerHTML = '<svg class="goz" viewBox="0 0 40 40" aria-hidden="true"></svg><span class="etiket">göster</span>';
    AA.draw.simgeCiz(goster.querySelector('svg'), 'goz', 'kursun', { anlik: true, kalin: 1.5 });
    alan.appendChild(sar);
    alan.appendChild(goster);
    kap.appendChild(alan);

    const sec = document.createElement('div');
    sec.className = 'kart-secenekler';
    const kontrol = document.createElement('button');
    kontrol.type = 'button';
    kontrol.id = 'okul-kontrol';
    kontrol.className = 'kart-sec';
    kontrol.setAttribute('role', 'switch');
    const kategori = document.createElement('button');
    kategori.type = 'button';
    kategori.id = 'okul-kategori';
    kategori.className = 'kart-sec';
    sec.appendChild(kontrol);
    sec.appendChild(kategori);
    kap.appendChild(sec);

    const hata = document.createElement('p');
    hata.className = 'kart-hata';
    hata.id = 'okul-hata';
    hata.setAttribute('role', 'alert');
    kap.appendChild(hata);
    return { giris, goster, kontrol, kategori, hata };
  }

  AA.kart = { kur, cerceveleriCiz, okulGirisi };
})();
