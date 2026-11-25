// ai.js — bilgisayar rakip. DOM'a dokunmaz; tarayıcıda window.KF.ai, node'da require('./ai.js').
// Hamle birimi TUR'dur (board.turlarUret): bir turda sekme zinciri dahil birkaç kenar olabilir.
//
//   const iptal = KF.ai.dusun(G, d, { zorluk: 'zor', butceMs: 800 }, (sonuc) => { sonuc.kenarlar ... });
//   const sonuc = KF.ai.dusunSenkron(G, d, { zorluk: 'zor', butceMs: Infinity, maxDerinlik: 2 });   // testler
//
// Arama bir function* üreteci: sürücü her dilimde (varsayılan 12 ms) bir parça çalıştırıp setTimeout ile bırakır,
// böylece ana thread donmaz (file:// altında Web Worker olmadığı için). Çalışma bir KOPYA üstünde yapılır.
//
// Sıra: kesinler → statik sıralama → (orta, zor) rakibe gol vermeyenleri süz → derinlik 1 / iterative deepening 1–3.
// Değerlendirme sıfır toplamlıdır: kiymet(G, d, p) = p için değer, kiymet(p) = −kiymet(1−p).
(function () {
  'use strict';

  const KF = typeof window !== 'undefined' ? (window.KF = window.KF || {}) : {};
  const B = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./board.js') : KF.board;

  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const KAZANC = 1e6;            // kesin kazanç; derinlikle azalır (hızlı gol tercih)
  const TEHDIT = 9000;           // yaprakta: sırası gelen gol atabilir (+) ya da güvenli turu yok (−)
  const SIKISTIRMA = 4000;       // orta: rakip beni sıkıştırabiliyor

  // Zorluk: derinlik = tam arama derinliği (0: arama yok), K = her derinlikte bakılan aday sayısı
  const ZORLUK = {
    kolay: { derinlik: 0, K: [5] },
    orta: { derinlik: 1, K: [24] },
    zor: { derinlik: 3, K: [16, 12, 8] },
  };

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- değerlendirme ---------- */

  // p oyuncusu için konum değeri (sıfır toplamlı). Top yalnız konumuyla ve çevresiyle girer.
  // · dikey: p'nin hedef kalesine yakınlık iyi, kendi kalesine yakınlık kötü
  // · yatay: kale ortasından uzaklık, kaleye yakınken daha önemli (iki taraf için ayrı ağırlıkla)
  // · hareket: sırası gelenin temiz komşuları (güvenli bitiş şansı) ve serbest kenarı (≤2 ise ağır ceza)
  function kiymet(G, d, p) {
    const x = G.nx[d.top], y = G.ny[d.top], H = G.H;
    const dyP = Math.abs(y - (p === 0 ? 0 : H)), dyQ = H - dyP;
    const dx = Math.abs(x - G.m);
    let v = 10 * (dyQ - dyP) - 3 * dx * ((1 - dyP / H) - (1 - dyQ / H));
    // hareket terimleri sırası gelen oyuncu içindir
    let temiz = 0, serbest = 0;
    const taban = d.top * 8;
    for (let y2 = 0; y2 < 8; y2++) {
      const e = G.komKenar[taban + y2];
      if (e < 0 || B.kullanildi(d, e)) continue;
      serbest++;
      if (!B.ziyaretli(G, d, G.komNokta[taban + y2])) temiz++;
    }
    let h = 2 * temiz - (serbest <= 2 ? 300 : 0);
    v += d.sira === p ? h : -h;
    return v;
  }

  // Bir turu uygulayıp ben açısından değerler (tur sonu; sıra rakipte)
  function turPuani(G, d, ben, t) {
    B.uygulaTur(G, d, t.kenarlar);
    const p = kiymet(G, d, ben);
    B.turuGeriAl(G, d, t.kenarlar.length);
    return p;
  }

  /* ---------- tur üretimi (önbellekli) ---------- */

  function uret(G, d, ctx) {
    const k = B.anahtar(d);
    let u = ctx.onbellek.get(k);
    if (u) return u;
    const r = B.turlarUret(G, d, { enCokTur: 600, enUzunZincir: 40, enCokDugum: 12000, sonTarih: ctx.son });
    const m = d.sira;
    u = {
      kazanc: r.turlar.some(t => (t.sonuc === 'gol' || t.sonuc === 'sikisma') && t.kazanan === m),
      adaylar: r.turlar.filter(t => t.sonuc === 'temiz'),
      kesildi: r.kesildiMi,
    };
    ctx.onbellek.set(k, u);
    return u;
  }

  // d'de sırası gelen oyuncunun bu turda gol atabilmesi (+) ya da hiç güvenli turu olmaması (−); yoksa konum değeri.
  function yaprak(G, d, ctx) {
    const m = d.sira;
    if (B.golTuruBul(G, d, { enCokTur: 50, enUzunZincir: 40, enCokDugum: 12000, sonTarih: ctx.son })) return TEHDIT;
    if (!guvenliVar(G, d, ctx)) return -TEHDIT;
    return kiymet(G, d, m);
  }

  // Sırası gelen oyuncunun kaybettirmeyen turu var mı (ilk bulunca durur; sınıra takılırsa güvenli sayılır)
  function guvenliVar(G, d, ctx) {
    const m = d.sira;
    const r = B.turlarUret(G, d, { ilkGuvenliDeDur: true, enCokTur: 300, enUzunZincir: 40, enCokDugum: 4000, sonTarih: ctx.son });
    return r.kesildiMi || r.turlar.some(t => t.sonuc === 'temiz' || (t.sonuc !== 'kesildi' && t.kazanan === m));
  }

  // d: benim turum bitti, sıra rakipte. Rakibin öyle bir turu var mı ki ardından benim güvenli turum kalmasın?
  function sikistirmaVar(G, d, ctx) {
    const u = uret(G, d, ctx);
    if (u.kazanc) return false;                                  // gol bulabiliyorsa o ayrı süzülür
    const opp = d.sira;
    const sirali = u.adaylar.map(t => ({ t, p: turPuani(G, d, opp, t) })).sort((a, b) => b.p - a.p).slice(0, 10);
    for (const { t } of sirali) {
      B.uygulaTur(G, d, t.kenarlar);
      const guvenli = d.bitti ? true : guvenliVar(G, d, ctx);
      B.turuGeriAl(G, d, t.kenarlar.length);
      if (!guvenli) return true;
    }
    return false;
  }

  /* ---------- arama ---------- */

  function* nefes(ctx) { if (ctx.k.dilimSon !== undefined && simdi() > ctx.k.dilimSon) yield; }

  // Negamax, TUR birimli: d'de sırası gelenin değeri. derinlik 0: yaprak (gol tehdidi / sıkışma kontrolü).
  function* dugum(G, d, derinlik, alpha, beta, ctx, ply) {
    ctx.dugum++;
    if (derinlik === 0) return yaprak(G, d, ctx);
    const alfa0 = alpha, key = B.anahtar(d);
    const tt = ctx.tt.get(key);
    if (tt && tt.derinlik >= derinlik) {
      if (tt.bayrak === 0) return tt.deger;
      if (tt.bayrak === 1 && tt.deger >= beta) return tt.deger;
      if (tt.bayrak === 2 && tt.deger <= alpha) return tt.deger;
    }
    const u = uret(G, d, ctx);
    if (u.kazanc) return KAZANC - ply;
    if (!u.adaylar.length) return u.kesildi ? kiymet(G, d, d.sira) : -KAZANC + ply;
    const m = d.sira;
    const K = ctx.zorluk.K[Math.min(ply, ctx.zorluk.K.length - 1)];
    const sirali = u.adaylar.map(t => ({ t, p: turPuani(G, d, m, t) })).sort((a, b) => b.p - a.p).slice(0, K);
    let en = -Infinity;
    for (const { t } of sirali) {
      B.uygulaTur(G, d, t.kenarlar);
      const v = -(yield* dugum(G, d, derinlik - 1, -beta, -alpha, ctx, ply + 1));
      B.turuGeriAl(G, d, t.kenarlar.length);
      if (ctx.dur) return 0;
      if (v > en) en = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
      if (simdi() > ctx.son) { ctx.dur = true; return 0; }
      yield* nefes(ctx);
    }
    ctx.tt.set(key, { derinlik, deger: en, bayrak: en <= alfa0 ? 2 : en >= beta ? 1 : 0 });
    return en;
  }

  function* ara(G, d0, o, k) {
    const t0 = simdi();
    const d = B.kopyala(d0), ben = d.sira;
    const zorluk = Object.assign({}, ZORLUK[o.zorluk] || ZORLUK.orta);
    if (o.maxDerinlik !== undefined && zorluk.derinlik > 0) zorluk.derinlik = Math.min(zorluk.derinlik, o.maxDerinlik);
    const ctx = { G, k, zorluk, son: t0 + o.butceMs, dugum: 0, dur: false, tt: new Map(), onbellek: new Map() };
    const rng = mulberry32(o.tohum >>> 0);
    const bilgi = { zorluk: o.zorluk, derinlik: 0, dugum: 0, aday: 0, guvenli: 0, ms: 0, sebep: '' };
    const bitir = (t, sebep) => { bilgi.sebep = sebep; bilgi.ms = simdi() - t0; bilgi.dugum = ctx.dugum; return { kenarlar: t.kenarlar, bilgi }; };

    // 1. kesinler: kazandıran tur varsa en kısası; kaybettirenler (kendi kale, sıkışma) elenir
    const R = B.turlarUret(G, d, { enCokTur: 3000, enUzunZincir: 40, enCokDugum: 60000, sonTarih: ctx.son });
    yield* nefes(ctx);
    if (!R.turlar.length) return { kenarlar: [], bilgi };
    const kazanc = R.turlar.filter(t => (t.sonuc === 'gol' || t.sonuc === 'sikisma') && t.kazanan === ben).sort((a, b) => a.kenarlar.length - b.kenarlar.length);
    if (kazanc.length) return bitir(kazanc[0], 'kesin');
    const adaylar = R.turlar.filter(t => t.sonuc === 'temiz');
    bilgi.aday = adaylar.length;
    if (!adaylar.length) {
      const kes = R.turlar.filter(t => t.sonuc === 'kesildi');
      if (kes.length) return bitir(kes[0], 'kesildi');                  // zincir sınırı: bilinmez, kaybetmekten iyi
      return bitir(R.turlar.slice().sort((a, b) => b.kenarlar.length - a.kenarlar.length)[0], 'hepsi-kayip');
    }

    // 2. statik sıralama
    for (const t of adaylar) t.puan = turPuani(G, d, ben, t);
    adaylar.sort((a, b) => b.puan - a.puan);
    yield* nefes(ctx);

    // kolay: yalnız kesinler + uzaklık, üstüne rastgelelik
    if (zorluk.derinlik === 0) {
      const ust = adaylar.slice(0, zorluk.K[0]), w = [5, 3, 2, 1, 1];
      let toplam = 0;
      for (let i = 0; i < ust.length; i++) toplam += w[i];
      let r = rng() * toplam, i = 0;
      while (i < ust.length - 1 && r >= w[i]) { r -= w[i]; i++; }
      return bitir(ust[i], 'kolay');
    }

    // 3. rakibe doğrudan gol verenleri ele (HER aday için; sıra statik sırada, zaman bütçesinin %40'ıyla sınırlı)
    const filtreSon = t0 + 0.4 * o.butceMs;
    const guvenli = [], kontrolsuz = [];
    let i = 0;
    for (; i < adaylar.length; i++) {
      if (simdi() > filtreSon) break;
      const t = adaylar[i];
      B.uygulaTur(G, d, t.kenarlar);
      const gol = B.golTuruBul(G, d, { enCokTur: 1, enUzunZincir: 60, enCokDugum: 150000, sonTarih: ctx.son });
      B.turuGeriAl(G, d, t.kenarlar.length);
      if (!gol) guvenli.push(t);
      yield* nefes(ctx);
    }
    for (; i < adaylar.length; i++) kontrolsuz.push(adaylar[i]);
    bilgi.guvenli = guvenli.length;
    const havuz = guvenli.length ? guvenli : (kontrolsuz.length ? kontrolsuz : adaylar);
    if (havuz.length === 1) return bitir(havuz[0], 'tek-secenek');

    // orta: derinlik 1 — rakip gol atamıyor (süzüldü); rakip beni sıkıştırabiliyor mu?
    if (zorluk.derinlik === 1) {
      let en = null, enP = -Infinity;
      for (const t of havuz.slice(0, zorluk.K[0])) {
        B.uygulaTur(G, d, t.kenarlar);
        const s = sikistirmaVar(G, d, ctx);
        B.turuGeriAl(G, d, t.kenarlar.length);
        const p = t.puan - (s ? SIKISTIRMA : 0);
        if (p > enP) { enP = p; en = t; }
        yield* nefes(ctx);
      }
      bilgi.derinlik = 1;
      return bitir(en, 'orta');
    }

    // zor: iterative deepening (turlar üzerinde alpha-beta), son tamamlanan derinliğin sonucu
    let sirali = havuz.slice(0, zorluk.K[0]), en = sirali[0];
    bilgi.derinlik = 0;
    for (let derinlik = 1; derinlik <= zorluk.derinlik; derinlik++) {
      let alpha = -Infinity, bulunan = null;
      for (const t of sirali) {
        B.uygulaTur(G, d, t.kenarlar);
        const v = -(yield* dugum(G, d, derinlik - 1, -Infinity, -alpha, ctx, 1));
        B.turuGeriAl(G, d, t.kenarlar.length);
        if (ctx.dur || simdi() > ctx.son) { ctx.dur = true; break; }
        t.deger = v;
        if (v > alpha) { alpha = v; bulunan = t; }
        yield* nefes(ctx);
      }
      if (ctx.dur || !bulunan) break;                                // yarım kalan derinlik atılır
      en = bulunan; bilgi.derinlik = derinlik; bilgi.deger = alpha;
      sirali = sirali.slice().sort((a, b) => b.deger - a.deger);
      if (Math.abs(alpha) >= KAZANC - 100) break;                    // kesin sonuç bulundu
    }
    return bitir(en, 'zor');
  }

  /* ---------- sürücüler ---------- */

  const VARSAYILAN = { zorluk: 'orta', butceMs: 400, dilimMs: 12 };

  // Zaman dilimli çalışır; her dilimde ana thread'i en çok dilimMs tutar. Dönüş: iptal fonksiyonu.
  function dusun(G, d, o, bitince) {
    const opts = Object.assign({ tohum: (Math.random() * 4294967296) >>> 0 }, VARSAYILAN, o);
    const k = { dilimSon: 0 };
    const it = ara(G, d, opts, k);
    let iptal = false, zamanlayici = 0;
    const adim = () => {
      zamanlayici = 0;
      if (iptal) return;
      k.dilimSon = simdi() + opts.dilimMs;
      let r;
      try { r = it.next(); } catch (e) { bitince(null, e); return; }
      if (r.done) bitince(r.value); else zamanlayici = setTimeout(adim, 0);
    };
    zamanlayici = setTimeout(adim, 0);
    return () => { iptal = true; if (zamanlayici) clearTimeout(zamanlayici); };
  }

  // Aynı arama, bölmeden (testler, ölçümler). butceMs: Infinity verilirse yalnız maxDerinlik ve K sınırlar → deterministik.
  function dusunSenkron(G, d, o) {
    const opts = Object.assign({ tohum: 1 }, VARSAYILAN, o);
    const k = { dilimSon: Infinity };
    const it = ara(G, d, opts, k);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  KF.ai = { dusun, dusunSenkron, kiymet, ZORLUK };
  if (typeof module !== 'undefined' && module.exports) module.exports = KF.ai;
})();
