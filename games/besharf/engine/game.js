// engine/game.js — Beş Harf oyun mantığı: geri bildirim (iki geçiş), kurallar, zor mod, durum, kaydet/yükle, paylaşım metni.
// DOM'a, localStorage'a, Kit'e dokunmaz. Tarayıcıda BH.game, node'da module.exports.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('../kit/tr.js') : window.Kit.tr;

  const YOK = 0, YANLIS_YER = 1, DOGRU = 2;
  const HAK = 6, UZUNLUK = 5;
  const SURUM = 1;

  const harfler = (k) => Array.from(tr.normalize(k));

  // İki geçiş: önce doğru yerler işaretlenir ve cevabın kalan harfleri sayılır; sonra kalan sayıya göre yanlış yerler.
  // Tekrar eden harfler böylece doğru sayılır (KAPAK ← AAAAA: yok, doğru, yok, doğru, yok).
  function geriBildirim(tahmin, cevap) {
    const t = harfler(tahmin), c = harfler(cevap);
    const sonuc = new Array(t.length).fill(YOK);
    const kalan = new Map();
    for (let i = 0; i < t.length; i++) {
      if (t[i] === c[i]) sonuc[i] = DOGRU;
      else kalan.set(c[i], (kalan.get(c[i]) || 0) + 1);
    }
    for (let i = 0; i < t.length; i++) {
      if (sonuc[i] === DOGRU) continue;
      const n = kalan.get(t[i]) || 0;
      if (n > 0) { sonuc[i] = YANLIS_YER; kalan.set(t[i], n - 1); }
    }
    return sonuc;
  }

  const gecerliMi = (kelime, kume) => harfler(kelime).length === UZUNLUK && kume.has(tr.normalize(kelime));

  // Zor mod: doğru yerde bulunan harf aynı yerde, yanlış yerde bulunan harf (gereken sayıda) kullanılmalı.
  // gecmis: [{ kelime, sonuc }]. Döner null ya da { kural: 'yer' | 'harf', mesaj }.
  function zorModKontrol(tahmin, gecmis) {
    const t = harfler(tahmin);
    for (const g of gecmis) {
      const h = harfler(g.kelime);
      for (let i = 0; i < h.length; i++) {
        if (g.sonuc[i] === DOGRU && t[i] !== h[i]) return { kural: 'yer', harf: h[i], konum: i, mesaj: `${i + 1}. harf ${h[i]} olmalı` };
      }
    }
    const gerek = new Map();
    for (const g of gecmis) {
      const say = new Map();
      harfler(g.kelime).forEach((c, i) => { if (g.sonuc[i] !== YOK) say.set(c, (say.get(c) || 0) + 1); });
      for (const [c, n] of say) gerek.set(c, Math.max(gerek.get(c) || 0, n));
    }
    for (const [c, n] of gerek) {
      const var_ = t.filter((x) => x === c).length;
      if (var_ < n) return { kural: 'harf', harf: c, sayi: n, mesaj: n > 1 ? `${c} harfi ${n} kez olmalı` : `${c} harfini kullanmalısın` };
    }
    return null;
  }

  /* ---------- durum ---------- */

  // o: { mod: 'gunun' | 'serbest' | 'duello' | 'arkadas' | 'ikiKisi', cevap, zor, no, tarih, tohum }
  function yeni(o) {
    return { surum: SURUM, mod: o.mod || 'gunun', cevap: tr.normalize(o.cevap), zor: !!o.zor, no: o.no ?? null, tarih: o.tarih ?? null,
      tohum: o.tohum ?? null, tahminler: [], sonuc: null };
  }

  const bitti = (d) => d.sonuc !== null;

  // Geçersiz kelime hak saymaz. Döner { durum, satir } ya da { hata: 'kisa' | 'listede-yok' | 'zor' | 'bitti', mesaj, ... }
  function tahminEt(d, kelime, kume) {
    if (bitti(d)) return { hata: 'bitti', mesaj: 'oyun bitti' };
    const k = tr.normalize(kelime);
    if (harfler(k).length < UZUNLUK) return { hata: 'kisa', mesaj: 'beş harf' };
    if (!gecerliMi(k, kume)) return { hata: 'listede-yok', mesaj: 'listede yok' };
    if (d.zor) {
      const z = zorModKontrol(k, d.tahminler);
      if (z) return Object.assign({ hata: 'zor' }, z);
    }
    const sonuc = geriBildirim(k, d.cevap);
    const yeniD = Object.assign({}, d, { tahminler: d.tahminler.concat([{ kelime: k, sonuc }]) });
    if (sonuc.every((x) => x === DOGRU)) yeniD.sonuc = 'kazandi';
    else if (yeniD.tahminler.length >= HAK) yeniD.sonuc = 'kaybetti';
    return { durum: yeniD, satir: { kelime: k, sonuc } };
  }

  // Klavye: her harfin en iyi durumu ('d' doğru yer, 'y' yanlış yer, 'x' yok)
  function tusDurumlari(tahminler) {
    const ad = ['x', 'y', 'd'], m = new Map();
    for (const t of tahminler) harfler(t.kelime).forEach((c, i) => {
      const s = t.sonuc[i];
      if (!m.has(c) || s > ad.indexOf(m.get(c))) m.set(c, ad[s]);
    });
    return m;
  }

  /* ---------- kaydet / yükle ---------- */

  const kaydet = (d) => JSON.stringify(d);

  function yukle(metin) {
    let d;
    try { d = typeof metin === 'string' ? JSON.parse(metin) : metin; } catch (e) { return null; }
    if (!d || d.surum !== SURUM || typeof d.cevap !== 'string' || harfler(d.cevap).length !== UZUNLUK || !Array.isArray(d.tahminler)) return null;
    if (d.tahminler.length > HAK) return null;
    for (const t of d.tahminler) {
      if (!t || typeof t.kelime !== 'string' || !Array.isArray(t.sonuc)) return null;
      // sonuç cevaba göre yeniden hesaplanır: bozuk ya da elle oynanmış kayıt tutarsızsa atılır
      const s = geriBildirim(t.kelime, d.cevap);
      if (s.join() !== t.sonuc.join()) return null;
    }
    if (![null, 'kazandi', 'kaybetti'].includes(d.sonuc)) return null;
    return d;
  }

  /* ---------- paylaşım ---------- */

  const ISARET = { duz: ['□', '▧', '▩'], renkli: ['⬜', '🟨', '🟩'] };

  // "Beş Harf No. 12 · 4/6" (+ "*" zor mod; kayıpta X/6) ve işaret satırları. Cevap hiçbir metinde geçmez.
  function paylasimMetni(d, o = {}) {
    const k = o.renkli ? ISARET.renkli : ISARET.duz;
    const skor = (d.sonuc === 'kazandi' ? d.tahminler.length : 'X') + '/' + HAK + (d.zor ? '*' : '');
    const bas = d.mod === 'gunun' ? `Beş Harf No. ${d.no} · ${skor}`
      : d.mod === 'arkadas' ? `Beş Harf · arkadaş kelimesi · ${skor}`
      : d.mod === 'ikiKisi' ? `Beş Harf · iki kişi · ${skor}`
      : `Beş Harf · serbest · ${skor}`;
    return [bas, ...d.tahminler.map((t) => t.sonuc.map((s) => k[s]).join(''))].join('\n');
  }

  /* ---------- arkadaş bağlantısı: #k=XXXXXX ---------- */

  // Kelime linkte basit bir kodlamayla taşınır (gizlilik değil, göz ucuyla okunmasın): her harfin alfabe sırası konuma göre
  // kaydırılıp 29 tabanlı bir karaktere çevrilir; sonda bir denetim karakteri. Bozuk ya da değiştirilmiş link reddedilir.
  const RAKAM = '0123456789abcdefghijklmnopqrs';
  function linkKodla(kelime) {
    const k = harfler(kelime).map((h) => tr.indeks(h));
    if (k.length !== UZUNLUK || k.some((x) => x < 0)) return null;
    const govde = k.map((x, i) => RAKAM[(x + 7 * (i + 1) + 3) % 29]).join('');
    return govde + RAKAM[k.reduce((t, x, i) => t + x * (i + 2), 0) % 29];
  }
  function linkCoz(kod) {
    const s = String(kod || '').trim().replace(/[A-S]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));   // yalnız ASCII
    if (s.length !== UZUNLUK + 1 || [...s].some((c) => RAKAM.indexOf(c) < 0)) return null;
    const k = [...s.slice(0, UZUNLUK)].map((c, i) => ((RAKAM.indexOf(c) - 7 * (i + 1) - 3) % 29 + 29 * 2) % 29);
    if (RAKAM[k.reduce((t, x, i) => t + x * (i + 2), 0) % 29] !== s[UZUNLUK]) return null;
    return k.map((x) => tr.ALFABE[x]).join('');
  }

  const G = { YOK, YANLIS_YER, DOGRU, HAK, UZUNLUK, SURUM, geriBildirim, gecerliMi, zorModKontrol, yeni, bitti, tahminEt,
    tusDurumlari, kaydet, yukle, paylasimMetni, linkKodla, linkCoz };
  if (typeof window !== 'undefined') (window.BH = window.BH || {}).game = G;
  if (node) module.exports = G;
})();
