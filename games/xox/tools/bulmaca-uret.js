// VCF bulmacası üretir: kolay–kolay oyunlarından, sıradakinin zorunlu hamlesi olmadığı ama sürekli dörtle (en az 3
// saldırı hamlesi) kazandığı konumlar. Yavaş çözücüyle doğrular. Çıktı: test/vcf-bulmacalar.js için ASCII.
const B = require('../board.js'), AI = require('../ai.js'), { yavasVcf } = require('../test/yavas-vcf.js');
const istenen = +(process.argv[2] || 10);
const bulunan = [];
for (let g = 0; bulunan.length < istenen && g < 3000; g++) {
  let d = B.yeniOyun({});
  const rnd = B.rng(77 + g);
  while (!d.bitti && d.hamleler.length < 60) {
    if (d.hamleler.length >= 10 && !AI.zorunluHamle(d)) {
      const v = AI.vcfBul(d);
      if (v && v.length >= 5 && yavasVcf(d, d.sira, 10)) {
        const satirlar = [];
        for (let r = 0; r < 15; r++) { let t = ''; for (let c = 0; c < 15; c++) t += '.XO'[B.tas(d, r, c)]; satirlar.push(t); }
        bulunan.push({ sira: d.sira === 1 ? 'X' : 'O', satirlar, uzunluk: (v.length + 1) / 2 });
        break;
      }
    }
    const h = AI.sec(d, { zorluk: 'kolay', tohum: Math.floor(rnd() * 1e6) });
    d = B.oyna(d, h.r, h.c);
  }
}
console.log(JSON.stringify(bulunan, null, 1));
