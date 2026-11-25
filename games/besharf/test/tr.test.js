// node --test — kit/tr.js (adamasmaca/test/tr.test.js'ten uyarlandı) + Beş Harf ekleri
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tr = require('../kit/tr.js');

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
  assert.equal(tr.normalize('ılık'), 'ILIK');
  assert.notEqual(tr.normalize('ılık'), tr.normalize('ilik'));       // I ile İ asla karışmaz
  assert.notEqual(tr.normalize('ırmak'), tr.normalize('irmik'));
});

test('şapkalı ve ayrışık (NFD) harfler normalize edilir', () => {
  assert.equal(tr.normalize('kâğıt'), 'KAĞIT');
  assert.equal(tr.normalize('millî'), 'MİLLİ');
  assert.equal(tr.normalize('hükûmet'), 'HÜKUMET');
  assert.equal(tr.normalize('ÎMAN'), 'İMAN');
  assert.equal(tr.normalize('İstanbul'.normalize('NFD')), 'İSTANBUL');
  assert.equal(tr.normalize('  ağaç   yaşken\teğilir '), 'AĞAÇ YAŞKEN EĞİLİR');
});

test('tusHarf: Q/W/X, rakam ve özel tuşlar yok sayılır', () => {
  for (const k of ['q', 'Q', 'w', 'W', 'x', 'X', '1', ' ', '.', 'Enter', 'Shift', 'Backspace', 'Dead', '', 'é', 'ß']) {
    assert.equal(tr.tusHarf(k), null, JSON.stringify(k));
  }
  assert.equal(tr.tusHarf(undefined), null);
});

test('tusHarf: i ve İ → İ; ı ve I → I; Türkçe harfler korunur', () => {
  assert.equal(tr.tusHarf('i'), 'İ');
  assert.equal(tr.tusHarf('İ'), 'İ');
  assert.equal(tr.tusHarf('I'), 'I');
  assert.equal(tr.tusHarf('ı'), 'I');
  for (const [k, h] of [['ğ', 'Ğ'], ['ç', 'Ç'], ['ş', 'Ş'], ['ö', 'Ö'], ['ü', 'Ü'], ['â', 'A'], ['î', 'İ'], ['û', 'U']]) {
    assert.equal(tr.tusHarf(k), h, k);
  }
  for (const h of tr.ALFABE) {
    assert.equal(tr.tusHarf(h), h, h);
    assert.equal(tr.tusHarf(tr.kucult(h)), h, tr.kucult(h));
  }
});

test('gecerliKelime: sınırlar ve alfabe dışı', () => {
  assert.ok(tr.gecerliKelime('kalem', 5, 5));
  assert.ok(tr.gecerliKelime('kâğıt', 5, 5));
  assert.ok(!tr.gecerliKelime('kale', 5, 5));
  assert.ok(!tr.gecerliKelime('wushu', 5, 5));
  assert.ok(!tr.gecerliKelime('taksi!', 5, 6));
  assert.ok(!tr.gecerliKelime('iki ev', 5, 6));
});

test('indeks ve kodla: alfabe sırası, I ile İ ayrı kod', () => {
  assert.equal(tr.indeks('A'), 0);
  assert.equal(tr.indeks('Z'), 28);
  assert.equal(tr.indeks('I'), 10);
  assert.equal(tr.indeks('İ'), 11);
  assert.equal(tr.indeks('Q'), -1);
  assert.deepEqual(Array.from(tr.kodla('KALEM')), [13, 0, 14, 5, 15]);
  assert.deepEqual(Array.from(tr.kodla('kâlem')), [13, 0, 14, 5, 15]);
  assert.deepEqual(Array.from(tr.kodla('ırmak')), [10, 20, 15, 0, 13]);
  assert.deepEqual(Array.from(tr.kodla('irmik')), [11, 20, 15, 11, 13]);
  assert.throws(() => tr.kodla('KAXEM'));
  assert.throws(() => tr.kodla('KA EM'));
});

test('kaydir: tur dönüşü, satır sonları korunur, kelime okunmaz', () => {
  const duz = 'KALEM\nIRMAK\nİRMİK\nĞĞĞĞĞ\nZZZZZ';
  const kodlu = tr.kaydir(duz);
  assert.equal(tr.kaydir(kodlu, -1), duz);
  assert.equal(kodlu.split('\n').length, 5);
  assert.ok(!kodlu.includes('KALEM'));
  for (const c of kodlu.replace(/\n/g, '')) assert.ok(tr.ALFABE.includes(c), c);
  // Aynı kelime farklı yerde farklı kodlanır
  const [a, , , , b] = tr.kaydir('KALEM\nKALEM\nKALEM\nKALEM\nKALEM').split('\n');
  assert.notEqual(a, b);
});

// Yerelsiz büyütme/küçültme bu projede yasak (I/İ karışır). Oyun kaynaklarını ve kit eklerini tarar.
test('kaynaklarda yerelsiz büyütme/küçültme yok', () => {
  const kok = path.join(__dirname, '..');
  const aranan = ['config.js', 'kit/tr.js', 'kit/daktilo.js', 'kit/kopyakalemi.js', 'kit/daktilokagidi.js', 'kit/daktilotusu.js'];
  for (const d of ['engine', 'ui', 'audio', 'scripts']) {
    const tam = path.join(kok, d);
    if (fs.existsSync(tam)) for (const f of fs.readdirSync(tam)) if (/\.(m?js|cjs)$/.test(f)) aranan.push(path.join(d, f));
  }
  const yasak = new RegExp('\\.to' + '(Upper|Lower)' + 'Case\\(');
  let bakilan = 0;
  for (const f of aranan) {
    const yol = path.join(kok, f);
    if (!fs.existsSync(yol)) continue;
    bakilan++;
    fs.readFileSync(yol, 'utf8').split('\n')
      .forEach((s, i) => assert.ok(!yasak.test(s), `${f}:${i + 1} yerelsiz çevirme: ${s.trim()}`));
  }
  assert.ok(bakilan >= 1);
});
