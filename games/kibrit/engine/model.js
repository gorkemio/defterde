// engine/model.js — hücreler, yuvalar, tanıyıcı, şablonlar, durum, değerlendirici. DOM'a, window'a ve Kit'e bakmaz.
//
// Hücre başına bir bayt; her bit bir yuva (çöp var/yok).
//   R rakam : a0 b1 c2 d3 e4 f5 g6           (a üst, b sağ üst, c sağ alt, d alt, e sol alt, f sol üst, g orta)
//   I işlem : T0 M1 B2 V3 D1₄ D2₅             (üst/orta/alt yatay, dikey, "/" ve "\" çapraz)
//   M romen : I0 VL1 VR2 X1₃ X2₄ LV5 LB6     (orta dikey; altta birleşen V; kesişen X; L'nin dikeyi ve tabanı)
// Tek tanıyıcı: oyuncu, üretici, çözücü ve bilgisayar aynı TANI tablosunu kullanır.
(function () {
  'use strict';

  /* ---------- tanıma tabloları ---------- */
  const B = (...bitler) => bitler.reduce((m, b) => m | (1 << b), 0);
  const [a, b, c, d, e, f, g] = [0, 1, 2, 3, 4, 5, 6];
  const RAKAM = {                        // kanonik biçimler
    0: B(a, b, c, d, e, f), 1: B(b, c), 2: B(a, b, g, e, d), 3: B(a, b, g, c, d), 4: B(f, g, b, c),
    5: B(a, f, g, c, d), 6: B(a, f, g, e, d, c), 7: B(a, b, c), 8: B(a, b, c, d, e, f, g), 9: B(a, b, c, d, f, g),
  };
  const BIR_SOL = B(e, f);               // sola yaslı 1: geçerli ama kanonik değil
  const [T, M, Bt, V, D1, D2] = [0, 1, 2, 3, 4, 5];
  const ISLEM = { '-': B(M), '=': B(T, Bt), '+': B(M, V), '*': B(D1, D2), '/': B(D1) };
  const EKSI_YAN = [B(T), B(Bt)];        // üstte/altta tek yatay: eksi, kanonik değil
  const ROMEN = { I: B(0), V: B(1, 2), X: B(3, 4), L: B(5, 6) };

  const BITS = { R: 7, I: 6, M: 7 };
  const TANI = { R: new Array(128).fill(null), I: new Array(64).fill(null), M: new Array(128).fill(null) };
  const KANONIK = { R: new Array(128).fill(false), I: new Array(64).fill(false), M: new Array(128).fill(false) };
  for (const k in RAKAM) { TANI.R[RAKAM[k]] = k; KANONIK.R[RAKAM[k]] = true; }
  TANI.R[BIR_SOL] = '1';
  TANI.R[0] = ' '; KANONIK.R[0] = true;            // boş: yalnız şablon izin verirse geçerli
  for (const k in ISLEM) { TANI.I[ISLEM[k]] = k; KANONIK.I[ISLEM[k]] = true; }
  EKSI_YAN.forEach(m => { TANI.I[m] = '-'; });
  for (const k in ROMEN) { TANI.M[ROMEN[k]] = k; KANONIK.M[ROMEN[k]] = true; }
  TANI.M[0] = ' '; KANONIK.M[0] = true;

  const POP = new Uint8Array(128);
  for (let i = 1; i < 128; i++) POP[i] = POP[i >> 1] + (i & 1);

  /* ---------- şablonlar ---------- */
  // Kimlik: sayı genişlikleri ve işlem deseni. '2+1=2' → [R][R] [İ] [R] [İ] [R][R]. 'rom:2+1=2' romen hücreli.
  // İşlem karakterleri ASCII: + - x / =
  const onbellek = new Map();
  function sablon(id) {
    let s = onbellek.get(id);
    if (s) return s;
    const romen = id.startsWith('rom:');
    const govde = romen ? id.slice(4) : id;
    const sayilar = [], islemler = [], hucreler = [];
    let i = 0;
    while (i < govde.length) {
      const ch = govde[i];
      if (/[1-9]/.test(ch)) {
        const w = Number(ch), no = sayilar.length;
        const bas = hucreler.length;
        for (let j = 0; j < w; j++) hucreler.push({ tur: romen ? 'M' : 'R', sayi: no, sira: j, bos: j < w - 1 });
        sayilar.push({ basamak: w, bas, son: bas + w - 1 });
      } else {
        const op = ch === 'x' ? '*' : ch;
        if (!'+-*/='.includes(op)) throw new Error('Şablon: bilinmeyen işaret ' + ch);
        islemler.push(op);
        hucreler.push({ tur: 'I', islem: islemler.length - 1 });
      }
      i++;
    }
    s = { id, romen, sayilar, islemler, hucreler, hucreSayisi: hucreler.length };
    onbellek.set(id, s);
    return s;
  }

  // Havuzun şablon listesi. Hedef tutmazsa genişletilir (Faz 3 raporu).
  const SABLONLAR = [
    '1+1=1', '1+1=2', '2+1=2', '1+2=2', '2+2=2',
    '1-1=1', '2-1=1', '2-1=2', '2-2=1', '2-2=2',
    '1x1=1', '1x1=2', '2x1=2', '1x2=2',
    '1/1=1', '2/1=1', '2/1=2', '2/2=1',
    '1+1+1=1', '1+1+1=2', '2+1+1=2', '1+1-1=1', '2+1-1=2', '2-1-1=1', '2-1+1=2',
    '1+1=1+1', '1+1=2-1', '2-1=1+1', '1-1=1-1', '2+1=2+1', '2-1=2-1',
    '1x1+1=2', '1x1-1=1', '2/1+1=2', '1x1=1+1', '1+1x1=2', '2-1x1=1', '1x1=2-1',
    '2+2=3', '2x2=3', '3-2=2', '2x1=3', '3/2=2',
  ];
  const SABLONLAR_ROMEN = [
    'rom:1+1=1', 'rom:2+1=2', 'rom:1+2=2', 'rom:2+2=2', 'rom:2-1=1', 'rom:2-1=2', 'rom:3-1=2', 'rom:2+1=3', 'rom:1+2=3',
    'rom:3-2=1', 'rom:3+1=3', 'rom:1+3=3', 'rom:3+2=3', 'rom:2+3=3', 'rom:3-1=3', 'rom:3-2=2', 'rom:3-3=1', 'rom:2+2=3',
    'rom:2x1=2', 'rom:1x2=2', 'rom:2x1=3', 'rom:1+1+1=2', 'rom:2+1-1=2', 'rom:1+1=1+1', 'rom:2-1=1+1',
    'rom:1+1=2', 'rom:4-1=3', 'rom:4-2=2', 'rom:4-3=1', 'rom:1+2+1=3', 'rom:3-1-1=1',
  ];

  /* ---------- durum ---------- */
  const hex2 = (v) => (v < 16 ? '0' : '') + v.toString(16);
  function durum(sablonId, bayt) {
    const s = sablon(sablonId);
    return { sablon: s, bayt: bayt ? Uint8Array.from(bayt) : new Uint8Array(s.hucreSayisi) };
  }
  function maske(d) { let h = ''; for (const v of d.bayt) h += hex2(v); return h; }
  function maskeOku(sablonId, hex) {
    const s = sablon(sablonId);
    const bayt = new Uint8Array(s.hucreSayisi);
    for (let i = 0; i < s.hucreSayisi; i++) bayt[i] = parseInt(hex.substr(i * 2, 2), 16);
    return { sablon: s, bayt };
  }
  const kanonikDize = (d) => d.sablon.id + ':' + maske(d);
  function dizeOku(dize) { const i = dize.lastIndexOf(':'); return maskeOku(dize.slice(0, i), dize.slice(i + 1)); }
  const kopya = (d) => ({ sablon: d.sablon, bayt: Uint8Array.from(d.bayt) });

  // Metinden durum (kanonik biçimlerle): '6+4=4' ya da '13-5=8'; boşluk = boş hücre. Romen: 'VI+IV=X'.
  function yaz(sablonId, metin) {
    const s = sablon(sablonId);
    const bayt = new Uint8Array(s.hucreSayisi);
    let k = 0;
    // metni şablon hücrelerine dağıt: sayılar sağa yaslı
    const parca = [];
    let cur = '';
    for (const ch of metin) {
      if ('+-*/=x×÷−'.includes(ch)) { parca.push(cur); parca.push(ch); cur = ''; } else cur += ch;
    }
    parca.push(cur);
    let ni = 0;
    for (const p of parca) {
      if (p.length === 1 && '+-*/=x×÷−'.includes(p)) {
        const op = { 'x': '*', '×': '*', '÷': '/', '−': '-' }[p] || p;
        bayt[k++] = ISLEM[op];
      } else {
        const sy = s.sayilar[ni++];
        const metinS = p.padStart(sy.basamak, ' ');
        if (metinS.length !== sy.basamak) throw new Error('Sayı şablona sığmıyor: ' + p);
        for (const ch of metinS) {
          if (ch === ' ') bayt[k++] = 0;
          else bayt[k++] = s.romen ? ROMEN[ch] : RAKAM[ch];
        }
      }
    }
    if (k !== s.hucreSayisi) throw new Error('Metin şablona uymuyor: ' + metin);
    return { sablon: s, bayt };
  }

  /* ---------- okuma ve değerlendirme ---------- */
  // Romen sayısı: standart yazım, ≤ 50
  const ROMEN_DEG = { I: 1, V: 5, X: 10, L: 50 };
  const ROMEN_RE = /^(L|XL|X{1,3}|)(IX|IV|V?I{0,3})$/;
  function romenDeger(str) {
    if (!str || !ROMEN_RE.test(str)) return null;
    let v = 0;
    for (let i = 0; i < str.length; i++) {
      const x = ROMEN_DEG[str[i]], y = ROMEN_DEG[str[i + 1]] || 0;
      v += x < y ? -x : x;
    }
    return v >= 1 && v <= 50 ? v : null;
  }

  // Hücre karakterleri ve sözdizimi. Döner { hucreler, sayilar (değer), islemler, gecerli, hata, metin }
  function oku(dr) {
    const s = dr.sablon, by = dr.bayt;
    const hucreler = new Array(s.hucreSayisi);
    for (let i = 0; i < s.hucreSayisi; i++) {
      const h = s.hucreler[i];
      const ch = TANI[h.tur][by[i]];
      if (ch === null || ch === undefined) return { gecerli: false, hata: 'hucre', hucre: i };
      hucreler[i] = ch;
    }
    return okuKarakter(s, hucreler);
  }
  function okuKarakter(s, hucreler) {
    const sayilar = [], islemler = [];
    let esit = 0, metin = '';
    for (const sy of s.sayilar) {
      let str = '', bosBitti = false;
      for (let i = sy.bas; i <= sy.son; i++) {
        const ch = hucreler[i];
        if (ch === ' ') {
          if (bosBitti || !s.hucreler[i].bos) return { gecerli: false, hata: 'bos', hucre: i };
        } else { bosBitti = true; str += ch; }
      }
      if (!str) return { gecerli: false, hata: 'bos', hucre: sy.son };
      let v;
      if (s.romen) { v = romenDeger(str); if (v === null) return { gecerli: false, hata: 'romen' }; }
      else {
        if (str.length > 1 && str[0] === '0') return { gecerli: false, hata: 'sifir' };
        v = Number(str);
      }
      sayilar.push({ str, v });
    }
    let ni = 0;
    for (let i = 0; i < s.hucreSayisi; i++) {
      const h = s.hucreler[i];
      if (h.tur === 'I') {
        const op = hucreler[i];
        if (op === '=') esit++;
        islemler.push(op);
      }
    }
    if (esit !== 1) return { gecerli: false, hata: 'esit' };
    for (let i = 0; i < sayilar.length; i++) { metin += sayilar[i].str; if (i < islemler.length) metin += islemler[i]; }
    return { gecerli: true, hucreler, sayilar: sayilar.map(x => x.v), islemler, metin };
  }

  // Bir taraf: önce × ve ÷ (soldan sağa, tam bölme), sonra + ve − (hiçbir ara sonuç negatif değil). Geçersizse null.
  function taraf(say, isl) {
    const terim = [say[0]], isaret = [];
    for (let i = 0; i < isl.length; i++) {
      const op = isl[i], n = say[i + 1];
      if (op === '*') terim[terim.length - 1] *= n;
      else if (op === '/') {
        if (n === 0) return null;
        const t = terim[terim.length - 1];
        if (t % n !== 0) return null;
        terim[terim.length - 1] = t / n;
      } else { isaret.push(op); terim.push(n); }
    }
    let v = terim[0];
    for (let j = 0; j < isaret.length; j++) {
      v = isaret[j] === '+' ? v + terim[j + 1] : v - terim[j + 1];
      if (v < 0) return null;
    }
    return v;
  }
  // Soldan sağa, öncelik yok (zorluk etiketi "öncelik gerekir" için)
  function tarafSirasiz(say, isl) {
    let v = say[0];
    for (let i = 0; i < isl.length; i++) {
      const n = say[i + 1], op = isl[i];
      if (op === '+') v += n; else if (op === '-') v -= n; else if (op === '*') v *= n;
      else { if (n === 0 || v % n !== 0) return null; v /= n; }
    }
    return v;
  }
  function ayir(okuma) {
    const k = okuma.islemler.indexOf('=');
    return {
      solS: okuma.sayilar.slice(0, k + 1), solI: okuma.islemler.slice(0, k),
      sagS: okuma.sayilar.slice(k + 1), sagI: okuma.islemler.slice(k + 1),
    };
  }
  function degerlendir(okuma) {
    if (!okuma.gecerli) return { gecerli: false, dogru: false, sol: null, sag: null };
    const p = ayir(okuma);
    const sol = taraf(p.solS, p.solI), sag = taraf(p.sagS, p.sagI);
    if (sol === null || sag === null) return { gecerli: false, dogru: false, sol, sag, hata: 'hesap' };
    return { gecerli: true, dogru: sol === sag, sol, sag };
  }
  const dogru = (dr) => degerlendir(oku(dr)).dogru;
  function oncelikGerekir(okuma) {
    const p = ayir(okuma);
    const a1 = tarafSirasiz(p.solS, p.solI), b1 = tarafSirasiz(p.sagS, p.sagI);
    return !(a1 !== null && b1 !== null && a1 === b1);
  }
  function kanonikMi(dr) {
    for (let i = 0; i < dr.sablon.hucreSayisi; i++) if (!KANONIK[dr.sablon.hucreler[i].tur][dr.bayt[i]]) return false;
    return true;
  }

  /* ---------- fark ve hamle ---------- */
  // Global yuva = hücre × 8 + bit
  function fark(bas, dr) {
    const kaldirilan = [], eklenen = [];
    for (let i = 0; i < bas.bayt.length; i++) {
      const x = bas.bayt[i], y = dr.bayt[i];
      if (x === y) continue;
      for (let bit = 0; bit < 7; bit++) {
        const m = 1 << bit;
        if ((x & m) && !(y & m)) kaldirilan.push(i * 8 + bit);
        if (!(x & m) && (y & m)) eklenen.push(i * 8 + bit);
      }
    }
    return { kaldirilan, eklenen };
  }
  // kategori: 'tek' 'iki' 'hepsini' (oynat), 'ekle', 'cikar', 'romen' (oynat, k=1). Döner { sayac, hak, dolu, asildi }
  function hakOf(kategori) {
    if (kategori === 'iki') return { k: 2, tur: 'oynat' };
    if (kategori === 'ekle') return { k: 1, tur: 'ekle' };
    if (kategori === 'cikar') return { k: 1, tur: 'cikar' };
    return { k: 1, tur: 'oynat' };
  }
  function hamle(fk, kategori) {
    const { k, tur } = hakOf(kategori);
    const r = fk.kaldirilan.length, a = fk.eklenen.length;
    const sayac = Math.max(r, a);
    const dolu = tur === 'oynat' ? (r === k && a === k) : tur === 'ekle' ? (r === 0 && a === 1) : (r === 1 && a === 0);
    return { sayac, hak: k, dolu, asildi: sayac > k || (sayac === k && !dolu) };
  }

  /* ---------- geometri ---------- */
  // Yuvaların yeri (çöp boyu L = 1 birim). Rakam hücresi L × 2L; işlem hücresi L genişlik; romen hücresi L genişlik, L boy.
  // Aralık: aynı sayının hücreleri arasında .18L, işlem hücresinin yanında .3L, romen harfleri arasında .12L.
  const GEO = {
    R: [[.5, 0, 0], [1, .5, 90], [1, 1.5, 90], [.5, 2, 0], [0, 1.5, 90], [0, .5, 90], [.5, 1, 0]],
    I: [[.5, .72, 0], [.5, 1, 0], [.5, 1.28, 0], [.5, 1, 90], [.5, 1, -45], [.5, 1, 45]],
    // Romen harfi bir çöp boyunda (y .5–1.5), hücre .72L: I ortada; V altta birleşen; X kesişen; L dikey + taban
    M: (() => {
      const cx = .36, ust = .5, alt = 1.5, yan = .28;
      const capraz = (x0, y0, x1, y1) => [(x0 + x1) / 2, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI];
      return [[cx, 1, 90], capraz(cx - yan, ust, cx, alt), capraz(cx + yan, ust, cx, alt),
        capraz(cx - yan, ust, cx + yan, alt), capraz(cx + yan, ust, cx - yan, alt), [cx - yan, 1, 90], [cx - yan + .46, 1.5, 0]];
    })(),
  };
  const GEN = { R: 1, I: 1, M: .72 };
  const ARALIK = { ayni: .18, islem: .3, romen: .1 };
  // L px ile yuvalar ve hücre kutuları. Döner { hucreler: [{ x, w, tur }], yuvalar: [{ yuva, hucre, bit, x, y, aci }], genislik, yukseklik }
  function yerlesim(sablonId, L = 1) {
    const s = sablon(sablonId);
    const hucreler = [], yuvalar = [];
    let x = 0;
    for (let i = 0; i < s.hucreSayisi; i++) {
      const h = s.hucreler[i];
      if (i > 0) {
        const once = s.hucreler[i - 1];
        x += (h.tur === 'I' || once.tur === 'I') ? ARALIK.islem : h.tur === 'M' ? ARALIK.romen : ARALIK.ayni;
      }
      const w = GEN[h.tur];
      hucreler.push({ x: x * L, w: w * L, tur: h.tur });
      GEO[h.tur].forEach(([gx, gy, aci], bit) => yuvalar.push({ yuva: i * 8 + bit, hucre: i, bit, x: (x + gx) * L, y: gy * L, aci }));
      x += w;
    }
    return { hucreler, yuvalar, genislik: x * L, yukseklik: 2 * L };
  }
  const genislikL = (sablonId) => yerlesim(sablonId, 1).genislik;

  /* ---------- tohum, tarih ---------- */
  function karma(...p) {
    const s = p.join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rng(tohum) {
    let t = (typeof tohum === 'number' ? tohum : karma(...[].concat(tohum))) >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function yerelTarih(t = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function tarihYazi(tarih) { const [, ay, gun] = tarih.split('-').map(Number); return `${gun} ${AYLAR[ay - 1]}`; }

  /* ---------- görünüm metni ---------- */
  const GORUNUM = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '=' };
  const gorunum = (metin) => metin.replace(/[-*/]/g, ch => GORUNUM[ch]).replace(/([+−×÷=])/g, ' $1 ');
  const SOZ = { '+': 'artı', '-': 'eksi', '*': 'çarpı', '/': 'bölü', '=': 'eşittir' };
  const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  function sayiOku(n) {
    if (n === 0) return 'sıfır';
    let s = '';
    const yuz = Math.floor(n / 100), on = Math.floor(n / 10) % 10, bir = n % 10;
    if (yuz) s += (yuz > 1 ? BIRLER[yuz] + ' ' : '') + 'yüz ';
    if (on) s += ONLAR[on] + ' ';
    if (bir) s += BIRLER[bir];
    return s.trim();
  }
  // Ekran okuyucu: "beş artı üç eşittir altı" (romen sayıları değeriyle okunur)
  function sesli(okuma) {
    if (!okuma.gecerli) return 'geçersiz eşitlik';
    const p = [];
    okuma.sayilar.forEach((v, i) => { p.push(sayiOku(v)); if (i < okuma.islemler.length) p.push(SOZ[okuma.islemler[i]]); });
    return p.join(' ');
  }

  const Mo = {
    RAKAM, ISLEM, ROMEN, BIR_SOL, EKSI_YAN, TANI, KANONIK, BITS, POP,
    sablon, SABLONLAR, SABLONLAR_ROMEN, durum, maske, maskeOku, kanonikDize, dizeOku, kopya, yaz,
    oku, okuKarakter, degerlendir, dogru, taraf, tarafSirasiz, oncelikGerekir, kanonikMi, romenDeger,
    fark, hamle, hakOf, yerlesim, genislikL, GEO, GEN, ARALIK,
    karma, rng, yerelTarih, tarihYazi, gorunum, sesli, sayiOku,
  };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).model = Mo;
  if (typeof module !== 'undefined' && module.exports) module.exports = Mo;
})();
