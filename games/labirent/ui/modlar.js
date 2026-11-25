// ui/modlar.js — modlar: Günün labirenti (açılış), Bölümler (üç defter × 20 seviye), Serbest. Moda göre künye, adres,
// kayıt ve bitiş sonrası komutlar ("Sonraki seviye", "Paylaş"). Sonsuz Faz 5'te.
//   baglam: { mod: 'gunun', tarih } | { mod: 'bolum', tur, seviye } | { mod: 'serbest' }
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const $ = (id) => document.getElementById(id);
  const M = () => LB.marj, D = () => LB.depo, K = () => LB.kod;

  /* ---------- açma ---------- */

  function gunun(anlik) {
    const tarih = K().bugun(), spec = K().gunun(tarih), b = { mod: 'gunun', tarih };
    anlik ? LB.oyun.yukle(spec, b) : LB.oyun.ac(spec, b);
  }
  function bolum(tur, seviye, anlik) {
    const v = LB.BOLUMLER[tur][seviye - 1], b = { mod: 'bolum', tur, seviye };
    anlik ? LB.oyun.yukle(G().kodOku(v.kod), b) : LB.oyun.ac(G().kodOku(v.kod), b);
  }
  function sonsuz(anlik) {
    const t = Math.floor(Math.random() * 1e9);
    anlik ? LB.sonsuz.yukle(t) : LB.oyun.sayfaCevir(() => LB.sonsuz.yukle(t));
  }
  function serbest(spec, anlik) { anlik ? LB.oyun.yukle(spec, { mod: 'serbest' }) : LB.oyun.ac(spec, { mod: 'serbest' }); }
  const G = () => LB.generate;

  function rastgeleSerbest() {
    const s = LB.oyun.ayar.serbest;
    return { tur: s.tur, boy: s.boy, alg: s.karakter, tohum: Math.floor(Math.random() * LB.rng.TOHUM_EN) };
  }

  /* ---------- ilerleme (Bölümler) ---------- */

  const ilerleme = () => Object.assign({ D: [], H: [], A: [], T: [] }, D().oku('bolum') || {});
  const cozulduMu = (tur, s) => ilerleme()[tur].includes(s);
  const acikMi = (tur, s) => s === 1 || cozulduMu(tur, s - 1);
  function coz(tur, s) { const p = ilerleme(); if (!p[tur].includes(s)) { p[tur].push(s); p[tur].sort((a, b) => a - b); D().yaz('bolum', p); } }

  /* ---------- oyun kancaları ---------- */

  // Labirent yüklenince: künye, mod satırı, adres
  function yuklendi(O) {
    const C = LB.config, b = O.baglam, lab = O.lab, par = 'par ' + M().sureYaz(O.par);
    let parca;
    if (b.mod === 'gunun') {
      const en = D().oku('gun-' + b.tarih);
      parca = ['Günün labirenti', K().tarihYaz(b.tarih), lab.kod, par].concat(en ? ['en iyin ' + M().sureYaz(en.sure)] : []);
    } else if (b.mod === 'bolum') parca = [`${C.tur[b.tur]} defteri`, `${b.seviye}. seviye`, lab.kod, par];
    else parca = [C.tur[lab.tur], O.spec.W ? lab.grid.W + '×' + lab.grid.H : C.boy[lab.boy].ad, lab.kod, par];
    M().kunye(parca.join(' · '));
    document.querySelectorAll('#modlar .dugme').forEach(x => M().etkin(x, x.dataset.mod === b.mod));
    try { history.replaceState(null, '', b.mod === 'serbest' && !O.spec.W ? '?kod=' + lab.kod : location.pathname); } catch (e) { /* file:// */ }
  }

  // Bitişte kayıt. Döndürür: { onceki, ek, duyuru }. Çözüm görüldüyse rekor sayılmaz.
  function bitti(O, sn) {
    const b = O.baglam, kod = O.lab.kod, rekor = !O.cozumGoruldu, sonuc = { onceki: D().enIyi(kod), ek: [], duyuru: '' };
    if (rekor) D().enIyiYaz(kod, { sure: sn, ipuclu: O.ipuclu, tarih: Date.now(), iz: O.kayit ? LB.ghost.sikistir(O.kayit) : null });
    if (b.mod === 'gunun') {
      const a = 'gun-' + b.tarih, eski = D().oku(a);
      sonuc.onceki = eski || null;
      if (rekor && (!eski || sn < eski.sure)) D().yaz(a, { sure: sn, ipuclu: O.ipuclu, par: O.par });
    } else if (b.mod === 'bolum') {
      coz(b.tur, b.seviye);
      sonuc.ek.push({ metin: `${b.seviye}. seviye tamam` });
      if (b.seviye < LB.config.bolum.seviye) sonuc.duyuru = `${b.seviye + 1}. seviye açıldı.`;
      bolumNotKur();
    }
    return sonuc;
  }

  // Bitişte "İpucu" ve "Çözümü göster"in anlamı kalmaz: yerlerini moda göre "Sonraki seviye" ya da "Paylaş" alır
  // (komut satırı uzamaz, labirent zıplamaz)
  function sonrasiGizle() {
    $('k-sonraki').hidden = true; $('k-paylas').hidden = true;
    $('k-ipucu').hidden = false; $('k-cozum').hidden = false;
    M().altlariCiz($('komutlar'));
  }
  function sonrasiGoster(O) {
    const b = O.baglam;
    $('k-ipucu').hidden = true; $('k-cozum').hidden = true;
    if (b.mod === 'bolum' && b.seviye < LB.config.bolum.seviye) $('k-sonraki').hidden = false;
    if (b.mod === 'gunun') $('k-paylas').hidden = false;
    M().altlariCiz($('komutlar'));
  }

  async function paylas() {
    const O = LB.oyun, b = O.baglam;
    if (b.mod !== 'gunun' || !O.d.bitti) return;
    const metin = K().paylasim({ tarih: b.tarih, sure: O.gecen(), par: O.par, ipuclu: O.ipuclu });
    const ok = await K().kopyala(metin), yazi = $('k-paylas').querySelector('.yazi');
    window.Kit.kalem.harfle(yazi, ok ? 'kopyalandı' : metin, { anlik: true });
    O.duyur(ok ? 'Paylaşım metni kopyalandı: ' + metin : metin);
    setTimeout(() => { window.Kit.kalem.harfle(yazi, 'Paylaş', { anlik: true }); M().altCiz($('k-paylas')); }, ok ? 1600 : 6000);
    M().altCiz($('k-paylas'));
  }

  // Yeni labirent: Serbest'te yeni rastgele; Bölümler'de seviye listesi; Günün'de Serbest'e geçip yeni rastgele
  function yeni() {
    if (LB.sonsuz.aktif) return LB.sonsuz.yeni();
    const b = LB.oyun.baglam;
    if (b.mod === 'bolum') return LB.ayarlar.notAc('not-bolum');
    serbest(rastgeleSerbest());
  }

  /* ---------- Bölümler notu ---------- */

  function bolumNotKur() {
    const kap = $('bolum-liste'), C = LB.config, O = LB.oyun;
    if (!kap) return;
    kap.textContent = '';
    for (const tur of C.bolum.defterler) {
      const satir = document.createElement('div');
      satir.className = 'bolum-defter';
      const ad = document.createElement('p');
      ad.className = 'not-ad gumus';
      ad.textContent = C.tur[tur];
      satir.appendChild(ad);
      const sayilar = document.createElement('p');
      sayilar.className = 'bolum-sayilar';
      satir.appendChild(sayilar);
      for (let s = 1; s <= C.bolum.seviye; s++) {
        const bt = M().sozcuk(sayilar, null, String(s), { tur, seviye: s });
        bt.classList.add('no');
        const cz = cozulduMu(tur, s), acik = acikMi(tur, s), simdi = O.baglam.mod === 'bolum' && O.baglam.tur === tur && O.baglam.seviye === s;
        if (cz) { bt.classList.add('cozuldu'); bt.style.color = window.Kit.jel.SIMLI[O.ayar.renk]; }
        if (simdi) bt.classList.add('etkin');
        if (!acik) { bt.disabled = true; bt.title = 'önceki seviyeyi bitir'; }
        bt.setAttribute('aria-label', `${C.tur[tur]} ${s}. seviye${cz ? ', çözüldü' : acik ? '' : ', kilitli'}`);
        bt.addEventListener('click', () => bolum(tur, s));
      }
      kap.appendChild(satir);
    }
    if (!$('not-bolum').hidden) M().altlariCiz($('not-bolum'));
  }

  function kur() {
    $('m-gunun').addEventListener('click', () => { if (LB.sonsuz.aktif || LB.oyun.baglam.mod !== 'gunun' || LB.oyun.baglam.tarih !== K().bugun()) gunun(); });
    $('m-sonsuz').addEventListener('click', () => { if (!LB.sonsuz.aktif) sonsuz(); });
    $('m-bolum').setAttribute('aria-controls', 'not-bolum');
    $('m-bolum').setAttribute('aria-expanded', 'false');
    $('m-bolum').addEventListener('click', () => ($('not-bolum').hidden ? (bolumNotKur(), LB.ayarlar.notAc('not-bolum')) : LB.ayarlar.notKapat('not-bolum')));
    $('k-yeni').addEventListener('click', yeni);
    $('k-sonraki').addEventListener('click', () => { const b = LB.oyun.baglam; if (b.mod === 'bolum') bolum(b.tur, b.seviye + 1); });
    $('k-paylas').addEventListener('click', paylas);
    bolumNotKur();
  }

  LB.modlar = { kur, gunun, bolum, serbest, sonsuz, rastgeleSerbest, yuklendi, bitti, sonrasiGizle, sonrasiGoster, bolumNotKur, ilerleme, acikMi, cozulduMu, paylas };
})();
