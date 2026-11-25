// nonogram/linesolver.js — tek satırın (ya da sütunun) bütün tutarlı blok yerleşimlerinde ortak olan kareler.
// Soldan F[i][j]: ilk i kare ilk j blokla tutarlı; sağdan B[i][j]: [i, n) kareleri j..k-1 bloklarıyla tutarlı.
// Kare boş olabilir ⇔ ∃j F[c][j] ∧ B[c+1][j]; dolu olabilir ⇔ onu örten geçerli bir (blok, başlangıç) var.
// Geçerli yerleşimler fark dizisiyle işlenir: O(n·k). DOM yok.
(function () {
  'use strict';

  let kap = 0, F, B, kosu, fark, olabilir;
  function hazirla(n, k) {
    const gerek = (n + 2) * (k + 2);
    if (gerek > kap) { kap = gerek * 2; F = new Uint8Array(kap); B = new Uint8Array(kap); }
    if (!kosu || kosu.length < n + 2) { kosu = new Int32Array(n * 2 + 4); fark = new Int32Array(n * 2 + 4); olabilir = new Uint8Array(n * 2 + 4); }
  }

  // Hızlı çekirdek. bl: blok uzunlukları (0'sız), s: kare değerleri (0/1/2), n: uzunluk,
  // sonuc[c] ← 0 belirsiz, 1 kesin dolu, 2 kesin boş (zaten bilinen kareler dahil). Çelişkide false.
  function hesapla(bl, s, n, sonuc) {
    const k = bl.length, W = k + 1;
    hazirla(n, k);
    kosu[n] = 0;
    for (let i = n - 1; i >= 0; i--) kosu[i] = s[i] === 2 ? 0 : kosu[i + 1] + 1;
    // soldan
    F.fill(0, 0, (n + 1) * W);
    F[0] = 1;
    for (let i = 1; i <= n; i++) {
      const bos = s[i - 1] !== 1;
      for (let j = 0; j <= k; j++) {
        let v = bos && F[(i - 1) * W + j];
        if (!v && j > 0) {
          const L = bl[j - 1], st = i - L;
          if (st >= 0 && kosu[st] >= L) v = st === 0 ? j === 1 : (s[st - 1] !== 1 && F[(st - 1) * W + j - 1] === 1);
        }
        F[i * W + j] = v ? 1 : 0;
      }
    }
    if (!F[n * W + k]) return false;
    // sağdan
    B.fill(0, 0, (n + 2) * W);
    B[n * W + k] = 1;
    for (let i = n - 1; i >= 0; i--) {
      const bos = s[i] !== 1;
      for (let j = 0; j <= k; j++) {
        let v = bos && B[(i + 1) * W + j];
        if (!v && j < k) {
          const L = bl[j], e = i + L;
          if (e <= n && kosu[i] >= L) v = e === n ? j === k - 1 : (s[e] !== 1 && B[(e + 1) * W + j + 1] === 1);
        }
        B[i * W + j] = v ? 1 : 0;
      }
    }
    // dolu olabilir: geçerli yerleşimler
    fark.fill(0, 0, n + 1);
    for (let j = 0; j < k; j++) {
      const L = bl[j];
      for (let st = 0; st + L <= n; st++) {
        if (kosu[st] < L) continue;
        if (st > 0 && (s[st - 1] === 1 || !F[(st - 1) * W + j])) continue;
        if (st === 0 && j !== 0) continue;
        const e = st + L;
        if (e === n ? j !== k - 1 : (s[e] === 1 || !B[(e + 1) * W + j + 1])) continue;
        fark[st]++; fark[e]--;
      }
    }
    let acc = 0;
    for (let c = 0; c < n; c++) {
      acc += fark[c];
      const doluOl = acc > 0;
      let bosOl = false;
      if (s[c] !== 1) for (let j = 0; j <= k; j++) if (F[c * W + j] && B[(c + 1) * W + j]) { bosOl = true; break; }
      if (!doluOl && !bosOl) return false;
      sonuc[c] = doluOl && !bosOl ? 1 : (bosOl && !doluOl ? 2 : 0);
    }
    return true;
  }

  // Kullanışlı biçim: yalnız yeni kesinleşen kareler
  function coz(ipucu, satir) {
    const bl = ipucu.filter(x => x > 0), n = satir.length, sonuc = new Uint8Array(n);
    if (!hesapla(bl, satir, n, sonuc)) return { dolu: [], bos: [], celiski: true };
    const dolu = [], bos = [];
    for (let c = 0; c < n; c++) {
      if (satir[c] !== 0) continue;
      if (sonuc[c] === 1) dolu.push(c); else if (sonuc[c] === 2) bos.push(c);
    }
    return { dolu, bos, celiski: false };
  }

  const L = { hesapla, coz };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).linesolver = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
