// ai.js — bilgisayar rakip. DOM yok; tarayıcıda window.NK.ai (board.js ve chains.js'ten sonra), node'da require('./ai.js').
//
//   NK.ai.sec(d, { zorluk, rng, butceMs, derinlik, sinir })            → { e, neden }   (eşzamanlı; testler)
//   NK.ai.secAsync(d, o, { signal })                                     → Promise<{ e, neden }> (dilimli; tarayıcı donmaz)
// neden: 'al' · 'ikisiHaric' · 'dorduHaric' · 'guvenli' · 'sessiz' · 'parite' · 'ac' · 'kesin' (izle ve ipucu açıklamaları için)
//
// Ortak öncelik: kapanabilen kutu varsa al. Güvenli hamle kalmamışsa (loony son oyun) orta ve zor "hepsini al" ile
// "ikisi hariç / dördü hariç"i çözücüyle seçer; kolay hep hepsini alır.
//   kolay: rastgele güvenli; güvenli yoksa en kısa parçayı açar.
//   orta:  "sessiz" güvenli (zincir/döngü kümesini değiştirmeyen); güvenli yoksa son oyun çözücüsü (kesin).
//   zor:   orta + güvenli hamleler üstünde iterative deepening alpha-beta; yaprak: güvenli hamle kalmadıysa kesin son oyun
//          değeri, değilse puan + uzun zincir paritesi. Bütçe 800 ms (dilimli).
(function () {
  'use strict';

  const kok = (typeof window !== 'undefined' && window.NK) || {};
  const BD = kok.board || require('./board.js');
  const CH = kok.chains || require('./chains.js');

  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const VARSAYILAN = {
    kolay: {},
    orta: { sinir: 22, cozButceMs: 250 },
    zor: { sinir: 22, cozButceMs: 250, butceMs: 800, derinlik: 4, sonEsik: 16, derinlikSon: 14 },
  };

  /* ---------- yardımcılar ---------- */

  // Tohumlu rastgele (mulberry32) — testler aynı kararı tekrarlasın
  function rngYap(a) {
    a = a >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const birini = (l, r) => l[Math.floor(r() * l.length)];
  const karistir = (l, r) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Parçanın açık (tek serbest kenarlı) kutusunu alan çizgi
  function almaKenari(d, p) {
    const KE = d.G.KUTU_KENAR;
    for (const k of p.kutular) {
      if (d.serbest[k] !== 1) continue;
      for (let i = 0; i < 4; i++) { const e = KE[4 * k + i]; if (!d.cizgi[e]) return e; }
    }
    return -1;
  }

  // Bütün alınabilir kutular alınınca güvenli hamle kalıyor mu? (kalıyorsa almak bedava)
  function hepsiAlininca(d) {
    const y = BD.kopya(d);
    for (;;) {
      if (y.bitti) return y;
      const a = BD.alinabilir(y);
      if (!a.length) return y;
      BD.cek(y, a[0]);
    }
  }

  // Güvenli hamle kalmamış, kutu da alınamayan konumun (yaklaşık) değeri: sıradakinin kalan kutulardan net kazancı.
  // Saf parçalar: kesin çözücü; kavşaklı: küçükse tahta üstü arama, değilse kavşağa açılan zincirler sıradan sayılır.
  function loonyDeger(d, o) {
    const P = CH.parcala(d);
    if (P.saf || !(P.serbestKenar <= (o.yaprakSinir ?? 0))) return CH.coz(P.parcalar).deger;
    const t = CH.tahtaCoz(d, { sinir: o.yaprakSinir, butceMs: 40 });
    return t ? t.deger : CH.coz(P.parcalar).deger;
  }

  /* ---------- 1. alma ---------- */

  function almaSec(d, o) {
    const al = BD.alinabilir(d);
    if (o.zorluk === 'kolay') return { e: al[0], neden: 'al' };
    const y = hepsiAlininca(d);
    if (y.bitti || BD.guvenli(y).length) return { e: al[0], neden: 'al' };    // sonrasında güvenli hamle var: hepsini al
    // loony: kesin arama sığıyorsa o
    const t = CH.tahtaCoz(d, { sinir: o.sinir, butceMs: o.cozButceMs });
    if (t) {
      if (BD.kapatir(d, t.hamle) > 0) return { e: t.hamle, neden: 'al' };
      return { e: t.hamle, neden: acikKutuSayisi(d) >= 4 ? 'dorduHaric' : 'ikisiHaric' };     // kutuyu geri çeviriyor
    }
    return almaParcayla(d);
  }

  // Açık parçada kalan kutu: reddedilirken rakibe bırakılan (zincirde 2, açılmış döngüde 4)
  function acikKutuSayisi(d) {
    const p = CH.parcala(d).parcalar.find(x => x.acik);
    return p ? p.uzunluk : 2;
  }

  // Parça çözücüsüyle: açık parçayı (k kutu) hepsini mi alalım, ikisini (döngüde dördünü) rakibe mi bırakalım?
  //   hepsi: k + V(kalan) · zincir reddi: k − 4 − V(kalan) · açılmış döngü reddi: k − 8 − V(kalan)
  function almaParcayla(d) {
    const P = CH.parcala(d);
    const acik = P.parcalar.filter(p => p.acik), kapali = P.parcalar.filter(p => !p.acik);
    if (acik.length !== 1) {                                   // birden çok açık yer: önce en küçüğü al
      const p = acik.sort((a, b) => a.uzunluk - b.uzunluk)[0];
      return { e: almaKenari(d, p), neden: 'al' };
    }
    const p = acik[0], k = p.uzunluk, Vs = CH.coz(kapali).deger;
    const donguGibi = p.uclar.every(u => u.tip === 'kapali');      // iki ucu da alınabilir (açılmış döngü)
    const hepsi = k + Vs, red = donguGibi ? (k >= 4 ? k - 8 - Vs : -Infinity) : (k >= 2 ? k - 4 - Vs : -Infinity);
    if (red > hepsi) {
      if (!donguGibi && k === 2) return { e: p.uclar.find(u => u.tip !== 'kapali').e, neden: 'ikisiHaric' };
      if (donguGibi && k === 4) return { e: p.kenarlar[1], neden: 'dorduHaric' };
    }
    return { e: almaKenari(d, p), neden: 'al' };
  }

  /* ---------- 2. güvenli hamle ---------- */

  const imza = (d) => CH.parcala(d).parcalar.map(p => p.tur[0] + p.uzunluk).sort().join(',');

  // Orta: zincir ve döngü kümesini değiştirmeyen ("sessiz") güvenli hamle
  function sessizSec(d, guvenli, r) {
    const once = imza(d), sessiz = [];
    for (const e of guvenli) { const k = BD.cek(d, e); if (imza(d) === once) sessiz.push(e); BD.geriAl(d, k); }
    return sessiz.length ? { e: birini(sessiz, r), neden: 'sessiz' } : { e: birini(guvenli, r), neden: 'guvenli' };
  }

  /* ---------- 3. açma (güvenli hamle yok) ---------- */

  function acmaSec(d, o) {
    const P = CH.parcala(d);
    if (o.zorluk === 'kolay') {
      const p = P.parcalar.slice().sort((a, b) => a.uzunluk - b.uzunluk)[0];
      return { e: p ? p.kenarlar[0] : BD.hamleler(d)[0], neden: 'ac' };
    }
    const t = CH.tahtaCoz(d, { sinir: o.sinir, butceMs: o.cozButceMs });
    if (t) return { e: t.hamle, neden: 'kesin' };
    if (!P.parcalar.length) return { e: BD.hamleler(d)[0], neden: 'ac' };
    const c = CH.coz(P.parcalar), p = P.parcalar[c.ac];
    let e = c.bicim === 'orta' ? p.kenarlar[1] : p.kenarlar[0];
    if (c.bicim === 'uc') { const u = p.uclar.find(x => x.tip === 'kenar'); if (u) e = u.e; }   // tahta kenarı ucundan aç
    return { e, neden: 'ac' };
  }

  /* ---------- zor: güvenli hamleler üstünde alpha-beta (üreteç: dilimlenir) ---------- */

  const zobristler = {};
  function zobrist(G) {
    const ad = G.m + 'x' + G.n;
    if (zobristler[ad]) return zobristler[ad];
    const r = rngYap(0xC0FFEE ^ G.E), a = new Uint32Array(G.E), b = new Uint32Array(G.E);
    for (let e = 0; e < G.E; e++) { a[e] = Math.floor(r() * 4294967296); b[e] = Math.floor(r() * 2097152); }
    return (zobristler[ad] = { a, b });
  }

  // Sıradakinin gözünden değerlendirme (güvenli hamle varken): puan farkı + uzun zincir kuralı + güvenli hamle paritesi
  function degerlendir(d, guvenliSayi) {
    const s = d.sira, fark = d.puan[s] - d.puan[1 - s];
    const kalan = d.G.K - d.puan[0] - d.puan[1];
    const par = CH.parite(d);
    return fark + (par.iyi(s) ? 1 : -1) * (1 + kalan * .22) + (guvenliSayi % 2 ? .4 : -.4);
  }

  function* zorAra(d, o, r) {
    const G = d.G, Z = zobrist(G), son = simdi() + (o.butceMs || 800), tt = new Map();
    let h1 = 0, h2 = 0, dugum = 0, durdur = false;
    for (let e = 0; e < G.E; e++) if (d.cizgi[e]) { h1 ^= Z.a[e]; h2 ^= Z.b[e]; }
    const anahtar = () => (h1 >>> 0) * 2097152 + (h2 >>> 0);
    const yaprakO = { yaprakSinir: 16 };

    // Düğüm (TT dahil). abG: kalan derinliği ≥ 2 olan düğümler üreteçtir ve her çocuktan sonra sıra verir (tek adım
    // ~birkaç yüz düğüm); son katlar düz fonksiyon (ab). İkisi aynı mantığı paylaşır (dugumBas / dugumSon).
    function dugumBas(derin, alpha, beta) {
      if ((++dugum & 255) === 0 && simdi() > son) durdur = true;
      if (durdur) return { v: 0 };
      const g = BD.guvenli(d);
      if (!g.length) return { v: d.puan[d.sira] - d.puan[1 - d.sira] + loonyDeger(d, yaprakO) };
      if (derin <= 0) return { v: degerlendir(d, g.length) };
      const a = anahtar(), kayit = tt.get(a);
      if (kayit && kayit.derin >= derin) {
        if (kayit.tip === 0) return { v: kayit.v };
        if (kayit.tip === 1 && kayit.v >= beta) return { v: kayit.v };
        if (kayit.tip === -1 && kayit.v <= alpha) return { v: kayit.v };
      }
      if (kayit && kayit.en >= 0) { const i = g.indexOf(kayit.en); if (i > 0) { g[i] = g[0]; g[0] = kayit.en; } }
      return { g, a };
    }
    const dugumSon = (a, derin, a0, beta, en, enE) => tt.set(a, { derin, v: en, tip: en <= a0 ? -1 : en >= beta ? 1 : 0, en: enE });

    function ab(derin, alpha, beta) {
      const b = dugumBas(derin, alpha, beta);
      if (!b.g) return b.v;
      const a0 = alpha;
      let en = -Infinity, enE = -1;
      for (const e of b.g) {
        const k = BD.cek(d, e);
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        const v = -ab(derin - 1, -beta, -alpha);
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        BD.geriAl(d, k);
        if (durdur) return 0;
        if (v > en) { en = v; enE = e; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      dugumSon(b.a, derin, a0, beta, en, enE);
      return en;
    }

    function* abG(derin, alpha, beta) {
      const b = dugumBas(derin, alpha, beta);
      if (!b.g) return b.v;
      const a0 = alpha;
      let en = -Infinity, enE = -1;
      for (const e of b.g) {
        const k = BD.cek(d, e);
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        const v = -(derin - 1 >= 2 ? yield* abG(derin - 1, -beta, -alpha) : ab(derin - 1, -beta, -alpha));
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        BD.geriAl(d, k);
        if (durdur) return 0;
        if (v > en) { en = v; enE = e; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
        yield;
      }
      dugumSon(b.a, derin, a0, beta, en, enE);
      return en;
    }

    let kokler = karistir(BD.guvenli(d), r), enIyi = { e: kokler[0], v: -Infinity, derin: 0 };
    if (kokler.length === 1) return { e: kokler[0], neden: 'guvenli' };
    // geç orta oyunda (az güvenli hamle) bütçe yettikçe daha derin: uzun zincir kavgası burada kazanılır
    const tavan = kokler.length <= (o.sonEsik ?? 0) ? (o.derinlikSon || o.derinlik || 4) : (o.derinlik || 4);
    for (let derin = 1; derin <= tavan; derin++) {
      let alpha = -Infinity, buEn = null;
      const puanlar = [];
      for (const e of kokler) {
        const k = BD.cek(d, e);
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        const v = -(derin - 1 >= 2 ? yield* abG(derin - 1, -Infinity, -alpha) : ab(derin - 1, -Infinity, -alpha));
        h1 ^= Z.a[e]; h2 ^= Z.b[e];
        BD.geriAl(d, k);
        if (durdur) break;
        puanlar.push([e, v]);
        if (!buEn || v > buEn.v) buEn = { e, v, derin };
        if (v > alpha) alpha = v;
        yield;
      }
      if (durdur) break;
      enIyi = buEn;
      kokler = puanlar.sort((x, y) => y[1] - x[1]).map(x => x[0]);   // en iyiler önce
      if (Math.abs(buEn.v) > 900) break;
      if (simdi() > son) break;
    }
    return { e: enIyi.e, neden: 'parite', derin: enIyi.derin, deger: enIyi.v, dugum };
  }

  /* ---------- dış arayüz ---------- */

  function secenekler(o = {}) {
    const z = VARSAYILAN[o.zorluk] ? o.zorluk : 'orta';
    return Object.assign({}, VARSAYILAN[z], o, { zorluk: z });
  }

  // Bütün kararlar tek üreteçte: zor araması dışında hemen döner
  function* uretec(d0, o0) {
    if (d0.bitti) throw new Error('Oyun bitti');
    const o = secenekler(o0), r = o.rng || Math.random;
    const d = BD.kopya(d0);
    if (BD.alinabilir(d).length) return almaSec(d, o);
    const g = BD.guvenli(d);
    if (g.length) {
      if (o.zorluk === 'kolay') return { e: birini(g, r), neden: 'guvenli' };
      if (o.zorluk === 'orta') return sessizSec(d, g, r);
      return yield* zorAra(d, o, r);
    }
    return acmaSec(d, o);
  }

  function sec(d, o) {
    const g = uretec(d, o);
    let a;
    do a = g.next(); while (!a.done);
    return a.value;
  }

  // Tarayıcıya sıra vermenin en hızlı yolu: Node'da setImmediate, tarayıcıda MessageChannel, yoksa setTimeout (dokuztas)
  const sira = (() => {
    if (typeof setImmediate === 'function') return () => new Promise(r => setImmediate(r));
    if (typeof MessageChannel === 'function') {
      const kanal = new MessageChannel(), kuyruk = [];
      kanal.port1.onmessage = () => { const r = kuyruk.shift(); if (r) r(); };
      return () => new Promise(r => { kuyruk.push(r); kanal.port2.postMessage(0); });
    }
    return () => new Promise(r => setTimeout(r, 0));
  })();

  async function secAsync(d, o, { signal } = {}) {
    const g = uretec(d, o);
    const iptal = () => { const e = new Error('Hamle hesabı iptal edildi'); e.name = 'AbortError'; return e; };
    try {
      for (;;) {
        if (signal && signal.aborted) throw iptal();
        const dilim = simdi() + 12;
        let a;
        do { a = g.next(); if (a.done) return a.value; } while (simdi() < dilim);
        await sira();
      }
    } finally { g.return(); }
  }

  const AI = { sec, secAsync, rngYap, VARSAYILAN, _uretec: uretec, _degerlendir: degerlendir, _almaParcayla: almaParcayla };
  if (typeof window !== 'undefined') (window.NK = window.NK || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
