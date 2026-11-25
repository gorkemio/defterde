// game.js — saf oyun mantığı. DOM'a dokunmaz; tarayıcıda AB.game, node'da module.exports.
//
// oyun = {
//   n, ayar: { zar:[en az, en çok], bitisiklik, hesap:{acik,deneme,ceza}, bitisPas },
//   hucre: Int16Array(n*n)        // -1 boş, değilse dikdörtgen id (indeks = s*n + k)
//   dikdortgenler: [{ id, sahip:'ben'|'rakip', s, k, w, h, alan, zar:[a,b] }]   // w sütun, h satır
//   sayi: { ben, rakip }          // sahip başına dikdörtgen sayısı
//   sira, asama: 'zar'|'hesap'|'yerlestir'|'pas'|'bitti', zar: null|{a,b}, hak,
//   puan: { ben, rakip }, ardisikPas, tur,
//   gecmis: [{ tur, sahip, zar, olay:'cizdi'|'pas'|'yanlis'|'sure', dik?, alan?, cevap? }],
//   kazanan: null|'ben'|'rakip'|'berabere'
// }
// s = satır (0..n-1), k = sütun (0..n-1).
(function () {
  'use strict';

  const G = {};
  const rakibi = (sahip) => (sahip === 'ben' ? 'rakip' : 'ben');

  // Tohumlu rastgele sayı üreteci (mulberry32): testlerde aynı tohum aynı oyunu verir.
  G.rng = function (tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  G.yeniOyun = function (config) {
    const n = config.boyut;
    return {
      n,
      ayar: {
        zar: config.zar.slice(),
        bitisiklik: !!config.bitisiklik,
        hesap: { ...config.hesap },
        bitisPas: config.bitisPas || 2,
      },
      hucre: new Int16Array(n * n).fill(-1),
      dikdortgenler: [],
      sayi: { ben: 0, rakip: 0 },
      sira: config.ilkBaslayan === 'rakip' ? 'rakip' : 'ben',
      asama: 'zar',
      zar: null,
      hak: 0,
      puan: { ben: 0, rakip: 0 },
      ardisikPas: 0,
      tur: 0,
      gecmis: [],
      kazanan: null,
    };
  };

  // Başlangıç köşeleri (bitişiklik kuralı): ben sol üst, rakip sağ alt. Hücre indeksi döner.
  G.kose = (o, sahip) => (sahip === 'ben' ? 0 : o.n * o.n - 1);

  // (s,k)'den w×h kaplayan hücrelerin indeksleri
  G.hucreler = function (n, s, k, w, h) {
    const liste = [];
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) liste.push((s + i) * n + k + j);
    return liste;
  };

  G.bosHucre = function (o) {
    let say = 0;
    for (let i = 0; i < o.hucre.length; i++) if (o.hucre[i] === -1) say++;
    return say;
  };

  const sahibi = (o, i, sahip) => {
    const id = o.hucre[i];
    return id !== -1 && o.dikdortgenler[id].sahip === sahip;
  };

  // w×h dikdörtgen (s,k) köşesinden başlayarak sahip için geçerli mi?
  // Tahtada, hepsi boş; bitişiklik açıksa: ilk dikdörtgen kendi köşesini içerir, sonrakiler kendi alanına
  // kenardan (4-komşuluk) değer; alanı henüz olmayan rakibin köşesi yasak.
  G.yerlestirilebilir = function (o, s, k, w, h, sahip) {
    const n = o.n;
    if (w < 1 || h < 1 || s < 0 || k < 0 || s + h > n || k + w > n) return false;
    for (let i = s; i < s + h; i++) {
      for (let j = k; j < k + w; j++) if (o.hucre[i * n + j] !== -1) return false;
    }
    if (!o.ayar.bitisiklik) return true;

    const icerir = (idx) => {
      const si = Math.floor(idx / n), kj = idx % n;
      return si >= s && si < s + h && kj >= k && kj < k + w;
    };
    if (o.sayi[sahip] === 0) {
      if (!icerir(G.kose(o, sahip))) return false;
    } else {
      let degiyor = false;
      for (let j = k; j < k + w && !degiyor; j++) {
        degiyor = (s > 0 && sahibi(o, (s - 1) * n + j, sahip)) || (s + h < n && sahibi(o, (s + h) * n + j, sahip));
      }
      for (let i = s; i < s + h && !degiyor; i++) {
        degiyor = (k > 0 && sahibi(o, i * n + k - 1, sahip)) || (k + w < n && sahibi(o, i * n + k + w, sahip));
      }
      if (!degiyor) return false;
    }
    const r = rakibi(sahip);
    if (o.sayi[r] === 0 && icerir(G.kose(o, r))) return false;
    return true;
  };

  const yonler = (a, b) => (a === b ? [[a, b]] : [[a, b], [b, a]]);   // [w, h]; kare zarda tek yön

  // a×b için tüm geçerli yerleşimler (konum × yön): [{ s, k, w, h }]
  G.yerlesimler = function (o, a, b, sahip) {
    const liste = [];
    for (const [w, h] of yonler(a, b)) {
      for (let s = 0; s + h <= o.n; s++) {
        for (let k = 0; k + w <= o.n; k++) {
          if (G.yerlestirilebilir(o, s, k, w, h, sahip)) liste.push({ s, k, w, h });
        }
      }
    }
    return liste;
  };

  // İlk geçerli yerleşimde durur: pas tespiti için yerlesimler'den hızlı.
  G.sigarMi = function (o, a, b, sahip) {
    for (const [w, h] of yonler(a, b)) {
      for (let s = 0; s + h <= o.n; s++) {
        for (let k = 0; k + w <= o.n; k++) {
          if (G.yerlestirilebilir(o, s, k, w, h, sahip)) return true;
        }
      }
    }
    return false;
  };

  // Sırayı karşıya geçirir: yeni tur, zar bekleniyor.
  function sirayiGec(o) {
    o.sira = rakibi(o.sira);
    o.zar = null;
    o.hak = 0;
    o.asama = 'zar';
    o.tur++;
  }

  // Boş hücre kalmadıysa ya da art arda bitisPas kez pas geçildiyse oyun biter.
  G.bitisKontrol = function (o) {
    if (G.bosHucre(o) === 0 || o.ardisikPas >= o.ayar.bitisPas) {
      o.asama = 'bitti';
      o.zar = null;
      o.kazanan = o.puan.ben > o.puan.rakip ? 'ben' : o.puan.ben < o.puan.rakip ? 'rakip' : 'berabere';
    }
    return o.asama === 'bitti';
  };

  // Sıradaki oyuncu için zar atar. Sığıyorsa hesap (ya da doğrudan yerleştirme) aşamasına, sığmıyorsa 'pas'a geçer.
  // r: 0..1 arası rastgele sayı üreteci. Döner { a, b, sigar }.
  G.zarAt = function (o, r) {
    if (o.asama !== 'zar') throw new Error('Şimdi zar atılmaz: ' + o.asama);
    const [en, cok] = o.ayar.zar, m = cok - en + 1;
    const a = en + Math.floor(r() * m), b = en + Math.floor(r() * m);
    o.zar = { a, b };
    const sigar = G.sigarMi(o, a, b, o.sira);
    if (sigar) {
      o.asama = o.ayar.hesap.acik ? 'hesap' : 'yerlestir';
      o.hak = o.ayar.hesap.deneme;
    } else {
      o.asama = 'pas';
    }
    return { a, b, sigar };
  };

  // Çarpım cevabı. Döner { sonuc: 'dogru'|'tekrar'|'ceza'|'affedildi', dogruCevap, kalanHak }
  //   dogru     → yerleştirmeye geçilir
  //   tekrar    → hak kaldı, yeniden denenir
  //   ceza      → hak bitti, sıra karşıya geçer (pas sayılmaz, pas sayacı sıfırlanır)
  //   affedildi → hak bitti ama ceza kapalı: doğru cevap gösterilir, yine de çizilir
  G.cevapVer = function (o, cevap) {
    if (o.asama !== 'hesap') throw new Error('Şimdi cevap verilmez: ' + o.asama);
    const dogruCevap = o.zar.a * o.zar.b;
    if (Number(cevap) === dogruCevap && String(cevap).trim() !== '') {
      o.asama = 'yerlestir';
      return { sonuc: 'dogru', dogruCevap, kalanHak: o.hak };
    }
    o.hak--;
    if (o.hak > 0) return { sonuc: 'tekrar', dogruCevap, kalanHak: o.hak };
    if (!o.ayar.hesap.ceza) {
      o.asama = 'yerlestir';
      return { sonuc: 'affedildi', dogruCevap, kalanHak: 0 };
    }
    o.gecmis.push({ tur: o.tur, sahip: o.sira, zar: [o.zar.a, o.zar.b], olay: 'yanlis', cevap: String(cevap) });
    o.ardisikPas = 0;
    sirayiGec(o);
    G.bitisKontrol(o);
    return { sonuc: 'ceza', dogruCevap, kalanHak: 0 };
  };

  // Dikdörtgeni yerleştirir (w×h, a×b ya da b×a olmalı). Geçersizse hata fırlatır. Döner: eklenen dikdörtgen.
  G.yerlestir = function (o, s, k, w, h) {
    if (o.asama !== 'yerlestir') throw new Error('Şimdi yerleştirilmez: ' + o.asama);
    const { a, b } = o.zar;
    if (!((w === a && h === b) || (w === b && h === a))) throw new Error(`Ölçü zara uymuyor: ${w}×${h} (zar ${a}×${b})`);
    if (!G.yerlestirilebilir(o, s, k, w, h, o.sira)) throw new Error(`Buraya yerleştirilemez: ${s},${k} ${w}×${h}`);
    const d = { id: o.dikdortgenler.length, sahip: o.sira, s, k, w, h, alan: w * h, zar: [a, b] };
    o.dikdortgenler.push(d);
    for (const i of G.hucreler(o.n, s, k, w, h)) o.hucre[i] = d.id;
    o.sayi[d.sahip]++;
    o.puan[d.sahip] += d.alan;
    o.gecmis.push({ tur: o.tur, sahip: d.sahip, zar: [a, b], olay: 'cizdi', dik: { s, k, w, h }, alan: d.alan });
    o.ardisikPas = 0;
    sirayiGec(o);
    G.bitisKontrol(o);
    return d;
  };

  // "Yer yok" pası: sıra karşıya geçer, art arda pas sayacı artar (iki ardışık pas oyunu bitirir).
  G.pasGec = function (o) {
    if (o.asama === 'bitti') throw new Error('Oyun bitti');
    o.gecmis.push({ tur: o.tur, sahip: o.sira, zar: o.zar ? [o.zar.a, o.zar.b] : null, olay: 'pas' });
    o.ardisikPas++;
    sirayiGec(o);
    G.bitisKontrol(o);
  };

  // Hamle süresi doldu: sıra kaybedilir (yanlış cevap gibi). "Yer yok" pası değildir; art arda pas sayacını
  // sıfırlar, böylece oyuncuya yer varken süresi bitip ardından rakip pas geçince oyun bitmez.
  G.sureDoldu = function (o) {
    if (o.asama === 'bitti') throw new Error('Oyun bitti');
    o.gecmis.push({ tur: o.tur, sahip: o.sira, zar: o.zar ? [o.zar.a, o.zar.b] : null, olay: 'sure' });
    o.ardisikPas = 0;
    sirayiGec(o);
    G.bitisKontrol(o);
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).game = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
