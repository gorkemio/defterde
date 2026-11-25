// nonogram/solver.js — yayılım (kuyruklu satır çözücü), sınama (derinlik 1 ve 2) ve tekillik (geri izleme, ≤ 2 çözüm).
// Durum: Uint8Array (0 bilinmiyor, 1 dolu, 2 çarpı), dizin r * en + c. Hepsi deterministik. DOM yok.
// Çizgi kimliği: 0..boy-1 satırlar, boy..boy+en-1 sütunlar.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const LS = node ? require('./linesolver.js') : window.KK.linesolver;

  // Bulmaca başına önhazırlık (blok listeleri, tamponlar)
  function hazir(b) {
    if (b._coz) return b._coz;
    const n = Math.max(b.en, b.boy);
    b._coz = {
      bl: [...b.ipuclari.satir, ...b.ipuclari.sutun].map(ip => ip.filter(x => x > 0)),
      buf: new Uint8Array(n), sonuc: new Uint8Array(n),
      kuyruk: new Int32Array(b.en + b.boy), icinde: new Uint8Array(b.en + b.boy),
    };
    return b._coz;
  }
  const cizgiBoyu = (b, l) => (l < b.boy ? b.en : b.boy);
  const kareDizini = (b, l, i) => (l < b.boy ? l * b.en + i : i * b.en + (l - b.boy));

  // Yayılım: durumu yerinde değiştirir. o: { kirli: [çizgi...] (yoksa hepsi), kayit: dizi (değişen [dizin, değer]) }
  // → { sonuc: 'cozuldu' | 'takildi' | 'celiski', celiskiCizgi, degisen }
  function yay(d, b, o = {}) {
    const h = hazir(b), N = b.en + b.boy, Q = h.kuyruk, ic = h.icinde;
    ic.fill(0);
    let bas = 0, son = 0, adet = 0;
    const ekle = (l) => { if (!ic[l]) { ic[l] = 1; Q[son] = l; son = (son + 1) % N; adet++; } };
    if (o.kirli) for (const l of o.kirli) ekle(l); else for (let l = 0; l < N; l++) ekle(l);
    let degisen = 0;
    while (adet) {
      const l = Q[bas]; bas = (bas + 1) % N; adet--; ic[l] = 0;
      const n = cizgiBoyu(b, l);
      let bil = 0;
      for (let i = 0; i < n; i++) { const v = d[kareDizini(b, l, i)]; h.buf[i] = v; if (!v) bil++; }
      if (!LS.hesapla(h.bl[l], h.buf, n, h.sonuc)) return { sonuc: 'celiski', celiskiCizgi: l, degisen };
      if (!bil) continue;
      for (let i = 0; i < n; i++) {
        if (h.buf[i] || !h.sonuc[i]) continue;
        const idx = kareDizini(b, l, i);
        d[idx] = h.sonuc[i]; degisen++;
        if (o.kayit) o.kayit.push(idx, h.sonuc[i]);
        ekle(l < b.boy ? b.boy + i : i);
      }
    }
    for (let i = 0; i < d.length; i++) if (!d[i]) return { sonuc: 'takildi', degisen };
    return { sonuc: 'cozuldu', degisen };
  }
  const kesisen = (b, idx) => [(idx / b.en) | 0, b.boy + idx % b.en];

  // Sınama adayları: bilinmeyen kareler; satır+sütundaki bilinmeyen sayısı az olan önce, sonra okuma sırası
  function adaylar(d, b) {
    const sb = new Int32Array(b.boy), cb = new Int32Array(b.en), s = [];
    for (let i = 0; i < d.length; i++) if (!d[i]) { sb[(i / b.en) | 0]++; cb[i % b.en]++; s.push(i); }
    return s.sort((x, y) => (sb[(x / b.en) | 0] + cb[x % b.en]) - (sb[(y / b.en) | 0] + cb[y % b.en]) || x - y);
  }

  // Bir varsayımın sonucu: kopyada kare = v, yayılım (derinlik 2'de içeride derinlik-1 sınama döngüsü)
  function varsay(d, b, idx, v, derinlik, butce) {
    const k = d.slice();
    k[idx] = v;
    let r = yay(k, b, { kirli: kesisen(b, idx) });
    if (derinlik >= 2) {
      while (r.sonuc === 'takildi') {
        const s = sina1(k, b, butce);
        if (!s) break;
        if (s.celiski) return { sonuc: 'celiski', celiskiCizgi: s.celiskiCizgi };
        r = yay(k, b, { kirli: kesisen(b, s.idx) });
      }
    }
    return r;
  }

  // Derinlik 1: ilk çelişki veren varsayım → { idx, v (kesin değer), varsayilan, celiskiCizgi } ya da null.
  // Kesin değeri durumda işlemez (çağıran yapar). Varsayımın iki yanı da çelişirse { celiski: true }.
  function sina1(d, b, butce) {
    for (const idx of adaylar(d, b)) {
      if (butce && butce.kalan-- <= 0) return null;
      const a = varsay(d, b, idx, 1, 1);
      const c = varsay(d, b, idx, 2, 1);
      if (a.sonuc === 'celiski' && c.sonuc === 'celiski') return { celiski: true, celiskiCizgi: a.celiskiCizgi };
      if (a.sonuc === 'celiski') { d[idx] = 2; return { idx, v: 2, varsayilan: 1, celiskiCizgi: a.celiskiCizgi }; }
      if (c.sonuc === 'celiski') { d[idx] = 1; return { idx, v: 1, varsayilan: 2, celiskiCizgi: c.celiskiCizgi }; }
    }
    return null;
  }
  // Derinlik 2: en çok tur başına `enCok` aday (derinlik-1 sınamada en çok çıkarım verenler önce)
  function sina2(d, b, o = {}) {
    const enCok = o.enCok || 40, butce = o.butce || { kalan: 4000 };
    const puan = new Map();
    for (const idx of adaylar(d, b)) {
      let p = 0;
      for (const v of [1, 2]) { const k = d.slice(); k[idx] = v; p += yay(k, b, { kirli: kesisen(b, idx) }).degisen; }
      puan.set(idx, p);
    }
    const sirali = [...puan.keys()].sort((x, y) => puan.get(y) - puan.get(x) || x - y).slice(0, enCok);
    for (const idx of sirali) {
      if (butce.kalan-- <= 0) return null;
      for (const v of [1, 2]) {
        const r = varsay(d, b, idx, v, 2, butce);
        if (r.sonuc === 'celiski') { d[idx] = 3 - v; return { idx, v: 3 - v, varsayilan: v, celiskiCizgi: r.celiskiCizgi }; }
      }
    }
    return null;
  }

  // Sınama döngüsü: yayılım + istenen derinliğe kadar sınama, sabit noktaya kadar. d yerinde değişir.
  function coz(d, b, o = {}) {
    const derinlik = o.derinlik ?? 2;
    let r = yay(d, b);
    while (r.sonuc === 'takildi' && derinlik >= 1) {
      let s = sina1(d, b);
      if (!s && derinlik >= 2) s = sina2(d, b, o);
      if (!s) break;
      if (s.celiski) return { sonuc: 'celiski' };
      r = yay(d, b, { kirli: kesisen(b, s.idx) });
    }
    return r;
  }

  // Tekillik: geri izleme (her düğümde yayılım, isteğe bağlı derinlik-1 sınama), 2 çözümde durur.
  // o: { dugumButcesi = 20000, sinama = false, baslangic: durum (yoksa boş) } → { sonuc: 'tek'|'cok'|'yok'|'bilinmiyor', cozumler, dugum }
  function tekillik(b, o = {}) {
    const butce = o.dugumButcesi ?? 20000, cozumler = [];
    let dugum = 0, asildi = false;
    const bas = o.durum ? o.durum.slice() : new Uint8Array(b.en * b.boy);
    if (!o.durum) for (const k of b.baslangic) bas[k.r * b.en + k.c] = k.v;
    function dal(d, kirli) {
      if (++dugum > butce) { asildi = true; return; }
      let r = yay(d, b, kirli ? { kirli } : {});
      if (r.sonuc === 'celiski') return;
      if (o.sinama) while (r.sonuc === 'takildi') {
        const s = sina1(d, b);
        if (!s) break;
        if (s.celiski) return;
        r = yay(d, b, { kirli: kesisen(b, s.idx) });
        if (r.sonuc === 'celiski') return;
      }
      if (r.sonuc === 'cozuldu') { cozumler.push(d.slice()); return; }
      // dallanma: en az bilinmeyenli çizgideki ilk bilinmeyen kare
      let enIyi = -1, enAz = 1e9;
      for (let l = 0; l < b.en + b.boy; l++) {
        const n = cizgiBoyu(b, l);
        let bil = 0, ilk = -1;
        for (let i = 0; i < n; i++) { const idx = kareDizini(b, l, i); if (!d[idx]) { bil++; if (ilk < 0) ilk = idx; } }
        if (bil && bil < enAz) { enAz = bil; enIyi = ilk; }
      }
      for (const v of [1, 2]) {
        const k = d.slice(); k[enIyi] = v;
        dal(k, kesisen(b, enIyi));
        if (cozumler.length >= 2 || asildi) return;
      }
    }
    dal(bas, null);
    const sonuc = cozumler.length >= 2 ? 'cok' : asildi ? 'bilinmiyor' : cozumler.length === 1 ? 'tek' : 'yok';
    return { sonuc, cozumler, dugum };
  }

  // Tarayıcı için dilimli tekillik (arayüzü kilitlemez): aynı sonucu Promise ile verir
  function tekillikAsync(b, o = {}) {
    return new Promise((coz) => setTimeout(() => coz(tekillik(b, o)), 0));
  }

  const S = { yay, sina1, sina2, coz, tekillik, tekillikAsync, adaylar, kesisen, kareDizini, cizgiBoyu };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).solver = S;
  if (node) module.exports = S;
})();
