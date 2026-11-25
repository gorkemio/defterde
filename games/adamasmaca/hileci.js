// hileci.js — Hileci Hoca: bilgisayar kelimeyi seçmez; aynı uzunluktaki adayların kümesini tutar. Her tahminde adayları harfin
// konum desenine göre böler, en kalabalık kümeyi seçer ve buna göre cevap verir. DOM'a dokunmaz.
// Tarayıcıda AA.hileci, node'da module.exports.
//
//   const H = hileci.kur(kelimeler, 6);   // kelimeler: havuz (normalize edilir, uzunluğu tutmayanlar atılır)
//   H.tahmin('A')   → { konumlar: [1, 3], kalan: 12 }   konumlar [] ise harf yok (yanlış); kalan = elde kalan aday sayısı
//   H.harfAc()      → { harf: 'E', konumlar: [3] }      ipucu: kalan adaylarda geçen en kalabalık (harf, desen); adaylar daralır
//   H.itiraf()      → { sayi, ilk10, kelime }           oyun bitince: "Hile yaptım, sonunda elimde N kelime vardı"
//
// Değişmez: her tahminden sonra kalan her aday açıklanan maskeye uyar ve yanlış harflerin hiçbirini içermez.
(function () {
  'use strict';

  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('./tr.js') : window.AA.tr;
  const C = node ? require('./config.js') : window.AA.config;

  const hileci = {};

  // Harfin kelimedeki konumları "1,3" diye; hiç geçmiyorsa "" (yanlış cevap)
  hileci.desen = (kelime, harf) => tr.konumlar(kelime, harf).join(',');

  // Adayları desenine göre böler: Map<desen, aday[]> (sıra korunur)
  hileci.bol = function (adaylar, harf) {
    const gruplar = new Map();
    for (const k of adaylar) {
      const d = hileci.desen(k, harf);
      if (!gruplar.has(d)) gruplar.set(d, []);
      gruplar.get(d).push(k);
    }
    return gruplar;
  };

  // En kalabalık küme; eşitlikte harfin hiç geçmediği küme (""), yine eşitse desen sırası. Döner: desen.
  hileci.sec = function (gruplar) {
    let en = null;
    for (const [desen, liste] of gruplar) {
      if (en === null) { en = [desen, liste.length]; continue; }
      const [d0, n0] = en;
      const daha = liste.length > n0 || (liste.length === n0 && (desen === '' || (d0 !== '' && desen < d0)));
      if (daha) en = [desen, liste.length];
    }
    return en ? en[0] : null;
  };

  // Havuzdan rastgele bir kelimenin uzunluğu; en az C.hileci.enAzAday adayı olan uzunluklar tercih edilir.
  hileci.uzunlukSec = function (kelimeler, rng = Math.random) {
    const sayim = new Map();
    for (const k of kelimeler) { const n = Array.from(tr.normalize(k)).length; sayim.set(n, (sayim.get(n) || 0) + 1); }
    const uygun = [...sayim].filter(([, s]) => s >= C.hileci.enAzAday).map(([n]) => n);
    const uzunluklar = uygun.length ? uygun : [...sayim.keys()];
    const havuz = kelimeler.filter((k) => uzunluklar.includes(Array.from(tr.normalize(k)).length));
    return Array.from(tr.normalize(havuz[Math.floor(rng() * havuz.length)])).length;
  };

  hileci.kur = function (kelimeler, uzunluk) {
    let kume = [...new Set(kelimeler.map((k) => tr.normalize(k)))].filter((k) => Array.from(k).length === uzunluk);
    if (!kume.length) throw new RangeError(`${uzunluk} harfli aday yok`);
    const denenen = new Set();

    const yeni = (h) => {
      const harf = tr.normalize(h);
      if (!tr.ALFABE.includes(harf)) throw new RangeError('Alfabe dışı harf: ' + h);
      if (denenen.has(harf)) throw new Error('Harf zaten seçildi: ' + harf);
      return harf;
    };
    const konumlar = (desen) => (desen === '' ? [] : desen.split(',').map(Number));

    return {
      uzunluk,
      get adaylar() { return kume.slice(); },
      get sayi() { return kume.length; },

      tahmin(h) {
        const harf = yeni(h);
        const gruplar = hileci.bol(kume, harf);
        const desen = hileci.sec(gruplar);
        kume = gruplar.get(desen);
        denenen.add(harf);
        return { konumlar: konumlar(desen), kalan: kume.length };
      },

      // İpucu: henüz denenmemiş harflerden, harfi İÇEREN en kalabalık (harf, desen); eşitlikte alfabe sırası, sonra desen sırası
      harfAc() {
        let en = null;
        for (const harf of tr.ALFABE) {
          if (denenen.has(harf)) continue;
          for (const [desen, liste] of hileci.bol(kume, harf)) {
            if (desen === '') continue;
            if (!en || liste.length > en.n || (liste.length === en.n && harf === en.harf && desen < en.desen)) en = { harf, desen, n: liste.length, liste };
          }
        }
        if (!en) throw new Error('Açılacak harf kalmadı');
        kume = en.liste;
        denenen.add(en.harf);
        return { harf: en.harf, konumlar: konumlar(en.desen) };
      },

      itiraf() { return { sayi: kume.length, ilk10: kume.slice(0, 10), kelime: kume[0] }; },
    };
  };

  if (typeof window !== 'undefined') (window.AA = window.AA || {}).hileci = hileci;
  if (node) module.exports = hileci;
})();
