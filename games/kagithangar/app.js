// Kağıt Hangar — giriş: hash router + sayfa yaşam döngüsü.
// Her sayfa modülü `kur(kap, params, ctx)` dışa aktarır ve isteğe bağlı { sok(), boyut() } döndürür.
import { RENK } from './ui/renkler.js';
import { derle, esle } from './rota.js';
import { sesleriKur } from './ui/sesler.js';
import { sekmeleriKur } from './ui/sekmeler.js';

const ROTALAR = [
  { desen: '/masa',              ad: 'masa',     baslik: 'Masa',            yukle: () => import('./ui/masa.js') },
  { desen: '/katalog',           ad: 'katalog',  baslik: 'Katlama Defteri', yukle: () => import('./ui/katalog.js') },
  { desen: '/atolye/:tasarim',   ad: 'atolye',   baslik: 'Atölye',          yukle: () => import('./ui/atolye.js') },
  { desen: '/adlandir/:ucakId',  ad: 'adlandir', baslik: 'Adlandır',        yukle: () => import('./ui/adlandir.js') },
  { desen: '/uc/:ucakId',        ad: 'uc',       baslik: 'Uçuş',            yukle: () => import('./ui/uc.js'), tamEkran: true },
  { desen: '/uc/:ucakId/:sahne', ad: 'uc',       baslik: 'Uçuş',            yukle: () => import('./ui/uc.js'), tamEkran: true },
  { desen: '/hangar',            ad: 'hangar',   baslik: 'Hangar',          yukle: () => import('./ui/hangar.js') },
  { desen: '/stil',              ad: 'stil',     baslik: 'Stil rehberi',    yukle: () => import('./ui/stil.js') },
  { desen: '/yazdir/:ucakId',    ad: 'yazdir',   baslik: 'Yazdır',          yukle: () => import('./ui/yazdir.js') },
  { desen: '/notla/:ucakId',     ad: 'notla',    baslik: 'Notla gönder',    yukle: () => import('./ui/notla.js') },
  { desen: '/not/:veri',         ad: 'not',      baslik: 'Bir not geldi',   yukle: () => import('./ui/notAl.js') },
  { desen: '/pilot',             ad: 'pilot',    baslik: 'Pilot kartı',     yukle: () => import('./ui/pilot.js') },
  { desen: '/duello',            ad: 'duello',   baslik: 'Düello',          yukle: () => import('./ui/duello.js') },
  { desen: '/nasil',             ad: 'nasil',    baslik: 'Nasıl uçar?',     yukle: () => import('./ui/nasil.js') },
].map(r => Object.assign(r, derle(r.desen)));

const DAR_PX = 760;                       // bu genişliğin altında telefon düzeni
const kap = document.getElementById('sayfa');
let aktif = null;                         // { sok, boyut }
let jeton = 0;                            // sayfa değişince artar; eski asenkron işler kendini durdurur
let sekmeler = null;                      // defter sekmeleri (bir kez kurulur)
let gecis = null;                         // süren sayfa çevirme animasyonu
const SEKME_KARE = 2.6;                   // masaüstünde sağ kenardaki sekmelerin kare payı

// Sayfa ölçüsü: geniş ekranda yatay defter sayfası, telefonda genişliğe sığan dikey sayfa.
function boyutla() {
  const KL = window.Kit.kalem;
  // Yatay tutulan telefonda tam ekran uçuş geniş düzenle ölçülür (kare boyu yükseklikten de sınırlanır),
  // yoksa genişlikten hesaplanan iri kareler başlığı ve ipucunu taşırır.
  const yatayUcus = document.body.classList.contains('tam-ekran') && window.innerWidth > window.innerHeight;
  const dar = window.matchMedia(`(max-width: ${DAR_PX}px)`).matches && !yatayUcus;
  const kw = dar ? 24 : 50;
  const kh = dar ? 40 : 32;
  // masaüstünde sekmeler sağda yer kaplar, telefonda üstte bir sıra
  const sq = KL.olcuBirimi({ genislikKare: kw + (dar ? 0 : SEKME_KARE), yukseklikKare: kh + 2, min: dar ? 11 : 13, max: 24, darEkranPx: dar ? DAR_PX : 0 });
  const yukseklik = dar ? Math.max(kh, Math.floor(KL.alan().vh / sq) - 4) : kh;
  const kok = document.documentElement.style;
  kok.setProperty('--kw', kw);
  kok.setProperty('--kh', yukseklik);
  return { sq, dar, kw, kh: yukseklik };
}

// Kalem karalaması: yükleme ms'den uzun sürerse ortada kurşun kalem zikzağı (kitin karalamaBaslat'ı).
function beklemeBaslat(ms) {
  const svg = document.getElementById('bekleme');
  let acik = false;
  const zaman = setTimeout(() => {
    if (!svg || !window.Kit || !window.Kit.kalem) return;
    acik = true;
    svg.removeAttribute('hidden');
    window.Kit.kalem.karalamaBaslat(svg, { x: 10, y: 8, w: 100, h: 20 });
  }, ms);
  return {
    durdur() {
      clearTimeout(zaman);
      if (acik) { window.Kit.kalem.karalamaDurdur(svg); svg.setAttribute('hidden', ''); acik = false; }
    },
  };
}

// Sayfa çevirme: kâğıt yerinde kalır, yalnız üstündeki yazı ve çizimler solar; yeni sayfanın içeriği hafifçe aşağıdan
// belirir (CSS: #sayfa.cikiyor / .giriyor, yalnız opacity ve translate; yerleşimi etkilemez, sayfanın kendi eğimlerine
// dokunmaz). Çıkış kısa tutulur ki sayfa geç gelmiş gibi görünmesin.
const azHareket = () => !(window.Kit && window.Kit.kalem && window.Kit.kalem.animasyonVar());
let girisZamani = 0;
function sayfaCikis() {
  kap.classList.add('cikiyor');
  return new Promise(r => { gecis = { cancel() { kap.classList.remove('cikiyor'); } }; setTimeout(r, 120); });
}
function sayfaGiris() {
  gecis = null;
  kap.classList.remove('cikiyor');
  kap.classList.add('giriyor');
  clearTimeout(girisZamani);
  girisZamani = setTimeout(() => kap.classList.remove('giriyor'), 400);
}

// Yeni sayfada odak başlığa (ya da sayfanın işaretlediği öğeye) taşınır; ekran okuyucuya sayfa adı bir kez söylenir.
function odakla() {
  if (document.activeElement && document.activeElement !== document.body && kap.contains(document.activeElement)) return;
  if (document.querySelector('.perde')) return;
  const h = kap.querySelector('[data-odak]') || kap.querySelector('h1.baslik');
  if (!h) return;
  if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
}
function duyur(baslik) {
  const d = document.getElementById('duyuru');
  if (d) d.textContent = `${baslik} sayfası`;
}

async function yonlendir(o = {}) {
  const j = ++jeton;
  const e = esle(ROTALAR, location.hash);
  if (!e) { location.replace('#/masa'); return; }
  try { aktif && aktif.sok && aktif.sok(); } catch (err) { console.error(err); }
  aktif = null;

  const hareketli = o.gecis !== false && !azHareket() && kap.childNodes.length > 0;
  if (gecis) { gecis.cancel(); gecis = null; }
  const cikis = hareketli ? sayfaCikis() : Promise.resolve();
  const bekleme = beklemeBaslat(250);
  let modul;
  try { [modul] = await Promise.all([e.rota.yukle(), cikis]); } catch (err) { bekleme.durdur(); console.error(err); return; }
  if (j !== jeton) { bekleme.durdur(); return; }

  document.body.dataset.sayfa = e.rota.ad;
  document.body.classList.toggle('tam-ekran', !!e.rota.tamEkran);
  document.title = `Kağıt Hangar · ${e.rota.baslik}`;
  const olcu = boyutla();
  kap.textContent = '';
  kap.className = 'sayfa';                // önceki sayfanın kapsayıcıya eklediği sınıflar (ör. uçuşta 'ucuyor') kalmasın
  window.scrollTo(0, 0);
  if (sekmeler) { sekmeler.isaretle(e.rota.ad); }

  const ctx = {
    jeton: j,
    gecerli: () => j === jeton,
    git: (hash) => { location.hash = hash; },
    olcu,
    K: window.Kit,
  };
  let kurma;
  try { kurma = modul.kur(kap, e.params, ctx); } catch (err) { kurma = Promise.reject(err); }
  if (hareketli) sayfaGiris();                 // iskelet eşzamanlı kuruldu: hemen belirsin
  else if (gecis) { gecis.cancel(); gecis = null; }
  try {
    aktif = (await kurma) || {};
  } catch (err) {
    console.error(err);
    kap.textContent = 'Bu sayfa çizilirken kalem kaydı: ' + err.message;
  }
  bekleme.durdur();
  if (j !== jeton) return;
  odakla();
  duyur(e.rota.baslik);
}

let bekleyen = 0;
function yenidenBoyutla() {
  cancelAnimationFrame(bekleyen);
  bekleyen = requestAnimationFrame(() => {
    const olcu = boyutla();
    if (sekmeler) sekmeler.boyut();
    if (aktif && aktif.boyut) { aktif.boyut(olcu); return; }
    yonlendir({ gecis: false });           // sayfa kendini uyarlamıyorsa yeniden kurulur (çevirmeden)
  });
}

async function basla() {
  if (typeof rough === 'undefined' || !window.Kit || !window.Kit.kalem) { window.Kit && window.Kit.kalem && window.Kit.kalem.kalemYok(); return; }
  const KL = window.Kit.kalem;
  KL.ayarla({ roughness: 1.1, sureMs: [180, 300] }, { mavi: RENK.mavi, kirmizi: RENK.kirmizi, kursun: RENK.kursun });
  boyutla();
  sesleriKur();
  const bekleme = beklemeBaslat(150);
  const fontVar = await KL.fontBekle();
  bekleme.durdur();
  // Font geç geldiyse sayfa bir kez gerçek el yazısıyla yeniden çizilir (yazılan bir girdi yoksa).
  if (!fontVar) KL.fontGelince(() => { const a = document.activeElement; if (!a || !a.matches('input, textarea')) { if (sekmeler) sekmeler.boyut(); yonlendir({ gecis: false }); } });
  sekmeler = sekmeleriKur(document.getElementById('defter'));
  window.addEventListener('hashchange', yonlendir);
  let sonGenislik = window.innerWidth;
  window.addEventListener('resize', () => {
    // Mobilde adres çubuğu kaydırırken yükseklik oynar; yalnız genişlik değişince yeniden çiz.
    if (window.innerWidth === sonGenislik) return;
    sonGenislik = window.innerWidth;
    yenidenBoyutla();
  });
  window.addEventListener('orientationchange', yenidenBoyutla);
  yonlendir();
}

// Klavye odağı kurşun kalemle: düğme, kart ve sekmenin çevresine elle çizilmiş kutu (fareyle tıklayınca çizilmez).
const ODAKLI = '.dugme, .kart, .sekme';
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (!t.matches || !t.matches(ODAKLI) || !t.matches(':focus-visible') || !window.Kit) return;
  window.Kit.kalem.odakCiz(t, 'kutu');
});
document.addEventListener('focusout', (e) => {
  if (e.target.matches && e.target.matches(ODAKLI) && window.Kit) window.Kit.kalem.odakSil(e.target);
});

// Hata ayıklama ve tarayıcı testleri için: etkin sayfanın nesnesi.
window.KagitHangar = { get sayfa() { return aktif; } };

basla();
