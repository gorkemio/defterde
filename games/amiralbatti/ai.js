// ai.js — bilgisayar rakibin atış seçimi. Saf fonksiyonlar: DOM yok, game.js'e bağımlı değil.
// Rakibin tahtasının "görünümünü" alır (game.js gorunum()):
//   { n, hucre: ['?' | 'o' | 'x' | '#', ...n*n], kalanUzunluklar: [batmamış gemi uzunlukları] }
// Hiçbir durum tutmaz: her karar yalnız görünümden türer.
//
// Av / hedef:
//   hedef: vurulmuş ama batmamış hücre ('x') varsa onun çevresini ara
//          (iki isabet aynı hizadaysa o doğrultuda devam)
//   av:    isabet yokken rastgele; parite açıksa satranç deseni
(function () {
  'use strict';

  const AI = {};
  const icinde = (n, s, k) => s >= 0 && k >= 0 && s < n && k < n;

  // Batmamış gemilerden biri bu '?' hücreden geçerek yalnız '?' hücrelere sığar mı?
  AI.sigar = function (v, s, k) {
    const n = v.n;
    for (const uzunluk of new Set(v.kalanUzunluklar)) {
      for (const yatay of [true, false]) {
        for (let bas = 0; bas < uzunluk; bas++) {           // hücre geminin kaçıncı parçası
          let tamam = true;
          for (let i = 0; i < uzunluk && tamam; i++) {
            const d = i - bas;
            const ss = yatay ? s : s + d, kk = yatay ? k + d : k;
            if (!icinde(n, ss, kk) || v.hucre[ss * n + kk] !== '?') tamam = false;
          }
          if (tamam) return true;
        }
      }
    }
    return false;
  };

  // Hedef modu adayları. Boşsa av moduna geçilir.
  AI.hedefAdaylari = function (v) {
    const n = v.n, xs = [];
    for (let i = 0; i < v.hucre.length; i++) {
      if (v.hucre[i] === 'x') xs.push({ s: Math.floor(i / n), k: i % n });
    }
    if (!xs.length) return [];

    // İki ya da daha fazla isabet aynı hizadaysa gemi o doğrultudadır.
    if (xs.length >= 2) {
      const ayniSatir = xs.every(h => h.s === xs[0].s);
      const ayniSutun = xs.every(h => h.k === xs[0].k);
      if (ayniSatir || ayniSutun) {
        const degerler = xs.map(h => (ayniSatir ? h.k : h.s));
        const en = Math.min(...degerler), fazla = Math.max(...degerler);
        const hucre = (d) => (ayniSatir ? { s: xs[0].s, k: d } : { s: d, k: xs[0].k });
        const bos = (h) => icinde(n, h.s, h.k) && v.hucre[h.s * n + h.k] === '?';
        let aday = [];
        for (let d = en + 1; d < fazla; d++) if (bos(hucre(d))) aday.push(hucre(d));        // isabetler arası boşluk
        if (!aday.length) aday = [hucre(en - 1), hucre(fazla + 1)].filter(bos);            // iki uç
        if (aday.length) return aday;
      }
    }
    // Tek isabet (ya da hizasız isabetler, ör. değme serbestken): dik komşular
    const aday = [], goruldu = new Set();
    for (const x of xs) {
      for (const [ds, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const s = x.s + ds, k = x.k + dk, id = s * n + k;
        if (icinde(n, s, k) && v.hucre[id] === '?' && !goruldu.has(id)) { goruldu.add(id); aday.push({ s, k }); }
      }
    }
    return aday;
  };

  // Av modu adayları: gemi sığabilecek '?' hücreler; parite açıksa satranç deseni.
  AI.avAdaylari = function (v, parite) {
    const n = v.n, hepsi = [], sigan = [];
    for (let i = 0; i < v.hucre.length; i++) {
      if (v.hucre[i] !== '?') continue;
      const h = { s: Math.floor(i / n), k: i % n };
      hepsi.push(h);
      if (AI.sigar(v, h.s, h.k)) sigan.push(h);
    }
    const aday = sigan.length ? sigan : hepsi;
    // 2'likten büyük bir gemi sürüyorsa her gemi satranç desenindeki bir hücreye değer.
    // Yalnız 1'likler kalınca desen işe yaramaz, bütün hücrelere bakılır.
    if (parite && Math.max(0, ...v.kalanUzunluklar) >= 2) {
      const cift = aday.filter(h => (h.s + h.k) % 2 === 0);
      const tek = aday.filter(h => (h.s + h.k) % 2 === 1);
      // Durum tutmadan aynı rengi sürdürmek için: yarısı atılmış (daha az kalan) renk devam eder;
      // eşitse çift renk. Boş olan renk seçilmez.
      const adaylar = [cift, tek].filter(c => c.length);
      if (adaylar.length) return adaylar.reduce((a, b) => (b.length < a.length ? b : a));
    }
    return aday;
  };

  // secenek: { parite } · r: 0..1 arası rastgele sayı üreteci
  AI.sec = function (v, secenek = {}, r = Math.random) {
    let aday = AI.hedefAdaylari(v);
    if (!aday.length) aday = AI.avAdaylari(v, secenek.parite !== false);
    if (!aday.length) throw new Error('Atılacak hücre kalmadı');
    return aday[Math.floor(r() * aday.length)];
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
