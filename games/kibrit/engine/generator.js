// engine/generator.js — doğru eşitlik sayımı, ters hamle (bozma), sınıflandırma ve tohumlu tek bulmaca üretimi.
// scripts/uret.mjs (node) ve tarayıcı aynı dosyayı kullanır. DOM'a bakmaz.
//
//   dogruEsitlikler(sablonId, { enCok, r }) → [durum]          (sayılar tam basamak genişliğinde, öncü sıfır yok)
//   boz(dogruDurum, { k, tur }, { enCok, r }) → [durum]         (kanonik, geçerli, yanlış başlangıçlar)
//   siniflandir(bas, kaynak) → { tek, iki, ekle, cikar, hepsini }   (kaynak: bozmanın türü)
//   uret(tohum, { kategori, band, sablonlar, enCokHucre }) → { durum, kategori, zorluk } | null
(function () {
  'use strict';
  const dugum = typeof module !== 'undefined' && module.exports;
  const Mo = dugum ? require('./model.js') : window.KB.model;
  const So = dugum ? require('./solver.js') : window.KB.solver;
  const Zor = () => (dugum ? require('./difficulty.js') : window.KB.difficulty);

  const KATEGORILER = ['tek', 'iki', 'ekle', 'cikar', 'hepsini', 'romen'];
  const KAT_AD = { tek: 'Tek Çöp', iki: 'İki Çöp', ekle: 'Bir Çöp Ekle', cikar: 'Bir Çöp Çıkar', hepsini: 'Hepsini Bul', romen: 'Romen' };
  // Bulmaca kategorisinin başlangıcı üretmek için uygulanan ters hamle
  const TERS = { tek: { k: 1, tur: 'oynat' }, hepsini: { k: 1, tur: 'oynat' }, romen: { k: 1, tur: 'oynat' },
    iki: { k: 2, tur: 'oynat' }, ekle: { tur: 'cikar' }, cikar: { tur: 'ekle' } };

  const aralikOf = (w, romen) => (romen ? [1, 50] : w === 1 ? [0, 9] : [10 ** (w - 1), 10 ** w - 1]);
  function romenYaz(n) {
    const T = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, k] of T) while (n >= v) { s += k; n -= v; }
    return s;
  }
  const sayiYazi = (n, romen) => (romen ? romenYaz(n) : String(n));
  const sigar = (n, w, romen) => (romen ? romenYaz(n).length <= w && n >= 1 && n <= 50 : (w === 1 ? n >= 0 && n <= 9 : n >= 10 ** (w - 1) && n <= 10 ** w - 1));

  // Son sayıyı (sağ tarafın son terimi) diğerlerinden çöz. Sağ taraf 1 ya da 2 sayılı.
  function sonSayi(s, say) {
    const k = s.islemler.indexOf('=');
    const sol = Mo.taraf(say.slice(0, k + 1), s.islemler.slice(0, k));
    if (sol === null) return null;
    const sagI = s.islemler.slice(k + 1);
    if (sagI.length === 0) return sol;
    if (sagI.length > 1) return null;
    const r1 = say[k + 1], op = sagI[0];
    if (op === '+') return sol - r1;
    if (op === '-') return r1 - sol;
    if (op === '*') return r1 === 0 ? null : sol / r1;
    if (op === '/') return sol === 0 ? null : r1 / sol;
    return null;
  }
  function metinOf(s, say) {
    let m = '';
    say.forEach((v, i) => { m += sayiYazi(v, s.romen); if (i < s.islemler.length) m += s.islemler[i]; });
    return m;
  }
  function dogruMu(s, say) {
    const n = s.sayilar.length;
    for (let i = 0; i < n; i++) if (!sigar(say[i], s.sayilar[i].basamak, s.romen)) return false;
    let d;
    try { d = Mo.yaz(s.id, metinOf(s, say)); } catch (e) { return false; }
    return Mo.dogru(d) && Mo.kanonikMi(d) ? d : false;
  }

  // Tüm doğru eşitlikler (gerekirse tohumlu örnek: en çok enCok)
  function dogruEsitlikler(sablonId, o = {}) {
    const s = Mo.sablon(sablonId);
    const n = s.sayilar.length, out = [];
    const ar = s.sayilar.map(sy => aralikOf(sy.basamak, s.romen));
    const say = new Array(n);
    (function rec(i) {
      if (i === n - 1) {
        const v = sonSayi(s, say);
        if (v === null || !Number.isInteger(v)) return;
        say[n - 1] = v;
        const d = dogruMu(s, say);
        if (d) out.push(d);
        return;
      }
      for (let v = ar[i][0]; v <= ar[i][1]; v++) { say[i] = v; rec(i + 1); }
    })(0);
    if (o.enCok && out.length > o.enCok) {
      const r = o.r || Mo.rng(['esitlik', sablonId]);
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      out.length = o.enCok;
    }
    return out;
  }
  // Tek rastgele doğru eşitlik (tarayıcı üreticisi)
  function rastgeleEsitlik(sablonId, r, deneme = 300) {
    const s = Mo.sablon(sablonId);
    const n = s.sayilar.length;
    const ar = s.sayilar.map(sy => aralikOf(sy.basamak, s.romen));
    for (let t = 0; t < deneme; t++) {
      const say = ar.map(([a, b]) => a + Math.floor(r() * (b - a + 1)));
      const v = sonSayi(s, say);
      if (v === null || !Number.isInteger(v)) continue;
      say[n - 1] = v;
      const d = dogruMu(s, say);
      if (d) return d;
    }
    return null;
  }

  // Ters hamle: hedef hücre baytları kanonik ve geçerli; sonuç sözdizimsel olarak düzgün ve yanlış
  function boz(dogru, ters, o = {}) {
    const s = dogru.sablon, n = s.hucreSayisi, by = dogru.bayt;
    const { R, A } = So.hedef(ters);
    const yeni = new Uint8Array(n), kar = new Array(n);
    const out = [];
    (function dfs(i, r, a, esit) {
      if (i === n) {
        if (r !== R || a !== A || esit !== 1) return;
        const ok = Mo.okuKarakter(s, kar);
        if (!ok.gecerli) return;
        if (Mo.degerlendir(ok).dogru) return;
        out.push({ sablon: s, bayt: Uint8Array.from(yeni) });
        return;
      }
      const h = s.hucreler[i];
      for (const t of So.DELTA[h.tur][by[i]]) {
        if (r + t.r > R || a + t.a > A) continue;
        if (!Mo.KANONIK[h.tur][t.yeni]) continue;
        if (t.bos && !h.bos) continue;
        if (esit + t.esit > 1) continue;
        yeni[i] = t.yeni; kar[i] = Mo.TANI[h.tur][t.yeni];
        dfs(i + 1, r + t.r, a + t.a, esit + t.esit);
      }
    })(0, 0, 0, 0);
    if (o.enCok && out.length > o.enCok) {
      const r = o.r || Mo.rng(['boz', Mo.kanonikDize(dogru)]);
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      out.length = o.enCok;
    }
    return out;
  }

  // Hangi kategorilere uyar? kaynak: bozmanın yapıldığı kategori grubu ('tek' | 'iki' | 'ekle' | 'cikar')
  function siniflandir(bas, kaynak) {
    const sonuc = {};
    if (kaynak === 'tek' || kaynak === 'hepsini' || kaynak === 'romen') {
      const c = So.cozumSayisi(bas, { k: 1 });
      if (bas.sablon.romen) { if (c === 1) sonuc.romen = 1; return sonuc; }
      if (c === 1) sonuc.tek = 1;
      if (c >= 2 && c <= 6) sonuc.hepsini = c;
    } else if (kaynak === 'iki') {
      if (So.cozumSayisi(bas, { k: 2 }) === 1 && So.cozumSayisi(bas, { k: 1 }) === 0) sonuc.iki = 1;
    } else if (kaynak === 'ekle') {
      if (So.cozumSayisi(bas, { tur: 'ekle' }) === 1) sonuc.ekle = 1;
    } else if (kaynak === 'cikar') {
      if (So.cozumSayisi(bas, { tur: 'cikar' }) === 1) sonuc.cikar = 1;
    }
    return sonuc;
  }

  // Bir bulmaca kategorinin koşullarını sağlıyor mu? (test ve tarayıcı denetimi)
  function kosul(bas, kategori) {
    if (Mo.dogru(bas) || !Mo.kanonikMi(bas) || !Mo.oku(bas).gecerli) return false;
    const c1 = () => So.cozumSayisi(bas, { k: 1 });
    if (kategori === 'tek' || kategori === 'romen') return c1() === 1;
    if (kategori === 'hepsini') { const c = c1(); return c >= 2 && c <= 6; }
    if (kategori === 'iki') return So.cozumSayisi(bas, { k: 2 }) === 1 && c1() === 0;
    if (kategori === 'ekle') return So.cozumSayisi(bas, { tur: 'ekle' }) === 1;
    if (kategori === 'cikar') return So.cozumSayisi(bas, { tur: 'cikar' }) === 1;
    return false;
  }

  // Tarayıcıdaki üretici: tek bulmaca, tohumlu. band verilirse ±1 toleransla aranır; 400 denemede bulunamazsa gevşetilir.
  function uret(tohum, o = {}) {
    const r = Mo.rng(['uret', tohum]);
    const kategori = o.kategori || 'tek';
    const romen = kategori === 'romen';
    const sablonlar = (o.sablonlar || (romen ? Mo.SABLONLAR_ROMEN : Mo.SABLONLAR))
      .filter(id => !o.enCokHucre || Mo.sablon(id).hucreSayisi <= o.enCokHucre)
      .filter(id => !o.enCokGenislik || Mo.genislikL(id) <= o.enCokGenislik);
    if (!sablonlar.length) return null;
    const hedefBant = o.band ? Zor().BANTLAR.indexOf(o.band) : -1;
    let yedek = null;
    for (let deneme = 0; deneme < 600; deneme++) {
      const id = sablonlar[Math.floor(r() * sablonlar.length)];
      const d = rastgeleEsitlik(id, r, 60);
      if (!d) continue;
      const bozmalar = boz(d, TERS[kategori], { enCok: 6, r });
      for (const b of bozmalar) {
        if (!kosul(b, kategori)) continue;
        const z = Zor().hesapla(b, kategori);
        const fark = hedefBant < 0 ? 0 : Math.abs(Zor().BANTLAR.indexOf(z.bant) - hedefBant);
        if (fark === 0 || (deneme >= 400 && fark <= 1)) return { durum: b, kategori, zorluk: z };
        if (!yedek || fark < yedek.fark) yedek = { durum: b, kategori, zorluk: z, fark };
      }
    }
    return yedek ? { durum: yedek.durum, kategori, zorluk: yedek.zorluk } : null;
  }

  const G = { KATEGORILER, KAT_AD, TERS, romenYaz, sonSayi, dogruEsitlikler, rastgeleEsitlik, boz, siniflandir, kosul, uret };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).generator = G;
  if (dugum) module.exports = G;
})();
