// Uçuş sahneleri: boyutlar, engeller, rüzgâr. DOM'suz. Çizim ui/sahne.js'te.
// Ölçüler metre. el: fırlatanın elindeki kavrama noktası. zeminler: yükseltilmiş zemin parçaları (sahanlık, balkon).
// ruzgar: { ort (m/s, + arkadan), sert (sağanak genliği) } — yalnız açık havada.

export const SAHNELER = {
  sinif: {
    ad: 'Sınıf', aciklama: '12 metre, sonda açık bir pencere.', uzunluk: 12, tavan: 3.3, yanDuvar: 2.0,
    pencere: { y1: 1.9, y2: 2.7, z: 0.5 }, el: [0.5, 1.3], zeminler: [], ruzgar: null,
    gorunum: { x0: -1.2, x1: 13.2, y0: -0.35, y1: 3.4 },
  },
  koridor: {
    ad: 'Koridor', aciklama: '30 metrelik uzun koridor; dolaplar, kapılar.', uzunluk: 30, tavan: 3.0, yanDuvar: 1.2,
    pencere: null, el: [0.5, 1.3], zeminler: [], ruzgar: null,
    gorunum: { x0: -1.2, x1: 31.2, y0: -0.35, y1: 3.1 },
  },
  merdiven: {
    ad: 'Merdiven boşluğu', aciklama: 'İki kat yukarıdan bırak; ne kadar uzun süzülecek?', uzunluk: 20, tavan: 8.6, yanDuvar: 1.5,
    pencere: null, el: [0.5, 7.3], zeminler: [{ x0: -5, x1: 1.4, y: 6.0 }], ruzgar: null,
    gorunum: { x0: -1.2, x1: 21.2, y0: -0.35, y1: 8.8 },
  },
  balkon: {
    ad: 'Balkon', aciklama: 'Üçüncü kattan, rüzgârla birlikte.', uzunluk: Infinity, tavan: Infinity, yanDuvar: Infinity,
    pencere: null, el: [0.5, 9.3], zeminler: [{ x0: -5, x1: 1.5, y: 8.0 }], ruzgar: { ort: 1.5, sert: 1.2 },
    gorunum: { x0: -1.2, x1: 200, y0: -0.35, y1: 11.5 }, acik: true,
  },
  park: {
    ad: 'Park', aciklama: 'Açık çimen, ağaçlar ve değişken rüzgâr.', uzunluk: Infinity, tavan: Infinity, yanDuvar: Infinity,
    pencere: null, el: [0.5, 1.4], zeminler: [], ruzgar: { ort: 0.8, sert: 1.5 },
    gorunum: { x0: -1.2, x1: 200, y0: -0.35, y1: 7 }, acik: true,
  },
};
export const SAHNE_IDLERI = Object.keys(SAHNELER);

function tohumluRastgele(metin) {
  let h = 2166136261;
  for (const c of String(metin)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// Sağanaklı rüzgâr: iki sinüsün toplamı, fazlar tohumdan. Aynı tohum = aynı rüzgâr.
export function ruzgarFonksiyonu(r, tohum = 'ruzgar') {
  if (!r) return null;
  const rs = tohumluRastgele(tohum);
  const a = rs() * 6.283, b = rs() * 6.283;
  return (t) => r.ort + r.sert * (0.6 * Math.sin(6.283 * t / 3.1 + a) + 0.4 * Math.sin(6.283 * t / 1.3 + b));
}

// Fiziğin kullandığı tam sahne: zemin yüksekliği ve rüzgâr fonksiyonları eklenmiş.
export function sahneHazirla(id, o = {}) {
  const t = SAHNELER[id];
  if (!t) throw new Error('bilinmeyen sahne: ' + id);
  const ruzgar = o.ruzgar !== undefined ? o.ruzgar : t.ruzgar;
  const zeminler = t.zeminler;
  return {
    ...t, id, ruzgarAyari: ruzgar,
    zeminY: (x) => { for (const z of zeminler) if (x >= z.x0 && x <= z.x1) return z.y; return 0; },
    ruzgar: ruzgarFonksiyonu(ruzgar, o.tohum || id),
  };
}

// Yerel takvim günü (YYYY-AA-GG): gün oyuncunun gece yarısında değişir (UTC'de değil).
export const yerelGun = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Günün uçuşu: tarihten tohumlanan sahne, rüzgâr ve hedef mesafe. Herkes aynı gün aynı görevi alır.
export function gununUcusu(tarih = new Date()) {
  const gun = typeof tarih === 'string' ? tarih.slice(0, 10) : yerelGun(tarih);
  const r = tohumluRastgele('gunun-' + gun);
  const secenek = ['sinif', 'koridor', 'merdiven', 'balkon', 'park'];
  const sahne = secenek[Math.floor(r() * secenek.length)];
  const t = SAHNELER[sahne];
  const ruzgar = t.acik ? { ort: Math.round((r() * 7 - 3) * 10) / 10, sert: Math.round((0.5 + r() * 1.5) * 10) / 10 } : null;
  const hedefler = { sinif: [8, 11], koridor: [14, 24], merdiven: [6, 11], balkon: [14, 30], park: [10, 20] };
  const [a, b] = hedefler[sahne];
  const hedef = Math.round(a + r() * (b - a));
  return { gun, sahne, ruzgar, hedef, tohum: 'gunun-' + gun };
}
