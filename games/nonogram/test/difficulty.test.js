const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../nonogram/model.js');
const LS = require('../nonogram/linesolver.js');
const D = require('../nonogram/difficulty.js');
const S = require('../nonogram/solver.js');
const O = require('./ornekler.js');
const yap = (s) => M.bulmacaYap({ en: s[0].length, boy: s.length, satirlar: s });
function rng(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('Z1 basit kurallar sağlam: çıktıları satır çözücünün çıktısının alt kümesi', () => {
  const r = rng(7);
  let bulgu = 0;
  for (let t = 0; t < 5000; t++) {
    const n = 2 + Math.floor(r() * 18);
    const cozum = Array.from({ length: n }, () => (r() < .55 ? 1 : 0));
    const ip = M.ipucuHesapla(cozum), bl = ip.filter(x => x > 0), acik = r() * .8;
    const s = Uint8Array.from(cozum, v => (r() < acik ? (v ? 1 : 2) : 0));
    const ls = LS.coz(ip, s);
    for (const ad of ['binme', 'uc', 'tamam', 'sigmaz']) {
      for (const g of D.kurallar[ad](bl, s)) {
        bulgu++;
        for (const i of g.dolu) assert.ok(ls.dolu.includes(i), `${ad} dolu ${i} ${ip} ${s.join('')}`);
        for (const i of g.bos) assert.ok(ls.bos.includes(i), `${ad} boş ${i} ${ip} ${s.join('')}`);
      }
    }
  }
  assert.ok(bulgu > 3000);
});

test('Z2 örnekler doğru banda düşer', () => {
  assert.equal(D.derece(yap(O.ok5)).bant, 'kolay');
  assert.equal(D.derece(yap(O.kolay10)).bant, 'kolay');
  assert.equal(D.derece(yap(O.orta10)).bant, 'orta');
  assert.equal(D.derece(yap(O.zor10)).bant, 'zor');
  assert.equal(D.derece(yap(O.uzman14)).bant, 'uzman');
});

test('Z3 puan ve adımlar deterministik; zor bant daha yüksek puan', () => {
  const a = D.derece(yap(O.orta10)), b = D.derece(yap(O.orta10));
  assert.equal(a.puan, b.puan); assert.equal(a.adim, b.adim);
  assert.ok(D.derece(yap(O.zor10)).puan > D.derece(yap(O.kolay10)).puan);
});

test('Z4 başlangıç kareleri tek çözüm ve tahminsiz çözüm sağlar', () => {
  const b = yap(O.tahmin15);
  const o = D.baslangicOner(b, { hedefBant: 'zor' });
  assert.ok(o && o.baslangic.length >= 1 && o.baslangic.length <= 10, 'az sayıda kare');
  const bb = Object.assign({}, b, { baslangic: o.baslangic });
  assert.equal(S.tekillik(bb).sonuc, 'tek');
  assert.notEqual(D.derece(bb, { sinir: 'zor' }).bant, 'tahmin');
  for (const h of o.baslangic) assert.equal(h.v === 1, !!b.cozum[h.r * b.en + h.c], 'başlangıç karesi çözümle uyumlu');
  // çok çözümlü resim de düzelir
  const dama = yap(['#.', '.#']), o2 = D.baslangicOner(dama, { hedefBant: 'kolay' });
  assert.equal(o2.baslangic.length, 1);
});

test('Z5 tahmin tespiti', () => {
  assert.equal(D.derece(yap(O.tahmin15)).bant, 'tahmin');
  assert.equal(D.derece(yap(O.zor10), { sinir: 'orta' }).bant, 'tahmin');
});

test('Z6 düzeltme önerisi çok çözümlü resmi tek çözümlü yapar', () => {
  const b = yap(['..........', '.#.#.#....', '..#.#.#...', '..........', '########..', '#......###', '#......#.#', '#......###', '.#....#...', '..####....']);
  const o = D.duzeltmeOner(b);
  assert.ok(o.length > 0);
  assert.ok(o[0].hucreler.length <= 2);
});
