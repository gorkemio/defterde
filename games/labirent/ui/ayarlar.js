// ui/ayarlar.js — sayfanın üstünde açılan kalem notları: Serbest (tür, boy, karakter, kod) ve Ayarlar (kalem rengi,
// iz bırak). Seçenekler altı çizili sözcükler; seçili olan beyaz. Kalem rengi beş simli kısa çizik. Esc ya da "kapat".
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const $ = (id) => document.getElementById(id);

  const KARAKTER = [['G', 'Uzun koridorlar'], ['P', 'Çok çıkmaz'], ['K', 'Dengeli']];
  const ACIK_TUR = ['D', 'H', 'A', 'T'];

  let O = null;                                 // oyun (ui/oyun.js)

  const NOTLAR = ['not-serbest', 'not-ayarlar', 'not-bolum', 'not-hayalet'];
  function notAc(id) {
    NOTLAR.forEach(x => { if (x !== id) $(x).hidden = true; });
    $(id).hidden = false;
    document.querySelectorAll('[aria-controls]').forEach(b => b.setAttribute('aria-expanded', String(b.getAttribute('aria-controls') === id)));
    LB.marj.altlariCiz($(id));
    const ilk = $(id).querySelector('.dugme.etkin, .dugme:not([disabled])');
    if (ilk) ilk.focus({ preventScroll: true });
  }
  function notKapat(id) {
    if (!id) { NOTLAR.forEach(notKapat); return; }
    $(id).hidden = true;
    const b = document.querySelector(`[aria-controls="${id}"]`);
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  const acikMi = (id) => !$(id).hidden;

  // Bir seçenek satırı: ad + altı çizili sözcükler; tıklayınca sec(deger)
  function satir(kap, ad, secenekler, secili, sec, kapali = []) {
    const p = document.createElement('p');
    p.className = 'not-satir';
    const e = document.createElement('span');
    e.className = 'not-ad gumus';
    e.textContent = ad;
    p.appendChild(e);
    kap.appendChild(p);
    const dugmeler = secenekler.map(([deger, yazi]) => {
      const b = LB.marj.sozcuk(p, null, yazi, { grup: ad, deger });
      if (kapali.includes(deger)) { b.disabled = true; b.title = 'yakında'; }
      if (deger === secili) b.classList.add('etkin');
      b.addEventListener('click', () => { dugmeler.forEach(x => LB.marj.etkin(x, x === b)); sec(deger); });
      return b;
    });
    return dugmeler;
  }

  function serbestKur() {
    const kap = $('serbest-secim'), C = LB.config, s = O.ayar.serbest;
    kap.textContent = '';
    satir(kap, 'tür', Object.keys(C.tur).map(k => [k, C.tur[k]]), s.tur, v => { s.tur = v; O.ayarKaydet(); }, Object.keys(C.tur).filter(k => !ACIK_TUR.includes(k)));
    satir(kap, 'boy', Object.keys(C.boy).map(k => [k, C.boy[k].ad]), s.boy, v => { s.boy = v; O.ayarKaydet(); });
    satir(kap, 'karakter', KARAKTER, s.karakter, v => { s.karakter = v; O.ayarKaydet(); });
    kodYaz();
  }
  function kodYaz() { const k = $('serbest-kod'); if (O.lab) k.textContent = O.lab.kod; }

  // Kalem rengi: her seçenek kendi renginde kısa simli bir çizik
  function renkKur() {
    const kap = $('renk-secim');
    kap.textContent = '';
    for (const ad of LB.config.renkler) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dugme sozcuk renk';
      b.dataset.deger = ad;
      b.setAttribute('aria-label', window.Kit.jel.SIMLI_AD[ad]);
      b.innerHTML = '<span class="yazi"><canvas width="1" height="1" aria-hidden="true"></canvas></span>';
      kap.appendChild(b);
      const cv = b.querySelector('canvas'), dpr = Math.min(2, devicePixelRatio || 1), w = 46, h = 20;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nok = [];
      for (let x = 6; x <= w - 6; x += 2) nok.push([x, h / 2 + Math.sin(x / 7 + ad.length) * 2.4]);
      window.Kit.jel.yol(ctx, nok, { renk: window.Kit.jel.SIMLI[ad], kalinlik: 7, tohum: ['renk', ad] });
      if (ad === O.ayar.renk) b.classList.add('etkin');
      b.addEventListener('click', () => {
        kap.querySelectorAll('.renk').forEach(x => LB.marj.etkin(x, x === b));
        O.renkSec(ad);
      });
    }
  }

  function kur(oyun) {
    O = oyun;
    serbestKur();
    renkKur();
    const iz = $('iz-secim'), IZ = { acik: true, kapali: false, kucuk: 'kucuk' };
    const izSecili = O.ayar.izBirak === true ? 'acik' : O.ayar.izBirak === 'kucuk' ? 'kucuk' : 'kapali';
    satir(iz, 'iz bırak', [['kucuk', 'Küçük boyda'], ['acik', 'hep'], ['kapali', 'kapalı']], izSecili, v => { O.ayar.izBirak = IZ[v]; O.ayarKaydet(); if (!O.izBirakMi()) LB.yolCiz.izleriSil(); });
    // Görünmez mürekkep (UV) ve hafızası
    satir($('uv-secim'), 'görünmez mürekkep', [['kapali', 'kapalı'], ['acik', 'açık']], O.ayar.uv ? 'acik' : 'kapali', v => O.uvSec(v === 'acik', O.ayar.uvHafiza));
    satir($('uv-secim'), 'UV izi', [['kalir', 'kalır'], ['kaybolur', 'tamamen kaybolur']], O.ayar.uvHafiza ? 'kalir' : 'kaybolur', v => O.uvSec(O.ayar.uv, v === 'kalir'));
    // Hareket ve ses
    satir($('genel-secim'), 'hareket', [['tam', 'tam'], ['az', 'azaltılmış']], O.ayar.azHareket ? 'az' : 'tam', v => { O.ayar.azHareket = v === 'az'; O.ayarKaydet(); window.Kit.kalem.ayar.cizim.animasyon = !O.ayar.azHareket; });
    satir($('genel-secim'), 'ses', [['acik', 'açık'], ['kapali', 'kapalı']], window.Kit.ses.sessiz ? 'kapali' : 'acik', v => { window.Kit.ses.sessizYap(v === 'kapali'); LB.marj.sesCiz(); });
    // Hayalet: rakip seçimi; koşu başlamadıysa hemen, başladıysa bir sonraki koşuda
    satir($('hayalet-secim'), 'rakip', [['yok', 'kapalı'], ['kendi', 'en iyim'], ['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']], O.ayar.hayalet || 'yok', v => {
      O.ayar.hayalet = v === 'yok' ? null : v; O.ayarKaydet();
      if (!O.sure.bas) { O.rakipHazirla(); $('hayalet-not').textContent = ''; }
      else $('hayalet-not').textContent = 'yeni koşuda başlar (Baştan)';
    });
    $('k-hayalet').setAttribute('aria-controls', 'not-hayalet');
    $('k-hayalet').setAttribute('aria-expanded', 'false');
    $('k-hayalet').addEventListener('click', () => (acikMi('not-hayalet') ? notKapat('not-hayalet') : ($('hayalet-not').textContent = '', notAc('not-hayalet'))));
    $('m-serbest').setAttribute('aria-controls', 'not-serbest');
    $('m-serbest').setAttribute('aria-expanded', 'false');
    $('k-ayarlar').setAttribute('aria-controls', 'not-ayarlar');
    $('k-ayarlar').setAttribute('aria-expanded', 'false');
    $('m-serbest').addEventListener('click', () => (acikMi('not-serbest') ? notKapat('not-serbest') : (kodYaz(), notAc('not-serbest'))));
    $('k-ayarlar').addEventListener('click', () => (acikMi('not-ayarlar') ? notKapat('not-ayarlar') : notAc('not-ayarlar')));
    document.querySelectorAll('[data-kapat]').forEach(b => b.addEventListener('click', () => notKapat(b.dataset.kapat)));
    $('serbest-yeni').addEventListener('click', () => LB.modlar.serbest(LB.modlar.rastgeleSerbest()));
    // kod ve link
    const not = (m) => { $('kod-not').textContent = m; };
    $('kod-kopyala').addEventListener('click', async () => not(await LB.kod.kopyala(O.lab.kod) ? 'kod kopyalandı' : 'kopyalanamadı: ' + O.lab.kod));
    $('link-kopyala').addEventListener('click', async () => { const l = LB.kod.link(O.lab.kod); not(await LB.kod.kopyala(l) ? 'link kopyalandı' : l); });
    const kodAc = () => {
      const s = LB.generate.kodOku($('kod-gir').value);
      if (!s) { not('bu kodu tanımadım (ör. D-O-W-7KQ9)'); return; }
      not(''); $('kod-gir').value = '';
      LB.modlar.serbest(s);
    };
    $('kod-ac').addEventListener('click', kodAc);
    $('kod-gir').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kodAc(); } });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') notKapat(); });
    // notun dışına (sayfaya) dokununca not kapanır
    $('alan').addEventListener('pointerdown', () => notKapat(), true);
  }

  const alg = (karakter) => karakter;            // Uzun koridorlar = geri izleme (G), Çok çıkmaz = Prim (P), Dengeli = karışım (K)

  LB.ayarlar = { kur, notAc, notKapat, kodYaz, alg, KARAKTER };
})();
