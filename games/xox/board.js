// board.js — 5'li XOX kuralları. DOM'a, window'a, Kit'e bakmaz; tarayıcıda XOX.board, node'da require('./board.js').
// Durum değişmezdir: oyna / geriAl yeni durum döndürür. Taşlar seyrek Map'te: sınırsız sayfada negatif koordinat olur.
//
//   durum = {
//     ayar: { boyut: 15 | 0 (sınırsız), tamBes, hamleSiniri },
//     taslar: Map<anahtar, 1 | 2>,       // 1 = X, 2 = O
//     hamleler: [{ r, c, sembol }],
//     sira: 1 | 2, bitti, kazanan: 0 | 1 | 2 | 'berabere', besli: [[r, c], ...] | null,
//     sinir: { r1, c1, r2, c2 } | null,  // taşların kutusu
//     hash: { hi, lo },                  // Zobrist 64 bit (iki 32 bit yarı); sıra hash'e girmez (taş sayısından bellidir)
//   }
(function () {
  'use strict';

  const X = 1, O = 2;
  const OFS = 2048, CARP = 4096;               // anahtar = (r + 2048) · 4096 + (c + 2048); |r|, |c| < 2048
  const YONLER = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const SEMBOL = { 1: 'X', 2: 'O' };

  const anahtar = (r, c) => (r + OFS) * CARP + (c + OFS);
  const koordinat = (k) => [Math.floor(k / CARP) - OFS, (k % CARP) - OFS];
  const rakip = (s) => 3 - s;

  /* ---------- Zobrist: tablo yok, (anahtar, sembol) karıştırılarak türetilir ---------- */

  function karis(x) {                          // splitmix32 benzeri tam sayı karıştırıcı
    x = (x + 0x9e3779b9) | 0;
    x ^= x >>> 16; x = Math.imul(x, 0x21f0aaad);
    x ^= x >>> 15; x = Math.imul(x, 0x735a2d97);
    x ^= x >>> 15;
    return x >>> 0;
  }
  function zobrist(r, c, s) {
    const k = anahtar(r, c) * 2 + (s - 1);
    const lo = karis(k);
    return { hi: karis(lo ^ 0x5bd1e995 ^ k), lo };
  }

  /* ---------- yardımcılar ---------- */

  // mulberry32: tohumlu rastgele (testler, AI'nın rastgele seçimleri)
  function rng(tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Sütun harfi + satır numarası (üstten 1): "H8". Sabit tahtanın dışında kalan koordinat (sınırsız) "(r, c)".
  const HARFLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function hucreAdi(r, c) {
    if (r >= 0 && c >= 0 && c < HARFLER.length) return HARFLER[c] + (r + 1);
    return `(${r}, ${c})`;
  }

  function ayarYap(a = {}) {
    return {
      boyut: a.boyut === 0 || a.sinirsiz ? 0 : (a.boyut || 15),
      tamBes: !!a.tamBes,
      hamleSiniri: a.hamleSiniri || 300,
    };
  }

  /* ---------- durum ---------- */

  function yeniOyun(a) {
    return {
      ayar: ayarYap(a), taslar: new Map(), hamleler: [],
      sira: X, bitti: false, kazanan: 0, besli: null, sinir: null, hash: { hi: 0, lo: 0 },
    };
  }

  const tas = (d, r, c) => d.taslar.get(anahtar(r, c)) || 0;

  // Geçersizse nedeni, geçerliyse null
  function hamleHatasi(d, r, c) {
    if (d.bitti) return 'oyun bitti';
    if (!Number.isInteger(r) || !Number.isInteger(c)) return 'koordinat tam sayı değil';
    const n = d.ayar.boyut;
    if (n) { if (r < 0 || c < 0 || r >= n || c >= n) return 'tahtanın dışında'; }
    else if (Math.abs(r) >= OFS || Math.abs(c) >= OFS) return 'sayfanın dışında';
    if (d.taslar.has(anahtar(r, c))) return 'kare dolu';
    return null;
  }
  const gecerliMi = (d, r, c) => hamleHatasi(d, r, c) === null;

  // (r, c)'deki taştan geçen 4 doğruda art arda dizi. Okul kuralı: ≥ 5 kazanır (dizinin tamamı döner).
  // tamBes: yalnız tam 5. Kazanan dizi yoksa null.
  function kazananBul(d, r, c) {
    const s = tas(d, r, c);
    if (!s) return null;
    for (const [dr, dc] of YONLER) {
      let a = 0, b = 0;
      while (tas(d, r - (a + 1) * dr, c - (a + 1) * dc) === s) a++;
      while (tas(d, r + (b + 1) * dr, c + (b + 1) * dc) === s) b++;
      const uz = a + b + 1;
      if (uz === 5 || (uz > 5 && !d.ayar.tamBes)) {
        const dizi = [];
        for (let k = -a; k <= b; k++) dizi.push([r + k * dr, c + k * dc]);
        return dizi;
      }
    }
    return null;
  }

  function berabereMi(d) {
    const n = d.ayar.boyut;
    return n ? d.taslar.size >= n * n : d.hamleler.length >= d.ayar.hamleSiniri;
  }

  function sinirGenislet(s, r, c) {
    if (!s) return { r1: r, c1: c, r2: r, c2: c };
    return { r1: Math.min(s.r1, r), c1: Math.min(s.c1, c), r2: Math.max(s.r2, r), c2: Math.max(s.c2, c) };
  }
  function sinirHesapla(taslar) {
    let s = null;
    for (const k of taslar.keys()) { const [r, c] = koordinat(k); s = sinirGenislet(s, r, c); }
    return s;
  }

  // Sıradaki oyuncunun sembolünü (r, c)'ye yazar; yeni durum döner. Geçersiz hamle hata fırlatır.
  function oyna(d, r, c) {
    const hata = hamleHatasi(d, r, c);
    if (hata) throw new Error(`Geçersiz hamle ${hucreAdi(r, c)}: ${hata}`);
    const s = d.sira, z = zobrist(r, c, s);
    const taslar = new Map(d.taslar);
    taslar.set(anahtar(r, c), s);
    const y = {
      ayar: d.ayar, taslar,
      hamleler: d.hamleler.concat([{ r, c, sembol: s }]),
      sira: rakip(s), bitti: false, kazanan: 0, besli: null,
      sinir: sinirGenislet(d.sinir, r, c),
      hash: { hi: (d.hash.hi ^ z.hi) >>> 0, lo: (d.hash.lo ^ z.lo) >>> 0 },
    };
    const besli = kazananBul(y, r, c);
    if (besli) { y.bitti = true; y.kazanan = s; y.besli = besli; }
    else if (berabereMi(y)) { y.bitti = true; y.kazanan = 'berabere'; }
    return y;
  }

  // Son hamleyi kaldırır; oyun bitmişse yeniden açılır.
  function geriAl(d) {
    const son = d.hamleler[d.hamleler.length - 1];
    if (!son) throw new Error('Geri alınacak hamle yok');
    const taslar = new Map(d.taslar);
    taslar.delete(anahtar(son.r, son.c));
    const z = zobrist(son.r, son.c, son.sembol);
    return {
      ayar: d.ayar, taslar,
      hamleler: d.hamleler.slice(0, -1),
      sira: son.sembol, bitti: false, kazanan: 0, besli: null,
      sinir: sinirHesapla(taslar),
      hash: { hi: (d.hash.hi ^ z.hi) >>> 0, lo: (d.hash.lo ^ z.lo) >>> 0 },
    };
  }

  // Hamle listesinden durum (kayıt, analiz, testler). liste: [{ r, c }] ya da [[r, c], ...]
  function oynat(ayar, liste) {
    let d = yeniOyun(ayar);
    for (const h of liste) d = Array.isArray(h) ? oyna(d, h[0], h[1]) : oyna(d, h.r, h.c);
    return d;
  }

  // Hamle sırası olmadan doğrudan konum (bulmacalar, AI testleri). taslar: [{ r, c, sembol }]. sira verilmezse
  // taş sayısından (X fazlaysa O). Kazanma kontrolü yapılmaz.
  function konumKur(ayar, taslar, sira) {
    const d = yeniOyun(ayar);
    let x = 0, o = 0;
    for (const t of taslar) {
      const k = anahtar(t.r, t.c);
      if (d.taslar.has(k)) throw new Error('Aynı kare iki kez: ' + hucreAdi(t.r, t.c));
      d.taslar.set(k, t.sembol);
      const z = zobrist(t.r, t.c, t.sembol);
      d.hash = { hi: (d.hash.hi ^ z.hi) >>> 0, lo: (d.hash.lo ^ z.lo) >>> 0 };
      d.sinir = sinirGenislet(d.sinir, t.r, t.c);
      d.hamleler.push({ r: t.r, c: t.c, sembol: t.sembol });
      if (t.sembol === X) x++; else o++;
    }
    d.sira = sira || (x > o ? O : X);
    return d;
  }

  // Sayfada görünen alan { r0, c0, satir, sutun }. Sabit sayfada tahtanın tamamı. Sınırsızda taşların kutusu ± pay,
  // en az enAz × enAz (boş sayfada ortası 0,0); önceki alandan küçülmez (açılan kareler kapanmaz).
  function gorunurAlan(d, onceki, pay = 3, enAz = 15) {
    const n = d.ayar.boyut;
    if (n) return { r0: 0, c0: 0, satir: n, sutun: n };
    const s = d.sinir, y = Math.floor(enAz / 2);
    let [r1, c1, r2, c2] = s ? [s.r1 - pay, s.c1 - pay, s.r2 + pay, s.c2 + pay] : [-y, -y, enAz - 1 - y, enAz - 1 - y];
    const genislet = (a, b) => {
      const ek = enAz - (b - a + 1);
      return ek > 0 ? [a - Math.floor(ek / 2), b + Math.ceil(ek / 2)] : [a, b];
    };
    [r1, r2] = genislet(r1, r2);
    [c1, c2] = genislet(c1, c2);
    if (onceki) {
      r1 = Math.min(r1, onceki.r0); c1 = Math.min(c1, onceki.c0);
      r2 = Math.max(r2, onceki.r0 + onceki.satir - 1); c2 = Math.max(c2, onceki.c0 + onceki.sutun - 1);
    }
    const k = OFS - 1;
    r1 = Math.max(-k, r1); c1 = Math.max(-k, c1); r2 = Math.min(k, r2); c2 = Math.min(k, c2);
    return { r0: r1, c0: c1, satir: r2 - r1 + 1, sutun: c2 - c1 + 1 };
  }

  const B = {
    X, O, SEMBOL, YONLER, OFS,
    anahtar, koordinat, rakip, zobrist, rng, hucreAdi,
    yeniOyun, tas, hamleHatasi, gecerliMi, kazananBul, berabereMi, oyna, geriAl, oynat, konumKur, sinirHesapla, gorunurAlan,
  };

  if (typeof window !== 'undefined') (window.XOX = window.XOX || {}).board = B;
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})();
