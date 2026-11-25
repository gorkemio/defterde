import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masaDurumu, ucusRotasi, sekmeIcin, gecerliSahne } from '../engine/akis.js';

const ucak = (id, tarih, o = {}) => ({ id, ad: id, tarih, emekli: false, gunluk: [], ...o });

test('masa: uçuşa hazır uçak yoksa yeni; emekliler sayılmaz', () => {
  assert.equal(masaDurumu([]).yeni, true);
  assert.equal(masaDurumu([ucak('a', '2026-10-01', { emekli: true })]).yeni, true);
  const d = masaDurumu([ucak('a', '2026-10-01'), ucak('b', '2026-10-02', { emekli: true })]);
  assert.equal(d.yeni, false);
  assert.equal(d.aktif.length, 1);
  assert.equal(d.sonUcak.id, 'a');
});

test('masa: son uçak, son uçuşu en yeni olandır; uçmamışsa katlandığı gün', () => {
  const eskiAmaUcmus = ucak('eski', '2026-09-01', { gunluk: [{ tarih: '2026-10-18T10:00:00Z' }] });
  const yeniUcmamis = ucak('yeni', '2026-10-10');
  assert.equal(masaDurumu([eskiAmaUcmus, yeniUcmamis]).sonUcak.id, 'eski');
  assert.equal(masaDurumu([ucak('x', '2026-10-01'), ucak('y', '2026-10-05')]).sonUcak.id, 'y');
});

test('uçuş rotası son mekâna gider; geçersiz ya da eksikse sınıf', () => {
  assert.equal(ucusRotasi('u_1', { sonSahne: 'park' }), '#/uc/u_1/park');
  assert.equal(ucusRotasi('u_1', {}), '#/uc/u_1/sinif');
  assert.equal(ucusRotasi('u_1', { sonSahne: 'gunun' }), '#/uc/u_1/sinif');
  assert.equal(gecerliSahne('ay'), 'sinif');
  assert.equal(masaDurumu([], { sonSahne: 'koridor' }).sonSahne, 'koridor');
});

test('defter sekmesi: rota → sekme', () => {
  assert.equal(sekmeIcin('masa'), 'masa');
  assert.equal(sekmeIcin('atolye'), 'katla');
  assert.equal(sekmeIcin('katalog'), 'katla');
  assert.equal(sekmeIcin('adlandir'), 'hangar');
  assert.equal(sekmeIcin('notla'), 'hangar');
  assert.equal(sekmeIcin('pilot'), 'pilot');
  assert.equal(sekmeIcin('uc'), null);
  assert.equal(sekmeIcin('duello'), null);
});
