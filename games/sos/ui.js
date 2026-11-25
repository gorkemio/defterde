// ui.js — kontrolör: ölçü, font, sahne ve oyun akışı. Oyun kuralları game.js'te, çizim draw.js ve kit/ altında;
// burada yalnız onları birbirine bağlarız.
// Bilgisayar rakibin hamlesini ai.js seçer (zorluk sayfadaki ayar notundan gelir).
(function () {
  'use strict';

  const SOS = window.SOS, Kit = window.Kit;
  const C = SOS.config, D = SOS.draw, G = SOS.game, KL = Kit.kalem;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const Ses = Kit.ses ? Kit.ses.kur({ anahtar: 'sos-sessiz' }) : { cal() {}, baslat() {}, sessiz: false, sessizYap() {} };   // ses.js yoksa sessiz çalış

  // jeton: oyunun kimliği. "Yeni sayfa" basılınca artar; eski oyunun bekleyen adımları jeton değişmişse sessizce çıkar.
  // kilit: animasyon ve rakip sırası boyunca dokunmayı engeller; ilk await'ten ÖNCE eşzamanlı kurulur (çift dokunma).
  const O = {
    jeton: 0, oyunId: 0, n: C.boyut,
    durum: null,                 // game.js durumu
    gecmis: [],                  // geri alma yığını: insan hamlesinden önceki durumlar
    hamleler: [], ilkBaslayan: 0, // kalıcı kayıtta yalnız hamleler tutulur; skor/geçmiş yeniden hesaplanır
    secili: 'S', seciciSahip: -1,
    kilit: true, gecis: false,
    ayar: { zorluk: C.zorluk, ipucu: C.ipucu, fazlaTur: C.fazlaTur, ikiKisi: C.ikiKisi },   // sayfadaki notlar
    oyunAyar: null,              // aktif kurallar; ilk hamleden sonraki değişiklikler yeni sayfaya ayrılır
    T: null, M: null, B: null, aiKontrol: null, yerlesim: null, karakter: null, sonDurum: '',
    hover: -1,                   // fare (ya da klavye imleci) hangi hücrenin üstünde
    imlec: 0, klavyede: false,   // klavye imleci: hücre indeksi; tahta klavyeyle mi kullanılıyor
    // son hamle işareti: işaretli hücreler; bu turu oynayan ve o turda yazdığı hücreler
    isaret: [], turSahibi: -1, turHamleleri: [],
  };

  /* ---------- ayarların saklanması (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const ANAHTAR = 'sos-ayar';
  let bellek = null;
  function depoOku() {
    try { const s = localStorage.getItem(ANAHTAR); return s ? JSON.parse(s) : bellek; } catch (e) { return bellek; }
  }
  function depoYaz(v) { bellek = v; try { localStorage.setItem(ANAHTAR, JSON.stringify(v)); } catch (e) { /* yoksay */ } }

  function ayarlariYukle() {
    const k = depoOku();
    if (!k || typeof k !== 'object') return;
    if (['kolay', 'orta', 'zor'].includes(k.zorluk)) O.ayar.zorluk = k.zorluk;
    for (const ad of ['ipucu', 'fazlaTur', 'ikiKisi']) if (typeof k[ad] === 'boolean') O.ayar[ad] = k[ad];
  }

  const OYUN_ANAHTAR = 'sos-oyun';
  function kaydiOku() {
    try { return SOS.session.coz(localStorage.getItem(OYUN_ANAHTAR), O.n); }
    catch (e) { return null; }
  }
  function oyunuKaydet() {
    if (!O.durum || O.gecis) return;
    try { localStorage.setItem(OYUN_ANAHTAR, SOS.session.paketle(O)); }
    catch (e) { /* Depolama kapalı/doluysa mevcut oyun bellekte oynanmaya devam eder. */ }
  }
  function kaydiSil() {
    try { localStorage.removeItem(OYUN_ANAHTAR); } catch (e) { /* yoksay */ }
  }

  /* ---------- ölçü ---------- */

  const sayfaBoyu = n => 2 * n + 20;
  const ustGenislik = n => Math.max(2 * n, 14);
  let sonYerlesim = '';
  function olcuHesapla() {
    const { vw, vh } = KL.alan();
    const y = SOS.layout.hesapla(vw, vh, O.n);
    const st = document.documentElement.style;
    st.setProperty('--n', O.n);
    for (const [ad, deger] of Object.entries(y)) {
      if (typeof deger === 'number') st.setProperty('--' + ad.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), deger + 'px');
    }
    document.body.dataset.duzen = y.mod;
    document.body.dataset.kaydir = String(y.kaydir);
    O.yerlesim = y;
    $('#ekran-notu').hidden = !y.kaydir;
    $('#ekran-aciklama').textContent = y.cevir
      ? 'Tüm alanı görmek için cihazını yan çevir. Dikey oynamak için aşağı kaydırabilirsin.'
      : 'Bu ekranda okunaklı oynamak için sayfayı kaydırabilirsin.';
    $('#yatay-oyna').hidden = !y.cevir;
    const anahtar = JSON.stringify(y), degisti = anahtar !== sonYerlesim;
    sonYerlesim = anahtar;
    return degisti;
  }

  function basligiCiz(anlik = true) {
    const y = O.yerlesim, kucuk = y.mod !== 'defter';
    D.ustYaz($('#ust'), kucuk ? y.headerW : 20 * ustGenislik(O.n), 0, anlik, kucuk);
    if (O.durum) durumGoster(true);
  }

  // Yön kilidi yalnız bu kullanıcı dokunuşunda denenir. Safari gibi desteklemeyenlerde elle çevirme kalır.
  async function yatayOyna() {
    const b = $('#yatay-oyna');
    b.disabled = true;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (!screen.orientation || !screen.orientation.lock) throw new Error('Yön kilidi desteklenmiyor');
      await screen.orientation.lock('landscape');
    } catch (e) {
      $('#ekran-aciklama').textContent = 'Otomatik çevirme kullanılamıyor. Cihazının yön kilidini kapatıp elle yan çevir veya aşağı kaydırarak oyna.';
    } finally { b.disabled = false; }
  }

  /* ---------- durum göstergeleri ---------- */

  const iki = () => !!(O.oyunAyar && O.oyunAyar.ikiKisi);
  const insanSirasi = () => iki() || O.durum.sira === 0;

  function etkinGuncelle() {
    $('#tahta-kutu').classList.toggle('etkin', !O.kilit && !O.durum.bitti && insanSirasi());
    // iki kişilik modda kalem imleci sıradaki oyuncunun rengine döner
    const kirmizi = iki() && O.durum.sira === 1;
    document.documentElement.style.setProperty('--kalem-imlec', kirmizi ? 'var(--imlec-kirmizi)' : 'var(--imlec-mavi)');
    erisimGuncelle();
    ipucuGuncelle();
  }

  function erisimGuncelle() {
    if (!O.durum) return;
    if (O.B) O.B.guncelle(O.durum, O.secili, O.kilit || !insanSirasi(), iki());
    $('#ad-mavi').textContent = iki() ? 'mavi' : 'ben';
    $('#ad-kirmizi').textContent = iki() ? 'kırmızı' : 'rakip';
    $('#puan-mavi').textContent = O.durum.puan[0];
    $('#puan-kirmizi').textContent = O.durum.puan[1];
  }

  /* ---------- fare önizlemesi ve ipucu modu ---------- */

  // Seçili harf burada tehlikeli mi? Rakibe tek hamlede yeni bir SOS açıyorsa evet. SOS yapıp fazla tur kazandıran
  // hamle tehlikeli sayılmaz: oyuncu hemen yine oynar ve fırsatı kapatabilir.
  function tehlikeliMi(d, i, harf) {
    const n = d.n, r = Math.floor(i / n), c = i % n;
    if (G.isSafe(d, r, c, harf)) return false;
    return !(d.fazlaTur && G.sosBul(d.hucre, n, i, harf).length > 0);
  }

  // İpucu açıkken, sırası gelen insan için tehlikeli boş hücreleri minik kurşun kalem noktasıyla işaretler.
  function ipucuGuncelle() {
    if (!O.T || !O.durum) return;
    const d = O.durum, liste = [];
    if (O.ayar.ipucu && !O.kilit && !d.bitti && insanSirasi()) {
      for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0 && tehlikeliMi(d, i, O.secili)) liste.push(i);
    }
    D.ipucuCiz(O.T, liste);
  }

  // Fare boş bir hücrenin üstündeyse seçili harf kurşun kalemle silik görünür. Dokunmatikte hover olmadığından çizilmez.
  function onizlemeGuncelle() {
    if (!O.T || !O.durum) return;
    const i = O.hover;
    const uygun = i >= 0 && !O.kilit && !O.durum.bitti && insanSirasi() && O.durum.hucre[i] === 0;
    if (uygun) D.onizlemeGoster(O.T, i, O.secili); else D.onizlemeSil(O.T);
  }

  function geriAlGuncelle() {
    $('#geri-al').disabled = O.kilit || O.gecmis.length === 0;
  }

  function kilitle(v) { O.kilit = v; etkinGuncelle(); geriAlGuncelle(); onizlemeGuncelle(); }

  // Başlığın altındaki kurşun kalem durum satırı. Aynı metin yeniden yazılmaz.
  function durumGoster(zorla) {
    const d = O.durum;
    let t, renk = 'kursun';
    if (d.bitti) t = 'oyun bitti';
    else if (iki()) { t = d.sira === 0 ? 'sıra: mavi' : 'sıra: kırmızı'; renk = d.sira === 0 ? 'mavi' : 'kirmizi'; }
    else t = d.sira === 0 ? 'sıra sende' : 'rakip düşünüyor…';
    if (t === O.sonDurum && !zorla) return;
    O.sonDurum = t;
    D.durumYaz($('#ust'), t, renk);
    $('#duyuru').textContent = t;
  }

  // Seçicideki S/O, sıradaki oyuncunun mürekkebiyle yazılır (yalnız iki kişilik modda kırmızıya döner).
  function seciciRenkle(zorla) {
    const sahip = iki() ? O.durum.sira : 0;
    if (!zorla && sahip === O.seciciSahip) return;
    O.seciciSahip = sahip;
    const dugmeler = $$('.harf-dugme');
    dugmeler.forEach((b, i) => D.seciciCiz(b, b.dataset.harf, sahip, i * 120));
    D.seciciSec(dugmeler, O.secili, 300);
  }

  function sec(harf) {
    if (O.secili === harf) return;
    O.secili = harf;
    oyunuKaydet();
    D.seciciSec($$('.harf-dugme'), harf);
    erisimGuncelle();
    ipucuGuncelle();
    onizlemeGuncelle();
  }

  /* ---------- hamle ---------- */

  // Hücreye harf yazar, SOS çizgilerini ve çeteleyi peş peşe çizer. Oyun durumunu hemen günceller.
  // false dönerse oyun arada değişmiştir ("Yeni sayfa"): çağıran hiçbir şey yapmadan çıkmalı.
  async function uygula(i, harf, j) {
    const onceki = O.durum, n = onceki.n, T = O.T, M = O.M;
    const sahip = onceki.sira;
    if (O.turSahibi !== sahip) { O.turSahibi = sahip; O.turHamleleri = []; }   // yeni tur başladı
    O.turHamleleri.push(i);
    D.birDahaYaz(M, null);                                  // önceki "bir daha!" bu turda silinir
    O.durum = G.placeLetter(onceki, Math.floor(i / n), i % n, harf);
    O.hamleler.push({ i, harf });
    oyunuKaydet();                                         // animasyon/AI beklenirken yenileme de bu hamleyi korur
    erisimGuncelle();
    const yeni = O.durum.son.yeni;
    const kim = iki() ? (sahip === 0 ? 'Mavi' : 'Kırmızı') : (sahip === 0 ? 'Sen' : 'Rakip');   // ekran okuyucu için
    const fazla = !O.durum.son.fazla ? ''
      : iki() ? `, ${kim} bir daha oynuyor` : sahip === 0 ? ', bir daha oynuyorsun' : ', rakip bir daha oynuyor';
    $('#duyuru').textContent = `${kim}: ${harf}, ${G.hucreAdi(Math.floor(i / n), i % n)}` + (yeni.length ? `, ${yeni.length} SOS!` : '') + fazla;

    Ses.cal('kalem');
    await D.harfCiz(T, i, harf, sahip).bitti;
    if (j !== O.jeton) return false;

    if (yeni.length && !iki()) O.karakter.ruh(sahip === 1 ? 'sirit' : 'somurt', 1300);
    const puan = onceki.puan.slice();
    for (const cz of yeni) {                                // aynı hamlede birden fazla SOS: çizgiler peş peşe
      Ses.cal('kalem');
      await D.sosCiz(T, cz).cizgiBitti;
      if (j !== O.jeton) return false;
      Ses.cal('cit');                                       // çizgi tamamlanınca kısa "çıt"
      puan[sahip]++;
      await D.ceteleGuncelle(M, puan);                      // her puanda marja yeni bir çizgi
      if (j !== O.jeton) return false;
    }
    if (O.durum.son.fazla) D.birDahaYaz(M, sahip);
    return true;
  }

  // Beklenmedik bir hata tahtayı kilitli bırakmasın: hata konsola yazılır, oyun aynıysa kilit açılır ve oyuncuya
  // "geri al / yeni sayfa" yolu gösterilir (hata rakibin sırasında olduysa sıra hâlâ ondadır).
  function hataYakala(e, j) {
    if (j !== O.jeton || e.name === 'AbortError') return;
    console.error(e);
    kilitle(false);
    O.sonDurum = '';
    D.durumYaz($('#ust'), 'aksilik oldu · geri al', 'kirmizi');
    $('#duyuru').textContent = 'Bir aksilik oldu. Geri al ya da yeni sayfa aç.';
  }

  async function hucreTik(i) {
    if (O.kilit || O.durum.bitti || !insanSirasi()) return;
    if (O.durum.hucre[i] !== 0) {                           // dolu hücre: harf titrer
      D.harfTitret(O.T, i);
      try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) { /* yoksay */ }
      return;
    }
    kilitle(true);
    const j = O.jeton;
    try {
      O.gecmis.push({ durum: O.durum, isaret: O.isaret, tur: { sahip: O.turSahibi, hamleler: O.turHamleleri.slice() } });
      geriAlGuncelle();
      D.sonHamleSil(O.T);                                   // karşı tarafın son hamle işaretleri bu hamleyle silinir
      O.isaret = [];
      if (!(await uygula(i, O.secili, j))) return;
      await sirayiIlerlet(j);
    } catch (e) { hataYakala(e, j); }
  }

  // Hamle bittikten sonra: oyun bittiyse sonucu yaz; sıra bilgisayardaysa o oynasın (zincir dahil);
  // yoksa sıra insanda: durumu yaz, kilidi aç.
  async function sirayiIlerlet(j) {
    for (;;) {
      if (O.durum.bitti) { bitir(); return; }
      if (iki() || O.durum.sira === 0) break;
      if (!(await rakipOyna(j))) return;
    }
    // Sıra karşı taraftan geldiyse onun bu turda yazdığı harfler işaretlenir (fazla turla devam eden kendini işaretlemez)
    if (O.turSahibi !== -1 && O.turSahibi !== O.durum.sira) {
      O.isaret = O.turHamleleri.slice();
      D.sonHamleIsaretle(O.T, O.isaret);
    }
    durumGoster();
    seciciRenkle();
    kilitle(false);
  }

  /* ---------- bilgisayar rakip ---------- */

  // Karakter düşünür (baloncukta "..."), hamle hesaplanır, 400–800 ms dolunca yazılır. Zor düzeyde son hamlelerdeki
  // arama kısa dilimler arasında tarayıcıya kontrol verir; yeni sayfa hesabı iptal eder.
  async function rakipOyna(j) {
    durumGoster();
    O.karakter.dusun(true, false, O.karakter.ruhAdi === 'sirit');   // az önce SOS yaptıysa sırıtışını bitirsin
    const [a, b] = C.ai.dusunmeMs, hedef = a + Math.random() * (b - a);
    const t0 = performance.now();
    await KL.bekle(40);
    if (j !== O.jeton) return false;
    const kontrol = new AbortController();
    O.aiKontrol = kontrol;
    let hamle;
    try { hamle = await SOS.ai.secAsync(O.durum, { zorluk: O.oyunAyar.zorluk, tamAramaBos: C.ai.tamAramaBos }, Math.random, { signal: kontrol.signal }); }
    finally { if (O.aiKontrol === kontrol) O.aiKontrol = null; }
    if (j !== O.jeton) return false;
    const { i, harf } = hamle;
    await KL.bekle(Math.max(0, hedef - (performance.now() - t0)));
    if (j !== O.jeton) return false;                        // yeni sayfa açıldıysa yeni oyunun karakterine dokunma
    O.karakter.dusun(false);
    return uygula(i, harf, j);
  }

  /* ---------- oyun sonu ---------- */

  function bitir(anlik = false) {
    const d = O.durum, k = G.kazanan(d);
    let baslik, renk;
    if (k === 'berabere') { baslik = 'BERABERE'; renk = 'kursun'; }
    else if (iki()) { baslik = k === 0 ? 'MAVİ KAZANDI!' : 'KIRMIZI KAZANDI!'; renk = k === 0 ? 'mavi' : 'kirmizi'; }
    else if (k === 0) { baslik = 'KAZANDIN!'; renk = 'mavi'; }
    else { baslik = 'KAYBETTİN…'; renk = 'kirmizi'; }
    D.sonucCiz(O.T, baslik, `${d.puan[0]} – ${d.puan[1]}`, renk, anlik ? 0 : 400, anlik);
    durumGoster();
    $('#duyuru').textContent = `${baslik}. Skor: ${d.puan[0]} – ${d.puan[1]}.`;
    if (!iki()) {
      if (k === 1) { O.karakter.ruh('sirit'); O.karakter.konus('hehe', 2600); }
      else if (k === 0) { O.karakter.ruh('somurt'); O.karakter.konus('bir daha?', 2600); }
    }
    if (!anlik && k !== 'berabere') {                       // geri alınırsa veya kayıt yükleniyorsa sonuç sesi çalmaz
      const ses = iki() || k === 0 ? 'kazan' : 'kaybet';
      setTimeout(() => { if (O.durum === d) Ses.cal(ses); }, 700);
    }
    D.dugmeIsaretle($('#yeni-sayfa'), true, anlik);          // "Yeni sayfa"nın çevresinde kurşun kalem çemberi
    D.sonHamleSil(O.T);
    O.isaret = [];
    kilitle(false);                                         // geri alma sonuçtan sonra da çalışır
  }

  /* ---------- geri alma ---------- */

  // Son insan hamlesini ve ardından gelen rakip hamlelerini (zincir dahil) geri alır; sıra insana döner.
  // İki kişilik modda her hamleden önce kayıt alındığı için tek hamle geri gider.
  function geriAl() {
    if (O.kilit || !O.gecmis.length) return;
    Ses.cal('kalem');
    const giris = O.gecmis.pop(), hedef = giris.durum, simdi = O.durum;
    const hedefAnahtar = new Set(hedef.cizgiler.map(z => z.anahtar));
    for (let i = 0; i < simdi.hucre.length; i++) if (simdi.hucre[i] !== 0 && hedef.hucre[i] === 0) D.harfSil(O.T, i);
    for (const z of simdi.cizgiler) if (!hedefAnahtar.has(z.anahtar)) D.sosSil(O.T, z.anahtar);
    D.ceteleGuncelle(O.M, hedef.puan);
    // fazla turun ortasına dönüldüyse "bir daha!" notu geri gelir
    D.birDahaYaz(O.M, hedef.son && hedef.son.fazla ? hedef.son.sahip : null, true);
    D.dugmeIsaretle($('#yeni-sayfa'), false);
    for (const g of $$('.sonuc', O.T.svg)) KL.soldur(g, 250);
    if (!iki()) { O.karakter.dusun(false); O.karakter.ruh('normal'); }
    O.durum = hedef;
    O.hamleler.length = O.n * O.n - hedef.bos;
    oyunuKaydet();
    O.isaret = giris.isaret;                                // o anki son hamle işaretleri geri gelir
    O.turSahibi = giris.tur.sahip;
    O.turHamleleri = giris.tur.hamleler;
    D.sonHamleIsaretle(O.T, O.isaret, true);
    durumGoster(true);
    seciciRenkle();
    etkinGuncelle();
    geriAlGuncelle();
    onizlemeGuncelle();
  }

  /* ---------- ayar notları ---------- */

  function ayarlariCiz(anlik, yalnizca) {
    $$('#ayarlar .ayar').forEach(b => {
      const ad = b.dataset.ayar;
      if (yalnizca && ad !== yalnizca) return;
      if (b.hasAttribute('data-deger')) {
        const secili = O.ayar[ad] === b.dataset.deger;
        b.setAttribute('aria-pressed', String(secili));
        D.ayarCemberi(b, secili, anlik);
      } else {
        b.setAttribute('aria-checked', String(!!O.ayar[ad]));
        D.kutucukCiz($('.kutucuk', b), ad, !!O.ayar[ad], anlik);
      }
    });
  }

  // Başlamış oyunda bekleyen ayarı hem görsel olarak hem erişilebilir açıklamasıyla belirt.
  function yeniNotGuncelle() {
    const a = O.ayar, o = O.oyunAyar;
    const bekliyor = !!o && (a.zorluk !== o.zorluk || a.fazlaTur !== o.fazlaTur || a.ikiKisi !== o.ikiKisi);
    $('#yeni-not').hidden = !bekliyor;
    $('#yeni-not').textContent = bekliyor ? 'Yeni sayfa ile uygulanır.' : '';
    $$('#ayarlar .ayar').forEach(b => {
      const ad = b.dataset.ayar;
      const degisti = !!o && ad !== 'ipucu' && a[ad] !== o[ad]
        && (!b.hasAttribute('data-deger') || a[ad] === b.dataset.deger);
      if (degisti) { b.dataset.bekliyor = 'true'; b.setAttribute('aria-describedby', 'yeni-not'); }
      else { delete b.dataset.bekliyor; b.removeAttribute('aria-describedby'); }
    });
  }

  function ayarTik(b) {
    const ad = b.dataset.ayar;
    if (b.hasAttribute('data-deger')) O.ayar[ad] = b.dataset.deger;
    else O.ayar[ad] = !O.ayar[ad];
    depoYaz(O.ayar);
    ayarlariCiz(false, ad);
    if (ad !== 'ipucu' && !O.gecis && O.durum.bos === O.n * O.n) {
      oyunKur();                                          // henüz hamle yok: yeni ayarla hemen oyna
      return;
    }
    yeniNotGuncelle();
    if (ad === 'ipucu') ipucuGuncelle();                    // ipucu anında geçerli olur
  }

  /* ---------- oyun kurma ---------- */

  function oyunKur(kayit = null) {
    if (O.aiKontrol) O.aiKontrol.abort();
    const j = ++O.jeton;
    if (kayit) Object.assign(O, kayit);                     // yalnız session.coz tarafından doğrulanan alanlar
    else {
      O.oyunId++;
      O.oyunAyar = { zorluk: O.ayar.zorluk, fazlaTur: O.ayar.fazlaTur, ikiKisi: O.ayar.ikiKisi };
      O.gecmis = []; O.hamleler = [];
      O.isaret = []; O.turSahibi = -1; O.turHamleleri = [];
      O.ilkBaslayan = C.ilkBaslayan === 1 ? 1 : 0;
      O.durum = G.yeniOyun({ boyut: O.n, fazlaTur: O.oyunAyar.fazlaTur, ilkBaslayan: O.ilkBaslayan });
    }
    O.sonDurum = '';
    O.hover = -1;
    oyunuKaydet();
    kilitle(true);

    const id = 'oyun' + O.oyunId;
    O.T = D.tahtaKur($('#tahta'), id, O.n);
    O.B = SOS.board.kur($('#hucreler'), O.n);
    O.imlec = ortaHucre();
    O.B.imlec(O.imlec);
    erisimGuncelle();
    if (O.klavyede) D.imlecCiz(O.T, O.imlec);
    O.M = D.marjKur($('#marj'), {
      id, kh: sayfaBoyu(O.n), n: O.n, etiketler: iki() ? ['mavi', 'kırmızı'] : ['ben', 'rakip'], gecikme: 200,
    });
    const g = D.izgaraCiz(O.T, 0, !!kayit);
    if (kayit) {
      O.durum.hucre.forEach((harf, i) => {
        if (harf) D.harfCiz(O.T, i, G.harfAdi(harf), O.durum.yazan[i], { anlik: true });
      });
      O.durum.cizgiler.forEach(z => {
        const c = D.sosCiz(O.T, z, { anlik: true });
        $('.sos-not', c.node).remove();                     // eski puanların geçici SOS! notları tekrarlanmaz
      });
      D.ceteleGuncelle(O.M, O.durum.puan, { anlik: true });
      D.birDahaYaz(O.M, O.durum.son && O.durum.son.fazla ? O.durum.son.sahip : null, true);
      D.sonHamleIsaretle(O.T, O.isaret, true);
    }

    O.karakter.dusun(false);
    if (iki()) O.karakter.gizle();
    else { O.karakter.goster(); if (O.karakter.ruhAdi !== 'normal') O.karakter.ruh('normal'); }
    const vurgu = $('#yeni-sayfa .vurgu');
    if (vurgu) vurgu.textContent = '';
    D.dugmeIsaretle($('#yeni-sayfa'), false);
    yeniNotGuncelle();
    seciciRenkle(true);
    geriAlGuncelle();
    durumGoster(true);                                      // önceki oyunun durum satırı kalmasın

    // rakip başlıyorsa o oynar; değilse kilit açılır
    g.bitti.then(() => {
      if (j !== O.jeton) return;
      if (kayit && O.durum.bitti) bitir(true);
      else return sirayiIlerlet(j);
    }).catch(e => hataYakala(e, j));
  }

  // "Yeni sayfa": tahta ve çeteleler yırtılıp atılır gibi gider, sonra yeni sayfa baştan çizilir.
  async function yeniSayfa() {
    if (O.gecis) return;
    O.gecis = true;
    kaydiSil();                                            // geçiş sırasında yenilemek eski oyunu geri getirmesin
    if (O.aiKontrol) O.aiKontrol.abort();
    const eski = ++O.jeton;                                 // süren hamle/rakip adımları durur
    kilitle(true);
    if (O.karakter) O.karakter.dusun(false);
    let anims = [];
    if (KL.animasyonVar() && O.T) {
      anims = [$('#tahta'), $('#marj')].map((t, i) => t.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translate(-6%, -5%) rotate(-4deg)', opacity: 0 }],
        { duration: 380, delay: i * 90, easing: 'ease-in', fill: 'forwards' }));
      await Promise.all(anims.map(a => a.finished.catch(() => {})));
    }
    O.gecis = false;
    if (eski !== O.jeton) return;
    oyunKur();
    anims.forEach(a => a.cancel());
  }

  /* ---------- klavyeyle oynama ---------- */

  const klavyeOdagi = (el) => { try { return el.matches(':focus-visible'); } catch (e) { return true; } };
  const ortaHucre = () => Math.floor(O.n / 2) * O.n + Math.floor(O.n / 2);
  const odakBicimi = (el) => (el.classList.contains('harf-dugme') ? 'cember' : 'kutu');

  // İmleçteki hücreyi ekran okuyucuya söyler: "C4 boş" · "C4: S, senin"
  function hucreyiSoyle(i) {
    const d = O.durum, n = d.n, ad = G.hucreAdi(Math.floor(i / n), i % n);
    if (!d.hucre[i]) { $('#duyuru').textContent = `${ad} boş`; return; }
    const y = d.yazan[i];
    const kim = iki() ? (y === 0 ? 'mavi' : 'kırmızı') : (y === 0 ? 'senin' : 'rakibin');
    $('#duyuru').textContent = `${ad}: ${G.harfAdi(d.hucre[i])}, ${kim}`;
  }

  // Klavye imlecini çizer; imleç boş hücredeyse seçili harfin kurşun önizlemesi orada görünür.
  function imlecGoster(soyle) {
    if (!O.T) return;
    O.klavyede = true;
    D.imlecCiz(O.T, O.imlec);
    O.hover = O.imlec;
    onizlemeGuncelle();
    if (soyle) hucreyiSoyle(O.imlec);
  }

  function imlecGizle() {
    O.klavyede = false;
    if (O.T) D.imlecSil(O.T);
    O.hover = -1;
    onizlemeGuncelle();
  }

  // Tahta odaklıyken: oklar imleci taşır (sınırda durur), Enter/boşluk seçili harfi yazar. Sayfa kaymaz.
  function tahtaTusu(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = O.n, yon = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (yon) {
      e.preventDefault();
      const r = Math.min(n - 1, Math.max(0, Math.floor(O.imlec / n) + yon[0]));
      const c = Math.min(n - 1, Math.max(0, (O.imlec % n) + yon[1]));
      O.imlec = r * n + c;
      O.B.imlec(O.imlec, true);
      imlecGoster(true);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      imlecGoster(false);
      if (O.durum.hucre[O.imlec] !== 0) hucreyiSoyle(O.imlec);   // dolu: harf titrer, ne yazdığı söylenir
      hucreTik(O.imlec);
    }
  }

  /* ---------- ses düğmesi ---------- */

  function sesSimgesiGuncelle(anlik) {
    const b = $('#ses-dugme');
    b.setAttribute('aria-pressed', String(Ses.sessiz));       // etiket sabit (Sessiz), durum burada
    KL.sesSimgesiCiz($('.ikon', b), !Ses.sessiz, anlik);
  }

  function seslendir() {
    // Tarayıcılar ses için kullanıcı hareketi ister: ilk dokunuşta AudioContext açılır.
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    sesSimgesiGuncelle(false);
    $('#ses-dugme').addEventListener('click', () => {
      Ses.sessizYap(!Ses.sessiz);
      sesSimgesiGuncelle(false);
      Ses.cal('kalem');                                     // açılırken küçük bir hışırtı duyulur
    });
  }

  /* ---------- sahne (bir kez kurulur) ---------- */

  function sahneKur() {
    basligiCiz(false);

    $$('.dugme').forEach((b, i) => {
      const yazi = $('.yazi', b);
      if (yazi) KL.harfle(yazi, null, { tohum: ['dugme', b.id], gecikme: 1000 + i * 250 });
      KL.dugmeCerceve(b, 1000 + i * 250);
      b.addEventListener('pointerenter', () => { if (!b.disabled) KL.dugmeVurgu(b); });
    });
    // Klavye odağı kurşun kalemle vurgulanır; CSS sınırı da erişilebilir bir yedektir.
    $$('.harf-dugme, .dugme, .ayar, .ses-dugme').forEach(el => {
      el.addEventListener('focus', () => { if (klavyeOdagi(el)) KL.odakCiz(el, odakBicimi(el)); });
      el.addEventListener('blur', () => KL.odakSil(el));
    });
    $$('.susler [data-sus]').forEach((s, i) => KL.susCiz(s, s.dataset.sus, [0, i], 1300 + i * 250));
    O.karakter = Kit.karakter.kur($('#karakter'), { renk: C.renk.kirmizi, kursun: C.renk.kursun, tohum: 'rakip', gecikme: 1100 });
    ayarlariCiz(false);

    const tahta = $('#hucreler');
    tahta.addEventListener('click', (e) => {
      const h = e.target.closest ? e.target.closest('.hucre') : null;
      if (!h) return;
      O.imlec = +h.dataset.i;                                // klavyeye geçilirse imleç buradan devam eder
      O.B.imlec(O.imlec);
      if (O.klavyede) D.imlecCiz(O.T, O.imlec);
      hucreTik(+h.dataset.i);
    });
    tahta.addEventListener('focusin', e => {
      if (!e.target.matches('.hucre')) return;
      O.imlec = +e.target.dataset.i; O.B.imlec(O.imlec);
      if (klavyeOdagi(e.target)) imlecGoster(false);
    });
    tahta.addEventListener('focusout', e => { if (!tahta.contains(e.relatedTarget)) imlecGizle(); });
    tahta.addEventListener('keydown', tahtaTusu);
    tahta.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;                // yalnız fare: dokunuş hamlenin kendisidir
      const h = e.target.closest ? e.target.closest('.hucre') : null;
      const i = h ? +h.dataset.i : -1;
      if (i !== O.hover) { O.hover = i; onizlemeGuncelle(); }
    });
    tahta.addEventListener('pointerleave', () => { O.hover = -1; onizlemeGuncelle(); });
    $$('.harf-dugme').forEach(b => b.addEventListener('click', () => sec(b.dataset.harf)));
    $('#geri-al').addEventListener('click', geriAl);
    $('#yatay-oyna').addEventListener('click', yatayOyna);
    $('#yeni-sayfa').addEventListener('click', () => { Ses.cal('kalem'); yeniSayfa(); });
    seslendir();
    $('#ayarlar').addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest('.ayar') : null;
      if (b) ayarTik(b);
    });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); geriAl(); }
        return;
      }
      if (e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's' || k === 'o') sec(k.toUpperCase());
    });
  }

  // Piksel boyutuna bağlı çerçeveler (SVG'ler sabit viewBox'ta ölçeklenir, bunlar ölçeklenmez).
  function cerceveleriYenile() {
    $$('.dugme').forEach(b => KL.dugmeCerceve(b, 0, true));
    ayarlariCiz(true);
    if (O.durum && O.durum.bitti) D.dugmeIsaretle($('#yeni-sayfa'), true, true);
    const a = document.activeElement;
    if (a && a.querySelector && a.querySelector(':scope > svg.odak')) KL.odakCiz(a, odakBicimi(a));
  }

  // Ölçü değişince yalnız piksel boyutuna bağlı çerçeveler yeniden çizilir.
  let bekleyen = 0;
  function yenidenBoyutla() {
    cancelAnimationFrame(bekleyen);
    bekleyen = requestAnimationFrame(() => { if (olcuHesapla()) { basligiCiz(); cerceveleriYenile(); } });
  }

  // Font geç gelince (2,5 sn'de gelmediyse): çerçeveler, başlık ve durum satırı yeni harf ölçüleriyle yeniden çizilir.
  function yazilariYenile() {
    cerceveleriYenile();
    basligiCiz();
  }

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    KL.ayarla(C.cizim, C.renk);
    ayarlariYukle();
    olcuHesapla();
    const fontHazir = await KL.fontBekle();
    await KL.varlikYukle(SOS.varliklar);       // assets/ içindeki isteğe bağlı PNG'ler
    sahneKur();
    oyunKur(kaydiOku());
    if (!fontHazir) KL.fontGelince(yazilariYenile);
    window.addEventListener('resize', yenidenBoyutla);
    window.addEventListener('orientationchange', yenidenBoyutla);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', yenidenBoyutla);
    SOS.durum = O;                              // konsoldan denemek için: SOS.durum
  }

  basla();
})();
