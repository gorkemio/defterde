import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotKarti, rozetFarki, ucusIsle, sahneRekorlari, sahneRekoru, ozet } from '../engine/pilot.js';
import { yeniUcak } from '../depo.js';

const ucus = (mesafe, o = {}) => ({ mesafe, sure: 1.5, enYuksek: 1.2, loop: 0, duvar: 0, pencere: false, ...o });

test('ucusIsle: sınıfta ilk uçuş, sonra rekor ve önceki en iyi', () => {
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  const a = ucusIsle(u.istatistik, [], ucus(8.2), 'sinif');
  assert.equal(a.ilk, true);
  assert.equal(a.rekor, false);
  assert.equal(a.oncekiEnIyi, null);
  assert.equal(a.istatistik.enUzak, 8.2);
  assert.equal(a.istatistik.ucus, 1);
  const b = ucusIsle(a.istatistik, [{ sahne: 'sinif' }], ucus(9.5, { loop: 1, duvar: 2 }), 'sinif');
  assert.equal(b.ilk, false);
  assert.equal(b.rekor, true);
  assert.equal(b.oncekiEnIyi, 8.2);
  assert.equal(b.istatistik.loop, 1);
  assert.equal(b.istatistik.duvar, 2);
  const c = ucusIsle(b.istatistik, [{ sahne: 'sinif' }, { sahne: 'sinif' }], ucus(9.5), 'sinif');
  assert.equal(c.rekor, false, 'eşit mesafe rekor değil');
});

test('ucusIsle: başka mekânlar kendi kaydında; sınıf alanları değişmez', () => {
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  const a = ucusIsle(u.istatistik, [], ucus(18), 'koridor');
  assert.equal(a.ilk, true);
  assert.deepEqual(a.istatistik.sahneler.koridor, { ucus: 1, enUzak: 18, enUzun: 1.5 });
  assert.equal(a.istatistik.enUzak, 0);
  const b = ucusIsle(a.istatistik, [{ sahne: 'koridor' }], ucus(20, { pencere: true }), 'koridor');
  assert.equal(b.rekor, true);
  assert.equal(b.oncekiEnIyi, 18);
  assert.equal(b.istatistik.sahneler.koridor.ucus, 2);
  assert.equal(b.istatistik.pencere, 1);
  assert.equal(u.istatistik.sahneler.koridor, undefined, 'girdi değişmez');
});

test('mekân rekorları uçak kartında; hangar rekoru uçaklar arasında', () => {
  const a = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  a.ad = 'Ok 1';
  a.istatistik = ucusIsle(a.istatistik, [], ucus(10), 'sinif').istatistik;
  a.gunluk = [{ sahne: 'sinif' }];
  a.istatistik = ucusIsle(a.istatistik, a.gunluk, ucus(25), 'park').istatistik;
  const b = yeniUcak({ tasarim: 'marti', kalite: 85, mod: 'izle' });
  b.ad = 'Martı';
  b.istatistik = ucusIsle(b.istatistik, [], ucus(31), 'park').istatistik;
  assert.deepEqual(sahneRekorlari(a).map(r => [r.sahne, r.enUzak, r.ucus]), [['sinif', 10, 1], ['park', 25, 1]]);
  assert.deepEqual(sahneRekoru([a, b], 'park'), { mesafe: 31, ucakId: b.id, ucakAd: 'Martı' });
  assert.equal(sahneRekoru([a, b], 'koridor'), null);
});

test('rozet farkı: yeni rozet ve rütbe atlaması; değişiklik yoksa boş', () => {
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  const once = pilotKarti([u]);
  u.istatistik = ucusIsle(u.istatistik, [], ucus(10.4), 'sinif').istatistik;
  const sonra = pilotKarti([u]);
  const f = rozetFarki(once, sonra);
  assert.deepEqual(f.yeniRozetler.map(r => r.id), ['ilk-ucus', 'uzun-yol']);
  assert.deepEqual(f.rutbe, { once: 'Çaylak', sonra: 'Kanat Adayı' });
  assert.ok(f.puan > 0);
  const bos = rozetFarki(sonra, sonra);
  assert.deepEqual(bos, { yeniRozetler: [], rutbe: null, puan: 0 });
});

test('Günün Pilotu ertesi gün kaybolmaz (başarı sayacı)', () => {
  assert.equal(ozet([], { gunun: { gun: '2026-10-20', basarili: false }, gununBasari: 1 }).gununBasarili, true);
  assert.equal(ozet([], { gunun: { gun: '2026-10-20', basarili: false } }).gununBasarili, false);
});
