// test/naif.js — naif referans çözücü: bütün (kaldır, koy) kombinasyonlarını düz sayar. Yalnız testlerde.
const Mo = require('../engine/model.js');

function altKumeler(dizi, k) {
  const out = [];
  const rec = (i, sec) => {
    if (sec.length === k) { out.push(sec.slice()); return; }
    for (let j = i; j < dizi.length; j++) { sec.push(dizi[j]); rec(j + 1, sec); sec.pop(); }
  };
  rec(0, []);
  return out;
}

// o: { k, tur: 'oynat'|'ekle'|'cikar' } → [{ metin, maskeler: [hex] }] metne göre sıralı
function coz(dr, o = {}) {
  const tur = o.tur || 'oynat', k = o.k || 1;
  const R = tur === 'ekle' ? 0 : tur === 'cikar' ? 1 : k, A = tur === 'ekle' ? 1 : tur === 'cikar' ? 0 : k;
  const dolu = [], bos = [];
  dr.sablon.hucreler.forEach((h, i) => {
    for (let bit = 0; bit < Mo.BITS[h.tur]; bit++) (dr.bayt[i] & (1 << bit) ? dolu : bos).push(i * 8 + bit);
  });
  const gruplar = new Map();
  for (const kal of altKumeler(dolu, R)) {
    for (const ek of altKumeler(bos, A)) {
      const yeni = Uint8Array.from(dr.bayt);
      kal.forEach(y => { yeni[y >> 3] &= ~(1 << (y & 7)); });
      ek.forEach(y => { yeni[y >> 3] |= 1 << (y & 7); });
      const d = { sablon: dr.sablon, bayt: yeni };
      const p = Mo.degerlendir(Mo.oku(d));
      if (!p.dogru) continue;
      const metin = Mo.oku(d).metin;
      if (!gruplar.has(metin)) gruplar.set(metin, []);
      gruplar.get(metin).push(Mo.maske(d));
    }
  }
  return [...gruplar.entries()].map(([metin, m]) => ({ metin, maskeler: m.sort() }))
    .sort((x, y) => (x.metin < y.metin ? -1 : x.metin > y.metin ? 1 : 0));
}

module.exports = { coz, altKumeler };
