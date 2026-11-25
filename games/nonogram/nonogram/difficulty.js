// nonogram/difficulty.js — basit satır kuralları, zorluk merdiveni (bant + puan), başlangıç karesi ve düzeltme önerisi.
// Bantlar: kolay (yalnız basit kurallar) · orta (satır çözücünün tam gücü) · zor (derinlik-1 sınama) · uzman (derinlik 2).
// Bunların ötesi "tahmin": kabul edilmez, içerik hattı başlangıç karesi ekler. DOM yok.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const LS = node ? require('./linesolver.js') : window.KK.linesolver;
  const S = node ? require('./solver.js') : window.KK.solver;
  const IP = node ? require('../kit/bulmaca/ipucu.js') : window.Kit.bulmaca.ipucu;
  const BANTLAR = IP.BANTLAR;

  // ---------- basit kurallar: (bl, s) → [bulgu]. bulgu: { kural, dolu: [i], bos: [i], veri }. Yalnız bilinmeyen kareler.
  function uclar(s) {
    let a = 0, b = s.length;
    while (a < b && s[a] === 2) a++;
    while (b > a && s[b - 1] === 2) b--;
    return [a, b];
  }
  // Blokların en sol başlangıcı L ve en sağ başlangıcı R (yalnız uç çarpıları hesaba katarak)
  function sinirlar(bl, a, b) {
    const k = bl.length, L = [], R = [];
    let x = a;
    for (let j = 0; j < k; j++) { L.push(x); x += bl[j] + 1; }
    x = b;
    for (let j = k - 1; j >= 0; j--) { x -= bl[j]; R[j] = x; x -= 1; }
    return { L, R };
  }
  const yeni = (s, dizin) => dizin.filter(i => s[i] === 0);
  function bulgu(kural, s, dolu, bos, veri) {
    const d = yeni(s, dolu), e = yeni(s, bos);
    return d.length || e.length ? { kural, dolu: d, bos: e, veri } : null;
  }
  const aralik = (x, y) => { const o = []; for (let i = x; i < y; i++) o.push(i); return o; };

  // Üst üste binme: bloğu en sola ve en sağa dayayınca ortak kalan kareler dolu
  function binme(bl, s) {
    if (!bl.length) return [];
    const [a, b] = uclar(s), { L, R } = sinirlar(bl, a, b), o = [];
    bl.forEach((len, j) => {
      if (R[j] < L[j] + len) {
        const g = bulgu('binme', s, aralik(R[j], L[j] + len), [], { blok: j, uzunluk: len, alan: b - a, bas: a, sol: L[j], sag: R[j], ortak: L[j] + len - R[j], tek: bl.length === 1, bloklar: bl });
        if (g) o.push(g);
      }
    });
    return o;
  }

  // Uç kuralı: kenara yakın dolu kare ilk (son) bloğa aittir
  function uc(bl, s) {
    if (!bl.length) return [];
    const n = s.length, o = [];
    const [a, b] = uclar(s);
    // soldan
    let p = a; while (p < b && s[p] !== 1) p++;
    const L0 = bl[0];
    if (p < b && p < a + L0) {
      const bos = aralik(a, Math.max(a, p - L0 + 1));
      if (p === a && a + L0 < n) bos.push(a + L0);
      const g = bulgu('uc', s, aralik(p, a + L0), bos, { taraf: 'sol', uzunluk: L0, mesafe: p - a, bas: a, dolu: p });
      if (g) o.push(g);
    }
    // sağdan
    let q = b - 1; while (q >= a && s[q] !== 1) q--;
    const Lk = bl[bl.length - 1];
    if (q >= a && q > b - 1 - Lk) {
      const bos = aralik(Math.min(b, q + Lk), b);
      if (q === b - 1 && b - Lk - 1 >= 0) bos.push(b - Lk - 1);
      const g = bulgu('uc', s, aralik(b - Lk, q + 1), bos, { taraf: 'sag', uzunluk: Lk, mesafe: b - 1 - q, bas: b, dolu: q });
      if (g) o.push(g);
    }
    return o;
  }

  // Tamamlanan blok: bütün dolular yerindeyse kalanlar çarpı; en uzun blok kadar koşunun iki ucu çarpı
  function tamam(bl, s) {
    const n = s.length, o = [];
    const toplam = bl.reduce((x, y) => x + y, 0);
    let dolu = 0;
    for (let i = 0; i < n; i++) if (s[i] === 1) dolu++;
    if (dolu === toplam) {
      const g = bulgu('tamam', s, [], aralik(0, n), { tur: toplam ? 'hepsi' : 'sifir' });
      if (g) return [g];
    }
    if (!bl.length) return o;
    const enUzun = Math.max(...bl);
    for (let i = 0; i < n;) {
      if (s[i] !== 1) { i++; continue; }
      let e = i; while (e < n && s[e] === 1) e++;
      if (e - i === enUzun) {
        const bos = []; if (i > 0) bos.push(i - 1); if (e < n) bos.push(e);
        const g = bulgu('tamam', s, [], bos, { tur: 'blok', uzunluk: enUzun, bas: i });
        if (g) o.push(g);
      }
      i = e;
    }
    return o;
  }

  // Sığmayan boşluk: en küçük bloğun sığmadığı, dolu içermeyen boşluk ve hiçbir bloğun ulaşamadığı kareler çarpı
  function sigmaz(bl, s) {
    if (!bl.length) return [];
    const n = s.length, o = [], enKucuk = Math.min(...bl);
    for (let i = 0; i < n;) {
      if (s[i] === 2) { i++; continue; }
      let e = i, doluVar = false;
      while (e < n && s[e] !== 2) { if (s[e] === 1) doluVar = true; e++; }
      if (!doluVar && e - i < enKucuk) {
        const g = bulgu('sigmaz', s, [], aralik(i, e), { tur: 'bosluk', uzunluk: e - i, enKucuk });
        if (g) o.push(g);
      }
      i = e;
    }
    const [a, b] = uclar(s), { L, R } = sinirlar(bl, a, b), ulas = new Uint8Array(n);
    bl.forEach((len, j) => { for (let i = L[j]; i < R[j] + len && i < n; i++) ulas[i] = 1; });
    const bos = [];
    for (let i = a; i < b; i++) if (!ulas[i]) bos.push(i);
    const g = bulgu('sigmaz', s, [], bos, { tur: 'ulasilmaz' });
    if (g) o.push(g);
    return o;
  }

  // Satır çözücünün tam gücü (basit kuralların göremediği)
  const lsSonuc = new Uint8Array(64);
  function satirCozucu(bl, s) {
    if (!LS.hesapla(bl, s, s.length, lsSonuc)) return [];
    const dolu = [], bos = [];
    for (let i = 0; i < s.length; i++) if (!s[i]) { if (lsSonuc[i] === 1) dolu.push(i); else if (lsSonuc[i] === 2) bos.push(i); }
    const g = bulgu('satirCozucu', s, dolu, bos, {});
    return g ? [g] : [];
  }

  const kurallar = { binme, uc, tamam, sigmaz, satirCozucu };

  // ---------- merdiven
  function cizgi(d, b, l, buf) {
    const n = S.cizgiBoyu(b, l);
    for (let i = 0; i < n; i++) buf[i] = d[S.kareDizini(b, l, i)];
    return buf.subarray(0, n);
  }
  function cizgiTeknigi(ad, kural, bant) {
    return {
      ad, bant,
      bul(d, b) {
        const h = blok(b), buf = new Uint8Array(Math.max(b.en, b.boy));
        for (let l = 0; l < b.en + b.boy; l++) {
          const s = cizgi(d, b, l, buf);
          if (s.indexOf(0) < 0) continue;
          const g = kural(h[l], s)[0];
          if (!g) continue;
          const tur = l < b.boy ? 'satir' : 'sutun', i = l < b.boy ? l : l - b.boy;
          const hucreler = [];
          for (const x of g.dolu) { const idx = S.kareDizini(b, l, x); hucreler.push({ r: (idx / b.en) | 0, c: idx % b.en, v: 1 }); }
          for (const x of g.bos) { const idx = S.kareDizini(b, l, x); hucreler.push({ r: (idx / b.en) | 0, c: idx % b.en, v: 2 }); }
          return { teknik: ad, bolge: { tur, i }, hucreler, veri: Object.assign({ n: s.length, ipucu: h[l] }, g.veri) };
        }
        return null;
      },
    };
  }
  function blok(b) { return b._bloklar || (b._bloklar = [...b.ipuclari.satir, ...b.ipuclari.sutun].map(ip => ip.filter(x => x > 0))); }
  function sinamaTeknigi(ad, derinlik, bant) {
    return {
      ad, bant,
      bul(d, b) {
        const k = d.slice();
        const s = derinlik === 1 ? S.sina1(k, b, { kalan: 1e9 }) : S.sina2(k, b, { enCok: 40, butce: { kalan: 3000 } });
        if (!s || s.celiski) return null;
        const r = (s.idx / b.en) | 0, c = s.idx % b.en, l = s.celiskiCizgi;
        return {
          teknik: ad, bolge: { tur: 'kare', i: s.idx, r, c }, hucreler: [{ r, c, v: s.v }],
          veri: { varsayilan: s.varsayilan, celiski: { tur: l < b.boy ? 'satir' : 'sutun', i: l < b.boy ? l : l - b.boy } },
        };
      },
    };
  }

  const TEKNIKLER = [
    cizgiTeknigi('binme', binme, 'kolay'), cizgiTeknigi('uc', uc, 'kolay'), cizgiTeknigi('tamam', tamam, 'kolay'),
    cizgiTeknigi('sigmaz', sigmaz, 'kolay'), cizgiTeknigi('satirCozucu', satirCozucu, 'orta'),
    sinamaTeknigi('sinama1', 1, 'zor'), sinamaTeknigi('sinama2', 2, 'uzman'),
  ];
  const AGIRLIK = { binme: 1, uc: 1, tamam: 1, sigmaz: 1, satirCozucu: 3, sinama1: 15, sinama2: 40 };
  const TABAN = { kolay: 0, orta: 100, zor: 250, uzman: 500 };

  function uygula(d, a, b) { for (const h of a.hucreler) d[h.r * b.en + h.c] = h.v; }
  function bitti(d) { return d.indexOf(0) < 0; }
  const merdiven = IP.Merdiven(TEKNIKLER, { uygula, bitti });

  // derece(b, { durum, sinir }) → { bant ('kolay'…'uzman' | 'tahmin'), puan, adim, teknikler: {ad: sayı}, durum (son durum), adimlar? }
  function derece(b, o = {}) {
    const d0 = o.durum || baslangicDurumu(b);
    const k = merdiven.cozumKaydi(d0, b, o.sinir);
    const teknikler = {};
    let enYuksek = 0, puan = 0;
    for (const a of k.adimlar) {
      teknikler[a.teknik] = (teknikler[a.teknik] || 0) + 1;
      enYuksek = Math.max(enYuksek, BANTLAR.indexOf(a.bant));
      puan += AGIRLIK[a.teknik];
    }
    const bant = k.bitti ? BANTLAR[enYuksek] : 'tahmin';
    return { bant, puan: (TABAN[bant] ?? 1000) + k.adimlar.length + puan, adim: k.adimlar.length, teknikler, durum: k.durum, adimlar: o.adimlar ? k.adimlar : undefined };
  }
  function baslangicDurumu(b, bas) {
    const d = new Uint8Array(b.en * b.boy);
    for (const h of bas || b.baslangic) d[h.r * b.en + h.c] = h.v;
    return d;
  }

  // Yalnız basit kurallarla yayılım (kolay bandın gücü). d yerinde değişir; → değişen kare sayısı (çelişkide -1)
  function basitYay(d, b, kirli) {
    const h = blok(b), N = b.en + b.boy, buf = new Uint8Array(Math.max(b.en, b.boy)), kuyruk = [], ic = new Uint8Array(N);
    const ekle = (l) => { if (!ic[l]) { ic[l] = 1; kuyruk.push(l); } };
    if (kirli) kirli.forEach(ekle); else for (let l = 0; l < N; l++) ekle(l);
    let degisen = 0;
    while (kuyruk.length) {
      const l = kuyruk.shift(); ic[l] = 0;
      const s = cizgi(d, b, l, buf);
      if (s.indexOf(0) < 0) continue;
      for (const kural of [binme, uc, tamam, sigmaz]) {
        for (const g of kural(h[l], s)) {
          for (const [liste, v] of [[g.dolu, 1], [g.bos, 2]]) for (const x of liste) {
            if (s[x]) continue;
            const idx = S.kareDizini(b, l, x);
            d[idx] = v; s[x] = v; degisen++;
            ekle(l < b.boy ? b.boy + x : x);
          }
        }
      }
    }
    return degisen;
  }
  // Hedef bandın gücüyle yayılım: kolay basit kurallar · orta satır çözücü · zor + derinlik 1 · uzman + derinlik 2
  function yayBant(d, b, bant, kirli) {
    if (bant === 'kolay') return basitYay(d, b, kirli);
    const once = d.reduce((a, v) => a + (v ? 1 : 0), 0);
    const r = bant === 'orta' ? S.yay(d, b, kirli ? { kirli } : {}) : S.coz(d, b, { derinlik: bant === 'zor' ? 1 : 2 });
    if (r.sonuc === 'celiski') return -1;
    return d.reduce((a, v) => a + (v ? 1 : 0), 0) - once;
  }

  // En az başlangıç karesi: tek çözüm ve hedef banttan zor olmayan tahminsiz çözüm sağlanana kadar her adımda
  // en çok yeni çıkarım (yayılım) sağlayan kareyi açar.
  function baslangicOner(b, o = {}) {
    const hedef = o.hedefBant || 'zor', enCok = o.enCok ?? 40, butce = o.dugumButcesi ?? 30000;
    const bas = b.baslangic.slice();
    for (let tur = 0; tur <= enCok; tur++) {
      const bb = Object.assign({}, b, { baslangic: bas });
      const t = S.tekillik(bb, { dugumButcesi: butce });
      let aday, taban;
      if (t.sonuc === 'tek') {
        const dr = derece(bb, { sinir: hedef });
        if (dr.bant !== 'tahmin') return { baslangic: bas, derece: dr, tur };
        taban = dr.durum;
        aday = []; for (let i = 0; i < taban.length; i++) if (!taban[i]) aday.push(i);
      } else if (t.sonuc === 'yok') return null;
      else {
        taban = baslangicDurumu(b, bas); S.yay(taban, b);
        if (t.sonuc === 'cok') { aday = []; for (let i = 0; i < taban.length; i++) if (t.cozumler[0][i] !== t.cozumler[1][i]) aday.push(i); }
        else { aday = []; for (let i = 0; i < taban.length; i++) if (!taban[i]) aday.push(i); }
      }
      if (tur === enCok || !aday.length) return null;
      // çok aday varsa eşit aralıklı örnek
      const ornek = aday.length > 80 ? aday.filter((_, i) => i % Math.ceil(aday.length / 80) === 0) : aday;
      let enIyi = ornek[0], enIyiPuan = -1;
      const guc = t.sonuc === 'tek' ? hedef : 'orta';
      for (const idx of ornek) {
        const d = taban.slice(); d[idx] = b.cozum[idx] ? 1 : 2;
        const p = yayBant(d, b, guc === 'zor' || guc === 'uzman' ? 'orta' : guc, S.kesisen(b, idx));
        if (p > enIyiPuan) { enIyiPuan = p; enIyi = idx; }
      }
      bas.push({ r: (enIyi / b.en) | 0, c: enIyi % b.en, v: b.cozum[enIyi] ? 1 : 2 });
    }
    return null;
  }

  // Resmi en az bozan 1–2 karelik düzeltmeler (yalnız çok çözümlü resimler için): [{ hucreler: [{r, c}], bant }]
  function duzeltmeOner(b, o = {}) {
    const M = node ? require('./model.js') : window.KK.model;
    const t = S.tekillik(b, { dugumButcesi: o.dugumButcesi ?? 20000 });
    if (t.sonuc !== 'cok') return [];
    const fark = [];
    for (let i = 0; i < b.cozum.length; i++) if (t.cozumler[0][i] !== t.cozumler[1][i]) fark.push(i);
    const sonuc = [], dene = (dizin) => {
      const cozum = b.cozum.slice();
      for (const i of dizin) cozum[i] ^= 1;
      const nb = M.bulmacaYap({ id: b.id, en: b.en, boy: b.boy, cozum });
      if (S.tekillik(nb, { dugumButcesi: 10000 }).sonuc === 'tek') {
        const dr = derece(nb);
        if (dr.bant !== 'tahmin') sonuc.push({ hucreler: dizin.map(i => ({ r: (i / b.en) | 0, c: i % b.en, yeni: cozum[i] })), bant: dr.bant });
      }
    };
    for (const i of fark.slice(0, 24)) dene([i]);
    if (!sonuc.length) for (let x = 0; x < Math.min(fark.length, 10); x++) for (let y = x + 1; y < Math.min(fark.length, 10); y++) dene([fark[x], fark[y]]);
    return sonuc.slice(0, o.enCok || 5);
  }

  const D = { kurallar, TEKNIKLER, merdiven, derece, baslangicDurumu, baslangicOner, duzeltmeOner, uygula, basitYay, yayBant, BANTLAR, AGIRLIK, sinirlar };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).difficulty = D;
  if (node) module.exports = D;
})();
