// Hız ölçümü: 25×25 yayılım, sınama, tekillik ve derece süreleri (node test/bench.js)
const M = require('../nonogram/model.js'), S = require('../nonogram/solver.js'), D = require('../nonogram/difficulty.js');
function rng(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const N = 25, olc = { yay: [], tekillik: [], derece: [] };
let tek = 0;
for (let s = 1; s <= 60; s++) {
  const r = rng(s), satirlar = [];
  // büyük lekeli desen: komşuluğa bağlı yoğunluk (resme benzer)
  const g = []; for (let i = 0; i < N; i++) { g.push([]); for (let j = 0; j < N; j++) g[i].push(r()); }
  for (let i = 0; i < N; i++) { let x = ''; for (let j = 0; j < N; j++) { let t = 0, k = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (g[i + a] && g[i + a][j + b] != null) { t += g[i + a][j + b]; k++; } x += t / k > .5 ? '#' : '.'; } satirlar.push(x); }
  const b = M.bulmacaYap({ en: N, boy: N, satirlar });
  let t0 = performance.now(); S.yay(M.durumYap(b), b); olc.yay.push(performance.now() - t0);
  t0 = performance.now(); const t = S.tekillik(b, { dugumButcesi: 20000 }); olc.tekillik.push(performance.now() - t0);
  if (t.sonuc === 'tek') { tek++; t0 = performance.now(); D.derece(b); olc.derece.push(performance.now() - t0); }
}
const ozet = (a) => a.length ? `ort ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} ms · en çok ${Math.max(...a).toFixed(1)} ms (${a.length})` : '-';
console.log('25×25 yayılım  ', ozet(olc.yay));
console.log('25×25 tekillik ', ozet(olc.tekillik));
console.log('25×25 derece   ', ozet(olc.derece), `· tek çözümlü ${tek}/60`);
