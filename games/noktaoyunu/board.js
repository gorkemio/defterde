// board.js — Nokta Oyunu tahtası ve kuralları. DOM yok; tarayıcıda window.NK.board, node'da require('./board.js').
//
// Tahta m satır × n sütun nokta; kutular (m−1)×(n−1). Çizgi indeksleri:
//   yatay H(r, c): (r, c)–(r, c+1), r ∈ [0, m), c ∈ [0, n−1)  →  e = r(n−1) + c
//   dikey V(r, c): (r, c)–(r+1, c), r ∈ [0, m−1), c ∈ [0, n)  →  e = m(n−1) + rn + c
// Kutu (r, c) → k = r(n−1) + c; kenarları [H(r,c), H(r+1,c), V(r,c), V(r,c+1)].
// Notasyon: nokta "A1" (sütun harfi + satır, 1 üstte), çizgi "A1-B1", kutu sol üst noktasının adıyla.
//
// Durum yerinde değişir (make/unmake): cek(d, e) → kayit, geriAl(d, kayit). UI için değişmez uygula(d, e).
(function () {
  'use strict';

  const HARF = 'ABCDEFGHIJKLMNOP';

  /* ---------- geometri (ezberli) ---------- */

  const geolar = {};
  function geo(m, n) {
    const ad = m + 'x' + n;
    if (geolar[ad]) return geolar[ad];
    const nH = m * (n - 1), nV = (m - 1) * n, E = nH + nV, K = (m - 1) * (n - 1);
    const H = (r, c) => r * (n - 1) + c, V = (r, c) => nH + r * n + c;
    const KUTU_KENAR = new Int16Array(4 * K);             // k → 4 kenar
    const KENAR_KUTU = new Int16Array(2 * E).fill(-1);    // e → 1–2 kutu (yoksa −1)
    const KENAR_UC = [];                                   // e → [[r1, c1], [r2, c2]]
    for (let r = 0; r < m; r++) for (let c = 0; c < n - 1; c++) KENAR_UC[H(r, c)] = [[r, c], [r, c + 1]];
    for (let r = 0; r < m - 1; r++) for (let c = 0; c < n; c++) KENAR_UC[V(r, c)] = [[r, c], [r + 1, c]];
    for (let r = 0; r < m - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const k = r * (n - 1) + c, l = [H(r, c), H(r + 1, c), V(r, c), V(r, c + 1)];
        l.forEach((e, i) => {
          KUTU_KENAR[4 * k + i] = e;
          if (KENAR_KUTU[2 * e] < 0) KENAR_KUTU[2 * e] = k; else KENAR_KUTU[2 * e + 1] = k;
        });
      }
    }
    const nokta = (r, c) => HARF[c] + (r + 1);
    const kenarAdi = (e) => KENAR_UC[e].map(([r, c]) => nokta(r, c)).join('-');
    const ADLAR = new Map();
    for (let e = 0; e < E; e++) { ADLAR.set(kenarAdi(e), e); ADLAR.set(KENAR_UC[e].slice().reverse().map(([r, c]) => nokta(r, c)).join('-'), e); }
    const kenar = (ad) => { const e = ADLAR.get(String(ad).toUpperCase()); if (e === undefined) throw new Error('Bilinmeyen çizgi: ' + ad); return e; };
    const kutuRC = (k) => [Math.floor(k / (n - 1)), k % (n - 1)];
    return (geolar[ad] = { m, n, nH, nV, E, K, H, V, KUTU_KENAR, KENAR_KUTU, KENAR_UC, nokta, kenarAdi, kenar, kutuRC,
      kutuAdi: (k) => { const [r, c] = kutuRC(k); return nokta(r, c); } });
  }

  /* ---------- durum ---------- */

  function yeniOyun({ m = 5, n = 5, baslayan = 0 } = {}) {
    const G = geo(m, n);
    return {
      m, n, G, baslayan,
      cizgi: new Uint8Array(G.E), sahip: new Int8Array(G.K).fill(-1), serbest: new Uint8Array(G.K).fill(4),
      puan: [0, 0], sira: baslayan, kalan: G.E, bitti: false, son: null,
    };
  }

  function kopya(d) {
    return Object.assign({}, d, { cizgi: d.cizgi.slice(), sahip: d.sahip.slice(), serbest: d.serbest.slice(), puan: d.puan.slice(),
      son: d.son && { e: d.son.e, alinan: d.son.alinan.slice(), sira: d.son.sira } });
  }

  // make: çizgi çekilir; serbest kenarı 0'a inen kutular sıradakinin olur; kutu aldıysa sıra kalır, almadıysa geçer.
  function cek(d, e) {
    if (d.bitti) throw new Error('Oyun bitti');
    if (e < 0 || e >= d.G.E || d.cizgi[e]) throw new Error('Geçersiz çizgi: ' + e);
    const KK = d.G.KENAR_KUTU, p = d.sira;
    const kayit = { e, sira: p, son: d.son, alinan: [] };
    d.cizgi[e] = 1;
    d.kalan--;
    for (let i = 2 * e; i < 2 * e + 2; i++) {
      const k = KK[i];
      if (k < 0) continue;
      if (--d.serbest[k] === 0) { d.sahip[k] = p; d.puan[p]++; kayit.alinan.push(k); }
    }
    if (!kayit.alinan.length) d.sira = 1 - p;
    d.bitti = d.kalan === 0;
    d.son = { e, alinan: kayit.alinan, sira: p };
    return kayit;
  }

  // unmake
  function geriAl(d, kayit) {
    const KK = d.G.KENAR_KUTU, e = kayit.e;
    d.cizgi[e] = 0;
    d.kalan++;
    for (let i = 2 * e; i < 2 * e + 2; i++) {
      const k = KK[i];
      if (k < 0) continue;
      if (d.serbest[k]++ === 0) { d.sahip[k] = -1; d.puan[kayit.sira]--; }
    }
    d.sira = kayit.sira;
    d.son = kayit.son;
    d.bitti = false;
  }

  function uygula(d, e) { const y = kopya(d); cek(y, e); return y; }

  /* ---------- sorgular ---------- */

  function hamleler(d) {
    const l = [];
    for (let e = 0; e < d.G.E; e++) if (!d.cizgi[e]) l.push(e);
    return l;
  }

  // Bu çizgi kaç kutu kapatır (0 · 1 · 2)
  function kapatir(d, e) {
    const KK = d.G.KENAR_KUTU;
    let s = 0;
    for (let i = 2 * e; i < 2 * e + 2; i++) if (KK[i] >= 0 && d.serbest[KK[i]] === 1) s++;
    return s;
  }

  // Çekilirse komşu kutulardan biri tek serbest kenarla kalır (rakibe kutu verir)
  function ucuncuKenarVerir(d, e) {
    const KK = d.G.KENAR_KUTU;
    for (let i = 2 * e; i < 2 * e + 2; i++) if (KK[i] >= 0 && d.serbest[KK[i]] === 2) return true;
    return false;
  }

  const alinabilir = (d) => hamleler(d).filter(e => kapatir(d, e) > 0);
  // Güvenli: kutu kapatmayan ve rakibe kutu vermeyen çizgi
  const guvenliMi = (d, e) => !d.cizgi[e] && kapatir(d, e) === 0 && !ucuncuKenarVerir(d, e);
  const guvenli = (d) => hamleler(d).filter(e => guvenliMi(d, e));
  // Tehlikeli (ipucu): çekilirse rakibe kutu veren, kendisi kutu kapatmayan çizgiler
  const tehlikeli = (d) => hamleler(d).filter(e => kapatir(d, e) === 0 && ucuncuKenarVerir(d, e));

  function kazanan(d) {
    if (!d.bitti) return null;
    return d.puan[0] === d.puan[1] ? 'berabere' : d.puan[0] > d.puan[1] ? 0 : 1;
  }

  /* ---------- test ve bulmaca yardımcıları ---------- */

  // Konum kur. cizgiler: çekili çizgiler (ad ya da indeks) · bos: yalnız bunlar çekilmemiş (gerisi çekili) — biri verilir.
  // sahip: kapanmış kutuların sahibi: sayı (hepsi), dizi (kapanma sırasıyla) ya da { 'A1': 0, … } · sira · baslayan
  function kur({ m = 5, n = 5, cizgiler, bos, sahip = 0, sira = 0, baslayan = 0 }) {
    const d = yeniOyun({ m, n, baslayan });
    const G = d.G, ad = (x) => (typeof x === 'number' ? x : G.kenar(x));
    if (bos) { const b = new Set(bos.map(ad)); for (let e = 0; e < G.E; e++) d.cizgi[e] = b.has(e) ? 0 : 1; }
    else for (const x of cizgiler || []) d.cizgi[ad(x)] = 1;
    let sayac = 0;
    for (let k = 0; k < G.K; k++) {
      let s = 0;
      for (let i = 0; i < 4; i++) s += 1 - d.cizgi[G.KUTU_KENAR[4 * k + i]];
      d.serbest[k] = s;
      if (s === 0) {
        const p = typeof sahip === 'number' ? sahip : Array.isArray(sahip) ? sahip[sayac] ?? 0 : sahip[G.kutuAdi(k)] ?? 0;
        d.sahip[k] = p; d.puan[p]++; sayac++;
      }
    }
    d.kalan = d.cizgi.reduce((a, v) => a + 1 - v, 0);
    d.sira = sira;
    d.bitti = d.kalan === 0;
    return d;
  }

  // Metin çizimi (hata ayıklama, test mesajları): • noktalar, ─ │ çizgiler, kutuda sahibin harfi
  function yazdir(d, harfler = ['S', 'B']) {
    const { m, n, G } = d, satirlar = [];
    for (let r = 0; r < m; r++) {
      let s = '';
      for (let c = 0; c < n; c++) { s += '•'; if (c < n - 1) s += d.cizgi[G.H(r, c)] ? '───' : '   '; }
      satirlar.push(s);
      if (r === m - 1) break;
      s = '';
      for (let c = 0; c < n; c++) {
        s += d.cizgi[G.V(r, c)] ? '│' : ' ';
        if (c < n - 1) { const k = r * (n - 1) + c; s += d.sahip[k] >= 0 ? ` ${harfler[d.sahip[k]]} ` : '   '; }
      }
      satirlar.push(s);
    }
    return satirlar.join('\n');
  }

  const BD = { geo, yeniOyun, kopya, cek, geriAl, uygula, hamleler, kapatir, ucuncuKenarVerir, alinabilir, guvenliMi, guvenli, tehlikeli, kazanan, kur, yazdir };
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).board = BD;
  if (typeof module !== 'undefined' && module.exports) module.exports = BD;
})();
