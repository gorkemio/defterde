// eval.js — desen puanlama. DOM'a, window'a, Kit'e bakmaz; tarayıcıda XOX.eval, node'da require('./eval.js').
//
// Pencere: aramanın üzerinde çalıştığı yoğun tahta (Int8Array). Sabit sayfada tahtanın tamamı (kenar = duvar);
// sınırsızda taşların kutusu ± 13 (aday kareler kutu ± 8: pencerenin kenarı desen için duvar sayılır, desen bir taşın
// 4–5 kare ötesini görmeli). Dört yöndeki her doğru (uzunluk ≥ 5) numaralanır; koy / kaldır yalnız o kareden geçen
// 4 doğruyu yeniden puanlar (artımlı). Tam tarama (tamPuan) yalnız testte.
//
// Bir doğruda bir renk için desen: rakip taşı ve duvar doğruyu "koşu"lara böler; koşuda aralarında en çok 3 boş olan
// taşlar bir "grup"tur (4 boş: hiçbir 5'li pencere ikisini birden içermez). Grubun parçası [ilk − 4, son + 4] (koşuya
// kırpılır). Parçanın sınıfı tamamlama sayısıyla (ileri bakışla) bulunur:
//   tamamlama = konunca beş (tam beş ayarında: tam 5) oluşturan boş kare sayısı
//   BES        beş var
//   ACIK_DORT  tamamlama ≥ 2        _XXXX_ ; XXXX_XXXX gibi çift dört de durdurulamaz
//   DORT       tamamlama = 1        OXXXX_ , XX_XX , X_XXX , XXX_X
//   ACIK_UC    bir boşa konunca ACIK_DORT    __XXX__ , _XX_X_  (O_XXX_O değil: iki ucu da tek)
//   UC         bir boşa konunca DORT
//   ACIK_IKI   bir boşa konunca ACIK_UC ; IKI: bir boşa konunca UC ; BIR: yer var ; OLU: beşe yer yok
// Grup başına tek sınıf: aynı taşlar iki kez sayılmaz.
(function () {
  'use strict';

  const B = (typeof module !== 'undefined' && module.exports) ? require('./board.js') : window.XOX.board;

  const S = { OLU: 0, BIR: 1, IKI: 2, ACIK_IKI: 3, UC: 4, ACIK_UC: 5, DORT: 6, ACIK_DORT: 7, BES: 8 };
  const SINIF_ADI = ['olu', 'bir', 'iki', 'acikIki', 'uc', 'acikUc', 'dort', 'acikDort', 'bes'];

  /* ---------- puan tablosu: tek yer ---------- */
  // Değerler kendi kendine oyunla ayarlanır (Faz 4). Sıra: bir üst sınıf, alttakilerin makul toplamından belirgin büyük.
  const PUAN = [
    0,          // OLU
    8,          // BIR
    60,         // IKI
    400,        // ACIK_IKI   (iki ucu açık iki: bir hamlede açık üç)
    600,        // UC         (kapalı üç: bir hamlede dört)
    7000,       // ACIK_UC    (bir hamlede açık dört: rakip hemen kapatmalı)
    8000,       // DORT       (bir hamlede beş: rakip hemen kapatmalı)
    100000,     // ACIK_DORT  (durdurulamaz)
    10000000,   // BES
  ];
  // Çatallar: tek desenlerin toplamından belirgin yüksek (iki tehdit tek hamleyle kapatılamaz)
  const CATAL = {
    dortUc: 60000,      // dört + açık üç: dördü kapatan açık üçe yetişemez
    ucUc: 40000,        // iki açık üç
    dortDort: 80000,    // iki dört
  };
  const KAZANC = 1e8;             // arama: kesin kazanç (− ply)
  const YAKIN = 5e7;              // değerlendirme: sıradaki bir hamlede beş yapar
  const ACIK_UC_SIRASI = 2e5;     // sıradakinin açık üçü varken rakibin dördü yoksa açık dört yapar

  // Sayım dizini (renk başına): 0 bes, 1 acikDort, 2 dort, 3 acikUc, 4 uc
  const SAY_NO = [-1, -1, -1, -1, 4, 3, 2, 1, 0];
  const SAY_N = 5;

  /* ---------- tek parça sınıflandırma (ezberli) ---------- */

  const ezber = [new Map(), new Map()];   // [okul, tamBes]: parça anahtarı → sınıf

  function besVar(p, L, tam) {
    let k = 0;
    for (let j = 0; j <= L; j++) {
      if (j < L && p[j]) k++;
      else { if (tam ? k === 5 : k >= 5) return true; k = 0; }
    }
    return false;
  }
  function tamamlama(p, L, tam) {
    let n = 0;
    for (let j = 0; j < L; j++) {
      if (p[j]) continue;
      let a = 0, b = 0;
      while (j - a - 1 >= 0 && p[j - a - 1]) a++;
      while (j + b + 1 < L && p[j + b + 1]) b++;
      const t = a + b + 1;
      if (tam ? t === 5 : t >= 5) n++;
    }
    return n;
  }
  // p: 0/1 dizisi (1 = renk taşı), L ≤ 52. Yerinde değiştirip geri koyar.
  function siniflandir(p, L, tam) {
    let anahtar = 1;
    for (let j = 0; j < L; j++) anahtar = anahtar * 2 + p[j];
    const E = ezber[tam ? 1 : 0];
    const m = E.get(anahtar);
    if (m !== undefined) return m;
    let s;
    if (besVar(p, L, tam)) s = S.BES;
    else {
      const t = tamamlama(p, L, tam);
      if (t >= 2) s = S.ACIK_DORT;
      else if (t === 1) s = S.DORT;
      else {
        let acik = false, uc = false, bos = false, tas = false;
        for (let e = 0; e < L; e++) {
          if (p[e]) { tas = true; continue; }
          bos = true;
          p[e] = 1; const t2 = tamamlama(p, L, tam); p[e] = 0;
          if (t2 >= 2) { acik = true; break; }
          if (t2 === 1) uc = true;
        }
        if (acik) s = S.ACIK_UC;
        else if (uc) s = S.UC;
        else {
          let en = 0;
          for (let e = 0; e < L && en < S.ACIK_IKI; e++) {
            if (p[e]) continue;
            p[e] = 1; const k = siniflandir(p, L, tam); p[e] = 0;
            if (k === S.ACIK_UC) en = S.ACIK_IKI;
            else if (k === S.UC && en < S.IKI) en = S.IKI;
          }
          s = en || (tas && bos && L >= 5 ? S.BIR : S.OLU);
        }
      }
    }
    E.set(anahtar, s);
    return s;
  }

  /* ---------- bir doğruda bir rengin desenleri ---------- */

  // DEGER: bir doğrunun değerleri (sınırsız sayfada pencere 4096 kareye kadar uzayabilir), PARCA: tek parça
  const DEGER = new Int8Array(4096), PARCA = new Uint8Array(64);

  // v: doğrunun değerleri (DEGER, uzunluk L), s: renk. say: sayım dizisi (ofs'tan), dön: puan. gorev: her parça için çağrılır
  function dogruPuani(L, s, tam, say, ofs, gorev) {
    const o = 3 - s;
    let puan = 0, j = 0;
    while (j < L) {
      if (DEGER[j] === o) { j++; continue; }
      const a = j;
      while (j < L && DEGER[j] !== o) j++;
      const b = j;                                     // koşu [a, b)
      if (b - a < 5) continue;
      let k = a;
      while (k < b) {
        if (DEGER[k] !== s) { k++; continue; }
        const ilk = k;
        let son = k, m = k + 1;
        while (m < b) { if (DEGER[m] === s) { if (m - son <= 4) son = m; else break; } m++; }
        k = m;
        const ps = Math.max(a, ilk - 4), pe = Math.min(b - 1, son + 4), n = pe - ps + 1;
        if (n < 5) continue;
        for (let t = 0; t < n; t++) PARCA[t] = DEGER[ps + t] === s ? 1 : 0;
        const c = n <= 52 ? siniflandir(PARCA, n, tam) : S.ACIK_DORT;
        puan += PUAN[c];
        if (say && SAY_NO[c] >= 0) say[ofs + SAY_NO[c]]++;
        if (gorev) gorev(c, ps, pe);
      }
    }
    return puan;
  }

  // Test ve not için: tek satır dizesinde (X'in gözünden) parça sınıfları. '.' boş, 'X', 'O', '|' duvar.
  function satirSiniflari(dize, tam = false) {
    const t = dize.replace(/\s+/g, '').replace(/_/g, '.');
    let L = 0;
    for (const ch of t) DEGER[L++] = ch === 'X' ? 1 : ch === 'O' || ch === '|' ? 2 : 0;
    const siniflar = [];
    dogruPuani(L, 1, tam, null, 0, (c) => siniflar.push(SINIF_ADI[c]));
    return siniflar;
  }

  /* ---------- pencere ---------- */

  const YON = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function pencereKur(durum, o = {}) {
    const n = durum.ayar.boyut, tam = !!durum.ayar.tamBes;
    let r0, c0, H, W, ar1, ac1, ar2, ac2;
    if (n) { r0 = 0; c0 = 0; H = W = n; ar1 = 0; ac1 = 0; ar2 = n - 1; ac2 = n - 1; }
    else {
      const s = durum.sinir || { r1: 0, c1: 0, r2: 0, c2: 0 };
      const m = o.pay ?? 13, am = o.adayPay ?? 8;
      r0 = s.r1 - m; c0 = s.c1 - m; H = s.r2 - s.r1 + 1 + 2 * m; W = s.c2 - s.c1 + 1 + 2 * m;
      ar1 = m - am; ac1 = m - am; ar2 = H - 1 - (m - am); ac2 = W - 1 - (m - am);
    }
    const N = H * W;
    // doğrular
    const hucreler = [], basla = [], uzun = [];
    const hDogru = new Int32Array(N * 4).fill(-1);
    YON.forEach(([dr, dc], d) => {
      const baslar = [];
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const pr = r - dr, pc = c - dc;
        if (pr < 0 || pr >= H || pc < 0 || pc >= W) baslar.push([r, c]);
      }
      for (const [r, c] of baslar) {
        const liste = [];
        for (let rr = r, cc = c; rr >= 0 && rr < H && cc >= 0 && cc < W; rr += dr, cc += dc) liste.push(rr * W + cc);
        if (liste.length < 5) continue;
        const id = basla.length;
        basla.push(hucreler.length); uzun.push(liste.length);
        liste.forEach((i) => { hDogru[i * 4 + d] = id; });
        hucreler.push(...liste);
      }
    });
    const nl = basla.length;
    const P = {
      W, H, r0, c0, N, tam, ar1, ac1, ar2, ac2,
      h: new Int8Array(N), kom: new Uint8Array(N),
      dc: Int32Array.from(hucreler), dBas: Int32Array.from(basla), dUz: Int32Array.from(uzun), hDogru,
      dPuan: new Float64Array(nl * 3), dSay: new Int16Array(nl * 3 * SAY_N),
      top: new Float64Array(3), say: new Int32Array(3 * SAY_N),
      hi: 0, lo: 0, tasSay: 0,
      bb: null, bbYigin: [],
      yonEzber: tam ? YON_EZBER[1] : YON_EZBER[0],
    };
    for (const [k, s] of durum.taslar) {
      const [r, c] = B.koordinat(k);
      const rr = r - r0, cc = c - c0;
      if (rr < 0 || rr >= H || cc < 0 || cc >= W) continue;
      koy(P, rr * W + cc, s);
    }
    P.bbYigin.length = 0;
    return P;
  }

  const hucre = (P, r, c) => (r - P.r0) * P.W + (c - P.c0);          // dünya → pencere dizini
  const koord = (P, i) => [Math.floor(i / P.W) + P.r0, (i % P.W) + P.c0];
  const anahtarI = (P, i) => B.anahtar(Math.floor(i / P.W) + P.r0, (i % P.W) + P.c0);

  function dogruGuncelle(P, l) {
    const bas = P.dBas[l], L = P.dUz[l];
    for (let j = 0; j < L; j++) DEGER[j] = P.h[P.dc[bas + j]];
    for (let s = 1; s <= 2; s++) {
      const ofs = (l * 3 + s) * SAY_N, so = s * SAY_N;
      P.top[s] -= P.dPuan[l * 3 + s];
      for (let k = 0; k < SAY_N; k++) { P.say[so + k] -= P.dSay[ofs + k]; P.dSay[ofs + k] = 0; }
      const p = dogruPuani(L, s, P.tam, P.dSay, ofs, null);
      P.dPuan[l * 3 + s] = p;
      P.top[s] += p;
      for (let k = 0; k < SAY_N; k++) P.say[so + k] += P.dSay[ofs + k];
    }
  }

  function komsuEkle(P, i, k) {
    const r = Math.floor(i / P.W), c = i % P.W;
    for (let dr = -2; dr <= 2; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= P.H) continue;
      for (let dc = -2; dc <= 2; dc++) {
        const cc = c + dc;
        if (cc < 0 || cc >= P.W) continue;
        P.kom[rr * P.W + cc] += k;
      }
    }
  }

  function koy(P, i, s) {
    P.h[i] = s;
    for (let d = 0; d < 4; d++) { const l = P.hDogru[i * 4 + d]; if (l >= 0) dogruGuncelle(P, l); }
    komsuEkle(P, i, 1);
    const [r, c] = koord(P, i), z = B.zobrist(r, c, s);
    P.hi = (P.hi ^ z.hi) >>> 0; P.lo = (P.lo ^ z.lo) >>> 0;
    P.tasSay++;
    P.bbYigin.push(P.bb);
    const rr = r - P.r0, cc = c - P.c0, b = P.bb;
    P.bb = b ? [Math.min(b[0], rr), Math.min(b[1], cc), Math.max(b[2], rr), Math.max(b[3], cc)] : [rr, cc, rr, cc];
  }
  function kaldir(P, i) {
    const s = P.h[i];
    P.h[i] = 0;
    for (let d = 0; d < 4; d++) { const l = P.hDogru[i * 4 + d]; if (l >= 0) dogruGuncelle(P, l); }
    komsuEkle(P, i, -1);
    const [r, c] = koord(P, i), z = B.zobrist(r, c, s);
    P.hi = (P.hi ^ z.hi) >>> 0; P.lo = (P.lo ^ z.lo) >>> 0;
    P.tasSay--;
    P.bb = P.bbYigin.pop() || null;
  }

  /* ---------- değerlendirme ---------- */

  function catal(P, s) {
    const b = s * SAY_N, dort = P.say[b + 2], acikUc = P.say[b + 3];
    let v = 0;
    if (dort >= 1 && acikUc >= 1) v += CATAL.dortUc;
    if (acikUc >= 2) v += CATAL.ucUc;
    if (dort >= 2) v += CATAL.dortDort;
    return v;
  }
  // sıradakinin (s) gözünden puan
  function puan(P, s) {
    const o = 3 - s, bs = s * SAY_N, bo = o * SAY_N, sy = P.say;
    if (sy[bo] > 0) return -KAZANC;                          // rakip beşi yapmış
    if (sy[bs] > 0) return KAZANC;
    if (sy[bs + 1] + sy[bs + 2] > 0) return YAKIN;           // bir hamlede beş
    if (sy[bo + 1] > 0 || sy[bo + 2] >= 2) return -YAKIN * .8;   // rakibin iki tamamlaması: çoğunlukla kayıp
    let v = P.top[s] + catal(P, s) - P.top[o] - catal(P, o);
    if (sy[bo + 2] === 0 && sy[bs + 3] > 0) v += ACIK_UC_SIRASI;
    return v;
  }
  // tamamlaması var mı (bir hamlede beş)
  const tamamlamaVar = (P, s) => P.say[s * SAY_N + 1] + P.say[s * SAY_N + 2] > 0;
  // açık üçü var mı (bir hamlede açık dört): rakibin tamamlaması yoksa kesin kazanç
  const acikUcVar = (P, s) => P.say[s * SAY_N + 3] > 0;

  // Rakibin (o) açık üçüne karşı anlamlı cevaplar: o'nun dört yapacağı kareler (kapatma) ve s'nin dört / beş
  // yaptığı kareler (karşı saldırı). Liste boş kalırsa çağıran tüm adaylara döner.
  function ucCevaplari(P, s, liste, out = []) {
    out.length = 0;
    for (const i of liste) {
      const p = yonSiniflari(P, i, s);
      for (let d = 0; d < 4; d++) {
        if (hucumSinifi(p, d) >= S.DORT || savunmaSinifi(p, d) >= S.DORT) { out.push(i); break; }
      }
    }
    return out;
  }
  const besYapti = (P, s) => P.say[s * SAY_N] > 0;

  /* ---------- tek kare, dört yön: hızlı yerel sınıf (aday sıralama, dört/beş tespiti) ---------- */

  // Karenin ± 5 komşusu (4 değerli: 0 boş, 1 kendi, 2 rakip, 3 duvar) bir anahtar olur; sınıf ezberlenir.
  const YON_EZBER = [new Map(), new Map()];
  const YB = new Int8Array(11), YP = new Uint8Array(11);

  function yonHesapla(kod, tam) {
    for (let k = 0; k < 11; k++) { if (k === 5) { YB[k] = 0; continue; } const j = k < 5 ? k : k - 1; YB[k] = (kod >> (2 * j)) & 3; }
    const sinif = (ben, sinir) => {
      let a = 5, b = 5;
      while (a - 1 >= 0 && YB[a - 1] !== sinir[0] && YB[a - 1] !== 3) a--;
      while (b + 1 < 11 && YB[b + 1] !== sinir[0] && YB[b + 1] !== 3) b++;
      const n = b - a + 1;
      if (n < 5) return S.OLU;
      for (let t = 0; t < n; t++) YP[t] = (a + t === 5 || YB[a + t] === ben) ? 1 : 0;
      return siniflandir(YP, n, tam);
    };
    const hucum = sinif(1, [2]);        // ben buraya koyarsam
    const savunma = sinif(2, [1]);      // rakip buraya koysaydı (benim kapattığım)
    return hucum | (savunma << 4);
  }
  // i boş kare, s renk → 4 yönün paketlenmiş sınıfları (her yön 8 bit: hücum | savunma << 4)
  function yonSiniflari(P, i, s) {
    const W = P.W, H = P.H, r = Math.floor(i / W), c = i % W, o = 3 - s;
    let sonuc = 0;
    for (let d = 0; d < 4; d++) {
      const dr = YON[d][0], dc = YON[d][1];
      let kod = 0, j = 0;
      for (let k = -5; k <= 5; k++) {
        if (k === 0) continue;
        const rr = r + k * dr, cc = c + k * dc;
        let v;
        if (rr < 0 || rr >= H || cc < 0 || cc >= W) v = 3;
        else { const t = P.h[rr * W + cc]; v = t === 0 ? 0 : t === s ? 1 : 2; }
        kod |= v << (2 * j); j++;
      }
      let x = P.yonEzber.get(kod);
      if (x === undefined) { x = yonHesapla(kod, P.tam); P.yonEzber.set(kod, x); }
      sonuc |= x << (8 * d);
    }
    return sonuc;
  }
  const hucumSinifi = (paket, d) => (paket >>> (8 * d)) & 15;
  const savunmaSinifi = (paket, d) => (paket >>> (8 * d + 4)) & 15;

  // Aday sıralaması için hamle değeri (hücum + kapatılan tehdit + çatal)
  function onSkor(P, i, s, savunmaAgirlik = .85) {
    const p = yonSiniflari(P, i, s);
    let h = 0, sv = 0, h6 = 0, h5 = 0, s6 = 0, s5 = 0;
    for (let d = 0; d < 4; d++) {
      const a = hucumSinifi(p, d), b = savunmaSinifi(p, d);
      h += PUAN[a]; sv += PUAN[b];
      if (a >= S.DORT) h6++; else if (a === S.ACIK_UC) h5++;
      if (b >= S.DORT) s6++; else if (b === S.ACIK_UC) s5++;
    }
    if (h6 >= 2) h += CATAL.dortDort; else if (h6 && h5) h += CATAL.dortUc; else if (h5 >= 2) h += CATAL.ucUc;
    if (s6 >= 2) sv += CATAL.dortDort; else if (s6 && s5) sv += CATAL.dortUc; else if (s5 >= 2) sv += CATAL.ucUc;
    return h + sv * savunmaAgirlik;
  }
  function besYapar(P, i, s) {
    const p = yonSiniflari(P, i, s);
    for (let d = 0; d < 4; d++) if (hucumSinifi(p, d) === S.BES) return true;
    return false;
  }
  // dört (ya da daha iyisi) yapar mı: 0 hayır · 1 dört · 2 açık dört / çift dört (durdurulamaz) · 3 beş
  function dortDuzeyi(P, i, s) {
    const p = yonSiniflari(P, i, s);
    let dort = 0, acik = false;
    for (let d = 0; d < 4; d++) {
      const a = hucumSinifi(p, d);
      if (a === S.BES) return 3;
      if (a === S.ACIK_DORT) acik = true;
      else if (a === S.DORT) dort++;
    }
    return acik || dort >= 2 ? 2 : dort ? 1 : 0;
  }

  /* ---------- adaylar ---------- */

  // Taşların 2 kare komşuluğundaki boş kareler (aday bölgesi içinde). Tahta boşsa ortaya en yakın kare.
  function adaylar(P, out = []) {
    out.length = 0;
    if (!P.bb) {
      const r = Math.max(P.ar1, Math.min(P.ar2, Math.floor((P.ar1 + P.ar2) / 2)));
      const c = Math.max(P.ac1, Math.min(P.ac2, Math.floor((P.ac1 + P.ac2) / 2)));
      out.push(r * P.W + c);
      return out;
    }
    const r1 = Math.max(P.ar1, P.bb[0] - 2), r2 = Math.min(P.ar2, P.bb[2] + 2);
    const c1 = Math.max(P.ac1, P.bb[1] - 2), c2 = Math.min(P.ac2, P.bb[3] + 2);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const i = r * P.W + c;
      if (P.h[i] === 0 && P.kom[i] > 0) out.push(i);
    }
    return out;
  }

  // s'nin beş tamamlama kareleri
  function tamamlamaHucreleri(P, s) {
    const sonuc = [];
    if (!tamamlamaVar(P, s)) return sonuc;
    if (!P.bb) return sonuc;
    const r1 = Math.max(0, P.bb[0] - 1), r2 = Math.min(P.H - 1, P.bb[2] + 1);
    const c1 = Math.max(0, P.bb[1] - 1), c2 = Math.min(P.W - 1, P.bb[3] + 1);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const i = r * P.W + c;
      if (P.h[i] === 0 && P.kom[i] > 0 && besYapar(P, i, s)) sonuc.push(i);
    }
    return sonuc;
  }

  /* ---------- zorunlu hamle (puanlamadan önce) ---------- */

  // s sırada. Dön: { i, tur } | null.  tur: 'bes' kendi beşi · 'kapat' rakibin dördünü kapat ·
  // 'kayip' rakibin iki dördü (kaybedilmiş; en uzun direnen) · 'acikDort' kendi açık dördü (rakipte dört yokken)
  function zorunlu(P, s) {
    const o = 3 - s;
    const ben = tamamlamaHucreleri(P, s);
    if (ben.length) return { i: ben[0], tur: 'bes' };
    const onun = tamamlamaHucreleri(P, o);
    if (onun.length === 1) return { i: onun[0], tur: 'kapat' };
    if (onun.length >= 2) {
      // en uzun direnen: kapatırken kendi dördünü yapan kare (rakip önce onu kapatmak zorunda), yoksa en değerli
      let en = onun[0], enV = -Infinity;
      for (const i of onun) { const v = dortDuzeyi(P, i, s) * 1e9 + onSkor(P, i, s); if (v > enV) { enV = v; en = i; } }
      return { i: en, tur: 'kayip' };
    }
    const liste = adaylar(P);
    let en = -1, enV = -Infinity;
    for (const i of liste) {
      if (dortDuzeyi(P, i, s) >= 2) { const v = onSkor(P, i, s); if (v > enV) { enV = v; en = i; } }
    }
    if (en >= 0) return { i: en, tur: 'acikDort' };
    return null;
  }

  /* ---------- tehditler (UI için, sıradakinin gözünden) ---------- */

  // noktalar: sıradakinin açık üçlerini (açık) dörde, dörtlerini beşe tamamlayan kareler.
  // halka: rakibin dördünü (yoksa açık üçünü) kapatması gereken kare.
  function tehditler(durum, s) {
    if (durum.bitti) return { noktalar: [], halka: null };
    const P = pencereKur(durum), o = 3 - s;
    const noktalar = [];
    for (const i of adaylar(P)) {
      const p = yonSiniflari(P, i, s);
      for (let d = 0; d < 4; d++) {
        const a = hucumSinifi(p, d);
        if (a === S.BES || a === S.ACIK_DORT) { noktalar.push(koord(P, i)); break; }
      }
    }
    let halka = null;
    const onun = tamamlamaHucreleri(P, o);
    if (onun.length) halka = koord(P, onun[0]);
    else {
      let en = -1, enV = -Infinity;
      for (const i of adaylar(P)) {
        const p = yonSiniflari(P, i, s);
        let kapatir = false;
        for (let d = 0; d < 4; d++) if (savunmaSinifi(p, d) === S.ACIK_DORT) kapatir = true;
        if (!kapatir) continue;
        const v = onSkor(P, i, s);
        if (v > enV) { enV = v; en = i; }
      }
      if (en >= 0) halka = koord(P, en);
    }
    return { noktalar, halka };
  }

  // i'ye s konunca yön başına oluşan desenler ve çatal türü
  function catallar(P, i, s) {
    const p = yonSiniflari(P, i, s), yonler = [];
    let dort = 0, uc = 0;
    for (let d = 0; d < 4; d++) {
      const a = hucumSinifi(p, d);
      if (a >= S.ACIK_UC) yonler.push({ yon: YON[d], sinif: SINIF_ADI[a] });
      if (a >= S.DORT && a !== S.BES) dort++; else if (a === S.ACIK_UC) uc++;
    }
    return { dortUc: dort >= 1 && uc >= 1, ucUc: uc >= 2, dortDort: dort >= 2, yonler };
  }

  /* ---------- tam tarama (yalnız test) ---------- */

  function tamPuan(P) {
    const top = new Float64Array(3), say = new Int32Array(3 * SAY_N);
    for (let l = 0; l < P.dBas.length; l++) {
      const bas = P.dBas[l], L = P.dUz[l];
      for (let j = 0; j < L; j++) DEGER[j] = P.h[P.dc[bas + j]];
      for (let s = 1; s <= 2; s++) top[s] += dogruPuani(L, s, P.tam, say, s * SAY_N, null);
    }
    return { top, say };
  }
  const sayim = (P, s) => {
    const b = s * SAY_N;
    return { bes: P.say[b], acikDort: P.say[b + 1], dort: P.say[b + 2], acikUc: P.say[b + 3], uc: P.say[b + 4] };
  };

  const E = {
    S, SINIF_ADI, PUAN, CATAL, KAZANC, YAKIN, YON,
    siniflandir, satirSiniflari,
    pencereKur, hucre, koord, anahtarI, koy, kaldir,
    puan, catal, tamamlamaVar, acikUcVar, ucCevaplari, besYapti, sayim, tamPuan,
    yonSiniflari, hucumSinifi, savunmaSinifi, onSkor, besYapar, dortDuzeyi,
    adaylar, tamamlamaHucreleri, zorunlu, tehditler, catallar,
  };

  if (typeof window !== 'undefined') (window.XOX = window.XOX || {}).eval = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})();
