// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hileci.js');
const G = require('../game.js');
const S = require('../secici.js');
const tr = require('../tr.js');

const KUME = ['KALEM', 'KALIP', 'KAVUN', 'SALON', 'TAVAN'];

/* ---------- elle hesaplanmış küçük küme ---------- */

test('elle hesaplanmış küme: A → "1" (4 aday), L → "2" (3), E → yok (2), O → eşitlikte yok (1)', () => {
  const h = H.kur(KUME, 5);
  assert.equal(h.sayi, 5);

  // A: KALEM, KALIP, KAVUN, SALON → "1" (4) · TAVAN → "1,3" (1)
  assert.deepEqual([...H.bol(KUME, 'A')].map(([d, l]) => [d, l.length]), [['1', 4], ['1,3', 1]]);
  let r = h.tahmin('A');
  assert.deepEqual(r, { konumlar: [1], kalan: 4 });

  // L: KALEM, KALIP, SALON → "2" (3) · KAVUN → "" (1)
  r = h.tahmin('L');
  assert.deepEqual(r, { konumlar: [2], kalan: 3 });
  assert.deepEqual(h.adaylar, ['KALEM', 'KALIP', 'SALON']);

  // E: KALEM → "3" (1) · KALIP, SALON → "" (2)  → yok
  r = h.tahmin('E');
  assert.deepEqual(r, { konumlar: [], kalan: 2 });
  assert.deepEqual(h.adaylar, ['KALIP', 'SALON']);

  // O: SALON → "3" (1) · KALIP → "" (1)  → eşitlikte "harf yok"
  r = h.tahmin('O');
  assert.deepEqual(r, { konumlar: [], kalan: 1 });
  assert.deepEqual(h.itiraf(), { sayi: 1, ilk10: ['KALIP'], kelime: 'KALIP' });
});

test('sec: en kalabalık; eşitlikte boş desen; yine eşitse desen sırası', () => {
  const g = (...c) => new Map(c);
  assert.equal(H.sec(g(['1', ['a', 'b']], ['2', ['c']])), '1');
  assert.equal(H.sec(g(['1', ['a']], ['', ['b']])), '');
  assert.equal(H.sec(g(['', ['b']], ['1', ['a']])), '');
  assert.equal(H.sec(g(['2', ['a']], ['1', ['b']])), '1');
  assert.equal(H.sec(g(['3', ['a']], ['1,3', ['b']], ['2', ['c']])), '1,3');       // metin sırası: "1,3" < "2" < "3"
  assert.equal(H.sec(new Map()), null);
});

test('bol: desen, sıra ve I/İ ayrımı', () => {
  assert.equal(H.desen('ANANAS', 'A'), '0,2,4');
  assert.equal(H.desen('ANANAS', 'Z'), '');
  assert.equal(H.desen('ILIK', 'I'), '0,2');
  assert.equal(H.desen('ILIK', 'İ'), '');
  const g = H.bol(['ILIK', 'İLİK', 'ILIM'], 'I');
  assert.deepEqual([...g.keys()].sort(), ['', '0,2']);                         // İLİK'te I yok; ILIK ve ILIM'de 0 ve 2
});

test('uzunluğu tutmayanlar atılır, tekrarlar teke iner, şapka normalize edilir', () => {
  const h = H.kur(['kedi', 'KEDİ', 'kuş', 'kâğıt', 'kağıt', 'köpek'], 5);
  assert.deepEqual(h.adaylar, ['KAĞIT', 'KÖPEK']);
  assert.throws(() => H.kur(KUME, 9), RangeError);
});

test('geçersiz ve tekrar eden harf hata verir', () => {
  const h = H.kur(KUME, 5);
  h.tahmin('A');
  assert.throws(() => h.tahmin('A'), /zaten/);
  assert.throws(() => h.tahmin('q'), RangeError);
  assert.throws(() => h.tahmin('1'), RangeError);
});

/* ---------- ipucu ---------- */

test('harfAc: harfi içeren en kalabalık (harf, desen); adaylar o gruba iner', () => {
  const h = H.kur(KUME, 5);
  // A: "1" → 4 aday (en kalabalık); K: "0" → 3 (KALEM, KALIP, KAVUN) ... en büyük A
  const r = h.harfAc();
  assert.deepEqual(r, { harf: 'A', konumlar: [1] });
  assert.deepEqual(h.adaylar, ['KALEM', 'KALIP', 'KAVUN', 'SALON']);
  assert.throws(() => h.tahmin('A'), /zaten/);                                      // açılan harf denenmiş sayılır
  const r2 = h.harfAc();                                                              // K "0" (3 aday) ile L "2" (3 aday) berabere: alfabe sırasıyla K
  assert.deepEqual(r2, { harf: 'K', konumlar: [0] });
  assert.deepEqual(h.adaylar, ['KALEM', 'KALIP', 'KAVUN']);
});

test('harfAc: hiç harf kalmazsa hata', () => {
  const h = H.kur(['AB' + 'C'], 3);
  h.harfAc(); h.harfAc(); h.harfAc();
  assert.throws(() => h.harfAc(), /kalmadı/);
});

/* ---------- uzunluk seçimi ---------- */

test('uzunlukSec: yeterince adayı olan uzunlukları tercih eder', () => {
  const kelimeler = [...Array.from({ length: 30 }, (_, i) => 'AB' + String.fromCharCode(65 + (i % 26)) + (i < 26 ? '' : 'Z') + 'K'.repeat(2)), 'KEDI'.replace('I', 'İ'), 'ELMA'];
  const hepsi = new Set();
  for (let t = 1; t <= 200; t++) hepsi.add(H.uzunlukSec(kelimeler, S.rng(t)));
  assert.ok(![...hepsi].some((n) => n === 4), 'az adaylı uzunluk seçilmemeli');
  assert.ok(hepsi.size >= 1);
  // hiçbir uzunlukta yeterli aday yoksa hepsi aday
  const az = ['KEDİ', 'ELMA', 'KUŞ'];
  const secilen = new Set(Array.from({ length: 100 }, (_, t) => H.uzunlukSec(az, S.rng(t + 1))));
  assert.deepEqual([...secilen].sort(), [3, 4]);
});

/* ---------- tutarlılık özelliği ---------- */

test('Hoca her zaman tutarlı: 500 rastgele oyun, gerçek veri', () => {
  const veri = { sozluk: require('../data/sozluk.js'), kategoriler: require('../data/kategoriler.js'), atasozleri: require('../data/atasozleri.js') };
  const r = S.rng(77);
  const kategoriler = ['Genel', 'Hayvanlar', 'Meslekler', 'Doğa', 'Mutfak', 'Spor', 'Vücut', 'Okul', 'Meyve-Sebze'];
  let hileli = 0;
  for (let o = 0; o < 500; o++) {
    const kat = kategoriler[o % kategoriler.length];
    const havuz = S.hileciHavuzu(veri, kat).map((a) => a.kelime);
    const uzunluk = H.uzunlukSec(havuz, r);
    const hoca = H.kur(havuz, uzunluk);
    let d = G.yeniOyun({ uzunluk, zorluk: 'zor', mod: 'hileci', kategori: kat });
    const yanlislar = [];
    while (!d.bitti) {
      const kalanHarfler = tr.ALFABE.filter((h) => !d.denenen.includes(h));
      let x;
      if (G.ipucuAcikMi(d) && r() < 0.15 && d.maske.some((c) => c === null)) {
        const secim = hoca.harfAc();
        d = G.harfAc(d, Math.random, secim);
        x = d.son.harf;
      } else {
        x = kalanHarfler[Math.floor(r() * kalanHarfler.length)];
        const cevap = hoca.tahmin(x);
        d = G.tahmin(d, x, cevap.konumlar);
        if (!cevap.konumlar.length) yanlislar.push(x);
      }
      // DEĞİŞMEZ: kalan her aday açıklanan maskeye uyar ve yanlış harflerin hiçbirini içermez
      const adaylar = hoca.adaylar;
      assert.ok(adaylar.length >= 1);
      for (const a of adaylar) {
        const ah = Array.from(a);
        assert.equal(ah.length, uzunluk);
        d.maske.forEach((c, i) => { if (c !== null) assert.equal(ah[i], c, `maske uymuyor: ${a} ${d.maske.join('')}`); });
        for (const y of d.yanlis) assert.ok(!ah.includes(y), `yanlış harf adayda: ${a} ${y}`);
        // açılmamış konumlarda denenmiş doğru harf bulunamaz (aksi halde o harfin konumu açılmış olurdu)
        ah.forEach((c, i) => { if (d.maske[i] === null) assert.ok(!d.denenen.includes(c), `denenen harf açılmamış konumda: ${a} ${c}`); });
      }
    }
    // oyun bitti: itiraf ve hedef tutarlı
    const it = hoca.itiraf();
    assert.equal(it.sayi, hoca.sayi);
    assert.ok(it.ilk10.length === Math.min(10, it.sayi));
    assert.equal(it.kelime, it.ilk10[0]);
    d = G.hedefYaz(d, it.kelime);                                                    // maskeye uymazsa hata verir
    assert.equal(d.hedef, it.kelime);
    if (d.sonuc === 'kurtuldu') assert.equal(it.sayi, 1, 'kurtuldu ama elde birden çok aday var');
    if (it.sayi > 1) hileli++;
  }
  assert.ok(hileli > 50, 'Hoca çoğu oyunda gerçekten birden çok aday tutmalı: ' + hileli);
});

test('Hileci havuzu: Genel yalnız kolay/orta, kategori hepsi, atasözü yok, kolaydan zora sıralı', () => {
  const veri = { sozluk: require('../data/sozluk.js'), kategoriler: require('../data/kategoriler.js'), atasozleri: require('../data/atasozleri.js') };
  const genel = S.hileciHavuzu(veri, 'Genel');
  assert.ok(genel.length > 3000 && genel.length < 9000, 'Genel havuz: ' + genel.length);
  assert.ok(genel.every((a) => a.bant === 'k' || a.bant === 'o'));
  assert.equal(new Set(genel.map((a) => a.kelime)).size, genel.length);
  for (let i = 1; i < genel.length; i++) assert.ok(genel[i - 1].puan <= genel[i].puan);
  const hayvan = S.hileciHavuzu(veri, 'Hayvanlar');
  assert.equal(hayvan.length, veri.kategoriler.Hayvanlar.length);                    // tüm bantlar
  assert.throws(() => S.hileciHavuzu(veri, 'Atasözleri'), RangeError);
});

test('hileci.js DOM\'a ve window\'a dokunmaz', () => {
  const fs = require('node:fs'), path = require('node:path');
  const k = fs.readFileSync(path.join(__dirname, '..', 'hileci.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/document\.|localStorage|Kit\.|navigator\./.test(k));
});
