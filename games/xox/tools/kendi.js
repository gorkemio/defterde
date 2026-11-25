// Kendi kendine oyun: zorlukları birbirine karşı oynatır, kazanma oranı ve hamle süresi / düğüm / derinlik yazar.
// Kullanım: node tools/kendi.js [oyunSayisi=6] [esler=zor-orta,orta-kolay,zor-kolay] [butceCarpani=1]
const B = require('../board.js'), AI = require('../ai.js');
const N = +(process.argv[2] || 6);
const esler = (process.argv[3] || 'zor-orta,orta-kolay,zor-kolay').split(',').map(s => s.split('-'));
const carpan = +(process.argv[4] || 1);

function acilis(rnd) {
  // ortada rastgele 3 taş (X, O, X): her oyun farklı başlar
  let d = B.yeniOyun({});
  while (d.hamleler.length < 3) {
    const r = 5 + Math.floor(rnd() * 5), c = 5 + Math.floor(rnd() * 5);
    if (B.gecerliMi(d, r, c)) d = B.oyna(d, r, c);
  }
  return d;
}

const olcum = {};
for (const [a, b] of esler) {
  const skor = { [a]: 0, [b]: 0, berabere: 0 };
  for (let g = 0; g < N; g++) {
    const rnd = B.rng(1000 + Math.floor(g / 2));         // her açılış iki kez: renkler değişir
    let d = acilis(rnd);
    // çift oyunlarda a, tek oyunlarda b O tarafında (açılıştan sonra sıra O'da)
    const kim = { 2: g % 2 ? b : a, 1: g % 2 ? a : b };
    while (!d.bitti) {
      const z = kim[d.sira];
      const ayar = { zorluk: z, tohum: g * 31 + d.hamleler.length };
      if (z !== 'kolay') ayar.butceMs = AI.ZORLUK[z].butceMs * carpan;
      const h = AI.sec(d, ayar);
      const o = (olcum[z] = olcum[z] || { n: 0, sure: 0, enUzun: 0, dugum: 0, derinlik: 0, araN: 0 });
      o.n++; o.sure += h.sureMs; o.enUzun = Math.max(o.enUzun, h.sureMs);
      if (h.tur === 'arama') { o.araN++; o.dugum += h.dugum; o.derinlik += h.derinlik; }
      d = B.oyna(d, h.r, h.c);
    }
    if (d.kazanan === 'berabere') skor.berabere++; else skor[kim[d.kazanan]]++;
    process.stdout.write(`${a}-${b} oyun ${g + 1} (açılış ${Math.floor(g / 2) + 1}, X: ${kim[1]}): ${d.kazanan === 'berabere' ? 'berabere' : kim[d.kazanan]} (${d.hamleler.length} hamle)\n`);
  }
  console.log(`== ${a} vs ${b}:`, JSON.stringify(skor));
}
for (const z in olcum) {
  const o = olcum[z];
  console.log(`${z}: hamle ${o.n}, ort ${Math.round(o.sure / o.n)} ms, en uzun ${o.enUzun} ms` +
    (o.araN ? `, aramada ort düğüm ${Math.round(o.dugum / o.araN)}, ort derinlik ${(o.derinlik / o.araN).toFixed(1)}` : ''));
}
