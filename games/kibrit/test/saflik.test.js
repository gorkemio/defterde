const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('engine/ DOM\'a, Kit\'e ve Math.random\'a dokunmaz (yalnız dışa aktarım koruması window\'a bakar)', () => {
  const dizin = path.join(__dirname, '../engine');
  for (const f of fs.readdirSync(dizin)) {
    const s = fs.readFileSync(path.join(dizin, f), 'utf8');
    assert.ok(!/\bdocument\b/.test(s), `${f}: document`);
    assert.ok(!/\bKit\./.test(s), `${f}: Kit`);
    assert.ok(!/Math\.random/.test(s), `${f}: Math.random (tohumlu rng kullanılmalı)`);
    const pencere = s.match(/window\.[A-Za-z_]+/g) || [];
    assert.ok(pencere.every(w => w === 'window.KB'), `${f}: ${pencere.join(', ')}`);
  }
});

test('Türkçe büyük harf yalnız tr-TR yereliyle', () => {
  const dosyalar = ['ui', 'kit'].flatMap(d => fs.readdirSync(path.join(__dirname, '..', d)).filter(f => f.endsWith('.js')).map(f => path.join(d, f)));
  for (const f of dosyalar) {
    const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/\.toUpperCase\(/.test(s), `${f}: toUpperCase yerine toLocaleUpperCase('tr-TR')`);
  }
});

test('kit/rakam.js: yeni / ve = glifleri kutunun içinde; eski glifler duruyor', () => {
  const R = require('../kit/rakam.js');
  for (const ch of ['/', '=']) {
    assert.ok(R.GLIF[ch] && R.GLIF[ch].length, ch);
    for (const d of R.GLIF[ch]) {
      const nok = d[0] === 'L' ? [[d[1], d[2]], [d[3], d[4]]] : d[0] === 'C' ? d[1] : [[d[1], d[2]]];
      for (const [x, y] of nok) assert.ok(x >= -1 && x <= 11 && y >= -1 && y <= 15, `${ch} ${x},${y}`);
    }
  }
  for (const ch of '0123456789+-.:?') assert.ok(R.GLIF[ch], ch);
  assert.ok(R.GLIF.tik);
  assert.equal(R.genislik('1/1', 14) > 0, true);
});
