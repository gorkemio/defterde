// node --test — data/*.js: üretilmiş listelerin tutarlılığı (ham veri gerekmez)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tr = require('../kit/tr.js');

const kok = path.join(__dirname, '..');
const cevapV = require('../data/cevaplar.js'), tahminV = require('../data/tahminler.js'), anlamV = require('../data/anlamlar.js');
const cevaplar = tr.kaydir(cevapV.kodlu, -1).split('\n');
const tahminler = tahminV.liste.split('\n');
const T = new Set(tahminler);
const bes = (k) => Array.from(k).length === 5 && Array.from(k).every((c) => tr.ALFABE.includes(c));

test('veri dosyaları tarayıcıdaki gibi window.BH.veri altına yüklenir', () => {
  for (const ad of ['cevaplar', 'tahminler', 'anlamlar']) {
    const window = {};
    new Function('window', 'module', fs.readFileSync(path.join(kok, 'data', ad + '.js'), 'utf8'))(window, undefined);
    assert.ok(window.BH.veri[ad], ad);
  }
});

test('cevaplar: kodlu, tekil, 5 harf, sayı tutarlı, sira.txt ile aynı sıra', () => {
  assert.equal(cevaplar.length, cevapV.adet);
  assert.ok(cevaplar.length >= 1000, 'en az 1000 cevap');
  assert.equal(new Set(cevaplar).size, cevaplar.length);
  for (const k of cevaplar) assert.ok(bes(k), k);
  assert.ok(!cevapV.kodlu.includes('KALEM') || !cevaplar.includes('KALEM') || cevapV.kodlu.indexOf('KALEM') !== cevaplar.join('\n').indexOf('KALEM'));
  const sira = fs.readFileSync(path.join(kok, 'scripts', 'sira.txt'), 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  assert.deepEqual(sira, cevaplar);
});

test('tahminler: tekil, 5 harf, 400 KB altında, cevaplar ⊂ tahminler', () => {
  assert.equal(tahminler.length, tahminV.adet);
  assert.equal(T.size, tahminler.length);
  for (const k of tahminler) assert.ok(bes(k), k);
  assert.ok(fs.statSync(path.join(kok, 'data', 'tahminler.js')).size < 400 * 1024);
  for (const k of cevaplar) assert.ok(T.has(k), k);
});

test('anlamlar: cevaplara hizalı, en çok 120 karakter, cevap anlamda geçmez', () => {
  assert.equal(anlamV.liste.length, cevaplar.length);
  anlamV.liste.forEach((a, i) => {
    assert.ok(a && Array.from(a).length <= 120, cevaplar[i] + ': ' + a);
    const sozcukler = tr.normalize(a).split(/[^A-ZÇĞIİÖŞÜ]+/);
    assert.ok(!sozcukler.includes(cevaplar[i]), cevaplar[i] + ' anlamında geçiyor: ' + a);
  });
});

test('konu süzgeci sızmadı', () => {
  const satirlar = fs.readFileSync(path.join(kok, 'scripts', 'yasakli-cevap.txt'), 'utf8').split('\n').map((s) => s.replace(/#.*/, '').trim()).filter(Boolean);
  const tam = new Set(), onek = [];
  for (const s of satirlar) s.endsWith('*') ? onek.push(tr.normalize(s.slice(0, -1))) : tam.add(tr.normalize(s));
  for (const k of cevaplar) assert.ok(!tam.has(k) && !onek.some((o) => k.startsWith(o)), k);
});

test('doğal tahminler (çekimli dahil) kabul, uydurma ve adlar ret', () => {
  for (const k of ['KALEM', 'GELDİ', 'BENİM', 'OĞLUM', 'DİYOR', 'VAKTİ', 'ŞEHRİ', 'MİSİN', 'YOKTU', 'GİDİP', 'EVİNE', 'ARADA', 'BUNUN', 'NEDİR', 'OLSUN', 'ALDIM'])
    assert.ok(T.has(k), k + ' kabul edilmeli');
  for (const k of ['LORNA', 'DAVİD', 'JAMES', 'HAVVA', 'CİSCO', 'AMINA', 'KAXEM', 'ASDFG', 'ŞŞŞŞŞ', 'GEMMA'])
    assert.ok(!T.has(k), k + ' reddedilmeli');
});
