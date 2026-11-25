// game.js — saf oyun mantığı. DOM'a dokunmaz; tarayıcıda AA.game, node'da module.exports.
//
// durum = {
//   mod: 'tek' | 'okul' | 'hileci' | 'gunun' | 'maraton',  zorluk: 'kolay' | 'orta' | 'zor',  kategori,
//   hedef:    'KİTAP' | null          // Hileci'de oyun bitene kadar null (bkz. hedefYaz)
//   gosterim: 'KİTAP'                 // çizgilerin çizileceği metin; atasözünde boşluklu
//   maske:    ['K', null, 'T', null, null]   // açılan harfler; boşluk baştan ' ' ile açık
//   denenen:  ['K', 'T', 'E'], yanlis: ['E'],
//   hak: 7, kalan: 6,                 // kalan = hak − yanlış − ipucu maliyeti
//   ipucu: { harf: 0, anlam: false },
//   bitti, sonuc: null | 'kurtuldu' | 'asildi',
//   son: null | { harf, dogru, konumlar, ipucu }   // son işlemin özeti (çizim için)
// }
// Durum DEĞİŞMEZDİR: her işlem yeni nesne döndürür, eskisine dokunmaz.
(function () {
  'use strict';

  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('./tr.js') : window.AA.tr;
  const C = node ? require('./config.js') : window.AA.config;

  const G = {};
  // Darağacı ve adamın 10 parçası, çizim sırasıyla.
  G.PARCALAR = ['taban', 'direk', 'kiris', 'ip', 'kafa', 'govde', 'solKol', 'sagKol', 'solBacak', 'sagBacak'];
  G.ZORLUKLAR = ['kolay', 'orta', 'zor'];
  G.MODLAR = ['tek', 'okul', 'hileci', 'gunun', 'maraton'];

  const kopya = (d, ek) => ({ ...d, maske: d.maske.slice(), denenen: d.denenen.slice(), yanlis: d.yanlis.slice(), ipucu: { ...d.ipucu }, ...ek });
  const harfSayisi = (d) => d.maske.filter((c) => c !== ' ').length;
  const aciklar = (d) => d.maske.filter((c) => c !== null && c !== ' ').length;

  /* ---------- kurulum ---------- */

  // kelime: oynanacak kelime ya da atasözü. Verilmezse (Hileci) uzunluk zorunludur ve hedef bilinmez.
  // hak verilirse zorluğun hakkını ezer (günün kelimesi: 10).
  G.yeniOyun = function ({ kelime, uzunluk, zorluk = 'orta', mod = 'tek', kategori = 'Genel', hak } = {}) {
    if (!G.ZORLUKLAR.includes(zorluk)) throw new RangeError('Zorluk kolay, orta ya da zor olmalı: ' + zorluk);
    if (!G.MODLAR.includes(mod)) throw new RangeError('Bilinmeyen mod: ' + mod);
    const hakSayisi = hak ?? C.hak[zorluk];
    if (!Number.isInteger(hakSayisi) || hakSayisi < 2 || hakSayisi > 10) throw new RangeError('Çizgi hakkı 2–10 olmalı: ' + hakSayisi);

    let hedef = null, gosterim = null, maske;
    if (kelime != null) {
      gosterim = tr.normalize(kelime);
      const gecerli = gosterim.includes(' ') ? tr.gecerliSoz(gosterim) : tr.gecerliKelime(gosterim);   // tek sözcük 3–14 harf; boşluklu söz atasözü
      if (!gecerli) throw new RangeError('Geçersiz kelime ya da söz: ' + kelime);
      hedef = gosterim;
      maske = Array.from(gosterim).map((c) => (c === ' ' ? ' ' : null));
    } else {
      if (!Number.isInteger(uzunluk) || uzunluk < 3 || uzunluk > 14) throw new RangeError('Kelime verilmediyse uzunluk 3–14 olmalı');
      maske = Array(uzunluk).fill(null);
    }
    return {
      mod, zorluk, kategori, hedef, gosterim, maske,
      denenen: [], yanlis: [], hak: hakSayisi, kalan: hakSayisi,
      ipucu: { harf: 0, anlam: false }, bitti: false, sonuc: null, son: null,
    };
  };

  /* ---------- çizgi hakkı ve darağacı ---------- */

  G.hazirParca = (d) => 10 - d.hak;                        // oyun açılırken çizili gelen parça (0 · 3 · 4)
  G.cizilenParca = (d) => 10 - d.kalan;                    // şu an darağacında bulunan parça
  G.kullanilanCizgi = (d) => d.hak - d.kalan;              // yanlış harf + ipucu: paylaşım metnindeki "3/10 çizgi"
  G.harfSayisi = harfSayisi;

  // Bitişi hesaplar: maske doluysa kurtuldu, çizgi bittiyse asıldı.
  function bitis(d) {
    if (d.maske.every((c) => c !== null)) return { ...d, bitti: true, sonuc: 'kurtuldu' };
    if (d.kalan <= 0) return { ...d, kalan: 0, bitti: true, sonuc: 'asildi' };
    return d;
  }

  function harfDogrula(d, harf) {
    if (d.bitti) throw new Error('Oyun bitti');
    const h = tr.normalize(harf);
    if (!tr.ALFABE.includes(h)) throw new RangeError('Alfabe dışı harf: ' + harf);
    if (d.denenen.includes(h)) throw new Error('Harf zaten seçildi: ' + h);
    return h;
  }

  /* ---------- tahmin ---------- */

  // konumlar: Hileci gibi hedefi bilinmeyen modlarda dışarıdan verilir ([] → yanlış). Kelime biliniyorsa hesaplanır.
  G.tahmin = function (d, harf, konumlar) {
    const h = harfDogrula(d, harf);
    let yerler = konumlar;
    if (yerler === undefined) {
      if (d.hedef === null) throw new Error('Hedef bilinmiyor: konumlar verilmeli');
      yerler = tr.konumlar(d.hedef, h);
    }
    for (const i of yerler) if (!Number.isInteger(i) || i < 0 || i >= d.maske.length || d.maske[i] !== null) throw new RangeError('Geçersiz konum: ' + i);
    const y = kopya(d);
    y.denenen.push(h);
    if (yerler.length) {
      for (const i of yerler) y.maske[i] = h;
      y.son = { harf: h, dogru: true, konumlar: yerler.slice(), ipucu: false };
    } else {
      y.yanlis.push(h);
      y.kalan -= 1;
      y.son = { harf: h, dogru: false, konumlar: [], ipucu: false };
    }
    return bitis(y);
  };

  /* ---------- ipuçları: her biri bir çizgiye mal olur; kalan hak 1 ise kapalı ---------- */

  G.ipucuAcikMi = (d) => !d.bitti && d.kalan > 1;

  // secim: Hileci'nin seçtiği { harf, konumlar }. Verilmezse hedefte olup açılmamış harflerden rastgele biri (rng: 0–1 üreteci).
  G.harfAc = function (d, rng, secim) {
    if (!G.ipucuAcikMi(d)) throw new Error('İpucu kapalı');
    let harf, konumlar;
    if (secim) {
      harf = tr.normalize(secim.harf);
      konumlar = secim.konumlar.slice();
      if (d.denenen.includes(harf) || !konumlar.length) throw new Error('Geçersiz ipucu seçimi');
    } else {
      if (d.hedef === null) throw new Error('Hedef bilinmiyor: secim verilmeli');
      const adaylar = [...new Set(Array.from(d.hedef).filter((c, i) => c !== ' ' && d.maske[i] === null))].sort();
      if (!adaylar.length) throw new Error('Açılacak harf kalmadı');
      harf = adaylar[Math.floor((rng || Math.random)() * adaylar.length)];
      konumlar = tr.konumlar(d.hedef, harf);
    }
    for (const i of konumlar) if (d.maske[i] !== null) throw new RangeError('Geçersiz konum: ' + i);
    const y = kopya(d);
    y.denenen.push(harf);                                  // aynı harf bir daha seçilemez
    for (const i of konumlar) y.maske[i] = harf;
    y.kalan -= 1;
    y.ipucu.harf += 1;
    y.son = { harf, dogru: true, konumlar, ipucu: true };
    return bitis(y);
  };

  G.anlamGoster = function (d) {
    if (!G.ipucuAcikMi(d)) throw new Error('İpucu kapalı');
    if (d.ipucu.anlam) throw new Error('Anlam zaten gösterildi');
    const y = kopya(d);
    y.kalan -= 1;
    y.ipucu.anlam = true;
    y.son = { harf: null, dogru: null, konumlar: [], ipucu: true };
    return y;
  };

  // Tanımda kelimenin kendisi ve kökü (en az 4 harf, kısa kelimede tamamı) geçiyorsa ____ olur.
  // Atasözünde yalnız 4 harf ve üstü sözcükler gizlenir ("bir", "ile" gibi bağlaçlar kalır).
  G.anlamMaskele = function (anlam, kelime) {
    const kokler = tr.normalize(kelime).split(' ').filter((w) => Array.from(w).length >= (kelime.includes(' ') ? 4 : 3)).map((w) => {
      const h = Array.from(w);
      return h.slice(0, Math.max(Math.min(h.length, 4), h.length - 2)).join('');
    });
    if (!kokler.length) return anlam;
    return anlam.replace(/\p{L}+/gu, (t) => {
      const n = tr.normalize(t);
      return kokler.some((k) => n.startsWith(k)) ? '____' : t;
    });
  };

  /* ---------- Hileci: hedef oyun bitince açıklanır ---------- */

  G.hedefYaz = function (d, kelime) {
    if (!d.bitti || d.hedef !== null) throw new Error('Hedef yalnız biten Hileci oyununa yazılır');
    const k = tr.normalize(kelime);
    const kh = Array.from(k);
    if (kh.length !== d.maske.length) throw new RangeError('Uzunluk uymuyor');
    d.maske.forEach((c, i) => { if (c !== null && c !== kh[i]) throw new RangeError('Kelime maskeye uymuyor'); });
    return { ...kopya(d), hedef: k, gosterim: k };
  };

  /* ---------- puan, seri, rozet ---------- */

  // Kurtuluşta: (taban + harf sayısı − yanlış − 2·ipucu) × (1 + 0,1·min(seri, 10)), aşağı yuvarlanır, en az 1. Kayıpta 0.
  // seri: bu kurtuluş dahil ardışık kurtarma sayısı.
  G.puanla = function (d, seri) {
    if (d.sonuc !== 'kurtuldu') return 0;
    const P = C.puan;
    const ipucu = d.ipucu.harf + (d.ipucu.anlam ? 1 : 0);
    const taban = P.taban + harfSayisi(d) - d.yanlis.length - P.ipucuMaliyeti * ipucu;
    const carpan = 1 + P.seriAdim * Math.min(Math.max(seri, 0), P.seriTavan);
    return Math.max(1, Math.floor(taban * carpan));
  };

  const gunNo = (s) => { const [y, m, g] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, g) / 86400000); };

  // Gün listesinin sonundaki ardışık gün sayısı (yyyy-mm-dd).
  G.ardisikGun = function (gunler) {
    const u = [...new Set(gunler)].sort();
    let n = u.length ? 1 : 0;
    for (let i = u.length - 1; i > 0 && gunNo(u[i]) - gunNo(u[i - 1]) === 1; i--) n++;
    return n;
  };

  G.ROZETLER = {
    ilkOn: 'İlk On', tekAtis: 'Tek Atış', uzunKelime: 'Uzun Kelime', atalarSozu: 'Atalar Sözü', yediGun: 'Yedi Gün',
  };

  // ist: bu oyun işlendikten SONRAKİ istatistik { kurtarma, gunler: [yyyy-mm-dd], rozetler: [kod] }. Döner: yeni kazanılanlar.
  G.rozetKontrol = function (ist, d) {
    const yeni = [];
    const var_ = new Set(ist.rozetler || []);
    const kurtuldu = d.sonuc === 'kurtuldu';
    const ekle = (kod, kosul) => { if (kosul && !var_.has(kod)) yeni.push(kod); };
    ekle('ilkOn', (ist.kurtarma || 0) >= 10);
    ekle('tekAtis', kurtuldu && d.yanlis.length === 0 && d.ipucu.harf === 0 && !d.ipucu.anlam);
    ekle('uzunKelime', kurtuldu && !String(d.hedef).includes(' ') && harfSayisi(d) >= 12);
    ekle('atalarSozu', kurtuldu && String(d.hedef).includes(' '));
    ekle('yediGun', G.ardisikGun(ist.gunler || []) >= 7);
    return yeni;
  };

  /* ---------- paylaşım ---------- */

  // "Adam Asmaca #142 · Hayvanlar · 3/10 çizgi · Kurtuldu"  (kelimeyi vermez)
  G.paylasimMetni = function ({ no, kategori, cizgi, hak, sonuc }) {
    return `Adam Asmaca #${no} · ${kategori} · ${cizgi}/${hak} çizgi · ${sonuc === 'kurtuldu' ? 'Kurtuldu' : 'Kurtulamadı'}`;
  };

  G.aciklar = aciklar;
  if (typeof window !== 'undefined') (window.AA = window.AA || {}).game = G;
  if (node) module.exports = G;
})();
