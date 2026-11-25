// engine/difficulty.js — zorluk puanı. DOM'a bakmaz.
//
// Temel: Orta seviye bilgisayarın ilk çözümü bulana kadar denediği aday sayısının beklenen değeri (çözüm dahil).
//   Tek çözümde kapalı biçim: 1 + Σ_c Φ((temel_s − temel_c) / (σ√2))  (gürültü farkı normal; 200 örnekle aynı beklenti, sıfır örnek hatası)
//   Çok çözümde 200 tohumlu gürültü örneği.
// Üstüne düzeltmeler (tek tablo AGIRLIK), log ölçeğinde: ham = ln(1 + temel) + Σ ağırlık.
// Puan (Elo ölçeği, tüm havuzda tek): 600 + 1600 · sınır((ham − H0) / (H1 − H0), 0, 1).
// Bantlar KATEGORİ İÇİ: BANT_ESIK[kategori] = [k1, k2, k3] puan eşikleri (Kolay < k1 ≤ Orta < k2 ≤ Zor < k3 ≤ Çok zor).
(function () {
  'use strict';
  const dugum = typeof module !== 'undefined' && module.exports;
  const Mo = dugum ? require('./model.js') : window.KB.model;
  const So = dugum ? require('./solver.js') : window.KB.solver;
  const Ai = dugum ? require('./ai.js') : window.KB.ai;

  const AGIRLIK = {
    islem: .3,        // çözümde işlem işareti değişiyor
    esit: .8,         // "=" yer değiştiriyor
    sayidan: .5,      // bir sayıdan başka sayıya geçen çöp
    bosHucre: .6,     // boş hücrede yeni rakam
    carpBol: .3,      // × ya da ÷ içeriyor
    oncelik: .4,      // işlem önceliği gerekiyor
    yakinIska: .08,   // eşitliği 1 farkla tutturan aday başına
    yakinIskaEnCok: .8,
  };
  const ETIKET = { islem: 1, esit: 2, sayidan: 4, bosHucre: 8, carpBol: 16, oncelik: 32 };
  const BANTLAR = ['kolay', 'orta', 'zor', 'cokzor'];
  const BANT_AD = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor', cokzor: 'Çok zor' };

  // KALIBRE-BAS (scripts/uret.mjs yazar; elle düzenleme)
  const KALIBRE = {"H0":1.0511,"H1":6.0895,"BANT_ESIK":{"tek":[970,1186,1376],"iki":[1496,1744,1966],"ekle":[654,720,780],"cikar":[666,738,804],"hepsini":[770,1016,1220],"romen":[696,778,822]}};
  // KALIBRE-SON

  // Φ: standart normal dağılım fonksiyonu (Abramowitz–Stegun 7.1.26)
  function Phi(x) {
    const t = 1 / (1 + .3275911 * Math.abs(x) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }

  function temelDeger(liste, sigma, tohum) {
    const coz = liste.filter(a => a.dogru);
    if (!coz.length) return liste.length + 1;
    if (coz.length === 1) {
      const s = coz[0];
      let e = 1;
      for (const c of liste) if (c !== s) e += Phi((s.temel - c.temel) / (sigma * Math.SQRT2));
      return e;
    }
    const r = Mo.rng(tohum);
    let top = 0;
    for (let n = 0; n < 200; n++) {
      const p = liste.map(a => a.temel + Ai.gauss(r) * sigma);
      let enS = Infinity;
      liste.forEach((a, i) => { if (a.dogru && p[i] < enS) enS = p[i]; });
      let once = 0;
      for (let i = 0; i < p.length; i++) if (p[i] < enS) once++;
      top += once + 1;
    }
    return top / 200;
  }

  // Bir başlangıç ile bir çözüm arasındaki etiketler
  function etiketler(bas, cozumBayt, liste) {
    const s = bas.sablon;
    const o0 = Mo.oku(bas), o1 = Mo.oku({ sablon: s, bayt: cozumBayt });
    const e = {};
    const f = Mo.fark(bas, { sablon: s, bayt: cozumBayt });
    for (let i = 0; i < s.hucreSayisi; i++) {
      if (s.hucreler[i].tur === 'I' && bas.bayt[i] !== cozumBayt[i]) {
        const c0 = Mo.TANI.I[bas.bayt[i]], c1 = Mo.TANI.I[cozumBayt[i]];
        if (c0 !== c1) e.islem = true;
        if ((c0 === '=') !== (c1 === '=')) e.esit = true;
      }
      if (s.hucreler[i].tur !== 'I' && bas.bayt[i] === 0 && cozumBayt[i] !== 0) e.bosHucre = true;
    }
    const sayilarDen = new Set(f.kaldirilan.map(y => s.hucreler[y >> 3]).filter(h => h.tur !== 'I').map(h => h.sayi));
    const sayilarYe = new Set(f.eklenen.map(y => s.hucreler[y >> 3]).filter(h => h.tur !== 'I').map(h => h.sayi));
    for (const a of sayilarDen) for (const b of sayilarYe) if (a !== b) e.sayidan = true;
    if (/[*/]/.test(o0.metin || '') || /[*/]/.test(o1.metin || '')) e.carpBol = true;
    if (o1.gecerli && Mo.oncelikGerekir(o1)) e.oncelik = true;
    e.yakinIska = liste.filter(a => !a.dogru && a.fark === 1).length;
    return e;
  }

  const kat = (kategori) => (kategori === 'romen' ? 'tek' : kategori);
  // Zorluk hesabı. Döner { temel, ham, puan, bant, etiket (bit), etiketler, cozumSayisi, adaySayisi }
  function hesapla(bas, kategori, o = {}) {
    const hak = Mo.hakOf(kat(kategori));
    const liste = o.adaylar || Ai.adayListesi(bas, hak);
    const sigma = Ai.SEVIYE.orta.sigma;
    const temel = temelDeger(liste, sigma, o.tohum ?? Mo.karma(Mo.kanonikDize(bas)));
    const coz = liste.filter(a => a.dogru).sort((x, y) => x.temel - y.temel);
    const et = coz.length ? etiketler(bas, coz[0].bayt, liste) : { yakinIska: 0 };
    let ham = Math.log(1 + temel);
    let bit = 0;
    for (const k in ETIKET) if (et[k]) { ham += AGIRLIK[k]; bit |= ETIKET[k]; }
    ham += Math.min(AGIRLIK.yakinIskaEnCok, AGIRLIK.yakinIska * et.yakinIska);
    const puan = puanOf(ham);
    return { temel, ham, puan, bant: bantOf(kategori, puan), etiket: bit, etiketler: et, cozumSayisi: coz.length, adaySayisi: liste.length };
  }
  function puanOf(ham, K = KALIBRE) {
    const x = Math.max(0, Math.min(1, (ham - K.H0) / (K.H1 - K.H0)));
    return Math.round(600 + 1600 * x);
  }
  function bantOf(kategori, puan, K = KALIBRE) {
    const e = K.BANT_ESIK[kategori] || K.BANT_ESIK.tek;
    return puan < e[0] ? 'kolay' : puan < e[1] ? 'orta' : puan < e[2] ? 'zor' : 'cokzor';
  }
  const bantNo = (b) => BANTLAR.indexOf(b);

  const D = { AGIRLIK, ETIKET, BANTLAR, BANT_AD, KALIBRE, Phi, temelDeger, etiketler, hesapla, puanOf, bantOf, bantNo };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).difficulty = D;
  if (dugum) module.exports = D;
})();
