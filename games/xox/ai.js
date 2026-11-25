// ai.js — bilgisayar. DOM'a, window'a, Kit'e bakmaz; tarayıcıda XOX.ai, node'da require('./ai.js').
//
//   AI.sec(durum, { zorluk, butceMs, maxDerinlik, dugumSiniri, tohum })        → { r, c, ... }   (eşzamanlı)
//   AI.secAsync(durum, ayar, { signal })                                     → Promise          (dilimli)
//   AI.baslat(durum, ayar) → { adim(dilimMs), bitti, sonuc }                  (adımlayıcı: ikisinin ortak motoru)
//
// Her zorluk önce zorunlu hamle kuralını uygular (eval.zorunlu): kendi beşi > rakibin dördünü kapat > kendi açık dördü.
//   kolay: derinlik 1 (onSkor, savunma ağırlığı düşük: açık üçü bazen kaçırır), %20 ikinci / üçüncü en iyi
//   orta : alpha-beta derinlik 4, 400 ms
//   zor  : sürekli dörtle kazanma (VCF) araması (kendi → oyna; rakibin → yalnız onu kıran adaylar) +
//          iterative deepening alpha-beta, transposition table (Zobrist), killer, 1.5 s
// Arama dilimlenir: üst katmanlar jeneratör (her çocuktan sonra yield), alttaki küçük alt ağaçlar eşzamanlı.
// Zaman / düğüm sınırı her 512 düğümde denetlenir; aşılınca yarım kalan derinlik atılır, son tamamlanan kalır.
(function () {
  'use strict';

  const dugum_ = typeof module !== 'undefined' && module.exports;
  const B = dugum_ ? require('./board.js') : window.XOX.board;
  const E = dugum_ ? require('./eval.js') : window.XOX.eval;
  const { KAZANC } = E;
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const ZORLUK = {
    kolay: { tur: 'kolay' },
    orta: { tur: 'ab', butceMs: 400, maxDerinlik: 4, vcf: false },
    zor: { tur: 'ab', butceMs: 1500, maxDerinlik: 10, vcf: true },
  };
  const GENISLIK = [16, 10, 8];             // aday sayısı: kök, 1. katman, derinler
  const GEN_ESIK = 3;                       // kalan derinlik ≥ bu ise jeneratör (dilimlenebilir)
  const UZATMA = 8;                         // tek cevaplı (zorunlu) hamle zincirinde en çok ek ply
  const VCF_DERINLIK = 12, VCF_DUGUM = 40000;
  const KAZANC_SINIR = KAZANC - 1000;

  /* ---------- transposition table (oyun boyunca saklanır) ---------- */

  const TT_BIT = 19, TT_N = 1 << TT_BIT, TT_M = TT_N - 1;
  const TT = {
    hi: new Int32Array(TT_N), lo: new Int32Array(TT_N), der: new Int8Array(TT_N).fill(-1),
    bay: new Int8Array(TT_N), deg: new Float64Array(TT_N), ham: new Int32Array(TT_N),
  };
  const ALT = 1, UST = 2, TAM = 3;
  function ttTemizle() { TT.der.fill(-1); }
  function ttAl(P) {
    const k = P.lo & TT_M;
    if (TT.der[k] < 0 || TT.hi[k] !== (P.hi | 0) || TT.lo[k] !== (P.lo | 0)) return -1;
    return k;
  }
  function ttKoy(P, der, bay, deg, ham, ply) {
    const k = P.lo & TT_M;
    if (TT.der[k] > der && TT.hi[k] === (P.hi | 0)) return;           // daha derin kaydı koru
    if (deg > KAZANC_SINIR) deg += ply; else if (deg < -KAZANC_SINIR) deg -= ply;
    TT.hi[k] = P.hi | 0; TT.lo[k] = P.lo | 0; TT.der[k] = der; TT.bay[k] = bay; TT.deg[k] = deg; TT.ham[k] = ham;
  }
  const ttDeger = (k, ply) => { const v = TT.deg[k]; return v > KAZANC_SINIR ? v - ply : v < -KAZANC_SINIR ? v + ply : v; };

  /* ---------- aday sıralama ---------- */

  const tamponlar = [];
  function tampon(ply) {
    if (!tamponlar[ply]) tamponlar[ply] = { liste: [], puan: new Float64Array(512), sira: [] };
    return tamponlar[ply];
  }

  // s için sıralı adaylar; ilk: TT hamlesi, killer'lar; genişlik kadar
  function siraliAdaylar(X, s, ply, ttHamle, ucaCevap) {
    const P = X.P, t = tampon(ply);
    let liste = E.adaylar(P, t.liste);
    if (ucaCevap) {
      const cevap = E.ucCevaplari(P, s, liste, t.cevap || (t.cevap = []));
      if (cevap.length) liste = cevap;
    }
    const n = Math.min(liste.length, 512);
    for (let k = 0; k < n; k++) {
      const i = liste[k];
      let v = E.onSkor(P, i, s);
      const a = E.anahtarI(P, i);
      if (a === ttHamle) v += 1e12;
      else if (X.killer[ply * 2] === a) v += 1e11;
      else if (X.killer[ply * 2 + 1] === a) v += 1e10;
      t.puan[k] = v;
    }
    const sira = t.sira;
    sira.length = 0;
    for (let k = 0; k < n; k++) sira.push(k);
    sira.sort((a, b) => t.puan[b] - t.puan[a] || a - b);
    const g = ucaCevap ? Math.max(12, GENISLIK[Math.min(ply, GENISLIK.length - 1)]) : GENISLIK[Math.min(ply, GENISLIK.length - 1)];
    const sonuc = [];
    for (let k = 0; k < sira.length && sonuc.length < g; k++) sonuc.push(liste[sira[k]]);
    return sonuc;
  }

  function killerKoy(X, ply, a) {
    if (X.killer[ply * 2] !== a) { X.killer[ply * 2 + 1] = X.killer[ply * 2]; X.killer[ply * 2] = a; }
  }

  /* ---------- negamax alpha-beta ---------- */

  function denetle(X) {
    if ((++X.dugum & 511) !== 0) return;
    if (X.dugumSiniri && X.dugum >= X.dugumSiniri) X.durdu = true;
    else if (!X.dugumSiniri && simdi() > X.bitis) X.durdu = true;
  }

  // Ortak başlangıç: terminal / zorunlu / TT. Dön: { deger } (bitti) ya da { hamleler, ttK }
  function dugumHazirla(X, der, alfa, beta, s, ply, uz) {
    const P = X.P, o = 3 - s;
    if (E.besYapti(P, o)) return { deger: -(KAZANC - ply) };
    if (E.tamamlamaVar(P, s)) return { deger: KAZANC - ply - 1 };
    let zorla = -1;
    if (E.tamamlamaVar(P, o)) {
      const c = E.tamamlamaHucreleri(P, o);
      if (c.length >= 2) return { deger: -(KAZANC - ply - 2) };
      if (c.length === 1) zorla = c[0];
    }
    // açık üç + rakipte tamamlama yok: açık dört, rakip kapatamaz (rakip dört yapsa da önce beş gelir)
    if (zorla < 0 && E.acikUcVar(P, s)) return { deger: KAZANC - ply - 3 };
    if (der <= 0 && (zorla < 0 || uz >= UZATMA)) return { deger: E.puan(P, s) };
    const ttK = ttAl(P);
    let ttHamle = -1;
    if (ttK >= 0) {
      ttHamle = TT.ham[ttK];
      if (TT.der[ttK] >= der) {
        const v = ttDeger(ttK, ply), b = TT.bay[ttK];
        if (b === TAM || (b === ALT && v >= beta) || (b === UST && v <= alfa)) return { deger: v };
      }
    }
    let hamleler;
    if (zorla >= 0) hamleler = [zorla];
    else if (E.acikUcVar(P, o)) {
      // rakibin açık üçü: yalnız kapatan ve dört yapan kareler (dar, derin arama)
      hamleler = siraliAdaylar(X, s, ply, ttHamle, true);
    } else hamleler = siraliAdaylar(X, s, ply, ttHamle);
    if (!hamleler.length) return { deger: 0 };
    return { hamleler, yeniDer: zorla >= 0 && uz < UZATMA ? der : der - 1, yeniUz: zorla >= 0 ? uz + 1 : uz };
  }

  function araS(X, der, alfa, beta, s, ply, uz) {
    denetle(X);
    if (X.durdu) return 0;
    const h = dugumHazirla(X, der, alfa, beta, s, ply, uz);
    if (h.deger !== undefined) return h.deger;
    const P = X.P, a0 = alfa;
    let en = -Infinity, enH = h.hamleler[0];
    for (const m of h.hamleler) {
      E.koy(P, m, s);
      const v = -araS(X, h.yeniDer, -beta, -alfa, 3 - s, ply + 1, h.yeniUz);
      E.kaldir(P, m);
      if (X.durdu) return 0;
      if (v > en) { en = v; enH = m; }
      if (v > alfa) alfa = v;
      if (alfa >= beta) { killerKoy(X, ply, E.anahtarI(P, m)); break; }
    }
    ttKoy(P, der, en <= a0 ? UST : en >= beta ? ALT : TAM, en, E.anahtarI(P, enH), ply);
    return en;
  }

  function* araG(X, der, alfa, beta, s, ply, uz) {
    denetle(X);
    if (X.durdu) return 0;
    const h = dugumHazirla(X, der, alfa, beta, s, ply, uz);
    if (h.deger !== undefined) return h.deger;
    const P = X.P, a0 = alfa;
    let en = -Infinity, enH = h.hamleler[0];
    for (const m of h.hamleler) {
      E.koy(P, m, s);
      const v = h.yeniDer >= GEN_ESIK
        ? -(yield* araG(X, h.yeniDer, -beta, -alfa, 3 - s, ply + 1, h.yeniUz))
        : -araS(X, h.yeniDer, -beta, -alfa, 3 - s, ply + 1, h.yeniUz);
      E.kaldir(P, m);
      if (X.durdu) return 0;
      yield;
      if (v > en) { en = v; enH = m; }
      if (v > alfa) alfa = v;
      if (alfa >= beta) { killerKoy(X, ply, E.anahtarI(P, m)); break; }
    }
    ttKoy(P, der, en <= a0 ? UST : en >= beta ? ALT : TAM, en, E.anahtarI(P, enH), ply);
    return en;
  }

  /* ---------- VCF: yalnız dört yapan hamlelerle zorunlu kazanç ---------- */

  // s sırada. Dön: kazanç dizisi [s, rakip, s, ...] (pencere dizinleri) ya da null.
  function vcf(P, s, derinlik = VCF_DERINLIK, sayac = { n: 0, sinir: VCF_DUGUM }, basarisiz = new Map()) {
    const o = 3 - s;
    const ben = E.tamamlamaHucreleri(P, s);
    if (ben.length) return [ben[0]];
    if (derinlik <= 0 || sayac.n > sayac.sinir) return null;
    if (sayac.bitis && (sayac.n & 63) === 0 && simdi() > sayac.bitis) { sayac.n = sayac.sinir + 1; return null; }
    const anahtar = P.hi + ':' + P.lo;
    if ((basarisiz.get(anahtar) ?? -1) >= derinlik) return null;
    let tek = -1;
    if (E.tamamlamaVar(P, o)) {
      const c = E.tamamlamaHucreleri(P, o);
      if (c.length >= 2) return null;
      tek = c[0];
    }
    const adaylar = tek >= 0 ? [tek] : E.adaylar(P).slice();
    // dört yapanlar; önce açık dört / çift dört, sonra değerli olanlar
    const dortler = [];
    for (const m of adaylar) {
      const d = E.dortDuzeyi(P, m, s);
      if (d >= 1) dortler.push([m, d * 1e9 + E.onSkor(P, m, s)]);
    }
    dortler.sort((a, b) => b[1] - a[1]);
    for (const [m] of dortler) {
      sayac.n++;
      E.koy(P, m, s);
      const kapat = E.tamamlamaHucreleri(P, s);
      let sonuc = null;
      if (kapat.length >= 2) sonuc = [m];                     // açık dört / çift dört: rakip ikisini kapatamaz
      else if (kapat.length === 1) {
        const r = kapat[0];
        E.koy(P, r, o);
        if (!E.besYapti(P, o)) {
          const alt = vcf(P, s, derinlik - 1, sayac, basarisiz);
          if (alt) sonuc = [m, r, ...alt];
        }
        E.kaldir(P, r);
      }
      E.kaldir(P, m);
      if (sonuc) return sonuc;
      if (sayac.n > sayac.sinir) return null;
    }
    basarisiz.set(anahtar, derinlik);
    return null;
  }

  /* ---------- kök ---------- */

  function* kok(X, adaylarKok) {
    const P = X.P, s = X.s;
    let hamleler = adaylarKok.slice();
    const sonuc = { i: hamleler[0], deger: 0, derinlik: 0 };
    for (let der = 1; der <= X.maxDerinlik; der++) {
      let alfa = -Infinity, en = -1, enV = -Infinity, ilkV = null;
      const degerler = new Map();
      for (let k = 0; k < hamleler.length; k++) {
        const m = hamleler[k];
        E.koy(P, m, s);
        const v = der - 1 >= GEN_ESIK
          ? -(yield* araG(X, der - 1, -Infinity, -alfa, 3 - s, 1, 0))
          : -araS(X, der - 1, -Infinity, -alfa, 3 - s, 1, 0);
        E.kaldir(P, m);
        if (X.durdu) break;
        yield;
        degerler.set(m, v);
        if (k === 0) ilkV = v;
        if (v > enV) { enV = v; en = m; }
        if (v > alfa) alfa = v;
      }
      if (X.durdu) {
        // yarım derinlik: önceki en iyi (ilk aday) tamamen arandıysa ve ondan iyisi bulunduysa onu al
        if (ilkV !== null && en >= 0 && enV > ilkV) { sonuc.i = en; sonuc.deger = enV; }
        break;
      }
      sonuc.i = en; sonuc.deger = enV; sonuc.derinlik = der;
      hamleler.sort((a, b) => (degerler.get(b) ?? -Infinity) - (degerler.get(a) ?? -Infinity));
      if (Math.abs(enV) > KAZANC_SINIR) break;                 // kazanç ya da kayıp kesinleşti
      if (hamleler.length === 1) break;
    }
    return sonuc;
  }

  /* ---------- seçim ---------- */

  function ayarCoz(ayar = {}) {
    const z = ZORLUK[ayar.zorluk] || ZORLUK.orta;
    return Object.assign({}, z, {
      zorluk: ayar.zorluk || 'orta',
      butceMs: ayar.butceMs ?? z.butceMs,
      maxDerinlik: ayar.maxDerinlik ?? z.maxDerinlik,
      dugumSiniri: ayar.dugumSiniri || 0,
      vcf: ayar.vcf ?? z.vcf,
      tohum: ayar.tohum ?? 1,
    });
  }

  function* secG(durum, ayar0, bilgi) {
    const ayar = ayarCoz(ayar0);
    const t0 = simdi();
    const P = E.pencereKur(durum);
    const s = durum.sira, o = 3 - s;
    const bitir = (i, tur, ek = {}) => {
      const [r, c] = E.koord(P, i);
      return Object.assign({ r, c, tur, zorluk: ayar.zorluk, sureMs: Math.round(simdi() - t0), dugum: bilgi.dugum || 0 }, ek);
    };
    if (durum.bitti) return null;

    // ilk hamle: ortaya yakın (biraz tohumlu)
    if (!P.bb) {
      const rnd = B.rng(ayar.tohum * 2654435761 >>> 0);
      const i = E.adaylar(P)[0];
      const kay = [[0, 0], [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(rnd() * 6)];
      const [r, c] = E.koord(P, i);
      const j = E.hucre(P, r + kay[0], c + kay[1]);
      return bitir(B.gecerliMi(durum, r + kay[0], c + kay[1]) ? j : i, 'acilis');
    }

    const z = E.zorunlu(P, s);
    if (z) return bitir(z.i, z.tur);

    if (ayar.tur === 'kolay') {
      const rnd = B.rng((ayar.tohum * 40503 + P.tasSay * 2246822519) >>> 0);
      const liste = E.adaylar(P).map(i => [i, E.onSkor(P, i, s, .5) * (1 + (rnd() - .5) * .1)]);
      liste.sort((a, b) => b[1] - a[1]);
      let k = 0;
      if (liste.length > 1 && rnd() < .2) k = Math.min(liste.length - 1, 1 + Math.floor(rnd() * 2));
      return bitir(liste[k][0], k ? 'kolay-sapma' : 'kolay');
    }

    const X = {
      P, s, dugum: 0, durdu: false, killer: new Int32Array(128).fill(-1),
      bitis: t0 + ayar.butceMs, dugumSiniri: ayar.dugumSiniri, maxDerinlik: ayar.maxDerinlik,
    };
    bilgi.X = X;

    let kokAdaylar = null;
    if (ayar.vcf) {
      // VCF aşamaları da bütçeden pay alır (düğüm sınırlı modda yalnız düğümle sınırlanır)
      const pay = (oran) => ({ n: 0, sinir: VCF_DUGUM, bitis: ayar.dugumSiniri ? 0 : simdi() + ayar.butceMs * oran });
      const kendi = vcf(P, s, VCF_DERINLIK, pay(.25));
      if (kendi) return bitir(kendi[0], 'vcf', { vcf: kendi.length });
      yield;
      // rakibin VCF'i (sıra ondaymış gibi): yalnız onu kıran ya da dört yapan adaylar
      const onun = vcf(P, o, VCF_DERINLIK, pay(.15));
      yield;
      const kirmaBitis = ayar.dugumSiniri ? Infinity : simdi() + ayar.butceMs * .35;
      if (onun) {
        const kiran = [];
        for (const m of siraliAdaylar(X, s, 0, -1).concat(onun.filter((_, k) => k % 2 === 0))) {
          if (kiran.includes(m) || P.h[m]) continue;
          if (E.dortDuzeyi(P, m, s) >= 1) { kiran.push(m); continue; }
          if (simdi() > kirmaBitis) break;
          E.koy(P, m, s);
          const hala = vcf(P, o, VCF_DERINLIK, { n: 0, sinir: 8000, bitis: ayar.dugumSiniri ? 0 : kirmaBitis });
          E.kaldir(P, m);
          if (!hala) kiran.push(m);
          yield;
        }
        if (kiran.length) kokAdaylar = kiran;
      }
    }
    if (!kokAdaylar) kokAdaylar = siraliAdaylar(X, s, 0, (() => { const k = ttAl(P); return k >= 0 ? TT.ham[k] : -1; })(), E.acikUcVar(P, o));
    const r = yield* kok(X, kokAdaylar);
    bilgi.dugum = X.dugum;
    return bitir(r.i, 'arama', { derinlik: r.derinlik, deger: r.deger, dugum: X.dugum });
  }

  // Adımlayıcı: adim(dilimMs) en çok o kadar çalışır; bitince sonuc dolar
  function baslat(durum, ayar) {
    const bilgi = {};
    const g = secG(durum, ayar, bilgi);
    const st = { bitti: false, sonuc: null, bilgi };
    st.adim = function (dilimMs = 8) {
      if (st.bitti) return true;
      const son = simdi() + dilimMs;
      for (;;) {
        const r = g.next();
        if (r.done) { st.bitti = true; st.sonuc = r.value; return true; }
        if (simdi() >= son) return false;
      }
    };
    st.iptal = () => { try { g.return(); } catch (e) { /* yoksay */ } st.bitti = true; };
    return st;
  }

  function sec(durum, ayar) {
    const st = baslat(durum, ayar);
    while (!st.adim(1e9)) { /* eşzamanlı */ }
    return st.sonuc;
  }

  // Tarayıcıda: MessageChannel ile dilimler (setTimeout(0) iç içe çağrıda ≥ 4 ms'e kenetlenir); yoksa setTimeout.
  let kanal = null;
  const bekleyenler = [];
  function sira(fn) {
    if (typeof MessageChannel === 'undefined') { setTimeout(fn, 0); return; }
    if (!kanal) {
      kanal = new MessageChannel();
      kanal.port1.onmessage = () => {
        const f = bekleyenler.shift();
        // node'da açık port süreci canlı tutar: iş kalmayınca bırak
        if (!bekleyenler.length && kanal.port1.unref) kanal.port1.unref();
        if (f) f();
      };
    }
    bekleyenler.push(fn);
    if (kanal.port1.ref) kanal.port1.ref();
    kanal.port2.postMessage(0);
  }
  function secAsync(durum, ayar, o = {}) {
    return new Promise((coz, red) => {
      const st = baslat(durum, ayar);
      const dur = () => { st.iptal(); const e = new Error('iptal'); e.name = 'AbortError'; red(e); };
      if (o.signal && o.signal.aborted) return dur();
      const adim = () => {
        if (o.signal && o.signal.aborted) return dur();
        try { if (st.adim(o.dilimMs || 8)) return coz(st.sonuc); } catch (e) { return red(e); }
        sira(adim);
      };
      sira(adim);
    });
  }

  /* ---------- oyun sonu analizi: kaybettiren hamle ---------- */

  // Sıradaki (w) için zorunlu kazanç var mı: güçlü dedektör (VCF + tam bütçeli arama), zaman baskısı yok
  function* kazancVarG(durum, butceMs, dugumSiniri) {
    if (durum.bitti) return durum.kazanan === durum.sira;
    const P = E.pencereKur(durum), w = durum.sira, l = 3 - w;
    if (E.tamamlamaVar(P, w)) return true;
    const onun = E.tamamlamaHucreleri(P, l);
    if (onun.length >= 2) return false;
    if (!onun.length && E.acikUcVar(P, w)) return true;
    if (vcf(P, w, VCF_DERINLIK, { n: 0, sinir: VCF_DUGUM, bitis: dugumSiniri ? 0 : simdi() + butceMs * .3 })) return true;
    yield;
    const X = {
      P, s: w, dugum: 0, durdu: false, killer: new Int32Array(128).fill(-1),
      bitis: simdi() + butceMs, dugumSiniri: dugumSiniri || 0, maxDerinlik: 12,
    };
    const aday = onun.length ? onun : siraliAdaylar(X, w, 0, -1, E.acikUcVar(P, l));
    const r = yield* kok(X, aday);
    return r.deger > KAZANC_SINIR;
  }

  // Kazanan, kaybettiren hamleden sonra çatalı hangi hamleyle kurdu: ilk çift tehdit (4-3, 3-3, 4-4 ya da açık dört)
  function catalBul(ayar, hamleler, k, w) {
    for (let j = k + 1; j < hamleler.length; j++) {
      const h = hamleler[j];
      if (h.sembol !== w) continue;
      const once = B.oynat(ayar, hamleler.slice(0, j));
      const P = E.pencereKur(once), i = E.hucre(P, h.r, h.c);
      const c = E.catallar(P, i, w);
      if (c.dortUc || c.ucUc || c.dortDort || E.dortDuzeyi(P, i, w) >= 2) {
        // her tehdit doğrusu: çatal karesinden iki yöne kazananın taşları (en çok 4 kare, rakip taşında durur)
        const yonler = c.yonler.map(({ yon, sinif }) => {
          let a = 0, b = 0;
          for (let t = 1; t <= 4; t++) { const v = B.tas(once, h.r - t * yon[0], h.c - t * yon[1]); if (v === 3 - w) break; if (v === w) a = t; }
          for (let t = 1; t <= 4; t++) { const v = B.tas(once, h.r + t * yon[0], h.c + t * yon[1]); if (v === 3 - w) break; if (v === w) b = t; }
          return { sinif, bas: [h.r - a * yon[0], h.c - a * yon[1]], son: [h.r + b * yon[0], h.c + b * yon[1]] };
        });
        return { hamleNo: j, hucre: [h.r, h.c], yonler };
      }
    }
    return null;
  }

  function aciklamaYap(once, alt, l, catal) {
    const P = E.pencereKur(once), w = 3 - l, i = E.hucre(P, alt[0], alt[1]);
    const z = E.zorunlu(P, l);
    if (z && z.tur === 'kapat') return 'burada dördü kapatmak gerekiyordu';
    const p = E.yonSiniflari(P, i, l);
    let hucum = 0, savunma = 0;
    for (let d = 0; d < 4; d++) { hucum = Math.max(hucum, E.hucumSinifi(p, d)); savunma = Math.max(savunma, E.savunmaSinifi(p, d)); }
    if (E.acikUcVar(P, w) && savunma >= E.S.DORT) return 'burada açık üçü kapatmak gerekiyordu';
    if (hucum >= E.S.DORT) return 'burada kendi dördünü yapıp sırayı almak gerekiyordu';
    if (catal && catal.hucre[0] === alt[0] && catal.hucre[1] === alt[1]) return 'burada çatalın kurulacağı kareyi önceden tutmak gerekiyordu';
    if (savunma >= E.S.UC) return 'burada üçü erkenden kapatmak gerekiyordu';
    return `burada ${B.hucreAdi(alt[0], alt[1])} karesine yazmak gerekiyordu`;
  }

  // hamleler: biten oyunun hamle listesi. Sondan geriye kaybedenin her hamlesinde en iyi 8 alternatif denenir; biri
  // kazananın zorunlu kazancını ortadan kaldırıyorsa o hamle kaybettirendir (son kesin hata). o: { butceMs, dugumSiniri, enCok }
  function* analizG(ayar, hamleler, o = {}) {
    const son = B.oynat(ayar, hamleler);
    if (!son.bitti || son.kazanan === 'berabere') return null;
    const w = son.kazanan, l = 3 - w;
    const butce = o.butceMs ?? 250, enCok = o.enCok ?? 6;
    let enErken = -1, bakilan = 0;
    for (let k = hamleler.length - 1; k >= 0 && bakilan < enCok; k--) {
      if (hamleler[k].sembol !== l) continue;
      bakilan++;
      enErken = k;
      const once = B.oynat(ayar, hamleler.slice(0, k));
      const P = E.pencereKur(once);
      const X = { P, s: l, killer: new Int32Array(128).fill(-1) };
      const z = E.zorunlu(P, l);
      let adaylar = z ? [z.i] : siraliAdaylar(X, l, 2, -1, E.acikUcVar(P, w)).slice(0, 8);
      adaylar = adaylar.map(i => E.koord(P, i)).filter(([r, c]) => !(r === hamleler[k].r && c === hamleler[k].c));
      for (const alt of adaylar) {
        const sonra = B.oyna(once, alt[0], alt[1]);
        if (sonra.bitti && sonra.kazanan === l) continue;
        const kazanir = yield* kazancVarG(sonra, butce, o.dugumSiniri);
        if (!kazanir) {
          const catal = catalBul(ayar, hamleler, k, w);
          return { hamleNo: k, oynanan: [hamleler[k].r, hamleler[k].c], enIyi: alt, catal, aciklama: aciklamaYap(once, alt, l, catal), kaybeden: l };
        }
      }
      yield;
    }
    if (enErken < 0) return null;
    return {
      hamleNo: enErken, oynanan: [hamleler[enErken].r, hamleler[enErken].c], enIyi: null,
      catal: catalBul(ayar, hamleler, enErken, w), aciklama: 'buradan sonra kurtuluş yoktu', kaybeden: l,
    };
  }

  // jeneratörü adımlayıcıya saran ortak sürücü
  function adimlayici(g) {
    const st = { bitti: false, sonuc: null };
    st.adim = function (dilimMs = 8) {
      if (st.bitti) return true;
      const son = simdi() + dilimMs;
      for (;;) {
        const r = g.next();
        if (r.done) { st.bitti = true; st.sonuc = r.value; return true; }
        if (simdi() >= son) return false;
      }
    };
    st.iptal = () => { try { g.return(); } catch (e) { /* yoksay */ } st.bitti = true; };
    return st;
  }
  function analiz(ayar, hamleler, o) {
    const st = adimlayici(analizG(ayar, hamleler, o));
    while (!st.adim(1e9)) { /* eşzamanlı */ }
    return st.sonuc;
  }
  function analizAsync(ayar, hamleler, o = {}) {
    return new Promise((coz, red) => {
      const st = adimlayici(analizG(ayar, hamleler, o));
      const dur = () => { st.iptal(); const e = new Error('iptal'); e.name = 'AbortError'; red(e); };
      const adim = () => {
        if (o.signal && o.signal.aborted) return dur();
        try { if (st.adim(8)) return coz(st.sonuc); } catch (e) { return red(e); }
        sira(adim);
      };
      sira(adim);
    });
  }

  // Eval'in zorunlu kuralını durum üstünden çağırmak için (UI / test)
  function zorunluHamle(durum) {
    const P = E.pencereKur(durum);
    const z = E.zorunlu(P, durum.sira);
    if (!z) return null;
    const [r, c] = E.koord(P, z.i);
    return { r, c, tur: z.tur };
  }

  // Durum üstünden VCF (test / analiz): s sırada sayılır
  function vcfBul(durum, s = durum.sira, derinlik = VCF_DERINLIK) {
    const P = E.pencereKur(durum);
    const v = vcf(P, s, derinlik);
    return v ? v.map(i => E.koord(P, i)) : null;
  }

  const AI = { ZORLUK, sec, secAsync, baslat, zorunluHamle, vcfBul, ttTemizle, analiz, analizAsync, _vcf: vcf };

  if (typeof window !== 'undefined') (window.XOX = window.XOX || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
