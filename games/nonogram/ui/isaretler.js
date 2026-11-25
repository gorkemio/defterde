// ui/isaretler.js — işaret katmanı: grafit taramalar, ince çarpılar, silgi lekeleri. Yalnız değişen kareler yeniden çizilir.
// Dolu kare 120 ms'de taranır (kısmi darbeler üst katmanda; bitince katmana işlenir). Silinen karede leke kalır, kırıntı dağılır.
// Durum dizileri KK.oyun'dan gelir: d (0/1/2), kilit (başlangıç), silgi (kaç kez silindi).
(function () {
  'use strict';
  const KK = window.KK;
  const T = Kit.tarama;

  const S = {
    d: null, kilit: null, silgi: null,
    kirli: new Set(), anim: new Map(), kirintilar: [],
    soluk: 1, carpiYok: false, silinen: new Set(),   // bitişte: tarama %30'a iner, çarpılar silinir
    kucuk: null, kucukOlcek: 3,
  };

  function kur(o) {
    Object.assign(S, o);
    S.kirli.clear(); S.anim.clear(); S.kirintilar = [];
    S.soluk = 1; S.carpiYok = false; S.silinen = new Set();
    const G = KK.tahta.G;
    KK.tahta.katman('isaret', { x0: 0, y0: 0, ww: G.W, wh: G.H, ciz: tum });
    S.kucuk = S.kucuk || document.createElement('canvas');
    S.kucuk.width = G.en * S.kucukOlcek; S.kucuk.height = G.boy * S.kucukOlcek;
    kucukTum();
  }

  const tohum = (r, c) => ['kare', r, c, S.silgi ? S.silgi[r * KK.tahta.G.en + c] : 0];

  function hucreCiz(ctx, i, temiz = true) {
    const G = KK.tahta.G, b = G.b, r = (i / G.en) | 0, c = i % G.en, x = c * b, y = r * b;
    if (temiz) ctx.clearRect(x, y, b, b);
    if (S.silgi && S.silgi[i]) T.silgiLeke(ctx, x, y, b, ['leke', r, c], S.silgi[i]);
    if (S.anim.has(i)) return;
    const v = S.d[i], kilitli = S.kilit && S.kilit[i];
    if (v === 1) T.hucre(ctx, x, y, b, T.tarama(tohum(r, c)), { alfaCarpan: (kilitli ? .62 : 1) * S.soluk, parlak: !kilitli });
    else if (v === 2 && (S.carpiYok || S.silinen.has(i))) T.silgiLeke(ctx, x, y, b, ['bitis', r, c], 1);
    else if (v === 2) T.carpiCiz(ctx, x, y, b, T.carpi(tohum(r, c)), { alfaCarpan: kilitli ? .55 : 1 });
  }
  function tum(ctx) { for (let i = 0; i < S.d.length; i++) hucreCiz(ctx, i, false); }

  function kucukHucre(i) {
    const G = KK.tahta.G, k = S.kucukOlcek, c = S.kucuk.getContext('2d'), r = (i / G.en) | 0, cc = i % G.en;
    c.fillStyle = '#fbf9f2'; c.fillRect(cc * k, r * k, k, k);
    if (S.d[i] === 1) { c.fillStyle = 'rgba(74,74,74,.85)'; c.fillRect(cc * k, r * k, k, k); }
    else if (S.d[i] === 2) { c.fillStyle = 'rgba(74,74,74,.25)'; c.fillRect(cc * k + 1, r * k + 1, k - 2, k - 2); }
  }
  function kucukTum() { for (let i = 0; i < S.d.length; i++) kucukHucre(i); }

  // Değişen kare: animasyonla (tur: 'tarama' | 'carpi') ya da hemen
  function degisti(i, o = {}) {
    if (o.anim && Kit.kalem.animasyonVar()) S.anim.set(i, { tur: o.anim, bas: performance.now(), sure: o.anim === 'tarama' ? KK.config.cizimMs : 90 });
    else S.anim.delete(i);
    if (o.kirinti && Kit.kalem.animasyonVar()) { const G = KK.tahta.G; S.kirintilar.push({ r: (i / G.en) | 0, c: i % G.en, bas: performance.now(), tohum: ['kr', i, performance.now() | 0] }); }
    S.kirli.add(i);
    kucukHucre(i);
    KK.tahta.kirli();
  }
  function hepsiDegisti() { S.anim.clear(); KK.tahta.yenidenCiz('isaret'); kucukTum(); }

  // kare döngüsü öncesi: kirli kareler katmana
  function isle() {
    if (!S.kirli.size) return false;
    const k = KK.tahta.kat.get('isaret');
    for (const i of S.kirli) hucreCiz(k.ctx, i);
    S.kirli.clear();
    return false;
  }

  // Üst katman (ekran uzayı; ızgara dönüşümü kurulur): kısmi taramalar ve kırıntılar
  function animCiz(ctx, D, zaman) {
    if (!S.anim.size && !S.kirintilar.length) return false;
    const G = KK.tahta.G, b = G.b, simdi = performance.now(), dpr = KK.tahta.dpr;
    ctx.save();
    ctx.beginPath(); ctx.rect(D.gx0, D.gy0, D.w - D.gx0, D.h - D.gy0); ctx.clip();
    ctx.setTransform(dpr * D.s, 0, 0, dpr * D.s, dpr * D.tx, dpr * D.ty);
    let devam = false;
    for (const [i, a] of S.anim) {
      const f = (simdi - a.bas) / a.sure, r = (i / G.en) | 0, c = i % G.en;
      devam = true;
      if (a.tur === 'tarama' && S.d[i] === 1) T.hucre(ctx, c * b, r * b, b, T.tarama(tohum(r, c)), { ilerleme: Math.min(1, Math.max(.05, f)) });
      else if (a.tur === 'carpi' && S.d[i] === 2) T.carpiCiz(ctx, c * b, r * b, b, T.carpi(tohum(r, c)), { ilerleme: Math.min(1, Math.max(.1, f)) });
      if (f >= 1) { S.anim.delete(i); S.kirli.add(i); }
    }
    const km = KK.config.kirintiMs;
    S.kirintilar = S.kirintilar.filter(k => simdi - k.bas < km);
    for (const k of S.kirintilar) { T.kirinti(ctx, k.c * b, k.r * b, b, k.tohum, (simdi - k.bas) / km); devam = true; }
    ctx.restore();
    if (S.kirli.size) isle();
    void zaman;
    return devam;
  }

  KK.isaretler = Object.assign(S, { kur, degisti, hepsiDegisti, isle, animCiz, hucreCiz, kucukTum });
})();
