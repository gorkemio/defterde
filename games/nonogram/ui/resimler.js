// ui/resimler.js — resim kataloğu: data/resimler/*.js (KK_RESIMLER) + data/hesap.js (KK_HESAP) + data/defterler.js.
// Resmi bulmacaya ve kare renklerine çevirir. Kilim ve "kendi resmin" de aynı biçime girer:
//   { id, ad, defter, tur, en, boy, cozum: Uint8Array, renk: [hex|null], zemin: [hex|null], baslangic, bant, puan }
(function () {
  'use strict';
  const KK = (window.KK = window.KK || {});
  const BY = () => Kit.boyama;
  let katalog = null;

  function hex(ad) { return BY().PALET12[ad] || (ad === 'krem' ? BY().KREM : ad); }

  function resimden(r) {
    const n = r.en * r.boy, cozum = new Uint8Array(n), renk = new Array(n).fill(null), zemin = new Array(n).fill(null);
    for (let y = 0; y < r.boy; y++) for (let x = 0; x < r.en; x++) {
      const ch = r.satirlar[y][x], i = y * r.en + x;
      if (ch !== '.') { cozum[i] = 1; renk[i] = hex(r.palet[ch] || 'siyah'); }
      else if (r.arkaPlan) {
        const sat = r.arkaPlan.satirlar;
        if (!sat || (sat[y] && sat[y][x] !== '.')) zemin[i] = hex(r.arkaPlan.renk || 'krem');
      }
    }
    const h = (window.KK_HESAP || {})[r.id] || {};
    return {
      id: r.id, ad: r.ad, defter: r.kategori, tur: 'resim', en: r.en, boy: r.boy, cozum, renk, zemin,
      baslangic: (h.baslangic || []).map(([a, b, v]) => ({ r: a, c: b, v })), bant: h.bant || '?', puan: h.puan ?? 0, kaynak: r,
    };
  }

  function yukle() {
    if (katalog) return katalog;
    const defterler = (window.KK_DEFTERLER || []).slice().sort((a, b) => a.sira - b.sira);
    const tum = [];
    for (const d of defterler) {
      const liste = ((window.KK_RESIMLER || {})[d.id] || []).map(resimden);
      liste.sort((a, b) => a.puan - b.puan || a.en * a.boy - b.en * b.boy || a.id.localeCompare(b.id));
      d.resimler = liste;
      tum.push(...liste);
    }
    katalog = { defterler, tum, harita: new Map(tum.map(r => [r.id, r])) };
    return katalog;
  }
  const bul = (id) => yukle().harita.get(id) || null;

  function bulmaca(r) { return KK.model.bulmacaYap({ id: r.id, en: r.en, boy: r.boy, cozum: r.cozum, baslangic: r.baslangic }); }

  // Boyama sırası: koyu renkler önce (çizgiler), sonra açıklar (dolgular), en son zemin yıkaması
  function boyamaSirasi(r) {
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return .299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255); };
    const gruplar = new Map();
    r.renk.forEach((h, i) => { if (h) { if (!gruplar.has(h)) gruplar.set(h, []); gruplar.get(h).push(i); } });
    const sira = [...gruplar.entries()].sort((a, b) => lum(a[0]) - lum(b[0]));
    const boya = [];
    for (const [h, liste] of sira) for (const i of liste) boya.push({ i, renk: h });
    const zemin = [];
    r.zemin.forEach((h, i) => { if (h) zemin.push({ i, renk: h }); });
    return { boya, zemin, renkler: sira.map(x => x[0]) };
  }
  // Renk adına geri çevirme (kutuda hangi kalem kalkacak)
  function renkAdi(h) { const p = BY().PALET12; return Object.keys(p).find(k => p[k] === h) || null; }

  KK.resimler = { yukle, bul, bulmaca, boyamaSirasi, renkAdi, resimden, hex };
})();
