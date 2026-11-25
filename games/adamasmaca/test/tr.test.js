// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tr = require('../tr.js');

test('alfabe 29 harf, Q W X yok', () => {
  assert.equal(tr.ALFABE.length, 29);
  assert.equal(new Set(tr.ALFABE).size, 29);
  for (const h of ['Q', 'W', 'X']) assert.ok(!tr.ALFABE.includes(h));
  for (const h of ['Ç', 'Ğ', 'I', 'İ', 'Ö', 'Ş', 'Ü']) assert.ok(tr.ALFABE.includes(h), h);
});

test('I/İ: yerelli büyütme ve küçültme', () => {
  assert.equal(tr.buyut('istanbul'), 'İSTANBUL');
  assert.equal(tr.buyut('ılık'), 'ILIK');
  assert.equal(tr.buyut('iğne'), 'İĞNE');
  assert.equal(tr.kucult('İSTANBUL'), 'istanbul');
  assert.equal(tr.kucult('ILIK'), 'ılık');
  assert.equal(tr.normalize('istanbul'), 'İSTANBUL');
  assert.equal(tr.normalize('ılık'), 'ILIK');
  assert.notEqual(tr.normalize('ılık'), tr.normalize('ilik'));       // I ile İ asla karışmaz
});

test('şapkalı harfler normalize edilir', () => {
  assert.equal(tr.normalize('kâğıt'), 'KAĞIT');
  assert.equal(tr.normalize('millî'), 'MİLLİ');
  assert.equal(tr.normalize('hükûmet'), 'HÜKUMET');
  assert.equal(tr.normalize('Hakkâri'), 'HAKKARİ');
  assert.equal(tr.normalize('KÂĞIT'), 'KAĞIT');
  assert.equal(tr.normalize('ÂLİM'), 'ALİM');
  assert.equal(tr.normalize('ÎMAN'), 'İMAN');
});

test('ayrışık (NFD) girdi birleşik biçime çevrilir', () => {
  const nfd = 'İstanbul'.normalize('NFD');                    // İ = I + birleşik nokta
  assert.equal(tr.normalize(nfd), 'İSTANBUL');
  assert.equal(tr.normalize('kâğıt'), 'KAĞIT');   // â ve ğ ayrışık yazılmış
});

test('boşluklar tek boşluğa iner ve kenarlar kırpılır', () => {
  assert.equal(tr.normalize('  ağaç   yaşken\teğilir '), 'AĞAÇ YAŞKEN EĞİLİR');
});

test('tusHarf: Q/W/X, rakam ve özel tuşlar yok sayılır', () => {
  for (const k of ['q', 'Q', 'w', 'W', 'x', 'X', '1', ' ', '.', 'Enter', 'Shift', 'Backspace', 'Dead', '', 'é', 'ß']) {
    assert.equal(tr.tusHarf(k), null, JSON.stringify(k));
  }
  assert.equal(tr.tusHarf(undefined), null);
  assert.equal(tr.tusHarf(null), null);
});

test('tusHarf: i → İ, I → I, ı → I; Türkçe harfler korunur', () => {
  assert.equal(tr.tusHarf('i'), 'İ');
  assert.equal(tr.tusHarf('İ'), 'İ');
  assert.equal(tr.tusHarf('I'), 'I');
  assert.equal(tr.tusHarf('ı'), 'I');
  assert.equal(tr.tusHarf('a'), 'A');
  assert.equal(tr.tusHarf('ğ'), 'Ğ');
  assert.equal(tr.tusHarf('ç'), 'Ç');
  assert.equal(tr.tusHarf('ş'), 'Ş');
  assert.equal(tr.tusHarf('ö'), 'Ö');
  assert.equal(tr.tusHarf('ü'), 'Ü');
  assert.equal(tr.tusHarf('â'), 'A');                                // şapka düşer
  assert.equal(tr.tusHarf('î'), 'İ');
});

test('tusHarf: 29 harfin her biri kendi küçük ve büyük haliyle eşleşir', () => {
  for (const h of tr.ALFABE) {
    assert.equal(tr.tusHarf(h), h, h);
    assert.equal(tr.tusHarf(tr.kucult(h)), h, tr.kucult(h));
  }
});

test('harfMi', () => {
  assert.ok(tr.harfMi('Ğ'));
  assert.ok(tr.harfMi('ğ'));
  assert.ok(tr.harfMi('i'));
  assert.ok(!tr.harfMi('q'));
  assert.ok(!tr.harfMi('ab'));
  assert.ok(!tr.harfMi(''));
  assert.ok(!tr.harfMi('3'));
});

test('konumlar: tüm geçtiği yerler', () => {
  assert.deepEqual(tr.konumlar('KALEM', 'E'), [3]);
  assert.deepEqual(tr.konumlar('ANANAS', 'A'), [0, 2, 4]);
  assert.deepEqual(tr.konumlar('ANANAS', 'Z'), []);
  assert.deepEqual(tr.konumlar('ılık', 'I'), [0, 2]);                // ı → I
  assert.deepEqual(tr.konumlar('ılık', 'İ'), []);                    // İ ile I karışmaz
  assert.deepEqual(tr.konumlar('istanbul', 'İ'), [0]);
  assert.deepEqual(tr.konumlar('AĞAÇ YAŞKEN EĞİLİR', 'E'), [9, 12]);     // A0 Ğ1 A2 Ç3 _4 Y5 A6 Ş7 K8 E9 N10 _11 E12
  assert.deepEqual(tr.konumlar('kâğıt', 'A'), [1]);                  // şapkalı â, A sayılır
});

test('gecerliKelime: sınırlar ve alfabe dışı', () => {
  assert.ok(tr.gecerliKelime('kedi'));
  assert.ok(tr.gecerliKelime('kâğıt'));
  assert.ok(tr.gecerliKelime('göz'));                                // 3 harf
  assert.ok(!tr.gecerliKelime('ev'));                                // 2 harf
  assert.ok(tr.gecerliKelime('A'.repeat(14)));
  assert.ok(!tr.gecerliKelime('A'.repeat(15)));
  assert.ok(!tr.gecerliKelime('iki kedi'));                          // boşluk
  assert.ok(!tr.gecerliKelime('wushu'));
  assert.ok(!tr.gecerliKelime('taxi'));
  assert.ok(!tr.gecerliKelime('quiz'));
  assert.ok(!tr.gecerliKelime('kedi!'));
  assert.ok(!tr.gecerliKelime('abc1'));
  assert.ok(!tr.gecerliKelime(null));
});

test('gecerliSoz: atasözü biçimi', () => {
  assert.ok(tr.gecerliSoz('Ağaç yaşken eğilir'));
  assert.ok(tr.gecerliSoz('AĞAÇ YAŞKEN EĞİLİR'));
  assert.ok(!tr.gecerliSoz('Ağaç yaşken, eğilir'));                  // noktalama yok
  assert.ok(!tr.gecerliSoz('Ağaç yaşken eğilir.'));
  assert.ok(!tr.gecerliSoz('a'.repeat(46)));
  assert.ok(!tr.gecerliSoz(''));
  assert.ok(!tr.gecerliSoz('quiz show'));
});

test('nadir harf puanı ve farklı harf sayısı', () => {
  assert.equal(tr.nadirPuan('KEDİ'), 0);
  assert.equal(tr.nadirPuan('AĞAÇ'), 3 + 2);                        // Ğ 3 + Ç 2
  assert.equal(tr.nadirPuan('JÜRİ'), 4 + 2);
  assert.equal(tr.farkliHarf('ANANAS'), 3);
});

// Yerelsiz büyütme/küçültme bu projede yasak (I/İ karışır). Kaynakları tarayıp denetler.
test('kaynaklarda yerelsiz büyütme/küçültme yok', () => {
  const kok = path.join(__dirname, '..');
  const aranan = ['tr.js', 'config.js', 'game.js', 'secici.js', 'hileci.js', 'draw.js', 'ui.js'];
  for (const d of ['scripts', path.join('scripts', 'kaynak')]) {
    const tam = path.join(kok, d);
    if (fs.existsSync(tam)) for (const f of fs.readdirSync(tam)) if (/\.(m?js)$/.test(f)) aranan.push(path.join(d, f));
  }
  const yasak = new RegExp('\\.to' + '(Upper|Lower)' + 'Case\\(');
  let bakilan = 0;
  for (const f of aranan) {
    const yol = path.join(kok, f);
    if (!fs.existsSync(yol)) continue;
    bakilan++;
    const satirlar = fs.readFileSync(yol, 'utf8').split('\n');
    satirlar.forEach((s, i) => assert.ok(!yasak.test(s), `${f}:${i + 1} yerelsiz çevirme: ${s.trim()}`));
  }
  assert.ok(bakilan >= 1);
});
