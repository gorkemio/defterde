// game.js — saf oyun mantığı. DOM'a dokunmaz; tarayıcıda SOS.game, node'da module.exports.
//
// durum = {
//   n, fazlaTur,
//   hucre:    Int8Array(n*n)   // 0 boş · 1 S · 2 O
//   yazan:    Int8Array(n*n)   // -1 yok · 0 mavi (ben / 1. oyuncu) · 1 kırmızı (rakip / 2. oyuncu)
//   cizgiler: [{ hucreler: [a, b, c], sahip, anahtar }]   // a<b<c hücre indeksleri; anahtar "a,b,c"
//   puan: [mavi, kırmızı], sira: 0 | 1, bos, bitti,
//   son: null | { i, harf, sahip, yeni: [cizgi], fazla }  // son hamlenin özeti (çizim için)
// }
// Hücre indeksi i = satır * n + sütun. Durum DEĞİŞMEZDİR: placeLetter yeni bir durum döndürür, eskisine dokunmaz.
(function () {
  'use strict';

  const G = {};
  const S = 1, O = 2;
  G.HARF = { S, O };

  const YON8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const EKSEN4 = [[0, 1], [1, 0], [1, 1], [1, -1]];          // her eksenin ilk yarısı: (i - d) < i < (i + d)
  const SUTUN_HARFLERI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Tohumlu rastgele sayı üreteci (mulberry32): testlerde ve AI'nın rastgele seçimlerinde aynı tohum aynı diziyi verir.
  G.rng = function (tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const icinde = (n, r, c) => r >= 0 && c >= 0 && r < n && c < n;
  const kodla = (harf) => (harf === 'S' || harf === S ? S : harf === 'O' || harf === O ? O : 0);
  G.hucreAdi = (r, c) => SUTUN_HARFLERI[c] + (r + 1);          // (2, 6) -> "G3"
  G.harfAdi = (kod) => (kod === S ? 'S' : kod === O ? 'O' : '');

  /* ---------- kurulum ---------- */

  G.yeniOyun = function ({ boyut = 8, fazlaTur = true, ilkBaslayan = 0 } = {}) {
    if (!Number.isInteger(boyut) || boyut < 3 || boyut > 12) throw new RangeError(`Boyut 3–12 olmalı: ${boyut}`);
    return {
      n: boyut,
      fazlaTur: !!fazlaTur,
      hucre: new Int8Array(boyut * boyut),
      yazan: new Int8Array(boyut * boyut).fill(-1),
      cizgiler: [],
      puan: [0, 0],
      sira: ilkBaslayan === 1 ? 1 : 0,
      bos: boyut * boyut,
      bitti: false,
      son: null,
    };
  };

  // Hazır konum kurar (testler ve AI testleri için): satırlar 'S' 'O' '.' karakterlerinden oluşur.
  // Çizgi ve puan HESAPLAMAZ; yalnız harfleri koyar. Dolu hücrelerin yazanı 0 sayılır.
  G.durumdan = function (satirlar, { sira = 0, fazlaTur = true, puan = [0, 0] } = {}) {
    const n = satirlar.length;
    const d = G.yeniOyun({ boyut: n, fazlaTur, ilkBaslayan: sira });
    satirlar.forEach((satir, r) => {
      if (satir.length !== n) throw new Error('Konum kare olmalı');
      for (let c = 0; c < n; c++) {
        const kod = satir[c] === 'S' ? S : satir[c] === 'O' ? O : 0;
        if (kod) { d.hucre[r * n + c] = kod; d.yazan[r * n + c] = 0; d.bos--; }
      }
    });
    d.puan = puan.slice();
    d.bitti = d.bos === 0;
    return d;
  };

  /* ---------- SOS tespiti ---------- */

  const sirala3 = (a, b, c) => {
    if (a > b) [a, b] = [b, a];
    if (b > c) [b, c] = [c, b];
    if (a > b) [a, b] = [b, a];
    return [a, b, c];
  };

  // `harf`, i hücresine konsaydı tamamlanacak S-O-S üçlüleri (i hücresinin kendi içeriğine bakılmaz). Saf; AI de kullanır.
  //   S kondu: 8 yönün her birinde (i+d)=O ve (i+2d)=S.   O kondu: 4 eksenin her birinde (i-d)=S ve (i+d)=S.
  // Sınır kontrolü (satır, sütun) ile yapılır: düz indeks aritmetiği satır sonundan sonraki satıra "sarardı".
  G.sosBul = function (hucre, n, i, harf) {
    const kod = kodla(harf);
    const r = Math.floor(i / n), c = i % n, bulunan = [];
    if (kod === S) {
      for (const [dr, dc] of YON8) {
        const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
        if (!icinde(n, r2, c2)) continue;                    // (r2,c2) içindeyse (r1,c1) de içindedir
        const i1 = r1 * n + c1, i2 = r2 * n + c2;
        if (hucre[i1] === O && hucre[i2] === S) bulunan.push(sirala3(i, i1, i2));
      }
    } else if (kod === O) {
      for (const [dr, dc] of EKSEN4) {
        const ra = r - dr, ca = c - dc, rb = r + dr, cb = c + dc;
        if (!icinde(n, ra, ca) || !icinde(n, rb, cb)) continue;
        const a = ra * n + ca, b = rb * n + cb;
        if (hucre[a] === S && hucre[b] === S) bulunan.push(sirala3(a, i, b));
      }
    }
    return bulunan;
  };

  /* ---------- hamle ---------- */

  // Sıradaki oyuncu (r, c) hücresine harf yazar. Yeni durumu döndürür; `d` değişmez.
  // Her yeni SOS için 1 puan; aynı harfler birden fazla SOS'ta kullanılabilir. Yeni bulunan her üçlü az önce dolan
  // hücreyi içerdiği için eski çizgilerle çakışamaz; anahtar kümesi yalnız bir güvencedir. SOS yapan, fazlaTur
  // açıksa yine oynar.
  G.placeLetter = function (d, r, c, harf) {
    if (d.bitti) throw new Error('Oyun bitti');
    if (!Number.isInteger(r) || !Number.isInteger(c) || !icinde(d.n, r, c)) throw new RangeError(`Tahta dışı: ${r},${c}`);
    const kod = kodla(harf);
    if (!kod) throw new TypeError(`Harf 'S' ya da 'O' olmalı: ${harf}`);
    const i = r * d.n + c;
    if (d.hucre[i] !== 0) throw new Error(`Hücre dolu: ${G.hucreAdi(r, c)}`);

    const hucre = d.hucre.slice(), yazan = d.yazan.slice();
    hucre[i] = kod;
    yazan[i] = d.sira;

    const var_ = new Set(d.cizgiler.map(z => z.anahtar));
    const yeni = [];
    for (const uclu of G.sosBul(hucre, d.n, i, kod)) {
      const anahtar = uclu.join(',');
      if (var_.has(anahtar)) continue;
      var_.add(anahtar);
      yeni.push({ hucreler: uclu, sahip: d.sira, anahtar });
    }

    const puan = d.puan.slice();
    puan[d.sira] += yeni.length;
    const bos = d.bos - 1;
    const bitti = bos === 0;
    const fazla = d.fazlaTur && yeni.length > 0 && !bitti;
    return {
      n: d.n,
      fazlaTur: d.fazlaTur,
      hucre, yazan,
      cizgiler: d.cizgiler.concat(yeni),
      puan,
      sira: fazla ? d.sira : 1 - d.sira,
      bos, bitti,
      son: { i, harf: G.harfAdi(kod), sahip: d.sira, yeni, fazla },
    };
  };

  // Sıradaki oyuncunun şu an puan getiren hamleleri: [{ i, harf, adet }]
  G.puanlayanHamleler = function (d) {
    const liste = [];
    for (let i = 0; i < d.hucre.length; i++) {
      if (d.hucre[i] !== 0) continue;
      for (const harf of ['S', 'O']) {
        const adet = G.sosBul(d.hucre, d.n, i, harf).length;
        if (adet > 0) liste.push({ i, harf, adet });
      }
    }
    return liste;
  };

  /* ---------- güvenlik ---------- */

  // hucre dizisinde i'ye `kod` konduktan sonra, i'yi içeren 3'lü pencerelerden birinde rakip tek hamlede SOS yapabilir mi?
  //   S O _  (S yazar) · _ O S  (S yazar) · S _ S  (O yazar)
  // Yalnız i'yi içeren pencerelere bakılır: yeni bir fırsat ancak bu hamleyle doğar.
  function tehditVar(hucre, n, i, kod) {
    const r = Math.floor(i / n), c = i % n;
    const oku = (rr, cc) => (rr * n + cc === i ? kod : hucre[rr * n + cc]);
    for (const [dr, dc] of EKSEN4) {
      for (let k = 0; k < 3; k++) {                          // i, pencerenin k. hücresi
        const r0 = r - k * dr, c0 = c - k * dc;
        if (!icinde(n, r0, c0) || !icinde(n, r0 + 2 * dr, c0 + 2 * dc)) continue;
        const x = oku(r0, c0), y = oku(r0 + dr, c0 + dc), z = oku(r0 + 2 * dr, c0 + 2 * dc);
        const bosSayisi = (x === 0) + (y === 0) + (z === 0);
        if (bosSayisi !== 1) continue;
        if (x === 0 && y === O && z === S) return true;
        if (y === 0 && x === S && z === S) return true;
        if (z === 0 && x === S && y === O) return true;
      }
    }
    return false;
  }

  // Bu hamle rakibe tek hamlede tamamlayabileceği YENİ bir S-O-S üçlüsü açmıyorsa true.
  // Önceden var olan üçlüler sayılmaz: onlar bu hamlenin suçu değildir (puanlayanHamleler onları gösterir).
  G.isSafe = function (d, r, c, harf) {
    const kod = kodla(harf);
    const i = r * d.n + c;
    if (!kod || !icinde(d.n, r, c) || d.hucre[i] !== 0) throw new Error('Geçerli bir boş hücre ve harf verilmeli');
    return !tehditVar(d.hucre, d.n, i, kod);
  };

  // En az bir harfi güvenli olan boş hücre sayısı (AI paritesi için).
  G.guvenliSayisi = function (d) {
    let say = 0;
    for (let i = 0; i < d.hucre.length; i++) {
      if (d.hucre[i] !== 0) continue;
      if (!tehditVar(d.hucre, d.n, i, S) || !tehditVar(d.hucre, d.n, i, O)) say++;
    }
    return say;
  };

  /* ---------- sonuç ---------- */

  // Oyun bitmediyse null; bitince 0 (mavi), 1 (kırmızı) ya da 'berabere'.
  G.kazanan = function (d) {
    if (!d.bitti) return null;
    return d.puan[0] > d.puan[1] ? 0 : d.puan[1] > d.puan[0] ? 1 : 'berabere';
  };

  if (typeof window !== 'undefined') (window.SOS = window.SOS || {}).game = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
