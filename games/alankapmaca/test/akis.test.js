const test = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: sonrakiAdim } = require('node:timers/promises');
const akisKur = require('../akis.js');

test('aktif oyunun akışı devam eder, eski oyun reddedilir', async () => {
  const akis = akisKur({ jeton: () => 2, duraklatildi: () => false });
  assert.equal(await akis.devamEt(2), true);
  assert.equal(await akis.devamEt(1), false);
});

test('birden çok duraklama nedeni bitmeden bekleyen hamle ilerlemez', async () => {
  const nedenler = new Set(['ayarlar', 'arka plan', 'yön uyarısı']);
  const akis = akisKur({ jeton: () => 1, duraklatildi: () => nedenler.size > 0 });
  let hamle = 0;
  const is = akis.devamEt(1).then(devam => { if (devam) hamle++; });
  await sonrakiAdim();
  assert.equal(hamle, 0);
  for (const neden of ['ayarlar', 'arka plan']) {
    nedenler.delete(neden);
    akis.guncelle();
    await sonrakiAdim();
    assert.equal(hamle, 0);
  }
  nedenler.clear();
  akis.guncelle();
  akis.guncelle();
  await is;
  assert.equal(hamle, 1, 'devam bildirimi tekrarlansa da hamle yalnız bir kez yürür');
});

test('beklerken yeni oyun açılması eski işlemi iptal eder', async () => {
  let jeton = 1, durdu = true;
  const akis = akisKur({ jeton: () => jeton, duraklatildi: () => durdu });
  const eski = akis.devamEt(1);
  jeton = 2;
  const yeni = akis.devamEt(2);
  akis.guncelle();
  assert.equal(await eski, false);
  durdu = false;
  akis.guncelle();
  assert.equal(await yeni, true);
});

test('devam bildirimiyle aynı anda yeniden duraklatılırsa işlem beklemeyi sürdürür', async () => {
  let durdu = true, ilerledi = false;
  const akis = akisKur({ jeton: () => 1, duraklatildi: () => durdu });
  const is = akis.devamEt(1).then(() => { ilerledi = true; });
  durdu = false;
  akis.guncelle();
  durdu = true;
  akis.guncelle();
  await sonrakiAdim();
  assert.equal(ilerledi, false);
  durdu = false;
  akis.guncelle();
  await is;
  assert.equal(ilerledi, true);
});
