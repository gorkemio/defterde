// Sahibinin mürekkebi: boya uçları (ince kalemden fırçaya) ve kanattaki ismin stili ile harf yerleşimi. DOM'suz:
// uçak çizimi (SVG), uçuş (canvas), baskı ve not paketi aynı kuralları kullanır.

// Boya uçları. kalinlik: kanadın yerel ×100 biriminde çizgi kalınlığı (kağıt genişliğinin yüzdesi).
export const UCLAR = {
  ince: { ad: 'ince', kalinlik: 1.1 },
  orta: { ad: 'orta', kalinlik: 2.4 },
  kalin: { ad: 'kalın', kalinlik: 4.2 },
  firca: { ad: 'fırça', kalinlik: 7.5, firca: true },
};
export const UC_SIRASI = ['ince', 'orta', 'kalin', 'firca'];

// Kayıtlı bir çizginin görünüşü: kalınlık ve saydamlık. Fırça yarı saydam boya gibi üst üste koyulaşır.
export function cizgiStili(cz) {
  const kalinlik = Math.min(12, Math.max(0.4, Number(cz && cz.kalinlik) || 1.1));
  return { kalinlik, saydamlik: cz && cz.firca ? 0.5 : 0.88, firca: !!(cz && cz.firca) };
}
// Çizginin hangi uçla çizildiği (paket ve arayüz için): en yakın kalınlık; fırça bayrağı önce.
export function ucBul(cz) {
  if (cz && cz.firca) return 'firca';
  const k = Number(cz && cz.kalinlik) || 1.1;
  return ['ince', 'orta', 'kalin'].reduce((a, b) => (Math.abs(UCLAR[b].kalinlik - k) < Math.abs(UCLAR[a].kalinlik - k) ? b : a));
}

// Kanattaki ismin stili.
export const ISIM_RENKLERI = ['mavi', 'kirmizi', 'yesil'];
export const ISIM_BOYUTLARI = { kucuk: 0.75, orta: 1, buyuk: 1.3 };
export const ISIM_BICIMLERI = ['el', 'buyuk', 'cizgili'];
export const ISIM_VARSAYILAN = Object.freeze({ renk: 'mavi', boyut: 'orta', bicim: 'el' });

export function isimStiliDuzelt(s) {
  const v = { ...ISIM_VARSAYILAN, ...(s && typeof s === 'object' ? s : {}) };
  if (!ISIM_RENKLERI.includes(v.renk)) v.renk = ISIM_VARSAYILAN.renk;
  if (!(v.boyut in ISIM_BOYUTLARI)) v.boyut = ISIM_VARSAYILAN.boyut;
  if (!ISIM_BICIMLERI.includes(v.bicim)) v.bicim = ISIM_VARSAYILAN.bicim;
  return { renk: v.renk, boyut: v.boyut, bicim: v.bicim };
}

export const isimMetni = (ad, bicim) => (bicim === 'buyuk' ? String(ad).toLocaleUpperCase('tr') : String(ad));

// Harf harf yerleşim: elle yazılmış gibi her harf biraz döner, zıplar, büyüyüp küçülür; satır ortalanır.
// olc(ch): harfin boyut 1'deki genişliği. rastgele: tohumlu [0,1). Dönüş: { harfler: [{ ch, x, y, aci, s }], genislik }.
export function isimHarfleri(ad, bicim, boyut, olc, rastgele) {
  const metin = isimMetni(ad, bicim);
  const aralik = bicim === 'buyuk' ? 0.07 : 0.01;
  const harfler = [];
  let x = 0;
  for (const ch of metin) {
    const s = 0.95 + rastgele() * 0.1;
    const w = olc(ch) * boyut * s;
    harfler.push({ ch, x: x + w / 2, y: (rastgele() - 0.5) * 0.08 * boyut, aci: (rastgele() - 0.5) * 7, s });
    x += w + aralik * boyut;
  }
  const genislik = Math.max(0, x - aralik * boyut);
  for (const h of harfler) h.x -= genislik / 2;
  return { harfler, genislik };
}

// Basit tohumlu rastgele (isim + uçak kimliği): aynı uçakta isim her yerde aynı titreklikle yazılır.
export function tohumlu(metin) {
  let h = 2166136261;
  for (const c of String(metin)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
