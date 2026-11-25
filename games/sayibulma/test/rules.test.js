// node --test — rules.js: cevap hesabı, küme boyutları, ayarların üretime yansıması, günün sayısı
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules.js');

// Elle hesaplanmış örnekler: [gizli, tahmin, artı, eksi, not]
const ORNEKLER = [
  ['4703', '1234', 0, 2, '3 ve 4 var, ikisi de yanlış yerde'],
  ['4703', '5678', 0, 1, 'yalnız 7, yanlış yerde'],
  ['4703', '4930', 1, 2, '4 yerinde; 3 ve 0 yanlış yerde'],
  ['4703', '9340', 0, 3, 'üç ortak, hiçbiri yerinde'],
  ['4703', '4703', 4, 0, 'buldu'],
  ['1234', '4321', 0, 4, 'tam tersten'],
  ['1234', '5678', 0, 0, 'hiç ortak rakam yok'],
  ['1234', '1243', 2, 2, 'son ikisi yer değiştirmiş'],
  ['1023', '3201', 0, 4, 'sıfırlı, hepsi yanlış yerde'],
  ['1023', '1032', 2, 2, 'sıfır yerinde'],
  ['9012', '2109', 0, 4, 'sıfırlı tam karışık'],
  ['5091', '5019', 2, 2, 'sıfır ikinci hanede yerinde'],
  ['7650', '1230', 1, 0, 'yalnız sonda sıfır, yerinde'],
  ['2048', '2840', 2, 2, '2 ve 4 yerinde'],
  ['102', '210', 0, 3, '3 hane, sıfırlı'],
  ['102', '120', 1, 2, '3 hane'],
  ['13579', '97531', 1, 4, '5 hane tam tersten: ortadaki 5 yerinde'],
  // Tekrarlı rakam: çift sayma tuzakları (çoklu küme sayımı)
  ['1123', '1111', 2, 0, 'tahmindeki fazla 1\'ler eksi sayılmaz'],
  ['1231', '1122', 1, 2, 'iki 1 ve bir 2 ortak; biri yerinde'],
  ['1111', '1234', 1, 0, 'gizlideki fazla 1\'ler eksi sayılmaz'],
  ['1122', '2211', 0, 4, 'tekrarlı tam karışık'],
  ['1223', '2222', 2, 0, 'saf sayım 2 eksi daha verirdi'],
  ['0000', '0100', 3, 0, 'tekrarlı ve sıfırla başlayan'],
];

test('cevap: elle hesaplanmış örnekler (simetrik)', () => {
  for (const [g, t, a, e, not] of ORNEKLER) {
    assert.deepEqual(R.cevap(g, t), { arti: a, eksi: e }, `${g} / ${t}: ${not}`);
    assert.deepEqual(R.cevap(t, g), { arti: a, eksi: e }, `${t} / ${g} (ters): ${not}`);
  }
});

test('hızlı skor, dize cevabıyla aynı (her ayarda örneklem)', () => {
  for (const a of [{}, { sifirBaslar: true }, { hane: 3 }, { hane: 5 }, { tekrar: true }, { hane: 5, tekrar: true, sifirBaslar: true }]) {
    const k = R.kume(a), adim = Math.max(1, Math.floor(k.boyut / 300));
    for (let i = 0; i < k.boyut; i += adim) for (let j = 3; j < k.boyut; j += adim * 7) {
      const c = R.cevap(k.dize(i), k.dize(j));
      assert.equal(k.skor(i, j), R.kod(c.arti, c.eksi, k.hane), `${JSON.stringify(a)} ${k.dize(i)} / ${k.dize(j)}`);
    }
  }
});

test('küme boyutları', () => {
  assert.equal(R.kume({ hane: 4 }).boyut, 4536, '4 hane, farklı rakam, ilk hane sıfırsız');
  assert.equal(R.kume({ hane: 4, sifirBaslar: true }).boyut, 5040, '4 hane, sıfırla başlayabilir');
  assert.equal(R.kume({ hane: 3 }).boyut, 648, '3 hane');
  assert.equal(R.kume({ hane: 5 }).boyut, 27216, '5 hane');
  assert.equal(R.kume({ hane: 4, tekrar: true }).boyut, 9000, '4 hane tekrarlı');
  assert.equal(R.kume({ hane: 4, tekrar: true, sifirBaslar: true }).boyut, 10000, '4 hane tekrarlı sıfırlı');
});

test('küme: indeks ve dize birbirinin tersi; her eleman geçerli', () => {
  for (const a of [{}, { sifirBaslar: true }, { hane: 3 }, { tekrar: true }]) {
    const k = R.kume(a);
    for (let i = 0; i < k.boyut; i++) {
      assert.equal(k.indeks(k.dize(i)), i);
      if (i % 37 === 0) assert.ok(R.gecerli(k.dize(i), a), k.dize(i));
    }
  }
  assert.equal(R.kume({}).indeks('0123'), -1, 'sıfırla başlayan kümede yok');
  assert.equal(R.kume({}).indeks('1123'), -1, 'tekrarlı kümede yok');
});

test('geçerlilik: kuralsız giriş', () => {
  assert.ok(R.gecerli('1234', {}));
  assert.ok(!R.gecerli('0123', {}), 'ilk hane 0');
  assert.ok(R.gecerli('0123', { sifirBaslar: true }));
  assert.ok(!R.gecerli('1123', {}), 'tekrar');
  assert.ok(R.gecerli('1123', { tekrar: true }));
  assert.ok(!R.gecerli('123', {}), 'eksik hane');
  assert.ok(!R.gecerli('12a4', {}), 'rakam olmayan');
  assert.ok(R.gecerli('12345', { hane: 5 }));
});

test('rastgele sayı: sıfır ve tekrar ayarları üretime yansır', () => {
  const r = R.rng(42);
  let sifirli = 0, tekrarli = 0;
  for (let i = 0; i < 2000; i++) {
    const a = R.rastgeleSayi({}, r);
    assert.ok(R.gecerli(a, {}), a);
    assert.notEqual(a[0], '0');
    assert.equal(new Set(a).size, 4);
    const b = R.rastgeleSayi({ sifirBaslar: true }, r);
    if (b[0] === '0') sifirli++;
    const c = R.rastgeleSayi({ tekrar: true }, r);
    if (new Set(c).size < 4) tekrarli++;
    assert.equal(R.rastgeleSayi({ hane: 5 }, r).length, 5);
  }
  assert.ok(sifirli > 100, `sıfırla başlayan üretildi (${sifirli}/2000, beklenen ~200)`);
  assert.ok(tekrarli > 700, `tekrarlı rakam üretildi (${tekrarli}/2000, beklenen ~990)`);
});

test('mümkün cevaplar', () => {
  assert.ok(R.cevapMumkun(0, 0, {}));
  assert.ok(R.cevapMumkun(4, 0, {}));
  assert.ok(R.cevapMumkun(2, 2, {}));
  assert.ok(!R.cevapMumkun(3, 1, {}), '3 artı 1 eksi olamaz');
  assert.ok(!R.cevapMumkun(3, 1, { tekrar: true }), 'tekrarlıda da olamaz');
  assert.ok(!R.cevapMumkun(2, 3, {}), 'toplam haneyi aşar');
  assert.ok(R.cevapMumkun(4, 1, { hane: 5 }) === false && R.cevapMumkun(3, 2, { hane: 5 }));
  // Kümedeki bütün çiftler için gerçekleşen cevaplar mümkün sayılır, (3,1) hiç gerçekleşmez
  const k = R.kume({}), gorulen = new Set();
  for (let i = 0; i < k.boyut; i += 3) for (let j = 0; j < k.boyut; j += 61) gorulen.add(k.skor(i, j));
  for (const kod of gorulen) { const c = R.kodCoz(kod, 4); assert.ok(R.cevapMumkun(c.arti, c.eksi, {}), JSON.stringify(c)); }
  assert.ok(!gorulen.has(R.kod(3, 1, 4)));
});

test('kod: artı·(hane+1)+eksi', () => {
  assert.equal(R.kod(4, 0, 4), 20);
  assert.equal(R.kume({}).kazanKodu, 20);
  assert.deepEqual(R.kodCoz(R.kod(1, 2, 4), 4), { arti: 1, eksi: 2 });
  assert.ok(R.kazandi({ arti: 4, eksi: 0 }, 4));
});

test('günün sayısı: aynı tarihte aynı, geçerli; tarihler arasında değişir', () => {
  const a = R.gununSayisi('2026-10-20');
  assert.equal(R.gununSayisi('2026-10-20'), a);
  assert.ok(R.gecerli(a, {}), a);
  const farkli = new Set();
  for (let g = 1; g <= 30; g++) farkli.add(R.gununSayisi(`2026-11-${String(g).padStart(2, '0')}`));
  assert.ok(farkli.size >= 27, `30 günde ${farkli.size} farklı sayı`);
});

test('tarih ve paylaşım metni', () => {
  assert.equal(R.yerelTarih(new Date(2026, 9, 20, 23, 59)), '2026-10-20');
  assert.equal(R.tarihYazi('2026-10-20'), '20 Ekim');
  assert.equal(R.paylasimMetni('2026-10-20', 5), 'Sayı Bulma · 20 Ekim · 5 tahmin');
  assert.equal(R.paylasimMetni('2026-10-20', 5, 'zor'), 'Sayı Bulma · 20 Ekim · 5 tahmin');
  assert.equal(R.paylasimMetni('2026-02-03', 7, 'kolay'), 'Sayı Bulma · 3 Şubat · 7 tahmin · kolay');
});
