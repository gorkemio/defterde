const test = require('node:test');
const assert = require('node:assert/strict');
const LS = require('../nonogram/linesolver.js');
const M = require('../nonogram/model.js');

function rng(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Kaba kuvvet: bütün blok yerleşimlerini tek tek sayar
function kaba(ipucu, satir) {
  const bl = ipucu.filter(x => x > 0), n = satir.length;
  let olasi = null, adet = 0;
  const cizgi = new Array(n).fill(0);
  (function yerlestir(j, bas) {
    if (j === bl.length) {
      for (let i = 0; i < n; i++) {
        const v = cizgi[i];
        if ((satir[i] === 1 && !v) || (satir[i] === 2 && v)) return;
      }
      adet++;
      if (!olasi) olasi = cizgi.map(v => (v ? 1 : 2));
      else for (let i = 0; i < n; i++) if (olasi[i] !== (cizgi[i] ? 1 : 2)) olasi[i] = 0;
      return;
    }
    for (let s = bas; s + bl[j] <= n; s++) {
      for (let i = s; i < s + bl[j]; i++) cizgi[i] = 1;
      yerlestir(j + 1, s + bl[j] + 1);
      for (let i = s; i < s + bl[j]; i++) cizgi[i] = 0;
    }
  })(0, 0);
  if (!adet) return { dolu: [], bos: [], celiski: true };
  const dolu = [], bos = [];
  for (let i = 0; i < n; i++) if (satir[i] === 0) { if (olasi[i] === 1) dolu.push(i); else if (olasi[i] === 2) bos.push(i); }
  return { dolu, bos, celiski: false };
}

test('L1 satır çözücü 10 000 rastgele satırda kaba kuvvetle birebir aynı', () => {
  const r = rng(20261021);
  let celiskili = 0;
  for (let t = 0; t < 10000; t++) {
    const n = 1 + Math.floor(r() * 15);
    const cozum = Array.from({ length: n }, () => (r() < .5 ? 1 : 0));
    // %15 ilgisiz ipucu (çelişki üretmek için), yoksa çözümün ipucu
    let ipucu = M.ipucuHesapla(cozum);
    if (r() < .15) ipucu = M.ipucuHesapla(Array.from({ length: n }, () => (r() < .5 ? 1 : 0)));
    const acik = r();
    const satir = cozum.map(v => (r() < acik ? (v ? 1 : 2) : 0));
    if (r() < .1) satir[Math.floor(r() * n)] = r() < .5 ? 1 : 2;   // yanlış işaret
    const a = LS.coz(ipucu, satir), b = kaba(ipucu, satir);
    if (b.celiski) celiskili++;
    assert.deepEqual(a, b, `ipucu ${ipucu} satır ${satir.join('')}`);
  }
  assert.ok(celiskili > 300, 'çelişkili örnekler de denendi');
});

test('L2 ipucu hesabı (boş satır = [0])', () => {
  assert.deepEqual(M.ipucuHesapla([0, 0, 0]), [0]);
  assert.deepEqual(M.ipucuHesapla([1, 1, 1]), [3]);
  assert.deepEqual(M.ipucuHesapla([1, 0, 1, 1, 0, 0, 1]), [1, 2, 1]);
  assert.deepEqual(M.ipucuHesapla([]), [0]);
});

test('L3 çelişki tespiti', () => {
  assert.equal(LS.coz([3], [0, 2, 0, 2, 0]).celiski, true);
  assert.equal(LS.coz([0], [0, 1, 0]).celiski, true);
  assert.equal(LS.coz([1, 1], [1, 1, 0]).celiski, true);
  assert.equal(LS.coz([2], [2, 0, 0, 2]).celiski, false);
});

test('L4 aynı girdi her zaman aynı sonucu verir', () => {
  const s = [0, 0, 1, 0, 0, 0, 2, 0, 0, 0];
  assert.deepEqual(LS.coz([2, 3], s), LS.coz([2, 3], s));
});

test('L5 uç durumlar', () => {
  assert.deepEqual(LS.coz([0], [0, 0, 0]), { dolu: [], bos: [0, 1, 2], celiski: false });
  assert.deepEqual(LS.coz([3], [0, 0, 0]), { dolu: [0, 1, 2], bos: [], celiski: false });
  assert.deepEqual(LS.coz([7], new Array(10).fill(0)).dolu, [3, 4, 5, 6]);
  assert.deepEqual(LS.coz([1, 1], [0, 0, 0]), { dolu: [0, 2], bos: [1], celiski: false });
});
