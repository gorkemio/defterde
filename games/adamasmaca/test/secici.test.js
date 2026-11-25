// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../secici.js');
const C = require('../config.js');
const tr = require('../tr.js');

const veri = {
  sozluk: require('../data/sozluk.js'),
  kategoriler: require('../data/kategoriler.js'),
  atasozleri: require('../data/atasozleri.js'),
  gunluk: require('../data/gunluk.js'),
};

/* ---------- günün kelimesi ---------- */

test('günün kelimesi: aynı tarih her çağrıda aynı kelime', () => {
  const a = S.gununKelimesi(veri.gunluk, '2026-11-03'), b = S.gununKelimesi(veri.gunluk, '2026-11-03'), c = S.gununKelimesi(veri.gunluk, '2026-11-03');
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.ok(veri.gunluk.includes(a.kelime));
});

test('günün kelimesi: farklı günler farklı kelime (30 günde en az 27 farklı)', () => {
  const gunler = Array.from({ length: 30 }, (_, i) => S.yerelTarih(new Date(2026, 9, 20 + i)));
  const kelimeler = new Set(gunler.map((g) => S.gununKelimesi(veri.gunluk, g).kelime));
  assert.ok(kelimeler.size >= 27, 'farklı kelime: ' + kelimeler.size);
});

test('günün kelimesi: havuz değişmedikçe sabit (bilinen örnek)', () => {
  // Havuz dondurulmuştur; bu değerler değişirse günün kelimesi herkes için kaymış demektir.
  const g = S.gununKelimesi(['A', 'B', 'C', 'D', 'E'], '2026-10-20');
  assert.equal(g.kelime, ['A', 'B', 'C', 'D', 'E'][S.karma('gun|2026-10-20') % 5]);
  assert.equal(S.karma('gun|2026-10-20'), S.karma('gun|2026-10-20'));
  assert.notEqual(S.karma('gun|2026-10-20'), S.karma('gun|2026-10-21'));
});

test('günün kelimesi numarası: başlangıç günü #1, ardışık günler 1 artar', () => {
  const B = '2026-10-20';                                                      // aritmetik ayardan bağımsız sınanır
  assert.equal(S.gununKelimesi(veri.gunluk, '2026-10-20', B).no, 1);
  assert.equal(S.gununKelimesi(veri.gunluk, '2026-10-21', B).no, 2);
  assert.equal(S.gununKelimesi(veri.gunluk, '2026-10-31', B).no, 12);
  assert.equal(S.gununKelimesi(veri.gunluk, '2026-11-01', B).no, 13);              // ay sınırı
  assert.equal(S.gununKelimesi(veri.gunluk, '2027-01-01', B).no, 74);              // yıl sınırı: 11 + 30 + 31 + 1 + 1
  assert.equal(S.gununKelimesi(veri.gunluk, '2027-03-01', B).no, 133);
  assert.equal(S.gununKelimesi(veri.gunluk, '2028-03-01', B).no, 133 + 366);       // 1 Mart 2027 → 1 Mart 2028: 2028 artık yıl, 29 Şubat dahil
  assert.equal(S.gunFarki('2026-10-20', '2026-10-20'), 0);
  assert.ok(C.gunlukBaslangic <= S.yerelTarih(), 'başlangıç bugünden sonra olamaz: numara negatif çıkar');
  assert.equal(S.gununKelimesi(veri.gunluk, C.gunlukBaslangic).no, 1);
});

test('yerelTarih: yerel saate göre yyyy-mm-dd', () => {
  assert.equal(S.yerelTarih(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(S.yerelTarih(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
  assert.match(S.yerelTarih(), /^\d{4}-\d{2}-\d{2}$/);
});

test('günün adayı: tanım ve kategori gelir, havuzdaki her kelime sözlükte', () => {
  const g = S.gununAdayi(veri, C.gunlukBaslangic);
  assert.equal(g.no, 1);
  assert.ok(g.anlam.length > 3);
  assert.ok(C.kategoriler.includes(g.kategori));
  const sozluk = new Set(veri.sozluk.map((r) => r[0]));
  for (const k of veri.gunluk) assert.ok(sozluk.has(k), k);
});

test('kategorisi: kelimenin kategorisi, yoksa Genel', () => {
  assert.equal(S.kategorisi(veri, 'KEDİ'), 'Hayvanlar');
  assert.equal(S.kategorisi(veri, 'ANKARA'), 'Şehirler');
  assert.equal(S.kategorisi(veri, 'ADALET'), 'Genel');
});

/* ---------- adaylar ve bantlar ---------- */

test('adaylar: kolay band yalnız kolay kelimeler; Genel hem sözlük hem kategori kelimelerini içerir', () => {
  const kolay = S.adaylar(veri, { kategori: 'Genel', zorluk: 'kolay' });
  assert.ok(kolay.length >= 400);
  assert.ok(kolay.every((a) => a.bant === 'k' && a.kategori === 'Genel'));
  const k = new Set(kolay.map((a) => a.kelime));
  assert.ok(k.has('KALEM') && k.has('KEDİ'));
  assert.equal(new Set(kolay.map((a) => a.kelime)).size, kolay.length);          // tekrar yok
  const hepsi = S.adaylar(veri, { kategori: 'Genel', zorluk: 'hepsi' });
  assert.ok(hepsi.length > veri.sozluk.length);                                  // kategori kelimeleri de eklendi
  assert.ok(hepsi.some((a) => a.kelime === 'ANKARA'));
});

test('adaylar: kategori ve bant süzgeci', () => {
  const orta = S.adaylar(veri, { kategori: 'Hayvanlar', zorluk: 'orta' });
  assert.ok(orta.length >= C.aday.enAz && orta.every((a) => a.bant === 'o' && a.kategori === 'Hayvanlar'));
  for (const ad of C.kategoriler.filter((k) => k !== 'Genel' && k !== 'Atasözleri')) {
    for (const z of ['kolay', 'orta', 'zor']) assert.ok(S.adaylar(veri, { kategori: ad, zorluk: z }).length >= C.aday.enAz, `${ad}/${z}`);
  }
  assert.throws(() => S.adaylar(veri, { kategori: 'Yok', zorluk: 'orta' }), RangeError);
  assert.throws(() => S.adaylar(veri, { kategori: 'Spor', zorluk: 'çok' }), RangeError);
});

test('adaylar: bantta 15\'ten az aday varsa komşu bant eklenir', () => {
  const kucuk = { sozluk: [], atasozleri: [], kategoriler: { Deneme: [
    ['AAA', 'a', 'k', 1], ['BBB', 'b', 'k', 1], ['CCC', 'c', 'o', 1], ['DDD', 'd', 'o', 1], ['EEE', 'e', 'z', 1],
  ] } };
  assert.deepEqual(S.adaylar(kucuk, { kategori: 'Deneme', zorluk: 'kolay' }).map((a) => a.kelime), ['AAA', 'BBB', 'CCC', 'DDD']);   // kolay + orta
  assert.deepEqual(S.adaylar(kucuk, { kategori: 'Deneme', zorluk: 'zor' }).map((a) => a.kelime), ['CCC', 'DDD', 'EEE']);             // zor + orta
  assert.equal(S.adaylar(kucuk, { kategori: 'Deneme', zorluk: 'orta' }).length, 5);                                                  // orta + kolay + zor
  assert.equal(S.adaylar(kucuk, { kategori: 'Deneme', zorluk: 'hepsi' }).length, 5);
});

test('adaylar: Atasözleri zorluktan bağımsız tümü', () => {
  const a = S.adaylar(veri, { kategori: 'Atasözleri', zorluk: 'kolay' }), b = S.adaylar(veri, { kategori: 'Atasözleri', zorluk: 'zor' });
  assert.equal(a.length, veri.atasozleri.length);
  assert.equal(b.length, a.length);
  assert.ok(a.every((x) => x.kelime.includes(' ') && tr.gecerliSoz(x.kelime)));
});

/* ---------- seçim ve tekrar ---------- */

test('sec: son 200 kelimede olanlar seçilmez', () => {
  const adaylar = S.adaylar(veri, { kategori: 'Genel', zorluk: 'kolay' });
  const r = S.rng(11);
  let gecmis = [];
  const secilen = [];
  for (let i = 0; i < 300; i++) {
    const a = S.sec(adaylar, gecmis, r);
    if (i < adaylar.length) assert.ok(!secilen.slice(-C.gecmisUzunlugu).includes(a.kelime), `tekrar: ${a.kelime} (${i}. seçim)`);
    secilen.push(a.kelime);
    gecmis = S.gecmisEkle(gecmis, a.kelime);
    assert.ok(gecmis.length <= C.gecmisUzunlugu);
  }
  assert.equal(new Set(secilen.slice(0, 200)).size, 200);                        // ilk 200 seçim hep farklı
});

test('sec: hepsi kullanıldıysa geçmiş yok sayılır; boş listede hata', () => {
  const adaylar = [{ kelime: 'AAA' }, { kelime: 'BBB' }];
  assert.ok(['AAA', 'BBB'].includes(S.sec(adaylar, ['AAA', 'BBB'], S.rng(1)).kelime));
  assert.equal(S.sec(adaylar, ['AAA'], S.rng(1)).kelime, 'BBB');
  assert.throws(() => S.sec([], [], Math.random), /Aday yok/);
});

test('gecmisEkle: yeni dizi döner, tekrarlanan sona taşınır, sınır uygulanır', () => {
  const g0 = ['A', 'B', 'C'];
  const g1 = S.gecmisEkle(g0, 'A');
  assert.deepEqual(g1, ['B', 'C', 'A']);
  assert.deepEqual(g0, ['A', 'B', 'C']);
  assert.deepEqual(S.gecmisEkle(['A', 'B', 'C'], 'D', 3), ['B', 'C', 'D']);
  assert.deepEqual(S.gecmisEkle(undefined, 'A'), ['A']);
});

test('sec: aynı tohum aynı seçimi verir', () => {
  const adaylar = S.adaylar(veri, { kategori: 'Genel', zorluk: 'orta' });
  assert.equal(S.sec(adaylar, [], S.rng(5)).kelime, S.sec(adaylar, [], S.rng(5)).kelime);
});

/* ---------- maraton ---------- */

test('maraton zorluk eğrisi: 1–5 kolay, 6–12 orta, 13+ zor', () => {
  assert.deepEqual([1, 5, 6, 12, 13, 40].map(S.maratonZorluk), ['kolay', 'kolay', 'orta', 'orta', 'zor', 'zor']);
});

/* ---------- ayarlar ---------- */

test('config: haklar ve kategori listesi', () => {
  assert.deepEqual(C.hak, { kolay: 10, orta: 7, zor: 6 });
  assert.equal(C.gunlukHak, 10);
  assert.equal(C.gecmisUzunlugu, 200);
  assert.equal(C.kategoriler.length, 12);
  for (const ad of Object.keys(veri.kategoriler)) assert.ok(C.kategoriler.includes(ad), ad);
});

test('seçici ve oyun DOM\'a, window\'a ve Kit\'e dokunmaz', () => {
  const fs = require('node:fs'), path = require('node:path');
  for (const f of ['game.js', 'secici.js', 'tr.js', 'config.js']) {
    const k = fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/document\.|localStorage|Kit\.|navigator\./.test(k), f + ': tarayıcı API\'si kullanılıyor');
  }
});
