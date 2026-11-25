// chains.js — zincir ve döngü ayrıştırması, uzun zincir paritesi, son oyun çözücüleri. DOM yok.
// Tarayıcıda window.NK.chains (board.js'ten sonra yüklenir), node'da require('./chains.js').
//
// Terimler: serbest kenar = çekilmemiş kenar. Kutu serbest 2 ise "zincir kutusu", 1 ise "açık" (alınabilir),
// 3–4 ise "kavşak" (zincir değil; zincirler kavşağa açılabilir). Zincirin iki ucu: tahta kenarı ('kenar'),
// kavşak kutusu ('kavsak') ya da açılmış uçta kapalı ('kapali': kutunun kalan tek kenarı zincirin içine bakar).
//
//   parcala(d)            → { parcalar: [parca], kavsaklar: [k], saf, serbestKenar }
//   coz(parcalar)         → { deger, ac, bicim } — açmak zorunda olanın kalan kutulardan net kazancı (kesin, ezberli)
//   cevap(parcalar, i, b) → { karar: 'hepsi' | 'ikisiHaric' | 'dorduHaric', deger } — i. parça açılınca alanın kararı
//   tahtaCoz(d, o)        → { deger, hamle } | null — tahta üstünde kesin arama (serbest kenar ≤ o.sinir)
//   analiz(gecmis, son)   → kaybedenin kaybettiği hamle, uzun zincir sayısı
(function () {
  'use strict';

  const BD = (typeof window !== 'undefined' && window.NK && window.NK.board) || require('./board.js');

  /* ---------- ayrıştırma ---------- */

  function parcala(d) {
    const G = d.G, KK = G.KENAR_KUTU, KE = G.KUTU_KENAR;
    const dugum = (k) => k >= 0 && d.sahip[k] < 0 && d.serbest[k] <= 2;
    const ote = (e, k) => (KK[2 * e] === k ? KK[2 * e + 1] : KK[2 * e]);
    const serbestler = (k) => { const l = []; for (let i = 0; i < 4; i++) { const e = KE[4 * k + i]; if (!d.cizgi[e]) l.push(e); } return l; };
    const ic = (k) => serbestler(k).filter(e => dugum(ote(e, k)));         // zincirin içine (başka zincir kutusuna) giden kenarlar
    const dis = (k) => serbestler(k).filter(e => !dugum(ote(e, k)));       // uç kenarları (tahta kenarı ya da kavşak)

    let serbestKenar = 0;
    for (let e = 0; e < G.E; e++) if (!d.cizgi[e]) serbestKenar++;
    const kavsaklar = [];
    for (let k = 0; k < G.K; k++) if (d.sahip[k] < 0 && d.serbest[k] >= 3) kavsaklar.push(k);

    const gorulen = new Uint8Array(G.K), parcalar = [];
    for (let s = 0; s < G.K; s++) {
      if (gorulen[s] || !dugum(s)) continue;
      const bilesen = [];                                    // bileşeni topla
      const yigin = [s];
      gorulen[s] = 1;
      while (yigin.length) {
        const k = yigin.pop();
        bilesen.push(k);
        for (const e of ic(k)) { const j = ote(e, k); if (!gorulen[j]) { gorulen[j] = 1; yigin.push(j); } }
      }
      const acik = bilesen.some(k => d.serbest[k] === 1);
      const dongu = bilesen.length > 2 && bilesen.every(k => d.serbest[k] === 2 && ic(k).length === 2);
      // sırala: döngüde herhangi bir kutudan, zincirde bir uçtan yürü
      const bas = dongu ? bilesen[0] : bilesen.find(k => ic(k).length <= 1);
      const kutular = [bas], kenarlar = [];
      let onceki = -1, k = bas, gelen = -1;
      if (!dongu) kenarlar.push(...dis(bas).slice(0, bilesen.length === 1 ? 2 : 1));
      for (;;) {
        const sonraki = ic(k).find(e => e !== gelen && ote(e, k) !== onceki);
        if (sonraki === undefined) break;
        const j = ote(sonraki, k);
        if (j === bas) { kenarlar.push(sonraki); break; }   // döngü kapandı
        kenarlar.push(sonraki);
        kutular.push(j);
        onceki = k; k = j; gelen = sonraki;
      }
      const uclar = [];
      if (!dongu) {
        const ucBilgi = (kutu, e) => (e === undefined ? { tip: 'kapali', kutu: -1, e: -1 } : { tip: ote(e, kutu) < 0 ? 'kenar' : 'kavsak', kutu: ote(e, kutu), e });
        if (kutular.length === 1) {
          const l = dis(bas);
          uclar.push(ucBilgi(bas, l[0]), ucBilgi(bas, l[1]));
        } else {
          const son = kutular[kutular.length - 1];
          uclar.push(ucBilgi(bas, dis(bas)[0]), ucBilgi(son, dis(son)[0]));
          if (dis(son)[0] !== undefined) kenarlar.push(dis(son)[0]);
        }
      }
      parcalar.push({ tur: dongu ? 'dongu' : 'zincir', kutular, kenarlar, uclar, uzunluk: kutular.length, uzun: !dongu && kutular.length >= 3, acik });
    }
    return { parcalar, kavsaklar, saf: kavsaklar.length === 0, serbestKenar };
  }

  const uzunZincirler = (parcalar) => parcalar.filter(p => p.uzun).length;

  // Orta oyunda olacak uzun zincir sayısının kaba tahmini: mevcut uzun zincirler + kavşak bölgeleri
  // (serbest ≥ 3 kutuların serbest kenarlarla bağlı kümeleri) — 3 ve daha büyük bölge bir uzun zincir daha verir.
  function uzunZincirTahmini(d, P = parcala(d)) {
    const G = d.G, KK = G.KENAR_KUTU, KE = G.KUTU_KENAR;
    const buyuk = (k) => k >= 0 && d.sahip[k] < 0 && d.serbest[k] >= 3;
    const gorulen = new Uint8Array(G.K);
    let bolge = 0;
    for (const s of P.kavsaklar) {
      if (gorulen[s]) continue;
      let boy = 0;
      const yigin = [s];
      gorulen[s] = 1;
      while (yigin.length) {
        const k = yigin.pop();
        boy++;
        for (let i = 0; i < 4; i++) {
          const e = KE[4 * k + i];
          if (d.cizgi[e]) continue;
          const j = KK[2 * e] === k ? KK[2 * e + 1] : KK[2 * e];
          if (buyuk(j) && !gorulen[j]) { gorulen[j] = 1; yigin.push(j); }
        }
      }
      if (boy >= 3) bolge++;
    }
    return uzunZincirler(P.parcalar) + bolge;
  }

  // Uzun zincir kuralı: m×n noktalı tahtada başlayan oyuncu (nokta + uzun zincir) toplamının çift, öteki tek olmasını ister.
  function parite(d, tahmin = uzunZincirTahmini(d)) {
    const nokta = d.m * d.n, toplam = nokta + tahmin;
    const iyi = (p) => (p === d.baslayan) === (toplam % 2 === 0);
    return { nokta, uzun: tahmin, toplam, iyi, uygun: [iyi(0), iyi(1)] };
  }

  /* ---------- parça çözücüsü (saf loony son oyun) ---------- */

  // V(zincirler, döngüler): açmak zorunda olanın net kazancı. Açılan parçayı alan taraf:
  //   zincir 1: hepsini alır (1 + V')            · zincir 2: ortadan açılır (sert ikram): 2 + V'
  //   zincir k≥3: max(k + V', k − 4 − V')       (hepsi · ikisi hariç: kontrolü korur)
  //   döngü k:    max(k + V', k − 8 − V')       (hepsi · dördü hariç)
  // Uçtan açılan 2'li (yarım gönüllü ikram) reddedilebilir: max(2 + V', −2 − V'); açan bunu hiç seçmez.
  const ezber = new Map();
  function V(z, dl) {
    if (!z.length && !dl.length) return 0;
    const a = z.join(',') + '|' + dl.join(',');
    const m = ezber.get(a);
    if (m !== undefined) return m;
    let en = -Infinity;
    for (let i = 0; i < z.length; i++) {
      if (i && z[i] === z[i - 1]) continue;
      const k = z[i], v = V(z.slice(0, i).concat(z.slice(i + 1)), dl);
      const alan = k === 1 ? 1 + v : k === 2 ? 2 + v : Math.max(k + v, k - 4 - v);
      if (-alan > en) en = -alan;
    }
    for (let i = 0; i < dl.length; i++) {
      if (i && dl[i] === dl[i - 1]) continue;
      const k = dl[i], v = V(z, dl.slice(0, i).concat(dl.slice(i + 1)));
      const alan = Math.max(k + v, k - 8 - v);
      if (-alan > en) en = -alan;
    }
    en += 0;                                                // −0 → 0
    ezber.set(a, en);
    return en;
  }

  const ayir = (parcalar, haric = -1) => {
    const z = [], dl = [];
    parcalar.forEach((p, i) => { if (i !== haric) (p.tur === 'dongu' ? dl : z).push(p.uzunluk); });
    return [z.sort((a, b) => a - b), dl.sort((a, b) => a - b)];
  };

  // parcalar: [{ tur: 'zincir'|'dongu', uzunluk }] (parcala çıktısı da olur). Döner açılacak parçanın indeksi ve biçimi.
  function coz(parcalar) {
    if (!parcalar.length) return { deger: 0, ac: -1, bicim: null };
    let en = -Infinity, ac = -1;
    const denenen = new Set();
    parcalar.forEach((p, i) => {
      const ad = p.tur + p.uzunluk;
      if (denenen.has(ad)) return;
      denenen.add(ad);
      const v = -cevap(parcalar, i, 'orta').deger;
      if (v > en) { en = v; ac = i; }
    });
    const p = parcalar[ac];
    return { deger: en + 0, ac, bicim: p.tur === 'dongu' ? 'dongu' : p.uzunluk === 2 ? 'orta' : 'uc' };
  }

  // i. parça açıldı (bicim: 'uc' · 'orta' · 'dongu'); alan taraf ne yapmalı? deger: alanın net kazancı (kalan her şeyle)
  function cevap(parcalar, i, bicim = 'uc') {
    const p = parcalar[i], k = p.uzunluk, v = V(...ayir(parcalar, i));
    let hepsi = k + v, haric = -Infinity, ad = 'ikisiHaric';
    if (p.tur === 'dongu') { haric = k - 8 - v; ad = 'dorduHaric'; }
    else if (k >= 3 || (k === 2 && bicim !== 'orta')) haric = k - 4 - v;
    return haric > hepsi ? { karar: ad, deger: haric + 0 } : { karar: 'hepsi', deger: hepsi + 0 };
  }

  /* ---------- tahta üstünde kesin arama ---------- */

  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Serbest kenar sayısı F ≤ sinir iken kesin değer: sıradakinin kalan kutulardan net kazancı ve en iyi çizgi.
  // Ezber Int8Array(2^F): anahtar çekilmiş serbest kenarların maskesi (değer yalnız konuma bağlı).
  // Budama (değeri değiştirmez): yeni alınabilir kutu yaratmayan bir alma hamlesi varsa yalnız o oynanır (baskın);
  // yoksa alma hamleleri + (alma hamlesi ≤ 2 iken) almayan hamleler ("ikisi/dördü hariç" reddi bu noktalarda olur).
  // o: { sinir (22), butceMs } — bütçe aşılırsa null.
  function tahtaCoz(d, o = {}) {
    const sinir = o.sinir ?? 22, G = d.G, KK = G.KENAR_KUTU;
    const kenar = [];
    for (let e = 0; e < G.E; e++) if (!d.cizgi[e]) kenar.push(e);
    const F = kenar.length;
    if (F > sinir) return null;
    if (!F) return { deger: 0, hamle: -1, dugum: 0 };
    const A = new Int16Array(F), Bk = new Int16Array(F);
    kenar.forEach((e, i) => { A[i] = KK[2 * e]; Bk[i] = KK[2 * e + 1]; });
    const sb = new Int8Array(G.K);
    for (let k = 0; k < G.K; k++) sb[k] = d.sahip[k] < 0 ? d.serbest[k] : 0;
    const TAM = F === 31 ? 0x7FFFFFFF : (1 << F) - 1;
    const ezb = new Int8Array(1 << F).fill(-128);
    const son = o.butceMs ? simdi() + o.butceMs : Infinity;
    let dugum = 0, kesildi = false;
    const adaylar = new Int32Array(F * (F + 1));            // derinlik başına aday listesi (ayırmasız)

    function liste(mask, taban) {
      let n = 0, alma = 0, baskin = -1;
      for (let i = 0; i < F; i++) {
        if (mask & (1 << i)) continue;
        const a = A[i], b = Bk[i];
        const c = (a >= 0 && sb[a] === 1 ? 1 : 0) + (b >= 0 && sb[b] === 1 ? 1 : 0);
        if (!c) continue;
        alma++;
        const ot = c === 2 ? -2 : sb[a] === 1 ? b : a;      // alınmayan taraftaki kutu
        if (c === 2 || ot < 0 || sb[ot] >= 3) { baskin = i; break; }
        adaylar[taban + n++] = i;
      }
      if (baskin >= 0) { adaylar[taban] = baskin; return 1; }
      if (alma === 0 || alma <= 2) {
        for (let i = 0; i < F; i++) {
          if (mask & (1 << i)) continue;
          const a = A[i], b = Bk[i];
          if ((a >= 0 && sb[a] === 1) || (b >= 0 && sb[b] === 1)) continue;
          adaylar[taban + n++] = i;
        }
      }
      return n;
    }

    function ara(mask, derin) {
      if (mask === TAM) return 0;
      const m = ezb[mask];
      if (m !== -128) return m;
      if ((++dugum & 4095) === 0 && simdi() > son) kesildi = true;
      if (kesildi) return 0;
      const taban = derin * (F + 1), n = liste(mask, taban);
      let en = -127;
      for (let j = 0; j < n; j++) {
        const i = adaylar[taban + j], a = A[i], b = Bk[i];
        let c = 0;
        if (a >= 0 && --sb[a] === 0) c++;
        if (b >= 0 && --sb[b] === 0) c++;
        const v = c ? c + ara(mask | (1 << i), derin + 1) : -ara(mask | (1 << i), derin + 1);
        if (a >= 0) sb[a]++;
        if (b >= 0) sb[b]++;
        if (v > en) en = v;
      }
      if (!kesildi) ezb[mask] = en;
      return en;
    }

    // kök: en iyi hamleyi de bul
    const n = liste(0, 0), kok = Array.from(adaylar.slice(0, n));
    let en = -Infinity, hamle = -1;
    for (const i of kok) {
      const a = A[i], b = Bk[i];
      let c = 0;
      if (a >= 0 && --sb[a] === 0) c++;
      if (b >= 0 && --sb[b] === 0) c++;
      const v = c ? c + ara(1 << i, 1) : -ara(1 << i, 1);
      if (a >= 0) sb[a]++;
      if (b >= 0) sb[b]++;
      if (v > en) { en = v; hamle = kenar[i]; }
    }
    if (kesildi) return null;
    return { deger: en + 0, hamle, dugum };
  }

  /* ---------- kesin değer ve oyun sonu analizi ---------- */

  // Konumun kesin değeri (sıradakinin kalan kutulardan net kazancı) ya da bilinmiyorsa null.
  function kesinDeger(d, o = {}) {
    const t = tahtaCoz(d, o);
    if (t) return t.deger;
    if (BD.guvenli(d).length || BD.alinabilir(d).length) return null;
    const P = parcala(d);
    if (!P.saf || P.parcalar.some(p => p.acik)) return null;
    return coz(P.parcalar).deger;
  }

  // gecmis: [{ durum (hamleden önceki), e }], son: bitmiş durum. Kaybedenin umudu (puan farkı + kesin değer) son kez
  // ≥ 0'dan < 0'a düştüğü hamlesi; erken, çözülemeyen konumlara bakılmaz. o: { sinir, butceMs } (konum başına)
  // analizUretec her konumdan sonra sıra verir (tarayıcı donmasın); analiz eşzamanlı sürücüsü.
  function* analizUretec(gecmis, son, o = {}) {
    const k = BD.kazanan(son);
    const ilkLoony = gecmis.findIndex(g => BD.guvenli(g.durum).length === 0);
    const uzun = ilkLoony >= 0 ? uzunZincirler(parcala(gecmis[ilkLoony].durum).parcalar) : null;
    if (k === null || k === 'berabere') return { kaybeden: null, hamle: null, uzunZincir: uzun };
    const L = 1 - k;
    const umut = (d) => {
      const v = kesinDeger(d, o);
      return v === null ? null : d.puan[L] - d.puan[1 - L] + (d.bitti ? 0 : d.sira === L ? v : -v);
    };
    let hamle = null, sonraki = umut(son);
    for (let i = gecmis.length - 1; i >= 0 && sonraki !== null; i--) {
      const { durum, e } = gecmis[i], once = umut(durum);
      yield;
      if (once === null) break;
      if (durum.sira === L && once >= 0 && sonraki < 0) { hamle = { indeks: i, e, once, sonra: sonraki }; break; }
      sonraki = once;
    }
    return { kaybeden: L, hamle, uzunZincir: uzun };
  }

  function analiz(gecmis, son, o) {
    const g = analizUretec(gecmis, son, o);
    let a;
    do a = g.next(); while (!a.done);
    return a.value;
  }

  const CH = { parcala, uzunZincirler, uzunZincirTahmini, parite, coz, cevap, V: (z, dl = []) => V(z.slice().sort((a, b) => a - b), dl.slice().sort((a, b) => a - b)), tahtaCoz, kesinDeger, analiz, analizUretec };
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).chains = CH;
  if (typeof module !== 'undefined' && module.exports) module.exports = CH;
})();
