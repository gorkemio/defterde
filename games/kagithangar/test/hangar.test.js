import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mizac, kirisikIzleri, utule, UTU_HAKKI } from '../engine/hangar.js';

const ucus = (o) => ({ mesafe: 6, sure: 1.5, loop: 0, olay: 'indi', sapma: 0, ...o });

test('mizaç: az uçuşta henüz oturmadı', () => {
  assert.match(mizac({ gunluk: [ucus()] }), /Henüz/);
});

test('mizaç: duvar sevdalısı, sola kayan, takla delisi, sakin', () => {
  assert.match(mizac({ gunluk: [ucus({ olay: 'duvar' }), ucus({ olay: 'duvar' }), ucus({ olay: 'duvar' })] }), /duvar sevdalısı/i);
  assert.match(mizac({ gunluk: [ucus({ sapma: 1.2 }), ucus({ sapma: 0.9 }), ucus({ sapma: 1 })] }), /sola kayıyor/i);
  assert.match(mizac({ gunluk: [ucus({ loop: 2 }), ucus(), ucus()] }), /takla delisi/i);
  assert.match(mizac({ gunluk: [ucus(), ucus(), ucus()] }), /Sakin/);
  const iki = mizac({ gunluk: [ucus({ olay: 'pencere', loop: 1 }), ucus({ loop: 1 }), ucus()] });
  assert.match(iki, /kaçak ruhlu.*takla delisi/i);
  assert.equal(iki[0], iki[0].toLocaleUpperCase('tr'));
});

test('kırışık izleri: uçağa özgü, sayısı yıpranmaya eşit, 30 ile sınırlı', () => {
  const a = kirisikIzleri('u_1', 5), b = kirisikIzleri('u_1', 5), c = kirisikIzleri('u_2', 5);
  assert.equal(a.length, 5);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(kirisikIzleri('u_1', 80).length, 30);
  assert.deepEqual(kirisikIzleri('u_1', 7).slice(0, 5), a, 'yeni kırışık eskileri değiştirmez');
});

test('ütü: kırışıkları siler, en çok 3 kez', () => {
  let y = { kirisik: 6, utu: 0 };
  for (let i = 1; i <= UTU_HAKKI; i++) { y = utule(y); assert.deepEqual(y, { kirisik: 0, utu: i }); y = { ...y, kirisik: 2 }; }
  assert.equal(utule(y), null);
  assert.equal(utule({ kirisik: 0, utu: 0 }), null, 'kırışık yoksa ütü hakkı yanmaz');
});
