// ui.js — kontrolör: font, sahne ve oyun akışı. Ölçü/giriş yönleri gorunum.js'te, kurallar board.js'te, rakip ai.js'te, çizim draw.js ve kit/ altında;
// burada yalnız onları birbirine bağlarız.
// FAZ 3: etkileşim (dokun / sürükle), sekme zinciri, zincirde geri alma ("ev modu" ile tam tur), iki kişilik mod, ayar notları.
// FAZ 4: bilgisayar rakip ai.js'ten gelir (zaman dilimli arama, UI donmaz); hata olursa basit yedek seçici devreye girer.
// FAZ 5: zincirde marjda "sek!" notu, rakip zinciri 60–80 ms aralıkla peş peşe, topun yuvarlanması, fare üstü vurgu, sayfa çevirme.
// FAZ 6: sesler (sessize alma dahil), maç modu (ilk 3 gol), yeniden izle, genişletilmiş ayarlar.
// FAZ 7: kendi görünümü (rakip kaptan, futbol simgeleri, maç bileti, taktik notunda ayarlar) ve seçilebilir kurallar
//        (saha boyu tek/çift, ağız ortası, maçta sıkışma, telefonda sürükleme).
(function () {
  'use strict';

  const KF = window.KF;
  const Kit = window.Kit;
  const KL = Kit.kalem;
  const C = KF.config;
  const D = KF.draw;
  const B = KF.board;
  const AI = KF.ai;
  const Ses = Kit.ses.kur({ anahtar: 'kagitfutbolu-sessiz' });
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const bekle = KL.bekle;

  const ISIM = ['Mavi', 'Kırmızı'];
  const renkAd = (oyuncu) => (oyuncu === 1 ? 'kirmizi' : 'mavi');
  const aralikSec = ([a, b]) => a + Math.random() * (b - a);
  const sahaOlcusu = (ad) => C.sahalar[ad] || C.saha;
  // yeni sayfada geçerli olan ayarlar (değişince "(değişiklik yeni sayfada)" notu düşülür)
  const SAYFA_AYARLARI = ['ikiKisi', 'mac', 'saha', 'kesisme', 'rakipBaslar', 'agizSeker'];
  const ZORLUK_ADI = { kolay: 'kolay', orta: 'orta', zor: 'zor' };

  // jeton: sayfanın kimliği. "Yeni sayfa" basılınca artar; eski sayfanın bekleyen adımları jeton değişmişse sessizce çıkar.
  // kilit: animasyon ve rakip sırası boyunca dokunmayı engeller; ilk await'ten ÖNCE eşzamanlı kurulur (çift dokunma).
  const O = {
    jeton: 0, sayfaNo: 1, gecis: false, kilit: true, izliyor: false,
    W: C.saha.W, H: C.saha.H,
    G: null, d: null, T: null, M: null, karakter: null,
    puan: [0, 0],                                          // çetele: gol sayısı [ben/mavi, rakip/kırmızı]; maç modunda maç skoru
    macBitti: false,                                       // maç bir tarafın 3. golüyle bitti: sonraki sayfa yeni maç
    sonMac: false,                                         // önceki sayfada maç modu açık mıydı
    sonrakiBaslayan: null,                                 // maç: gol yiyen başlar
    ayar: {
      zorluk: C.zorluk, ikiKisi: C.ikiKisi, evModu: C.evModu, mac: C.mac, saha: 'normal', kesisme: C.kesisme,
      rakipBaslar: C.ilkBaslayan === 1, agizSeker: C.kurallar.agizSeker, sikismaMac: C.kurallar.sikismaMac, surukle: C.surukle,
    },
    baslangic: null,                                       // bu sayfanın başlangıç noktası [x, y]
    oyunAyar: {},                                          // bu sayfa başlarken geçerli olanlar
    iptal: null,                                           // düşünen rakibi durdurur
    gecmis: [],                                            // oynanan hamleler: { e, sahip, tur }
    tur: 0,                                                // sıra kaç kez geçti (geri alma için tur numarası)
    hedefler: [],                                          // gidilebilir noktalar: { e, x, y, sekme }
    sonuc: null,                                           // oyun sonu bilgisi (yeniden izlemede yeniden çizmek için)
    surukle: null, hover: '',
    sonDurum: '',
  };

  const iki = () => O.oyunAyar.ikiKisi;
  const insan = (oyuncu) => iki() || oyuncu === 0;
  const girisAcik = () => !O.kilit && !O.gecis && !O.izliyor && !notAcik() && !!O.d && !O.d.bitti && insan(O.d.sira);

  /* ---------- ayarların saklanması (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const ANAHTAR = 'kagitfutbolu-ayar';
  let bellek = null;
  function depoOku() {
    try { const s = localStorage.getItem(ANAHTAR); return s ? JSON.parse(s) : bellek; } catch (e) { return bellek; }
  }
  function depoYaz(v) { bellek = v; try { localStorage.setItem(ANAHTAR, JSON.stringify(v)); } catch (e) { /* yoksay */ } }

  function ayarlariYukle() {
    const k = depoOku();
    if (!k || typeof k !== 'object') return;
    if (['kolay', 'orta', 'zor'].includes(k.zorluk)) O.ayar.zorluk = k.zorluk;
    if (C.sahalar[k.saha]) O.ayar.saha = k.saha;
    else if (k.kucukSaha === true) O.ayar.saha = 'kucuk';             // eski kayıt
    if (['gol', 'tekrar', 'mac'].includes(k.sikismaMac)) O.ayar.sikismaMac = k.sikismaMac;
    for (const ad of ['ikiKisi', 'evModu', 'mac', 'kesisme', 'rakipBaslar', 'agizSeker', 'surukle']) if (typeof k[ad] === 'boolean') O.ayar[ad] = k[ad];
  }

  /* ---------- ölçü ---------- */

  // Sayfa kare cinsinden: eni max(21, 2W+5), boyu 4 + 2(H+3) + 8 (üst bant 4, saha, alt bant 8: simgeler, maç bileti, kaptan).
  function sayfaKare() {
    const sw = (O.W + 1) * 2, sh = (O.H + 3) * 2;
    const kw = Math.max(21, 2 * O.W + 5);
    return { kw, kh: 4 + sh + 8, sw, sh, sol: 3 + Math.floor((kw - 3 - sw) / 2) };
  }

  const V = KF.gorunum.kur({ O, oyna: insanHamle, girisAcik, yenidenBoyutla });

  /* ---------- durum göstergeleri ---------- */

  const topXY = () => [O.G.nx[O.d.top], O.G.ny[O.d.top]];

  function etkinGuncelle() {
    const d = O.d;
    $('#saha').classList.toggle('etkin', girisAcik());
    V.yonleriGuncelle();
    // iki kişilik modda kalem imleci sıradaki oyuncunun rengine döner
    document.documentElement.style.setProperty('--kalem-imlec', d && iki() && d.sira === 1 ? 'var(--imlec-kirmizi)' : 'var(--imlec-mavi)');
  }

  // Simge düğmesinin çizimi pasif/etkin durumuna göre (yalnız değişince) yeniden çizilir.
  function simgeGuncelle(b, anlik = true) {
    const pasif = !!b.disabled;
    if (b.dataset.pasif === String(pasif)) return;
    b.dataset.pasif = String(pasif);
    D.simgeCiz($('.ikon', b), b.dataset.simge, pasif, { anlik });
  }

  function geriAlGuncelle() {
    const b = $('#geri-al');
    b.disabled = O.kilit || O.gecis || O.izliyor || geriAlSayisi() === 0;
    simgeGuncelle(b);
  }
  function kilitle(v) { O.kilit = v; etkinGuncelle(); geriAlGuncelle(); }

  // Oyun bitince VAR ("geri al") yerine tekrar oku ("yeniden izle") görünür.
  function butonlariGuncelle() {
    const bitti = !!(O.d && O.d.bitti);
    $('#geri-al').hidden = bitti;
    const y = $('#yeniden-izle');
    y.hidden = !bitti;
    y.disabled = O.izliyor;
    simgeGuncelle(y);
  }

  // Maç bileti: bu sayfanın ayarları. Bekleyen (yeni sayfada geçerli olacak) değişiklik varsa başlıkta yıldız.
  function biletGuncelle(anlik) {
    const a = O.oyunAyar, bekleyen = SAYFA_AYARLARI.some(k => O.ayar[k] !== a[k]);
    const satirlar = [
      a.ikiKisi ? 'arkadaşla · iki kişilik' : `rakip: kaptan · ${ZORLUK_ADI[a.zorluk]}`,
      `saha ${O.W}×${O.H} · ${a.mac ? 'maç (3 gol)' : 'tek oyun'}`,
      `${a.kesisme ? 'kesişme var' : 'kesişme yok'} · ağız ${a.agizSeker ? 'seker' : 'sekmez'}`,
    ];
    D.biletCiz($('.bilet-svg'), satirlar, O.sayfaNo, { anlik, baslik: bekleyen ? 'MAÇ BİLETİ *' : 'MAÇ BİLETİ' });
    $('#ayar-ozeti').textContent = satirlar.join(' · ');
  }

  function sahaSurukleGuncelle() { $('#saha').classList.toggle('surukle', !!O.ayar.surukle); }

  // Başlığın altındaki kurşun kalem durum satırı. Aynı metin yeniden yazılmaz.
  function durumGoster(zorla, gecikme = 0) {
    const d = O.d;
    if (!d || d.bitti) return;
    let yazi;
    if (!insan(d.sira)) yazi = 'Rakip düşünüyor…';
    else if (d.zincir > 0) yazi = 'Sekti! Bir hamle daha yap.';
    else yazi = iki() ? `${ISIM[d.sira]} oynuyor.` : 'Sıra sende: topu bir noktaya götür.';
    if (!zorla && yazi === O.sonDurum) return;
    O.sonDurum = yazi;
    D.durumYaz($('#ust'), yazi, 'kursun', gecikme);
  }

  function hedefleriGoster() {
    const { G, d, T } = O;
    O.hedefler = B.yasalListe(G, d).map(e => {
      const p = G.ea[e] === d.top ? G.eb[e] : G.ea[e];
      return { e, x: G.nx[p], y: G.ny[p], sekme: G.golKazanan[p] < 0 && B.ziyaretli(G, d, p) };
    });
    O.hover = '';
    D.ipucuCiz(T, O.hedefler);
  }

  // Zincir sürerken marjda, topun yüksekliğinde "sek!" (ikinciden sonra "sek! ×2"...). Sıra geçince silinir.
  function sekNotu(sahip) {
    const [x, y] = topXY(), n = O.d.zincir;
    D.marjNot(O.M, n > 1 ? `sek! ×${n}` : 'sek!', O.T.nok(x, y)[1], renkAd(sahip));
  }
  const sekNotuSil = () => D.marjNotSil(O.M);

  /* ---------- hamle ---------- */

  // Bir kenarı oynar: durumu günceller, çizgiyi çizer ve topu kaydırır. Sayfa arada değiştiyse null döner.
  async function oyna(e, j) {
    const { G, d, T } = O;
    const sahip = d.sira;
    const a = [G.nx[d.top], G.ny[d.top]];
    const r = B.yap(G, d, e);
    const b = [G.nx[d.top], G.ny[d.top]];
    O.gecmis.push({ e, sahip, tur: O.tur });
    if (r.siraGecti) { O.tur++; sekNotuSil(); }
    D.okSil(T); D.ipucuSil(T);
    const s = D.cizgiCiz(T, a, b, sahip, e);
    const tp = D.topTasi(T, b[0], b[1], s.sure);
    Ses.cal('cizgi', 0, Math.hypot(b[0] - a[0], b[1] - a[1]));
    if (r.sekti && !r.gol && !r.sikisti) Ses.cal('tik', s.sure);
    await Promise.all([s.bitti, tp]);
    return j === O.jeton ? r : null;
  }

  // Hamle bittikten sonra: oyun bittiyse sonucu yaz; sıra rakibin (bilgisayar) ise o oynasın; değilse sıra insanda.
  async function hamleSonrasi(r, j) {
    if (O.d.bitti) { await bitir(j); return; }
    if (r.sekti) sekNotu(O.gecmis[O.gecmis.length - 1].sahip);
    await siraIlerlet(j);
  }

  async function siraIlerlet(j) {
    if (j !== O.jeton) return;
    const { d, T } = O;
    const [x, y] = topXY();
    D.okCiz(T, x, y, d.sira);
    durumGoster();
    if (!insan(d.sira)) { await rakipOyna(j); return; }
    hedefleriGoster();
    kilitle(false);
  }

  async function insanHamle(h) {
    if (!girisAcik()) return;
    kilitle(true);                                         // ilk await'ten önce: çift dokunma
    const j = O.jeton;
    const r = await oyna(h.e, j);
    if (!r) return;
    await hamleSonrasi(r, j);
  }

  /* ---------- rakip ---------- */

  // Yedek (ai.js hata verirse): kazandıran tur varsa en kısası; yoksa kaybettirmeyen turlardan hedefe yakın üçü arasında rastgele.
  function yedekSec() {
    const { G, d } = O, ben = d.sira;
    const t = B.turlarUret(G, d, { enCokTur: 400, enUzunZincir: 30, enCokDugum: 20000 }).turlar;
    const kazanc = t.filter(x => x.kazanan === ben && (x.sonuc === 'gol' || x.sonuc === 'sikisma')).sort((a, b) => a.kenarlar.length - b.kenarlar.length);
    if (kazanc.length) return kazanc[0].kenarlar;
    const temiz = t.filter(x => x.sonuc === 'temiz');
    if (temiz.length) {
      const hedefY = ben === 0 ? 0 : G.H;
      temiz.sort((a, b) => Math.abs(G.ny[a.bitis] - hedefY) - Math.abs(G.ny[b.bitis] - hedefY));
      return temiz[Math.floor(Math.random() * Math.min(3, temiz.length))].kenarlar;
    }
    return (t.find(x => x.sonuc !== 'kesildi') || t[0]).kenarlar;     // hepsi kaybettiriyor
  }

  // ai.js'i zaman dilimli çalıştırır; sayfa değişirse iptal eder (null döner)
  function rakipDusun() {
    return new Promise((coz) => {
      const zorluk = O.oyunAyar.zorluk;
      const iptal = AI.dusun(O.G, O.d, { zorluk, butceMs: C.ai.butceMs[zorluk], dilimMs: C.ai.dilimMs }, (s, hata) => {
        O.iptal = null;
        if (hata) console.error('ai.js:', hata);
        coz(s ? s.kenarlar : null);
      });
      O.iptal = () => { iptal(); O.iptal = null; coz(null); };
    });
  }

  async function rakipOyna(j) {
    kilitle(true);
    O.karakter.dusun(true);
    const t0 = performance.now();
    let secim = await rakipDusun();
    if (j !== O.jeton) return;
    if (!secim || !secim.length) secim = yedekSec();
    await bekle(Math.max(0, aralikSec(C.ai.dusunmeMs) - (performance.now() - t0)));
    if (j !== O.jeton) return;
    O.karakter.dusun(false);
    for (let i = 0; i < secim.length; i++) {
      const r = await oyna(secim[i], j);
      if (!r) return;
      if (O.d.bitti) { await bitir(j); return; }
      if (r.sekti) sekNotu(O.gecmis[O.gecmis.length - 1].sahip);
      if (i < secim.length - 1) await bekle(60 + Math.random() * 20);         // zincirde çizgiler peş peşe, 60–80 ms arayla
      if (j !== O.jeton) return;
    }
    await siraIlerlet(j);
  }

  /* ---------- oyun sonu ---------- */

  // Sonucun görseli: kaleciler, "GOL!" ya da "sıkıştı!" notu, ortada sonuç yazısı. Yeniden izlemede de kullanılır.
  function sonucuCiz(gecikme = 0, anlik = false) {
    const { T } = O, s = O.sonuc;
    if (s.sebep === 'gol') {
      D.golYaz(T, s.taraf, s.kazanan, gecikme, anlik);
      D.kaleciCiz(T, s.taraf, 'uzgun', gecikme + 300, anlik);
      D.kaleciCiz(T, 1 - s.taraf, 'sevincli', gecikme + 300, anlik);
    } else {
      D.halkaCiz(T, s.x, s.y, renkAd(1 - s.kazanan), { anlik });
      D.notYaz(T, 'sıkıştı!', s.x, s.y, { dx: s.x < O.W / 2 ? 44 : -44, dy: -30, boyut: 24, renk: renkAd(1 - s.kazanan), aci: s.x < O.W / 2 ? -8 : 8, gecikme: gecikme + 250, anlik });
    }
    return D.sonucCiz(T, s.baslik, s.alt, s.renk, gecikme + (anlik ? 0 : 900), anlik);
  }

  async function bitir(j) {
    const { G, d, T } = O;
    const { kazanan, sebep } = d.bitti;
    const son = O.gecmis[O.gecmis.length - 1];
    const [x, y] = topXY();
    const mac = O.oyunAyar.mac;
    D.ipucuSil(T); D.okSil(T); sekNotuSil();
    O.hedefler = [];
    kilitle(true);

    let baslik, alt, renk;
    if (iki()) { baslik = `${ISIM[kazanan]} kazandı!`; renk = renkAd(kazanan); }
    else if (kazanan === 0) { baslik = 'Kazandın!'; renk = 'mavi'; }
    else { baslik = 'Kaybettin…'; renk = 'kirmizi'; }

    if (sebep === 'gol') {
      const kendi = son && son.sahip !== kazanan;
      if (iki()) alt = kendi ? `${ISIM[1 - kazanan]} kendi kalesine attı` : 'gol!';
      else if (kendi) alt = kazanan === 0 ? 'rakip kendi kalesine attı' : 'kendi kalene attın';
      else alt = kazanan === 0 ? 'gol attın' : 'rakip gol attı';
    } else {
      const kaybeden = 1 - kazanan;
      alt = iki() ? `${ISIM[kaybeden]} sıkıştı` : (kaybeden === 0 ? 'sıkıştın, hamlen kalmadı' : 'rakip sıkıştı');
    }

    // çetele: gol = bir çizgi. Maç modunda sıkışmanın karşılığı ayara göre (macSonucu).
    let macSonu = false, tekrar = false;
    if (mac) {
      const m = macSonucu(O.puan, kazanan, sebep, O.oyunAyar.sikismaMac, C.macGol);
      O.puan = m.puan;
      if (m.cizgi) D.ceteleGuncelle(O.M, O.puan);
      O.sonrakiBaslayan = m.sonrakiBaslayan;
      tekrar = m.tekrar;
      if (m.macBitti) {
        O.macBitti = true; macSonu = true;
        baslik = iki() ? `${ISIM[kazanan]} maçı kazandı!` : (kazanan === 0 ? 'Maçı kazandın!' : 'Maçı kaybettin…');
        if (sebep === 'sikisma' && !m.cizgi) alt += ' · sıkışma maçı bitirdi';
      } else if (tekrar) {
        alt += ' · sayfa tekrar';
      }
      alt += ` · maç ${O.puan[0]}–${O.puan[1]}`;
    } else if (sebep === 'gol') {
      O.puan[kazanan]++;
      D.ceteleGuncelle(O.M, O.puan);
    }

    O.sonuc = { baslik, alt, renk, kazanan, sebep, taraf: kazanan === 0 ? 0 : 1, x, y };
    V.skor();
    D.durumYaz($('#ust'), `${baslik} ${alt}. Skor ${O.puan[0]}–${O.puan[1]}.`);
    sesCal(sebep === 'gol' ? 'gol' : 'sikisma');
    sonucuCiz();
    butonlariGuncelle();
    await bekle(900);
    if (j !== O.jeton) return;
    if (!iki()) {
      if (kazanan === 1) { O.karakter.ruh('sirit'); O.karakter.konus('hehe!', 2600); }
      else { O.karakter.ruh('somurt'); O.karakter.konus('rövanş?', 2600); }
    }
    sesCal(iki() || kazanan === 0 ? 'kazan' : 'kaybet', 300);
    O.sonDurum = '';
    if (mac && !macSonu) {
      D.durumYaz($('#ust'), tekrar ? `Sıkışma: sayfa tekrar oynanıyor… (${O.puan[0]}–${O.puan[1]})` : `${baslik} Maç ${O.puan[0]}–${O.puan[1]}: sayfa çevriliyor…`, 'kursun', 400);
      kilitle(false);
      macDevamPlanla();
      return;
    }
    D.durumYaz($('#ust'), `${baslik} Skor ${O.puan[0]}–${O.puan[1]}. ${mac ? 'Yeni sayfa ile yeni maç.' : 'Yeni sayfa ile devam.'}`, 'kursun', 600);
    D.simgeHalka($('#yeni-sayfa'), true);
    kilitle(false);
  }

  // Maç modunda bir oyunun sonucu. sikisma: 'gol' rakibe gol · 'tekrar' skora yazılmaz, sayfa tekrar · 'mac' sıkışan maçı kaybeder.
  // Her durumda gol yiyen / sıkışan sonraki sayfayı başlatır. Saf fonksiyon (sürücüden de denenir).
  function macSonucu(puan, kazanan, sebep, sikisma, macGol) {
    const p = puan.slice(), kaybeden = 1 - kazanan;
    if (sebep === 'gol' || sikisma === 'gol') {
      p[kazanan]++;
      return { puan: p, cizgi: true, macBitti: p[kazanan] >= macGol, tekrar: false, sonrakiBaslayan: kaybeden };
    }
    if (sikisma === 'tekrar') return { puan: p, cizgi: false, macBitti: false, tekrar: true, sonrakiBaslayan: kaybeden };
    return { puan: p, cizgi: false, macBitti: true, tekrar: false, sonrakiBaslayan: kaybeden };
  }

  let macGecis = 0;
  function macGecisiniDurdur() { clearTimeout(macGecis); macGecis = 0; }
  function macDevamPlanla() {
    macGecisiniDurdur();
    if (!O.oyunAyar.mac || !O.d?.bitti || O.macBitti || O.izliyor || notAcik()) return;
    const j = O.jeton;
    macGecis = setTimeout(() => {
      macGecis = 0;
      if (j === O.jeton && !O.gecis && !O.izliyor && !notAcik()) yeniSayfa();
    }, 3200);
  }

  /* ---------- yeniden izle ---------- */

  // Biten oyunun çizgileri boş sahadan başlayarak sırayla ve hızlandırılmış çizilir; sonunda sonuç geri gelir.
  async function yenidenIzle() {
    if (!O.d || !O.d.bitti || O.gecis || O.izliyor) return;
    macGecisiniDurdur();
    const j = ++O.jeton;                                    // bekleyen maç geçişi vb. durur
    O.izliyor = true;
    kilitle(true);
    butonlariGuncelle();
    const { G, T } = O;
    T.katman.cizgiler.textContent = ''; T.katman.not.textContent = '';
    D.ipucuSil(T); D.okSil(T); D.marjNotSil(O.M, true);
    D.kaleciCiz(T, 0, 'normal', 0, true); D.kaleciCiz(T, 1, 'normal', 0, true);
    D.topKonumla(T, O.baslangic[0], O.baslangic[1]);
    D.durumYaz($('#ust'), 'Yeniden izleniyor…', 'kursun');
    O.sonDurum = '';
    await bekle(400);
    let p = B.nokta(G, O.baslangic[0], O.baslangic[1]);
    for (const h of O.gecmis) {
      if (j !== O.jeton) return;
      const q = G.ea[h.e] === p ? G.eb[h.e] : G.ea[h.e];
      const a = [G.nx[p], G.ny[p]], b = [G.nx[q], G.ny[q]];
      const s = D.cizgiCiz(T, a, b, h.sahip, h.e, { sureMs: [45, 75] });
      Ses.cal('cizgi', 0, Math.hypot(b[0] - a[0], b[1] - a[1]));
      await Promise.all([s.bitti, D.topTasi(T, b[0], b[1], s.sure)]);
      p = q;
      await bekle(35);
    }
    if (j !== O.jeton) return;
    O.izliyor = false;
    if (O.sonuc.sebep === 'gol') sesCal('gol');
    sonucuCiz(0, false);
    D.durumYaz($('#ust'), `${O.sonuc.baslik} Skor ${O.puan[0]}–${O.puan[1]}. ${O.oyunAyar.mac && !O.macBitti ? 'Maç devam ediyor…' : 'Yeni sayfa ile devam.'}`, 'kursun', 300);
    butonlariGuncelle();
    kilitle(false);
    macDevamPlanla();
  }

  /* ---------- geri alma ---------- */

  // Kaç hamle geri alınır? Zincir ortasında son adım (sıra geçmeden). Ev modunda sıra geçtikten sonra son tam tur
  // (bilgisayarla: onun turu ve ardından benim turum). Yoksa 0.
  function geriAlSayisi() {
    const d = O.d;
    if (!d || d.bitti || !O.gecmis.length) return 0;
    if (insan(d.sira) && d.zincir > 0) return 1;
    if (!O.ayar.evModu || d.zincir !== 0) return 0;
    const son = O.gecmis[O.gecmis.length - 1];
    let n = O.gecmis.filter(x => x.tur === son.tur).length;
    if (!iki()) {
      const oncesi = O.gecmis.filter(x => x.tur === son.tur - 1).length;
      if (son.sahip === 0 || !oncesi) return 0;
      n += oncesi;
    }
    return n;
  }

  function geriAl() {
    if (O.kilit || O.gecis || O.izliyor) return;
    const n = geriAlSayisi();
    if (!n) return;
    const { G, d, T } = O;
    let son;
    for (let i = 0; i < n; i++) { son = O.gecmis.pop(); B.geriAl(G, d); D.cizgiSil(T, son.e); }
    O.tur = son.tur;
    const [x, y] = topXY();
    D.topKonumla(T, x, y);
    Ses.cal('kalem');
    $$('.not-yazi, .halka', T.svg).forEach(g => KL.soldur(g, 200));
    if (!iki()) { O.karakter.dusun(false); O.karakter.ruh('normal'); }
    if (d.zincir > 0) sekNotu(d.sira); else sekNotuSil();
    D.okCiz(T, x, y, d.sira);
    hedefleriGoster();
    durumGoster(true);
    etkinGuncelle();
    geriAlGuncelle();
  }

  /* ---------- giriş: dokun ya da sürükle ---------- */

  // Ekran koordinatı → saha SVG birimi (eğik sayfada da doğru: ters CTM)
  function svgNokta(ev) {
    const svg = O.T.svg, m = O.T.dunya.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  // Dokunulan yere en yakın gidilebilir nokta (0,6 adımdan yakınsa)
  function enYakinHedef(p) {
    let en = null, ed = 0.62 * D.ADIM;
    for (const h of O.hedefler) {
      const [hx, hy] = O.T.nok(h.x, h.y);
      const u = Math.hypot(p[0] - hx, p[1] - hy);
      if (u <= ed) { ed = u; en = h; }
    }
    return en;
  }

  function girisKur() {
    const saha = $('#saha');
    const iptal = () => { O.surukle = null; if (O.T) D.surukleSil(O.T); };
    saha.addEventListener('pointerdown', (ev) => {
      if (!girisAcik() || O.surukle || ev.isPrimary === false || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      const p = svgNokta(ev);
      if (!p) return;
      const [tx, ty] = O.T.nok(...topXY());
      const topta = Math.hypot(p[0] - tx, p[1] - ty) <= 0.6 * D.ADIM;
      // fareyle her zaman, dokunmayla yalnız "telefonda sürükle" açıkken toptan sürüklenir
      const izin = ev.pointerType === 'mouse' || !!O.ayar.surukle;
      O.surukle = { id: ev.pointerId, fare: izin, topta, basla: p, ekran: [ev.clientX, ev.clientY], surukledi: false };
      if (izin && topta) { try { saha.setPointerCapture(ev.pointerId); } catch (e) { /* yoksay */ } }
    });
    saha.addEventListener('pointermove', (ev) => {
      const s = O.surukle;
      if (!s || s.id !== ev.pointerId || !s.fare || !s.topta || !girisAcik()) return;
      const p = svgNokta(ev);
      if (!p) return;
      if (!s.surukledi && Math.hypot(p[0] - s.basla[0], p[1] - s.basla[1]) < 6) return;
      s.surukledi = true;
      D.surukleCiz(O.T, topXY(), p);
    });
    saha.addEventListener('pointerup', (ev) => {
      const s = O.surukle;
      if (!s || s.id !== ev.pointerId) return;
      O.surukle = null;
      D.surukleSil(O.T);
      if (!girisAcik()) return;
      const p = svgNokta(ev);
      if (!p) return;
      const uzak = Math.hypot(ev.clientX - s.ekran[0], ev.clientY - s.ekran[1]);
      if (uzak > 10 && !(s.fare && s.topta)) return;
      const h = enYakinHedef(p);
      if (h) insanHamle(h); else D.vurusCiz(O.T, p[0], p[1]);
    });
    // fare üstündeki gidilebilir noktayı koyulaştır
    saha.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse' || !girisAcik()) return;
      const p = svgNokta(ev), h = p && enYakinHedef(p), k = h ? h.x + ',' + h.y : '';
      if (k !== O.hover) { O.hover = k; D.ipucuVurgula(O.T, h ? h.x : null, h ? h.y : null); }
    });
    saha.addEventListener('pointerleave', () => {
      O.hover = '';
      if (O.T) D.ipucuVurgula(O.T, null, null);
      // Top dışındaki tıklamalar yakalanmaz; dışarıda bırakılırsa pointerup sahaya ulaşmaz.
      if (O.surukle && !saha.hasPointerCapture(O.surukle.id)) iptal();
    });
    saha.addEventListener('pointercancel', iptal);
    saha.addEventListener('lostpointercapture', iptal);
    window.addEventListener('blur', iptal);
  }

  /* ---------- ayar notları ---------- */

  function ayarlariCiz(anlik) {
    $$('.ayar').forEach(b => {
      const ad = b.dataset.ayar;
      if (b.dataset.deger) {
        const secili = O.ayar[ad] === b.dataset.deger;
        b.setAttribute('aria-pressed', String(secili));
        D.ayarCemberi(b, secili, anlik);
      } else {
        const acik = !!O.ayar[ad];
        b.setAttribute('aria-checked', String(acik));
        D.kutucukCiz($('.kutucuk', b), ad, acik, anlik);
      }
    });
  }

  // Zorluk, ev modu, maçta sıkışma ve sürükleme hemen geçerli olur; saha, kesişme, iki kişilik, maç, başlayan ve ağız ortası
  // yeni sayfada başlar (not düşülür, bilette yıldız).
  function yeniNotGuncelle() { $('#yeni-not').hidden = SAYFA_AYARLARI.every(a => O.ayar[a] === O.oyunAyar[a]); }

  function ayarTik(b) {
    const ad = b.dataset.ayar;
    if (b.dataset.deger) {
      O.ayar[ad] = b.dataset.deger;
    } else {
      O.ayar[ad] = !O.ayar[ad];
    }
    if (['zorluk', 'sikismaMac', 'evModu', 'surukle'].includes(ad)) O.oyunAyar[ad] = O.ayar[ad];   // hemen geçerli
    Ses.cal('kalem');
    depoYaz(Object.assign({}, O.ayar));
    ayarlariCiz(false);
    yeniNotGuncelle();
    geriAlGuncelle();
    sahaSurukleGuncelle();
    biletGuncelle(true);
  }

  /* ---------- taktik notu (ayarlar) ---------- */

  const notAcik = () => $('#taktik-notu').open;
  let notAcan = null;

  function notAc(ev) {
    if (notAcik()) return;
    notAcan = ev?.currentTarget || document.activeElement;
    macGecisiniDurdur();
    const n = $('#taktik-notu');
    n.showModal();
    $('#taktik').setAttribute('aria-expanded', 'true');
    ayarlariCiz(true);
    yeniNotGuncelle();
    etkinGuncelle();
    Ses.cal('kalem');
    $('.ayar', n).focus({ preventScroll: true });
  }

  function notKapat() {
    if (!notAcik()) return;
    $('#taktik-notu').close();
    $('#taktik').setAttribute('aria-expanded', 'false');
    (notAcan?.isConnected ? notAcan : $('#taktik')).focus({ preventScroll: true });
    etkinGuncelle();
    macDevamPlanla();
  }

  function notKur() {
    const n = $('#taktik-notu');
    $('#taktik').addEventListener('click', notAc);
    $('#bilet').addEventListener('click', notAc);
    $('#tamam').addEventListener('click', notKapat);
    n.addEventListener('cancel', ev => { ev.preventDefault(); notKapat(); });
    n.addEventListener('pointerdown', ev => {
      const r = n.getBoundingClientRect();
      if (ev.target === n && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)) notKapat();
    });
    n.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab') return;
      const tuslar = $$('button:not(:disabled), input, a[href]', n).filter(e => e.getClientRects().length);
      // Safari/macOS may omit buttons from its native Tab order. Cycle the same controls in every browser.
      const i = tuslar.indexOf(document.activeElement);
      const next = (i + (ev.shiftKey ? -1 : 1) + tuslar.length) % tuslar.length;
      ev.preventDefault();
      tuslar[next].focus();
    });
  }

  /* ---------- gerçek ses kayıtları (isteğe bağlı) ---------- */

  // assets/varliklar.js → sesDosyalari: ['gol.mp3', ...]. file:// altında da çalışsın diye <audio> ile (fetch yok).
  const kayitlar = {}, sesZamanlari = new Set();
  let sesNesli = 0;
  function sesleriDurdur() {
    sesNesli++;
    sesZamanlari.forEach(clearTimeout); sesZamanlari.clear();
    Object.values(kayitlar).forEach(a => { a.pause(); a.currentTime = 0; });
    Ses.durdur();
  }
  function sesDosyalariYukle() {
    for (const dosya of (KF.sesDosyalari || [])) {
      const ad = dosya.replace(/\.[a-z0-9]+$/i, '');
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { kayitlar[ad] = a; }, { once: true });
      a.src = 'assets/' + dosya;
    }
  }

  // Kayıt varsa onu, yoksa (ya da çalamazsa) sentezlenmiş sesi çalar.
  function sesCal(ad, gecikmeMs = 0) {
    const a = kayitlar[ad];
    if (!a) { Ses.cal(ad, gecikmeMs); return; }
    if (Ses.sessiz) return;
    const j = O.jeton, nesil = sesNesli;
    const guncel = () => !Ses.sessiz && j === O.jeton && nesil === sesNesli;
    const yedek = hata => {
      // pause() eski play() vaadini sonradan reddedebilir; iptal edilen sesi yeniden başlatma.
      if (guncel() && hata?.name !== 'AbortError') Ses.cal(ad);
    };
    const zaman = setTimeout(() => {
      sesZamanlari.delete(zaman);
      if (!guncel()) return;
      try {
        a.currentTime = 0; a.volume = 0.8;
        const p = a.play();
        if (p) p.catch(yedek);
      } catch (e) { yedek(e); }
    }, gecikmeMs);
    sesZamanlari.add(zaman);
  }

  /* ---------- ses düğmesi ---------- */

  function sesSimgesiGuncelle(anlik) {
    const b = $('#ses-dugme');
    b.setAttribute('aria-pressed', String(Ses.sessiz));
    b.setAttribute('aria-label', Ses.sessiz ? 'Sesi aç' : 'Sesi kapat');
    KL.sesSimgesiCiz($('.ikon', b), !Ses.sessiz, anlik);
    V.araclariHizala();
  }

  function seslendir() {
    // Tarayıcılar ses için kullanıcı hareketi ister: ilk dokunuşta AudioContext açılır.
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    sesSimgesiGuncelle(false);
    $('#ses-dugme').addEventListener('click', () => {
      Ses.sessizYap(!Ses.sessiz);
      if (Ses.sessiz) sesleriDurdur();
      sesSimgesiGuncelle(false);
      Ses.cal('kalem');                                     // açılırken küçük bir hışırtı duyulur
    });
  }

  /* ---------- sayfa ---------- */

  function sayfaKur(anlik) {
    macGecisiniDurdur();
    sesleriDurdur();
    const j = ++O.jeton;
    O.oyunAyar = Object.assign({}, O.ayar);
    const sa = sahaOlcusu(O.oyunAyar.saha);
    O.W = sa.W; O.H = sa.H;
    // yeni maç: mod değişti ya da önceki maç bitti
    if (O.oyunAyar.mac !== O.sonMac || O.macBitti) { O.puan = [0, 0]; O.macBitti = false; O.sonrakiBaslayan = null; }
    O.sonMac = O.oyunAyar.mac;
    const baslayan = O.oyunAyar.mac && O.sonrakiBaslayan !== null ? O.sonrakiBaslayan : (O.oyunAyar.rakipBaslar ? 1 : 0);
    O.gecmis = []; O.tur = 0; O.hedefler = []; O.surukle = null; O.sonDurum = ''; O.sonuc = null; O.izliyor = false;

    O.G = B.kur({ W: O.W, H: O.H, kesisme: O.oyunAyar.kesisme, agizSeker: O.oyunAyar.agizSeker });
    O.d = B.baslangic(O.G, baslayan);
    O.baslangic = [O.G.nx[O.d.top], O.G.ny[O.d.top]];
    O.T = D.sahaKur($('#saha'), 'sayfa' + O.sayfaNo, O.W, O.H);
    V.olcu(); V.skor();
    O.M = D.marjKur($('#marj'), 'sayfa' + O.sayfaNo, sayfaKare().sh, iki() ? ['mavi', 'kırmızı'] : ['ben', 'rakip'], 200, anlik);
    D.ceteleGuncelle(O.M, O.puan, { anlik: true });
    D.sayfaNoYaz($('#sayfa-no'), O.sayfaNo, 300, anlik);
    V.araclariHizala();
    kilitle(true);
    butonlariGuncelle();
    $$('.simge').forEach(b => D.simgeHalka(b, false));
    biletGuncelle(anlik);
    sahaSurukleGuncelle();

    const saha = D.sahaCiz(O.T, 0, anlik, O.baslangic);
    D.kaleciCiz(O.T, 0, 'normal', saha.sure * .6, anlik);
    D.kaleciCiz(O.T, 1, 'normal', saha.sure * .7, anlik);
    const top = D.topCiz(O.T, O.baslangic[0], O.baslangic[1], saha.sure, anlik);

    if (iki()) O.karakter.gizle(); else { O.karakter.goster(); O.karakter.ruh('normal'); }
    yeniNotGuncelle();
    // saha çizilince oyun başlar: sıra rakipteyse o oynar, değilse hedefler gösterilir ve dokunma açılır
    Promise.all([saha.bitti, top.bitti]).then(() => { if (j === O.jeton) siraIlerlet(j); });
  }

  // "Yeni sayfa": mevcut sayfanın kopyası üstte kalır ve sol alt köşesinden çevrilip gider; altta yeni sayfa hemen çizilmeye başlar.
  async function yeniSayfa() {
    if (O.gecis) return;
    O.gecis = true;
    ++O.jeton;                                              // süren hamle/rakip adımları durur
    if (O.iptal) O.iptal();                                 // düşünen rakip varsa durdur
    O.izliyor = false;
    kilitle(true);
    if (O.karakter) O.karakter.dusun(false);
    Ses.cal('kalem');
    let eski = null;
    if (KL.animasyonVar() && O.T) {
      eski = $('#sayfa').cloneNode(true);
      eski.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      eski.removeAttribute('id');
      eski.setAttribute('aria-hidden', 'true');
      eski.inert = true;
      eski.classList.add('eski-sayfa');
      $('#defter').appendChild(eski);
    }
    O.sayfaNo++;
    sayfaKur();
    if (eski) {
      const a = eski.animate([
        { transform: 'none', opacity: 1 },
        { transform: 'rotate(-9deg) translate(-8%, -3%)', opacity: 1, offset: .45 },
        { transform: 'rotate(-16deg) translate(-42%, -9%)', opacity: 0 },
      ], { duration: 650, easing: 'cubic-bezier(.45, 0, .85, .55)', fill: 'forwards' });
      await a.finished.catch(() => {});
      eski.remove();
    }
    O.gecis = false;
    if (O.d && !O.kilit) etkinGuncelle();
  }

  /* ---------- sahne (bir kez kurulur) ---------- */

  function sahneKur() {
    $$('.simge').forEach((b, i) => {
      KL.harfle($('.etiket', b), null, { tohum: ['simge', b.id], gecikme: 1000 + i * 220 });
      b.dataset.pasif = String(!!b.disabled);
      D.simgeCiz($('.ikon', b), b.dataset.simge, !!b.disabled, { gecikme: 1000 + i * 220 });
      const ac = () => { if (!b.disabled) D.simgeHalka(b, true); }, kapa = () => D.simgeHalka(b, false);
      b.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') ac(); });
      b.addEventListener('pointerleave', kapa);
      b.addEventListener('focus', () => { if (b.matches(':focus-visible')) ac(); });
      b.addEventListener('blur', kapa);
    });
    $$('.susler [data-sus]').forEach((s, i) => D.susCiz(s, s.dataset.sus, [0, i], 1300 + i * 250));
    O.karakter = KF.kaptan.kur($('#karakter'), { renk: C.renk.kirmizi, kursun: C.renk.kursun, tohum: 'kaptan', gecikme: 1100 });
    D.ustYaz($('#ust'), 0);
    KL.harfle($('#yeni-not'), null, { tohum: ['yeni-not'], anlik: true });
    girisKur();
    notKur();
    seslendir();
    V.baslat();
    $('#yeni-sayfa').addEventListener('click', yeniSayfa);
    $('#geri-al').addEventListener('click', geriAl);
    $('#yeniden-izle').addEventListener('click', yenidenIzle);
    $$('.ayar').forEach(b => b.addEventListener('click', () => ayarTik(b)));
  }

  // Resize only changes the projection. The active game and AI search stay intact.
  let bekleyen = 0;
  function yenidenBoyutla() {
    cancelAnimationFrame(bekleyen);
    bekleyen = requestAnimationFrame(() => {
      V.olcu();
      if (notAcik()) ayarlariCiz(true);
      sesSimgesiGuncelle(true);
    });
  }

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    KL.ayarla(C.cizim, C.renk);
    ayarlariYukle();
    O.oyunAyar = Object.assign({}, O.ayar);
    const sa = sahaOlcusu(O.ayar.saha);
    O.W = sa.W; O.H = sa.H;

    await KL.fontBekle();
    await KL.varlikYukle(KF.varliklar);        // assets/ içindeki isteğe bağlı PNG'ler
    sesDosyalariYukle();                       // ve isteğe bağlı ses kayıtları
    sahneKur();
    sayfaKur();

    // konsoldan / testlerden denemek için: KF.durum.git(x, y) gidilebilir noktaya oynar
    O.git = (x, y) => { const h = O.hedefler.find(k => k.x === x && k.y === y); if (!h || !girisAcik()) return false; insanHamle(h); return true; };
    O.sayfaKur = sayfaKur; O.yeniSayfa = yeniSayfa; O.geriAl = geriAl; O.yenidenIzle = yenidenIzle;
    O.notAc = notAc; O.notKapat = notKapat; O.macSonucu = macSonucu; O.sesCal = sesCal; O.kayitlar = kayitlar;
    KF.durum = O;
  }

  basla();
})();
