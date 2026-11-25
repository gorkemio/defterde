// node --test — index.html: klasik betikler, yerel dosyalar, sıra, dış istek yok
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kok = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(kok, 'index.html'), 'utf8');
const scriptler = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
const kaynak = (oz) => (oz.match(/\bsrc="([^"]+)"/) || [])[1];
const stiller = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]);

test('ES modülü yok, her betik yerel bir dosya', () => {
  assert.ok(scriptler.length > 5);
  for (const oz of scriptler) {
    assert.ok(!/type="module"/.test(oz), oz);
    const src = kaynak(oz);
    assert.ok(src, 'satır içi betik yok: ' + oz);
    assert.ok(!/^(https?:)?\/\//.test(src), 'dış betik: ' + src);
    assert.ok(fs.existsSync(path.join(kok, src.split('?')[0])), 'dosya yok: ' + src);
  }
  for (const href of stiller) {
    assert.ok(!/^(https?:)?\/\//.test(href), 'dış stil: ' + href);
    assert.ok(fs.existsSync(path.join(kok, href.split('?')[0])), 'dosya yok: ' + href);
  }
});

test('yükleme sırası: rough → kit çekirdeği → malzeme → kit ekleri → config → ui (ana en son)', () => {
  const sira = scriptler.map(kaynak).map(s => s.split('?')[0]);
  const once = (a, b) => assert.ok(sira.indexOf(a) >= 0 && sira.indexOf(a) < sira.indexOf(b), `${a} → ${b}`);
  once('assets/vendor/rough-4.6.6.js', 'kit/kalem.js');
  once('kit/kalem.js', 'kit/malzeme.js');
  once('kit/ses.js', 'kit/malzeme.js');
  once('kit/malzeme.js', 'kit/kopyakalemi.js');
  once('kit/kalem.js', 'kit/daktilo.js');
  once('kit/daktilo.js', 'kit/daktilotusu.js');
  once('config.js', 'ui/sahne.js');
  assert.equal(sira[sira.length - 1], 'ui/ana.js');
});

test('stil sırası ve malzeme: kagit.css önce, style.css sonda; html data-malzeme="kopyakalemi"', () => {
  assert.equal(stiller[0].split('?')[0], 'kit/kagit.css');
  assert.equal(stiller[stiller.length - 1].split('?')[0], 'style.css');
  assert.match(html, /<html lang="tr" data-malzeme="kopyakalemi">/);
});

test('belge: ilk main .defter, zoom engellenmez, CSS içinde dış adres yok', () => {
  assert.match(html, /<main class="defter"/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale/.test(html));
  for (const css of stiller) {
    const metin = fs.readFileSync(path.join(kok, css.split('?')[0]), 'utf8');
    assert.ok(!/url\(\s*['"]?(https?:)?\/\//.test(metin), 'dış url: ' + css);
  }
});

test('ui/, engine/, data/ ve audio/ altındaki her betik sayfada yüklü', () => {
  const yuklu = new Set(scriptler.map(kaynak).map((s) => s.split('?')[0]));
  for (const d of ['ui', 'engine', 'data', 'audio']) {
    for (const f of fs.readdirSync(path.join(kok, d))) if (f.endsWith('.js')) assert.ok(yuklu.has(`${d}/${f}`), `${d}/${f} index.html'de yok`);
  }
  for (const f of ['tr.js', 'daktilo.js', 'kopyakalemi.js', 'daktilokagidi.js', 'daktilotusu.js']) assert.ok(yuklu.has('kit/' + f), 'kit/' + f);
});
