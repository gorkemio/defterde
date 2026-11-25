// engine/solver.js — hızlı çözücü: hücre bazlı ayrıştırma + derinlik öncelikli birleştirme. DOM'a bakmaz.
//
// Her hücre baytı için, hücreyi geçerli (ya da izinli boş) bırakan geçişler önceden çıkarılır: { kaldir, ekle, yeni, r, a }.
// Sonra hücreler birleştirilir: toplam kaldırma R, toplam ekleme A olacak biçimde (oynat k: R=A=k; ekle: R=0, A=1; çıkar: R=1, A=0).
//   coz(durum, { k, tur })      → [{ metin, varyantlar: [{ bayt, hamleler: [{ den, ye }] }] }]   (eşitlik metnine göre gruplu)
//   adaylar(durum, { k, tur })  → sözdizimsel olarak geçerli tüm sonuçlar (doğru/yanlış karışık; bilgisayar ve zorluk için)
//   olc(n)                      → { k1: { ort, enCok }, k2: {...} } ms
(function () {
  'use strict';
  const Mo = typeof module !== 'undefined' && module.exports ? require('./model.js') : window.KB.model;
  const { TANI, POP } = Mo;

  // DELTA[tur][bayt] = [{ yeni, kaldir, ekle, r, a, bos, esit }]  (r, a ≤ 2)
  const DELTA = {};
  for (const tur of ['R', 'I', 'M']) {
    const n = tur === 'I' ? 64 : 128;
    DELTA[tur] = new Array(n);
    for (let x = 0; x < n; x++) {
      const liste = [];
      for (let y = 0; y < n; y++) {
        const ch = TANI[tur][y];
        if (ch === null) continue;
        const kaldir = x & ~y, ekle = y & ~x, r = POP[kaldir], a = POP[ekle];
        if (r > 2 || a > 2) continue;
        liste.push({ yeni: y, kaldir, ekle, r, a, bos: ch === ' ', esit: ch === '=' ? 1 : 0 });
      }
      liste.sort((p, q) => (p.r + p.a) - (q.r + q.a));
      DELTA[tur][x] = liste;
    }
  }

  function hedef(o) {
    const tur = o.tur || 'oynat', k = o.k || 1;
    if (tur === 'ekle') return { R: 0, A: 1 };
    if (tur === 'cikar') return { R: 1, A: 0 };
    return { R: k, A: k };
  }

  // Ortak DFS. kabul(okuma, bayt) → kayıt ya da null. Yaprakta okuKarakter ile sözdizimi kontrol edilir.
  function gez(dr, o, kabul) {
    const s = dr.sablon, n = s.hucreSayisi, by = dr.bayt;
    const { R, A } = hedef(o);
    const yeni = new Uint8Array(n), kar = new Array(n);
    const sec = new Array(n);
    // her hücrede, kalan hücrelerin en çok verebileceği r/a (budama için gerekmiyor; R, A ≤ 2)
    const izin = s.hucreler.map(h => h.bos);
    function dfs(i, r, a, esit) {
      if (i === n) {
        if (r !== R || a !== A || esit !== 1) return;
        const ok = Mo.okuKarakter(s, kar);
        if (!ok.gecerli) return;
        kabul(ok, yeni, sec);
        return;
      }
      const h = s.hucreler[i];
      const liste = DELTA[h.tur][by[i]];
      for (let j = 0; j < liste.length; j++) {
        const t = liste[j];
        if (r + t.r > R || a + t.a > A) continue;
        if (t.bos && !izin[i]) continue;
        if (esit + t.esit > 1) continue;
        yeni[i] = t.yeni; kar[i] = TANI[h.tur][t.yeni]; sec[i] = t;
        dfs(i + 1, r + t.r, a + t.a, esit + t.esit);
      }
    }
    dfs(0, 0, 0, 0);
  }

  // Kaldırılan ve eklenen yuvaları eşle (canlandırma ve ipucu için): önce aynı hücre, sonra en yakın hücre
  function hamleler(sec, n) {
    const den = [], ye = [];
    for (let i = 0; i < n; i++) {
      const t = sec[i];
      for (let bit = 0; bit < 7; bit++) {
        if (t.kaldir & (1 << bit)) den.push(i * 8 + bit);
        if (t.ekle & (1 << bit)) ye.push(i * 8 + bit);
      }
    }
    const H = [];
    const kalanYe = ye.slice();
    for (const d of den) {
      let en = -1, best = 1e9;
      kalanYe.forEach((y, j) => { const u = Math.abs((y >> 3) - (d >> 3)); if (u < best) { best = u; en = j; } });
      if (en >= 0) { H.push({ den: d, ye: kalanYe[en] }); kalanYe.splice(en, 1); } else H.push({ den: d, ye: null });
    }
    kalanYe.forEach(y => H.push({ den: null, ye: y }));
    return H;
  }

  function coz(dr, o = {}) {
    const gruplar = new Map();
    gez(dr, o, (ok, yeni, sec) => {
      const p = Mo.degerlendir(ok);
      if (!p.dogru) return;
      let g = gruplar.get(ok.metin);
      if (!g) { g = { metin: ok.metin, varyantlar: [] }; gruplar.set(ok.metin, g); }
      g.varyantlar.push({ bayt: Uint8Array.from(yeni), hamleler: hamleler(sec, yeni.length) });
    });
    return [...gruplar.values()].sort((x, y) => (x.metin < y.metin ? -1 : x.metin > y.metin ? 1 : 0));
  }
  const cozumSayisi = (dr, o) => coz(dr, o).length;

  // Bilgisayarın adayları: sözdizimsel olarak geçerli her sonuç. degisen: değişen hücreler; fark: |sol − sağ| (hesaplanamıyorsa null)
  function adaylar(dr, o = {}) {
    const liste = [];
    gez(dr, o, (ok, yeni, sec) => {
      const p = Mo.degerlendir(ok);
      const degisen = [];
      for (let i = 0; i < yeni.length; i++) if (yeni[i] !== dr.bayt[i]) degisen.push(i);
      liste.push({
        bayt: Uint8Array.from(yeni), metin: ok.metin, okuma: ok, degisen,
        fark: p.gecerli ? Math.abs(p.sol - p.sag) : null, dogru: p.dogru, hamleler: hamleler(sec, yeni.length),
      });
    });
    return liste;
  }

  // Hız ölçümü: rastgele (kanonik, yanlış olabilir) durumlarda
  function olc(n = 200, tohum = 7) {
    const r = Mo.rng(tohum);
    const sonuc = {};
    for (const [ad, o] of [['k1', { k: 1 }], ['k2', { k: 2 }], ['ekle', { tur: 'ekle' }], ['cikar', { tur: 'cikar' }]]) {
      let top = 0, enCok = 0;
      for (let i = 0; i < n; i++) {
        const dr = rastgeleDurum(r);
        const t0 = now();
        coz(dr, o);
        const t = now() - t0;
        top += t; if (t > enCok) enCok = t;
      }
      sonuc[ad] = { ort: +(top / n).toFixed(3), enCok: +enCok.toFixed(2) };
    }
    return sonuc;
  }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Rastgele kanonik durum: şablondan rastgele rakamlar ve işlemler (doğru olması gerekmez)
  function rastgeleDurum(r, sablonlar = Mo.SABLONLAR) {
    const id = sablonlar[Math.floor(r() * sablonlar.length)];
    const s = Mo.sablon(id);
    const bayt = new Uint8Array(s.hucreSayisi);
    const ops = ['+', '-', '*', '/'];
    let esitKonuldu = false;
    const islemHucre = s.hucreler.map((h, i) => (h.tur === 'I' ? i : -1)).filter(i => i >= 0);
    const esitYer = islemHucre[Math.floor(r() * islemHucre.length)];
    s.hucreler.forEach((h, i) => {
      if (h.tur === 'I') bayt[i] = Mo.ISLEM[i === esitYer ? '=' : ops[Math.floor(r() * 4)]];
      else if (h.tur === 'R') bayt[i] = Mo.RAKAM[(h.sira === 0 && s.sayilar[h.sayi].basamak > 1) ? 1 + Math.floor(r() * 9) : Math.floor(r() * 10)];
      else bayt[i] = Mo.ROMEN['IVXL'[Math.floor(r() * 4)]];
    });
    void esitKonuldu;
    return { sablon: s, bayt };
  }

  const S = { DELTA, coz, cozumSayisi, adaylar, gez, hamleler, hedef, olc, rastgeleDurum };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).solver = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
