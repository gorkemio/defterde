// solver.js — Sayı Bulma çözücüsü. DOM'a, window'a ve Kit'e bakmaz; tarayıcıda SB.solver, node'da module.exports.
//
// Aday kümesi modeli:  S = { ayar, kume, adaylar: Uint32Array (küme indeksleri), cevaplar: [{ tahmin, kod }] }
//   kur(ayar, cevaplar?) → S          ele(S, tahmin, kod) → yeni S (S değişmez)          kalan(S) → sayı
// Tahmin seçimi (sec / secAsync), seviye:
//   kolay — yalnız SON cevaba tutarlı, daha önce sorulmamış sayılardan rastgele; 8 cevaptan sonra bütün cevaplara
//           tutarlı (ölçüm: ortalama ~6.7, en çok 10; "son 3 cevap" 5.7 verip zor'dan ayrılmıyordu)
//   orta  — tutarlı adaylar arasından beklenen kalan aday sayısını (Σ n_k² / C) en küçülten
//   zor   — bütün geçerli sayılar arasından cevap dağılımının entropisini en büyüten; eşitlikte tutarlı olan
// İlk tahmin hesapsız: rastgele (farklı rakamlı ayarda her ilk tahmin simetri gereği aynı bilgiyi verir).
// Hesap büyükse (tahmin × aday > islemSiniri) tohumlu örnekleme. secAsync hesabı dilimlere böler, bütçe aşılırsa o ana
// kadarki en iyiyle döner, signal ile iptal edilir.
// celiski(S): adaylar boşaldıysa hangi tek satırın kaldırılması kümeyi doldurur. cikarim(S): kesin var / yok / yeri kesin.
(function () {
  'use strict';

  const R = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : window.SB.rules;
  const V = {};

  const VARSAYILAN = { islemSiniri: 8e6, adaySiniri: 2000, butceMs: 300, dilimMs: 8, kolayPencere: 1, kolayTamTutarli: 8 };
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- aday kümesi ---------- */

  function tumu(n) { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; }

  function suz(kume, adaylar, tahmin, kod) {
    const skor = kume.skor, cikti = new Uint32Array(adaylar.length);
    let n = 0;
    for (let j = 0; j < adaylar.length; j++) if (skor(adaylar[j], tahmin) === kod) cikti[n++] = adaylar[j];
    return cikti.slice(0, n);
  }

  // cevaplar: [{ tahmin: küme indeksi | dize, kod } | { tahmin, arti, eksi }]
  V.kur = function (ayarGirdi, cevaplar = []) {
    const ayar = R.ayar(ayarGirdi), kume = R.kume(ayar);
    let S = { ayar, kume, adaylar: tumu(kume.boyut), cevaplar: [] };
    for (const c of cevaplar) S = V.ele(S, c.tahmin, c.kod ?? R.kod(c.arti, c.eksi, ayar.hane));
    return S;
  };
  V.ele = function (S, tahmin, kod) {
    const t = typeof tahmin === 'string' ? S.kume.indeks(tahmin) : tahmin;
    if (t < 0) throw new Error('Geçersiz tahmin: ' + tahmin);
    return { ayar: S.ayar, kume: S.kume, adaylar: suz(S.kume, S.adaylar, t, kod), cevaplar: S.cevaplar.concat([{ tahmin: t, kod }]) };
  };
  V.kalan = (S) => S.adaylar.length;

  V.cevapDagilimi = function (kume, tahmin, adaylar) {
    const n = new Int32Array(kume.kodSayisi), skor = kume.skor;
    for (let j = 0; j < adaylar.length; j++) n[skor(tahmin, adaylar[j])]++;
    return n;
  };

  /* ---------- tahmin seçimi ---------- */

  // İlk tahmin: farklı rakamlı ayarda rastgele bir sayı; tekrarlı ayarda "aabb" kalıbı (iki rakam, ikişer kez).
  V.ilkTahmin = function (ayarGirdi, r = Math.random) {
    const a = R.ayar(ayarGirdi), kume = R.kume(a);
    if (!a.tekrar) return Math.floor(r() * kume.boyut);
    const x = 1 + Math.floor(r() * 9);
    let y = Math.floor(r() * 9); if (y >= x) y++;
    const dize = Array.from({ length: a.hane }, (_, i) => (i < Math.ceil(a.hane / 2) ? x : y)).join('');
    return kume.indeks(dize);
  };

  // Tohumlu örnek: dizinin k elemanı (kısmi Fisher–Yates, kopya üzerinde)
  function ornek(dizi, k, r) {
    if (dizi.length <= k) return dizi;
    const a = Uint32Array.from(dizi);
    for (let i = 0; i < k; i++) { const j = i + Math.floor(r() * (a.length - i)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, k);
  }

  // Üreteç: sıradaki tahmini hesaplar; ara ara yield eder (secAsync tarayıcıya döner, sec hemen devam eder).
  // Dönüş: { tahmin (küme indeksi), dize, tutarli, eksik (bütçe dolduğu için yarım kaldı mı), sureMs }
  function* ureteci(S, o) {
    const r = o.r || Math.random, seviye = o.seviye || 'orta', kume = S.kume, skor = kume.skor;
    const C = S.adaylar.length;
    const sonuc = (t, tutarli, eksik) => ({ tahmin: t, dize: kume.dize(t), tutarli, eksik: !!eksik });
    if (!S.cevaplar.length) return sonuc(V.ilkTahmin(S.ayar, r), true);
    if (C === 0) return null;                                  // çelişki: tahmin yok
    if (C === 1) return sonuc(S.adaylar[0], true);

    if (seviye === 'kolay') {
      const n = S.cevaplar.length;
      if (n >= (o.kolayTamTutarli ?? VARSAYILAN.kolayTamTutarli)) return sonuc(S.adaylar[Math.floor(r() * C)], true);
      const son = S.cevaplar.slice(-(o.kolayPencere ?? VARSAYILAN.kolayPencere)), once = new Set(S.cevaplar.map(c => c.tahmin));
      const havuz = [];
      for (let j = 0; j < kume.boyut; j++) {
        if (once.has(j)) continue;
        let iyi = true;
        for (const c of son) if (skor(j, c.tahmin) !== c.kod) { iyi = false; break; }
        if (iyi) havuz.push(j);
      }
      if (!havuz.length) return sonuc(S.adaylar[Math.floor(r() * C)], true);
      const t = havuz[Math.floor(r() * havuz.length)];
      return sonuc(t, S.adaylar.includes(t));
    }

    const sinir = o.islemSiniri ?? VARSAYILAN.islemSiniri;
    const n = new Int32Array(kume.kodSayisi);
    let adaylar = S.adaylar;
    // Örnekleme: dağılımı hesaplanan aday sayısı ve denenen tahmin sayısı iş sınırına sığsın
    let tahminler;
    if (seviye === 'orta') {
      if (C * C > sinir) adaylar = ornek(S.adaylar, Math.max(200, Math.floor(Math.sqrt(sinir))), r);
      tahminler = adaylar.length < C ? ornek(S.adaylar, Math.floor(sinir / adaylar.length), r) : S.adaylar;
    } else {
      if (C * kume.boyut > sinir && C > (o.adaySiniri ?? VARSAYILAN.adaySiniri)) adaylar = ornek(S.adaylar, o.adaySiniri ?? VARSAYILAN.adaySiniri, r);
      const G = Math.max(1, Math.floor(sinir / adaylar.length));
      if (kume.boyut <= G) tahminler = null;                   // hepsi: önce tutarlılar, sonra geri kalan
      else {
        const tut = ornek(S.adaylar, Math.min(C, Math.floor(G / 2)), r);
        const dis = new Uint32Array(G - tut.length);
        for (let i = 0; i < dis.length; i++) dis[i] = Math.floor(r() * kume.boyut);
        tahminler = new Uint32Array(G);
        tahminler.set(tut); tahminler.set(dis, tut.length);
      }
    }
    const A = adaylar.length;
    const tutarliMi = new Uint8Array(kume.boyut);
    for (let j = 0; j < C; j++) tutarliMi[S.adaylar[j]] = 1;

    // Değer: orta → Σ n² (küçük iyi); zor → Σ n·log n (küçük iyi = entropi büyük)
    const nlogn = new Float64Array(A + 1);
    for (let i = 2; i <= A; i++) nlogn[i] = i * Math.log(i);
    let enIyi = -1, enDeger = Infinity, esit = 0, adim = 0;
    const dene = (t) => {
      n.fill(0);
      for (let j = 0; j < A; j++) n[skor(t, adaylar[j])]++;
      let d = 0;
      if (seviye === 'orta') for (let k = 0; k < n.length; k++) d += n[k] * n[k];
      else for (let k = 0; k < n.length; k++) d += nlogn[n[k]];
      if (d < enDeger - 1e-9) { enDeger = d; enIyi = t; esit = 1; }
      else if (d <= enDeger + 1e-9) {
        if (seviye === 'zor') {
          // eşitlikte tutarlı olan; ikisi de aynıysa ilk bulunan kalır (tutarlılar önce denenir)
          if (tutarliMi[t] && !tutarliMi[enIyi]) { enIyi = t; }
        } else if (r() * ++esit < 1) enIyi = t;                // orta: eşitler arasında rastgele
      }
    };
    const liste = tahminler || S.adaylar;
    for (let i = 0; i < liste.length; i++) {
      dene(liste[i]);
      if ((++adim & 31) === 0) { const dur = yield enIyi; if (dur) return sonuc(enIyi, !!tutarliMi[enIyi], true); }
    }
    if (!tahminler && seviye === 'zor') {
      for (let t = 0; t < kume.boyut; t++) {
        if (tutarliMi[t]) continue;
        dene(t);
        if ((++adim & 31) === 0) { const dur = yield enIyi; if (dur) return sonuc(enIyi, !!tutarliMi[enIyi], true); }
      }
    }
    return sonuc(enIyi, !!tutarliMi[enIyi]);
  }

  // Eşzamanlı: sonuna kadar hesaplar (bütçe yok).
  V.sec = function (S, o = {}) {
    const t0 = simdi(), u = ureteci(S, o);
    let s = u.next();
    while (!s.done) s = u.next(false);
    return s.value && Object.assign(s.value, { sureMs: simdi() - t0 });
  };

  // Asenkron: her dilimMs'de setTimeout(0) ile tarayıcıya döner; butceMs dolarsa o ana kadarki en iyiyle döner.
  // o.signal iptal ederse AbortError.
  V.secAsync = function (S, o = {}) {
    const dilim = o.dilimMs ?? VARSAYILAN.dilimMs, butce = o.butceMs ?? VARSAYILAN.butceMs;
    const t0 = simdi(), u = ureteci(S, o);
    return new Promise((coz, red) => {
      const iptal = () => { const e = new Error('İptal edildi'); e.name = 'AbortError'; return e; };
      const calis = () => {
        if (o.signal && o.signal.aborted) { red(iptal()); return; }
        try {
          const d0 = simdi();
          let s = u.next(false);
          while (!s.done && simdi() - d0 < dilim) s = u.next(simdi() - t0 > butce);
          if (s.done) { coz(s.value && Object.assign(s.value, { sureMs: simdi() - t0 })); return; }
          if (simdi() - t0 > butce) {                       // bütçe doldu: bir sonraki adımda üreteç yarım sonucu verir
            s = u.next(true);
            while (!s.done) s = u.next(true);
            coz(s.value && Object.assign(s.value, { sureMs: simdi() - t0 }));
            return;
          }
          setTimeout(calis, 0);
        } catch (e) { red(e); }
      };
      calis();
    });
  };

  /* ---------- çelişki ---------- */

  // Adaylar boşsa: hangi tek cevabın kaldırılması kümeyi yeniden doldurur? → { satirlar: [i, ...] } (0'dan).
  // satirlar boşsa "cevaplar birbiriyle çelişiyor". Adaylar doluysa null.
  V.celiski = function (S) {
    if (S.adaylar.length) return null;
    const satirlar = [];
    S.cevaplar.forEach((_, i) => {
      let a = tumu(S.kume.boyut);
      S.cevaplar.forEach((c, j) => { if (j !== i && a.length) a = suz(S.kume, a, c.tahmin, c.kod); });
      if (a.length) satirlar.push(i);
    });
    return { satirlar };
  };

  /* ---------- çıkarım ---------- */

  // Bütün adaylarda bulunan rakamlar (var), hiçbirinde bulunmayanlar (yok), bütün adayların aynı yerde kullandığı
  // rakamlar (yer: { rakam: konum, 1'den }). Adaylar boşsa null.
  V.cikarim = function (S) {
    const { adaylar, kume } = S, H = kume.hane, D = kume.D;
    if (!adaylar.length) return null;
    let ve = 0x3FF, veya = 0;
    for (let j = 0; j < adaylar.length; j++) {
      let mk;
      if (kume.MK) mk = kume.MK[adaylar[j]];
      else { mk = 0; for (let i = 0; i < H; i++) mk |= 1 << D[adaylar[j] * H + i]; }
      ve &= mk; veya |= mk;
    }
    const varlar = [], yoklar = [], yer = {};
    for (let d = 0; d < 10; d++) {
      if (ve & (1 << d)) varlar.push(d);
      if (!(veya & (1 << d))) yoklar.push(d);
    }
    for (let i = 0; i < H; i++) {
      const d = D[adaylar[0] * H + i];
      let ayni = true;
      for (let j = 1; j < adaylar.length && ayni; j++) if (D[adaylar[j] * H + i] !== d) ayni = false;
      if (ayni && !(d in yer)) yer[d] = i + 1;
    }
    return { var: varlar, yok: yoklar, yer };
  };

  /* ---------- ölçüm ---------- */

  // Zor (ya da verilen) çözücünün ilk iki tahmininin hesap süreleri (ms), n rastgele gizli sayıda. Tarayıcıda da çalışır:
  //   SB.solver.olc()  → { ilk: [...], ikinci: [...], enCok, tamIlkMs }
  V.olc = function (o = {}) {
    const ayar = R.ayar(o.ayar), kume = R.kume(ayar), r = R.rng(o.tohum ?? 7), n = o.n ?? 20;
    const ilk = [], ikinci = [];
    for (let k = 0; k < n; k++) {
      const gizli = Math.floor(r() * kume.boyut);
      let S = V.kur(ayar);
      const a = V.sec(S, { seviye: o.seviye || 'zor', r });
      ilk.push(a.sureMs);
      S = V.ele(S, a.tahmin, kume.skor(gizli, a.tahmin));
      const b = V.sec(S, { seviye: o.seviye || 'zor', r });
      ikinci.push(b.sureMs);
    }
    // İlk tahmin hesaplansaydı: bütün sayılar × bütün sayılar entropi taraması
    const t0 = simdi(), nn = new Int32Array(kume.kodSayisi);
    let enIyi = 0, enDeger = Infinity;
    const T = Math.min(kume.boyut, o.tamIlkSinir ?? 5040), A = tumu(kume.boyut);
    for (let t = 0; t < T; t++) {
      nn.fill(0);
      for (let j = 0; j < A.length; j++) nn[kume.skor(t, A[j])]++;
      let d = 0; for (let k = 0; k < nn.length; k++) if (nn[k] > 1) d += nn[k] * Math.log(nn[k]);
      if (d < enDeger) { enDeger = d; enIyi = t; }
    }
    return { ilk, ikinci, enCok: Math.max(...ikinci), tamIlkMs: simdi() - t0, tamIlkTahmin: kume.dize(enIyi) };
  };

  V.VARSAYILAN = VARSAYILAN;
  if (typeof window !== 'undefined') (window.SB = window.SB || {}).solver = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
})();
