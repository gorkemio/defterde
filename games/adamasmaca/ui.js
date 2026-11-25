// ui.js — kontrolör: ölçü, font, sayfalar (İçindekiler, oyun, kart; sayfa çevirme), beş modun akışı, tahmin ve ipucu,
// bitiş animasyonları, klavye ve dokunma, saklama. Kurallar game.js'te, seçim secici.js'te, Hoca'nın hilesi hileci.js'te,
// mod yardımcıları modlar.js'te, çizim draw.js'te, kart sayfası kart.js'te; burada yalnız bunlar bağlanır.
(function () {
  'use strict';

  const AA = window.AA;
  const KL = window.Kit.kalem;
  const G = AA.game, S = AA.secici, D = AA.draw, C = AA.config, tr = AA.tr, M = AA.modlar, HL = AA.hileci, K = AA.kart;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];

  /* ---------- durum ---------- */

  // jeton: oyunun kimliği; her yeni kelimede/sayfa değişiminde artar, bekleyen adımlar jeton değiştiyse sessizce çıkar.
  // kilit: oyun kurulurken ve bittikten sonra sonuç yazılana kadar girdiyi engeller. Animasyon sürerken tahmin KABUL edilir
  // (klavyeyle hızlı yazan harf kaybetmesin).
  // oturum: Başla'dan İçindekiler'e dönene kadar süren mod durumu (maraton sırası, Okul oyuncuları, Hileci motoru, günün kaydı).
  const O = {
    jeton: 0, oyunId: 0, sayfa: 'ic', durum: null, kilit: true, cevriliyor: false, L: null, sayfaNo: 1, durumYazi: ['', 'kursun'],
    ayar: { mod: 'tek', kategori: 'Genel', zorluk: 'orta' },
    ist: { kurtarma: 0, seri: 0, enIyiSeri: 0, oynanan: 0, puan: 0, hatasiz: 0, gunler: [], rozetler: [], maratonEnIyi: 0 },
    gecmis: [], anlam: '', indeks: null,
    oturum: { mod: 'tek', n: 1 },
    T: {}, tuslar: {}, hoca: null,
  };
  const VERI = () => AA.veri;
  const mod = () => O.oturum.mod;
  const okul = () => O.oturum.okul;

  /* ---------- saklama (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const bellek = {};
  function oku(anahtar, varsayilan) {
    try { const s = localStorage.getItem(anahtar); if (s) return JSON.parse(s); } catch (e) { /* yoksay */ }
    return bellek[anahtar] ?? varsayilan;
  }
  function yaz(anahtar, v) { bellek[anahtar] = v; try { localStorage.setItem(anahtar, JSON.stringify(v)); } catch (e) { /* yoksay */ } }

  function yukle() {
    const a = oku('aa-ayar', null);
    if (a && G.ZORLUKLAR.includes(a.zorluk) && C.kategoriler.includes(a.kategori) && G.MODLAR.includes(a.mod)) O.ayar = { ...O.ayar, ...a };
    O.ist = { ...O.ist, ...oku('aa-istatistik', {}) };
    O.gecmis = oku('aa-gecmis', []);
  }
  const kaydet = () => { yaz('aa-ayar', O.ayar); yaz('aa-istatistik', O.ist); yaz('aa-gecmis', O.gecmis); };

  /* ---------- ölçü: üç düzen modu (layout.js); üç sayfa aynı kutu ---------- */

  const SAYFALAR = { ic: '#s-ic', oyun: '#s-oyun', kart: '#s-kart' };

  function olcu() {
    const l = AA.layout.hesapla(KL.alan());
    O.L = l;
    const r = document.documentElement.style;
    r.setProperty('--sq', l.sq + 'px');
    r.setProperty('--kw', String(l.kw));
    r.setProperty('--kh', String(l.kh));
    r.setProperty('--marj-k', String(l.marjK));
    document.body.dataset.mod = l.mod;
    return l;
  }
  const kompakt = () => O.L.mod === 'kompakt';
  const genis = () => Math.round(O.L.iw * 20);                    // içerik sütununun eni (SVG birimi; 1 kare = 20)
  const ustTip = (sayfa) => (sayfa === 'ic' ? (kompakt() ? 'icK' : 'ic') : (kompakt() ? 'oyunK' : 'oyun'));
  const duyur = (metin) => { $('#duyuru').textContent = metin; };
  // Ses hiçbir zaman oyunu durdurmaz (Kit.ses.cal kendi içinde de yakalar)
  const ses = (adi, ms = 0) => { try { window.Kit.ses.cal(adi, ms); } catch (e) { /* yoksay */ } };
  // SVG öğelerinde `hidden` özelliği yoktur (yalnız HTML'de); öznitelik üzerinden gizlenir
  const gizle = (el, evet) => { if (evet) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); };

  /* ---------- klavye odağı: kurşun kalem çerçevesi ---------- */

  const klavyeOdagi = (el) => { try { return el.matches(':focus-visible'); } catch (e) { return true; } };
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.matches && el.matches('button') && klavyeOdagi(el)) KL.odakCiz(el, el.classList.contains('harf-tus') ? 'cember' : 'kutu');
  });
  document.addEventListener('focusout', (e) => { if (e.target.matches && e.target.matches('button')) KL.odakSil(e.target); });

  /* ---------- İçindekiler: iskelet index.html'de; burada listeler doldurulur ---------- */

  const MODLAR = [['tek', 'Tek kişilik'], ['okul', 'Okul'], ['hileci', 'Hileci Hoca'], ['gunun', 'Günün kelimesi'], ['maraton', 'Maraton']];
  const ZORLUK_YILDIZ = { kolay: 1, orta: 2, zor: 3 };
  const SVGNS = 'http://www.w3.org/2000/svg';

  function icKur() {
    const svg = (sinif, vb) => { const e = document.createElementNS(SVGNS, 'svg'); e.setAttribute('class', sinif); e.setAttribute('viewBox', vb); e.setAttribute('aria-hidden', 'true'); return e; };
    const secenek = (grup, deger, yazi, o = {}) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ic-sec';
      b.dataset.grup = grup;
      b.dataset.deger = deger;
      b.dataset.yazi = yazi;
      b.setAttribute('aria-pressed', 'false');
      if (o.simge) b.appendChild(svg('simge', '0 0 40 40'));
      const y = document.createElement('span');
      y.className = 'yazi';
      y.textContent = yazi;
      b.appendChild(y);
      if (o.yildiz) b.appendChild(svg('yildizlar', '0 0 66 22'));
      li.appendChild(b);
      return li;
    };
    const doldur = (sel, ogeler) => { const ul = $(sel); ul.textContent = ''; for (const li of ogeler) ul.appendChild(li); };
    doldur('#ic-mod', MODLAR.map(([k, ad]) => secenek('mod', k, ad, { simge: true })));
    doldur('#ic-kat', C.kategoriler.map((ad) => secenek('kategori', ad, ad)));
    doldur('#ic-zor', G.ZORLUKLAR.map((z) => secenek('zorluk', z, z, { yildiz: true })));
  }

  /* ---------- köşe karalamaları (kurşun; telefonda yok) ---------- */

  function suslerCiz(sayfa, anlik = false) {
    if (!O.L.susler) return;
    $$(`${SAYFALAR[sayfa]} .susler [data-sus]`).forEach((s, i) => KL.susCiz(s, s.dataset.sus, [sayfa, i], anlik ? 0 : 1100 + i * 250, anlik));
  }

  /* ---------- düğme etiketi: el yazısı (Kit.kalem.harfle); erişilebilir ad düğmeye verilir ---------- */

  function dugmeYaz(b, yazi, o = {}) {
    b.dataset.yazi = yazi;
    KL.harfle($('.yazi', b), yazi, { tohum: ['dugme', b.id, yazi], adim: 28, ...o });
  }

  /* ---------- ses düğmesi: marjda kalemle çizilmiş hoparlör (açıkken dalgalar, kapalıyken kırmızı çarpı) ---------- */

  function sesSimgeleri(anlik = true) {
    const acik = !window.Kit.ses.sessiz;
    for (const b of document.querySelectorAll('.ses-dugme')) {
      KL.sesSimgesiCiz(b.querySelector('svg'), acik, anlik);
      b.setAttribute('aria-pressed', String(!acik));
      b.setAttribute('aria-label', acik ? 'Sesi kapat' : 'Sesi aç');
    }
  }
  function sesDegis() {
    window.Kit.ses.baslat();
    window.Kit.ses.sessizYap(!window.Kit.ses.sessiz);
    sesSimgeleri(false);
    if (!window.Kit.ses.sessiz) ses('kalem');
  }

  // Modun geçersiz kıldığı seçenekler: Hileci yalnız zor ve atasözüsüz; Günün kelimesi sabit; Okul'da kelimeyi arkadaş seçer; Maraton'da zorluk artar.
  function kisitlar() {
    const m = O.ayar.mod;
    if (m === 'hileci') { O.ayar.zorluk = 'zor'; if (O.ayar.kategori === 'Atasözleri') O.ayar.kategori = 'Genel'; }
    const katYok = m === 'gunun' || m === 'okul', zorYok = m === 'gunun' || m === 'maraton';
    for (const b of document.querySelectorAll('#s-ic .ic-sec')) {
      const g = b.dataset.grup, v = b.dataset.deger;
      const pasif = (g === 'kategori' && (katYok || (m === 'hileci' && v === 'Atasözleri'))) || (g === 'zorluk' && (zorYok || (m === 'hileci' && v !== 'zor')));
      b.disabled = pasif;
      b.setAttribute('aria-disabled', String(pasif));
    }
    $('#ic-not-kategori').textContent = { okul: 'kelimeyi arkadaşın seçer', gunun: 'günün kelimesi herkese aynı', hileci: 'atasözü yok' }[m] || '';
    $('#ic-not-zorluk').textContent = { gunun: '10 çizgi, herkese aynı', maraton: 'kendiliğinden artar', hileci: 'Hileci yalnız zor' }[m] || '';
    return { katYok, zorYok };
  }

  // Seçili öğe kurşun çemberle; seçili modun simgesi ve seçili zorluğun yıldızları mürekkeple çizilir.
  function icSecimleriGuncelle(anlik = true) {
    const { katYok, zorYok } = kisitlar();
    for (const b of $$('#s-ic .ic-sec')) {
      const g = b.dataset.grup;
      const acik = O.ayar[g] === b.dataset.deger && !(g === 'kategori' && katYok) && !(g === 'zorluk' && zorYok);
      b.setAttribute('aria-pressed', String(acik));
      D.cemberCiz(b, acik, g + b.dataset.deger, anlik);
      const simge = $('.simge', b);
      if (simge) D.simgeCiz(simge, b.dataset.deger, acik ? 'mavi' : 'kursun', { anlik: true, kalin: 1.5 });
      const yildiz = $('.yildizlar', b);
      if (yildiz) D.yildizlarCiz(yildiz, ZORLUK_YILDIZ[b.dataset.deger], acik ? 'mavi' : 'kursun', b.dataset.deger);
    }
  }

  // Başla'nın yanında: kurtarılan adamların çetelesi ve kısa istatistik
  function icIstatistik() {
    const i = O.ist, k = kompakt(), en = k ? 10 : 8.6;
    D.ceteleCiz($('#ic-cetele'), i.kurtarma, 'ic', Math.round(en * 20), { yukseklik: 36, y0: -2, enCok: k ? 25 : 20 });
    const satirlar = i.kurtarma
      ? [`kurtarılan ${i.kurtarma} · seri ${i.enIyiSeri}`, `puan ${i.puan}${i.maratonEnIyi ? ` · maraton ${i.maratonEnIyi}` : ''}`]
      : ['henüz kimseyi', 'kurtarmadın'];
    $('#ic-ist').innerHTML = satirlar.map((s) => `<span class="satir">${s}</span>`).join('');
  }

  function icCiz(anlik = false) {
    D.ustBantCiz($('#ic-ust'), genis(), ustTip('ic'), { anlik, altYazi: 'kelimeyi bul, adamı kurtar' });
    D.kahramanCiz($('#ic-kahraman'), { anlik, gecikme: 450 });
    D.rozetCiz($('#ic-rozet'), new Set(O.ist.rozetler), 'ic', genis(), { etiket: true });
    $$('#s-ic .ic-sec').forEach((b, i) => KL.harfle($('.yazi', b), b.dataset.yazi, { tohum: ['ic', b.dataset.grup, b.dataset.deger], anlik, gecikme: 250 + i * 30, adim: 16 }));
    icSecimleriGuncelle(true);
    dugmeYaz($('#basla'), 'Başla', { anlik, gecikme: 900, adim: 60 });
    KL.dugmeCerceve($('#basla'), anlik ? 0 : 900, anlik);
    icIstatistik();
    suslerCiz('ic', anlik);
  }

  function icTik(e) {
    const b = e.target.closest('.ic-sec');
    if (!b || b.disabled) return;
    O.ayar[b.dataset.grup] = b.dataset.deger;
    yaz('aa-ayar', O.ayar);
    icSecimleriGuncelle(false);
  }

  /* ---------- sayfa çevirme ---------- */

  // Görünen sayfanın kopyası (aynen, çizimleriyle) sol kenar etrafında kalkıp gider; 90°'den sonra yaprağın soluk kareli
  // arka yüzü görünür. Altında yeni sayfa kurulur. Kopya gerçek sayfalardan SONRA durur: iç kimlikler (CSS yerleşimi
  // onlara bağlı) korunur, $('#…') yine gerçeğini bulur. Kopya inert ve aria-hidden; bitince silinir.
  async function cevir(uret) {
    const gorunen = Object.values(SAYFALAR).map((s) => $(s)).find((s) => !s.hidden);
    if (!gorunen || !KL.animasyonVar() || O.cevriliyor) { await uret(); return; }
    O.cevriliyor = true;
    ses('cevir');
    const klon = gorunen.cloneNode(true);
    klon.removeAttribute('id');
    klon.removeAttribute('aria-label');
    klon.hidden = false;
    const golge = document.createElement('div');
    golge.className = 'yaprak-golge';
    klon.appendChild(golge);
    const arka = document.createElement('div');
    arka.className = 'yaprak-arka';
    const yaprak = document.createElement('div');
    yaprak.className = 'yaprak';
    yaprak.inert = true;
    yaprak.setAttribute('aria-hidden', 'true');
    yaprak.style.width = gorunen.offsetWidth + 'px';
    yaprak.style.height = gorunen.offsetHeight + 'px';
    yaprak.append(klon, arka);
    $('#defter').appendChild(yaprak);
    try {
      // Saydamlık yaprağın kendisine verilmez: opacity 3B'yi düzleştirir, arka yüz yerine ön yüzün aynası görünür.
      const p = 'perspective(2400px) ', sure = 820;
      const a = yaprak.animate([
        { transform: p + 'rotateY(0deg)' },
        { transform: p + 'rotateY(-10deg) rotateX(3deg)', offset: .2 },                      // köşe kalkar
        { transform: p + 'rotateY(-105deg) rotateX(1deg)', offset: .7 },
        { transform: p + 'rotateY(-160deg)' },
      ], { duration: sure, easing: 'ease-in-out', fill: 'forwards' });
      for (const yuz of [klon, arka]) yuz.animate([{ opacity: 1 }, { opacity: 1, offset: .72 }, { opacity: 0 }], { duration: sure, fill: 'forwards' });   // masaya yatarken solar
      golge.animate([{ opacity: 0 }, { opacity: .25, offset: .3 }, { opacity: .6 }], { duration: 600, fill: 'forwards' });
      // zaman aşımı: sekme arka plandayken kare üretilmez; çevirme bitmese de oyun kilitli kalmasın
      await Promise.all([uret(), Promise.race([a.finished.catch(() => {}), KL.bekle(1500)])]);
    } finally {
      yaprak.remove();
      O.cevriliyor = false;
    }
  }

  async function sayfayaGit(ad, sonra) {
    await cevir(async () => {
      for (const [k, sel] of Object.entries(SAYFALAR)) $(sel).hidden = k !== ad;
      O.sayfa = ad;
      await sonra();
    });
  }

  /* ---------- kart sayfası (Okul adımları, günün sonucu, maraton özeti) ---------- */

  // Kart sayfasının başı oyun sayfasınınkiyle aynı yerde: başlık, tarih ve modu söyleyen durum satırı
  function kartUstCiz(anlik = false) {
    const svg = $('#kart-ust');
    D.ustBantCiz(svg, genis(), ustTip('kart'), { anlik });
    const m = mod();
    const yazi = m === 'okul' ? `okul · ${(O.oturum.okulTur || 0) + 1}. kelime` : { gunun: 'günün kelimesi', maraton: 'maraton' }[m] || '';
    D.durumYaz(svg, yazi, 'kursun', { anlik, gecikme: anlik ? 0 : 650 });
  }

  // secenek: kart.js kur() girdisi. baglan(refs): düğmelere eylem bağlar.
  async function kartAc(secenek, baglan) {
    const uret = async () => {
      olcu();
      const refs = K.kur(secenek);
      baglan(refs);
      kartUstCiz(false);
      K.cerceveleriCiz(false);
      suslerCiz('kart');
      return refs;
    };
    O.jeton++;
    if (O.sayfa === 'kart') await cevir(uret); else await sayfayaGit('kart', uret);
    O.kilit = false;
  }

  const ad = (i) => C.okul.oyuncular[i];
  const ink = (i) => (i ? 'kirmizi' : 'mavi');

  /* ---------- Okul modu: telefonu ver → gizli giriş → telefonu geri ver → tahmin ---------- */

  async function okulVer() {
    const o = okul(), t = o.sira, g = 1 - t;
    await kartAc({
      baslik: 'Telefonu arkadaşına ver', renk: ink(g), simge: 'telefon',
      metinler: [`${ad(g)} kelimeyi girecek.`, `${ad(t)}, bakma!`],
      dugmeler: [{ id: 'k-hazir', yazi: 'Hazırım' }, { id: 'k-geri', yazi: 'içindekiler', ikincil: true }],
    }, (r) => { r.dugmeler['k-hazir'].onclick = () => okulGir(); r.dugmeler['k-geri'].onclick = icindekilereDon; });
  }

  async function okulGir() {
    const o = okul(), g = 1 - o.sira;
    O.indeks = O.indeks || M.sozlukIndeksi(VERI());
    let giris;
    await kartAc({
      baslik: 'Gizli kelime', renk: ink(g), simge: 'goz',
      metinler: [`${ad(g)}, bir kelime ya da söz yaz. ${ad(o.sira)} görmesin.`],
      govde: (kap) => { giris = K.okulGirisi(kap, { renk: ink(g) }); },
      dugmeler: [{ id: 'k-tamam', yazi: 'Tamam' }, { id: 'k-geri', yazi: 'içindekiler', ikincil: true }],
    }, (r) => {
      const secenekleriYaz = () => {
        giris.kontrol.setAttribute('aria-checked', String(o.kontrol));
        giris.kontrol.innerHTML = `sözlük kontrolü: <span class="${o.kontrol ? 'acik' : ''}">${o.kontrol ? 'açık' : 'kapalı'}</span>`;
        giris.kategori.textContent = `kategori etiketi: ${o.kategori || 'yok'}`;
      };
      secenekleriYaz();
      const kategoriler = [null, ...C.kategoriler.filter((k) => k !== 'Genel' && k !== 'Atasözleri')];
      giris.kontrol.onclick = () => { o.kontrol = !o.kontrol; secenekleriYaz(); };
      giris.kategori.onclick = () => { o.kategori = kategoriler[(kategoriler.indexOf(o.kategori) + 1) % kategoriler.length]; secenekleriYaz(); };
      giris.goster.onclick = () => {
        const gizli = giris.giris.type === 'password';
        giris.giris.type = gizli ? 'text' : 'password';
        $('.etiket', giris.goster).textContent = gizli ? 'gizle' : 'göster';
        D.simgeCiz($('svg', giris.goster), gizli ? 'gozKapali' : 'goz', 'kursun', { anlik: true, kalin: 1.5 });
        giris.goster.setAttribute('aria-pressed', String(gizli));
      };
      const tamam = async () => {
        const s = M.okulGirdisi(giris.giris.value, { kontrol: o.kontrol, indeks: O.indeks });
        if (!s.ok) { giris.hata.textContent = s.hata; giris.giris.focus(); return; }
        o.gizli = s.kelime; o.anlam = s.anlam;
        giris.giris.value = '';
        await okulGeri();
      };
      r.dugmeler['k-tamam'].onclick = tamam;
      r.dugmeler['k-geri'].onclick = icindekilereDon;
      giris.giris.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tamam(); } else if (e.key === 'Escape') icindekilereDon(); });
      giris.giris.addEventListener('input', () => { giris.hata.textContent = ''; });
      setTimeout(() => giris.giris.focus(), 50);
    });
  }

  async function okulGeri() {
    const o = okul(), t = o.sira;
    await kartAc({
      baslik: 'Telefonu geri ver', renk: ink(t), simge: 'telefon',
      metinler: [`${ad(t)}, sıra sende!`, `Kelime ${Array.from(o.gizli).filter((c) => c !== ' ').length} harfli${o.kategori ? `, kategori: ${o.kategori}` : ''}.`],
      dugmeler: [{ id: 'k-hazir', yazi: 'Hazırım' }],
    }, (r) => { r.dugmeler['k-hazir'].onclick = okulOyna; });
  }

  async function okulOyna() {
    const o = okul();
    O.anlam = o.anlam || '';
    const d = G.yeniOyun({ kelime: o.gizli, zorluk: O.ayar.zorluk, mod: 'okul', kategori: o.kategori || 'Okul' });
    await sayfayaGit('oyun', () => oyunKur(d));
  }

  async function okulSiradaki() {
    const o = okul();
    O.oturum.okulTur = (O.oturum.okulTur || 0) + 1;
    o.sira = 1 - o.sira;
    o.gizli = null;
    await okulVer();
  }

  /* ---------- Günün kelimesi ---------- */

  async function kopyala(metin) {
    try { await navigator.clipboard.writeText(metin); return true; } catch (e) { /* yedek yol */ }
    try {
      const t = document.createElement('textarea');
      t.value = metin; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (e) { return false; }
  }

  async function paylas(dugme) {
    const metin = M.gunlukPaylasim(O.oturum.gunun.kayit);
    const eski = dugme.dataset.yazi || $('.yazi', dugme).textContent;
    const tamam = await kopyala(metin);
    const isaretli = !!$(':scope > svg.isaret', dugme);
    KL.harfle($('.yazi', dugme), tamam ? 'Kopyalandı!' : 'Kopyalanamadı', { tohum: ['paylas', tamam], adim: 25 });
    if (!tamam && O.sayfa === 'oyun') { const an = $('#s-anlam'); an.className = 's-anlam paylasim'; an.textContent = metin; }     // elle kopyalanabilsin
    duyur(tamam ? 'Sonuç panoya kopyalandı.' : 'Kopyalanamadı. Metni elle kopyalayabilirsin: ' + metin);
    setTimeout(() => {
      if (!dugme.isConnected) return;
      KL.harfle($('.yazi', dugme), eski, { tohum: ['dugme', dugme.id, eski], anlik: true });
      KL.dugmeCerceve(dugme, 0, true);
      if (isaretli) D.dugmeIsaretle(dugme, true, true);
    }, 1800);
  }

  async function gunlukBasla() {
    const tarih = S.yerelTarih(), bilgi = M.gunlukBilgi(VERI(), tarih);
    let kayit = oku('aa-gunun', null);
    if (!kayit || kayit.tarih !== tarih) kayit = M.gunlukKayitYeni(bilgi);
    O.oturum.gunun = { bilgi, kayit };
    if (kayit.sonuc) { await gunlukSonucKarti(); return; }
    const d = M.gunlukOyna(bilgi, kayit.adimlar);                   // yenileme sonrası kaldığı yerden devam
    O.anlam = bilgi.anlam;
    await sayfayaGit('oyun', () => oyunKur(d, { geriYukle: kayit.adimlar.length > 0 }));
  }

  function gunlukIsle(adim, d) {
    const g = O.oturum.gunun;
    g.kayit = M.gunlukKayitIsle(g.kayit, adim, d);
    yaz('aa-gunun', g.kayit);
  }

  async function gunlukSonucKarti() {
    const { bilgi, kayit } = O.oturum.gunun;
    await kartAc({
      baslik: `Günün kelimesi #${bilgi.no}`, renk: 'mavi', simge: 'gunun',
      metinler: [kayit.sonuc === 'kurtuldu' ? 'Bugünkü kelimeyi çözdün!' : 'Bugünkü kelimeyi çözemedin.', `Kelime: ${bilgi.kelime}`, 'Yarın yeni bir kelime gelecek.'],
      paylasim: M.gunlukPaylasim(kayit),
      dugmeler: [{ id: 'k-paylas', yazi: 'Paylaş' }, { id: 'k-geri', yazi: 'içindekiler', ikincil: true }],
    }, (r) => { r.dugmeler['k-paylas'].onclick = () => paylas(r.dugmeler['k-paylas']); r.dugmeler['k-geri'].onclick = icindekilereDon; });
  }

  /* ---------- Maraton ---------- */

  async function maratonOzeti() {
    const oz = O.oturum.maratonOz;
    await kartAc({
      baslik: 'Maraton bitti', renk: 'mavi', simge: 'maraton',
      metinler: [`${oz.kurtarilan} kelime kurtardın.`, oz.rekor && oz.kurtarilan > 0 ? 'Yeni rekor!' : `En iyi: ${oz.enIyi} kelime.`],
      dugmeler: [{ id: 'k-tekrar', yazi: 'Tekrar oyna' }, { id: 'k-geri', yazi: 'içindekiler', ikincil: true }],
    }, (r) => {
      r.dugmeler['k-tekrar'].onclick = async () => { O.oturum.n = 1; const d = yeniDurum(); await sayfayaGit('oyun', () => oyunKur(d)); };
      r.dugmeler['k-geri'].onclick = icindekilereDon;
    });
  }

  /* ---------- oyun sayfası ---------- */

  function hocaKur() {
    if (O.hoca) return;
    O.hoca = window.Kit.karakter.kur($('#hoca'), { renk: 'kirmizi', kursun: 'kursun', tohum: 'hoca' });
  }

  function notGuncelle() {
    const d = O.durum;
    if (d.bitti) return;
    $('#not-kalan').innerHTML = `<span class="satir">kalan çizgi</span><span class="satir sayi">${d.kalan}</span>`;
  }

  function ipucuGuncelle() {
    const d = O.durum, acik = G.ipucuAcikMi(d);
    const h = $('#ip-harf'), a = $('#ip-anlam');
    h.hidden = a.hidden = $('#ipuclari').hidden = d.bitti;
    h.disabled = !acik;
    const anlamYok = mod() === 'hileci' || !O.anlam;                        // Hileci kelimeyi seçmedi; Okul'da sözlük kontrolü kapalıysa anlam yok
    a.disabled = !acik || d.ipucu.anlam || anlamYok;
    h.setAttribute('aria-label', 'Bir harf aç, bir çizgiye mal olur' + (h.disabled ? ', kapalı' : ''));
    a.setAttribute('aria-label', 'Anlamını göster, bir çizgiye mal olur' + (a.disabled ? ', kapalı' : ''));
  }

  const kelimeAriaEtiketi = (d) => 'Kelime: ' + d.maske.map((c) => (c === ' ' ? ' boşluk ' : c ?? 'boş')).join(' ');

  // Çetele: tek/hileci/günün → kurtarılan adamlar; maraton → bu koşudaki kelime sayısı; Okul → iki oyuncunun çetelesi (Hoca'nın yerinde).
  // Defter/tablette marjda alt alta (yazı üstte, beşliler altta); telefonda sayfanın altında tek satır.
  function ceteleGuncelle(yeni) {
    const svg = $('#cetele');
    if (mod() === 'okul') {
      gizle(svg, true);
      D.okulCeteleCiz($('#okul-cetele'), okul().puan, okul().sira, C.okul.oyuncular, O.oyunId, { yeni: yeni ? okul().sira : -1 });
      return;
    }
    gizle(svg, false);
    let adet, satirlar;
    if (mod() === 'maraton') { adet = O.oturum.n - 1; satirlar = [`maraton: ${O.oturum.n}. kelime`, `en iyi: ${Math.max(O.ist.maratonEnIyi, adet)}`]; }
    else { adet = O.ist.kurtarma; satirlar = [`kurtarılan: ${O.ist.kurtarma}`]; if (O.ist.seri > 1) satirlar.push(`seri: ${O.ist.seri}`); }
    if (kompakt()) {
      // yazı solda, beşliler hemen ardından; arta kalan yerde kaç beşli sığarsa
      const g = 300, yazi = satirlar.join(' · '), x0 = Math.round(12 + yazi.length * 6.8);
      const yer = Math.max(1, Math.floor((g - x0) / 42));
      D.ceteleCiz(svg, adet, 'cetele', g, { yeni, enCok: yer * 5, yukseklik: 48, x0, y0: 2 });
      KL.metinSvg(svg, yazi, { x: 2, y: 30, boyut: 16, hiza: 'start', renk: 'kursun', tohum: ['cetele-yazi', yazi], anlik: true });
    } else {
      D.ceteleCiz(svg, adet, 'cetele', 152, { yeni, yukseklik: 112, y0: 40, satirBasi: 3, enCok: 30 });
      satirlar.forEach((s, i) => KL.metinSvg(svg, s, { x: 4, y: 16 + i * 19, boyut: 16, hiza: 'start', renk: 'kursun', tohum: ['cetele-yazi', s], anlik: true }));
    }
  }

  /* ---------- sayfa başı ve durum satırı ---------- */

  function oyunUstCiz(anlik = false) {
    D.ustBantCiz($('#ust'), genis(), ustTip('oyun'), { anlik });
  }

  // Durum satırı: ne olduğunu kısaca söyler (kardeş oyunlardaki gibi başlığın altında, kurşun ya da mürekkeple)
  function durum(yazi, renk = 'kursun', o = {}) {
    O.durumYazi = [yazi, renk];
    D.durumYaz($('#ust'), yazi, renk, o);
  }

  function baslangicDurumu(o = {}) {
    const m = mod();
    if (m === 'okul') return [`${ad(okul().sira)}, bir harf seç`, ink(okul().sira)];
    if (m === 'hileci') return ['Hoca bir kelime tuttu… sözde', 'kursun'];
    if (m === 'gunun') return [`günün kelimesi #${O.oturum.gunun.bilgi.no}${o.geriYukle ? ' · kaldığın yerden' : ''}`, 'kursun'];
    if (m === 'maraton') return [`maraton · ${O.oturum.n}. kelime`, 'kursun'];
    return ['bir harf seç', 'kursun'];
  }

  const kalanYazisi = (d) => (d.kalan === 1 ? 'son çizgi!' : `${d.kalan} çizgi kaldı`);

  // Kullanılmış harf: düğme kapanmaz (yeniden basılınca titrer), yalnız işaretlenir
  function tusKapat(tus) { tus.setAttribute('aria-disabled', 'true'); tus.classList.add('denendi'); }

  function harfTitret(harf) {
    const tus = O.tuslar[harf];
    if (tus && KL.animasyonVar()) { tus.classList.remove('titre'); void tus.offsetWidth; tus.classList.add('titre'); }
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) { /* yoksay */ }
    durum(`${harf} zaten denendi`);
    duyur(`${harf} harfini zaten denedin.`);
  }

  // Ekran modu değişince (ör. telefon yan çevrildi) içerik sütununun eni değişir: kelime, etiket, baş ve çetele yeniden çizilir.
  function oyunYenidenCiz() {
    const d = O.durum;
    if (!d) return;
    const id = O.oyunId;
    oyunUstCiz(true);
    D.durumYaz($('#ust'), O.durumYazi[0], O.durumYazi[1], { anlik: true });
    D.etiketCiz($('#etiket'), d.kategori, mod() === 'gunun' ? 'orta' : d.zorluk, id, genis(), { anlik: true });
    const T = D.kelimeKur($('#kelime'), d.gosterim ?? 'X'.repeat(d.maske.length), id, genis());
    O.T.kelime = T;
    D.cizgileriCiz(T, true);
    d.maske.forEach((c, i) => { if (c && c !== ' ') D.harfYaz(T, i, c, 'mavi', { anlik: true }); });
    if (d.bitti && d.sonuc !== 'kurtuldu' && d.hedef) d.maske.forEach((c, k) => { if (c === null) D.harfYaz(T, k, d.hedef[k], 'kirmizi', { anlik: true }); });
    ceteleGuncelle(false);
  }

  // Yeni kelime: sayfa kurulur, hazır parçalar çizilir. o.geriYukle: kaydedilmiş ilerleme (günün kelimesi) anında çizilir.
  async function oyunKur(d, o = {}) {
    const j = ++O.jeton;
    O.kilit = true;
    O.durum = d;
    O.oyunId++;
    const id = O.oyunId;
    const m = mod();

    // 1. temizlik: sayfa boyu sabit (layout.js); kelime 2 satıra sığdırılır, sonuç alanı sabit
    olcu();
    const sonraki = $('#sonraki');
    sonraki.hidden = true;
    D.dugmeIsaretle(sonraki, false);
    $('#s-baslik').textContent = '';
    $('#s-baslik').classList.remove('kayip');
    $('#s-anlam').textContent = '';
    $('#s-anlam').className = 's-anlam';
    $('#rozet-not').innerHTML = '';
    $('#rozet-not').classList.remove('rozet-etiket');
    const oyun = $('#s-oyun');
    oyun.classList.remove('itiraf', 'bitti');
    gizle($('#hoca'), m === 'okul');
    gizle($('#okul-cetele'), m !== 'okul');
    const kelimeT = D.kelimeKur($('#kelime'), d.gosterim ?? 'X'.repeat(d.maske.length), id, genis());
    O.T.kelime = kelimeT;

    // 2. sayfa başı, numara ve kalan öğeler
    const anlik = !!o.geriYukle;
    O.sayfaNo = m === 'okul' ? (O.oturum.okulTur || 0) + 1 : O.ist.oynanan + 1;
    KL.harfle($('#sayfa-no'), `sayfa ${O.sayfaNo}`, { tohum: ['sayfa-no', O.sayfaNo], anlik: true });
    oyunUstCiz(anlik);
    const [ilkDurum, ilkRenk] = baslangicDurumu(o);
    durum(ilkDurum, ilkRenk, { anlik, gecikme: anlik ? 0 : 750 });
    O.T.dar = D.daragaciKur($('#daragaci'), id);
    O.tuslar = D.alfabeKur($('#alfabe'), id);
    $('#kelime').setAttribute('aria-label', kelimeAriaEtiketi(d));
    hocaKur();
    D.okCiz($('#geri .ok'));
    D.etiketCiz($('#etiket'), d.kategori, m === 'gunun' ? 'orta' : d.zorluk, id, genis());
    D.rozetCiz($('#rozetler'), new Set(O.ist.rozetler), 'marj', 150);
    ceteleGuncelle(false);
    notGuncelle();
    dugmeYaz($('#ip-harf'), 'Bir harf aç', { anlik, gecikme: 300 });
    dugmeYaz($('#ip-anlam'), 'Anlamını göster', { anlik, gecikme: 380 });
    ipucuGuncelle();
    KL.dugmeCerceve($('#ip-harf'), 300, anlik);
    KL.dugmeCerceve($('#ip-anlam'), 380, anlik);
    suslerCiz('oyun', anlik);
    duyur(`Yeni kelime. Kategori ${d.kategori}. ${G.harfSayisi(d)} harf. ${d.kalan} çizgi hakkın var.`);

    // 3. çizimler
    const bit = [];
    if (o.geriYukle) {                                    // kaldığı yerden devam: her şey anında
      const T = kelimeT;
      for (const h of d.denenen) { tusKapat(O.tuslar[h]); D.tusIsaretle(O.tuslar[h], d.yanlis.includes(h) ? 'yanlis' : 'dogru', id, { anlik: true }); }
      d.maske.forEach((c, i) => { if (c && c !== ' ') D.harfYaz(T, i, c, 'mavi', { anlik: true }); });
      D.cizgileriCiz(T, true);
      for (let i = 0; i < G.cizilenParca(d); i++) D.parcaCiz(O.T.dar, G.PARCALAR[i], { anlik: true });
      D.yuzCiz(O.T.dar, d.kalan, { anlik: true });
      if (d.ipucu.anlam) { const an = $('#s-anlam'); an.className = 's-anlam ip-metin'; KL.harfle(an, 'anlamı: ' + G.anlamMaskele(O.anlam, d.hedef), { anlik: true }); }
    } else {
      bit.push(D.cizgileriCiz(kelimeT, false));
      let gec = 0;
      for (let i = 0; i < G.hazirParca(d); i++) { bit.push(D.parcaCiz(O.T.dar, G.PARCALAR[i], { gecikme: gec, sureMs: [160, 240] }).bitti); gec += 150; }
    }
    await Promise.all(bit);
    if (j !== O.jeton) return;
    O.kilit = false;
  }

  // Darağacında eksik parçaları çizer (yanlış harf ya da ipucu bir çizgi ekler); yüzü o anki kalana göre yeniler.
  function daragaciYetis() {
    const d = O.durum, T = O.T.dar, bit = [];
    let gec = 0;
    for (let i = 0; i < G.cizilenParca(d); i++) {
      const adi = G.PARCALAR[i];
      if (!T.grup[adi]) { bit.push(D.parcaCiz(T, adi, { gecikme: gec }).bitti); gec += 160; }
    }
    return Promise.all(bit).then(() => (T === O.T.dar ? D.yuzCiz(T, O.durum.kalan).bitti : null));
  }

  /* ---------- tahmin ve ipuçları ---------- */

  async function tahminEt(harf) {
    const onceki = O.durum;
    if (O.kilit || !onceki || onceki.bitti) return;
    if (onceki.denenen.includes(harf)) { harfTitret(harf); return; }
    const j = O.jeton, id = O.oyunId;
    let d;
    if (mod() === 'hileci') {                             // Hoca önce cevabını verir: kelime en kalabalık kümeye göre "seçilir"
      const cevap = O.oturum.hileci.tahmin(harf);
      d = G.tahmin(onceki, harf, cevap.konumlar);
      if (O.hoca) O.hoca.ruh('dusunuyor', 350);
    } else d = G.tahmin(onceki, harf);
    O.durum = d;
    if (mod() === 'gunun') gunlukIsle(['t', harf], d);
    if (d.bitti) O.kilit = true;                          // bitiş: sonuç yazılana kadar başka girdi yok
    const tus = O.tuslar[harf], T = O.T.kelime;
    const bit = [];

    if (d.son.dogru) {
      bit.push(D.tusIsaretle(tus, 'dogru', id));
      d.son.konumlar.forEach((i, k) => bit.push(D.harfYaz(T, i, harf, 'mavi', { gecikme: k * 140 }).bitti));
      ses('kalem');
      if (O.hoca) O.hoca.ruh('somurt', 700);
      $('#kelime').setAttribute('aria-label', kelimeAriaEtiketi(d));
      if (!d.bitti) durum(d.son.konumlar.length > 1 ? `${harf} var! ${d.son.konumlar.length} tane` : `${harf} var!`, 'mavi');
      duyur(`${harf} var, ${d.son.konumlar.length} yerde.`);
    } else {
      bit.push(D.tusIsaretle(tus, 'yanlis', id));
      bit.push(daragaciYetis());
      ses('cit'); ses('kalem', 140);
      if (O.hoca) O.hoca.ruh('sirit', 900);
      if (!d.bitti) durum(`${harf} yok · ${kalanYazisi(d)}`, d.kalan === 1 ? 'kirmizi' : 'kursun');
      duyur(d.bitti ? `${harf} yok. Çizgin kalmadı.` : `${harf} yok. ${d.kalan} çizgi kaldı.`);
    }
    tusKapat(tus);
    notGuncelle();
    ipucuGuncelle();
    await Promise.all(bit);
    if (j !== O.jeton) return;
    if (d.bitti) await oyunBitti(j);
  }

  async function ipucuHarf() {
    const onceki = O.durum;
    if (O.kilit || !onceki || onceki.bitti || !G.ipucuAcikMi(onceki)) return;
    const j = O.jeton, id = O.oyunId;
    let d;
    try { d = mod() === 'hileci' ? G.harfAc(onceki, Math.random, O.oturum.hileci.harfAc()) : G.harfAc(onceki, Math.random); } catch (e) { return; }
    O.durum = d;
    const harf = d.son.harf, T = O.T.kelime, bit = [];
    if (mod() === 'gunun') gunlukIsle(['h', harf], d);
    if (d.bitti) O.kilit = true;
    d.son.konumlar.forEach((i, k) => bit.push(D.harfYaz(T, i, harf, 'mavi', { gecikme: k * 140 }).bitti));
    bit.push(D.tusIsaretle(O.tuslar[harf], 'dogru', id));
    tusKapat(O.tuslar[harf]);
    if (!d.bitti) durum(`ipucu: ${harf} açıldı · ${kalanYazisi(d)}`, d.kalan === 1 ? 'kirmizi' : 'kursun');
    ses('kalem');
    bit.push(daragaciYetis());
    if (O.hoca) O.hoca.ruh('dusunuyor', 700);
    $('#kelime').setAttribute('aria-label', kelimeAriaEtiketi(d));
    notGuncelle();
    ipucuGuncelle();
    duyur(`İpucu: ${harf} harfi açıldı, ${d.son.konumlar.length} yerde. ${d.kalan} çizgi kaldı.`);
    await Promise.all(bit);
    if (j !== O.jeton) return;
    if (d.bitti) await oyunBitti(j);
  }

  async function ipucuAnlam() {
    const onceki = O.durum;
    if (O.kilit || !onceki || onceki.bitti || !G.ipucuAcikMi(onceki) || onceki.ipucu.anlam || mod() === 'hileci' || !O.anlam) return;
    const d = G.anlamGoster(onceki);
    O.durum = d;
    if (mod() === 'gunun') gunlukIsle(['a'], d);
    const metin = 'anlamı: ' + G.anlamMaskele(O.anlam, d.hedef);                       // kelimenin kendisi tanımda gizlenir
    const an = $('#s-anlam');
    an.className = 's-anlam ip-metin';
    an.textContent = '';
    KL.harfle(an, metin, { tohum: ['anlam-ipucu', O.oyunId], adim: 10 });
    durum(`ipucu: anlamı aşağıda · ${kalanYazisi(d)}`, d.kalan === 1 ? 'kirmizi' : 'kursun');
    ses('kalem');
    if (O.hoca) O.hoca.ruh('dusunuyor', 700);
    const p = daragaciYetis();
    notGuncelle();
    ipucuGuncelle();
    duyur(`İpucu. ${metin}. ${d.kalan} çizgi kaldı.`);
    await p;
  }

  /* ---------- bitiş: puan, seri, rozet, animasyon, moda özgü sonuç ---------- */

  function sonrakiYazisi() {
    const d = O.durum;
    if (mod() === 'okul') return 'Sıradaki';
    if (mod() === 'gunun') return 'Paylaş';
    if (mod() === 'maraton' && d.sonuc !== 'kurtuldu') return 'Sonucu gör';
    return 'Sonraki kelime';
  }

  // Hileci: Hoca itiraf eder; kelime olarak elinde kalan ilk aday gösterilir
  function hileciItirafi() {
    const it = O.oturum.hileci.itiraf();
    O.durum = G.hedefYaz(O.durum, it.kelime);
    O.anlam = '';
    const kurtuldu = O.durum.sonuc === 'kurtuldu';
    let metin;
    if (it.sayi === 1) metin = kurtuldu ? 'Bu sefer hile tutmadı: elimde tek kelime kalmıştı.' : 'Hile bile gerekmedi: elimde tek kelime kalmıştı.';
    else metin = `Hile yaptım! Sonunda elimde ${it.sayi} kelime vardı: ${it.ilk10.join(', ')}${it.sayi > 10 ? '…' : ''}`;
    return { it, metin };
  }

  async function oyunBitti(j) {
    const m = mod();
    let itiraf = null;
    if (m === 'hileci') itiraf = hileciItirafi();
    const d = O.durum, kurtuldu = d.sonuc === 'kurtuldu';
    const i = O.ist;
    let puan = 0, yeniRozet = [];

    if (m !== 'okul') {                                   // Okul oyunları kendi çetelesini tutar; tek kişilik istatistiği etkilemez
      const bugun = S.yerelTarih();
      i.oynanan++;
      if (kurtuldu) {
        i.kurtarma++; i.seri++; i.enIyiSeri = Math.max(i.enIyiSeri, i.seri);
        puan = G.puanla(d, i.seri);
        i.puan += puan;
        if (!d.yanlis.length && !d.ipucu.harf && !d.ipucu.anlam) i.hatasiz++;
      } else i.seri = 0;
      if (!i.gunler.includes(bugun)) i.gunler = [...i.gunler, bugun].slice(-60);
      yeniRozet = G.rozetKontrol(i, d);
      i.rozetler = [...i.rozetler, ...yeniRozet];
      if (m === 'tek' || m === 'maraton') O.gecmis = S.gecmisEkle(O.gecmis, d.hedef);
    }
    if (m === 'okul' && kurtuldu) okul().puan[okul().sira]++;
    if (m === 'maraton') {
      if (kurtuldu) O.oturum.n++;
      else {
        const kurtarilan = O.oturum.n - 1;
        O.oturum.maratonOz = M.maratonOzet(kurtarilan, i.maratonEnIyi);
        i.maratonEnIyi = Math.max(i.maratonEnIyi, kurtarilan);
      }
    }
    kaydet();

    for (const b of Object.values(O.tuslar)) b.disabled = true;
    ipucuGuncelle();
    if (m === 'okul') durum(kurtuldu ? `kurtuldu! +1 ${ad(okul().sira)}` : 'bu sefer olmadı', kurtuldu ? ink(okul().sira) : 'kirmizi');
    else if (m === 'hileci') durum(kurtuldu ? 'Hoca\'yı yendin!' : 'Hoca kazandı… hileyle', kurtuldu ? 'mavi' : 'kirmizi');
    else durum(kurtuldu ? `kurtuldu! +${puan} puan` : 'bu sefer olmadı', kurtuldu ? 'mavi' : 'kirmizi');

    // kelime ve anlamı (Hileci'de itiraf) hemen yazılır; animasyon sürerken okunur
    const bas = $('#s-baslik');
    bas.textContent = '';
    bas.classList.toggle('kayip', !kurtuldu);
    KL.harfle(bas, d.hedef, { tohum: ['sonuc', O.oyunId], adim: 45 });
    const an = $('#s-anlam');
    an.className = 's-anlam';
    an.textContent = '';
    const aciklama = itiraf ? itiraf.metin : O.anlam;
    if (itiraf) $('#s-oyun').classList.add('itiraf');
    if (aciklama) KL.harfle(an, aciklama, { tohum: ['anlam', O.oyunId], adim: itiraf ? 5 : 8, gecikme: 250 });
    duyur((kurtuldu ? 'Kurtuldu! ' : `Kelime ${d.hedef}. `) + aciklama);

    let animasyon;
    if (kurtuldu) {
      if (O.hoca) { O.hoca.ruh('somurt', 1800); O.hoca.konus(m === 'hileci' ? 'olamaz!' : 'tüh!', 1800); }
      animasyon = D.kurtulus(O.T.dar, { ses });
    } else {
      const T = O.T.kelime;
      d.maske.forEach((c, k) => { if (c === null) D.harfYaz(T, k, d.hedef[k], 'kirmizi', { gecikme: 100 + k * 90 }); });    // eksik harfler kırmızıyla
      if (O.hoca) { O.hoca.ruh('sirit', 1800); O.hoca.konus('hehe', 1800); }
      animasyon = D.kayip(O.T.dar, d.hedef, { gecikme: 150 }).bitti;
      ses('hehe', 500);
    }
    await animasyon;
    if (j !== O.jeton) return;

    // puan, seri ve rozet notları; çeteleye bir çizgi
    const kap = $('#not-kalan');
    if (m === 'okul') kap.innerHTML = kurtuldu ? `<span class="satir sayi">+1</span><span class="satir">${ad(okul().sira)}</span>` : `<span class="satir">kelime</span><span class="satir">kurtuldu</span>`;
    else kap.innerHTML = kurtuldu
      ? `<span class="satir sayi">+${puan}</span><span class="satir">puan${i.seri > 1 ? ` · seri ${i.seri}` : ''}</span>`
      : '<span class="satir">olsun,</span><span class="satir">bir daha!</span>';
    if (KL.animasyonVar()) kap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    if (yeniRozet.length) {
      const r = $('#rozet-not');
      r.innerHTML = yeniRozet.map((k) => `<span class="satir">yeni rozet: ${G.ROZETLER[k]}!</span>`).join('');
      r.classList.add('rozet-etiket');
      D.rozetCiz($('#rozetler'), new Set(i.rozetler), 'marj', 150);
      duyur('Yeni rozet: ' + yeniRozet.map((k) => G.ROZETLER[k]).join(', '));
    }
    ceteleGuncelle(kurtuldu);

    // telefonda klavyenin yerine sonuç geçer; sıradaki adımın düğmesi kurşunla çember içine alınır
    $('#s-oyun').classList.add('bitti');
    const sonraki = $('#sonraki');
    sonraki.hidden = false;
    dugmeYaz(sonraki, sonrakiYazisi(), { gecikme: 80 });
    KL.dugmeCerceve(sonraki, 100);
    D.dugmeIsaretle(sonraki, true);
    try { sonraki.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* yoksay */ }
    O.kilit = false;
  }

  /* ---------- akış ---------- */

  // Moda ve ayara göre yeni oyun durumu (tek kişilik, Hileci, Maraton)
  function yeniDurum() {
    const m = mod();
    if (m === 'hileci') {
      const havuz = S.hileciHavuzu(VERI(), O.ayar.kategori);
      const kelimeler = havuz.map((a) => a.kelime);
      const uzunluk = HL.uzunlukSec(kelimeler, Math.random);
      O.oturum.hileci = HL.kur(kelimeler, uzunluk);
      O.anlam = '';
      return G.yeniOyun({ uzunluk, zorluk: 'zor', mod: 'hileci', kategori: O.ayar.kategori });
    }
    const zorluk = m === 'maraton' ? S.maratonZorluk(O.oturum.n) : O.ayar.zorluk;
    const adaylar = S.adaylar(VERI(), { kategori: O.ayar.kategori, zorluk });
    const a = S.sec(adaylar, O.gecmis, Math.random);
    O.anlam = a.anlam;
    const kategori = O.ayar.kategori === 'Genel' ? S.kategorisi(VERI(), a.kelime) : O.ayar.kategori;
    return G.yeniOyun({ kelime: a.kelime, zorluk, mod: m, kategori });
  }

  async function yeniKelime() {
    if (O.kilit || O.cevriliyor) return;
    const d = yeniDurum();
    await cevir(() => oyunKur(d));
  }

  async function sonrakiTik() {
    if (O.kilit || O.cevriliyor) return;
    const m = mod();
    if (m === 'okul') await okulSiradaki();
    else if (m === 'gunun') await paylas($('#sonraki'));
    else if (m === 'maraton' && O.durum.sonuc !== 'kurtuldu') await maratonOzeti();
    else await yeniKelime();
  }

  async function basla() {
    if (O.cevriliyor || O.sayfa !== 'ic') return;
    O.kilit = true;
    const m = O.ayar.mod;
    O.oturum = { mod: m, n: 1, hileci: null, okulTur: 0, okul: { sira: 0, puan: [0, 0], kontrol: false, kategori: null, gizli: null, anlam: null }, gunun: null };
    if (m === 'okul') await okulVer();
    else if (m === 'gunun') await gunlukBasla();
    else { const d = yeniDurum(); await sayfayaGit('oyun', () => oyunKur(d)); }
  }

  async function icindekilereDon() {
    if (O.cevriliyor || O.sayfa === 'ic') return;
    O.jeton++;
    O.kilit = true;
    await sayfayaGit('ic', async () => { olcu(); icCiz(false); });
    O.kilit = false;
  }

  /* ---------- girdi ---------- */

  function klavye(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const yaziAlani = e.target && e.target.matches && e.target.matches('input, textarea');
    if (O.sayfa === 'oyun') {
      if (e.key === 'Escape') { icindekilereDon(); return; }
      const d = O.durum;
      if (d && d.bitti && !O.kilit && (e.key === 'Enter' || e.key === ' ') && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); sonrakiTik(); return; }
      const h = tr.tusHarf(e.key);
      if (h) { e.preventDefault(); tahminEt(h); }
    } else if (O.sayfa === 'kart') {
      if (e.key === 'Escape' && !yaziAlani) icindekilereDon();
    } else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) {
      basla();
    }
  }

  function baglan() {
    $('#s-ic').addEventListener('click', (e) => { if (e.target.closest('#basla')) basla(); else icTik(e); });
    $('#alfabe').addEventListener('click', (e) => { const b = e.target.closest('.harf-tus'); if (b && !b.disabled) tahminEt(b.dataset.harf); });
    // fareyle üstüne gelince düğmenin çerçevesi ikinci kez, kalemle geçilir (dokunmada yok)
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest && e.target.closest('.dugme');
      if (!b || b.disabled || (e.relatedTarget && b.contains(e.relatedTarget))) return;
      KL.dugmeVurgu(b);
    });
    $('#sonraki').addEventListener('click', sonrakiTik);
    $('#ip-harf').addEventListener('click', ipucuHarf);
    $('#ip-anlam').addEventListener('click', ipucuAnlam);
    $('#geri').addEventListener('click', icindekilereDon);
    document.addEventListener('keydown', klavye);
    document.addEventListener('click', (e) => { if (e.target.closest('.ses-dugme')) sesDegis(); });
    // tarayıcılar ses çalmaya ilk dokunuştan sonra izin verir; askıdaki bağlam (ör. iOS kesintisi) de buradan uyanır
    for (const t of ['pointerdown', 'keydown']) document.addEventListener(t, () => { try { window.Kit.ses.baslat(); } catch (e) { /* yoksay */ } }, true);
    let zamanlayici = 0;
    window.addEventListener('resize', () => { clearTimeout(zamanlayici); zamanlayici = setTimeout(yenidenBoyutla, 150); });
  }

  // Pencere değişince kare boyu yeniden hesaplanır; SVG'ler viewBox ile ölçeklenir, düğme çerçeveleri yenilenir.
  // Düzen modu değiştiyse (telefon ↔ tablet ↔ defter) içerik sütununun eni değişir: o sayfanın çizimleri anında yeniden yapılır.
  function yenidenBoyutla() {
    const onceki = O.L && O.L.mod;
    olcu();
    const degisti = onceki !== O.L.mod;
    if (O.sayfa === 'ic') {
      if (degisti) icCiz(true);
      else { icSecimleriGuncelle(true); KL.dugmeCerceve($('#basla'), 0, true); }
    } else if (O.sayfa === 'kart') {
      if (degisti) { kartUstCiz(true); suslerCiz('kart', true); }
      K.cerceveleriCiz(true);
    } else {
      if (degisti) { oyunYenidenCiz(); suslerCiz('oyun', true); }
      const sonraki = $('#sonraki');
      if (!sonraki.hidden) { KL.dugmeCerceve(sonraki, 0, true); D.dugmeIsaretle(sonraki, true, true); }
      for (const b of [$('#ip-harf'), $('#ip-anlam')]) if (!b.hidden) KL.dugmeCerceve(b, 0, true);
    }
  }

  /* ---------- başlangıç ---------- */

  async function ac() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    KL.ayarla(C.cizim, C.renk);
    try { window.Kit.ses.kur({ anahtar: 'aa-sessiz' }); } catch (e) { /* ses yoksa oyun yine çalışır */ }
    yukle();
    const font = KL.fontBekle();
    olcu();
    icKur();
    baglan();
    await font;
    olcu();
    icCiz(false);
    sesSimgeleri(true);
    KL.fontGelince(() => { if (O.sayfa === 'ic') icCiz(true); else if (O.sayfa === 'oyun') oyunYenidenCiz(); });
    O.kilit = false;
    window.__AA = { O, tahminEt, yeniKelime, basla, ipucuHarf, ipucuAnlam, sonrakiTik };          // geliştirme: konsoldan denemek için
  }

  ac();
})();
