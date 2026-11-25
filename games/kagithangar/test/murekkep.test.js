import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UCLAR, cizgiStili, ucBul, isimStiliDuzelt, isimHarfleri, isimMetni, tohumlu, ISIM_VARSAYILAN } from '../engine/murekkep.js';
import { notPaketle, notCoz } from '../engine/not.js';
import { depoOlustur, yeniUcak } from '../depo.js';

test('uçlar: kalınlık sırayla artar; fırça yarı saydam; kayıtlı çizginin ucu bulunur', () => {
  assert.ok(UCLAR.ince.kalinlik < UCLAR.orta.kalinlik && UCLAR.orta.kalinlik < UCLAR.kalin.kalinlik && UCLAR.kalin.kalinlik < UCLAR.firca.kalinlik);
  assert.equal(cizgiStili({ kalinlik: 1.1 }).saydamlik, 0.88);
  assert.equal(cizgiStili({ kalinlik: 7.5, firca: true }).saydamlik, 0.5);
  assert.equal(cizgiStili({}).kalinlik, 1.1, 'eski çizgi: ince');
  assert.equal(cizgiStili({ kalinlik: 999 }).kalinlik, 12, 'sınırlanır');
  assert.equal(ucBul({ kalinlik: 1.1 }), 'ince');
  assert.equal(ucBul({ kalinlik: 2.3 }), 'orta');
  assert.equal(ucBul({ kalinlik: 7.5, firca: true }), 'firca');
});

test('isim stili: eksik ve bozuk değerler varsayılana döner', () => {
  assert.deepEqual(isimStiliDuzelt(undefined), ISIM_VARSAYILAN);
  assert.deepEqual(isimStiliDuzelt({ renk: 'mor', boyut: 'buyuk', bicim: 'cizgili' }), { renk: 'mavi', boyut: 'buyuk', bicim: 'cizgili' });
  assert.equal(isimMetni('Gece Kartalı', 'buyuk'), 'GECE KARTALI');
  assert.equal(isimMetni('ılık', 'buyuk'), 'ILIK', 'Türkçe büyük harf');
});

test('isim harfleri: ortalı, tohumla her seferinde aynı titreklik', () => {
  const olc = () => 0.5;
  const a = isimHarfleri('Mavi', 'el', 10, olc, tohumlu('x'));
  const b = isimHarfleri('Mavi', 'el', 10, olc, tohumlu('x'));
  assert.deepEqual(a, b);
  assert.equal(a.harfler.length, 4);
  const sol = a.harfler[0].x, sag = a.harfler[3].x;
  assert.ok(Math.abs(sol + sag) < 1, 'yaklaşık ortalı');
  assert.ok(a.harfler.every(h => Math.abs(h.aci) <= 3.5 && Math.abs(h.y) <= 0.4));
  const buyuk = isimHarfleri('Mavi', 'buyuk', 10, olc, tohumlu('x'));
  assert.ok(buyuk.genislik > a.genislik, 'büyük harfte harf aralığı açılır');
});

test('not paketi: kalın uç, fırça ve isim stili gider-gelir; eski paket (uçsuz) ince okunur', () => {
  const ucak = {
    tasarim: 'ok', ad: 'Mavi', kalite: 90, isimStili: { renk: 'kirmizi', boyut: 'buyuk', bicim: 'cizgili' },
    boya: { cizgiler: [
      { renk: 'mavi', kanat: 'sag', kalinlik: 1.1, noktalar: [[0.1, 0.2], [0.2, 0.3]] },
      { renk: 'yesil', kanat: 'sol', kalinlik: 4.2, noktalar: [[0.1, 0.2]] },
      { renk: 'kirmizi', duz: true, yuz: 'on', kalinlik: 7.5, firca: true, noktalar: [[0.4, 0.5]] },
    ] },
  };
  const p = notPaketle(ucak, 'merhaba');
  assert.equal(p.b[0].length, 3, 'ince uç eski biçimde');
  const g = notCoz(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(g.cizgiler.map(c => [c.kalinlik, !!c.firca]), [[1.1, false], [4.2, false], [7.5, true]]);
  assert.deepEqual(g.isimStili, { renk: 'kirmizi', boyut: 'buyuk', bicim: 'cizgili' });
  const eski = { ...p, b: [[0, 1, [0.1, 0.2]]] };
  delete eski.i;
  const ge = notCoz(eski);
  assert.equal(ge.cizgiler[0].kalinlik, 1.1);
  assert.deepEqual(ge.isimStili, ISIM_VARSAYILAN);
  assert.throws(() => notCoz({ ...p, b: [[0, 1, [0.1, 0.2], 9]] }));
});

test('depo: isim stili saklanır, eski uçakta varsayılan', () => {
  const m = new Map();
  const d = depoOlustur({ getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  d.ucakEkle(u);
  assert.deepEqual(d.ucak(u.id).isimStili, ISIM_VARSAYILAN);
  d.ucakGuncelle(u.id, { isimStili: { renk: 'yesil', boyut: 'kucuk', bicim: 'buyuk' } });
  assert.deepEqual(d.ucak(u.id).isimStili, { renk: 'yesil', boyut: 'kucuk', bicim: 'buyuk' });
});
