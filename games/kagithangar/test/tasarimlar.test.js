import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uygula, kutu, enKalin, alanToplami, A4 } from '../engine/fold.js';
import { dogrula, TASARIM_IDLERI } from '../engine/tasarim.js';

const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));

test('tasarım klasörü listeyle aynı', () => {
  const dosyalar = fs.readdirSync(new URL('../tasarimlar/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  assert.deepEqual(dosyalar.sort(), [...TASARIM_IDLERI].sort());
});

for (const id of TASARIM_IDLERI) {
  test(`${id}: şema geçerli, hatasız katlanır, beklenen silüet`, () => {
    const t = oku(id);
    assert.deepEqual(dogrula(t), []);
    assert.equal(t.id, id);
    const r = uygula(t);
    const alan = r.kagit.en * r.kagit.boy;
    for (const d of r.anlar) assert.ok(Math.abs(alanToplami(d) - alan) < 1e-6);
    assert.equal(r.son.poligonlar.length, t.beklenen.poligon);
    kutu(r.son).forEach((v, i) => assert.ok(Math.abs(v - t.beklenen.kutu[i]) < 1e-3, `kutu[${i}] ${v}`));
    assert.equal(enKalin(r.son), t.beklenen.enKalin);
    // iki kanat katı var, ikisi de iki kanatlı uçağın yarı genişliğini kapsıyor
    assert.equal(t.adimlar.filter(a => a.kanat).length, 2);
  });
}

test('şema doğrulayıcı hataları yakalar', () => {
  const t = oku('ok');
  assert.ok(dogrula({ ...t, zorluk: 5 }).length);
  assert.ok(dogrula({ ...t, adimlar: [{ tip: 'kes', metin: 'x' }] }).length);
  assert.ok(dogrula({ ...t, adimlar: [{ tip: 'vadi', cizgi: [[0, 0]], metin: 'x' }] }).length);
});
