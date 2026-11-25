const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kok = path.join(__dirname, '..');
const jsler = (d) => fs.existsSync(path.join(kok, d)) ? fs.readdirSync(path.join(kok, d)).filter(f => f.endsWith('.js')).map(f => path.join(d, f)) : [];

test('engine/ DOM\'a, Kit\'e ve Math.random\'a dokunmaz (yalnız dışa aktarım koruması window.LB\'ye bakar)', () => {
  for (const f of jsler('engine')) {
    const s = fs.readFileSync(path.join(kok, f), 'utf8');
    assert.ok(!/\bdocument\b/.test(s), `${f}: document`);
    assert.ok(!/\bKit\./.test(s), `${f}: Kit`);
    assert.ok(!/Math\.random/.test(s), `${f}: Math.random (tohumlu rng kullanılmalı)`);
    const pencere = s.match(/window\.[A-Za-z_]+/g) || [];
    assert.ok(pencere.every(w => w === 'window.LB'), `${f}: ${pencere.join(', ')}`);
  }
});

test('Türkçe büyük harf yalnız tr-TR yereliyle', () => {
  for (const f of ['ui', 'kit', 'render'].flatMap(jsler)) {
    const s = fs.readFileSync(path.join(kok, f), 'utf8');
    assert.ok(!/\.toUpperCase\(/.test(s), `${f}: toUpperCase yerine toLocaleUpperCase('tr-TR')`);
  }
});

test('kit çekirdeği kibrit kitiyle bayt bayt aynı (yalnız eklenir)', (t) => {
  const kaynak = path.join(kok, '..', 'kibrit', 'kit');
  if (!fs.existsSync(kaynak)) return t.skip('kibrit/kit yok');
  for (const f of ['kalem.js', 'malzeme.js', 'ses.js', 'kagit.css', 'gren.png']) {
    assert.ok(fs.readFileSync(path.join(kok, 'kit', f)).equals(fs.readFileSync(path.join(kaynak, f))), f);
  }
});

test('index.html: yalnız yerel adresler, hepsi ?v= damgalı; ES modülü yok', () => {
  const s = fs.readFileSync(path.join(kok, 'index.html'), 'utf8');
  const adresler = [...s.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(a => !a.startsWith('data:') && a !== '/');
  assert.ok(adresler.length > 10);
  for (const a of adresler) {
    assert.ok(!/^(https?:)?\/\//.test(a), `dış adres: ${a}`);
    assert.ok(/\?v=[0-9a-f]{8}$/.test(a), `damgasız: ${a}`);
    assert.ok(fs.existsSync(path.join(kok, a.split('?')[0])), `yok: ${a}`);
  }
  assert.ok(!/type="module"/.test(s));
});
