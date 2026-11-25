// ai.js — bilgisayar rakip. DOM yok; tarayıcıda window.DT.ai, node'da require('./ai.js'). Kuralları board.js'ten alır.
//
//   const r = await DT.ai.dusun(durum, { zorluk: 'zor', butceMs: 1500, derinlik: 32 }, { signal })
//   const r = DT.ai.dusunSenkron(durum, { zorluk: 'orta', derinlik: 4 })      // testler: sabit derinlik, aynı karar
//   r = { hamle: { kaynak, hedef, al, al2 }, derinlik, deger, dugum }
//
// Negamax alpha-beta + iterative deepening; transposition table (tam konum anahtarı, Zobrist gerekmez); hamle
// sıralaması: TT hamlesi → alma → rakibin deliğini kapatma → killer → açık ikili kurma. Ufuk için derinlik 0'da yalnız
// alma hamleleriyle 2 kat sakinlik araması. Arama durum yığını üstünde kopyalayarak ilerler (kat başına beş tam sayı).
// Ana thread donmasın diye kalan derinliği ≥ 4 olan düğümler üreteçtir (function*); her çocuktan sonra yield eder,
// sürücü ~12 ms'lik dilimlerle çalışıp tarayıcıya sıra verir. Son 3 kat düz özyinelemedir (hız).
(function () {
  'use strict';

  const BD = (typeof module !== 'undefined' && module.exports) ? require('./board.js') : window.DT.board;
  const { pop, graf, uret, anahtarHam, alinabilir, TAM } = BD;
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const KAZANMA = 10000, KESIN = 9000, SONSUZ = 30000;
  const MAKS_KAT = 96;

  /* ---------- değerlendirme ---------- */

  // Evreye göre ağırlıklar: [yerleştirme, hareket, uçma]. Taş farkı (100) hepsinden ağırdır.
  const AGIRLIK = {
    tas: 100,
    hamle: [2, 6, 0],          // hareket serbestliği (kendi taş × boş komşu)
    kapali: [6, 10, 3],        // kurulu değirmen
    acik: [10, 8, 15],         // iki taş + boş üçüncü
    cift: [40, 25, 50],        // aynı anda iki ayrı delik (çift tehdit)
    zw: [25, 45, 10],          // çift değirmen: değirmendeki taş gidip gelerek her seferinde değirmen kurar
    blok: [3, 10, 0],          // rakibin kımıldayamayan taşı
    kavsak: [6, 3, 0],         // orta halkanın dört orta noktası (4 komşu)
    orta: [2, 1, 0],           // diğer orta noktalar (3 komşu)
  };
  const KAVSAK = (1 << 9) | (1 << 11) | (1 << 13) | (1 << 15);
  const ORTA = [1, 3, 5, 7, 17, 19, 21, 23].reduce((m, i) => m | (1 << i), 0);

  const evreNo = (tp, el, ucma) => (el > 0 ? 0 : (ucma && pop(tp) === 3 ? 2 : 1));

  // p tarafının puanı (rakibe göre değil, mutlak). bloke: rakibin kımıldayamayan taş sayısı (dışarıda hesaplanır)
  function taraf(tp, tq, elp, ev, G, bos, hamle, bloke) {
    const W = AGIRLIK;
    let s = (pop(tp) + elp) * W.tas + hamle * W.hamle[ev] + bloke * W.blok[ev];
    s += pop(tp & KAVSAK) * W.kavsak[ev] + pop(tp & ORTA) * W.orta[ev];
    let kapali = 0, acik = 0, delik = 0, delikSay = 0, zw = 0;
    const H = G.HAT;
    for (let k = 0; k < H.length; k++) {
      const h = H[k], a = tp & h;
      if (a === h) {
        kapali++;
        if (ev === 2) continue;
        // çift değirmen: hattaki taş s, hattın dışında boş komşu n'ye gidince n'den geçen başka bir hat dolar
        for (let s0 = 0; s0 < 24; s0++) {
          if (!(h & (1 << s0))) continue;
          let kom = G.KOMSU_MASKE[s0] & bos & ~h;
          while (kom) {
            const n = 31 - Math.clz32(kom); kom &= ~(1 << n);
            for (const L of G.NOKTA_HATLARI[n]) {
              const hl = H[L];
              if (hl & (1 << s0)) continue;
              if ((tp & hl) === (hl & ~(1 << n))) { zw++; break; }
            }
          }
        }
      } else if (!(tq & h) && pop(a) === 2) {
        acik++;
        const d = h & ~a;
        if (!(delik & d)) { delik |= d; delikSay++; }
      }
    }
    s += kapali * W.kapali[ev] + acik * W.acik[ev] + zw * W.zw[ev];
    if (delikSay >= 2) s += W.cift[ev];
    return s;
  }

  // Sıradaki (p) açısından değer. ucma: kural.
  function degerlendir(tp, tq, elp, elq, kural, G) {
    const bos = ~(tp | tq) & TAM;
    let hp = 0, hq = 0, blokP = 0, blokQ = 0;
    for (let i = 0; i < 24; i++) {
      const b = 1 << i;
      if (tp & b) { const m = pop(G.KOMSU_MASKE[i] & bos); hp += m; if (!m) blokP++; }
      else if (tq & b) { const m = pop(G.KOMSU_MASKE[i] & bos); hq += m; if (!m) blokQ++; }
    }
    const evP = evreNo(tp, elp, kural.ucma), evQ = evreNo(tq, elq, kural.ucma);
    let v = taraf(tp, tq, elp, evP, G, bos, hp, evQ === 2 ? 0 : blokQ) - taraf(tq, tp, elq, evQ, G, bos, hq, evP === 2 ? 0 : blokP);
    if (v > KESIN - 1) v = KESIN - 1; else if (v < 1 - KESIN) v = 1 - KESIN;
    return v;
  }

  /* ---------- transposition table ---------- */

  const TT_BIT = 18, TT_N = 1 << TT_BIT;
  const ttAnahtar = new Float64Array(TT_N), ttSkor = new Int16Array(TT_N), ttHamle = new Int32Array(TT_N);
  const ttDerinlik = new Int8Array(TT_N), ttBayrak = new Uint8Array(TT_N);   // bayrak: 2 bit tür + 6 bit yaş
  const TAM_DEGER = 1, ALT = 2, UST = 3;
  let yas = 0;

  function ttTemizle() { ttAnahtar.fill(-1); ttBayrak.fill(0); yas = 0; }
  ttTemizle();
  const ttIndeks = (t0, t1, H) => (Math.imul(t0 ^ (H << 24), 0x9E3779B1) ^ Math.imul(t1, 0x85EBCA6B)) >>> (32 - TT_BIT);
  // kesin (mat) skorları kökten bağımsız saklamak için kata göre düzelt
  const ttyeYaz = (s, kat) => (s > KESIN ? s + kat : s < -KESIN ? s - kat : s);
  const ttdenOku = (s, kat) => (s > KESIN ? s - kat : s < -KESIN ? s + kat : s);

  /* ---------- arama ---------- */

  // Bir aramanın bütün durumu (yeniden giriş ve eşzamanlı aramalar için nesnede)
  function arayici(d, secenek) {
    const kural = d.kurallar, G = graf(kural.kosegen);
    const A = {
      kural, G, tt: secenek.tt !== false,
      T0: new Int32Array(MAKS_KAT + 2), T1: new Int32Array(MAKS_KAT + 2), E0: new Int8Array(MAKS_KAT + 2), E1: new Int8Array(MAKS_KAT + 2),
      SAYAC: new Int16Array(MAKS_KAT + 2), SONALMA: new Int16Array(MAKS_KAT + 2), ANAHTAR: new Float64Array(MAKS_KAT + 2),
      HAM: Array.from({ length: MAKS_KAT + 2 }, () => []), PUAN: Array.from({ length: MAKS_KAT + 2 }, () => []),
      K1: new Int32Array(MAKS_KAT + 2), K2: new Int32Array(MAKS_KAT + 2),
      kokSira: d.sira, gecmis: d.anahtarlar.slice(), dugum: 0, durdur: false,
    };
    A.T0[0] = d.tas[0]; A.T1[0] = d.tas[1]; A.E0[0] = d.el[0]; A.E1[0] = d.el[1];
    A.SAYAC[0] = d.tassiz; A.SONALMA[0] = 0;
    A.ANAHTAR[0] = anahtarHam(d.tas[0], d.tas[1], d.el[0], d.el[1], d.sira);
    return A;
  }

  const siraOf = (A, kat) => (A.kokSira + kat) & 1;

  // Kat `kat`'taki konuma h hamlesini uygular, kat+1'e yazar. Döner: alma yapıldı mı.
  function yap(A, kat, h) {
    const p = siraOf(A, kat), k = (h & 31) - 1, hd = (h >> 5) & 31, a1 = ((h >> 10) & 31) - 1, a2 = ((h >> 15) & 31) - 1;
    let t0 = A.T0[kat], t1 = A.T1[kat], e0 = A.E0[kat], e1 = A.E1[kat];
    let tp = p ? t1 : t0, tq = p ? t0 : t1;
    const yerlestirme = k < 0;
    if (yerlestirme) { if (p) e1--; else e0--; } else tp &= ~(1 << k);
    tp |= 1 << hd;
    let aldi = false;
    if (a1 >= 0) { tq &= ~(1 << a1); aldi = true; }
    if (a2 >= 0) tq &= ~(1 << a2);
    if (p) { t1 = tp; t0 = tq; } else { t0 = tp; t1 = tq; }
    const n = kat + 1;
    A.T0[n] = t0; A.T1[n] = t1; A.E0[n] = e0; A.E1[n] = e1;
    A.SAYAC[n] = aldi ? 0 : (yerlestirme ? A.SAYAC[kat] : A.SAYAC[kat] + 1);
    A.SONALMA[n] = aldi ? n : A.SONALMA[kat];
    A.ANAHTAR[n] = anahtarHam(t0, t1, e0, e1, 1 - p);
    return aldi;
  }

  // Düğüm başı kesin sonuç: null (sürüyor) ya da skor (sıradaki açısından). Kök için çağrılmaz.
  function kesinSonuc(A, kat) {
    const p = siraOf(A, kat), tp = p ? A.T1[kat] : A.T0[kat], elp = p ? A.E1[kat] : A.E0[kat];
    if (elp === 0 && pop(tp) < 3) return -(KAZANMA - kat);
    const k = A.kural;
    if (k.tekrar) {
      // Arama yolunda döngü: beraberlik say. Oyun geçmişiyle birlikte: yalnız gerçekten k.tekrar'ıncı kez olacaksa.
      // (Geçmişte bir kez görülmüş konuma dönmek oyunu bitirmez; kaybeden taraf bunu kurtuluş sanmasın.)
      const a = A.ANAHTAR[kat];
      for (let j = Math.max(1, A.SONALMA[kat]); j < kat; j++) if (A.ANAHTAR[j] === a) return 0;
      if (A.SONALMA[kat] === 0) {
        let n = 1;
        for (const x of A.gecmis) if (x === a) n++;
        if (n >= k.tekrar) return 0;
      }
    }
    if (k.tassizHamle && A.SAYAC[kat] >= k.tassizHamle) return 0;
    return null;
  }

  // Kat için hamleleri üretir ve sıralar (A.HAM[kat]). Döner: hamle sayısı.
  function hazirla(A, kat, ttHamlesi, yalnizAlma) {
    const p = siraOf(A, kat), tp = p ? A.T1[kat] : A.T0[kat], tq = p ? A.T0[kat] : A.T1[kat], elp = p ? A.E1[kat] : A.E0[kat];
    const l = A.HAM[kat], pu = A.PUAN[kat], G = A.G;
    l.length = 0;
    uret(tp, tq, elp, A.kural, G, l);
    if (yalnizAlma) {
      let w = 0;
      for (let r = 0; r < l.length; r++) if (((l[r] >> 10) & 31) > 0) l[w++] = l[r];
      l.length = w;
    }
    const n = l.length;
    if (n < 2) return n;
    // rakibin delikleri (iki taş + boş üçüncü) ve rakibin açık ikililerindeki taşları
    const bos = ~(tp | tq) & TAM;
    let rakipDelik = 0, rakipIkili = 0;
    for (let k = 0; k < G.HAT.length; k++) {
      const h = G.HAT[k], b = tq & h;
      if (pop(b) === 2 && (bos & h)) { rakipDelik |= bos & h; rakipIkili |= b; }
    }
    pu.length = n;
    for (let r = 0; r < n; r++) {
      const h = l[r], hd = (h >> 5) & 31, a1 = ((h >> 10) & 31) - 1, k = (h & 31) - 1;
      let s = G.KOMSU[hd].length;
      if (h === ttHamlesi) s += 1e6;
      else {
        if (a1 >= 0) s += 10000 + (rakipIkili & (1 << a1) ? 50 : 0) + G.KOMSU[a1].length;
        if (rakipDelik & (1 << hd)) s += 5000;
        if (h === A.K1[kat]) s += 3000; else if (h === A.K2[kat]) s += 2900;
        const yeni = (k >= 0 ? tp & ~(1 << k) : tp) | (1 << hd);
        for (const L of G.NOKTA_HATLARI[hd]) { const hl = G.HAT[L]; if (!(tq & hl) && pop(yeni & hl) === 2) s += 400; }
      }
      pu[r] = s;
    }
    // ekleme sıralaması (azalan)
    for (let i = 1; i < n; i++) {
      const h = l[i], s = pu[i];
      let j = i - 1;
      while (j >= 0 && pu[j] < s) { l[j + 1] = l[j]; pu[j + 1] = pu[j]; j--; }
      l[j + 1] = h; pu[j + 1] = s;
    }
    return n;
  }

  function degerKat(A, kat) {
    const p = siraOf(A, kat);
    return p
      ? degerlendir(A.T1[kat], A.T0[kat], A.E1[kat], A.E0[kat], A.kural, A.G)
      : degerlendir(A.T0[kat], A.T1[kat], A.E0[kat], A.E1[kat], A.kural, A.G);
  }

  // Sakinlik: yalnız alma hamleleri, en çok qd kat
  function sakin(A, kat, alpha, beta, qd) {
    A.dugum++;
    const ks = kesinSonuc(A, kat);
    if (ks !== null) return ks;
    let sp = degerKat(A, kat);
    if (qd <= 0 || kat >= MAKS_KAT) return sp;
    if (sp >= beta) return sp;
    if (sp > alpha) alpha = sp;
    const n = hazirla(A, kat, 0, true);
    if (!n) {
      // alma yok: hamlesiz kalma kontrolü (yerleştirmede hep hamle vardır)
      return sp;
    }
    const l = A.HAM[kat].slice(0, n);
    for (const h of l) {
      yap(A, kat, h);
      const v = -sakin(A, kat + 1, -beta, -alpha, qd - 1);
      if (v > sp) sp = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return sp;
  }

  function ttBak(A, kat, derinlik, alpha, beta, cikti) {
    cikti.hamle = 0;
    if (!A.tt) return null;
    const t0 = A.T0[kat], t1 = A.T1[kat], key = A.ANAHTAR[kat];
    const e0 = A.E0[kat], e1 = A.E1[kat], s = e0 + e1, H = s > 0 ? 18 - s : 18 + siraOf(A, kat);
    const i = ttIndeks(t0, t1, H);
    cikti.i = i;
    if (ttAnahtar[i] !== key) { cikti.hamle = 0; return null; }
    cikti.hamle = ttHamle[i];
    if (ttDerinlik[i] < derinlik) return null;
    const v = ttdenOku(ttSkor[i], kat), tur = ttBayrak[i] & 3;
    if (tur === TAM_DEGER) return v;
    if (tur === ALT && v >= beta) return v;
    if (tur === UST && v <= alpha) return v;
    return null;
  }

  function ttKaydet(A, i, kat, derinlik, v, alpha0, beta, hamle) {
    if (!A.tt || A.durdur) return;
    const tur = v <= alpha0 ? UST : v >= beta ? ALT : TAM_DEGER;
    if ((ttBayrak[i] >> 2) !== yas || derinlik >= ttDerinlik[i]) {
      ttAnahtar[i] = A.ANAHTAR[kat]; ttSkor[i] = ttyeYaz(v, kat); ttHamle[i] = hamle; ttDerinlik[i] = derinlik;
      ttBayrak[i] = tur | (yas << 2);
    }
  }

  function killer(A, kat, h) {
    if (((h >> 10) & 31) > 0) return;          // almalar zaten önde
    if (A.K1[kat] !== h) { A.K2[kat] = A.K1[kat]; A.K1[kat] = h; }
  }

  const tt0 = { i: 0, hamle: 0 };

  // Düz özyineleme (son katlar)
  function araHizli(A, kat, derinlik, alpha, beta) {
    A.dugum++;
    const ks = kesinSonuc(A, kat);
    if (ks !== null) return ks;
    if (derinlik <= 0 || kat >= MAKS_KAT) return sakin(A, kat, alpha, beta, 2);
    const tb = tt0;
    const hit = ttBak(A, kat, derinlik, alpha, beta, tb);
    if (hit !== null) return hit;
    const ti = tb.i, th = tb.hamle;
    const n = hazirla(A, kat, th, false);
    if (!n) return -(KAZANMA - kat);
    const l = A.HAM[kat].slice(0, n);
    const alpha0 = alpha;
    let en = -SONSUZ, enH = l[0];
    for (const h of l) {
      yap(A, kat, h);
      const v = -araHizli(A, kat + 1, derinlik - 1, -beta, -alpha);
      if (v > en) { en = v; enH = h; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) { killer(A, kat, h); break; }
    }
    ttKaydet(A, ti, kat, derinlik, en, alpha0, beta, enH);
    return en;
  }

  const HIZLI = 3;                                // kalan derinlik bu kadar ya da azsa düz özyineleme

  // Üreteç düğüm: her çocuktan sonra sürücüye sıra verir
  function* ara(A, kat, derinlik, alpha, beta) {
    A.dugum++;
    const ks = kesinSonuc(A, kat);
    if (ks !== null) return ks;
    const tb = { i: 0, hamle: 0 };
    const hit = ttBak(A, kat, derinlik, alpha, beta, tb);
    if (hit !== null) return hit;
    const n = hazirla(A, kat, tb.hamle, false);
    if (!n) return -(KAZANMA - kat);
    const l = A.HAM[kat].slice(0, n);
    const alpha0 = alpha;
    let en = -SONSUZ, enH = l[0];
    for (const h of l) {
      yap(A, kat, h);
      const v = derinlik - 1 > HIZLI ? -(yield* ara(A, kat + 1, derinlik - 1, -beta, -alpha)) : -araHizli(A, kat + 1, derinlik - 1, -beta, -alpha);
      if (A.durdur) return 0;
      if (v > en) { en = v; enH = h; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) { killer(A, kat, h); break; }
      yield;
    }
    ttKaydet(A, tb.i, kat, derinlik, en, alpha0, beta, enH);
    return en;
  }

  // Kök: iterative deepening. secenek: { derinlik (en çok), gurultu, rastgele }
  // Sonuç her tamamlanan derinlikte A.sonuc'a yazılır; durdurulursa en iyi bilinen döner.
  function* kok(A, secenek) {
    const kat = 0;
    const n = hazirla(A, kat, 0, false);
    let kokler = A.HAM[0].slice(0, n).map(h => ({ h, v: 0 }));
    if (!n) throw new Error('Yasal hamle yok');
    if (secenek.kural) kokler = kuralSuzgeci(A, kokler);
    // tercih: alma (yoksa ve rakip tehdit ediyorsa kapatma) hamleleri, en iyiden bu kadar kötü değilse seçilir
    const tercihPay = secenek.tercih || 0;
    const tercihli = tercihPay ? new Set(kuralSuzgeci(A, kokler).map(k => k.h)) : null;
    if (tercihli && tercihli.size === kokler.length) tercihli.clear();
    A.sonuc = { h: kokler[0].h, v: 0, derinlik: 0 };
    if (kokler.length === 1) return A.sonuc;
    const maks = Math.max(1, Math.min(secenek.derinlik || 32, MAKS_KAT - 4));
    const gurultu = secenek.gurultu || 0, r = secenek.rastgele || Math.random;
    for (let derinlik = 1; derinlik <= maks; derinlik++) {
      let alpha = -SONSUZ, en = -SONSUZ, enH = kokler[0].h, tamam = 0;
      for (const k of kokler) {
        yap(A, kat, k.h);
        // gürültülü seviyede her kök hamlesinin tam değeri gerekir (pencere daraltılmaz)
        const a = gurultu ? -SONSUZ : (tercihli && tercihli.has(k.h) ? alpha - tercihPay : alpha);
        const v = derinlik - 1 > HIZLI ? -(yield* ara(A, 1, derinlik - 1, -SONSUZ, -a)) : -araHizli(A, 1, derinlik - 1, -SONSUZ, -a);
        if (A.durdur) break;
        k.v = v; tamam++;
        if (v > en) { en = v; enH = k.h; }
        if (v > alpha) alpha = v;
        yield;
      }
      if (tamam === kokler.length) A.sonuc = { h: enH, v: en, derinlik };
      // yarım iterasyon: ilk aranan eski en iyi hamleydi; bulunan en iyi ondan kötü değil
      else if (tamam > 0) A.sonuc = { h: enH, v: en, derinlik: derinlik - 1 };
      if (A.durdur) break;
      kokler.sort((x, y) => y.v - x.v);
      if (Math.abs(en) >= KESIN) break;
    }
    if (tercihli && tercihli.size && !tercihli.has(A.sonuc.h) && A.sonuc.derinlik > 0) {
      let enT = null;
      for (const k of kokler) if (tercihli.has(k.h) && k.v >= A.sonuc.v - tercihPay && (!enT || k.v > enT.v)) enT = k;
      if (enT) { A.sonuc.h = enT.h; A.sonuc.v = enT.v; }
    }
    if (gurultu && !A.durdur) {
      let enV = -Infinity;
      for (const k of kokler) {
        const v = k.v + (r() * 2 - 1) * gurultu;
        if (v > enV) { enV = v; A.sonuc.h = k.h; A.sonuc.v = k.v; }
      }
    }
    return A.sonuc;
  }

  // Kolay ve orta seviyenin kesin kuralları (az derin arayan da bunları kaçırmasın): alabiliyorsa alır; alamıyor ve rakip
  // tek hamlede değirmen kurabiliyorsa, tehdidi kaldıran hamlelerden birini oynar.
  function kuralSuzgeci(A, kokler) {
    const almalar = kokler.filter(k => ((k.h >> 10) & 31) > 0);
    if (almalar.length) return almalar;
    const p = A.kokSira, q = 1 - p;
    const durumYap = (t0, t1, e0, e1) => ({ tas: [t0, t1], el: [e0, e1], kurallar: A.kural });
    if (!BD.tehdit(durumYap(A.T0[0], A.T1[0], A.E0[0], A.E1[0]), q)) return kokler;
    const kapatan = kokler.filter(k => { yap(A, 0, k.h); return !BD.tehdit(durumYap(A.T0[1], A.T1[1], A.E0[1], A.E1[1]), q); });
    return kapatan.length ? kapatan : kokler;
  }

  /* ---------- dış arayüz ---------- */

  // kolay ve orta değirmen fırsatını ve rakibin değirmenini kesin kuralla ele alır. zor aramaya güvenir ama almayı
  // (ya da kapatmayı) en iyi hamleden yarım taştan az kötüyse yine seçer; çift değirmen gibi açıkça güçlü bir hamle
  // varsa almayı erteleyebilir.
  const ZORLUK = { kolay: { derinlik: 2, gurultu: 20, tt: false, kural: true }, orta: { derinlik: 6, kural: true }, zor: { derinlik: 32, tercih: 60 } };

  function secenekler(o) {
    const z = ZORLUK[o.zorluk || 'orta'] || ZORLUK.orta;
    return Object.assign({}, z, o, { derinlik: o.derinlik || z.derinlik, gurultu: o.gurultu ?? z.gurultu ?? 0 });
  }

  function sonucYap(A) {
    return { hamle: BD.ac(A.sonuc.h), derinlik: A.sonuc.derinlik, deger: A.sonuc.v, dugum: A.dugum };
  }

  function dusunSenkron(d, o = {}) {
    if (d.bitti) throw new Error('Oyun bitti');
    const s = secenekler(o);
    const A = arayici(d, s);
    yas = (yas + 1) & 63;
    const g = kok(A, s);
    const son = s.butceMs ? simdi() + s.butceMs : Infinity;
    let adim;
    do {
      adim = g.next();
      if (!A.durdur && simdi() > son) A.durdur = true;
    } while (!adim.done);
    return sonucYap(A);
  }

  // Tarayıcıya sıra vermenin en hızlı yolu: Node'da setImmediate, tarayıcıda MessageChannel, yoksa setTimeout
  const sira = (() => {
    if (typeof setImmediate === 'function') return () => new Promise(r => setImmediate(r));
    if (typeof MessageChannel === 'function') {
      const kanal = new MessageChannel(), kuyruk = [];
      kanal.port1.onmessage = () => { const r = kuyruk.shift(); if (r) r(); };
      return () => new Promise(r => { kuyruk.push(r); kanal.port2.postMessage(0); });
    }
    return () => new Promise(r => setTimeout(r, 0));
  })();

  async function dusun(d, o = {}, { signal } = {}) {
    if (d.bitti) throw new Error('Oyun bitti');
    const s = secenekler(o);
    const A = arayici(d, s);
    yas = (yas + 1) & 63;
    const g = kok(A, s);
    const son = simdi() + (s.butceMs || 1000);
    const iptal = () => { const e = new Error('Hamle hesabı iptal edildi'); e.name = 'AbortError'; return e; };
    try {
      for (;;) {
        if (signal && signal.aborted) throw iptal();
        const dilim = simdi() + 12;
        let adim;
        do {
          adim = g.next();
          if (adim.done) return sonucYap(A);
          if (!A.durdur && simdi() > son) A.durdur = true;
        } while (simdi() < dilim);
        await sira();
      }
    } finally { g.return(); }
  }

  const AI = {
    dusun, dusunSenkron, yeniOyun: ttTemizle, ZORLUK, AGIRLIK, KAZANMA, KESIN,
    // test ve hata ayıklama
    degerlendir: (d) => {
      const p = d.sira, G = graf(d.kurallar.kosegen);
      return degerlendir(d.tas[p], d.tas[1 - p], d.el[p], d.el[1 - p], d.kurallar, G);
    },
    _arayici: arayici, _yap: yap, _kok: kok, _secenekler: secenekler,
  };
  if (typeof window !== 'undefined') (window.DT = window.DT || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
