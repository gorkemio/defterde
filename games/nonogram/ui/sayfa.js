// ui/sayfa.js — sayfanın DOM tarafı: yerleşim (--sq, konumlar), başlık, marj (süre, hata, ipucu, araçlar, silgiler,
// kuru boya kutusu, ipucu notu), komut sözcükleri, notlar, resmin adı, bitiş kartı, sayfa yırtılması.
(function () {
  'use strict';
  const KK = window.KK;
  const KL = Kit.kalem;
  const $ = (id) => document.getElementById(id);
  const S = { yer: null, kutu: null, silgiler: [], notZaman: 0, acikNot: null };

  const dokunmatik = () => window.matchMedia('(pointer: coarse)').matches;
  function duyur(m) { const d = $('duyuru'); d.textContent = ''; setTimeout(() => { d.textContent = m; }, 30); }

  function konumla(el, r, sq) {
    el.style.left = r.x * sq + 'px'; el.style.top = r.y * sq + 'px';
    el.style.width = r.w * sq + 'px'; el.style.height = r.h * sq + 'px';
  }
  function sayfaBoyu(y) {
    const s = $('sayfa'), html = document.documentElement;
    html.style.setProperty('--sq', y.sq + 'px');
    s.style.setProperty('--marj-x', y.marjX * y.sq + 'px');
    s.style.width = y.Wsq * y.sq + 'px';
    s.classList.toggle('dikey', y.duzen === 'dikey'); s.classList.toggle('genis', y.duzen !== 'dikey');
    $('defter').classList.toggle('dikey', y.duzen === 'dikey');
  }

  // Oyun ekranı yerleşimi
  function yerlestir(b) {
    const { vw, vh } = KL.alan(), dar = vw < 720;
    // dar ekranda ipucu bantları daha sıkı (rakam 28 px karede 14 px)
    KK.config.ipucuBoyut = dar ? .5 : .56; KK.config.ipucuAralik = dar ? .68 : .7; KK.config.ipucuAdim = dar ? .64 : .72;
    const bn = KK.yerlesim.bantlar(b);
    const y = KK.yerlesim.yerlesim({ vw, vh, en: b.en, boy: b.boy, ...bn, dokunmatik: dokunmatik(), cocuk: KK.oyun.ayar.cocuk });
    y.bantlar = bn;
    S.yer = y;
    sayfaBoyu(y);
    $('sayfa').style.height = y.Hsq * y.sq + 'px';
    konumla($('baslik'), y.baslik, y.sq); konumla($('marj'), y.marj, y.sq); konumla($('alan'), y.alan, y.sq);
    konumla($('ad'), y.ad, y.sq); konumla($('komutlar'), y.komutlar, y.sq);
    requestAnimationFrame(() => cizgileriCiz(true));
    return y;
  }

  function cizgileriCiz(anlik) {
    document.querySelectorAll('#komutlar .dugme, .not:not([hidden]) .dugme').forEach((b, i) => KL.dugmeAltiCiz(b, anlik ? 0 : i * 40, anlik));
    araclariCiz();
    sesCiz();
  }
  function araclariCiz() {
    document.querySelectorAll('#araclar .arac').forEach(b => {
      const sec = b.dataset.arac === KK.oyun.ayar.arac;
      b.setAttribute('aria-checked', sec ? 'true' : 'false');
      if (sec) KL.dugmeAltiCiz(b, 0, true);
    });
  }
  // Ses kapalıyken sözcüğün üstü kalemle çizilir
  function sesCiz() {
    const b = $('k-ses'), acik = KK.oyun.ayar.ses;
    b.setAttribute('aria-pressed', acik ? 'true' : 'false');
    b.classList.toggle('kapali', !acik);
    let svg = b.querySelector('svg.ustu-cizgi');
    if (svg) svg.remove();
    if (acik) return;
    svg = KL.svgEl('svg', { class: 'ustu-cizgi', 'aria-hidden': 'true' });
    b.appendChild(svg);
    const w = b.offsetWidth, h = b.offsetHeight;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    const K = KL.kalemYap(svg), y = b.querySelector('.yazi'), bb = y.getBoundingClientRect(), kb = b.getBoundingClientRect(), o = kb.width ? w / kb.width : 1;
    const x1 = (bb.left - kb.left) * o - 2, x2 = x1 + bb.width * o + 4, yy = (bb.top - kb.top + bb.height * .55) * o;
    K.cizgi(svg, [x1, yy + 2, x2, yy - 2], { stroke: '#b4382e', strokeWidth: 1.6 }, ['ses-kapali'], { anlik: true, baski: false });
  }

  function oyunAc() {
    document.body.classList.add('oyunda');
    $('oyun-ekrani').hidden = false; $('album-ekrani').hidden = true;
    notKapat();
    $('marj-not').textContent = '';
    baslikYaz();
    $('mod-adi').textContent = KK.config.modAdi[KK.oyun.mod] + (KK.oyun.izle ? ' · izle' : '');
    $('ad-yazi').textContent = ''; $('ad-svg').textContent = '';
    $('bitis-karti').hidden = true;
    $('izle-not').hidden = !KK.oyun.izle;
    silgilerKur();
    kutuKur();
  }
  function baslikYaz() {
    const r = KK.oyun.resim, b = KK.oyun.b, boy = `${b.en}×${b.boy}`;
    let t;
    if (r.gunluk) t = `Günün karalaması · ${Kit.bulmaca.gunluk.tarihYazi(r.gunluk)} · ${boy}`;
    else if (r.tur === 'kilim') t = `${r.ad} · ${boy}`;
    else if (r.tur === 'kendi') t = `${KK.oyun.bitti ? r.ad + ' · ' : ''}${r.cizen ? 'Çizen: ' + r.cizen + ' · ' : ''}${boy}`;
    else if (r.tur === 'ornek') t = `örnek · ${boy}`;
    else {
      const d = KK.resimler.yukle().defterler.find(x => x.id === r.defter);
      const sira = d ? d.resimler.findIndex(x => x.id === r.id) + 1 : 0;
      t = `${d ? d.ad : ''} · ${sira}. resim · ${boy}`;
    }
    $('bulmaca-adi').textContent = t;
    document.title = 'Kare Karalamaca';
  }

  function bilgiGuncelle() {
    const O = KK.oyun;
    if (!O.kr) return;
    $('bilgi-sure').textContent = Kit.bulmaca.gunluk.sureYazi(O.kr.ms());
    $('bilgi-hata').textContent = `hata ${O.hata}`;
    $('bilgi-ipucu').textContent = `ipucu ${O.ipucu}`;
    $('k-geri').disabled = !O.gecmis || !O.gecmis.geriVar || O.bitti;
    $('k-yinele').disabled = !O.gecmis || !O.gecmis.ileriVar || O.bitti;
    $('k-ipucu').disabled = O.bitti; $('k-kontrol').disabled = O.bitti || O.mod !== 'klasik';
  }

  // İpucu açıklaması: geniş ekranda marja, telefonda alttaki not kağıdına
  function ipucuNotu(metin) {
    if (S.yer && S.yer.duzen === 'defter') { $('marj-not').textContent = metin; return; }
    $('ipucu-metin').textContent = metin;
    notAc('ipucu-not', true);
    clearTimeout(S.notZaman);
    S.notZaman = setTimeout(() => { if (S.acikNot === 'ipucu-not') notKapat(); }, 9000);
  }

  // Üç Silgi: marjda üç küçük silgi parçası
  function silgilerKur() {
    const svg = $('silgiler'), O = KK.oyun;
    svg.textContent = '';
    S.silgiler = [];
    svg.style.display = O.mod === 'ucsilgi' && !O.izle ? '' : 'none';
    if (O.mod !== 'ucsilgi') return;
    const sq = S.yer ? S.yer.sq : 24, w = sq * 1.15, h = sq * .62;
    svg.setAttribute('viewBox', `0 0 ${w * 3.6} ${h * 1.9}`);
    const K = KL.kalemYap(svg);
    for (let i = 0; i < 3; i++) {
      const s = Kit.nesne.silgi(K, svg, { x: 3 + i * w * 1.18, y: h * .45, w, h, aci: [-9, 4, -3][i], tohum: ['silgi', i] });
      if (i < 3 - O.silgiKalan) s.kullan(true);
      S.silgiler.push(s);
    }
  }
  function silgiKullan(k) { const s = S.silgiler[k]; if (s) s.kullan(false); }

  // Kuru boya kutusu (geniş ekranda marjda kapalı durur; telefonda bitişte görünür)
  function kutuKur() {
    const svg = $('kutu');
    svg.textContent = '';
    svg.classList.remove('gorunur');
    const w = 112, h = w * .62;
    svg.setAttribute('viewBox', `-2 ${-h * .62} ${w + 4} ${h * 1.66}`);
    S.kutu = Kit.nesne.kuruBoyaKutusu(KL.kalemYap(svg), svg, { x: 0, y: 0, w, tohum: ['kutu'] });
  }
  function kutuAc(anlik) { $('kutu').classList.add('gorunur'); if (S.kutu) S.kutu.ac(anlik); }
  function kutuVurgula(r) { if (S.kutu) S.kutu.vurgula(r); }

  // Resmin altına kurşun kalemle adı
  function adYaz(ad, alt, anlik) {
    const svg = $('ad-svg'), el = $('ad');
    svg.textContent = '';
    const w = el.offsetWidth, h = el.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const boyut = Math.min(h * .72, S.yer.sq * 1.1);
    KL.metinSvg(svg, ad, { x: w / 2, y: h * .5 + boyut * .3, boyut, renk: '#4a4a4a', hiza: 'middle', tohum: ['ad', ad], anlik, adim: 70 });
    if (alt) KL.metinSvg(svg, alt, { x: w / 2 + boyut * ad.length * .3 + 12, y: h * .5 + boyut * .3, boyut: boyut * .6, renk: '#6d6a66', hiza: 'start', tohum: ['alt', alt], anlik: true });
    $('ad-yazi').textContent = ad + (alt ? ' · ' + alt : '');
  }

  // Notlar
  function notAc(id, birak) {
    if (S.acikNot && S.acikNot !== id && !birak) notKapat();
    else if (S.acikNot && S.acikNot !== id) $(S.acikNot).hidden = true;
    const n = $(id);
    n.hidden = false; S.acikNot = id;
    const ac = document.querySelector(`[aria-controls="${id}"]`);
    if (ac) ac.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => n.querySelectorAll('.dugme').forEach((b, i) => KL.dugmeAltiCiz(b, i * 40, false)));
    if (!birak) { const f = n.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
  }
  function notKapat() {
    if (!S.acikNot) return;
    const n = $(S.acikNot);
    n.hidden = true;
    const ac = document.querySelector(`[aria-controls="${S.acikNot}"]`);
    if (ac) { ac.setAttribute('aria-expanded', 'false'); }
    S.acikNot = null;
  }
  // Genel not: içerik + komutlar (dizi: { yazi, f })
  function genelNot(html, komutlar) {
    $('genel-icerik').innerHTML = '';
    if (typeof html === 'string') $('genel-icerik').innerHTML = html; else $('genel-icerik').appendChild(html);
    const k = $('genel-komut');
    k.textContent = '';
    for (const x of komutlar || [{ yazi: 'kapat', f: notKapat }]) {
      const b = document.createElement('button');
      b.className = 'dugme sozcuk'; b.type = 'button';
      b.innerHTML = '<span class="yazi"></span>'; b.firstChild.textContent = x.yazi;
      b.addEventListener('click', x.f);
      k.appendChild(b);
    }
    notAc('genel-not');
  }

  // Bitiş kartı: süre, hata, ipucu
  function bitisKarti(o) {
    const k = $('bitis-karti');
    $('bitis-baslik').textContent = o.baslik;
    $('bitis-bilgi').textContent = o.bilgi;
    $('bitis-ek').textContent = o.ek || '';
    const pm = $('paylasim-metni');
    pm.hidden = true;
    const kom = $('bitis-komut');
    kom.textContent = '';
    for (const x of o.komutlar) {
      const b = document.createElement('button');
      b.className = 'dugme sozcuk'; b.type = 'button';
      b.innerHTML = '<span class="yazi"></span>'; b.firstChild.textContent = x.yazi;
      b.addEventListener('click', x.f);
      kom.appendChild(b);
    }
    k.classList.add('giriyor');
    notAc('bitis-karti');
    requestAnimationFrame(() => requestAnimationFrame(() => k.classList.remove('giriyor')));
  }
  function paylasimGoster(metin) { const pm = $('paylasim-metni'); pm.value = metin; pm.hidden = false; pm.select(); }

  // Üç Silgi: silgiler bitince sayfa yırtılır
  function yirt(sonra) {
    const s = $('sayfa');
    s.classList.add('yirtik');
    setTimeout(() => {
      s.classList.remove('yirtik');
      sonra();
    }, KL.animasyonVar() ? 700 : 420);
  }

  // Süre her saniye
  setInterval(() => { if (KK.oyun && KK.oyun.ekran === 'oyun' && KK.oyun.kr && KK.oyun.kr.calisiyor) $('bilgi-sure').textContent = Kit.bulmaca.gunluk.sureYazi(KK.oyun.kr.ms()); }, 1000);

  // Komutlar
  function kur() {
    const O = KK.oyun;
    $('k-yeni').addEventListener('click', () => KK.defterler.yeniBulmaca());
    $('k-geri').addEventListener('click', () => O.geriAl());
    $('k-yinele').addEventListener('click', () => O.yinele());
    $('k-ipucu').addEventListener('click', () => O.ipucuVer());
    $('k-kontrol').addEventListener('click', () => O.kontrolEt());
    $('k-album').addEventListener('click', () => KK.defterler.ac());
    $('k-ayarlar').addEventListener('click', () => { if (S.acikNot === 'ayarlar') notKapat(); else { KK.ayarlar.ciz(); notAc('ayarlar'); } });
    $('k-ses').addEventListener('click', () => { O.ayarYaz('ses', !O.ayar.ses); Kit.ses.sessizYap(!O.ayar.ses); sesCiz(); if (O.ayar.ses) O.ses('kalem'); });
    $('k-nasil').addEventListener('click', () => { if (S.acikNot === 'nasil') notKapat(); else notAc('nasil'); });
    $('n-izle').addEventListener('click', () => { notKapat(); KK.izle.ogretici(); });
    $('n-bunu-izle').addEventListener('click', () => { notKapat(); if (KK.oyun.resim && !KK.oyun.resim.gunluk) KK.izle.ac(KK.oyun.resim); else KK.sayfa.duyur('Günün karalamasında İzle kapalı.'); });
    document.querySelectorAll('.not .kapat').forEach(b => b.addEventListener('click', () => { notKapat(); $('tahta').focus({ preventScroll: true }); }));
    document.querySelectorAll('#araclar .arac').forEach(b => b.addEventListener('click', () => { O.ayarYaz('arac', b.dataset.arac); araclariCiz(); duyur(b.textContent.trim() + ' seçildi.'); }));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.acikNot) { notKapat(); } });
  }

  KK.sayfa = Object.assign(S, { kur, yerlestir, sayfaBoyu, cizgileriCiz, araclariCiz, sesCiz, oyunAc, baslikYaz, bilgiGuncelle, ipucuNotu, silgilerKur, silgiKullan, kutuKur, kutuAc, kutuVurgula, adYaz, notAc, notKapat, genelNot, bitisKarti, paylasimGoster, yirt, duyur, dokunmatik });
})();
