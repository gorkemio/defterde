// engine/eller.js — Eller algoritması: labirenti satır satır, aşağı doğru sınırsız üretir (Sonsuz mod). DOM'a dokunmaz.
// Bellekte yalnız son satırın küme etiketleri tutulur; son satır hiç "kapatılmaz", her küme aşağıya en az bir geçitle devam eder.
//   const d = E.baslat(12, tohum)
//   const s = E.sonrakiSatir(d)   // { satir, yatay: Uint8Array(W − 1) (c ↔ c+1 açık), asagi: Uint8Array(W) (bu satırdan alttakine açık) }
// İlk satırın üst kenarı, sol ve sağ kenarlar dış duvardır.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const R = node ? require('./rng.js') : window.LB.rng;

  const BIRLES = .5, IN = .35;                   // yan yana birleşme ve fazladan aşağı inme olasılığı

  function baslat(W, tohum) {
    const kume = new Int32Array(W);
    for (let c = 0; c < W; c++) kume[c] = c;
    return { W, satir: 0, kume, yeni: W, r: R.rng(R.karma('eller', W, tohum)) };
  }

  function sonrakiSatir(d) {
    const { W, kume, r } = d, yatay = new Uint8Array(W - 1), asagi = new Uint8Array(W);
    // 1. yan yana: farklı kümedeki komşuları rastgele birleştir
    for (let c = 0; c < W - 1; c++) {
      if (kume[c] !== kume[c + 1] && r() < BIRLES) {
        yatay[c] = 1;
        const eski = kume[c + 1], yeni = kume[c];
        for (let x = 0; x < W; x++) if (kume[x] === eski) kume[x] = yeni;
      }
    }
    // 2. aşağı: her küme en az bir hücreden iner, diğerleri olasılıkla
    const uyeler = new Map();
    for (let c = 0; c < W; c++) { if (!uyeler.has(kume[c])) uyeler.set(kume[c], []); uyeler.get(kume[c]).push(c); }
    for (const liste of uyeler.values()) {
      asagi[R.sec(r, liste)] = 1;
      for (const c of liste) if (r() < IN) asagi[c] = 1;
    }
    // 3. alt satır: inen hücreler kümesini taşır, ötekiler yeni küme
    const satir = d.satir;
    for (let c = 0; c < W; c++) if (!asagi[c]) kume[c] = d.yeni++;
    d.satir++;
    return { satir, yatay, asagi };
  }

  // Akan labirent (Sonsuz): W sütunlu, en çok H satırlık dikdörtgen ızgara; satırlar Eller'le gerektikçe açılır.
  // Henüz üretilmemiş satırlara geçit yoktur (yol oraya giremez). Çıkış yok; giriş ilk satırın üstünde.
  //   const a = E.akis(T, 12, 1500, tohum); a.uret(40)  // ilk 40 satır;  a.lab: path.js'in beklediği labirent
  function akis(T, W, H, tohum) {
    const grid = T.dik(W, H), lab = { grid, acik: new Uint8Array(grid.kenar.length), tur: 'S', kod: 'S-' + W + '-' + tohum };
    const d = baslat(W, tohum);
    lab.giris = { hucre: Math.floor(W / 2) - 1 + Math.floor(d.r() * 2), kenar: 'K' };
    lab.cikis = { hucre: -1, kenar: null };
    let asagi = null;
    const a = { lab, satir: 0 };
    a.uret = (kadar) => {
      while (a.satir < Math.min(kadar, H)) {
        const r = a.satir, s = sonrakiSatir(d);
        if (asagi) for (let c = 0; c < W; c++) if (asagi[c]) lab.acik[T.kenarNo(grid, (r - 1) * W + c, r * W + c)] = 1;
        for (let c = 0; c < W - 1; c++) if (s.yatay[c]) lab.acik[T.kenarNo(grid, r * W + c, r * W + c + 1)] = 1;
        asagi = s.asagi;
        a.satir++;
      }
      // son satırın aşağı geçitleri bir sonraki satır üretilince açılır
      return a.satir;
    };
    // r0 ≤ satır < r1 için çizilecek duvarlar (her hücrenin üst ve sol duvarı, sağ kenar; ağız hariç)
    a.duvarlar = (r0, r1) => {
      const liste = [];
      for (let r = r0; r < Math.min(r1, a.satir); r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        const ust = r === 0 ? !(c === lab.giris.hucre) : !lab.acik[T.kenarNo(grid, i - W, i)];
        if (ust) liste.push({ tip: 'd', a: [c, r], b: [c + 1, r] });
        if (c === 0 || !lab.acik[T.kenarNo(grid, i - 1, i)]) liste.push({ tip: 'd', a: [c, r], b: [c, r + 1] });
        if (c === W - 1) liste.push({ tip: 'd', a: [W, r], b: [W, r + 1] });
      }
      return liste;
    };
    return a;
  }

  const M = { baslat, sonrakiSatir, akis };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).eller = M;
  if (node) module.exports = M;
})();
