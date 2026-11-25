// engine/solve.js — çözücü, metrikler, zorluk puanı ve par süre. DOM'a dokunmaz.
//   S.cozum(lab) → [giriş … çıkış]   (BFS; mükemmel labirentte tek yol)
//   S.metrikler(lab) → { cozumUzunlugu, kararNoktasi, cikmazSayisi, cikmazOrt, cikmazOrani, donus }
//   S.zorluk(m) → sayı (ağırlıklar config.agirlik)   ·   S.par(lab) → saniye (Orta hayaletin 50 gürültü örneği ortalaması)
//   S.ipucu(lab, yol) → { sapma, sonraki }
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./topology.js') : window.LB.topology;
  const H = node ? require('./ghost.js') : window.LB.ghost;
  const C = node ? require('../config.js') : window.LB.config;

  function cozum(lab) {
    const { eb } = T.bfs(lab, lab.giris.hucre), yol = [];
    for (let i = lab.cikis.hucre; i >= 0; i = eb[i]) yol.unshift(i);
    if (yol[0] !== lab.giris.hucre) throw new Error('çıkışa ulaşılamıyor');
    return yol;
  }

  // Hücrenin kaç yönden çıkılabildiği: açık geçitler + dışa açılan ağız (giriş/çıkış)
  const cikisSayisi = (lab, i) => T.derece(lab, i) + (i === lab.giris.hucre && lab.giris.kenar ? 1 : 0) + (i === lab.cikis.hucre && lab.cikis.kenar ? 1 : 0);

  function metrikler(lab) {
    const g = lab.grid, yol = cozum(lab);
    let karar = 0, donus = 0, onceki = null;
    for (let k = 0; k < yol.length; k++) {
      if (cikisSayisi(lab, yol[k]) >= 3) karar++;
      if (k) {
        const e = g.komsu[yol[k - 1]].find(x => x.j === yol[k]);
        if (onceki !== null && e.yon !== onceki) donus++;
        onceki = e.yon;
      }
    }
    // Çıkmaz: tek geçitli hücre (giriş/çıkış hariç); uzunluğu ilk kavşağa kadar adım
    let cikmaz = 0, toplam = 0;
    for (let i = 0; i < g.n; i++) {
      if (i === lab.giris.hucre || i === lab.cikis.hucre || T.derece(lab, i) !== 1) continue;
      cikmaz++;
      let ust = -1, h = i, adim = 0;
      for (;;) {
        const ileri = T.acikKomsular(lab, h).filter(e => e.j !== ust);
        if (ileri.length !== 1) break;
        ust = h; h = ileri[0].j; adim++;
        if (cikisSayisi(lab, h) >= 3 || h === lab.giris.hucre || h === lab.cikis.hucre) break;
      }
      toplam += adim;
    }
    return {
      cozumUzunlugu: yol.length - 1,
      kararNoktasi: karar,
      cikmazSayisi: cikmaz,
      cikmazOrt: cikmaz ? toplam / cikmaz : 0,
      cikmazOrani: cikmaz / g.n,
      donus,
    };
  }

  function zorluk(m, A = C.agirlik) {
    return A.uzunluk * m.cozumUzunlugu + A.karar * m.kararNoktasi + A.cikmazOrt * m.cikmazOrt + A.cikmazSayi * m.cikmazSayisi + A.donus * m.donus;
  }

  function par(lab, ornek = C.parOrnek) {
    let t = 0;
    for (let k = 1; k <= ornek; k++) t += H.simule(lab, 'orta', k).sure;
    return Math.round(t / ornek);
  }

  // İpucu: oyuncunun yolu (girişten hücre dizisi) doğru rotadan nerede ayrıldı ve oradan sonraki n hücre.
  // Döndürür: { sapma: ayrıldığı hücre (yolu çözümün öneki ise null), sonraki: [o hücre, sonraki n hücre…] }
  function ipucu(lab, yol, n = 5) {
    const c = cozum(lab);
    let i = 0;
    while (i < yol.length && i < c.length && yol[i] === c[i]) i++;
    const bas = Math.max(0, i - 1);
    return { sapma: i < yol.length ? c[bas] : null, sonraki: c.slice(bas, bas + n + 1) };
  }

  const M = { cozum, cikisSayisi, metrikler, zorluk, par, ipucu };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).solve = M;
  if (node) module.exports = M;
})();
