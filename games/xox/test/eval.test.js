// eval.js testleri: her desen için en az üç örnek (kenara yaslı, kırık, çift sayma tuzağı), tam beş, çatallar,
// çatal puanı > tek desenlerin toplamı, sıra katmanı, zorunlu hamle kuralı, artımlı puan == tam tarama, sınırsız pencere,
// tehdit işaretleri.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const E = require('../eval.js');
const { konum, ayristir } = require('./yardim.js');

// satır dizesi → X'in parça sınıfları ('|' duvar, 'O' rakip, '.' / '_' boş)
const sinif = (d, tam) => E.satirSiniflari(d, tam);
function hepsi(liste, beklenen, tam = false) {
  for (const d of liste) assert.deepEqual(sinif(d, tam), beklenen, `"${d}"`);
}

/* ---------- desenler ---------- */

test('beş: düz, kenara yaslı, rakip arasında; okulda altı da beş', () => {
  hepsi(['XXXXX', '|XXXXX|', 'OXXXXXO', '..XXXXX..', 'XXXXXX'], ['bes']);
});

test('tam beş: altı ve yedi beş değil, tam beş beş', () => {
  assert.deepEqual(sinif('XXXXX', true), ['bes']);
  assert.notDeepEqual(sinif('XXXXXX', true), ['bes']);
  assert.notDeepEqual(sinif('OXXXXXXXO', true), ['bes']);
  // tam beşte OX_XXXXO: tek boş altı yapar → dört değil; X.XXXX. ise sağ uçtan tam beş yapar → dört
  assert.notDeepEqual(sinif('OX.XXXXO', true), ['dort']);
  assert.deepEqual(sinif('OX.XXXXO'), ['dort']);
  assert.deepEqual(sinif('X.XXXX.', true), ['dort']);
});

test('açık dört: _XXXX_, kenarda bile iki ucu açık, çizgide çift dört', () => {
  hepsi(['_XXXX_', '|_XXXX_|', 'O_XXXX_O', '..XXXX..', 'X.XXX.X'], ['acikDort']);
});

test('kapalı ve kırık dört: OXXXX_, kenara yaslı, XX_XX, X_XXX, XXX_X', () => {
  hepsi(['OXXXX_', '|XXXX.', '_XXXXO', 'XX_XX', 'X_XXX', 'XXX_X', 'OXX.XXO', '|X.XXX..O'], ['dort']);
});

test('açık üç: __XXX__, kırık _XX_X_ ve _X_XX_, kenara kadar yer varsa', () => {
  hepsi(['__XXX__', '_XX_X_', '_X_XX_', '|..XXX..|', 'O..XXX..O', 'O.XX.X.O'], ['acikUc']);
});

test('kapalı üç: O_XXX_O, kenara yaslı, tek tarafı açık', () => {
  hepsi(['O_XXX_O', '|XXX__', 'OXXX..', '_XXX_', '|XX.X.|', 'OX.XX..'], ['uc']);
});

test('açık iki ve iki', () => {
  hepsi(['__XX__', '_X_X__', '..X..X..', '|..XX..'], ['acikIki']);
  hepsi(['|XX...', 'OXX...', '...XXO'], ['iki']);
});

test('ölü: beşe yer yok, desen sayılmaz', () => {
  hepsi(['OXXXO', '|XXX.O', 'O.XX.O'], []);
});

test('çift sayma tuzağı: aynı doğruda iki ayrı grup, tek açık dört, uzak taşlar', () => {
  assert.deepEqual(sinif('...XX....XX...'), ['acikIki', 'acikIki'], '4 boşla ayrılan iki grup ayrı sayılır');
  assert.deepEqual(sinif('|XX....XX|'), ['iki', 'iki'], 'duvara yaslı iki ikili');
  assert.deepEqual(sinif('_XXXX_'), ['acikDort'], 'açık dört iki dört sayılmaz');
  assert.deepEqual(sinif('XXX_XXX'), ['dort'], 'okulda XXX_XXX tek dört (altı ve üstü kazanır)');
  assert.deepEqual(sinif('X...X....X...X'), ['iki', 'iki'], 'aralar 3 ve 4 boş');
  // bir taşın iki yönde desen vermesi: tahtada ayrı doğrular ayrı sayılır
  const d = konum([
    '.......',
    '..X....',
    '..X....',
    '.XXX...',
    '.......',
  ], { boyut: 7 }, B.O);
  const P = E.pencereKur(d);
  const say = E.sayim(P, B.X);
  assert.equal(say.acikUc + say.uc, 2, 'dikey ve yatay üçler ayrı');
});

/* ---------- tahta üstünde desen sayımı ---------- */

test('tahta: kenara yaslı dört DORT, ortada açık dört ACIK_DORT', () => {
  const d = konum([
    'XXXX...........',
    '...............',
    '.....OOOO......',
  ], {}, B.X);
  const P = E.pencereKur(d);
  assert.equal(E.sayim(P, B.X).dort, 1);
  assert.equal(E.sayim(P, B.O).acikDort, 1);
});

/* ---------- çatallar ---------- */

test('çatal tespiti: dört-üç, üç-üç, dört-dört', () => {
  // (4,4)'e X: yatay ...XXX? ve dikey üçler
  const ucUc = konum([
    '.........',
    '.........',
    '....X....',
    '....X....',
    '..XX.....',
    '.........',
    '.........',
  ], { boyut: 9 }, B.X);
  let P = E.pencereKur(ucUc);
  let c = E.catallar(P, E.hucre(P, 4, 4), B.X);
  assert.equal(c.ucUc, true, 'üç-üç');
  assert.equal(c.dortUc, false);

  const dortUc = konum([
    '.........',
    '....X....',
    '....X....',
    '....X....',
    '..XX.....',
    '.........',
    '.........',
  ], { boyut: 9 }, B.X);
  P = E.pencereKur(dortUc);
  c = E.catallar(P, E.hucre(P, 4, 4), B.X);
  assert.equal(c.dortUc, true, 'dört-üç');

  const dortDort = konum([
    '.........',
    '....X....',
    '....X....',
    '....X....',
    '.XXX.....',
    '.........',
    '.........',
  ], { boyut: 9 }, B.X);
  P = E.pencereKur(dortDort);
  c = E.catallar(P, E.hucre(P, 4, 4), B.X);
  assert.equal(c.dortDort, true, 'dört-dört');
  assert.equal(E.dortDuzeyi(P, E.hucre(P, 4, 4), B.X), 2, 'çift dört durdurulamaz');
});

test('çatal puanı tek desenlerin toplamından belirgin yüksek', () => {
  const { PUAN, S, CATAL } = E;
  assert.ok(CATAL.dortUc > 3 * (PUAN[S.DORT] + PUAN[S.ACIK_UC]));
  assert.ok(CATAL.ucUc > 2 * (2 * PUAN[S.ACIK_UC]));
  assert.ok(CATAL.dortDort > 4 * (2 * PUAN[S.DORT]));
  // tahtada: dört + açık üç olan taraf, yalnız dördü olandan çatal kadar fazla alır
  const d = konum([
    '...............',
    '..XXXXO........',
    '...............',
    '......XXX......',
  ], {}, B.O);
  const P = E.pencereKur(d);
  assert.equal(E.catal(P, B.X), CATAL.dortUc);
});

/* ---------- sıra katmanı ---------- */

test('sıra katmanı: sıradakinin dördü ≈ kazanç, rakibin açık dördü ≈ kayıp', () => {
  const d = konum(['.XXXX.O', '.OOO...', 'O......'], { boyut: 9 }, B.X);
  const P = E.pencereKur(d);
  assert.equal(E.puan(P, B.X), E.YAKIN);
  assert.ok(E.puan(P, B.O) < -E.YAKIN / 2);
});

/* ---------- zorunlu hamle ---------- */

const zorunluKare = (d) => {
  const P = E.pencereKur(d), z = E.zorunlu(P, d.sira);
  return z && { rc: E.koord(P, z.i), tur: z.tur };
};

test('zorunlu: kendi beşi rakibin dördünü kapatmaktan önce gelir', () => {
  const d = konum([
    '.XXXX.....',
    '..........',
    '.OOOO.....',
  ], { boyut: 10 }, B.X);
  const z = zorunluKare(d);
  assert.equal(z.tur, 'bes');
  assert.ok([[0, 0], [0, 5]].some(([r, c]) => r === z.rc[0] && c === z.rc[1]));
});

test('zorunlu: rakibin kapalı ve kırık dördünü kapat', () => {
  let z = zorunluKare(konum(['XOOOO.....', '..X.X.....', 'X.........'], { boyut: 10 }, B.X));
  assert.deepEqual([z.tur, z.rc], ['kapat', [0, 5]]);
  z = zorunluKare(konum(['..OO.OO...', '..X.X.....', 'X..X......'], { boyut: 10 }, B.X));
  assert.deepEqual([z.tur, z.rc], ['kapat', [0, 4]]);
  z = zorunluKare(konum(['.O........', '..O.......', '...O......', '..........', '.....O....', 'XX.X......', 'X.X.......'], { boyut: 10 }, B.X));
  assert.deepEqual([z.tur, z.rc], ['kapat', [3, 4]]);
});

test('zorunlu: rakibin iki dördü → kaybedilmiş; kendi dördünü yapan kapatmayı seç', () => {
  // O'nun iki ayrı tamamlaması: (0,5) ve (5,0). X (0,5)'e yazınca kendi dikey dördünü de yapar → en uzun direnen
  const d = konum([
    '.OOOO.',
    'O....X',
    'O....X',
    'O....X',
    'O.....',
    '......',
  ], { boyut: 6 }, B.X);
  const z = zorunluKare(d);
  assert.equal(z.tur, 'kayip');
  assert.deepEqual(z.rc, [0, 5]);
});

test('zorunlu: kendi açık dördünü yap (rakipte dört yokken), yoksa null', () => {
  let z = zorunluKare(konum(['..........', '...XXX....', '..........', 'OO..O.....', 'O.........'], { boyut: 10 }, B.X));
  assert.equal(z.tur, 'acikDort');
  assert.ok([[1, 2], [1, 6]].some(([r, c]) => r === z.rc[0] && c === z.rc[1]), JSON.stringify(z));
  z = zorunluKare(konum(['..........', '...XX.....', '..........', 'OO..O.....'], { boyut: 10 }, B.X));
  assert.equal(z, null);
  // rakibin açık üçü varken bile kendi açık dördü önce gelir (rakip dört yapamadan beş gelir)
  z = zorunluKare(konum(['..........', '...XXX....', '..........', '..OOO.....', 'O.........'], { boyut: 10 }, B.X));
  assert.equal(z.tur, 'acikDort');
});

test('zorunlu: özellik testi (500 rastgele konum)', () => {
  const rnd = B.rng(2024);
  let sinandi = 0;
  for (let t = 0; t < 500; t++) {
    let d = B.yeniOyun({});
    const n = 8 + Math.floor(rnd() * 50);
    for (let k = 0; k < n && !d.bitti; k++) {
      let r, c;
      do { r = 3 + Math.floor(rnd() * 9); c = 3 + Math.floor(rnd() * 9); } while (!B.gecerliMi(d, r, c));
      d = B.oyna(d, r, c);
    }
    if (d.bitti) continue;
    const s = d.sira, o = 3 - s;
    const z = zorunluKare(d);
    // bağımsız doğrulama: board.js ile beş yapan kareler
    const besKareleri = (renk) => {
      const k = B.konumKur(d.ayar, d.hamleler, renk), l = [];
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (!B.tas(k, r, c) && B.oyna(k, r, c).kazanan === renk) l.push(r * 15 + c);
      return l;
    };
    const ben = besKareleri(s), onun = besKareleri(o);
    if (ben.length) { assert.equal(z.tur, 'bes'); assert.ok(ben.includes(z.rc[0] * 15 + z.rc[1])); sinandi++; }
    else if (onun.length) {
      assert.ok(onun.includes(z.rc[0] * 15 + z.rc[1]), 'rakibin tamamlama karesini kapatmalı');
      assert.equal(z.tur, onun.length === 1 ? 'kapat' : 'kayip');
      sinandi++;
    } else if (z) {
      assert.equal(z.tur, 'acikDort');
      // yazınca gerçekten iki tamamlama kalmalı
      const y = B.konumKur(d.ayar, d.hamleler.concat([{ r: z.rc[0], c: z.rc[1], sembol: s }]), s);
      let say = 0;
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (!B.tas(y, r, c) && B.oyna(y, r, c).kazanan === s) say++;
      assert.ok(say >= 2, 'açık dört: iki tamamlama');
      sinandi++;
    }
  }
  assert.ok(sinandi > 100, 'yeterince zorunlu konum sınanmalı: ' + sinandi);
});

/* ---------- artımlı puan ---------- */

test('artımlı puan == tam tarama (200 rastgele konum, koy/kaldır zinciri)', () => {
  const rnd = B.rng(99);
  for (const ayar of [{}, { tamBes: true }, { boyut: 0 }]) {
    for (let t = 0; t < 70; t++) {
      let d = B.yeniOyun(ayar);
      const n = 6 + Math.floor(rnd() * 60);
      for (let k = 0; k < n && !d.bitti; k++) {
        let r, c;
        do { r = Math.floor(rnd() * 15); c = Math.floor(rnd() * 15); } while (!B.gecerliMi(d, r, c));
        d = B.oyna(d, r, c);
      }
      const P = E.pencereKur(d);
      const zincir = [];
      for (let k = 0; k < 16; k++) {
        const a = E.adaylar(P);
        if (!a.length) break;
        const i = a[Math.floor(rnd() * a.length)];
        E.koy(P, i, 1 + (k % 2)); zincir.push(i);
      }
      for (let k = 0; k < 9 && zincir.length; k++) E.kaldir(P, zincir.pop());
      const T = E.tamPuan(P);
      for (const s of [1, 2]) assert.ok(Math.abs(T.top[s] - P.top[s]) < 1e-6, 'puan');
      assert.deepEqual(Array.from(T.say), Array.from(P.say), 'sayım');
    }
  }
});

test('koy/kaldır hash ve sınır kutusunu geri getirir', () => {
  const d = B.oynat({}, [[7, 7], [7, 8], [8, 8]]);
  const P = E.pencereKur(d);
  const [hi, lo, bb] = [P.hi, P.lo, P.bb.slice()];
  assert.equal(P.hi, d.hash.hi); assert.equal(P.lo, d.hash.lo);
  const i = E.hucre(P, 2, 2);
  E.koy(P, i, 2);
  assert.deepEqual(P.bb, [2, 2, 8, 8]);
  E.kaldir(P, i);
  assert.deepEqual([P.hi, P.lo, P.bb], [hi, lo, bb]);
});

/* ---------- sınırsız pencere ---------- */

test('sınırsız: pencere kenarı deseni kesmez (uzak iki küme, köşedeki açık dört)', () => {
  const taslar = ayristir(['.XXXX.'], -40, -40).concat(ayristir(['OOO'], 30, 30)).concat([{ r: 0, c: 0, sembol: 2 }]);
  const d = B.konumKur({ boyut: 0 }, taslar, B.O);
  const P = E.pencereKur(d);
  assert.equal(E.sayim(P, B.X).acikDort, 1);
  assert.equal(E.sayim(P, B.O).acikUc + E.sayim(P, B.O).uc, 1);
  // tamamlama kareleri pencere içinde bulunur
  const t = E.tamamlamaHucreleri(P, B.X).map(i => E.koord(P, i)).sort((a, b) => a[1] - b[1]);
  assert.deepEqual(t, [[-40, -40], [-40, -35]]);
});

/* ---------- tehditler ---------- */

test('tehditler: noktalar sıradakinin açık üçünü açık dörde, dördünü beşe tamamlar; halka rakibinkini kapatır', () => {
  // X sırada: X'in açık üçü (2,3..5); O'nun açık üçü (6,3..5)
  const d = konum([
    '..........',
    '..........',
    '...XXX....',
    '..........',
    '..........',
    '..........',
    '...OOO....',
    '..........',
  ], { boyut: 10 }, B.X);
  const t = E.tehditler(d, B.X);
  const n = t.noktalar.map(([r, c]) => r * 10 + c).sort((a, b) => a - b);
  assert.ok(n.includes(22) && n.includes(26), JSON.stringify(t.noktalar));
  assert.ok(t.halka && t.halka[0] === 6 && [2, 6, 1, 7].includes(t.halka[1]), JSON.stringify(t.halka));
  // rakibin dördü varsa halka onun tamamlama karesi
  const d2 = konum(['..........', '..XX......', '..........', 'OOOO......', '..........'], { boyut: 10 }, B.X);
  assert.deepEqual(E.tehditler(d2, B.X).halka, [3, 4]);
});
