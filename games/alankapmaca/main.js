// main.js — kontrolör: ölçü, font, sahne ve oyun akışı.
// Oyun kuralları game.js'te, çizim draw.js'te; burada yalnız ikisini birbirine bağlarız.
(function () {
  'use strict';

  const AB = window.AB;
  const C = AB.config, G = AB.game, D = AB.draw;
  document.documentElement.dataset.hiza = C.cizim.duzHiza ? 'duz' : 'serbest';
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const HUCRE = D.HUCRE;
  const kisitla = (v, a, b) => Math.min(b, Math.max(a, v));
  const bekle = (ms) => new Promise(r => setTimeout(r, ms));
  const Ses = AB.ses || { cal() {}, baslat() {}, sessiz: false, sessizYap() {} };   // ses.js yoksa sessiz çalış
  const rastgeleTohum = () => (Math.random() * 4294967296) >>> 0;

  /* ---------- ölçü: 1 defter karesi kaç piksel? ---------- */

  let ekran = null, sayiPaneli = null, yonOncekiOdak = null;
  const kipAl = () => ekran ? ekran.mode : 'genis';
  const darMi = () => kipAl() !== 'genis';

  function olcuHesapla() {
    const once = ekran;
    ekran = AB.layout.olc(C.boyut);
    const kok = document.documentElement;
    kok.dataset.mode = ekran.mode;
    kok.dataset.touch = String(ekran.touch);
    for (const [ad, deger] of Object.entries({ sq: ekran.square, board: C.boyut * ekran.square,
      'page-width': ekran.width, 'page-height': ekran.height, 'viewport-height': ekran.viewportHeight,
      ...Object.fromEntries(Object.entries(ekran.safe).map(([k, v]) => ['safe-' + k, v])) })) {
      kok.style.setProperty('--' + ad, deger + 'px');
    }
    kok.style.setProperty('--n', C.boyut);
    kok.style.setProperty('--v', Math.max(C.boyut, 16));
    return { degisti: !once || ['mode', 'square', 'width', 'height', 'blocked', 'touch'].some(k => once[k] !== ekran[k]) };
  }

  function fontBekle() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const yukle = document.fonts.load('26px "Patrick Hand"', 'AİŞĞÇÖÜıüöç0123456789×').catch(() => {});
    return Promise.race([yukle, new Promise(r => setTimeout(r, 2500))]);
  }

  function roughYok() {
    const p = document.createElement('p');
    p.className = 'uyari';
    p.textContent = 'Kalemim bulunamadı! rough.js yüklenemedi. Oyun dosyalarının eksiksiz olduğunu kontrol edip sayfayı yenile.';
    document.body.prepend(p);
  }

  // SVG kutularının iç ölçüsü (1 kare = 20 birim); style.css'teki boyutlarla birebir aynı oranda.
  function duzen(kip = kipAl()) {
    const n = C.boyut, v = Math.max(n, 16);
    if (kip === 'genis') return { ust: [(n + 7) * 20, 72], hesap: [70, v * 20], skor: [68, 68], ipucu: [136, 48] };   // (n+7)×3.6 · 3.5×v · 3.4×3.4 · 6.8×2.4
    return { ust: [172, 48], hesap: [40, C.boyut * ekran.square], skor: [168, 24], ipucu: [104, 40] };
  }

  /* ---------- oyun durumu ---------- */

  // jeton: oyunun kimliği. "Yeni sayfa" basılınca artar; eski oyunun bekleyen adımları jeton
  // değişmişse sessizce çıkar (yeni tahtaya yazamaz).
  const O = {
    jeton: 0, no: 0, gecis: false,
    oyun: null, r: null, T: null,
    kilit: true,                 // animasyon ve rakip sırası boyunca dokunmayı engeller
    yerlesiyor: false,           // oyuncu dikdörtgeninin yerini seçiyor
    hesaplaniyor: false,         // oyuncu çarpımın sonucunu yazıyor
    yatay: true,                 // hayalet: true = geniş yazım (w ≥ h)
    isaret: null,                // son işaret edilen hücre { s, k }
    hayalet: null,               // çizilen hayalet { s, k, w, h, gecerli }
    sonDokunus: null,            // dokunmayla son seçilen hücre (ikinci dokunuş = çiz)
    sonZar: null,                // ekranda gösterilen zarlar { a, b, tur }
    hesap: null,                 // çetele ve toplam sayacı (çizim için)
    karakterDurum: 'normal',
    ayarAcik: false, ayar: null,  // ayar paneli açık mı · seçili ayarlar (yeni sayfada geçerli)
    zamanlayici: 0, kalan: 0,    // hamle süresi geri sayımı
    balonAcik: false,            // makine düşünüyor (baloncuk açık)
    hazir: false,                // sahne kuruldu: yeniden boyutlama yeniden çizebilir
    ipucuBitti: false,           // ilk atış yapıldı: "zarlara dokun!" ipucu bir daha gösterilmez
    sonucKucuk: false,           // oyun sonu lekesi köşeye küçüldü
    durum: '', durumRenk: 'mavi',
  };

  function duyur(metin) { $('#duyuru').textContent = metin; }   // ekran okuyucu (aria-live)

  function durum(metin, renk = 'mavi') {
    O.durum = metin; O.durumRenk = renk;
    if (metin) D.durumYaz($('#ust'), metin, renk);
    else { const g = $('#ust .durum'); if (g) g.remove(); }
    duyur(metin);
  }

  // Klavye odağı mı (fare tıklamasıyla gelen odakta halka çizilmez)? Eski tarayıcıda :focus-visible yoksa evet say.
  const odakGorunur = (el) => { try { return el.matches(':focus-visible'); } catch (e) { return true; } };

  // Kısa uyarı; yer seçerken biraz sonra "YERİNİ SEÇ"e döner.
  function gecici(metin, renk, ms = 1300) {
    const j = O.jeton;
    durum(metin, renk);
    setTimeout(() => {
      if (j !== O.jeton || O.durum !== metin) return;
      if (O.yerlesiyor) durum('YERİNİ SEÇ');
      else if (O.hesaplaniyor) durum('KAÇ EDER?');
    }, ms);
  }

  const duraklatildi = () => O.ayarAcik || (ekran && ekran.blocked) || document.hidden;
  const akis = AB.akisKur({ jeton: () => O.jeton, duraklatildi });
  const devamEt = akis.devamEt;

  const hedefYon = () => ekran.rotate && ekran.mode === 'alcak' ? 'portrait' : 'landscape';

  function yonGuncelle() {
    const panel = $('#yon-uyarisi'), engel = ekran.blocked;
    const gorunur = engel && !O.ayarAcik, onceGorunur = !panel.hidden;
    if (gorunur && !onceGorunur && !yonOncekiOdak) yonOncekiOdak = document.activeElement;
    $('#defter').dataset.engelli = String(engel);
    $('#defter').inert = engel || O.ayarAcik;
    panel.hidden = !gorunur;
    const dikey = hedefYon() === 'portrait';
    $('#yon-baslik').textContent = ekran.rotate ? (dikey ? 'Cihazını dik çevir' : 'Cihazını yan çevir') : 'Daha fazla ekran alanı gerekiyor';
    $('#yon-metin').textContent = ekran.rotate
      ? `Tahtanın tamamını görmek için ${dikey ? 'dikey' : 'yatay'} oyna. Oyunun ve kalan süren korunuyor.`
      : 'Tam ekranı dene veya ayarlardan daha küçük bir tahta ile yeni sayfa aç. Oyunun ve kalan süren korunuyor.';
    if (gorunur && !onceGorunur) {
      $$('.dugme', panel).forEach(b => D.dugmeCerceve(b, 0, true));
      $('#tam-ekran').focus({ preventScroll: true });
    } else if (!engel && !O.ayarAcik && yonOncekiOdak) {
      const odak = yonOncekiOdak; yonOncekiOdak = null;
      if (odak.isConnected && !odak.disabled) odak.focus({ preventScroll: true });
    }
  }

  async function tamEkranDene() {
    const mesaj = $('#yon-durum'), yon = hedefYon();
    const elleCevir = `Cihazını elle ${yon === 'portrait' ? 'dik' : 'yan'} çevir.`;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock(yon);
      else mesaj.textContent = elleCevir;
    } catch (e) { mesaj.textContent = 'Bu tarayıcı otomatik çevirmeyi desteklemiyor. ' + elleCevir; }
    yenidenBoyutla();
  }

  function arayuzGuncelle() {
    const o = O.oyun;
    const acik = !duraklatildi() && !O.kilit;
    const zarAcik = acik && o.sira === 'ben' && o.asama === 'zar';
    $('#zar-a').disabled = $('#zar-b').disabled = !zarAcik;
    $('#dondur').disabled = $('#ciz').disabled = !(acik && O.yerlesiyor);
    $('#tahta').classList.toggle('etkin', acik && O.yerlesiyor);
    const sorulu = acik && O.hesaplaniyor;
    $('#tamam').disabled = !sorulu;
    $('#giris').disabled = !sorulu;
    $('#tamam').hidden = ekran.touch || !O.hesaplaniyor;
    const once = $('#sayi-paneli').hidden;
    if (sayiPaneli) sayiPaneli(ekran.touch, O.hesaplaniyor, sorulu);
    if (once !== $('#sayi-paneli').hidden) {
      $$('#sayi-paneli .dugme, .dugmeler .dugme').forEach(b => D.dugmeCerceve(b, 0, true));
    }
    $$('.zar, .dugme').forEach(el => { if (el.disabled) D.odakHalkasi(el, false); });
    const giris = $('#giris');
    D.odakHalkasi($('#giris-kap'), !giris.disabled && document.activeElement === giris && odakGorunur(giris));
    yonGuncelle();
    akis.guncelle();
  }
  function kilitle(v) { O.kilit = v; arayuzGuncelle(); }

  function karakter(ad) {
    O.karakterDurum = ad;
    return D.karakterCiz($('#karakter'), ad);
  }
  // SVG öğelerinde .hidden özelliği öznitelik olarak yansımaz: toggleAttribute kullanılır.
  const gizle = (el, v) => el.toggleAttribute('hidden', v);
  function balonAc() { const b = $('#balon'); O.balonAcik = true; gizle(b, false); D.balonBaslat(b, () => Ses.cal('kalem')); }
  function balonKapat() { const b = $('#balon'); O.balonAcik = false; D.balonDurdur(b); gizle(b, true); }

  /* ---------- sahne ---------- */

  // Oyundan bağımsız, bir kez (ya da kip değişince) çizilenler: başlık, düğmeler, köşe karalamaları.
  function sabitleriCiz(anlik) {
    const dar = darMi(), d = duzen();
    D.ustCiz($('#ust'), { genis: d.ust[0], yuk: d.ust[1], dar, kompakt: dar, durum: O.durum, renk: O.durumRenk, gecikme: 100, anlik });

    $$('.dugme').forEach((btn, i) => {
      const yazi = $('.yazi', btn);
      if (yazi) D.harfle(yazi, null, { tohum: ['dugme', btn.id], gecikme: 900 + i * 150, anlik });
      D.dugmeCerceve(btn, 900 + i * 150, anlik);
    });
    D.dugmeCerceve($('#giris-kap'), 1250, anlik);
    sesSimgesiGuncelle(anlik);
    $$('.susler [data-sus]').forEach((s, i) => D.susCiz(s, s.dataset.sus, [0, i], 1800 + i * 250, anlik));
  }

  function zarlariGoster(anlik, gecikme) {
    const rakam = O.oyun.ayar.zar[1] > 6, z = O.sonZar;
    const a = D.zarCiz($('#zar-a svg'), z ? z.a : null, { rakam, tohum: ['a', z ? z.tur : 0], gecikme, anlik });
    const b = D.zarCiz($('#zar-b svg'), z ? z.b : null, { rakam, tohum: ['b', z ? z.tur : 0], gecikme: gecikme + 200, anlik });
    $('#zar-a').setAttribute('aria-label', z ? `Zar: ${z.a}` : 'Zar');
    $('#zar-b').setAttribute('aria-label', z ? `Zar: ${z.b}` : 'Zar');
    return [a.bitti, b.bitti];
  }

  // Geçmişte henüz deftere işlenmemiş kayıtları (çizdi / pas / yanlış / süre) çetele ve hesap sütununa işler.
  // İdempotent: yeniden çizim geçmişi baştan işledikten sonra süren bir akış aynı kaydı ikinci kez yazamaz.
  function hesabaYetis(anlik) {
    const o = O.oyun, h = O.hesap, svg = $('#hesap'), bit = [];
    let yeniAlan = false;
    while (h.islenen < o.gecmis.length) {
      const g = o.gecmis[h.islenen++], sahip = g.sahip;
      if (g.olay === 'cizdi') {
        yeniAlan = true;
        h.sayi[sahip]++;
        h.toplam[sahip] += g.alan;
        bit.push(D.ceteleEkle(svg, sahip, h.sayi[sahip], { anlik }).bitti);
        bit.push(D.hesapYaz(svg, sahip, '+' + g.alan, h.toplam[sahip], { anlik, gecikme: anlik ? 0 : 150 }).bitti);
      } else {
        const yazi = { pas: 'pas', yanlis: 'yanlış', sure: 'süre' }[g.olay];
        if (yazi) bit.push(D.hesapYaz(svg, sahip, yazi, null, { anlik }).bitti);
      }
    }
    $('#hesap').setAttribute('aria-label', `Puan: sen ${o.puan.ben}, makine ${o.puan.rakip}`);
    skorGuncelle(anlik || !yeniAlan);
    return Promise.all(bit);
  }

  function skorGuncelle(anlik) {
    const dar = darMi(), d = duzen();
    D.skorYaz($('#skor'), O.oyun.puan, { genis: d.skor[0], yuk: d.skor[1], dar, anlik });
  }

  // İlk tur ipucu (V3): ilk atışa kadar her oyuncu sırasında; atıldıktan sonra bu oturumda bir daha görünmez.
  function ipucuGoster(anlik) {
    if (O.ipucuBitti) return;
    const dar = darMi(), d = duzen(), svg = $('#ipucu');
    gizle(svg, false);
    D.ipucuCiz(svg, { genis: d.ipucu[0], yuk: d.ipucu[1], dar, kompakt: dar, anlik });
  }
  function ipucuGizle(bitti) {
    if (bitti) O.ipucuBitti = true;
    gizle($('#ipucu'), true);
  }

  // Oyuna bağlı her şeyi (tahta, çetele, zarlar, karakter) oyun durumundan baştan çizer.
  // Oyun sürerken (kip değişince) anlik=true: geçmiş animasyonsuz yeniden çizilir.
  function oyunuCiz(anlik) {
    const o = O.oyun, d = duzen();
    const bitenler = [];
    O.T = D.tahtaKur($('#tahta'), o.n);
    bitenler.push(D.cerceveCiz(O.T, 300, anlik).bitti);
    o.dikdortgenler.forEach(r => D.dikdortgenCiz(O.T, r, { tohum: [O.no], anlik: true }));

    bitenler.push(D.ceteleKur($('#hesap'), { genis: d.hesap[0], yuk: d.hesap[1], gecikme: 500, anlik }).bitti);
    O.hesap = { sayi: { ben: 0, rakip: 0 }, toplam: { ben: 0, rakip: 0 }, islenen: 0 };
    hesabaYetis(true);

    bitenler.push(...zarlariGoster(anlik, 800));
    bitenler.push(D.karakterCiz($('#karakter'), O.karakterDurum, { gecikme: 1300, anlik }).bitti);
    if (o.asama === 'bitti') {
      sonucuCiz(true);
      if (O.sonucKucuk) D.sonucKucult(O.T, true, { anlik: true });
      D.toplamCiz($('#hesap'), { anlik: true });
    }
    return Promise.all(bitenler);
  }

  /* ---------- oyun akışı ---------- */

  function oyunKur() {
    zamanlayiciDurdur();
    const boyutOnce = C.boyut;
    ayarUygula();                                           // ayar paneli seçimleri yeni sayfada geçerli olur
    if (C.boyut !== boyutOnce) { olcuHesapla(); sabitleriCiz(true); }
    const j = ++O.jeton;
    O.no++;
    O.oyun = G.yeniOyun(C);
    O.r = G.rng(rastgeleTohum());
    O.sonZar = null;
    O.karakterDurum = 'normal';
    O.yerlesiyor = false; O.hesaplaniyor = false; O.hayalet = null; O.isaret = null; O.sonDokunus = null;
    O.sonucKucuk = false;
    balonKapat();
    cevapKapat();
    ipucuGizle(false);
    kilitle(true);
    durum('');
    oyunuCiz(false).then(() => sonrakiSira(j));
  }

  async function sonrakiSira(j) {
    if (!await devamEt(j)) return;
    const o = O.oyun;
    cevapKapat();
    if (o.asama === 'bitti') { bitir(); return; }
    if (o.sira === 'ben') { durum('ZARI AT'); kilitle(false); zamanlayiciBaslat(j); ipucuGoster(false); }
    else { ipucuGizle(false); aiSirasi(j); }
  }

  // İki zarı yuvarlar (G.zarAt sonucu zaten belli); bitince son yüzler kalemle çizilmiş olur.
  function zarlariYuvarla(sonuc) {
    const o = O.oyun, tur = o.tur, rakam = o.ayar.zar[1] > 6, aralik = o.ayar.zar;
    O.sonZar = { a: sonuc.a, b: sonuc.b, tur };
    Ses.cal('zar');
    $('#zar-a').setAttribute('aria-label', `Zar: ${sonuc.a}`);
    $('#zar-b').setAttribute('aria-label', `Zar: ${sonuc.b}`);
    return Promise.all([
      D.zarYuvarla($('#zar-a svg'), sonuc.a, { aralik, rakam, tohum: ['a', tur] }),
      D.zarYuvarla($('#zar-b svg'), sonuc.b, { aralik, rakam, tohum: ['b', tur] }),
    ]);
  }

  async function zarlaraDokun() {
    const o = O.oyun;
    if (duraklatildi() || O.kilit || o.sira !== 'ben' || o.asama !== 'zar') return;
    kilitle(true);
    ipucuGizle(true);
    const j = O.jeton;
    const sonuc = G.zarAt(o, O.r);
    await zarlariYuvarla(sonuc);
    if (!await devamEt(j)) return;
    if (!sonuc.sigar) await pasIsle('ben', 'yer', j);
    else if (o.asama === 'hesap') hesapSor();
    else yerlestirmeAc();
  }

  // Sıra pas geçer: tahtaya not düşer, kısa bekleme, sıra geçer, hesap sütununa yazılır.
  // tur 'yer': zar hiçbir yere sığmıyor ("yer yok", art arda iki pas oyunu bitirir).
  // tur 'sure': hamle süresi doldu (sıra kaybı; art arda pas sayılmaz).
  async function pasIsle(sahip, tur, j) {
    if (!await devamEt(j)) return;
    const ben = sahip === 'ben', ink = ben ? 'mavi' : 'kirmizi', sure = tur === 'sure';
    if (ben) zamanlayiciDurdur();
    durum(sure ? 'SÜRE DOLDU, PAS' : ben ? 'YER YOK, PAS' : 'MAKİNE PAS GEÇTİ', sure ? 'kirmizi' : ink);
    Ses.cal('pas');
    const not = D.notDus(O.T, sure ? 'süre doldu, pas' : 'yer yok, pas', ink, { tohum: [O.oyun.tur] });
    await bekle(1300);
    if (!await devamEt(j)) return;
    D.notKaldir(not.node);
    if (sure) G.sureDoldu(O.oyun); else G.pasGec(O.oyun);
    await hesabaYetis(false);
    if (!await devamEt(j)) return;
    await bekle(300);
    sonrakiSira(j);
  }

  // Çizilen dikdörtgeni tahtaya, hamleyi çetele ve hesap sütununa işler.
  async function hamleyiCiz(d, j) {
    const buyuk = d.alan >= Math.ceil(0.65 * O.oyun.ayar.zar[1] ** 2);   // zarın en büyük çarpımının ~%65'i ve üstü
    if (buyuk) karakter(d.sahip === 'ben' ? 'saskin' : 'sevincli');
    Ses.cal('kalem'); Ses.cal('kalem', 260);
    await D.dikdortgenCiz(O.T, d, { tohum: [O.no] }).bitti;
    if (!await devamEt(j)) return;
    if (d.sahip === 'rakip') {                              // makinenin hamlesi kısa süre kalemle halkalanır
      const halka = D.sonHamleIsaret(O.T, d);
      setTimeout(() => D.notKaldir(halka.node), 1800);
    }
    Ses.cal('kalem');
    await hesabaYetis(false);
    if (!await devamEt(j)) return;
    await bekle(300);
  }

  /* ---------- çarpım sorusu ---------- */

  // Soru kutusunu açar: "a × b =" ve cevap kutusu çizilir. insan=false: makinenin hesabı (kırmızı kalem).
  function cevapAc(a, b, insan) {
    const kap = $('#cevap'), kutu = $('#giris-kap');
    gizle(kap, false);
    Ses.cal('kalem');
    kap.classList.toggle('rakip', !insan);
    kutu.dataset.murekkep = insan ? 'mavi' : 'kirmizi';
    gizle($('#tamam'), !insan || ekran.touch);
    $('#giris').value = '';
    $('#giris').placeholder = insan ? '?' : '';          // makinenin kutusunda gri "?" cevabın üstüne binmesin
    $('#giris').setAttribute('aria-label', insan ? `${a} çarpı ${b} kaç eder?` : `Makinenin hesabı: ${a} çarpı ${b}`);
    D.isaretTemizle(kutu);
    D.harfle($('#soru'), `${a} × ${b} =`, { tohum: ['soru', O.oyun.tur], adim: 25 });
    D.dugmeCerceve(kutu, 0, false);
    if (insan) D.dugmeCerceve($('#tamam'), 150, false);
  }
  function cevapKapat() { gizle($('#cevap'), true); }

  function hesapSor() {
    const { a, b } = O.oyun.zar;
    O.hesaplaniyor = true;
    durum('KAÇ EDER?');
    cevapAc(a, b, true);
    kilitle(false);
    const j = O.jeton;
    setTimeout(() => { if (j === O.jeton && O.hesaplaniyor && !duraklatildi()) $('#giris').focus({ preventScroll: true }); }, 500);
  }

  async function cevapGonder() {
    if (!O.hesaplaniyor || O.kilit || duraklatildi()) return;
    const cevap = $('#giris').value.trim();
    if (cevap === '') { gecici('BİR SAYI YAZ', 'kirmizi'); $('#giris').focus(); return; }   // boş cevap hak yemez
    kilitle(true);                                          // ilk await'ten önce: çift dokunmayı engeller
    O.hesaplaniyor = false;
    arayuzGuncelle();
    const j = O.jeton, o = O.oyun, kutu = $('#giris-kap');
    const s = G.cevapVer(o, cevap);
    $('#giris').blur();
    if (s.sonuc !== 'tekrar') gizle($('#tamam'), true);    // işaretlere (tik, düzeltme) yer açılır

    if (s.sonuc === 'dogru') {
      Ses.cal('tik');
      await D.cevapIsaretle(kutu, 'dogru', s.dogruCevap).bitti;
      if (!await devamEt(j)) return;
      await bekle(250);
      if (await devamEt(j)) yerlestirmeAc();
    } else if (s.sonuc === 'tekrar') {                      // hak kaldı: karalanır, kutu temizlenir, yeniden denenir
      durum('YANLIŞ, TEKRAR DENE', 'kirmizi');
      Ses.cal('yanlis');
      await D.cevapIsaretle(kutu, 'yanlis', s.dogruCevap).bitti;
      await bekle(600);
      if (!await devamEt(j)) return;
      $('#giris').value = '';
      D.isaretTemizle(kutu);
      O.hesaplaniyor = true;
      kilitle(false);
      durum('KAÇ EDER?');
      $('#giris').focus();
    } else if (s.sonuc === 'ceza') {                        // doğru cevap kırmızıyla üstüne yazılır, sıra rakibe geçer
      zamanlayiciDurdur();
      karakter('sevincli');
      durum('YANLIŞ! SIRA MAKİNEDE', 'kirmizi');
      Ses.cal('yanlis');
      await D.cevapIsaretle(kutu, 'ceza', s.dogruCevap).bitti;
      if (!await devamEt(j)) return;
      await hesabaYetis(false);
      await bekle(1100);
      sonrakiSira(j);
    } else {                                                // affedildi: ceza kapalı, doğrusu gösterilir ve yine de çizilir
      durum(`DOĞRUSU ${s.dogruCevap}`, 'kirmizi');
      Ses.cal('yanlis');
      await D.cevapIsaretle(kutu, 'affedildi', s.dogruCevap).bitti;
      await bekle(900);
      if (await devamEt(j)) yerlestirmeAc();
    }
  }

  /* ---------- oyuncu: yer seçme ---------- */

  function yerlestirmeAc() {
    O.yerlesiyor = true;
    O.yatay = true;
    O.isaret = null; O.hayalet = null; O.sonDokunus = null;
    durum('YERİNİ SEÇ');
    kilitle(false);
    $('#tahta').focus({ preventScroll: true });             // klavye ve ekran okuyucu yerini kaybetmesin
  }

  const hayaletBoyu = () => {
    const { a, b } = O.oyun.zar, buyuk = Math.max(a, b), kucuk = Math.min(a, b);
    return O.yatay ? { w: buyuk, h: kucuk } : { w: kucuk, h: buyuk };
  };

  // Hayaletin sol üst köşesi işaret edilen hücreye gelir; tahtadan taşacaksa içeri kaydırılır.
  // duyurulsun: klavye/dokunma ile seçimde konum ekran okuyucuya söylenir (fareyle gezinirken değil).
  function hayaletGuncelle(duyurulsun = false) {
    const o = O.oyun;
    if (!O.isaret) return;
    const { w, h } = hayaletBoyu();
    const s = kisitla(O.isaret.s, 0, o.n - h), k = kisitla(O.isaret.k, 0, o.n - w);
    const yeni = { s, k, w, h, gecerli: G.yerlestirilebilir(o, s, k, w, h, 'ben') };
    const ayni = O.hayalet && Object.keys(yeni).every(a => O.hayalet[a] === yeni[a]);
    O.hayalet = yeni;
    if (!ayni) D.hayaletGoster(O.T, s, k, w, h, yeni.gecerli, `${w}×${h}`);
    if (duyurulsun) duyur(hayaletMetni());
  }

  const hayaletMetni = () => {
    const h = O.hayalet;
    return `${h.s + 1}. satır, ${h.k + 1}. sütun: ${h.w}×${h.h} ${h.gecerli ? 'sığar' : 'sığmaz'}`;
  };

  function hayaletKaldir() {
    O.hayalet = null; O.isaret = null;
    D.hayaletSil(O.T);
  }

  function hucreAl(e) {
    const p = D.noktaTahtada(O.T, e), n = O.oyun.n;
    return { s: kisitla(Math.floor(p.y / HUCRE), 0, n - 1), k: kisitla(Math.floor(p.x / HUCRE), 0, n - 1) };
  }

  function dondur() {
    if (!O.yerlesiyor || O.kilit || duraklatildi()) return;
    O.yatay = !O.yatay;
    hayaletGuncelle(true);
  }

  async function ciz() {
    if (!O.yerlesiyor || O.kilit || duraklatildi()) return;
    const hy = O.hayalet;
    if (!hy) { gecici('ÖNCE BİR YER SEÇ', 'kirmizi'); return; }
    if (!hy.gecerli) { gecici('BURAYA SIĞMAZ', 'kirmizi'); return; }
    kilitle(true);                                          // ilk await'ten önce: çift dokunmayı engeller
    O.yerlesiyor = false;
    zamanlayiciDurdur();
    const j = O.jeton;
    durum('SEN ÇİZİYORSUN');
    hayaletKaldir();
    O.sonDokunus = null;
    const d = G.yerlestir(O.oyun, hy.s, hy.k, hy.w, hy.h);
    await hamleyiCiz(d, j);
    sonrakiSira(j);
  }

  const KAYMA = 10;                                         // px: bundan fazla kayan dokunuş kaydırmadır, seçim değil

  // Dokunmada ilk dokunuş yer seçer, aynı hücreye ikincisi çizer.
  function dokunmaSecimi(e) {
    const h = hucreAl(e);
    const ayni = O.sonDokunus && O.sonDokunus.s === h.s && O.sonDokunus.k === h.k;
    O.sonDokunus = h;
    O.isaret = h;
    hayaletGuncelle();
    if (ayni) ciz();
    else if (O.hayalet.gecerli) { durum("ÇİZ'E BAS"); duyur(`${hayaletMetni()}. Çizmek için aynı yere yine dokun.`); }
    else { gecici('BURAYA SIĞMAZ', 'kirmizi'); duyur(hayaletMetni()); }    // durum yazısından sonra: konum ezilmesin
  }

  function tahtaOlaylari() {
    const svg = $('#tahta');
    let dokunus = null;                                     // { id, x, y }: süren dokunuş
    const yerSecilebilir = () => O.yerlesiyor && !O.kilit && !duraklatildi();
    svg.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') {                      // parmak kaydı: kaydırmadır, dokunuş iptal
        if (dokunus && e.pointerId === dokunus.id && Math.hypot(e.clientX - dokunus.x, e.clientY - dokunus.y) > KAYMA) dokunus = null;
        return;
      }
      if (!yerSecilebilir()) return;
      O.isaret = hucreAl(e);
      hayaletGuncelle();
    });
    svg.addEventListener('pointerleave', (e) => {
      if (O.yerlesiyor && e.pointerType === 'mouse') hayaletKaldir();
    });
    svg.addEventListener('pointerdown', (e) => {
      if (!yerSecilebilir()) return;
      if (e.pointerType === 'mouse') {                      // fare: gezinirken hayalet, tık = çiz
        if (e.button !== 0) return;
        O.isaret = hucreAl(e);
        hayaletGuncelle();
        ciz();
        return;
      }
      dokunus = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    svg.addEventListener('pointercancel', () => { dokunus = null; });   // tarayıcı kaydırmayı devraldı
    svg.addEventListener('pointerup', (e) => {
      if (!dokunus || e.pointerId !== dokunus.id) return;
      const kaydi = Math.hypot(e.clientX - dokunus.x, e.clientY - dokunus.y) > KAYMA;
      dokunus = null;
      if (kaydi || !yerSecilebilir()) return;
      dokunmaSecimi(e);
    });
    svg.addEventListener('click', () => {                   // oyun bittiyse: sonuç lekesi küçülür / büyür
      if (O.oyun.asama !== 'bitti' || !svg.querySelector('.sonuc')) return;   // son hamlenin kendi tıklaması sayılmaz
      O.sonucKucuk = !O.sonucKucuk;
      D.sonucKucult(O.T, O.sonucKucuk);
    });
    svg.addEventListener('contextmenu', (e) => {            // sağ tık: döndür
      if (!O.yerlesiyor) return;
      e.preventDefault();
      dondur();
    });
    svg.addEventListener('focus', () => {                   // klavyeyle gelinirse hayalet ortadan başlar
      if (!yerSecilebilir() || O.hayalet || !odakGorunur(svg)) return;
      const n = O.oyun.n;
      O.isaret = { s: Math.floor(n / 2) - 1, k: Math.floor(n / 2) - 1 };
      hayaletGuncelle(true);
    });
  }

  /* ---------- rakip ---------- */

  // Makine de hesabını yazar: kutuya kırmızıyla çarpımı yazar (çocuğa örnek olur).
  async function makineHesabi(o, sonuc, j) {
    if (!await devamEt(j)) return;
    cevapAc(sonuc.a, sonuc.b, false);
    await bekle(450);                                       // soru ve kutu çizilsin
    if (!await devamEt(j)) return;
    Ses.cal('kalem');
    await D.cevapYaz($('#giris-kap'), String(sonuc.a * sonuc.b), 'ic').bitti;
    if (!await devamEt(j)) return;                          // duraklama biter; yeni oyun açılmışsa eski hesaba yazılmaz
    G.cevapVer(o, sonuc.a * sonuc.b);
  }

  async function aiSirasi(j) {
    if (!await devamEt(j)) return;
    const o = O.oyun;
    durum('MAKİNE DÜŞÜNÜYOR…', 'kursun');
    kilitle(true);
    karakter('dusunuyor');
    balonAc();
    const sonuc = G.zarAt(o, O.r);
    await zarlariYuvarla(sonuc);
    if (!await devamEt(j)) return;
    if (sonuc.sigar && o.asama === 'hesap') await makineHesabi(o, sonuc, j);
    if (!await devamEt(j)) return;
    if (sonuc.sigar) {
      const [a, b] = C.ai.dusunmeMs;
      await bekle(a + Math.random() * (b - a));
    }
    if (!await devamEt(j)) return;
    balonKapat();
    if (!sonuc.sigar) {
      karakter('normal');
      await pasIsle('rakip', 'yer', j);
      return;
    }
    const adaylar = G.yerlesimler(o, sonuc.a, sonuc.b, 'rakip');
    const p = AB.ai.sec(o, adaylar, 'rakip', { zorluk: C.ai.zorluk, agirlik: C.ai.agirlik });
    const d = G.yerlestir(o, p.s, p.k, p.w, p.h);
    durum('MAKİNE ÇİZİYOR', 'kirmizi');
    duyur(`Makine ${d.w} çarpı ${d.h} eşittir ${d.alan} çizdi: ${d.s + 1}. satır, ${d.k + 1}. sütun.`);
    await hamleyiCiz(d, j);
    if (!await devamEt(j)) return;
    karakter('normal');
    sonrakiSira(j);
  }

  // Oyun sonu: tahtanın ortasına düzeltme sıvısı lekesi, üstüne sonuç ve puanlar.
  function sonucuCiz(anlik) {
    const o = O.oyun;
    const [baslik, renk] = o.kazanan === 'ben' ? ['KAZANDIN!', 'mavi'] : o.kazanan === 'rakip' ? ['KAYBETTİN…', 'kirmizi'] : ['BERABERE', 'kursun'];
    const alt = `Sen ${o.puan.ben} · Makine ${o.puan.rakip}`;
    $('#duyuru').textContent = `Oyun bitti. ${baslik} ${alt}`;
    return D.sonucCiz(O.T, baslik, alt, renk, anlik ? 0 : 400, anlik);
  }

  function bitir() {
    zamanlayiciDurdur();
    O.yerlesiyor = false; O.hesaplaniyor = false;
    kilitle(true);
    const o = O.oyun;
    durum('OYUN BİTTİ', 'kursun');
    karakter(o.kazanan === 'rakip' ? 'sevincli' : o.kazanan === 'ben' ? 'uzgun' : 'normal');
    sonucuCiz(false);
    D.toplamCiz($('#hesap'), { gecikme: 700 });
    const j = O.jeton;
    setTimeout(() => {                                      // son tahta incelenebilsin; tahtaya dokununca büyür
      if (j === O.jeton && O.oyun.asama === 'bitti' && !O.sonucKucuk) { O.sonucKucuk = true; D.sonucKucult(O.T, true); }
    }, 3600);
    Ses.cal(o.kazanan === 'ben' ? 'kazan' : o.kazanan === 'rakip' ? 'kaybet' : 'berabere', 600);
    D.dugmeVurgu($('#yeni-sayfa'));
  }

  // "Yeni sayfa" (V10): eski sayfa defterin cildine doğru çevrilir; altındaki sayfada yeni oyun hemen çizilmeye
  // başlar (oyunKur jetonu artırır, süren adımlar durur). Çevirme bitene kadar ikinci basış yok sayılır.
  async function yeniSayfa() {
    if (O.gecis) return;
    O.gecis = true;
    balonKapat();
    const yaprak = D.animasyonVar() ? D.sayfaCevir($('#sayfa')) : null;
    if (yaprak) Ses.cal('sayfa');
    oyunKur();
    if (yaprak) await yaprak.bitti;
    O.gecis = false;
  }

  /* ---------- hamle süresi ---------- */

  function zamanlayiciDurdur() {
    if (O.zamanlayici) { clearInterval(O.zamanlayici); O.zamanlayici = 0; }
    D.sureYaz($('#ust'), null);
  }

  // Oyuncunun sırası başlayınca config.sure saniyelik geri sayım; ayar paneli açıkken durur.
  function zamanlayiciBaslat(j) {
    zamanlayiciDurdur();
    if (!(C.sure > 0)) return;
    O.kalan = C.sure;
    D.sureYaz($('#ust'), O.kalan);
    const tur = O.oyun.tur;
    O.zamanlayici = setInterval(() => {
      if (j !== O.jeton) { zamanlayiciDurdur(); return; }
      if (duraklatildi()) return;
      O.kalan--;
      D.sureYaz($('#ust'), O.kalan);
      if (O.kalan === 10 || O.kalan === 5) duyur(`${O.kalan} saniye kaldı`);
      if (O.kalan <= 0) { zamanlayiciDurdur(); sureDoldu(j, tur); }
    }, 1000);
  }

  // Süre dolunca sıra kaybedilir; animasyon sürüyorsa ya da ayar paneli açıksa önce o beklenir.
  function sureDoldu(j, tur) {
    if (j !== O.jeton || tur !== O.oyun.tur) return;
    const o = O.oyun;
    if (o.sira !== 'ben' || o.asama === 'bitti') return;
    if (O.kilit || duraklatildi()) { setTimeout(() => sureDoldu(j, tur), 250); return; }
    kilitle(true);
    O.yerlesiyor = false; O.hesaplaniyor = false;
    arayuzGuncelle();
    hayaletKaldir();
    $('#giris').blur();
    pasIsle('ben', 'sure', j);
  }

  /* ---------- ayarlar ---------- */

  // [anahtar, başlık, [[değer, etiket], ...]]
  const AYARLAR = [
    { anahtar: 'zorluk', baslik: 'Zorluk', secenekler: [['kolay', 'kolay'], ['zor', 'zor']] },
    { anahtar: 'hesap', baslik: 'Hesap', secenekler: [['acik', 'açık'], ['kapali', 'kapalı']] },
    { anahtar: 'zar', baslik: 'Zar', secenekler: [['6', '1–6'], ['9', '1–9'], ['12', '1–12']] },
    { anahtar: 'tahta', baslik: 'Tahta', secenekler: [['12', '12'], ['16', '16'], ['20', '20']] },
    { anahtar: 'bitisik', baslik: 'Bitişik', secenekler: [['kapali', 'kapalı'], ['acik', 'açık']] },
    { anahtar: 'sure', baslik: 'Süre', secenekler: [['0', 'yok'], ['20', '20 sn'], ['40', '40 sn']] },
  ];
  const AYAR_ANAHTARI = 'alankapmaca-ayar';

  // Safari file://'da localStorage fırlatabilir: bellek yedeği
  let ayarBellek = null;
  const depoOku = () => { try { return localStorage.getItem(AYAR_ANAHTARI); } catch (e) { return ayarBellek; } };
  const depoYaz = (v) => { ayarBellek = v; try { localStorage.setItem(AYAR_ANAHTARI, v); } catch (e) { /* yoksay */ } };

  const ayarMevcut = () => ({
    zorluk: C.ai.zorluk, hesap: C.hesap.acik ? 'acik' : 'kapali', zar: String(C.zar[1]),
    tahta: String(C.boyut), bitisik: C.bitisiklik ? 'acik' : 'kapali', sure: String(C.sure),
  });

  // Kayıtlı seçimleri okur; geçersiz ya da eksik olanlar config.js varsayılanında kalır.
  function ayarYukle() {
    let kayit = {};
    try { kayit = JSON.parse(depoOku() || '{}') || {}; } catch (e) { kayit = {}; }
    const mevcut = ayarMevcut();
    O.ayar = {};
    for (const a of AYARLAR) {
      O.ayar[a.anahtar] = a.secenekler.some(([d]) => d === kayit[a.anahtar]) ? kayit[a.anahtar] : mevcut[a.anahtar];
    }
  }

  function ayarUygula() {
    const a = O.ayar;
    C.ai.zorluk = a.zorluk;
    C.hesap.acik = a.hesap === 'acik';
    C.zar = [1, +a.zar];
    C.boyut = +a.tahta;
    C.bitisiklik = a.bitisik === 'acik';
    C.sure = +a.sure;
  }

  function ayarPaneliKur() {
    const kap = $('#ay-satirlar');
    for (const a of AYARLAR) {
      const satir = document.createElement('div');
      satir.className = 'ay-satir';
      satir.setAttribute('role', 'radiogroup');
      satir.setAttribute('aria-label', a.baslik);
      const ad = document.createElement('span');
      ad.className = 'ay-ad';
      ad.textContent = a.baslik;
      satir.appendChild(ad);
      const secenekler = document.createElement('span');
      secenekler.className = 'ay-secenekler';
      for (const [deger, etiket] of a.secenekler) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ay-sec';
        b.dataset.anahtar = a.anahtar;
        b.dataset.deger = deger;
        b.setAttribute('role', 'radio');
        b.innerHTML = '<svg aria-hidden="true"></svg><span class="yazi"></span>';
        $('.yazi', b).textContent = etiket;
        secenekler.appendChild(b);
      }
      satir.appendChild(secenekler);
      kap.appendChild(satir);
    }
  }

  // Panel görünür olunca (ölçüler belli) çerçeve, başlık, kutucuklar ve yazılar kalemle çizilir.
  function ayarCiz(anlik = false) {
    const p = $('#ayarlar-paneli');
    D.dugmeCerceve(p, 0, anlik);
    D.baslikCiz($('#ay-baslik'), 'AYARLAR', { gecikme: 150, anlik });
    $$('.ay-ad', p).forEach((el, i) => D.harfle(el, null, { tohum: ['ay-ad', i], gecikme: 250 + i * 70, adim: 25, anlik }));
    $$('.ay-sec', p).forEach((b, i) => {
      const secili = O.ayar[b.dataset.anahtar] === b.dataset.deger;
      b.setAttribute('aria-checked', String(secili));
      b.tabIndex = secili ? 0 : -1;                          // radyo grubu: Tab grup grup, oklar grup içinde
      D.ayarKutusu($('svg', b), secili, { tohum: [b.dataset.anahtar, b.dataset.deger], gecikme: 300 + i * 25, anlik });
      D.harfle($('.yazi', b), null, { tohum: ['ay-sec', b.dataset.anahtar, b.dataset.deger], gecikme: 300 + i * 25, adim: 25, anlik });
    });
    D.harfle($('#ay-not'), 'yeni sayfada geçerli', { tohum: ['ay-not'], gecikme: 900, adim: 20, anlik });
    D.dugmeCerceve($('#ay-kapat'), 950, anlik);
    D.dugmeCerceve($('#ay-yeni'), 950, anlik);
  }

  function ayarSec(anahtar, deger) {
    Ses.cal('kalem');
    O.ayar[anahtar] = deger;
    depoYaz(JSON.stringify(O.ayar));
    $$(`.ay-sec[data-anahtar="${anahtar}"]`).forEach((b) => {
      const secili = b.dataset.deger === deger;
      b.setAttribute('aria-checked', String(secili));
      b.tabIndex = secili ? 0 : -1;
      D.ayarKutusu($('svg', b), secili, { tohum: [anahtar, b.dataset.deger] });
    });
  }

  function ayarAc() {
    if (O.ayarAcik) { ayarKapat(); return; }
    O.ayarAcik = true;
    arayuzGuncelle();
    gizle($('#ayarlar-paneli'), false);
    ayarCiz();
    const secili = $('.ay-sec[aria-checked="true"]', $('#ayarlar-paneli'));
    if (secili) secili.focus({ preventScroll: true });
  }

  function ayarKapat() {
    O.ayarAcik = false;
    gizle($('#ayarlar-paneli'), true);
    arayuzGuncelle();
    $(ekran.blocked ? '#tam-ekran' : '#ayarlar').focus({ preventScroll: true });
  }

  // Panel içinde: oklar radyo grubunda gezer ve seçer; Tab panelden dışarı çıkmaz (odak tuzağı).
  function panelTuslari(e) {
    const b = e.target.closest && e.target.closest('.ay-sec');
    if (b && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const grup = $$(`.ay-sec[data-anahtar="${b.dataset.anahtar}"]`);
      const ileri = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const yeni = grup[(grup.indexOf(b) + (ileri ? 1 : grup.length - 1)) % grup.length];
      ayarSec(yeni.dataset.anahtar, yeni.dataset.deger);
      yeni.focus();
      return;
    }
    if (e.key === 'Tab') {
      const odaklar = $$('#ayarlar-paneli .ay-sec[tabindex="0"], #ay-yeni, #ay-kapat');
      const ilk = odaklar[0], son = odaklar[odaklar.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }
  }

  /* ---------- ses düğmesi ---------- */

  function sesSimgesiGuncelle(anlik) {
    const b = $('#ses-dugme');
    b.setAttribute('aria-pressed', String(Ses.sessiz));       // etiket sabit "Sessiz": basılı = ses kapalı
    D.sesSimgesiCiz($('.ikon', b), !Ses.sessiz, anlik);
  }

  function seslendir() {
    // Tarayıcılar ses için kullanıcı hareketi ister: ilk dokunuşta AudioContext açılır.
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    $('#ses-dugme').addEventListener('click', () => {
      Ses.sessizYap(!Ses.sessiz);
      sesSimgesiGuncelle(false);
      Ses.cal('kalem');                                     // açılırken küçük bir hışırtı duyulur
    });
  }

  /* ---------- olaylar ---------- */

  function dinleyicileriKur() {
    sayiPaneli = AB.keypad({ submit: cevapGonder, enabled: () => O.hesaplaniyor && !O.kilit && !duraklatildi(), announce: duyur });
    $('#tam-ekran').addEventListener('click', tamEkranDene);
    $('#yon-ayarlar').addEventListener('click', ayarAc);
    $('#ay-yeni').addEventListener('click', () => { ayarKapat(); yeniSayfa(); });
    $('#yon-uyarisi').addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const ilk = $('#tam-ekran'), son = $('#yon-ayarlar');
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    });
    document.addEventListener('visibilitychange', () => { if (O.hazir) arayuzGuncelle(); });
    $$('.dugme').forEach((btn) => {
      btn.addEventListener('pointerenter', () => D.dugmeVurgu(btn));
      btn.addEventListener('pointerleave', () => D.dugmeVurguSil(btn));
    });
    // Klavye odağı: kalemle halka (CSS outline yerine); fareyle gelen odakta çizilmez
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest('.dugme, .zar, .ay-sec, .giris-kap');
      if (el && odakGorunur(e.target)) D.odakHalkasi(el, true);
    });
    document.addEventListener('focusout', (e) => {
      const el = e.target.closest && e.target.closest('.dugme, .zar, .ay-sec, .giris-kap');
      if (el) D.odakHalkasi(el, false);
    });
    $('#ayarlar-paneli').addEventListener('keydown', panelTuslari);
    $('#zar-a').addEventListener('click', zarlaraDokun);
    $('#zar-b').addEventListener('click', zarlaraDokun);
    $('#dondur').addEventListener('click', dondur);
    $('#ciz').addEventListener('click', ciz);
    $('#yeni-sayfa').addEventListener('click', yeniSayfa);
    $$('.dugme:not(.ses-dugme)').forEach(b => b.addEventListener('click', () => Ses.cal('kalem')));
    seslendir();
    $('#tamam').addEventListener('click', cevapGonder);
    $('#giris').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cevapGonder(); } });
    $('#giris').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); });
    tahtaOlaylari();
    $('#ayarlar').addEventListener('click', ayarAc);
    $('#ay-kapat').addEventListener('click', ayarKapat);
    $('#ay-satirlar').addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest('.ay-sec') : null;
      if (b) ayarSec(b.dataset.anahtar, b.dataset.deger);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && O.ayarAcik) { ayarKapat(); return; }
      if ((e.target.closest && e.target.closest('input')) || duraklatildi()) return;
      if ((e.key === 'r' || e.key === 'R') && O.yerlesiyor) { dondur(); return; }
      const o = O.oyun;
      if ((e.key === 'Enter' || e.key === ' ') && e.target === $('#tahta') && !O.kilit && o.sira === 'ben' && o.asama === 'zar') {
        e.preventDefault();
        zarlaraDokun();                                     // tahtadayken Enter/boşluk zarı atar
        return;
      }
      if (e.key === 'Enter' && e.target === $('#tahta') && o.asama === 'bitti' && $('#tahta .sonuc')) {
        O.sonucKucuk = !O.sonucKucuk;
        D.sonucKucult(O.T, O.sonucKucuk);
        return;
      }
      if (!O.yerlesiyor || O.kilit) return;
      const yon = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (yon) {                                            // ok tuşları hayaleti taşır (ilk basış ortadan başlatır)
        e.preventDefault();
        const n = O.oyun.n, ta = O.hayalet || O.isaret;
        O.isaret = ta
          ? { s: kisitla(ta.s + yon[0], 0, n - 1), k: kisitla(ta.k + yon[1], 0, n - 1) }
          : { s: Math.floor(n / 2) - 1, k: Math.floor(n / 2) - 1 };
        hayaletGuncelle(true);
      } else if (e.key === 'Enter' && O.hayalet && !(e.target.closest && e.target.closest('button'))) {
        e.preventDefault();
        ciz();                                              // Enter çizer (düğmede odaktayken düğmenin kendi işi)
      }
    });
  }

  // Sahneyi oyun durumundan baştan çizer (kip değişince, geç gelen fontla). Süren akışlar jeton ve
  // idempotent hesap sayesinde güvenle devam eder; baloncuk yerinde kalır.
  function sahneyiYenile() {
    sabitleriCiz(true);
    O.hayalet = null;
    oyunuCiz(true);
    if (O.yerlesiyor && O.isaret) hayaletGuncelle();
    arayuzGuncelle();
    if (O.zamanlayici) D.sureYaz($('#ust'), O.kalan);
    if (O.ayarAcik) ayarCiz(true);
    if (!$('#ipucu').hasAttribute('hidden')) ipucuGoster(true);
  }

  // Ölçü değişince: kip (dar/geniş) değiştiyse sahne baştan; yalnız boyut değiştiyse düğme çerçeveleri.
  let bekleyen = 0;
  function yenidenBoyutla() {
    cancelAnimationFrame(bekleyen);
    bekleyen = requestAnimationFrame(() => {
      const o = olcuHesapla();
      if (!O.hazir) return;                                 // sahne kurulmadan: yalnız ölçü güncellenir
      if (o.degisti) sahneyiYenile();
      else arayuzGuncelle();
    });
  }

  const fontVar = () => !document.fonts || !document.fonts.check || document.fonts.check('26px "Patrick Hand"');

  async function basla() {
    if (typeof rough === 'undefined') { roughYok(); return; }
    ayarYukle();
    ayarUygula();
    olcuHesapla();
    window.addEventListener('resize', yenidenBoyutla);      // beklemeler sürerken dönen ekran da ölçülsün
    window.addEventListener('orientationchange', yenidenBoyutla);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', yenidenBoyutla);
    document.addEventListener('fullscreenchange', yenidenBoyutla);
    await fontBekle();
    const fontGecikti = !fontVar();
    await D.varlikYukle();                                  // assets/ içindeki isteğe bağlı PNG'ler
    olcuHesapla();
    O.oyun = G.yeniOyun(C);
    sabitleriCiz(false);
    ayarPaneliKur();
    dinleyicileriKur();
    oyunKur();
    O.hazir = true;
    if (fontGecikti && document.fonts && document.fonts.load) {   // font sonradan gelirse ölçüler onunla yenilenir
      document.fonts.load('26px "Patrick Hand"').then(() => { if (fontVar()) { olcuHesapla(); sahneyiYenile(); } }).catch(() => {});
    }
    AB.durum = O;                                           // konsoldan denemek için
  }

  basla();
})();
