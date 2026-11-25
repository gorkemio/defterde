// ui/depo.js — localStorage, sürümlü şema; Safari file://'da localStorage fırlatabilir: bellek yedeği.
// Anahtarlar: kb-ayar, kb-oyuncu, kb-gecmis (son 500), kb-kitap, kb-mac (son 100), kb-gun-YYYY-MM-DD, kb-sessiz, kb-ogretici
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const C = KB.config;
  const SURUM = 1;
  const bellek = {};
  const ad = (k) => `${C.anahtar}-${k}`;
  function oku(k) {
    let v;
    try { const s = localStorage.getItem(ad(k)); v = s ? JSON.parse(s) : bellek[k]; } catch (e) { v = bellek[k]; }
    return v && v.surum === SURUM ? v.veri : undefined;
  }
  function yaz(k, veri) {
    const v = { surum: SURUM, veri };
    bellek[k] = v;
    try { localStorage.setItem(ad(k), JSON.stringify(v)); } catch (e) { /* yoksay */ }
  }

  const VARSAYILAN_AYAR = { macTur: C.mac.tur, seviye: C.mac.seviye, macIpucu: false, kilavuz: null, sonMod: 'mac' };
  function ayar() { return Object.assign({}, VARSAYILAN_AYAR, oku('ayar') || {}); }
  function ayarYaz(a) { yaz('ayar', a); }
  // Kılavuz izleri: kullanıcı seçmediyse seviye Kolay'ken açık
  const kilavuz = (a) => (a.kilavuz === null || a.kilavuz === undefined ? a.seviye === 'kolay' : a.kilavuz);

  function oyuncu() { return Object.assign({ puan: KB.rating.BASLANGIC, oynanan: 0, seri: 0, enIyiSeri: 0 }, oku('oyuncu') || {}); }
  function oyuncuYaz(o) { yaz('oyuncu', o); }

  function gecmis() { return oku('gecmis') || []; }
  function gecmisEkle(kayit) {
    const g = gecmis();
    g.push(kayit);
    while (g.length > C.gecmis) g.shift();
    yaz('gecmis', g);
  }
  const gecmisKume = () => new Set(gecmis().map(x => x.kimlik));

  function kitap() { return oku('kitap') || { cozulen: [] }; }
  function kitapCozuldu(kimlik) { const k = kitap(); if (!k.cozulen.includes(kimlik)) { k.cozulen.push(kimlik); yaz('kitap', k); } }

  function maclar() { return oku('mac') || []; }
  function macEkle(m) { const l = maclar(); l.push(m); while (l.length > 100) l.shift(); yaz('mac', l); }

  const gun = (tarih) => oku('gun-' + tarih);
  const gunYaz = (tarih, v) => yaz('gun-' + tarih, v);

  const ogretici = () => !!oku('ogretici');
  const ogreticiBitti = () => yaz('ogretici', true);

  KB.depo = { SURUM, oku, yaz, ayar, ayarYaz, kilavuz, oyuncu, oyuncuYaz, gecmis, gecmisEkle, gecmisKume, kitap, kitapCozuldu, maclar, macEkle, gun, gunYaz, ogretici, ogreticiBitti };
})();
