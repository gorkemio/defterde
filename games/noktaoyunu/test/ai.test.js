// node --test test/ai.test.js — bilgisayar rakip (PLAN §8.2: A1–A8; A9 yalnız NK_SIM=1)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const C = require('../chains.js');
const A = require('../ai.js');

const G5 = B.geo(5, 5), H = G5.H, V = G5.V;
const BES = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const UCUC = [H(0, 1), V(0, 1), H(1, 0), V(1, 0), H(4, 2), V(3, 3), H(3, 3), V(2, 4)];
const BIRBES = [V(3, 0), H(4, 0), V(0, 0), V(0, 1), V(0, 2), V(0, 3), H(1, 3), V(1, 4)];
// [4, döngü 4]: alt sıra boyunca 4'lük zincir (iki ucu kenar), üstte (0,1)–(1,2) 2×2 döngü
const DORT_D4 = [V(3, 0), V(3, 1), V(3, 2), V(3, 3), V(3, 4), V(0, 2), V(1, 2), H(1, 1), H(1, 2)];
// 4×4 nokta [2, 3]: sol üstte kenar boyunca 2'lik, sağ altta L biçimli 3'lük
const G4 = B.geo(4, 4);
const IKI_UC = [G4.V(0, 0), G4.V(0, 1), G4.H(0, 1), G4.V(2, 2), G4.H(2, 2), G4.H(3, 1), G4.V(1, 3)];

const zorO = (ek) => Object.assign({ zorluk: 'zor', butceMs: 60, rng: A.rngYap(7) }, ek);

// Konumu iki karar vericiyle bitir: f0(d) ve f1(d) çizgi seçer
function bitir(d, f0, f1) { while (!d.bitti) B.cek(d, (d.sira === 0 ? f0 : f1)(d)); return d; }
const kesin = (d) => C.tahtaCoz(d).hamle;

test('A1 orta ve zor güvenli hamle varken asla üçüncü kenar vermez (300 konum)', () => {
  const r = A.rngYap(3);
  let sayi = 0;
  for (let i = 0; sayi < 300; i++) {
    const [m, n] = [[4, 4], [5, 5], [6, 6], [5, 7]][i % 4];
    const d = B.yeniOyun({ m, n });
    const hedef = Math.floor(r() * d.G.E * .6);
    while (d.G.E - d.kalan < hedef) { const g = B.guvenli(d); if (!g.length) break; B.cek(d, g[Math.floor(r() * g.length)]); }
    if (!B.guvenli(d).length || B.alinabilir(d).length) continue;
    for (const z of ['orta', 'zor']) {
      const s = A.sec(d, { zorluk: z, butceMs: 25, rng: A.rngYap(i) });
      assert.ok(B.guvenliMi(d, s.e), `${z} ${d.G.kenarAdi(s.e)} güvensiz\n` + B.yazdir(d));
    }
    sayi++;
  }
});

for (const [ad, sinir] of [['kesin arama', 22], ['parça çözücüsü', 0]]) {
  test(`A2 zor [3, 3] son oyununda kontrolü korur: 4–2 (${ad})`, () => {
    const d = B.kur({ bos: UCUC, sahip: BES, sira: 0 });
    B.cek(d, H(0, 1));                                   // insan ilk 3'lüğü uçtan açar
    const kararlar = [];
    bitir(d, kesin, (x) => { const s = A.sec(x, zorO({ sinir })); kararlar.push(s.neden); return s.e; });
    assert.deepEqual(d.puan, [7, 9], 'bilgisayar kalan 6 kutunun 4\'ünü alır');
    assert.ok(kararlar.includes('ikisiHaric'), kararlar.join(' '));
  });

  test(`A3 zor [4, döngü 4]'te önce döngüyü, [1, 5]'te 1'liği açar (${ad})`, () => {
    const d = B.kur({ bos: DORT_D4, sahip: [0, 1, 0, 1, 0, 1, 0, 1], sira: 1 });
    const s = A.sec(d, zorO({ sinir }));
    assert.ok([V(0, 2), V(1, 2), H(1, 1), H(1, 2)].includes(s.e), d.G.kenarAdi(s.e));
    const b = B.kur({ bos: BIRBES, sahip: BES, sira: 1 });
    const t = A.sec(b, zorO({ sinir }));
    assert.ok([V(3, 0), H(4, 0)].includes(t.e), b.G.kenarAdi(t.e));
    bitir(b, kesin, (x) => A.sec(x, zorO({ sinir })).e);
    assert.deepEqual(b.puan, [6, 10], 'karşılığı +4');
  });

  test(`A6 2'liği ortadan açar; uçtan açılan 2'liği reddeder (${ad})`, () => {
    const d = B.kur({ m: 4, n: 4, bos: IKI_UC, sahip: [0, 1, 0, 1], sira: 1 });
    assert.equal(A.sec(d, zorO({ sinir })).e, G4.V(0, 1), 'sert ikram: orta kenar');
    const y = B.kur({ m: 4, n: 4, bos: IKI_UC, sahip: [0, 1, 0, 1], sira: 0 });
    B.cek(y, G4.V(0, 0));                                // insan 2'liği uçtan açar (yarım gönüllü)
    const s = A.sec(y, zorO({ sinir }));
    assert.equal(s.e, G4.H(0, 1), 'iki kutuyu geri çevirir');
    assert.equal(s.neden, 'ikisiHaric');
  });
}

test('A4 kolay 10 oyunda ortaya karşı en az 7 kez kaybeder (5×5)', () => {
  let kayip = 0;
  for (let i = 0; i < 10; i++) {
    const d = B.yeniOyun({ m: 5, n: 5, baslayan: i % 2 });
    const r0 = A.rngYap(100 + i), r1 = A.rngYap(200 + i);
    bitir(d, (x) => A.sec(x, { zorluk: 'kolay', rng: r0 }).e, (x) => A.sec(x, { zorluk: 'orta', rng: r1 }).e);
    if (d.puan[0] < d.puan[1]) kayip++;
  }
  console.log(`  kolay–orta: kolay 10 oyunda ${kayip} kez kaybetti`);
  assert.ok(kayip >= 7, `${kayip}`);
});

test('A5 üç seviye de kapanabilen kutuyu alır (güvenli hamle varken)', () => {
  const d = B.kur({ cizgiler: ['A1-B1', 'A1-A2', 'B1-B2'], sira: 1 });
  for (const z of ['kolay', 'orta', 'zor']) {
    const s = A.sec(d, { zorluk: z, butceMs: 30, rng: A.rngYap(1) });
    assert.equal(s.e, d.G.kenar('A2-B2'), z);
    assert.equal(s.neden, 'al');
  }
});

test('A7 aynı tohum, aynı hamle', () => {
  const d = B.yeniOyun({ m: 5, n: 5 });
  const r = A.rngYap(9);
  for (let i = 0; i < 12; i++) { const g = B.guvenli(d); B.cek(d, g[Math.floor(r() * g.length)]); }
  for (const z of ['kolay', 'orta', 'zor']) {
    const a = A.sec(d, { zorluk: z, rng: A.rngYap(5), derinlik: 2, butceMs: 5000 });
    const b = A.sec(d, { zorluk: z, rng: A.rngYap(5), derinlik: 2, butceMs: 5000 });
    assert.equal(a.e, b.e, z);
  }
});

test('A8 asenkron: bütçede yasal hamle, olay döngüsü akar; iptal AbortError', async () => {
  const d = B.yeniOyun({ m: 7, n: 7 });
  let tik = 0;
  const sayac = setInterval(() => tik++, 1);
  const t0 = Date.now();
  const s = await A.secAsync(d, { zorluk: 'zor', butceMs: 120, derinlik: 12 });
  clearInterval(sayac);
  assert.ok(B.guvenliMi(d, s.e));
  assert.ok(Date.now() - t0 < 260, `${Date.now() - t0} ms`);
  assert.ok(tik > 3, 'arama sırasında zamanlayıcılar çalıştı');
  const k = new AbortController();
  setTimeout(() => k.abort(), 20);
  await assert.rejects(A.secAsync(d, { zorluk: 'zor', butceMs: 5000, derinlik: 8 }, { signal: k.signal }), { name: 'AbortError' });
  assert.equal(d.kalan, d.G.E, 'girdi değişmez');
});

test('A9 kazanma oranları (yalnız NK_SIM=1)', { skip: !process.env.NK_SIM }, () => {
  const oyun = (z0, z1, i) => {
    const d = B.yeniOyun({ m: 5, n: 5, baslayan: i % 2 });
    const r0 = A.rngYap(1000 + i), r1 = A.rngYap(2000 + i);
    bitir(d, (x) => A.sec(x, { zorluk: z0, rng: r0, butceMs: 300 }).e, (x) => A.sec(x, { zorluk: z1, rng: r1, butceMs: 300 }).e);
    return d.puan[0] > d.puan[1] ? 1 : d.puan[0] === d.puan[1] ? .5 : 0;
  };
  for (const [a, b] of [['zor', 'orta'], ['orta', 'kolay'], ['zor', 'kolay']]) {
    let p = 0;
    for (let i = 0; i < 20; i++) p += oyun(a, b, i);
    console.log(`  ${a}–${b}: ${p} / 20`);
  }
});
