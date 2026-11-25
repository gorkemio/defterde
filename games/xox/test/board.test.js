// board.js testleri: kazanma (dört yön, kenar ve köşe), okul kuralı / tam beş, berabere, sınırsız sayfa,
// geri alma sonrası durum ve hash eşitliği, geçersiz hamleler, değişmezlik.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const { ayristir, sirali, ciz } = require('./yardim.js');

// satırlardan gerçek oyun sırasıyla oynanmış durum; son: en son oynanan kare
function oyun(satirlar, son, ayar = {}, r0 = 0, c0 = 0) {
  return B.oynat(ayar, sirali(ayristir(satirlar, r0, c0), son));
}
// iki durumun oyun açısından aynı olduğunu doğrula
function ayniDurum(a, b, mesaj) {
  assert.deepEqual([...a.taslar.entries()].sort((x, y) => x[0] - y[0]), [...b.taslar.entries()].sort((x, y) => x[0] - y[0]), mesaj);
  assert.deepEqual(a.hamleler, b.hamleler, mesaj);
  assert.equal(a.sira, b.sira, mesaj);
  assert.deepEqual(a.sinir, b.sinir, mesaj);
  assert.deepEqual(a.hash, b.hash, mesaj);
  assert.equal(a.bitti, b.bitti, mesaj);
  assert.equal(a.kazanan, b.kazanan, mesaj);
}

/* ---------- kazanma ---------- */

test('yatay beş: sağ kenara yaslı, kazanan hamle ortada', () => {
  const once = B.konumKur({}, ayristir(['..........XX.XX', '...........OOOO']), B.X);
  const sonra = B.oyna(once, 0, 12);
  assert.equal(sonra.bitti, true);
  assert.equal(sonra.kazanan, B.X);
  assert.deepEqual(sonra.besli, [[0, 10], [0, 11], [0, 12], [0, 13], [0, 14]]);
});

test('yatay beş: gerçek oyun sırasıyla oynanınca da bulunur', () => {
  const d = oyun(['XXXXX', 'OOOO.'], [0, 2]);
  assert.equal(d.kazanan, B.X);
  assert.equal(d.hamleler.length, 9);
});

test('dikey beş: sol alt köşeye yaslı', () => {
  const once = B.konumKur({}, [
    ...[10, 11, 12, 13].map(r => ({ r, c: 0, sembol: B.O })),
    ...[1, 2, 3, 4].map(c => ({ r: 3, c, sembol: B.X })),
  ], B.O);
  const sonra = B.oyna(once, 14, 0);
  assert.equal(sonra.kazanan, B.O);
  assert.deepEqual(sonra.besli, [[10, 0], [11, 0], [12, 0], [13, 0], [14, 0]]);
});

test('çapraz beş: sol üst köşeden', () => {
  const once = B.konumKur({}, [
    ...[1, 2, 3, 4].map(i => ({ r: i, c: i, sembol: B.X })),
    ...[0, 1, 2, 3].map(i => ({ r: 6, c: i + 6, sembol: B.O })),
  ], B.X);
  const sonra = B.oyna(once, 0, 0);
  assert.equal(sonra.kazanan, B.X);
  assert.deepEqual(sonra.besli, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
});

test('ters çapraz beş: sağ üst köşeden, kazanan hamle ortada', () => {
  const once = B.konumKur({}, [
    { r: 0, c: 14, sembol: B.X }, { r: 1, c: 13, sembol: B.X }, { r: 3, c: 11, sembol: B.X }, { r: 4, c: 10, sembol: B.X },
    ...[0, 1, 2, 3].map(i => ({ r: 9, c: i, sembol: B.O })),
  ], B.X);
  const sonra = B.oyna(once, 2, 12);
  assert.equal(sonra.kazanan, B.X);
  assert.deepEqual(sonra.besli, [[0, 14], [1, 13], [2, 12], [3, 11], [4, 10]]);
});

test('ters çapraz beş: sol alt köşede biten', () => {
  const once = B.konumKur({}, [
    ...[0, 1, 2, 3].map(i => ({ r: 10 + i, c: 4 - i, sembol: B.O })),
    ...[0, 1, 2, 3, 4].map(i => ({ r: 0, c: i * 2, sembol: B.X })),
  ], B.O);
  const sonra = B.oyna(once, 14, 0);
  assert.equal(sonra.kazanan, B.O);
  assert.deepEqual(sonra.besli, [[10, 4], [11, 3], [12, 2], [13, 1], [14, 0]]);
});

test('dört kazanmaz; kesintili beş kazanmaz; satır sarması yok', () => {
  let d = B.konumKur({}, ayristir(['XXX.X', 'OOOO.']), B.X);
  assert.equal(B.oyna(d, 0, 5).bitti, false, 'XXX.XX kazanmaz');
  // sağ kenarda 3 + alt satırın başında 2: farklı satırlar
  d = B.konumKur({}, [
    { r: 0, c: 12, sembol: B.X }, { r: 0, c: 13, sembol: B.X }, { r: 0, c: 14, sembol: B.X }, { r: 1, c: 0, sembol: B.X },
    ...[0, 1, 2, 3].map(c => ({ r: 5, c: c + 5, sembol: B.O })),
  ], B.X);
  const y = B.oyna(d, 1, 1);
  assert.equal(y.bitti, false, 'satır sarması kazanma sayılmamalı\n' + ciz(y, 0, 0, 2, 14));
});

test('rakip taşı diziyi böler', () => {
  const d = B.konumKur({}, ayristir(['XXOXX', '.O.O.', 'O....']), B.X);
  assert.equal(B.kazananBul(d, 0, 0), null);
});

/* ---------- altı ve üstü ---------- */

test('altılı: okul kuralında kazanır (dizinin tamamı), tam beşte kazanmaz', () => {
  const satirlar = ['XXX.XX', 'OOOO..', 'O.....'];
  const okul = B.oyna(B.konumKur({}, ayristir(satirlar), B.X), 0, 3);
  assert.equal(okul.kazanan, B.X);
  assert.equal(okul.besli.length, 6);
  const tam = B.oyna(B.konumKur({ tamBes: true }, ayristir(satirlar), B.X), 0, 3);
  assert.equal(tam.bitti, false);
  assert.equal(tam.besli, null);
});

test('tam beş: yedili de kazanmaz, aynı hamlenin başka yöndeki beşi kazanır', () => {
  const yedi = B.oyna(B.konumKur({ tamBes: true }, ayristir(['XXX.XXX', 'OOOO...', 'OO.....']), B.X), 0, 3);
  assert.equal(yedi.bitti, false);
  // (4,3): yatayda altı (sayılmaz), dikeyde beş (sayılır)
  const d = B.konumKur({ tamBes: true }, ayristir([
    '...X...',
    '...X...',
    '...X...',
    '...X...',
    'XXX.XX.',
    'OOOOOO.',
    'OOO....',
  ].map((s, i) => i === 5 ? 'O.O.O.O' : s)), B.X);
  const y = B.oyna(d, 4, 3);
  assert.equal(y.kazanan, B.X);
  assert.deepEqual(y.besli, [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]]);
});

test('tam beş: tam beşlik dizi kazanır', () => {
  const y = B.oyna(B.konumKur({ tamBes: true }, ayristir(['XX.XX', 'OOO..', 'O....']), B.X), 0, 2);
  assert.equal(y.kazanan, B.X);
});

/* ---------- berabere ---------- */

// Hiçbir yönde üçten uzun dizi olmayan dolu tahta deseni: (c + 2r) mod 4 < 2 → bir taraf
function doluDesen(n) {
  const a = [], b = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) (((c + 2 * r) % 4) < 2 ? a : b).push([r, c]);
  const [xs, os] = a.length >= b.length ? [a, b] : [b, a];
  const liste = [];
  for (let i = 0; i < xs.length; i++) { liste.push(xs[i]); if (os[i]) liste.push(os[i]); }
  return liste;
}

test('berabere: 15×15 dolunca, son hamleye kadar bitmez', () => {
  const liste = doluDesen(15);
  assert.equal(liste.length, 225);
  let d = B.yeniOyun({});
  for (let i = 0; i < liste.length; i++) {
    assert.equal(d.bitti, false, `hamle ${i}'den önce bitmemeli`);
    d = B.oyna(d, liste[i][0], liste[i][1]);
  }
  assert.equal(d.bitti, true);
  assert.equal(d.kazanan, 'berabere');
  assert.throws(() => B.oyna(d, 0, 0), /oyun bitti/);
});

test('berabere: son hamlede beş yapılırsa kazanç sayılır', () => {
  // 5×5 tahta; son boş kare X'e beş verir
  const d = B.konumKur({ boyut: 5 }, ayristir([
    'XXXX.',
    'OOXOO',
    'XXOXX',
    'OOXOO',
    'XOOXO',
  ]), B.X);
  const y = B.oyna(d, 0, 4);
  assert.equal(y.kazanan, B.X);
});

test('sınırsız: hamle sınırında berabere', () => {
  let d = B.yeniOyun({ boyut: 0, hamleSiniri: 10 });
  const hamleler = [[0, 0], [0, 1], [5, 5], [5, 6], [-9, 3], [-9, 4], [20, -20], [20, -21], [1, 7], [2, 9]];
  hamleler.forEach(([r, c], i) => { assert.equal(d.bitti, false, `hamle ${i}`); d = B.oyna(d, r, c); });
  assert.equal(d.kazanan, 'berabere');
  assert.equal(B.yeniOyun({ sinirsiz: true }).ayar.hamleSiniri, 300);
});

/* ---------- sınırsız sayfa ---------- */

test('sınırsız: sınır kutusu negatif koordinatlara büyür, kenar yok', () => {
  let d = B.yeniOyun({ boyut: 0 });
  assert.equal(d.sinir, null);
  d = B.oyna(d, 7, 7);
  assert.deepEqual(d.sinir, { r1: 7, c1: 7, r2: 7, c2: 7 });
  d = B.oyna(d, -3, 20);
  assert.deepEqual(d.sinir, { r1: -3, c1: 7, r2: 7, c2: 20 });
  d = B.oyna(d, 30, -15);
  assert.deepEqual(d.sinir, { r1: -3, c1: -15, r2: 30, c2: 20 });
  assert.equal(B.gecerliMi(d, 2047, -2047), true);
  assert.equal(B.gecerliMi(d, 2048, 0), false);
  assert.equal(B.gecerliMi(B.yeniOyun({}), 15, 0), false, 'sabit tahtada 15 dışarıda');
  assert.equal(B.gecerliMi(B.yeniOyun({}), -1, 3), false);
});

test('sınırsız: negatif koordinatta beş', () => {
  const d = B.konumKur({ boyut: 0 }, [
    ...[-2, -3, -4, -5].map(c => ({ r: -10, c, sembol: B.X })),
    ...[0, 1, 2, 3].map(c => ({ r: 0, c, sembol: B.O })),
  ], B.X);
  const y = B.oyna(d, -10, -6);
  assert.equal(y.kazanan, B.X);
  assert.deepEqual(y.besli[0], [-10, -6]);
});

test('sınırsız: anahtar ↔ koordinat gidiş-dönüş', () => {
  for (const [r, c] of [[0, 0], [-1, -1], [2047, -2047], [-2047, 2047], [13, -400]]) {
    assert.deepEqual(B.koordinat(B.anahtar(r, c)), [r, c]);
  }
});

/* ---------- geri alma ---------- */

test('geri alma: geriAl(oyna(d)) ≡ d (taşlar, sıra, sınır, hash)', () => {
  const r = B.rng(7);
  for (const ayar of [{}, { boyut: 0 }]) {
    let d = B.yeniOyun(ayar);
    const yigin = [d];
    for (let i = 0; i < 60 && !d.bitti; i++) {
      let rr, cc;
      do { rr = Math.floor(r() * 15); cc = Math.floor(r() * 15); } while (!B.gecerliMi(d, rr, cc));
      d = B.oyna(d, rr, cc);
      yigin.push(d);
    }
    // zinciri baştan sona geri al; her adım kaydedilen durumla aynı
    for (let i = yigin.length - 1; i > 0; i--) {
      d = B.geriAl(d);
      ayniDurum(d, yigin[i - 1], `adım ${i}`);
    }
    assert.deepEqual(d.hash, { hi: 0, lo: 0 });
    assert.equal(d.sinir, null);
    assert.throws(() => B.geriAl(d), /Geri alınacak hamle yok/);
  }
});

test('geri alma: biten oyun yeniden açılır, aynı kareye yeniden oynanabilir', () => {
  const once = B.konumKur({}, ayristir(['XXXX.', 'OOOO.']), B.X);
  const bitti = B.oyna(once, 0, 4);
  assert.equal(bitti.bitti, true);
  const geri = B.geriAl(bitti);
  ayniDurum(geri, once);
  assert.equal(geri.besli, null);
  assert.equal(B.oyna(geri, 0, 4).kazanan, B.X);
});

test('Zobrist: aynı konum farklı sırayla aynı hash; farklı konum farklı hash', () => {
  const a = B.oynat({}, [[0, 0], [1, 1], [2, 2], [3, 3]]);
  const b = B.oynat({}, [[2, 2], [3, 3], [0, 0], [1, 1]]);
  const c = B.oynat({}, [[1, 1], [0, 0], [3, 3], [2, 2]]);     // aynı kareler, renkler ters
  assert.deepEqual(a.hash, b.hash);
  assert.notDeepEqual(a.hash, c.hash);
  assert.deepEqual(B.konumKur({}, ayristir(['X.', '.O', '..X', '...O'])).hash, a.hash);
  // çakışma taraması: 225 kare × 2 renk için 450 farklı değer
  const gorulen = new Set();
  for (let r = 0; r < 15; r++) for (let cc = 0; cc < 15; cc++) for (const s of [1, 2]) {
    const z = B.zobrist(r, cc, s);
    gorulen.add(z.hi + ':' + z.lo);
  }
  assert.equal(gorulen.size, 450);
});

/* ---------- geçersiz hamle, değişmezlik ---------- */

test('geçersiz hamleler hata fırlatır', () => {
  const d = B.oyna(B.yeniOyun({}), 7, 7);
  assert.throws(() => B.oyna(d, 7, 7), /kare dolu/);
  assert.throws(() => B.oyna(d, 15, 3), /tahtanın dışında/);
  assert.throws(() => B.oyna(d, 1.5, 3), /tam sayı/);
  assert.equal(B.hamleHatasi(d, 0, 0), null);
});

test('oyna ve geriAl girdiyi değiştirmez', () => {
  const d = B.oynat({}, [[7, 7], [7, 8], [8, 8]]);
  const kopya = { taslar: [...d.taslar], hamleler: JSON.stringify(d.hamleler), sira: d.sira, hash: { ...d.hash }, sinir: { ...d.sinir } };
  B.oyna(d, 9, 9);
  B.geriAl(d);
  assert.deepEqual([...d.taslar], kopya.taslar);
  assert.equal(JSON.stringify(d.hamleler), kopya.hamleler);
  assert.equal(d.sira, kopya.sira);
  assert.deepEqual(d.hash, kopya.hash);
  assert.deepEqual(d.sinir, kopya.sinir);
});

test('sıra: X başlar, sırayla değişir', () => {
  let d = B.yeniOyun({});
  assert.equal(d.sira, B.X);
  d = B.oyna(d, 0, 0);
  assert.equal(d.sira, B.O);
  assert.equal(B.tas(d, 0, 0), B.X);
  d = B.oyna(d, 0, 1);
  assert.equal(B.tas(d, 0, 1), B.O);
  assert.equal(d.sira, B.X);
});

test('hücre adı', () => {
  assert.equal(B.hucreAdi(7, 7), 'H8');
  assert.equal(B.hucreAdi(0, 0), 'A1');
  assert.equal(B.hucreAdi(14, 14), 'O15');
  assert.equal(B.hucreAdi(-2, 3), '(-2, 3)');
});

test('19×19 config', () => {
  const d = B.yeniOyun({ boyut: 19 });
  assert.equal(B.gecerliMi(d, 18, 18), true);
  assert.equal(B.gecerliMi(d, 19, 0), false);
});

test('sınırsız: görünen alan taşlar kenara yaklaşınca büyür, küçülmez; sabitte tahtanın tamamı', () => {
  assert.deepEqual(B.gorunurAlan(B.yeniOyun({})), { r0: 0, c0: 0, satir: 15, sutun: 15 });
  let d = B.yeniOyun({ boyut: 0 });
  let a = B.gorunurAlan(d);
  assert.deepEqual(a, { r0: -7, c0: -7, satir: 15, sutun: 15 });
  d = B.oyna(d, 0, 0);
  a = B.gorunurAlan(d, a);
  assert.deepEqual(a, { r0: -7, c0: -7, satir: 15, sutun: 15 }, 'ortadaki taş alanı değiştirmez');
  d = B.oyna(d, 5, 6);                          // sağ alt kenara 2 kare
  a = B.gorunurAlan(d, a);
  assert.deepEqual([a.r0, a.c0, a.r0 + a.satir - 1, a.c0 + a.sutun - 1], [-7, -7, 10, 10], "kutu ± 3, en az 15 (iki yana)");
  d = B.oyna(d, -9, -2);                        // yukarı taşar: negatif koordinat
  a = B.gorunurAlan(d, a);
  assert.equal(a.r0, -12);
  d = B.geriAl(d);
  assert.equal(B.gorunurAlan(d, a).r0, -12, 'geri almada alan küçülmez');
});
