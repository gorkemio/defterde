// ai.js — bilgisayar rakibin yerleşim seçimi. Saf fonksiyonlar: DOM yok, game.js'e bağımlı değil.
//
// AB.ai.sec(oyun, adaylar, sahip, { zorluk, agirlik }, r) → aday | null
//   adaylar = G.yerlesimler(oyun, a, b, sahip)   (main.js pas kontrolü için zaten üretir)
//   zorluk 'kolay': adaylardan rastgele biri · 'zor': aşağıdaki puanın en yükseği (eşitlikte rastgele)
//   Aday yoksa null (→ pas). Durum tutmaz; aynı konum ve aynı r aynı hamleyi verir.
//
// Puan (PLAN.md §6). Ortak tahtada boş alan paylaşılır ve sıradaki hamle rakibindir; sıkı paketlemek
// rakibe büyük boşluk bırakır. Bu yüzden ana terim "engel": rakibin bir sonraki atışta beklenen kazancını düşürmek.
//   engel  = 1 − g_rakip / E            (g: bir sonraki zarda koyabileceği alanın beklenen değeri, E: en çok değeri)
//   kendi  = g_ben / E                  yalnız bitişiklikte: kendi büyümeme alan bırak
//   temas  = değen çevre / 2(w+h)       yalnız ortak modda: köşe ve düzen (küçük ağırlık)
//   merkez = 1 − uzaklık / (n−1)        yalnız bitişiklikte: ortadan genişle
//   ölü    = 3 hücreye kadar kopuk boş bölgelerdeki hücre sayısı (ceza)
(function () {
  'use strict';

  const AI = {};
  const KOD = { ben: 1, rakip: 2 };
  const DIGER = { ben: 'rakip', rakip: 'ben' };
  const SONSUZ = 1 << 14;
  const VARSAYILAN = { engel: 1, kendi: 0.5, temas: 0.05, merkez: 0.05, olu: 0.03 };
  const kose = (n, sahip) => (sahip === 'ben' ? 0 : n * n - 1);

  // Oyunun çalışma kopyası: B[i] = 0 boş · 1 ben · 2 rakip. Adaylar bunun üstünde geçici denenir.
  AI.durum = function (o) {
    const n = o.n, B = new Uint8Array(n * n);
    for (let i = 0; i < B.length; i++) {
      const id = o.hucre[i];
      B[i] = id === -1 ? 0 : (o.dikdortgenler[id].sahip === 'ben' ? 1 : 2);
    }
    return { n, B, sayi: { ben: o.sayi.ben, rakip: o.sayi.rakip }, bitisiklik: o.ayar.bitisiklik, zar: o.ayar.zar };
  };

  // sigar[h][w] = sahibin bu tahtada h satır × w sütun bir dikdörtgen koyabileceği bir yer var mı (1..hi).
  // Tek tarama: satır koşulları + sağdaki en yakın "çapa"ya uzaklık + fark dizisi, O(n²·hi).
  // Çapa: ortak modda her boş hücre; bitişiklikte sahibin alanına kenardan değen boş hücre
  // (alanı yoksa yalnız kendi köşesi). Alanı olmayan rakibin köşesi yasak sayılır. G.yerlestirilebilir ile aynı kural.
  AI.sigarTablosu = function (d, sahip, hi) {
    const { n, B } = d, kod = KOD[sahip], diger = DIGER[sahip], N = n * n;
    const bos = new Uint8Array(N), capa = new Uint8Array(N);
    for (let i = 0; i < N; i++) bos[i] = B[i] === 0 ? 1 : 0;
    if (d.bitisiklik) {
      if (d.sayi[diger] === 0) bos[kose(n, diger)] = 0;
      if (d.sayi[sahip] === 0) {
        const c = kose(n, sahip);
        if (bos[c]) capa[c] = 1;
      } else {
        for (let s = 0; s < n; s++) {
          for (let k = 0; k < n; k++) {
            const i = s * n + k;
            if (!bos[i]) continue;
            if ((s > 0 && B[i - n] === kod) || (s < n - 1 && B[i + n] === kod) ||
                (k > 0 && B[i - 1] === kod) || (k < n - 1 && B[i + 1] === kod)) capa[i] = 1;
          }
        }
      }
    } else {
      capa.set(bos);
    }

    const R = new Int16Array(N), Dm = new Int16Array(N);      // sağa boş koşu · sağdaki en yakın çapaya uzaklık
    for (let s = 0; s < n; s++) {
      let r = 0, dd = SONSUZ;
      for (let k = n - 1; k >= 0; k--) {
        const i = s * n + k;
        r = bos[i] ? r + 1 : 0;
        dd = capa[i] ? 0 : (dd >= SONSUZ ? SONSUZ : dd + 1);
        R[i] = r; Dm[i] = dd;
      }
    }

    const kenar = hi + 2, fark = new Int32Array((hi + 1) * kenar);
    for (let s = 0; s < n; s++) {
      for (let k = 0; k < n; k++) {
        if (!bos[s * n + k]) continue;
        let wmax = SONSUZ, dmin = SONSUZ;
        for (let h = 1; h <= hi && s + h <= n; h++) {
          const i = (s + h - 1) * n + k;
          if (R[i] === 0) break;
          if (R[i] < wmax) wmax = R[i];
          if (Dm[i] < dmin) dmin = Dm[i];
          const alt = dmin + 1, ust = Math.min(wmax, hi);     // geçerli genişlikler: çapayı içeren ve boş koşuya sığan
          if (alt <= ust) { fark[h * kenar + alt]++; fark[h * kenar + ust + 1]--; }
        }
      }
    }
    const sigar = [];
    for (let h = 0; h <= hi; h++) {
      const satir = new Uint8Array(hi + 1);
      let t = 0;
      for (let w = 1; w <= hi; w++) { t += fark[h * kenar + w]; satir[w] = t > 0 ? 1 : 0; }
      sigar.push(satir);
    }
    return sigar;
  };

  // Bir sonraki atışta beklenen kazanç: zar çiftlerinin (a, b) alanı × o çiftin koyulabilir olması, olasılıkla tartılı.
  AI.beklenenKazanc = function (sigar, en, cok) {
    const m = cok - en + 1;
    let g = 0;
    for (let a = en; a <= cok; a++) {
      for (let b = en; b <= cok; b++) if (sigar[b][a] || sigar[a][b]) g += a * b;
    }
    return g / (m * m);
  };

  // 4-komşulukla bağlı boş bölgelerden 3 hücre ya da daha küçük olanların toplam hücre sayısı.
  AI.oluHucreler = function (d) {
    const { n, B } = d, N = n * n, goruldu = new Uint8Array(N), yigin = new Int16Array(N);
    let olu = 0;
    for (let b = 0; b < N; b++) {
      if (B[b] !== 0 || goruldu[b]) continue;
      let ust = 0, boyut = 0;
      yigin[ust++] = b; goruldu[b] = 1;
      while (ust) {
        const i = yigin[--ust], s = (i / n) | 0, k = i % n;
        boyut++;
        if (s > 0 && B[i - n] === 0 && !goruldu[i - n]) { goruldu[i - n] = 1; yigin[ust++] = i - n; }
        if (s < n - 1 && B[i + n] === 0 && !goruldu[i + n]) { goruldu[i + n] = 1; yigin[ust++] = i + n; }
        if (k > 0 && B[i - 1] === 0 && !goruldu[i - 1]) { goruldu[i - 1] = 1; yigin[ust++] = i - 1; }
        if (k < n - 1 && B[i + 1] === 0 && !goruldu[i + 1]) { goruldu[i + 1] = 1; yigin[ust++] = i + 1; }
      }
      if (boyut <= 3) olu += boyut;
    }
    return olu;
  };

  // Adayın çevresindeki birim kenarlardan tahta kenarına ya da dolu hücreye değenlerin oranı (aday konmadan önce).
  AI.temas = function (d, c) {
    const { n, B } = d;
    let say = 0;
    for (let j = c.k; j < c.k + c.w; j++) {
      if (c.s === 0 || B[(c.s - 1) * n + j] !== 0) say++;
      if (c.s + c.h === n || B[(c.s + c.h) * n + j] !== 0) say++;
    }
    for (let i = c.s; i < c.s + c.h; i++) {
      if (c.k === 0 || B[i * n + c.k - 1] !== 0) say++;
      if (c.k + c.w === n || B[i * n + c.k + c.w] !== 0) say++;
    }
    return say / (2 * (c.w + c.h));
  };

  // Adayın puanı. d: AI.durum(o). Aday geçici konur ve geri alınır; d değişmeden kalır.
  AI.puanla = function (d, c, sahip, ag) {
    const { n, B } = d, kod = KOD[sahip], diger = DIGER[sahip];
    const [en, cok] = d.zar, E = ((en + cok) / 2) ** 2, bitisik = d.bitisiklik;
    const temas = bitisik ? 0 : AI.temas(d, c);

    for (let i = c.s; i < c.s + c.h; i++) for (let j = c.k; j < c.k + c.w; j++) B[i * n + j] = kod;
    d.sayi[sahip]++;
    const engel = 1 - AI.beklenenKazanc(AI.sigarTablosu(d, diger, cok), en, cok) / E;
    let kendi = 0, merkez = 0;
    if (bitisik) {
      kendi = AI.beklenenKazanc(AI.sigarTablosu(d, sahip, cok), en, cok) / E;
      const cs = c.s + (c.h - 1) / 2, ck = c.k + (c.w - 1) / 2, orta = (n - 1) / 2;
      merkez = 1 - (Math.abs(cs - orta) + Math.abs(ck - orta)) / (n - 1);
    }
    const olu = AI.oluHucreler(d);
    d.sayi[sahip]--;
    for (let i = c.s; i < c.s + c.h; i++) for (let j = c.k; j < c.k + c.w; j++) B[i * n + j] = 0;

    return ag.engel * engel + ag.kendi * kendi + ag.temas * temas + ag.merkez * merkez - ag.olu * olu;
  };

  // secenek: { zorluk: 'kolay' | 'zor', agirlik } · r: 0..1 arası rastgele sayı üreteci
  AI.sec = function (o, adaylar, sahip, secenek = {}, r = Math.random) {
    if (!adaylar.length) return null;
    if (secenek.zorluk === 'kolay' || adaylar.length === 1) return adaylar[Math.floor(r() * adaylar.length)];
    const d = AI.durum(o), ag = Object.assign({}, VARSAYILAN, secenek.agirlik);
    let enIyi = -Infinity, iyiler = [];
    for (const c of adaylar) {
      const p = AI.puanla(d, c, sahip, ag);
      if (p > enIyi + 1e-9) { enIyi = p; iyiler = [c]; }
      else if (p > enIyi - 1e-9) iyiler.push(c);
    }
    return iyiler[Math.floor(r() * iyiler.length)];
  };

  if (typeof window !== 'undefined') (window.AB = window.AB || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
