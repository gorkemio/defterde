// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const S = require('../secici.js');
const C = require('../config.js');

const oyun = (kelime, zorluk = 'orta', ek = {}) => G.yeniOyun({ kelime, zorluk, ...ek });
const maske = (d) => d.maske.map((c) => c ?? '_').join('');
const donmus = (d) => JSON.stringify(d);

/* ---------- çizgi hakkı ve hazır parça ---------- */

test('çizgi hakkı: kolay 10, orta 7, zor 6; hazır parça 0, 3, 4', () => {
  assert.deepEqual([oyun('kedi', 'kolay'), oyun('kedi', 'orta'), oyun('kedi', 'zor')].map((d) => d.hak), [10, 7, 6]);
  assert.deepEqual([oyun('kedi', 'kolay'), oyun('kedi', 'orta'), oyun('kedi', 'zor')].map(G.hazirParca), [0, 3, 4]);
  assert.deepEqual(G.PARCALAR.slice(0, 3), ['taban', 'direk', 'kiris']);       // orta: ipten itibaren çizilir
  assert.equal(G.PARCALAR[3], 'ip');                                          // zor: ip de hazır
  assert.equal(G.PARCALAR.length, 10);
});

test('günün kelimesi hakkı elle verilir (10)', () => {
  const d = oyun('kedi', 'orta', { hak: C.gunlukHak, mod: 'gunun' });
  assert.equal(d.hak, 10);
  assert.equal(G.hazirParca(d), 0);
});

test('çizilen parça = 10 − kalan; yanlışta bir parça eklenir', () => {
  let d = oyun('kedi', 'orta');
  assert.equal(G.cizilenParca(d), 3);
  d = G.tahmin(d, 'z');
  assert.equal(G.cizilenParca(d), 4);
  assert.equal(G.PARCALAR[G.cizilenParca(d) - 1], 'ip');
});

test('geçersiz kurulum', () => {
  assert.throws(() => G.yeniOyun({ kelime: 'kedi', zorluk: 'çok zor' }), RangeError);
  assert.throws(() => G.yeniOyun({ kelime: 'kedi', mod: 'x' }), RangeError);
  assert.throws(() => G.yeniOyun({ kelime: 'wushu' }), RangeError);
  assert.throws(() => G.yeniOyun({ kelime: 'ab' }), RangeError);
  assert.throws(() => G.yeniOyun({}), RangeError);                               // kelime de uzunluk da yok
  assert.throws(() => G.yeniOyun({ kelime: 'kedi', hak: 1 }), RangeError);
  assert.doesNotThrow(() => G.yeniOyun({ uzunluk: 6, mod: 'hileci', zorluk: 'zor' }));
});

/* ---------- tahmin ---------- */

test('doğru harf: kelimedeki tüm konumlar açılır, çizgi hakkı düşmez', () => {
  let d = oyun('ananas');
  d = G.tahmin(d, 'a');
  assert.equal(maske(d), 'A_A_A_');
  assert.deepEqual(d.son, { harf: 'A', dogru: true, konumlar: [0, 2, 4], ipucu: false });
  assert.equal(d.kalan, 7);
  assert.deepEqual(d.yanlis, []);
});

test('yanlış harf: bir çizgi eksilir, yanlışlara girer', () => {
  const d = G.tahmin(oyun('kedi'), 'z');
  assert.equal(d.kalan, 6);
  assert.deepEqual(d.yanlis, ['Z']);
  assert.deepEqual(d.denenen, ['Z']);
  assert.equal(d.son.dogru, false);
});

test('aynı harf ikinci kez seçilemez (doğru ve yanlış)', () => {
  let d = G.tahmin(oyun('kedi'), 'k');
  assert.throws(() => G.tahmin(d, 'k'), /zaten/);
  assert.throws(() => G.tahmin(d, 'K'), /zaten/);
  d = G.tahmin(d, 'z');
  assert.throws(() => G.tahmin(d, 'z'), /zaten/);
});

test('Q, W, X ve harf olmayan karakterler reddedilir', () => {
  const d = oyun('kedi');
  for (const x of ['q', 'w', 'x', '1', ' ', '', 'ab']) assert.throws(() => G.tahmin(d, x), RangeError, JSON.stringify(x));
});

test('I ile İ karışmaz: "ılık" için İ yanlış, I doğru', () => {
  const d = oyun('ılık');
  assert.equal(d.hedef, 'ILIK');
  const y = G.tahmin(d, 'i');                                                   // i tuşu → İ
  assert.deepEqual(y.yanlis, ['İ']);
  const dogru = G.tahmin(d, 'ı');                                               // ı tuşu → I
  assert.equal(maske(dogru), 'I_I_');
  assert.equal(maske(G.tahmin(G.tahmin(oyun('istanbul'), 'i'), 'ı')), 'İ_______'.replace(/_/g, '_'));
});

test('şapkalı hedef normalize edilir: kâğıt → KAĞIT, â ile A eşleşir', () => {
  const d = oyun('kâğıt');
  assert.equal(d.hedef, 'KAĞIT');
  assert.equal(maske(G.tahmin(d, 'a')), '_A___');
});

/* ---------- bitiş ---------- */

test('tüm harfler açılınca kurtuldu', () => {
  let d = oyun('kedi');
  for (const h of ['k', 'e', 'd']) { d = G.tahmin(d, h); assert.equal(d.bitti, false); }
  d = G.tahmin(d, 'i');
  assert.equal(d.bitti, true);
  assert.equal(d.sonuc, 'kurtuldu');
  assert.equal(d.kalan, 7);
});

test('çizgiler bitince asıldı; kalan 0 olur ve eksiye düşmez', () => {
  let d = oyun('kedi', 'zor');
  for (const h of ['z', 'm', 'n', 'r', 's', 't']) d = G.tahmin(d, h);
  assert.equal(d.kalan, 0);
  assert.equal(d.bitti, true);
  assert.equal(d.sonuc, 'asildi');
  assert.equal(G.cizilenParca(d), 10);
});

test('son çizgide son harf doğruysa kurtuldu (asılmaz)', () => {
  let d = oyun('kedi', 'zor');
  for (const h of ['z', 'm', 'n', 'r', 's']) d = G.tahmin(d, h);               // 1 çizgi kaldı
  d = G.tahmin(G.tahmin(G.tahmin(G.tahmin(d, 'k'), 'e'), 'd'), 'i');
  assert.equal(d.sonuc, 'kurtuldu');
  assert.equal(d.kalan, 1);
});

test('biten oyunda tahmin ve ipucu hata verir', () => {
  let d = oyun('at'.padEnd(3, 'a').replace('ata', 'ata'));
  for (const h of ['a', 't']) d = G.tahmin(d, h);
  assert.equal(d.bitti, true);
  assert.throws(() => G.tahmin(d, 'z'), /bitti/);
  assert.throws(() => G.harfAc(d, Math.random), /kapalı/);
  assert.throws(() => G.anlamGoster(d), /kapalı/);
});

/* ---------- ipuçları ---------- */

test('Bir harf aç: açılmamış harfi tüm konumlarıyla açar, bir çizgiye mal olur', () => {
  let d = oyun('ananas');
  d = G.tahmin(d, 'n');
  const aday = new Set(['A', 'S']);
  const y = G.harfAc(d, S.rng(7));
  assert.ok(aday.has(y.son.harf), y.son.harf);
  assert.equal(y.son.ipucu, true);
  assert.equal(y.kalan, d.kalan - 1);
  assert.equal(y.ipucu.harf, 1);
  assert.deepEqual(y.yanlis, []);                                              // ipucu yanlış sayılmaz
  const yerler = y.son.konumlar;
  assert.deepEqual(yerler, y.son.harf === 'A' ? [0, 2, 4] : [5]);
  assert.throws(() => G.tahmin(y, y.son.harf), /zaten/);                        // açılan harf bir daha seçilemez
});

test('Bir harf aç: tohumlu rastgelelik tekrarlanır; hiç açılmış harfi seçmez', () => {
  const d = oyun('mutfak');
  const a = G.harfAc(d, S.rng(3)).son.harf, b = G.harfAc(d, S.rng(3)).son.harf;
  assert.equal(a, b);
  for (let t = 1; t <= 50; t++) {
    let x = G.tahmin(d, 'm');
    const y = G.harfAc(x, S.rng(t));
    assert.notEqual(y.son.harf, 'M');
  }
});

test('Bir harf aç son harfi açarsa kurtuldu', () => {
  let d = oyun('kedi');
  for (const h of ['k', 'e', 'd']) d = G.tahmin(d, h);
  const y = G.harfAc(d, Math.random);
  assert.equal(y.sonuc, 'kurtuldu');
  assert.equal(y.kalan, 6);
});

test('Anlamını göster: bir kez, bir çizgi', () => {
  const d = oyun('kedi');
  const y = G.anlamGoster(d);
  assert.equal(y.kalan, 6);
  assert.equal(y.ipucu.anlam, true);
  assert.throws(() => G.anlamGoster(y), /zaten/);
});

test('kalan çizgi 1 ise ipucu kapalı', () => {
  let d = oyun('kedi', 'zor');
  assert.equal(G.ipucuAcikMi(d), true);
  for (const h of ['z', 'm', 'n', 'r']) d = G.tahmin(d, h);                    // 2 kaldı
  assert.equal(G.ipucuAcikMi(d), true);
  d = G.tahmin(d, 's');                                                         // 1 kaldı
  assert.equal(G.ipucuAcikMi(d), false);
  assert.throws(() => G.harfAc(d, Math.random), /kapalı/);
  assert.throws(() => G.anlamGoster(d), /kapalı/);
});

test('ipucu çizgi bitirmez: iki ipucuyla kalan en az 1', () => {
  let d = oyun('kedi', 'zor');
  d = G.anlamGoster(d);
  d = G.harfAc(d, Math.random);
  assert.equal(d.kalan, 4);
  assert.equal(d.bitti, false);
});

test('ipucu ve yanlışlar birlikte: hak − yanlış − ipucu = kalan', () => {
  let d = oyun('mutfak', 'kolay');
  d = G.tahmin(d, 'z'); d = G.anlamGoster(d); d = G.harfAc(d, S.rng(1)); d = G.tahmin(d, 'w'.replace('w', 'y'));
  assert.equal(d.kalan, 10 - d.yanlis.length - d.ipucu.harf - 1);
  assert.equal(G.kullanilanCizgi(d), 10 - d.kalan);
});

/* ---------- atasözü ---------- */

test('atasözü: boşluk baştan açık, görünür, tahmin edilemez', () => {
  let d = oyun('Ağaç yaşken eğilir', 'orta', { kategori: 'Atasözleri' });
  assert.equal(d.hedef, 'AĞAÇ YAŞKEN EĞİLİR');
  assert.equal(d.maske[4], ' ');
  assert.equal(maske(d), '____ ______ ______');
  assert.equal(G.harfSayisi(d), 16);
  assert.throws(() => G.tahmin(d, ' '), RangeError);
  d = G.tahmin(d, 'e');
  assert.equal(maske(d), '____ ____E_ E_____');
  for (const h of 'AĞÇYŞKNLİR') d = G.tahmin(d, h);
  assert.equal(d.sonuc, 'kurtuldu');
  assert.equal(maske(d), 'AĞAÇ YAŞKEN EĞİLİR');
});

test('atasözünde harf açma boşluğu açmaya çalışmaz', () => {
  const d = oyun('Damlaya damlaya göl olur');
  for (let t = 1; t < 30; t++) assert.notEqual(G.harfAc(d, S.rng(t)).son.harf, ' ');
});

/* ---------- anlam maskeleme ---------- */

test('anlamMaskele: kelimenin kendisi ve kökü ____ olur', () => {
  assert.equal(G.anlamMaskele('Kalem, yazı yazmaya yarar. Kalemler çoktur.', 'kalem'), '____, yazı yazmaya yarar. ____ çoktur.');
  assert.equal(G.anlamMaskele('Elma ağacının meyvesi', 'ELMA'), '____ ağacının meyvesi');
  assert.equal(G.anlamMaskele('Gözün gördüğü şey', 'göz'), '____ gördüğü şey');
  assert.equal(G.anlamMaskele('Işığı yansıtan cam', 'ayna'), 'Işığı yansıtan cam');             // kelime geçmiyorsa aynen
});

test('anlamMaskele: I/İ ve şapkalı biçimler yerelli eşleşir', () => {
  assert.equal(G.anlamMaskele('Işık verir; ışıklı', 'ışık'), '____ verir; ____');
  assert.equal(G.anlamMaskele('İğne ile dikilir', 'iğne'), '____ ile dikilir');
  assert.equal(G.anlamMaskele('Kâğıt üzerine yazılır', 'kağıt'), '____ üzerine yazılır');
});

test('anlamMaskele: atasözünde yalnız dört harf ve üstü sözcükler gizlenir', () => {
  assert.equal(G.anlamMaskele('Çocuk küçükken eğitilmelidir; ağaç gibi eğilir', 'Ağaç yaşken eğilir'), 'Çocuk küçükken eğitilmelidir; ____ gibi ____');
});

/* ---------- puan, seri, rozet ---------- */

test('puan: kayıpta 0; kurtuluşta (10 + harf − yanlış − 2·ipucu) × seri çarpanı', () => {
  let d = oyun('kedi');
  for (const h of 'kedi') d = G.tahmin(d, h);
  assert.equal(G.puanla(d, 1), Math.floor((10 + 4) * 1.1));                     // 15
  assert.equal(G.puanla(d, 0), 14);
  assert.equal(G.puanla(d, 10), 28);
  assert.equal(G.puanla(d, 99), 28);                                           // çarpan 10. seride tavan
  let k = oyun('kedi', 'zor');
  for (const h of ['z', 'm', 'n', 'r', 's', 't']) k = G.tahmin(k, h);
  assert.equal(G.puanla(k, 5), 0);
});

test('puan: yanlış ve ipucu düşer; en az 1', () => {
  let d = oyun('kedi', 'kolay');
  d = G.tahmin(d, 'z'); d = G.anlamGoster(d);
  for (const h of 'kedi') d = G.tahmin(d, h);
  assert.equal(d.sonuc, 'kurtuldu');
  assert.equal(G.puanla(d, 0), 10 + 4 - 1 - 2);                                // 11
  const kat = { ...d, yanlis: Array(9).fill('Z'), ipucu: { harf: 5, anlam: true } };
  assert.equal(G.puanla(kat, 0), 1);
});

test('ardisikGun: sondaki ardışık gün sayısı', () => {
  assert.equal(G.ardisikGun([]), 0);
  assert.equal(G.ardisikGun(['2026-10-20']), 1);
  assert.equal(G.ardisikGun(['2026-10-20', '2026-10-22']), 1);
  assert.equal(G.ardisikGun(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']), 4);   // ay sınırı
  assert.equal(G.ardisikGun(['2026-12-31', '2027-01-01', '2026-12-30', '2026-12-31']), 3);    // yıl sınırı, tekrarlar
  assert.equal(G.ardisikGun(Array.from({ length: 7 }, (_, i) => `2026-10-${20 + i}`)), 7);
});

test('rozetler: ilkOn, tekAtis, uzunKelime, atalarSozu, yediGun', () => {
  const kazan = (kelime, yanlislar = [], ek = {}) => {
    let d = oyun(kelime, 'kolay');
    for (const y of yanlislar) d = G.tahmin(d, y);
    for (const h of d.hedef) if (h !== ' ' && !d.denenen.includes(h)) d = G.tahmin(d, h);
    return d;
  };
  const bos = { kurtarma: 1, gunler: [], rozetler: [] };
  assert.deepEqual(G.rozetKontrol(bos, kazan('kedi')), ['tekAtis']);
  assert.deepEqual(G.rozetKontrol(bos, kazan('kedi', ['z'])), []);
  assert.deepEqual(G.rozetKontrol({ ...bos, kurtarma: 10 }, kazan('kedi', ['z'])), ['ilkOn']);
  assert.deepEqual(G.rozetKontrol({ ...bos, kurtarma: 10, rozetler: ['ilkOn'] }, kazan('kedi', ['z'])), []);   // zaten var
  assert.ok(G.rozetKontrol(bos, kazan('anayasalcılık'.slice(0, 12))).includes('uzunKelime'));
  assert.ok(!G.rozetKontrol(bos, kazan('anayasalcıl'.slice(0, 11))).includes('uzunKelime'));                  // 11 harf yetmez
  assert.ok(G.rozetKontrol(bos, kazan('Ağaç yaşken eğilir')).includes('atalarSozu'));
  assert.ok(!G.rozetKontrol(bos, kazan('Ağaç yaşken eğilir')).includes('uzunKelime'));                         // atasözü uzun kelime değil
  const hafta = Array.from({ length: 7 }, (_, i) => `2026-10-${20 + i}`);
  assert.ok(G.rozetKontrol({ ...bos, gunler: hafta }, kazan('kedi', ['z'])).includes('yediGun'));
  assert.ok(!G.rozetKontrol({ ...bos, gunler: hafta.slice(1) }, kazan('kedi', ['z'])).includes('yediGun'));   // 6 gün
  // kayıpta tekAtis/uzunKelime/atalarSozu verilmez
  let k = oyun('kedi', 'zor'); for (const h of ['z', 'm', 'n', 'r', 's', 't']) k = G.tahmin(k, h);
  assert.deepEqual(G.rozetKontrol(bos, k), []);
});

test('ipucu kullanılan kurtuluş "Tek Atış" olmaz', () => {
  let d = oyun('kedi', 'kolay');
  d = G.anlamGoster(d);
  for (const h of 'kedi') d = G.tahmin(d, h);
  assert.ok(!G.rozetKontrol({ kurtarma: 1, gunler: [], rozetler: [] }, d).includes('tekAtis'));
});

/* ---------- paylaşım ---------- */

test('paylaşım metni kelimeyi vermez', () => {
  assert.equal(G.paylasimMetni({ no: 142, kategori: 'Hayvanlar', cizgi: 3, hak: 10, sonuc: 'kurtuldu' }), 'Adam Asmaca #142 · Hayvanlar · 3/10 çizgi · Kurtuldu');
  assert.equal(G.paylasimMetni({ no: 1, kategori: 'Genel', cizgi: 10, hak: 10, sonuc: 'asildi' }), 'Adam Asmaca #1 · Genel · 10/10 çizgi · Kurtulamadı');
});

/* ---------- Hileci için dışarıdan konum ---------- */

test('hedefsiz oyun: konumlar dışarıdan verilir, hedef bitince yazılır', () => {
  let d = G.yeniOyun({ uzunluk: 4, mod: 'hileci', zorluk: 'zor' });
  assert.equal(d.hedef, null);
  assert.throws(() => G.tahmin(d, 'k'), /konumlar/);
  assert.throws(() => G.harfAc(d, Math.random), /secim/);
  d = G.tahmin(d, 'k', [0]);
  d = G.tahmin(d, 'x'.replace('x', 'z'), []);                                  // Hileci: yok
  assert.equal(d.kalan, 5);
  d = G.harfAc(d, Math.random, { harf: 'e', konumlar: [1, 3] });
  assert.equal(maske(d), 'KE_E');
  assert.equal(d.kalan, 4);
  d = G.tahmin(d, 'd', [2]);
  assert.equal(d.sonuc, 'kurtuldu');
  const y = G.hedefYaz(d, 'KEDE');
  assert.equal(y.hedef, 'KEDE');
  assert.throws(() => G.hedefYaz(d, 'KUDE'), /maskeye/);
  assert.throws(() => G.hedefYaz(y, 'KEDE'), /yalnız/);
  assert.throws(() => G.tahmin(G.yeniOyun({ uzunluk: 4, mod: 'hileci' }), 'a', [9]), RangeError);
});

/* ---------- değişmezlik ve gövde testi ---------- */

test('işlemler girdiyi değiştirmez', () => {
  const d0 = oyun('ananas');
  const s0 = donmus(d0);
  G.tahmin(d0, 'a'); G.tahmin(d0, 'z'); G.harfAc(d0, Math.random); G.anlamGoster(d0);
  assert.equal(donmus(d0), s0);
  const d1 = G.tahmin(d0, 'a');
  const s1 = donmus(d1);
  G.tahmin(d1, 'n'); G.harfAc(d1, Math.random);
  assert.equal(donmus(d1), s1);
});

test('rastgele oyunlar: değişmezler hep korunur (gerçek veri, 600 oyun)', () => {
  const veri = { sozluk: require('../data/sozluk.js'), kategoriler: require('../data/kategoriler.js'), atasozleri: require('../data/atasozleri.js') };
  const r = S.rng(2026);
  const tum = [...S.adaylar(veri, { kategori: 'Genel', zorluk: 'hepsi' }), ...S.adaylar(veri, { kategori: 'Atasözleri' })];
  for (let o = 0; o < 600; o++) {
    const a = tum[Math.floor(r() * tum.length)];
    const zorluk = G.ZORLUKLAR[o % 3];
    let d = G.yeniOyun({ kelime: a.kelime, zorluk });
    let adim = 0;
    while (!d.bitti) {
      assert.ok(++adim < 60, 'oyun bitmedi: ' + a.kelime);
      const sec = r();
      if (sec < 0.12 && G.ipucuAcikMi(d) && !d.ipucu.anlam) d = G.anlamGoster(d);
      else if (sec < 0.24 && G.ipucuAcikMi(d) && d.maske.some((c) => c === null)) d = G.harfAc(d, r);
      else {
        const kalanHarfler = tr_alfabe().filter((h) => !d.denenen.includes(h));
        d = G.tahmin(d, kalanHarfler[Math.floor(r() * kalanHarfler.length)]);
      }
      // değişmezler
      assert.equal(d.kalan, Math.max(0, d.hak - d.yanlis.length - d.ipucu.harf - (d.ipucu.anlam ? 1 : 0)));
      assert.ok(G.cizilenParca(d) <= 10 && G.cizilenParca(d) >= G.hazirParca(d));
      assert.equal(new Set(d.denenen).size, d.denenen.length);
      for (const y of d.yanlis) assert.ok(!d.hedef.includes(y), 'yanlış harf kelimede: ' + y);
      d.maske.forEach((c, i) => { if (c !== null) assert.equal(c, d.hedef[i], 'maske hedefe uymuyor'); });
    }
    assert.equal(d.sonuc === 'kurtuldu', d.maske.every((c) => c !== null));
    assert.equal(d.sonuc === 'asildi', d.kalan === 0 && d.maske.some((c) => c === null));
    if (d.sonuc === 'kurtuldu') assert.ok(G.puanla(d, 3) >= 1); else assert.equal(G.puanla(d, 3), 0);
  }
});

function tr_alfabe() { return require('../tr.js').ALFABE.slice(); }
