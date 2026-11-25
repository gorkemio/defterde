// Düello: aynı cihazda iki kişi sırayla atar; her oyuncunun en uzak atışı sayılır, eşitlikte toplam. DOM'suz.
export function duelloBaslat({ oyuncular, sahne, tur = 3 }) {
  if (!Array.isArray(oyuncular) || oyuncular.length !== 2 || oyuncular.some(o => !o.ucakId)) throw new Error('iki oyuncu ve uçak gerekli');
  return {
    oyuncular: oyuncular.map((o, i) => ({ ad: (o.ad || `Oyuncu ${i + 1}`).slice(0, 24), ucakId: o.ucakId })),
    sahne, tur, atislar: [[], []], sira: 0, bitti: false,
  };
}
export const siradaki = (d) => d.oyuncular[d.sira];
export const turNo = (d) => d.atislar[d.sira].length + 1;

export function atisEkle(d, mesafe, olay = '') {
  if (d.bitti) return d;
  const atislar = d.atislar.map(a => a.slice());
  atislar[d.sira].push({ mesafe: Math.round(mesafe * 100) / 100, olay });
  const bitti = atislar.every(a => a.length >= d.tur);
  const sira = bitti ? d.sira : (atislar[1 - d.sira].length < d.tur ? 1 - d.sira : d.sira);
  return { ...d, atislar, sira, bitti };
}

export function skor(d) {
  const s = d.atislar.map(a => ({ enIyi: Math.max(0, ...a.map(x => x.mesafe)), toplam: a.reduce((t, x) => t + x.mesafe, 0) }));
  let kazanan = -1;
  if (s[0].enIyi !== s[1].enIyi) kazanan = s[0].enIyi > s[1].enIyi ? 0 : 1;
  else if (s[0].toplam !== s[1].toplam) kazanan = s[0].toplam > s[1].toplam ? 0 : 1;
  return { oyuncular: s, kazanan };
}
