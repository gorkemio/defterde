// game.js — saf oyun mantığı. DOM'a dokunmaz; tarayıcıda AB.game, node'da module.exports.
//
// tahta = {
//   n, degmeYasak,
//   gemiler: [{ id, uzunluk, hucreler: [{s,k}], yatay, isabet, batti }],
//   gemiHaritasi: Int8Array(n*n)   // -1 boş, değilse gemi id
//   atis: Uint8Array(n*n)          // 0 atılmadı · 1 ıska · 2 isabet · 3 otomatik ıska
// }
// s = satır (0..n-1), k = sütun (0..n-1).
(function () {
  'use strict';

  const G = {};
  const SUTUN_HARFLERI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Tohumlu rastgele sayı üreteci (mulberry32): testlerde aynı tohum aynı tahtayı verir.
  G.rng = function (tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const icinde = (n, s, k) => s >= 0 && k >= 0 && s < n && k < n;

  G.hucreAdi = (s, k) => SUTUN_HARFLERI[k] + (s + 1);                 // (2, 6) -> "G3"

  // 4 komşu (üst, alt, sol, sağ)
  G.komsular = (n, s, k) =>
    [[s - 1, k], [s + 1, k], [s, k - 1], [s, k + 1]]
      .filter(([a, b]) => icinde(n, a, b)).map(([a, b]) => ({ s: a, k: b }));

  // Hücre kümesinin çevresindeki 8 komşuluk halkası (kümenin kendisi hariç, tahta içinde, tekrarsız)
  G.halka = function (n, hucreler) {
    const ic = new Set(hucreler.map(h => h.s * n + h.k));
    const goruldu = new Set();
    const sonuc = [];
    for (const h of hucreler) {
      for (let ds = -1; ds <= 1; ds++) {
        for (let dk = -1; dk <= 1; dk++) {
          const s = h.s + ds, k = h.k + dk;
          if (!icinde(n, s, k)) continue;
          const id = s * n + k;
          if (ic.has(id) || goruldu.has(id)) continue;
          goruldu.add(id);
          sonuc.push({ s, k });
        }
      }
    }
    return sonuc;
  };

  G.gemiHucreleri = (uzunluk, s, k, yatay) =>
    Array.from({ length: uzunluk }, (_, i) => (yatay ? { s, k: k + i } : { s: s + i, k }));

  G.bosTahta = (n, degmeYasak = true) => ({
    n,
    degmeYasak,
    gemiler: [],
    gemiHaritasi: new Int8Array(n * n).fill(-1),
    atis: new Uint8Array(n * n),
  });

  // Hücreler tahta içinde, boş ve (değme yasaksa) halkası da boş mu?
  G.yerlestirilebilir = function (t, hucreler) {
    for (const h of hucreler) {
      if (!icinde(t.n, h.s, h.k)) return false;
      if (t.gemiHaritasi[h.s * t.n + h.k] !== -1) return false;
    }
    if (t.degmeYasak) {
      for (const h of G.halka(t.n, hucreler)) {
        if (t.gemiHaritasi[h.s * t.n + h.k] !== -1) return false;
      }
    }
    return true;
  };

  // Tahtaya gemi ekler (yerinde değiştirir). Geçersizse hata fırlatır.
  G.gemiEkle = function (t, uzunluk, s, k, yatay) {
    const hucreler = G.gemiHucreleri(uzunluk, s, k, yatay);
    if (!G.yerlestirilebilir(t, hucreler)) throw new Error('Gemi buraya yerleştirilemez');
    const gemi = { id: t.gemiler.length, uzunluk, hucreler, yatay: uzunluk === 1 ? true : yatay, isabet: 0, batti: false };
    t.gemiler.push(gemi);
    for (const h of hucreler) t.gemiHaritasi[h.s * t.n + h.k] = gemi.id;
    return gemi;
  };

  // Config'teki gemileri rastgele dizilmiş yeni tahta. Uzun gemiden başlar; her gemi için geçerli
  // tüm yerleşimlerden biri seçilir. Hiç yer kalmazsa baştan dener.
  G.yeniTahta = function (config, r) {
    const uzunluklar = config.gemiler.slice().sort((a, b) => b - a);
    for (let deneme = 0; deneme < 1000; deneme++) {
      const t = G.bosTahta(config.boyut, config.degmeYasak);
      let tamam = true;
      for (const uzunluk of uzunluklar) {
        const adaylar = [];
        for (let s = 0; s < t.n; s++) {
          for (let k = 0; k < t.n; k++) {
            for (const yatay of (uzunluk === 1 ? [true] : [true, false])) {
              if (G.yerlestirilebilir(t, G.gemiHucreleri(uzunluk, s, k, yatay))) adaylar.push([s, k, yatay]);
            }
          }
        }
        if (!adaylar.length) { tamam = false; break; }
        const [s, k, yatay] = adaylar[Math.floor(r() * adaylar.length)];
        G.gemiEkle(t, uzunluk, s, k, yatay);
      }
      if (tamam) return t;
    }
    throw new Error('Gemiler yerleştirilemedi (tahta çok küçük olabilir)');
  };

  // Gemiyi (id) yeni yere taşır/döndürür: ilk hücresi (s,k), yatay mı. Yalnız hiç atış yokken (dizilim aşaması).
  // tasinabilir yalnız sorar, gemiTasi geçerliyse uygular ve true döner; geçersizse tahtaya dokunmaz.
  G.tasinabilir = function (t, id, s, k, yatay) {
    if (t.atis.some(v => v !== 0)) return false;
    const gemi = t.gemiler[id];
    const yeni = G.gemiHucreleri(gemi.uzunluk, s, k, yatay);
    for (const h of gemi.hucreler) t.gemiHaritasi[h.s * t.n + h.k] = -1;     // kendi eski yeri engel olmasın
    const uygun = G.yerlestirilebilir(t, yeni);
    for (const h of gemi.hucreler) t.gemiHaritasi[h.s * t.n + h.k] = id;
    return uygun;
  };

  G.gemiTasi = function (t, id, s, k, yatay) {
    if (!G.tasinabilir(t, id, s, k, yatay)) return false;
    const gemi = t.gemiler[id];
    for (const h of gemi.hucreler) t.gemiHaritasi[h.s * t.n + h.k] = -1;
    gemi.yatay = gemi.uzunluk === 1 ? true : yatay;
    gemi.hucreler = G.gemiHucreleri(gemi.uzunluk, s, k, gemi.yatay);
    for (const h of gemi.hucreler) t.gemiHaritasi[h.s * t.n + h.k] = id;
    return true;
  };

  // Atış. Sonuç: { sonuc: 'tekrar'|'iska'|'isabet'|'batti', gemi?, otoIska: [{s,k}] }
  // Gemi batınca (değme yasaksa) çevresindeki atılmamış hücreler otomatik ıska (3) olur.
  G.atesEt = function (t, s, k) {
    if (!icinde(t.n, s, k)) throw new RangeError(`Tahta dışı: ${s},${k}`);
    const i = s * t.n + k;
    if (t.atis[i] !== 0) return { sonuc: 'tekrar', otoIska: [] };

    const gid = t.gemiHaritasi[i];
    if (gid === -1) {
      t.atis[i] = 1;
      return { sonuc: 'iska', otoIska: [] };
    }
    t.atis[i] = 2;
    const gemi = t.gemiler[gid];
    gemi.isabet++;
    if (gemi.isabet < gemi.uzunluk) return { sonuc: 'isabet', gemi, otoIska: [] };

    gemi.batti = true;
    const otoIska = [];
    if (t.degmeYasak) {
      for (const h of G.halka(t.n, gemi.hucreler)) {
        const j = h.s * t.n + h.k;
        if (t.atis[j] === 0) { t.atis[j] = 3; otoIska.push(h); }
      }
    }
    return { sonuc: 'batti', gemi, otoIska };
  };

  G.hepsiBatti = (t) => t.gemiler.length > 0 && t.gemiler.every(g => g.batti);

  // Rakibin bilebileceği hali (AI buna bakar, gemi yerlerini görmez):
  // hucre[s*n+k]: '?' bilinmiyor · 'o' ıska · 'x' vurulmuş ama batmamış · '#' batmış gemi
  G.gorunum = function (t) {
    const hucre = new Array(t.n * t.n);
    for (let i = 0; i < hucre.length; i++) {
      const a = t.atis[i];
      if (a === 0) hucre[i] = '?';
      else if (a === 2) hucre[i] = t.gemiler[t.gemiHaritasi[i]].batti ? '#' : 'x';
      else hucre[i] = 'o';
    }
    const kalanUzunluklar = t.gemiler.filter(g => !g.batti).map(g => g.uzunluk).sort((a, b) => b - a);
    return { n: t.n, hucre, kalanUzunluklar };
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).game = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
