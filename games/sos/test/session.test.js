const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const S = require('../session.js');

function kayit(hamleler = [], ikiKisi = true) {
  return { n: 5, oyunId: 7, ilkBaslayan: 0, secili: 'O',
    oyunAyar: { zorluk: 'zor', fazlaTur: true, ikiKisi }, hamleler };
}
const hamle = (i, harf = 'S') => ({ i, harf });

test('kayıt skor, sahip, sıra, seçili harf ve geri alma geçmişini yeniden kurar', () => {
  const kaynak = kayit([hamle(0), hamle(1, 'O'), hamle(2), hamle(5)]);
  const k = S.coz(S.paketle(kaynak), 5);
  let beklenen = G.yeniOyun({ boyut: 5, fazlaTur: true });
  for (const m of kaynak.hamleler) beklenen = G.placeLetter(beklenen, Math.floor(m.i / 5), m.i % 5, m.harf);
  assert.deepEqual(k.durum, beklenen);
  assert.ok(k.durum.hucre instanceof Int8Array);
  assert.equal(k.secili, 'O');
  assert.equal(k.oyunId, 7);
  assert.equal(k.gecmis.length, 4);
  assert.equal(k.gecmis.at(-1).durum.bos, 22);
  assert.deepEqual(k.gecmis.at(-1).durum.puan, [1, 0]);
  assert.deepEqual(k.isaret, [2, 5]);
});

test('bilgisayar cevabı ve fazla tur zinciri tek insan hamlesiyle geri alınabilir', () => {
  const kaynak = kayit([hamle(0), hamle(1, 'O'), hamle(2), hamle(5), hamle(6)], false);
  const k = S.coz(S.paketle(kaynak), 5);
  assert.equal(k.gecmis.length, 3);
  assert.equal(k.gecmis.at(-1).durum.bos, 22);
  assert.deepEqual(k.isaret, [6]);
  assert.equal(k.durum.sira, 0);
});

test('bilgisayar sırasında kesilen oyun aynı sırayla geri gelir', () => {
  const k = S.coz(S.paketle(kayit([hamle(0)], false)), 5);
  assert.equal(k.durum.sira, 1);
  assert.equal(k.durum.bos, 24);
  assert.equal(k.gecmis.length, 1);
  assert.deepEqual(k.isaret, []);
});

test('biten oyun sonucu ve son hamleden önceki durum korunur', () => {
  const k = S.coz(S.paketle(kayit(Array.from({ length: 25 }, (_, i) => hamle(i)))), 5);
  assert.equal(k.durum.bitti, true);
  assert.equal(G.kazanan(k.durum), 'berabere');
  assert.equal(k.gecmis.at(-1).durum.bitti, false);
  assert.equal(k.gecmis.at(-1).durum.bos, 1);
});

test('bozuk, farklı sürümlü veya geçersiz hamleli kayıtlar güvenle reddedilir', () => {
  const gecerli = JSON.parse(S.paketle(kayit()));
  for (const raw of [null, '{', '[]', 'x'.repeat(20000),
    JSON.stringify({ ...gecerli, surum: 99 }),
    JSON.stringify({ ...gecerli, secili: 'X' }),
    JSON.stringify({ ...gecerli, ilkBaslayan: 3 }),
    JSON.stringify({ ...gecerli, oyunAyar: { ...gecerli.oyunAyar, ikiKisi: 'evet' } }),
    S.paketle(kayit([hamle(25)])), S.paketle(kayit([hamle(0, 'X')])),
    S.paketle(kayit([hamle(0), hamle(0)]))]) assert.equal(S.coz(raw, 5), null);
  assert.equal(S.coz(JSON.stringify(gecerli), 8), null);
});

test('yeni boş sayfa eski oyunu geri getirmez; kayıt sonraki değişimlerden bağımsızdır', () => {
  const kaynak = kayit();
  const raw = S.paketle(kaynak);
  kaynak.hamleler.push(hamle(0));
  const k = S.coz(raw, 5);
  assert.equal(k.durum.bos, 25);
  assert.deepEqual(k.gecmis, []);
  assert.equal(k.durum.sira, 0);
});
