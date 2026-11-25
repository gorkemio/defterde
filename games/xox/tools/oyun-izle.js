// Tek bir kendi kendine oyunu ayrıntılı oynatır: her hamlede tür, değer, derinlik, düğüm; sonunda tahta.
// Kullanım: node tools/oyun-izle.js <oyunNo (0'dan)> [a=zor] [b=orta]
const B = require('../board.js'), AI = require('../ai.js');
const g = +(process.argv[2] || 0), a = process.argv[3] || 'zor', b = process.argv[4] || 'orta';
const rnd = B.rng(1000 + Math.floor(g / 2));
let d = B.yeniOyun({});
while (d.hamleler.length < 3) {
  const r = 5 + Math.floor(rnd() * 5), c = 5 + Math.floor(rnd() * 5);
  if (B.gecerliMi(d, r, c)) d = B.oyna(d, r, c);
}
const kim = { 2: g % 2 ? b : a, 1: g % 2 ? a : b };
while (!d.bitti) {
  const z = kim[d.sira];
  const h = AI.sec(d, { zorluk: z, tohum: g * 31 + d.hamleler.length });
  console.log(String(d.hamleler.length + 1).padStart(2), B.SEMBOL[d.sira], z.padEnd(5), B.hucreAdi(h.r, h.c).padEnd(4), h.tur, h.deger != null ? Math.round(h.deger) : '', h.derinlik ?? '', h.dugum, h.sureMs + 'ms');
  d = B.oyna(d, h.r, h.c);
}
console.log('kazanan:', d.kazanan === 'berabere' ? 'berabere' : kim[d.kazanan] + ' (' + B.SEMBOL[d.kazanan] + ')');
for (let r = 0; r < 15; r++) { let t = ''; for (let c = 0; c < 15; c++) t += '.XO'[B.tas(d, r, c)] + ' '; console.log(String(r + 1).padStart(2), t); }
console.log('   ' + 'ABCDEFGHIJKLMNO'.split('').join(' '));
