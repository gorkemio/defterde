import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelloBaslat, atisEkle, siradaki, turNo, skor } from '../engine/duello.js';

const yeni = () => duelloBaslat({ oyuncular: [{ ad: 'Ece', ucakId: 'a' }, { ad: 'Can', ucakId: 'b' }], sahne: 'sinif', tur: 3 });

test('sıra dönüşümlü ilerler, altı atışta biter', () => {
  let d = yeni();
  const sira = [];
  for (let i = 0; i < 6; i++) { sira.push(siradaki(d).ad + turNo(d)); d = atisEkle(d, 5 + i); }
  assert.deepEqual(sira, ['Ece1', 'Can1', 'Ece2', 'Can2', 'Ece3', 'Can3']);
  assert.ok(d.bitti);
  assert.equal(atisEkle(d, 99), d, 'bittikten sonra atış eklenmez');
});

test('en uzak atış kazanır, eşitlikte toplam; tam eşitlik berabere', () => {
  let d = yeni();
  for (const m of [6, 7, 9, 5, 4, 8]) d = atisEkle(d, m);     // Ece: 6, 9, 4 · Can: 7, 5, 8
  assert.equal(skor(d).kazanan, 0);
  let e = yeni();
  for (const m of [9, 9, 1, 2, 1, 1]) e = atisEkle(e, m);      // Ece 9,1,1 = 11 · Can 9,2,1 = 12
  assert.equal(skor(e).kazanan, 1);
  let f = yeni();
  for (const m of [5, 5, 5, 5, 5, 5]) f = atisEkle(f, m);
  assert.equal(skor(f).kazanan, -1);
});

test('eksik oyuncu ya da uçak reddedilir', () => {
  assert.throws(() => duelloBaslat({ oyuncular: [{ ad: 'x', ucakId: 'a' }], sahne: 'sinif' }));
  assert.throws(() => duelloBaslat({ oyuncular: [{ ad: 'x', ucakId: 'a' }, { ad: 'y' }], sahne: 'sinif' }));
});
