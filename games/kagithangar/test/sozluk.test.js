import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOZLUK } from '../ui/sozluk.js';

test('ileri etiketleri tek bir okla biter', () => {
  for (const [k, v] of Object.entries(SOZLUK.ileri)) {
    assert.ok(v.endsWith(' →'), k);
    assert.equal(v.split('→').length - 1, 1, k);
    assert.equal(v[0], v[0].toLocaleUpperCase('tr'), k);
  }
});

test('geri etiketleri küçük harf yer adı (ust() başına "← " koyar)', () => {
  for (const [k, v] of Object.entries(SOZLUK.geri)) {
    assert.equal(v, v.toLocaleLowerCase('tr'), k);
    assert.ok(!v.includes('←') && !v.includes('→'), k);
  }
});

test('yan ve tehlikeli işler oksuz ve büyük harfle başlar', () => {
  for (const grup of ['yan', 'tehlikeli']) {
    for (const [k, v] of Object.entries(SOZLUK[grup])) {
      assert.ok(!v.includes('→') && !v.includes('←'), `${grup}.${k}`);
      assert.equal(v[0], v[0].toLocaleUpperCase('tr'), `${grup}.${k}`);
    }
  }
});

test('bir etiket iki farklı işe verilmez', () => {
  const hepsi = Object.values(SOZLUK).flatMap(g => Object.values(g));
  assert.equal(new Set(hepsi).size, hepsi.length);
});
