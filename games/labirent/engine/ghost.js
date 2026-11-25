// engine/ghost.js — hayaletler. DOM'a dokunmaz.
// Bilgisayar hayaleti insan gibi arar, çözümü bilmez:
//  • kavşakta duraklar, çıkışa doğru giden yönü yeğler; tercihine gürültü eklenir,
//  • "bakış" derinliği kadar ileriyi görür: o mesafede biten çıkmaz dalı gözüyle eler, çıkışı görürse oraya gider,
//  • daha uzun çıkmazlara girer, sonuna varınca yolunu son açık kavşağa kadar geri sarar.
//   H.simule(lab, 'orta', tohum) → { iz: [{ hucre, t }], sure, adim, geri }   (iz geri sarmaları da içerir)
// Kendi hayaletin kaydı da aynı biçimde: [{ hucre, t }] (Faz 5).
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const R = node ? require('./rng.js') : window.LB.rng;
  const T = node ? require('./topology.js') : window.LB.topology;
  const C = node ? require('../config.js') : window.LB.config;

  // c'den o'ya açılan dala bakış: { durum: 'cikis' | 'cikmaz' | 'acik', hucreler }
  function bak(lab, c, o, derinlik, hedef) {
    const hucreler = [o];
    let katman = [[o, c]];
    for (let d = 1; katman.length; d++) {
      const sonraki = [];
      for (const [h, ust] of katman) {
        if (h === hedef) return { durum: 'cikis', hucreler };
        for (const e of T.acikKomsular(lab, h)) if (e.j !== ust) sonraki.push([e.j, h]);
      }
      if (!sonraki.length) return { durum: 'cikmaz', hucreler };
      if (d >= derinlik) return { durum: 'acik', hucreler };
      for (const [h] of sonraki) hucreler.push(h);
      katman = sonraki;
    }
    return { durum: 'cikmaz', hucreler };
  }

  function simule(lab, seviye, tohum = 1) {
    const S = C.hayalet[seviye];
    if (!S) throw new Error('Bilinmeyen seviye: ' + seviye);
    const g = lab.grid, r = R.rng(R.karma('hayalet', lab.kod || '', seviye, tohum));
    const giris = lab.giris.hucre, hedef = lab.cikis.hucre, [hx, hy] = g.merkez(hedef);
    const gor = new Uint8Array(g.n), yol = [giris], iz = [{ hucre: giris, t: 0 }];
    gor[giris] = 1;
    let t = 0, adim = 0, geri = 0;
    while (yol[yol.length - 1] !== hedef) {
      const c = yol[yol.length - 1];
      const secenek = T.acikKomsular(lab, c).filter(e => !gor[e.j]);
      if (secenek.length >= 2) t += S.dur;                  // kavşak: durup bakar
      let gecerli = [];
      for (const e of secenek) {
        const b = bak(lab, c, e.j, S.bakis, hedef);
        if (b.durum === 'cikis') { gecerli = [e]; break; }
        if (b.durum === 'cikmaz') { for (const h of b.hucreler) gor[h] = 1; continue; }   // gözüyle eledi
        gecerli.push(e);
      }
      if (!gecerli.length) {                                  // çıkmaz: bir adım geri sar
        yol.pop(); geri++;
        t += 1 / (S.hiz * C.geriHiz);
        iz.push({ hucre: yol[yol.length - 1], t });
        continue;
      }
      const [cx, cy] = g.merkez(c), hL = Math.hypot(hx - cx, hy - cy) || 1;
      let en = null, enPuan = -Infinity;
      for (const e of gecerli) {
        const [jx, jy] = g.merkez(e.j), L = Math.hypot(jx - cx, jy - cy) || 1;
        const puan = ((jx - cx) * (hx - cx) + (jy - cy) * (hy - cy)) / (L * hL) + S.gurultu * R.gauss(r);
        if (puan > enPuan) { enPuan = puan; en = e; }
      }
      gor[en.j] = 1; yol.push(en.j); adim++;
      t += 1 / S.hiz;
      iz.push({ hucre: en.j, t });
    }
    return { iz, sure: t, adim, geri };
  }

  // Hayaletin t anındaki yeri. iz: [{ hucre, t }] (geri sarmalar dahil; her kayıt o anki uç hücre).
  // Döndürür: { hucreler: girişten uca yığın, sonraki: gidilen hücre (yoksa null), f: o adımın tamamlanan kesri (0–1),
  //   geri: sonraki adım geri sarma mı, bitti }
  function yeri(iz, t) {
    const yigin = [iz[0].hucre];
    let k = 0;
    while (k + 1 < iz.length && iz[k + 1].t <= t) {
      k++;
      const h = iz[k].hucre;
      if (yigin.length >= 2 && yigin[yigin.length - 2] === h) yigin.pop(); else yigin.push(h);
    }
    if (k + 1 >= iz.length) return { hucreler: yigin, sonraki: null, f: 0, geri: false, bitti: true };
    const a = iz[k], b = iz[k + 1], geri = yigin.length >= 2 && yigin[yigin.length - 2] === b.hucre;
    return { hucreler: yigin, sonraki: b.hucre, f: Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t || 1))), geri, bitti: false };
  }

  // Oyuncunun yolundan hayalet izi: motorun 'ileri' / 'geri' olaylarındaki uç hücreler ve zamanları
  const sikistir = (iz) => iz.map(e => [e.hucre, +e.t.toFixed(2)]);
  const ac = (liste) => liste.map(([hucre, t]) => ({ hucre, t }));

  const M = { bak, simule, yeri, sikistir, ac };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).ghost = M;
  if (node) module.exports = M;
})();
