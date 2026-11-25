// ui/depo.js — localStorage, sürümlü kayıt ({ surum, veri }), try/catch + bellek yedeği.
// Safari file://'da localStorage fırlatabilir: bellek yedeği; depolama hiç yoksa oyun bellekte sürer.
// Anahtarlar (önek bh-): ayar, istatistik, gun (günün oyunu), gecmis (Serbest: son 500 cevap), duello, sessiz (kit/ses.js).
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const SURUM = 1;
  const bellek = new Map();
  const anahtar = (ad) => (BH.config.depoOnek || 'bh-') + ad;

  function oku(ad, varsayilan = null) {
    let ham = null;
    try { ham = localStorage.getItem(anahtar(ad)); } catch (e) { ham = bellek.has(ad) ? bellek.get(ad) : null; }
    if (ham == null) return varsayilan;
    try {
      const k = JSON.parse(ham);
      return k && k.surum === SURUM && 'veri' in k ? k.veri : varsayilan;
    } catch (e) { return varsayilan; }
  }

  function yaz(ad, veri) {
    const ham = JSON.stringify({ surum: SURUM, veri });
    bellek.set(ad, ham);
    try { localStorage.setItem(anahtar(ad), ham); } catch (e) { /* bellekte kalır */ }
  }

  function sil(ad) {
    bellek.delete(ad);
    try { localStorage.removeItem(anahtar(ad)); } catch (e) { /* yoksay */ }
  }

  /* ---------- ayarlar ---------- */

  const AYAR_VARSAYILAN = { duzen: 'q', zor: false, tusSesi: true, digerSes: true, renkliPaylasim: false, azHareket: false,
    duelloSeviye: 'orta', duelloUzunluk: 3 };
  function ayar() {
    const a = Object.assign({}, AYAR_VARSAYILAN, oku('ayar', {}) || {});
    if (!['q', 'f', 'abc'].includes(a.duzen)) a.duzen = 'q';
    if (!['kolay', 'orta', 'zor'].includes(a.duelloSeviye)) a.duelloSeviye = 'orta';
    if (![3, 5].includes(a.duelloUzunluk)) a.duelloUzunluk = 3;
    return a;
  }
  const ayarYaz = (degisen) => { const a = Object.assign(ayar(), degisen); yaz('ayar', a); return a; };

  /* ---------- istatistik ve seri (yalnız günün kelimesi) ---------- */

  const IST_VARSAYILAN = { oynanan: 0, kazanilan: 0, seri: 0, enIyiSeri: 0, dagilim: [0, 0, 0, 0, 0, 0], sonGun: null, sonKazanilan: null };
  const istatistik = () => Object.assign({}, IST_VARSAYILAN, oku('istatistik', {}) || {});

  // Bir günün oyunu bitince bir kez çağrılır. Seri: ardışık günlerde kazanılan günün kelimesi.
  function istatistikEkle(tarih, kazandi, tahminSayisi, dunTarih) {
    const s = istatistik();
    if (s.sonGun === tarih) return s;                                  // aynı gün iki kez sayılmaz
    s.oynanan++;
    if (kazandi) {
      s.kazanilan++;
      s.dagilim[tahminSayisi - 1]++;
      s.seri = s.sonKazanilan === dunTarih ? s.seri + 1 : 1;
      s.enIyiSeri = Math.max(s.enIyiSeri, s.seri);
      s.sonKazanilan = tarih;
    } else s.seri = 0;
    s.sonGun = tarih;
    yaz('istatistik', s);
    return s;
  }

  // Gün atlandıysa gösterilen seri 0'dır (kayıttaki seri ancak dün ya da bugün kazanıldıysa geçerli)
  function guncelSeri(s, bugun, dun) {
    return s.sonKazanilan === bugun || s.sonKazanilan === dun ? s.seri : 0;
  }

  BH.depo = { oku, yaz, sil, ayar, ayarYaz, AYAR_VARSAYILAN, istatistik, istatistikEkle, guncelSeri };
})();
