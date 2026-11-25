// node test/bench.js — düğüm/s ve bütçede ulaşılan derinlik (test değil; ölçüm). Sonuçlar PLAN.md'ye not edilir.
const B = require('../board.js');
const AI = require('../ai.js');

const konumlar = {
  'yerleştirme (başlangıç)': B.yeniOyun(),
  'yerleştirme (orta)': B.kur({ b: [0, 4, 15, 9, 21], s: [7, 13, 20, 2, 11], el: [4, 4], sira: 0 }),
  'hareket 7-7': B.kur({ b: [0, 2, 9, 11, 13, 20, 22], s: [1, 3, 5, 7, 12, 17, 19], el: [0, 0], sira: 0 }),
  'uçma 3-7': B.kur({ b: [0, 12, 23], s: [1, 3, 5, 7, 9, 11, 17], el: [0, 0], sira: 0 }),
  'uçma 3-3': B.kur({ b: [0, 12, 23], s: [1, 14, 19], el: [0, 0], sira: 0 }),
};

for (const [ad, d] of Object.entries(konumlar)) {
  AI.yeniOyun();
  let t = performance.now();
  const s = AI.dusunSenkron(d, { zorluk: 'zor', derinlik: 6 });
  const ms6 = performance.now() - t;
  const satir = [`${ad.padEnd(24)} d6: ${s.dugum} düğüm, ${ms6.toFixed(0)} ms, ${(s.dugum / ms6 / 1000).toFixed(2)} M/s`];
  for (const butce of [500, 1500]) {
    AI.yeniOyun();
    t = performance.now();
    const r = AI.dusunSenkron(d, { zorluk: 'zor', butceMs: butce, derinlik: 40 });
    satir.push(`${butce} ms → derinlik ${r.derinlik} (${(performance.now() - t).toFixed(0)} ms)`);
  }
  console.log(satir.join(' · '));
}
