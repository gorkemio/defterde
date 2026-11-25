// engine/ai.js — bilgisayar: insan gibi arar, hile yapmaz. DOM'a bakmaz.
//
// Adaylar: hamle hakkı içinde ulaşılabilen bütün sözdizimsel eşitlikler (doğru ve yanlış karışık). Sıralamada doğruluk
// KULLANILMAZ: aday puanı = katman + yön + seviye gürültüsü. Katmanlar (küçük önce):
//   1 işlem işaretini çevirme / aynı rakam içinde · 2 aynı sayıda rakamdan rakama, işaretten rakama · 3 sayıdan sayıya,
//   işaretten işarete · 4 "=" taşıma. Kutu hamlelerinde (ekle/çıkar) katman değişen hücreye göre: işlem 1, rakam 2.
//   İki çöpte: iki tek hamlenin en büyüğü (+.5 iki ayrı hücre).
// Yön: iki taraf arasındaki farkı azaltan adaya −.3 (çözümü ayırt etmez; fark küçülen her aday alır).
//   adayListesi(bas, { k, tur }) → [{ metin, bayt, katman, temel, dogru, fark }]   (metne göre tekil)
//   plan(bas, { kategori, seviye, tohum, sureS, hepsini }) → { centikler, buldu, pes, gizli }
//   bozmaSec(dogruDurum, seviye, rng) → durum
(function () {
  'use strict';
  const dugum = typeof module !== 'undefined' && module.exports;
  const Mo = dugum ? require('./model.js') : window.KB.model;
  const So = dugum ? require('./solver.js') : window.KB.solver;
  const Zor = () => (dugum ? require('./difficulty.js') : window.KB.difficulty);

  // Brief'teki oranlar korunarak ön-kalibre (Faz 5 simülasyonu, docs/bilgisayar.md): aday sayıları küçük olduğundan
  // brief'in 2.5 s / 1.2 s değerleriyle Orta tek çöpün en zorunu ~28 s'de çözüyordu; hedef kolay 10–20 s, zor 45–80 s.
  const SEVIYE = {
    kolay: { ad: 'Kolay', okuma: 9.6, deneme: 3.7, sigma: .9, atla: true },
    orta: { ad: 'Orta', okuma: 6, deneme: 2, sigma: .6 },
    zor: { ad: 'Zor', okuma: 3.6, deneme: 1.15, sigma: .4 },
    usta: { ad: 'Usta', okuma: 2.4, deneme: .65, sigma: .25 },
  };
  const YON = -.3, IKI_HUCRE = .5, SURE_SIGMA = .35, PES_S = 90;
  // İki çöpte deneme süresi çarpanı (brief: yarı; simülasyonla .3), katman başına ek deneme süresi, iki çöpte yön ağırlığı
  let IKI_CARPAN = .3, KATMAN_SURE = .3, YON_IKI = -1;
  const ayarla = (o) => { if (o.iki !== undefined) IKI_CARPAN = o.iki; if (o.katman !== undefined) KATMAN_SURE = o.katman; if (o.yonIki !== undefined) YON_IKI = o.yonIki; };

  // Bir tek hamlenin katmanı (den/ye: global yuva ya da null = kutu)
  function hamleKatmani(s, den, ye, esitTasindi) {
    if (esitTasindi) return 4;
    const hd = den === null ? null : den >> 3, hy = ye === null ? null : ye >> 3;
    if (hd === null || hy === null) {                     // kutu hamlesi
      const h = s.hucreler[hd ?? hy];
      return h.tur === 'I' ? 1 : 2;
    }
    if (hd === hy) return 1;
    const A = s.hucreler[hd], Bh = s.hucreler[hy];
    if (A.tur !== 'I' && Bh.tur !== 'I') return A.sayi === Bh.sayi ? 2 : 3;
    if (A.tur === 'I' && Bh.tur === 'I') return 3;
    return 2;
  }
  const esitYeri = (s, bayt) => { for (let i = 0; i < s.hucreSayisi; i++) if (s.hucreler[i].tur === 'I' && Mo.TANI.I[bayt[i]] === '=') return i; return -1; };

  function adayListesi(bas, o = {}) {
    const s = bas.sablon;
    const ham = So.adaylar(bas, o);
    const p0 = Mo.degerlendir(Mo.oku(bas));
    const fark0 = p0.gecerli ? Math.abs(p0.sol - p0.sag) : null;
    const esit0 = esitYeri(s, bas.bayt);
    const tekil = new Map();
    for (const a of ham) {
      const tasindi = esitYeri(s, a.bayt) !== esit0;
      let katman = 0;
      for (const h of a.hamleler) katman = Math.max(katman, hamleKatmani(s, h.den, h.ye, tasindi));
      const hucreler = new Set(); a.hamleler.forEach(h => { if (h.den !== null) hucreler.add(h.den >> 3); if (h.ye !== null) hucreler.add(h.ye >> 3); });
      if (a.hamleler.length > 1 && hucreler.size > 1) katman += IKI_HUCRE;
      const yon = fark0 !== null && a.fark !== null && a.fark < fark0 ? (o.k === 2 ? YON_IKI : YON) : 0;
      const x = { metin: a.metin, bayt: a.bayt, katman, temel: katman + yon, dogru: a.dogru, fark: a.fark, hamleler: a.hamleler };
      const once = tekil.get(a.metin);
      if (!once || x.temel < once.temel || (x.temel === once.temel && kanonikMi(s, x.bayt) && !kanonikMi(s, once.bayt))) tekil.set(a.metin, x);
    }
    return [...tekil.values()];
  }
  const kanonikMi = (s, bayt) => Mo.kanonikMi({ sablon: s, bayt });

  // Standart normal (Box–Muller), tohumlu
  function gauss(r) {
    let u = 0; while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }
  function sirala(liste, seviye, r) {
    const S = SEVIYE[seviye];
    return liste.map(a => ({ a, p: a.temel + gauss(r) * S.sigma + (S.atla && a.katman >= 3 ? 100 : 0) }))
      .sort((x, y) => x.p - y.p).map(x => x.a);
  }

  // Zaman planı: tur başında bir kez; çözüm "gizli"de, UI tur bitince okur.
  function plan(bas, o = {}) {
    const S = SEVIYE[o.seviye || 'orta'];
    const hak = Mo.hakOf(o.kategori || 'tek');
    const r = Mo.rng(o.tohum ?? 1);
    const sure = o.sureS ?? PES_S;
    const liste = o.adaylar || adayListesi(bas, hak);
    const sira = sirala(liste, o.seviye || 'orta', r);
    const toplamCozum = liste.filter(a => a.dogru).length;
    const carpan = (hak.k === 2 ? IKI_CARPAN : 1) * (o.denemeCarpani ?? 1);
    const duzelt = Math.exp(SURE_SIGMA * SURE_SIGMA / 2);
    let t = S.okuma * Math.exp(gauss(r) * .2);
    const centikler = [], cozumler = [];
    let buldu = null, ilk = null;
    for (const a of sira) {
      const dt = S.deneme * carpan * (1 + KATMAN_SURE * (Math.max(1, a.katman) - 1)) * Math.exp(gauss(r) * SURE_SIGMA) / duzelt;
      if (t + dt > sure) break;
      t += dt;
      centikler.push(+t.toFixed(2));
      if (a.dogru) {
        cozumler.push({ t: +t.toFixed(2), metin: a.metin, bayt: a.bayt });
        if (!ilk) ilk = a;
        if (!o.hepsini) { buldu = +t.toFixed(2); break; }
        if (cozumler.length === toplamCozum) break;
      }
    }
    if (o.hepsini && cozumler.length) buldu = cozumler[0].t;
    return {
      centikler, buldu, pes: !o.hepsini && buldu === null,
      gizli: { metin: ilk ? ilk.metin : null, bayt: ilk ? ilk.bayt : null, cozumler },
    };
  }

  // Boz ve Düzelt: doğru eşitlikten tek çöplük bozma. Zor seviyelerde tek çözümlüler arasında en zoru; Kolay'da rastgele.
  function bozmalar(dogruDurum) {
    const out = [];
    for (const a of So.adaylar(dogruDurum, { k: 1 })) {
      const d = { sablon: dogruDurum.sablon, bayt: a.bayt };
      if (a.dogru || !Mo.kanonikMi(d)) continue;
      out.push(d);
    }
    return out;
  }
  function bozmaSec(dogruDurum, seviye, r) {
    const liste = bozmalar(dogruDurum);
    if (!liste.length) return null;
    if (seviye === 'kolay') return liste[Math.floor(r() * liste.length)];
    let en = null, enP = -1;
    for (const d of liste) {
      if (So.cozumSayisi(d, { k: 1 }) !== 1) continue;
      const p = Zor().hesapla(d, 'tek').puan + r() * 30 * (seviye === 'usta' ? 0 : 1);
      if (p > enP) { enP = p; en = d; }
    }
    return en || liste[Math.floor(r() * liste.length)];
  }

  const A = { SEVIYE, YON, IKI_HUCRE, ayarla, hamleKatmani, adayListesi, sirala, plan, bozmalar, bozmaSec, gauss };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).ai = A;
  if (dugum) module.exports = A;
})();
