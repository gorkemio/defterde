// node --test — engine/daily.js: Türkiye saatiyle gün, gün numarası, günün cevabı, geri sayım, kodlama
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../engine/daily.js');
const C = require('../config.js');

test('gün değişimi Türkiye saatiyle 00:00 (UTC+3)', () => {
  assert.equal(D.istanbulTarih(new Date('2026-10-20T20:59:59Z')), '2026-10-20');
  assert.equal(D.istanbulTarih(new Date('2026-10-20T21:00:00Z')), '2026-10-21');
  assert.equal(D.istanbulTarih(new Date('2026-12-31T21:00:00Z')), '2027-01-01');
  assert.equal(D.istanbulTarih(new Date('2027-03-28T20:59:59Z')), '2027-03-28');   // Türkiye'de yaz saati yok
});

test('gün numarası: yayın günü No. 1; öncesi No. 1’e sabit', () => {
  assert.equal(C.yayinGunu, '2026-10-20');
  assert.equal(D.gunNo('2026-10-20'), 0);
  assert.equal(D.gunNo('2026-10-21'), 1);
  assert.equal(D.gunNo('2027-10-20'), 365);
  assert.equal(D.gunNo('2026-10-01'), 0);
});

test('günün cevabı: cevaplar[n mod N], aynı tarih herkese aynı', () => {
  const l = ['A1', 'B2', 'C3'];
  assert.deepEqual(D.gununCevabi(l, '2026-10-20'), { kelime: 'A1', no: 1, tarih: '2026-10-20', indeks: 0 });
  assert.equal(D.gununCevabi(l, '2026-10-22').kelime, 'C3');
  assert.equal(D.gununCevabi(l, '2026-10-23').kelime, 'A1');                    // sarma
  assert.equal(D.gununCevabi(l, '2026-10-23').no, 4);
  // aynı İstanbul gününde farklı saat dilimlerindeki iki an aynı kelimeyi verir
  const a = D.gununCevabi(l, D.istanbulTarih(new Date('2026-10-21T21:30:00Z')));   // İstanbul 22 Ekim 00:30
  const b = D.gununCevabi(l, D.istanbulTarih(new Date('2026-10-22T20:30:00Z')));   // İstanbul 22 Ekim 23:30
  assert.deepEqual(a, b);
});

test('geri sayım: bir sonraki İstanbul gece yarısına', () => {
  assert.equal(D.sonrakiGuneKalanMs(new Date('2026-10-20T20:59:59.000Z')), 1000);
  assert.equal(D.sonrakiGuneKalanMs(new Date('2026-10-20T21:00:00.000Z')), 86400000);
  assert.equal(D.geriSayimYazi(D.sonrakiGuneKalanMs(new Date('2026-10-20T13:38:16.000Z'))), '07:21:44');
  assert.equal(D.geriSayimYazi(0), '00:00:00');
});

test('tarih yazısı ve cevap listesi kodlaması', () => {
  assert.equal(D.tarihYazi('2026-10-20'), '20 Ekim 2026');
  assert.equal(D.tarihYazi('2027-02-03'), '3 Şubat 2027');
  const cevaplar = D.cozCevaplar(require('../data/cevaplar.js'));
  assert.equal(cevaplar.length, require('../data/cevaplar.js').adet);
  assert.ok(cevaplar.every((k) => Array.from(k).length === 5));
});
