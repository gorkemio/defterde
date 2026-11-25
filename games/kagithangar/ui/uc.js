// #/uc/:ucakId/:sahne — 2D yan görünüm uçuş. Tam ekran canvas + HTML üst katman.
// Fırlatma: fareyle geri çek ve bırak (Shift basılıyken ince ayar); dokunmada parmağı ileri savur;
// klavyede ↑/↓ açı, ←/→ güç (Shift ile ince), boşluk ya da Enter at.
// Nişan: tükenmez kalemle açı kadranı, güç yayı, "35° · 7 m/s" ve ilk ~0,35 s'nin kurşun kalem tahmini (tam yörünge yok).
// Uçuş bırakılır bırakılmaz motorda hesaplanır (≈0,5 ms), sonra oynatılır: oynatma zamanı kare süresiyle ilerler
// (sekme arkadayken sıçramaz, pencere kaçışında ağır çekim). Akıcılık: uçak sprite önbelleği, önceden
// bulanıklaştırılmış gölge, karolar ve sprite'lar boş kare süresinde önceden çizilir; karede ctx.filter yok.
import { RENK } from './renkler.js';
import { not, el, dugme, cerceveleriCiz, ust } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { ucakModeli } from './ucakCiz.js';
import { ucakOnbellegi } from './ucakCanvas.js';
import { sahneKur } from './sahne.js';
import { elKur, kavrama } from './el.js';
import { fisGoster, OLAYLAR } from './fis.js';
import { ugultu } from './sesler.js';
import { kamera, KAMERALAR } from '../engine/poz.js';
import { parametreler, simule, atis } from '../engine/physics.js';
import * as A from '../engine/atis.js';
import * as K from '../engine/kamera2d.js';
import { sahneHazirla, SAHNELER, SAHNE_IDLERI, gununUcusu } from '../engine/sahneler.js';
import { depo } from '../depo.js';
import { pilotKarti, rozetFarki, ucusIsle, sahneRekoru, sahneRekorlari } from '../engine/pilot.js';
import { kartAc } from './kart.js';
import { atisEkle, siradaki, turNo, skor } from '../engine/duello.js';
import { duelloOku, duelloYaz } from './duelloDurum.js';

const KAM = kamera(...KAMERALAR.SAHNE);
const BUYUTME = 2.0;                             // uçak sahnede okunur olsun diye biraz büyük çizilir
const DER = Math.PI / 180;
const { mavi: MAVI, kursun: KURSUN, kirmizi: KIRMIZI } = RENK;
const IZ_SURE = 1.2;                             // kurşun kalem izinin uzunluğu (s)
const KARE_BUTCE = 9;                            // ms: karede bundan az harcandıysa kalan süre ön ısıtmaya

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const D = depo();
  let ucak = D.ucak(params.ucakId);
  let veri = null;
  if (ucak) { try { veri = await tasarimYukle(ucak.tasarim); } catch (e) { veri = null; } }
  if (!ctx.gecerli()) return {};
  if (!ucak || !veri || ucak.emekli) {
    document.body.classList.remove('tam-ekran');
    ust(kap, ucak && ucak.emekli ? 'Emekli uçak' : 'Uçak bulunamadı', { geri: { hash: '#/hangar', yazi: 'hangar' } });
    not(kap, ucak && ucak.emekli ? 'Bu uçak emekli; müze duvarında rekorlarıyla duruyor, artık uçmuyor.' : 'Bu uçak hangarda yok.');
    requestAnimationFrame(() => cerceveleriCiz(kap));
    return {};
  }
  const { tasarim, katlama } = veri;
  // sahne: #/uc/:id/:sahne; "gunun" = tarih tohumlu günün uçuşu
  // Mekân sayfa içinde değişebilir (sahneDegistir): rota yeniden kurulmaz, nişan açısı korunur.
  let gunun = null, sahneId = 'sinif', SAHNE = null, X0 = 0, Y0 = 0;
  function sahneAyarla(secim) {
    gunun = secim === 'gunun' ? gununUcusu() : null;
    sahneId = gunun ? gunun.sahne : (SAHNE_IDLERI.includes(secim) ? secim : 'sinif');
    SAHNE = gunun ? sahneHazirla(sahneId, { ruzgar: gunun.ruzgar, tohum: gunun.tohum }) : sahneHazirla(sahneId);
    [X0, Y0] = SAHNE.el;
  }
  sahneAyarla(params.sahne);
  if (!gunun) D.ayarGuncelle({ sonSahne: sahneId });     // her "Uçur" son uçulan mekâna döner
  let P = parametreler(tasarim, ucak);
  let model = ucakModeli(katlama, { kalite: ucak.kalite, ayar: ucak.ayar });
  const fpsGoster = /[?&]fps\b/.test(location.search) || /fps/.test(location.hash.split('?')[1] || '');

  /* ---------- DOM ---------- */
  // iki tuval: arkada kalem dünyası (karoların çözünürlüğünde, kamera durunca hiç çizilmez), önde uçak/el/kadran
  const arkaTuval = el('canvas', { sinif: 'sahne-tuval arka', 'aria-hidden': 'true' }, kap);
  const tuval = el('canvas', { sinif: 'sahne-tuval', role: 'img', 'data-odak': true }, kap);   // sayfaya gelince odak tuvale
  // başlık: öbür sayfalarla aynı düzen; solda uçağın adı, sağda mekân seçici, adlandır ve "← hangar"
  const ustSerit = el('div', { sinif: 'uc-ust' }, kap);
  const baslikSatir = ust(ustSerit, ucak.ad || 'İsimsiz', { geri: { hash: '#/hangar', yazi: 'hangar' } });
  const arac = el('div', { sinif: 'uc-arac' });
  baslikSatir.insertBefore(arac, baslikSatir.lastChild);
  const mekanD = dugme(arac, { id: 'uc-mekan', yazi: 'Mekân ▾', sinif: 'kucuk uc-mekan', tik: () => mekanSec() });
  mekanD.setAttribute('aria-haspopup', 'dialog');
  dugme(arac, { id: 'uc-boya', yazi: 'Adlandır ve boya', href: `#/adlandir/${ucak.id}`, sinif: 'kucuk' });
  const bilgiP = el('p', { sinif: 'uc-bilgi' }, kap);
  // süren düello: bu sahne ve sırası gelen oyuncunun uçağıysa atış düelloya yazılır
  let duello = duelloOku();
  const duelloAktif = () => duello && !duello.bitti && duello.sahne === sahneId && !gunun && siradaki(duello).ucakId === ucak.id;
  const duelloYazisi = () => `Düello · ${siradaki(duello).ad} atıyor · ${turNo(duello)}/${duello.tur}. atış`;
  const secim = () => (gunun ? 'gunun' : sahneId);
  const secimAdi = (id) => (id === 'gunun' ? 'Günün uçuşu' : SAHNELER[id].ad);
  function seritGuncelle() {
    KL.harfle(mekanD.querySelector('.yazi'), `Mekân: ${secimAdi(secim())} ▾`, { anlik: true });
    mekanD.hidden = !!duelloAktif();                        // düello mekânında atılır; seçici kapalı
    requestAnimationFrame(() => KL.dugmeCerceve(mekanD, 0, true));
  }
  // Mekân seçici: küçük bir kart; her mekânın tarifi ve bu uçağın oradaki en iyisi.
  function mekanSec() {
    if (asama === 'savur' || asama === 'ucus' || yanEl) return;
    const rekorlar = Object.fromEntries(sahneRekorlari(ucak).map(r => [r.sahne, r]));
    const g = gununUcusu();
    const k = kartAc({ etiket: 'Mekân seç', sinif: 'mekan-karti', saydam: true, donus: mekanD });
    k.doldur((kart) => {
      KL.harfle(el('h2', { sinif: 'bolum' }, kart), 'Mekân seç', { anlik: true });
      const liste = el('div', { sinif: 'mekan-listesi' }, kart);
      for (const id of [...SAHNE_IDLERI, 'gunun']) {
        const satir = el('div', { sinif: 'mekan-satiri' }, liste);
        dugme(satir, { id: 'mekan-' + id, yazi: secimAdi(id), onem: id === secim() ? 'birincil' : 'ikincil', sinif: 'kucuk',
          tik: () => { k.kapat('secim'); sahneDegistir(id); } });
        const r = rekorlar[id];
        const yazi = id === 'gunun' ? `${SAHNELER[g.sahne].ad}, hedef ${g.hedef} m.`
          : `${SAHNELER[id].aciklama}${r && r.enUzak ? ` En iyin ${String(Math.round(r.enUzak * 10) / 10).replace('.', ',')} m.` : ''}`;
        KL.harfle(el('p', { sinif: 'not' }, satir), yazi, { anlik: true });
      }
      const nav = el('nav', { sinif: 'dugmeler' }, kart);
      dugme(nav, { id: 'mekan-kapat', yazi: 'Kapat', onem: 'ucuncul', tik: () => k.kapat('kapat') });
    }, '#mekan-' + secim());
  }
  function bilgiGuncelle() {
    const R = SAHNE.ruzgarAyari;
    const ruzgarYazi = R ? ` · rüzgâr ${R.ort >= 0 ? 'arkadan' : 'karşıdan'} ${Math.abs(R.ort).toFixed(1).replace('.', ',')} m/s` : '';
    const gunYazi = gunun ? `Günün uçuşu (${gunun.gun}): ${SAHNELER[sahneId].ad.toLowerCase()}, hedef ${gunun.hedef} m${ruzgarYazi}` : `${SAHNELER[sahneId].ad}: ${SAHNELER[sahneId].aciklama}${ruzgarYazi}`;
    KL.harfle(bilgiP, duelloAktif() ? duelloYazisi() : gunYazi, { anlik: true });
    tuval.setAttribute('aria-label', `${SAHNELER[sahneId].ad}. ${ucak.ad || tasarim.ad} fırlatılmayı bekliyor.`);
  }
  seritGuncelle();
  bilgiGuncelle();
  const ipucu = el('p', { sinif: 'uc-ipucu' }, kap);
  const dokunmatik = window.matchMedia('(pointer: coarse)').matches;
  const ipucuYazisi = dokunmatik ? 'Parmağını uçaktan ileri doğru savur.'
    : 'Uçağı fareyle geri çek, bırak; Shift basılıyken ince ayar. Klavye: ↑↓ açı, ←→ güç, boşluk at.';
  KL.harfle(ipucu, ipucuYazisi, { anlik: true });
  const canli = el('p', { sinif: 'gizli', 'aria-live': 'polite' }, kap);
  // uçuş sırasında mesafe: kâğıt zeminli el yazısı (her karede değil, değişince ve en çok 10 kez/sn yazılır)
  const sayacP = el('p', { sinif: 'uc-sayac', 'aria-hidden': 'true', hidden: true }, kap);
  let sayacYazi = '', sayacZaman = 0;
  const azHareket = !KL.animasyonVar();                  // azaltılmış hareket: sarsıntı, ağır çekim, kıpırdayan kurdele yok
  let kocGoster = !(D.ayarlar().ipuclari || {}).atis;    // ilk atışa kadar hayalet el "geri çek, bırak" gösterir
  requestAnimationFrame(() => cerceveleriCiz(ustSerit));

  /* ---------- dikey tutulan telefon/tablet: "yan çevir" ---------- */
  // Sınıf yatay bir dünya: dikey ekranda dar bir dilim görünür. Önce cihazı çevirmeyi öner; tarayıcı izin
  // veriyorsa (Android) tam ekran + yatay kilit tek dokunuşla; vazgeçen dikey devam eder (oturum boyunca).
  const dikeyMq = window.matchMedia('(orientation: portrait)');
  let dikeyDevam = false, yanEl = null, kilitBizde = false;
  try { dikeyDevam = sessionStorage.getItem('kh-dikey') === '1'; } catch (e) { /* yoksay */ }
  function yanCevirGuncelle() {
    const gerek = dokunmatik && dikeyMq.matches && !dikeyDevam;
    if (gerek && !yanEl) yanEl = yanCevirKur();
    if (!gerek && yanEl) { yanEl.remove(); yanEl = null; tuval.focus({ preventScroll: true }); }
  }
  function yanCevirKur() {
    const d = el('div', { sinif: 'yan-cevir', role: 'dialog', 'aria-label': 'Cihazı yan çevir' }, kap);
    const svg = KL.svgEl('svg', { viewBox: '-64 -56 128 112', 'aria-hidden': 'true' }, d);
    const K = KL.kalemYap(svg);
    const an = (x) => ['yan-cevir', x];
    const tel = KL.svgEl('g', { class: 'telefon' }, svg);
    K.dikdortgen(tel, [-21, -40, 42, 80], { strokeWidth: 2.2 }, an('govde'), { anlik: true });
    K.dikdortgen(tel, [-16, -32, 32, 60], { strokeWidth: 1 }, an('ekran'), { anlik: true });
    K.daire(tel, [0, 34, 5], { strokeWidth: 1.2 }, an('tus'), { anlik: true });
    K.cizgi(tel, [-9, 4, 9, -2], { strokeWidth: 1.4 }, an('ucak1'), { anlik: true });   // ekranda minik uçak
    K.cizgi(tel, [9, -2, -5, -6], { strokeWidth: 1.4 }, an('ucak2'), { anlik: true });
    const ok = KL.svgEl('g', { class: 'ok' }, svg);
    K.egri(ok, [[32, -28], [46, -4], [36, 24]], { strokeWidth: 1.6 }, an('ok'), { anlik: true });
    K.cizgi(ok, [36, 24, 44, 19], { strokeWidth: 1.6 }, an('ok-u1'), { anlik: true });
    K.cizgi(ok, [36, 24, 34, 15], { strokeWidth: 1.6 }, an('ok-u2'), { anlik: true });
    const p = el('p', {}, d);
    KL.harfle(p, 'Telefonu yan çevir: sınıf boydan boya görünsün.', { anlik: true });
    const nav = el('nav', { sinif: 'dugmeler' }, d);
    const kilitlenebilir = document.documentElement.requestFullscreen && screen.orientation && typeof screen.orientation.lock === 'function';
    if (kilitlenebilir) {
      dugme(nav, { id: 'yan-tam', yazi: 'Tam ekran, yatay', tik: async () => {
        try {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          await screen.orientation.lock('landscape');
          kilitBizde = true;
        } catch (e) {
          KL.harfle(p, 'Bu tarayıcı ekranı kendisi çeviremiyor; telefonu elle yan çevir.', { anlik: true });
        }
      } });
    }
    dugme(nav, { id: 'yan-devam', yazi: 'Dikey devam et', sinif: 'kucuk', tik: () => {
      dikeyDevam = true;
      try { sessionStorage.setItem('kh-dikey', '1'); } catch (e) { /* yoksay */ }
      yanCevirGuncelle();
    } });
    requestAnimationFrame(() => { cerceveleriCiz(d); const ilk = d.querySelector('.dugme'); if (ilk) ilk.focus({ preventScroll: true }); });
    return d;
  }
  dikeyMq.addEventListener('change', yanCevirGuncelle);
  yanCevirGuncelle();

  /* ---------- sahne ve önbellekler ---------- */
  const c2 = tuval.getContext('2d');
  const a2 = arkaTuval.getContext('2d', { alpha: false });
  let arkaDpr = 1, arkaAnahtar = '';
  let W = 0, H = 0, dpr = 1, sahne = null, elCizim = null, sprite = null, golgeResmi = null, kadran = null;
  let zEnAz = 1, sq = 19;
  const olcek = () => sahne.ppm * 0.21 * BUYUTME;

  function boyutlandir() {
    W = kap.clientWidth; H = kap.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, dokunmatik ? 1.5 : 2);
    tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr);
    arkaDpr = Math.min(dpr, 1.25);
    arkaTuval.width = Math.round(W * arkaDpr); arkaTuval.height = Math.round(H * arkaDpr);
    arkaAnahtar = '';
    sahne = sahneKur(W, H, SAHNE);
    elCizim = elKur(sahne.ppm);
    zEnAz = Math.max(0.78, Math.min(1, sahne.gorunurY / sahne.dunyaY));   // dünya ekrandan alçaksa uzaklaşma yok
    sprite = ucakOnbellegi(model, ucak, { kam: KAM, olcek: olcek(), son: katlama.son, dpr });
    ibreler.clear();
    golgeResmi = golgeYap();
    kadran = kadranYap();
    sq = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 19;
    if (asama === 'nisan') { z = 1; kamX = sahne.sinir(X0 - 0.22 * gorW()); kamY = sahne.sinirY(Y0 - 0.55 * gorH()); }
    else { kamX = sahne.sinir(kamX, gorW()); kamY = sahne.sinirY(kamY, gorH()); }   // uçuş ortasında kamera kalır
    onizlemeAnahtar = '';
  }

  // Yerdeki yumuşak gölge: bir kez bulanıklaştırılmış elips, her karede ölçeklenip çizilir.
  function golgeYap() {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 48;
    const x = c.getContext('2d');
    x.filter = 'blur(7px)';
    x.fillStyle = 'rgb(40, 30, 15)';
    x.beginPath(); x.ellipse(80, 24, 58, 10, 0, 0, Math.PI * 2); x.fill();
    return c;
  }

  // Nişan kadranı: tükenmez kalemle −20°..80° yay, 10°'de bir çentik; bir kez çizilir.
  function kadranYap() {
    const r = sahne.ppm * 0.9, pay = 26, boy = Math.ceil(2 * (r + pay));
    const c = document.createElement('canvas');
    const kd = Math.min(dpr, 1.5);
    c.width = Math.ceil(boy * kd); c.height = Math.ceil(boy * kd);
    const x = c.getContext('2d');
    x.scale(kd, kd);
    const rc = rough.canvas(c);
    const m = boy / 2;
    const kalem = (ek) => ({ stroke: KURSUN, strokeWidth: 1.2, roughness: 0.8, seed: 3, ...ek });
    rc.arc(m, m, 2 * r, 2 * r, -80 * DER, 20 * DER, false, kalem());
    for (let d = -20, i = 0; d <= 80; d += 10, i++) {
      const a = -d * DER, ic = d % 30 === 0 ? r - 12 : r - 6;
      rc.line(m + Math.cos(a) * ic, m + Math.sin(a) * ic, m + Math.cos(a) * r, m + Math.sin(a) * r, kalem({ seed: 10 + i, strokeWidth: d % 30 === 0 ? 1.4 : 1 }));
    }
    x.font = `${Math.round(Math.max(11, sahne.ppm * 0.075))}px "Patrick Hand", cursive`;
    x.fillStyle = KURSUN; x.textAlign = 'center';
    for (const d of [0, 30, 60]) { const a = -d * DER; x.fillText(`${d}°`, m + Math.cos(a) * (r + 15), m + Math.sin(a) * (r + 15) + 4); }
    return { c, r, boy };
  }

  /* ---------- durum ---------- */
  let asama = 'nisan';            // nisan → savur → ucus → fis
  let kamX = 0, kamY = 0, z = 1;
  let aci = 12, klavye = null;    // klavye: { aci, hiz } — oklarla ayarlanan atış (nişan göstergesi açık)
  let surukle = null;             // { id, tur, bas, son, gecmis }
  let nisan = null;               // { aci, cekme, hiz, tur } — sürüklerken
  let sonuc = null, savurBas = 0, savurDon = 0, tOyna = 0, fisEl = null, sonAtis = null;
  let penT = null, duvarT = null, inis = null, isitListesi = [];
  let onizlemeAnahtar = '', onizlemeNoktalari = null, inceAyar = false;
  let son = performance.now(), cerceve = 0, calisiyor = true, donuk = false;   // donuk: önizleme karesi korunur
  const kareSureleri = [];
  const gorW = () => sahne.gorunur / z, gorH = () => sahne.gorunurY / z;
  // rüzgâr kurdeleleri (dünya konumu, rüzgârla sürüklenir)
  const kurdeleler = Array.from({ length: 6 }, (_, i) => ({ x: (i * 0.71) % 1, y: 0.2 + ((i * 0.37) % 0.7), f: i * 1.7 }));

  function atisYap(hiz, derece) {
    if (asama !== 'nisan') return;
    donuk = false;
    const a = atis(hiz, derece);
    sonuc = simule(P, a, SAHNE);
    sonuc.atis = a; sonAtis = a;
    if (kocGoster) { kocGoster = false; D.ayarGuncelle({ ipuclari: { ...(D.ayarlar().ipuclari || {}), atis: true } }); }
    window.Kit.ses.cal('firlat');
    ugultu.baslat();
    penT = (sonuc.olaylar.find(e => e.tur === 'pencere') || {}).t ?? null;
    duvarT = (sonuc.olaylar.find(e => e.tur === 'duvar') || {}).t ?? null;
    inis = sonuc.olaylar.find(e => e.tur === 'indi' || e.tur === 'yereCakildi') || null;
    // gelecek karelerin sprite'ları (uçuş sırasında boş sürede, sırayla)
    isitListesi = sonuc.ornekler.filter((_, i) => i % 3 === 0).map(o => ({ t: o.t, th: o.th, ro: o.ro, ezik: duvarT != null && o.t > duvarT + 0.3 ? 1 : 0 }));
    savurDon = gucDonu();
    asama = 'savur'; savurBas = performance.now(); tOyna = 0;
    nisan = null; klavye = null; onizlemeNoktalari = null;
    ipucu.hidden = true;
    kap.classList.add('ucuyor');                        // sahne listesi ve bilgi uçağın önünü kapatmasın
  }
  const gucDonu = () => (nisan ? (nisan.tur === 'touch' ? -0.12 * nisan.cekme : -0.35 * nisan.cekme) : klavye ? -0.35 * (klavye.hiz - 3) / 9 : 0);

  /* ---------- oynatma ---------- */
  function durumAl(t) {
    const o = sonuc.ornekler, s = o[o.length - 1];
    if (penT != null && t > penT) {                       // pencereden kaçtı: süzülerek uzaklaşır
      const d = t - penT;
      return { x: s.x + d * 3, y: s.y + d * 0.4, th: s.th * 0.5, ro: 0, z: s.z, v: 3, vx: 3, vy: 0.4, saydam: Math.max(0, 1 - d * 1.2) };
    }
    return K.ornekAl(o, t);
  }

  function olaySesleri(t) {
    for (const e of sonuc.olaylar) {
      if (e.t <= t && !e.calindi) {
        e.calindi = true;
        if (e.tur === 'duvar' || e.tur === 'yanDuvar' || e.tur === 'yereCakildi') window.Kit.ses.cal('carp');
        else if (e.tur === 'indi') window.Kit.ses.cal('hisirti');
        else if (e.tur === 'pencere') window.Kit.ses.cal('kazan');
        else if (e.tur === 'tavan') window.Kit.ses.cal('cit');
        if (e.tur === 'indi' || e.tur === 'yereCakildi' || e.tur === 'pencere') ugultu.durdur();
      }
    }
  }

  /* ---------- çizim parçaları ---------- */
  function golgeCiz(x, y, ek) {
    const zy = SAHNE.zeminY(x);
    const [sx, sy] = ek(x, zy);
    const yakin = Math.max(0, 1 - Math.max(0, y - zy) / 6);   // yükseldikçe gölge küçülür ve solar
    const w = olcek() * (0.5 + 1.0 * yakin), h = 8 + 8 * yakin;
    c2.save();
    c2.globalAlpha = 0.06 + 0.26 * yakin;
    c2.drawImage(golgeResmi, sx - w / 2, sy - h / 2 - 2, w, h);
    c2.restore();
  }

  function nisanCiz(gx, gy, derece, guc01, hiz) {
    const { c, r, boy } = kadran;
    c2.drawImage(c, gx - boy / 2, gy - boy / 2, boy, boy);
    // güç yayı: kadranın dışında, güç kadar dolu
    c2.save();
    c2.lineCap = 'round';
    c2.strokeStyle = 'rgba(31, 59, 155, .18)'; c2.lineWidth = 5;
    c2.beginPath(); c2.arc(gx, gy, r + 6, -80 * DER, 20 * DER); c2.stroke();
    c2.strokeStyle = MAVI; c2.globalAlpha = 0.85;
    c2.beginPath(); c2.arc(gx, gy, r + 6, 20 * DER - 100 * DER * guc01, 20 * DER); c2.stroke();
    c2.globalAlpha = 1;
    // ibre ve ucu: tükenmez kalemle (önbellekten; derece ve boy başına bir kez çizilir)
    const ibre = ibreResmi(derece, r * (0.55 + 0.45 * guc01));
    c2.drawImage(ibre.c, gx - ibre.boy / 2, gy - ibre.boy / 2, ibre.boy, ibre.boy);
    // okuma
    c2.font = `${Math.round(Math.max(15, sahne.ppm * 0.11))}px "Patrick Hand", cursive`;
    c2.fillStyle = MAVI; c2.textAlign = 'left';
    const sayi = (v, b) => v.toFixed(b).replace('.', ',');
    c2.fillText(`${sayi(derece, 1)}° · ${sayi(hiz, 2)} m/s`, gx + r * 0.35, gy - r - 14);
    if (inceAyar) {                                          // Shift basılı: ince ayar etkin
      c2.font = `${Math.round(Math.max(12, sahne.ppm * 0.075))}px "Patrick Hand", cursive`;
      c2.fillStyle = KURSUN;
      c2.fillText('ince ayar', gx + r * 0.35, gy - r - 14 - Math.max(16, sahne.ppm * 0.11));
    }
    c2.restore();
  }

  // Kalem ibresi: 1° ve 6 px'lik kovalarda rough.js ile bir kez çizilir; uçuşta ve nişanda yalnız drawImage.
  const ibreler = new Map();
  function ibreResmi(derece, uzunluk) {
    const d = Math.round(derece), L = Math.max(18, Math.round(uzunluk / 6) * 6);
    const anahtar = d + '|' + L;
    let r = ibreler.get(anahtar);
    if (r) { ibreler.delete(anahtar); ibreler.set(anahtar, r); return r; }
    const kd = Math.min(dpr, 2), boy = Math.ceil(2 * (L + 14));
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(boy * kd);
    const x = c.getContext('2d');
    x.scale(kd, kd);
    const rc = rough.canvas(c), m = boy / 2, a = -d * DER;
    const bx = m + Math.cos(a) * L, by = m + Math.sin(a) * L;
    const kalem = (seed) => ({ stroke: MAVI, strokeWidth: 2, roughness: 0.7, bowing: 0.5, seed });
    rc.line(m + Math.cos(a) * 14, m + Math.sin(a) * 14, bx, by, kalem(21));
    rc.line(bx, by, bx - Math.cos(a - 0.45) * 11, by - Math.sin(a - 0.45) * 11, kalem(22));
    rc.line(bx, by, bx - Math.cos(a + 0.45) * 11, by - Math.sin(a + 0.45) * 11, kalem(23));
    r = { c, boy };
    ibreler.set(anahtar, r);
    if (ibreler.size > 240) ibreler.delete(ibreler.keys().next().value);
    return r;
  }

  // İlk atıştan önce hayalet el: kurşun kalem halka, uçaktan geriye (fare) ya da ileriye (dokunma) kayar; bir kez öğretir.
  function kocCiz(gx, gy, simdi) {
    const ppm = sahne.ppm;
    const u = azHareket ? 0.8 : ((simdi / 1000) % 2.6) / 2.6;
    const hx = dokunmatik ? gx + ppm * 0.9 : gx - ppm * 0.85, hy = dokunmatik ? gy - ppm * 0.45 : gy + ppm * 0.4;
    const e = Math.min(1, u / 0.65), k = 1 - (1 - e) * (1 - e);
    const px = gx + (hx - gx) * k, py = gy + (hy - gy) * k;
    const gor = azHareket ? 0.85 : Math.min(1, u / 0.08) * (u > 0.82 ? Math.max(0, (1 - u) / 0.18) : 1);
    c2.save();
    c2.globalAlpha = 0.75 * gor;
    c2.strokeStyle = KURSUN; c2.fillStyle = KURSUN; c2.lineWidth = 1.6; c2.lineCap = 'round';
    c2.setLineDash([4, 6]);
    c2.beginPath(); c2.moveTo(gx, gy); c2.lineTo(px, py); c2.stroke();
    c2.setLineDash([]);
    c2.beginPath(); c2.arc(px, py, 11, 0, Math.PI * 2); c2.stroke();
    c2.beginPath(); c2.arc(px, py, 3, 0, Math.PI * 2); c2.fill();
    c2.font = `${Math.round(Math.max(15, ppm * 0.11))}px "Patrick Hand", cursive`;
    const yazi = dokunmatik ? 'ileri doğru savur' : 'geri çek, bırak';
    const w = c2.measureText(yazi).width;
    const tx = Math.min(W / z - w / 2 - 12, Math.max(w / 2 + 12, hx));   // yazı ekranın içinde kalsın
    c2.textAlign = 'center';
    c2.fillText(yazi, tx, hy + (dokunmatik ? -22 : 34));
    c2.restore();
  }

  function onizlemeCiz(ek) {
    if (!onizlemeNoktalari) return;
    c2.save();
    c2.fillStyle = KURSUN;
    const n = onizlemeNoktalari;
    for (let i = 1; i < n.length; i++) {
      const [x, y] = ek(n[i][0], n[i][1]);
      c2.globalAlpha = 0.7 * (1 - i / n.length);
      c2.beginPath(); c2.arc(x, y, 1.8, 0, Math.PI * 2); c2.fill();
    }
    c2.restore();
  }

  function onizlemeGuncelle(hiz, derece) {
    const anahtar = hiz.toFixed(1) + '|' + derece.toFixed(1);
    if (anahtar === onizlemeAnahtar) return;
    onizlemeAnahtar = anahtar;
    onizlemeNoktalari = A.onizleme(P, atis(hiz, derece), SAHNE);
  }

  // kurşun kalem izi: son IZ_SURE saniyenin kesikli çizgisi, eskidikçe solar (dört dilimde artan koyulukla)
  function izCiz(ek) {
    const t1 = Math.min(tOyna, penT != null ? penT : Infinity), t0 = Math.max(0, t1 - IZ_SURE);
    if (t1 - t0 < 0.05) return;
    c2.save();
    c2.strokeStyle = KURSUN; c2.lineWidth = 1.6; c2.lineCap = 'round';
    c2.setLineDash([5, 7]);
    const dilim = 4, adim = 1 / 30;
    for (let d = 0; d < dilim; d++) {
      const a = t0 + (t1 - t0) * d / dilim, b = t0 + (t1 - t0) * (d + 1) / dilim;
      c2.globalAlpha = 0.15 + 0.5 * (d + 1) / dilim;
      c2.beginPath();
      for (let t = a; t <= b + 1e-9; t += adim) {
        const s = K.ornekAl(sonuc.ornekler, Math.min(t, b));
        const [x, y] = ek(s.x, s.y);
        if (t === a) c2.moveTo(x, y); else c2.lineTo(x, y);
      }
      c2.stroke();
    }
    c2.restore();
  }

  // iniş: kağıdın yerde sürtünmesi, birkaç kısa kalem çizgisi dağılır
  function tozCiz(ek) {
    if (!inis) return;
    const d = tOyna - inis.t;
    if (d < 0 || d > 0.7) return;
    const [x, y] = ek(inis.x, SAHNE.zeminY(inis.x));
    c2.save();
    c2.strokeStyle = KURSUN; c2.lineWidth = 1.2; c2.lineCap = 'round';
    c2.globalAlpha = 0.7 * (1 - d / 0.7);
    const L = 6 + 30 * d;
    c2.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + 0.25 + i * 0.32, r0 = 4 + i * 2;
      c2.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.5);
      c2.lineTo(x + Math.cos(a) * (r0 + L), y + Math.sin(a) * (r0 + L) * 0.5);
    }
    c2.stroke();
    c2.restore();
  }

  // rüzgârlı sahnede havada savrulan kısa kurşun çizgiler: rüzgârın yönünü ve gücünü gösterir
  function kurdeleCiz(ek, saniye, dt) {
    if (!SAHNE.ruzgar) return;
    const w = SAHNE.ruzgar(saniye), gw = gorW(), gh = gorH();
    c2.save();
    c2.strokeStyle = KURSUN; c2.lineWidth = 1.1; c2.lineCap = 'round';
    for (const k of kurdeleler) {
      k.x = ((k.x + (w * dt) / gw) % 1 + 1) % 1;
      const wx = kamX + k.x * gw, wy = kamY + gh * (0.25 + k.y * 0.65);
      const [x, y] = ek(wx, wy);
      const guc = Math.min(1, Math.abs(w) / 4), L = (0.22 + 0.5 * guc) * sahne.ppm;
      c2.globalAlpha = 0.3 + 0.35 * guc;
      for (const dy of [0, 5]) {                               // rüzgârın çizdiği çift kalem çizgisi
        c2.beginPath(); c2.moveTo(x, y + dy);
        for (let i = 1; i <= 6; i++) c2.lineTo(x - Math.sign(w || 1) * L * i / 6, y + dy + Math.sin(saniye * 5 + k.f + i * 0.8) * 4);
        c2.stroke();
      }
    }
    c2.restore();
  }

  function hudCiz(s) {
    const gorunur = !(asama === 'nisan' || asama === 'savur' || !sonuc || !s);
    if (!gorunur) { if (!sayacP.hidden) { sayacP.hidden = true; sayacYazi = ''; } return; }
    const bitti = asama === 'fis' || (penT != null && tOyna > penT);
    const m = bitti ? sonuc.mesafe : Math.max(0, s.x - sonuc.ornekler[0].x);
    const yazi = `${m.toFixed(1).replace('.', ',')} m`;
    const simdi = performance.now();
    if (yazi !== sayacYazi && (bitti || simdi - sayacZaman > 100)) {
      sayacYazi = yazi; sayacZaman = simdi;
      sayacP.textContent = yazi;
    }
    sayacP.classList.toggle('bitti', bitti);
    sayacP.hidden = false;
  }

  function fpsCiz() {
    if (!fpsGoster || !kareSureleri.length) return;
    const ort = kareSureleri.reduce((a, b) => a + b, 0) / kareSureleri.length;
    c2.save();
    c2.font = '12px monospace'; c2.fillStyle = KIRMIZI; c2.textAlign = 'left';
    c2.fillText(`kare ${ort.toFixed(1)} ms · en çok ${Math.max(...kareSureleri).toFixed(1)} ms · sprite ${sprite.uretilen}`, 8, H - 8);
    c2.restore();
  }

  // boş kare süresinde: önümüzdeki sprite'lar ve kameranın gideceği karolar
  function isit(kareBas) {
    if (sonuc && asama !== 'nisan') {
      const ufuk = tOyna + 0.7;
      const yakinda = isitListesi.filter(s => s.t >= tOyna && s.t <= ufuk);
      sprite.isit(yakinda, Math.max(1, KARE_BUTCE - (performance.now() - kareBas)));
      if (performance.now() - kareBas < KARE_BUTCE) {
        const ileri = durumAl(Math.min(tOyna + 0.8, sonuc.ornekler[sonuc.ornekler.length - 1].t));
        const h = K.hedef(ileri, gorW(), gorH());
        sahne.isit(sahne.sinir(h.x, gorW()), sahne.sinirY(h.y, gorH()), W / z, H / z);
      }
    } else if (performance.now() - kareBas < KARE_BUTCE) {
      sahne.isit(kamX, kamY, (W / z) * 2.4, H / z);            // atıştan önce: önündeki birkaç karo
    }
  }

  /* ---------- çizim döngüsü ---------- */
  function ciz(simdi, zorla = false) {
    if (!calisiyor) return;
    if (donuk && !zorla) { cerceve = requestAnimationFrame(ciz); return; }
    const kareBas = performance.now();
    const dt = Math.min(0.05, Math.max(0, (simdi - son) / 1000));
    son = simdi;
    let ux = X0, uy = Y0, th = aci * DER + P.aTrim, ro = 0, ezik = 0, saydam = 1, don = 0, elde = true, s = null;
    let nisanGoster = null;

    if (asama === 'nisan') {
      const derece = nisan ? nisan.aci : aci;
      th = derece * DER + P.aTrim;                              // elde de uçuştaki trim açısıyla: bırakınca zıplamaz
      don = gucDonu();
      z = K.yumusat(z, 1, dt, 3);
      kamX = K.yumusat(kamX, sahne.sinir(X0 - 0.22 * gorW(), gorW()), dt, 5);
      kamY = K.yumusat(kamY, sahne.sinirY(Y0 - 0.55 * gorH(), gorH()), dt, 5);
      if (nisan || klavye) {
        const hiz = nisan ? nisan.hiz : klavye.hiz;
        nisanGoster = { derece, guc01: (hiz - A.EN_AZ) / (A.EN_COK - A.EN_AZ), hiz };
        onizlemeGuncelle(hiz, derece);
      } else onizlemeNoktalari = null;
    } else if (asama === 'savur') {
      const u = Math.min(1, (simdi - savurBas) / 220), e = 1 - Math.pow(1 - u, 3);
      don = savurDon * (1 - e);
      th = sonuc.atis.aci * DER + P.aTrim;
      if (u >= 1) { asama = 'ucus'; tOyna = 0; }
    } else {
      tOyna += dt * (azHareket ? 1 : K.zamanOlcegi(tOyna, penT));
      s = durumAl(tOyna);
      ux = s.x; uy = s.y; th = s.th; ro = s.ro || 0; saydam = s.saydam ?? 1; elde = false;
      don = Math.min(0.25, tOyna * 2);
      if (duvarT != null && tOyna > duvarT) ezik = Math.min(1, (tOyna - duvarT) / 0.3);
      const zh = Math.max(zEnAz, K.yakinlastirma(uy - SAHNE.zeminY(ux), s.v || 0));
      z = K.yumusat(z, zh, dt, 1.5);
      const h = K.hedef(s, gorW(), gorH());
      kamX = K.yumusat(kamX, sahne.sinir(h.x, gorW()), dt, 4);
      kamY = K.yumusat(kamY, sahne.sinirY(h.y, gorH()), dt, 4);
      olaySesleri(tOyna);
      ugultu.ayarla(asama === 'ucus' ? s.v || 0 : 0);
      const T = sonuc.ornekler[sonuc.ornekler.length - 1].t;
      if (asama === 'ucus' && tOyna > (penT ?? T) + 0.9) { asama = 'fis'; ugultu.durdur(); ucusBitti(); }
    }

    // dünya (yakınlaştırılmış uzay). Arka tuval yalnız kamera kıpırdayınca yeniden çizilir.
    const [sxx, syy] = duvarT != null && asama !== 'nisan' && !azHareket ? K.sarsinti(tOyna - duvarT) : [0, 0];
    const w = W / z, h = H / z;
    const ek = (x, y) => sahne.ekran(x, y, kamX, kamY, h);
    const anahtar = `${(kamX * sahne.ppm).toFixed(1)}|${(kamY * sahne.ppm).toFixed(1)}|${z.toFixed(4)}|${sxx.toFixed(1)}|${syy.toFixed(1)}`;
    if (anahtar !== arkaAnahtar) {
      arkaAnahtar = anahtar;
      a2.setTransform(arkaDpr * z, 0, 0, arkaDpr * z, 0, 0);
      a2.translate(sxx, syy);
      sahne.ciz(a2, kamX, kamY, w, h);
    }
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.clearRect(0, 0, W, H);
    c2.setTransform(dpr * z, 0, 0, dpr * z, 0, 0);
    c2.translate(sxx, syy);
    kurdeleCiz(ek, azHareket ? 0 : simdi / 1000, azHareket ? 0 : dt);
    if (sonuc && asama !== 'nisan' && asama !== 'savur') { izCiz(ek); tozCiz(ek); }
    const [gx0, gy0] = ek(X0, Y0);
    const [gx, gy] = kavrama(gx0, gy0, sahne.ppm, don);
    const [px, py] = elde ? [gx, gy] : ek(ux, uy);
    if (nisanGoster) onizlemeCiz(ek);
    if (saydam > 0.01) {
      golgeCiz(elde ? X0 : ux, elde ? Y0 : uy, ek);
      sprite.ciz(c2, th, ro, px, py, { ezik, saydam });
    }
    elCizim.ciz(c2, gx0, gy0, don);
    if (kocGoster && asama === 'nisan' && !surukle && !klavye && !yanEl) kocCiz(gx, gy, simdi);
    if (nisanGoster) nisanCiz(gx0, gy0, nisanGoster.derece, nisanGoster.guc01, nisanGoster.hiz);
    if (penT != null && asama !== 'nisan' && tOyna > penT && SAHNE.pencere) {
      const [qx, qy] = ek(SAHNE.uzunluk - 0.3, SAHNE.pencere.y2 + 0.25);
      c2.save(); c2.translate(qx, qy); c2.rotate(-0.08);
      c2.font = `${Math.round(sahne.ppm * 0.2)}px "Patrick Hand", cursive`; c2.fillStyle = KIRMIZI; c2.textAlign = 'right';
      c2.fillText('pencereden kaçtı!', 0, 0); c2.restore();
    }

    // ekran uzayı: sayaç, ölçüm
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    hudCiz(s);
    const harcanan = performance.now() - kareBas;
    kareSureleri.push(harcanan);
    if (kareSureleri.length > 120) kareSureleri.shift();
    fpsCiz();
    if (!zorla && harcanan < KARE_BUTCE) isit(kareBas);
    if (!zorla) cerceve = requestAnimationFrame(ciz);
  }

  /* ---------- uçuş bitti: günlük, istatistik, yıpranma, fiş ---------- */
  function ucusBitti() {
    const once = ucak;
    const fisVeri = {
      tarih: new Date().toISOString(), mesafe: +sonuc.mesafe.toFixed(2), sure: +sonuc.sure.toFixed(2),
      enYuksek: +sonuc.enYuksek.toFixed(2), loop: sonuc.loop, olay: sonuc.olay, yol: sonuc.yol, sapma: +sonuc.sapma.toFixed(2),
      atis: { hiz: +sonuc.atis.hiz.toFixed(2), aci: +sonuc.atis.aci.toFixed(1) }, sahne: sahneId, gunun: gunun ? gunun.gun : null,
    };
    const onceKart = pilotKarti(D.ucaklar(), D.ayarlar());   // rozet/rütbe farkı için uçuştan önceki kart
    const isle = ucusIsle(once.istatistik, once.gunluk, {
      mesafe: fisVeri.mesafe, sure: fisVeri.sure, enYuksek: fisVeri.enYuksek, loop: sonuc.loop,
      duvar: sonuc.olaylar.filter(e => e.tur === 'duvar').length, pencere: sonuc.olay === 'pencere',
    }, sahneId);
    const { ilk, rekor } = isle;
    D.ucusEkle(once.id, fisVeri);
    ucak = D.ucakGuncelle(once.id, {
      istatistik: isle.istatistik,
      yipranma: { ...once.yipranma, kirisik: once.yipranma.kirisik + sonuc.carpma },
    }) || once;
    let gorev = null;
    if (gunun) {
      const onceki = D.ayarlar().gunun;
      const enIyi = Math.max(fisVeri.mesafe, onceki && onceki.gun === gunun.gun ? onceki.enIyi : 0);
      gorev = { hedef: gunun.hedef, basarili: fisVeri.mesafe >= gunun.hedef, enIyi };
      const ilkBasari = enIyi >= gunun.hedef && !(onceki && onceki.gun === gunun.gun && onceki.basarili);
      const ayar = D.ayarlar();
      D.ayarGuncelle({ gunun: { gun: gunun.gun, enIyi, basarili: enIyi >= gunun.hedef }, gununBasari: (ayar.gununBasari || 0) + (ilkBasari ? 1 : 0) });
    }
    const pilot = rozetFarki(onceKart, pilotKarti(D.ucaklar(), D.ayarlar()));
    if (rekor || (gorev && gorev.basarili) || pilot.yeniRozetler.length || pilot.rutbe) window.Kit.ses.cal('kazan', 300);
    let duelloBilgi = null;
    if (duelloAktif()) {
      duello = atisEkle(duello, sonuc.mesafe, sonuc.olay);
      duelloYaz(duello);
      const sk = skor(duello);
      const ozet = duello.oyuncular.map((o, i) => `${o.ad} ${String(Math.round(sk.oyuncular[i].enIyi * 10) / 10).replace('.', ',')} m`).join(' · ');
      if (duello.bitti) duelloBilgi = { satir: ozet, yazi: 'Sonuçlar →', tik: () => ctx.git('#/duello') };
      else {
        const s2 = siradaki(duello);
        duelloBilgi = { satir: ozet, yazi: `Sıra: ${s2.ad} →`, tik: () => {
          if (s2.ucakId === ucak.id) { tekrar(); KL.harfle(bilgiP, duelloYazisi(), { anlik: true }); }
          else ctx.git(`#/uc/${s2.ucakId}/${sahneId}`);
        } };
      }
    }
    canli.textContent = `${fisVeri.mesafe.toString().replace('.', ',')} metre, ${OLAYLAR[sonuc.olay]}${rekor ? '. Yeni rekor!' : ''}`
      + pilot.yeniRozetler.map(r => `. Yeni rozet: ${r.ad}`).join('') + (pilot.rutbe ? `. Rütbe: ${pilot.rutbe.sonra}` : '');
    const ayni = sonAtis ? () => { const a = A.tekrarAtisi({ atis: sonAtis }); tekrar(); atisYap(a.hiz, a.aci); } : null;
    kap.classList.remove('ucuyor');
    fisEl = fisGoster(
      { ucak, sonuc, rekor, ilk, oncekiEnIyi: isle.oncekiEnIyi, hangarRekoru: sahneRekoru(D.ucaklar(), sahneId), pilot,
        sahne: SAHNE, secim: secim(), gorev, ilkUcus: once.istatistik.ucus === 0 },
      { tekrar, ayni, hangar: () => ctx.git('#/hangar'), adlandir: () => ctx.git('#/adlandir/' + ucak.id), katla: () => ctx.git('#/katalog'),
        sahneDegistir, duello: duelloBilgi, donus: tuval });
  }

  function tekrar() {
    if (fisEl) { const f = fisEl; fisEl = null; f.kapat('tekrar'); }
    P = parametreler(tasarim, ucak);                   // yıpranma değişmiş olabilir
    sonuc = null; asama = 'nisan'; ipucu.hidden = false;
    kap.classList.remove('ucuyor');
    penT = duvarT = null; inis = null; isitListesi = [];
    KL.harfle(ipucu, ipucuYazisi, { anlik: true });
    tuval.focus({ preventScroll: true });
  }

  // Mekânı sayfa içinde değiştir: fiş kapanır, sahne ve önbellekler yeniden kurulur, açı korunur, adres güncellenir.
  function sahneDegistir(hedef) {
    if (asama === 'savur' || asama === 'ucus' || yanEl) return;
    if (asama === 'fis') tekrar();
    if (hedef === secim()) return;
    sahneAyarla(hedef);
    boyutlandir();
    seritGuncelle();
    bilgiGuncelle();
    history.replaceState(null, '', `#/uc/${ucak.id}/${secim()}`);
    if (!gunun) D.ayarGuncelle({ sonSahne: sahneId });
    if (KL.animasyonVar()) for (const t of [arkaTuval, tuval]) t.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    tuval.focus({ preventScroll: true });
  }

  // Uçak durduktan (ya da pencereden kaçtıktan) sonra dokunuş/boşluk fişi beklemeden getirir.
  function fiseAtla() {
    if (asama !== 'ucus' || !sonuc) return false;
    const T = sonuc.ornekler[sonuc.ornekler.length - 1].t;
    if (tOyna < (penT ?? T)) return false;
    asama = 'fis'; ugultu.durdur(); ucusBitti();
    return true;
  }

  /* ---------- girdi ---------- */
  const yerel = (e) => { const r = tuval.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function basildi(e) {
    if (fiseAtla()) { e.preventDefault(); return; }
    if (asama !== 'nisan' || surukle || (e.button !== undefined && e.button > 0)) return;
    e.preventDefault();
    const p = yerel(e);
    surukle = { id: e.pointerId, tur: e.pointerType, bas: p, son: p, efektif: p, gecmis: [{ p, t: performance.now() }] };
    tuval.classList.add('tutuyor');
    klavye = null;
    try { tuval.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
  }
  function nisanHesapla() {
    const ppm = sahne.ppm;
    if (surukle.tur === 'touch') {
      const n = A.dokunmaNisani(surukle.bas, surukle.son, ppm);
      if (!n) return null;
      const sav = A.dokunmaAtisi(surukle.gecmis, ppm);
      return { ...n, hiz: sav ? sav.hiz : A.EN_AZ + (A.EN_COK - A.EN_AZ) * n.cekme, tur: 'touch' };
    }
    const f = A.fareAtisi(surukle.bas, surukle.efektif, ppm);
    return f && { aci: f.aci, cekme: f.cekme, hiz: f.hiz, L: f.L, tur: surukle.tur };
  }
  function hareket(e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    const p = yerel(e), t = performance.now();
    inceAyar = !!e.shiftKey && surukle.tur !== 'touch';
    surukle.efektif = A.efektifNokta(surukle.efektif, surukle.son, p, inceAyar);   // Shift: hareketin dörtte biri
    surukle.son = p;
    surukle.gecmis.push({ p, t });
    while (surukle.gecmis.length > 2 && t - surukle.gecmis[0].t > 140) surukle.gecmis.shift();
    nisan = nisanHesapla();
  }
  function birakti(e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    const s = surukle;
    tuval.classList.remove('tutuyor');
    try { tuval.releasePointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    const n = nisan;
    if (s.tur === 'touch') {
      const a = A.dokunmaAtisi(s.gecmis, sahne.ppm);
      if (!a) { surukle = null; nisan = null; if (n) KL.harfle(ipucu, 'Biraz daha hızlı savur!', { anlik: true }); return; }
      atisYap(a.hiz, a.aci);
    } else if (n && n.L >= 12) atisYap(n.hiz, n.aci);
    surukle = null;
    nisan = null;
    inceAyar = false;
  }
  function iptal(e) { if (surukle && e.pointerId === surukle.id) { surukle = null; nisan = null; tuval.classList.remove('tutuyor'); } }
  tuval.addEventListener('pointerdown', basildi);
  tuval.addEventListener('pointermove', hareket);
  tuval.addEventListener('pointerup', birakti);
  tuval.addEventListener('pointercancel', iptal);

  const tusAsagi = (e) => {
    if (e.key === 'Shift') { inceAyar = !!surukle && surukle.tur !== 'touch'; return; }
    if ((e.key === ' ' || e.key === 'Enter') && fiseAtla()) { e.preventDefault(); return; }
    if (asama !== 'nisan' || (e.target.closest && e.target.closest('input, textarea, button, a'))) return;
    const ayar = A.klavyeAyari(klavye || { aci, hiz: A.KLAVYE.gucBaslangic }, e.key, e.shiftKey);
    if (ayar) { klavye = ayar; aci = ayar.aci; e.preventDefault(); return; }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !surukle) {
      e.preventDefault();
      const k = klavye || { aci, hiz: A.KLAVYE.gucBaslangic };     // oklarla ayar yoksa son açı, orta güç
      atisYap(k.hiz, k.aci);
    }
  };
  const tusYukari = (e) => { if (e.key === 'Shift') inceAyar = false; };
  document.addEventListener('keydown', tusAsagi);
  document.addEventListener('keyup', tusYukari);
  tuval.tabIndex = 0;

  boyutlandir();
  cerceve = requestAnimationFrame(ciz);
  return {
    sok() {
      calisiyor = false;
      cancelAnimationFrame(cerceve);
      if (fisEl) { const f = fisEl; fisEl = null; f.kapat('rota'); }
      ugultu.durdur();
      dikeyMq.removeEventListener('change', yanCevirGuncelle);
      kap.classList.remove('ucuyor');
      if (kilitBizde) {                                   // başka sayfalar dikey de kullanılabilsin
        try { screen.orientation.unlock(); } catch (e) { /* yoksay */ }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
      document.removeEventListener('keydown', tusAsagi);
      document.removeEventListener('keyup', tusYukari);
    },
    boyut() { boyutlandir(); cerceveleriCiz(ustSerit, true); },
    get durum() {
      const ort = kareSureleri.length ? kareSureleri.reduce((a, b) => a + b, 0) / kareSureleri.length : 0;
      return {
        asama, aci, z, sonuc: sonuc && { mesafe: sonuc.mesafe, olay: sonuc.olay, loop: sonuc.loop, sure: sonuc.sure }, ucak,
        kare: { ortMs: ort, enCokMs: kareSureleri.length ? Math.max(...kareSureleri) : 0, sprite: sprite.uretilen },
      };
    },
    atisYap,
    // Hata ayıklama/önizleme: uçuşun t. saniyesini hemen çiz (arka planda rAF yavaşlasa da).
    kareAt(t) {
      if (!sonuc) return;
      donuk = true; asama = 'ucus'; tOyna = t;
      const s = durumAl(t);
      z = Math.max(zEnAz, K.yakinlastirma(s.y - SAHNE.zeminY(s.x), s.v || 0));
      const h = K.hedef(s, gorW(), gorH());
      kamX = sahne.sinir(h.x, gorW()); kamY = sahne.sinirY(h.y, gorH());
      son = performance.now(); ciz(performance.now(), true);
    },
    coz() { donuk = false; },
  };
}
