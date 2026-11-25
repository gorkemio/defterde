// rules.js — Sayı Bulma kuralları. DOM'a, window'a ve Kit'e bakmaz; tarayıcıda SB.rules, node'da module.exports.
//
// Sayı: hane kadar rakam (3 · 4 · 5); varsayılan rakamlar farklı ve ilk hane 0 değil (ayar: tekrar, sifirBaslar).
// Cevap: + (arti) = aynı rakam aynı yerde, − (eksi) = sayıda olan ama başka yerdeki rakam. Tekrarlı ayarda çoklu küme
// sayımı (standart Bulls and Cows): ortak = Σ min(gizlideki sayısı, tahmindeki sayısı), eksi = ortak − arti.
// Küme: bir ayardaki bütün geçerli sayılar, indeksle (0 … boyut−1). Rakamlar D'de (Uint8Array, hane×boyut), farklı
// rakamlı ayarda rakam varlık maskesi MK'de (Uint16Array). Cevap kodu: arti·(hane+1) + eksi; kazanma kodu hane·(hane+1).
(function () {
  'use strict';

  const R = {};

  /* ---------- tohumlu rastgele ---------- */

  // FNV-1a: metinden 32 bit
  R.karma = function (...p) {
    let h = 2166136261;
    const s = p.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // mulberry32: aynı tohum aynı dizi
  R.rng = function (tohum) {
    let a = (typeof tohum === 'number' ? tohum : R.karma(tohum)) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- ayar ---------- */

  R.VARSAYILAN = { hane: 4, tekrar: false, sifirBaslar: false };
  R.ayar = function (k = {}) {
    const hane = [3, 4, 5].includes(k.hane) ? k.hane : 4;
    return { hane, tekrar: !!k.tekrar, sifirBaslar: !!k.sifirBaslar };
  };
  const ayarAnahtari = (a) => `${a.hane}${a.tekrar ? 't' : 'f'}${a.sifirBaslar ? 's' : 'n'}`;

  /* ---------- küme ---------- */

  const kumeler = new Map();
  R.kume = function (ayarGirdi) {
    const a = R.ayar(ayarGirdi), anahtar = ayarAnahtari(a);
    let k = kumeler.get(anahtar);
    if (k) return k;
    const H = a.hane, ust = 10 ** H, liste = [];
    const r = new Uint8Array(H);
    for (let n = 0; n < ust; n++) {
      let m = n, gorulen = 0, iyi = true;
      for (let i = H - 1; i >= 0; i--) { r[i] = m % 10; m = (m - r[i]) / 10; }
      if (!a.sifirBaslar && r[0] === 0) continue;
      if (!a.tekrar) {
        for (let i = 0; i < H; i++) { const b = 1 << r[i]; if (gorulen & b) { iyi = false; break; } gorulen |= b; }
        if (!iyi) continue;
      }
      liste.push(n);
    }
    const boyut = liste.length;
    const D = new Uint8Array(boyut * H), MK = a.tekrar ? null : new Uint16Array(boyut);
    const sira = new Int32Array(ust).fill(-1);
    liste.forEach((n, j) => {
      let m = n, mk = 0;
      for (let i = H - 1; i >= 0; i--) { const d = m % 10; D[j * H + i] = d; mk |= 1 << d; m = (m - d) / 10; }
      if (MK) MK[j] = mk;
      sira[n] = j;
    });
    k = {
      ayar: a, hane: H, boyut, D, MK, kodSayisi: (H + 1) * (H + 1), kazanKodu: H * (H + 1),
      dize(j) { let s = ''; for (let i = 0; i < H; i++) s += D[j * H + i]; return s; },
      indeks(dize) { return /^\d+$/.test(dize) && dize.length === H ? sira[Number(dize)] : -1; },
      rakamlar(j) { return Array.from(D.subarray(j * H, j * H + H)); },
    };
    k.skor = skorlayici(k);
    kumeler.set(anahtar, k);
    return k;
  };

  // Kümenin iki elemanı arasındaki cevap kodu: skor(gizli, tahmin). Simetriktir. Çözücünün sıcak döngüsü.
  const BIT = new Uint8Array(1024);
  for (let i = 1; i < 1024; i++) BIT[i] = BIT[i >> 1] + (i & 1);
  function skorlayici(k) {
    const { D, MK, hane: H } = k, H1 = H + 1;
    if (MK) {
      if (H === 4) {
        return (a, b) => {
          const A = a * 4, B = b * 4;
          const arti = (D[A] === D[B] ? 1 : 0) + (D[A + 1] === D[B + 1] ? 1 : 0) + (D[A + 2] === D[B + 2] ? 1 : 0) + (D[A + 3] === D[B + 3] ? 1 : 0);
          return arti * 5 + BIT[MK[a] & MK[b]] - arti;
        };
      }
      return (a, b) => {
        const A = a * H, B = b * H;
        let arti = 0;
        for (let i = 0; i < H; i++) if (D[A + i] === D[B + i]) arti++;
        return arti * H1 + BIT[MK[a] & MK[b]] - arti;
      };
    }
    // Tekrarlı: her sayının rakam sayıları (CNT, 10'ar) ve farklı rakamları (UD, hane'şer, 255 = boş) önceden hesaplanır;
    // ortak = a'nın her farklı rakamı için min(a'daki sayısı, b'deki sayısı).
    const n = k.boyut, CNT = new Uint8Array(n * 10), UD = new Uint8Array(n * H).fill(255);
    for (let j = 0; j < n; j++) {
      let u = 0;
      for (let i = 0; i < H; i++) { const d = D[j * H + i]; if (CNT[j * 10 + d]++ === 0) UD[j * H + u++] = d; }
    }
    return (a, b) => {
      const A = a * H, B = b * H, A10 = a * 10, B10 = b * 10;
      let arti = 0, ortak = 0;
      for (let i = 0; i < H; i++) {
        if (D[A + i] === D[B + i]) arti++;
        const d = UD[A + i];
        if (d !== 255) { const x = CNT[A10 + d], y = CNT[B10 + d]; ortak += x < y ? x : y; }
      }
      return arti * H1 + ortak - arti;
    };
  }

  /* ---------- geçerlilik ve cevap ---------- */

  R.gecerli = function (dize, ayarGirdi) {
    const a = R.ayar(ayarGirdi);
    if (typeof dize !== 'string' || dize.length !== a.hane || !/^\d+$/.test(dize)) return false;
    if (!a.sifirBaslar && dize[0] === '0') return false;
    if (!a.tekrar && new Set(dize).size !== dize.length) return false;
    return true;
  };

  // Dizelerle cevap (tekrarlı rakamlarda da doğru). Sıra önemsiz: cevap(gizli, tahmin) = cevap(tahmin, gizli).
  R.cevap = function (gizli, tahmin) {
    let arti = 0, ortak = 0;
    const ca = new Array(10).fill(0), cb = new Array(10).fill(0);
    for (let i = 0; i < gizli.length; i++) {
      if (gizli[i] === tahmin[i]) arti++;
      ca[+gizli[i]]++; cb[+tahmin[i]]++;
    }
    for (let d = 0; d < 10; d++) ortak += Math.min(ca[d], cb[d]);
    return { arti, eksi: ortak - arti };
  };

  R.kod = (arti, eksi, hane) => arti * (hane + 1) + eksi;
  R.kodCoz = (kod, hane) => ({ arti: Math.floor(kod / (hane + 1)), eksi: kod % (hane + 1) });
  R.kazandi = (c, hane) => c.arti === hane;

  // Böyle bir cevap hiç olabilir mi? arti + eksi ≤ hane; (hane−1 artı, 1 eksi) hiçbir ayarda olamaz:
  // tek yanlış yerdeki rakam başka yerde eşleşemez, çünkü diğer bütün yerler zaten eşleşmiş.
  R.cevapMumkun = function (arti, eksi, ayarGirdi) {
    const H = R.ayar(ayarGirdi).hane;
    if (!Number.isInteger(arti) || !Number.isInteger(eksi) || arti < 0 || eksi < 0 || arti + eksi > H) return false;
    return !(arti === H - 1 && eksi === 1);
  };

  /* ---------- sayı üretimi ---------- */

  R.rastgeleSayi = function (ayarGirdi, r = Math.random) {
    const k = R.kume(ayarGirdi);
    return k.dize(Math.floor(r() * k.boyut));
  };

  // Günün sayısı: herkese aynı. Ayar sabit (4 hane, farklı rakam, sıfırla başlamaz). tarih: 'YYYY-MM-DD'
  R.gununSayisi = function (tarih) {
    return R.rastgeleSayi(R.VARSAYILAN, R.rng(R.karma('gun', tarih)));
  };

  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  R.AYLAR = AYLAR;
  R.yerelTarih = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  R.tarihYazi = (tarih) => { const [, a, g] = tarih.split('-').map(Number); return `${g} ${AYLAR[a - 1]}`; };
  // 'Sayı Bulma · 20 Ekim · 5 tahmin' — zorluk zor değilse sona eklenir (yardımlarla çözüldü).
  R.paylasimMetni = (tarih, tahmin, zorluk) =>
    `Sayı Bulma · ${R.tarihYazi(tarih)} · ${tahmin} tahmin` + (zorluk && zorluk !== 'zor' ? ` · ${zorluk}` : '');

  if (typeof window !== 'undefined') (window.SB = window.SB || {}).rules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})();
