// node --test — index.html ile kod arasındaki bağı korur (tarayıcı gerekmez).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kok = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(kok, 'index.html'), 'utf8');
const betikler = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].replace(/\?v=[0-9a-f]+$/, ''));

test('index.html: yerel betikler ve stiller var, klasik betik (modül yok), build gerekmez', () => {
  assert.ok(betikler.length >= 10);
  for (const b of betikler.filter((s) => !/^https?:/.test(s))) assert.ok(fs.existsSync(path.join(kok, b)), 'yok: ' + b);
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)) if (!/^https?:/.test(m[1])) assert.ok(fs.existsSync(path.join(kok, m[1])), 'yok: ' + m[1]);
  assert.ok(!/type="module"/.test(html));
  assert.equal(betikler[0], 'assets/vendor/rough-4.6.6.js');                       // sabit sürüm, yerel kopya
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[1]), 'dış sunucudan yükleniyor: ' + m[1]);
});

test('yazı tipi yerel: kit/kagit.css Patrick Hand dosyasını gösterir, dosya var', () => {
  const kagit = fs.readFileSync(path.join(kok, 'kit/kagit.css'), 'utf8');
  const m = kagit.match(/@font-face\s*{[^}]*url\('\.\.\/([^']+)'\)/);
  assert.ok(m, '@font-face yok');
  assert.ok(fs.existsSync(path.join(kok, m[1])), 'yazı tipi dosyası yok: ' + m[1]);
});

test('style.css kit\'in renk değişkenlerine yalnız renk verir (ör. --marj bir renktir; sayıyla ezilirse kareli kağıt kaybolur)', () => {
  const kagit = fs.readFileSync(path.join(kok, 'kit/kagit.css'), 'utf8');
  const stil = fs.readFileSync(path.join(kok, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const adlar = [...kagit.match(/:root\s*{([^}]*)}/)[1].matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)]
    .filter((x) => /^(#|rgba?\()/.test(x[2].trim())).map((x) => x[1]);
  assert.ok(adlar.includes('--marj') && adlar.includes('--izgara') && adlar.includes('--kagit'));
  for (const ad of adlar) for (const m of stil.matchAll(new RegExp(`${ad}\\s*:\\s*([^;}]+)`, 'g')))
    assert.match(m[1].trim(), /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i, `style.css ${ad} değişkenine renk olmayan değer veriyor: ${m[1]}`);
});

test('defter katmanları: platformda dış gölge yalnız alttaki yaprakta; ön sayfada iç ışık', () => {
  const stil = fs.readFileSync(path.join(kok, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const kurallar = [...stil.matchAll(/([^{}]+){([^}]*)}/g)].map((m) => [m[1].trim().replace(/\s+/g, ' '), m[2].replace(/\s+/g, ' ')]);
  // Platformun incelenmiş CSS uyarlaması; gerçek cascade, baskı ve mobil
  // görünüm ayrıca tests/browser/materials.spec.ts ile tarayıcıda doğrulanır.
  const govde = (sec) => {
    const kural = kurallar.findLast(([s]) => s === sec);
    assert.ok(kural, 'katman kuralı yok: ' + sec);
    return kural[1];
  };
  const golge = (sec) => govde(sec).match(/box-shadow:\s*([^;]+);/)[1];
  assert.match(govde('.defter::before, .defter::after'), /content:\s*''/);
  assert.match(golge('html:root main.defter::before'), /^16px 28px 40px -6px rgba\(58, 36, 16, \.44\)$/);
  assert.equal(golge('html:root main.defter::after'), 'none');
  assert.match(golge('html:root .sayfa'), /^inset 0 1px 2px rgba\(255, 255, 255, \.85\)$/);
  assert.ok(!kurallar.some(([sec, g]) => /^(?:html:root main\.)?\.?defter$/.test(sec) && /box-shadow/.test(g)), 'kapsayıcıda ikinci gölge var');
  assert.ok(!/drop-shadow/.test(stil));
});

test('üç sayfa aynı kutu: sayfa boyu yalnız --kw/--kh ile, sayfaya özgü boy yok', () => {
  const stil = fs.readFileSync(path.join(kok, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\.sayfa\.(ic|oyun|kart)\s*{[^}]*--k[wh]\s*:/.test(stil), 'sayfaya özgü --kw/--kh var');
  assert.ok(!/height:\s*auto/.test(stil), 'içeriğe göre uzayan sayfa var');
  const ui = fs.readFileSync(path.join(kok, 'ui.js'), 'utf8');
  assert.ok(!/setProperty\('--k[hw]',\s*O\./.test(ui), 'ui.js sayfa boyunu içeriğe göre değiştiriyor');
});

test('index.html: betik sırası bağımlılıklara uyar', () => {
  const sira = (ad) => { const i = betikler.indexOf(ad); assert.ok(i >= 0, 'betik yok: ' + ad); return i; };
  assert.ok(sira('kit/kalem.js') < sira('kit/karakter.js'));
  assert.ok(sira('kit/kalem.js') < sira('draw.js'));
  for (const d of ['data/sozluk.js', 'data/kategoriler.js', 'data/atasozleri.js', 'data/gunluk.js']) assert.ok(sira(d) < sira('ui.js'));
  assert.ok(sira('config.js') < sira('game.js'));
  assert.ok(sira('tr.js') < sira('game.js'));
  assert.ok(sira('config.js') < sira('secici.js'));
  assert.ok(sira('secici.js') < sira('hileci.js'));
  assert.ok(sira('game.js') < sira('modlar.js') && sira('secici.js') < sira('modlar.js'));
  assert.ok(sira('hileci.js') < sira('ui.js') && sira('modlar.js') < sira('ui.js') && sira('kart.js') < sira('ui.js'));
  assert.ok(sira('secici.js') < sira('ui.js'));
  assert.ok(sira('draw.js') < sira('ui.js'));
  assert.ok(sira('layout.js') < sira('ui.js'));
  assert.equal(betikler[betikler.length - 1], 'ui.js');
});

test('ui.js ve draw.js\'in kullandığı kimlikler index.html\'de ya da kodda üretilir', () => {
  const kod = ['ui.js', 'draw.js', 'kart.js'].map((f) => fs.readFileSync(path.join(kok, f), 'utf8')).join('\n');
  const kullanilan = new Set([...kod.matchAll(/\$\('#([a-z0-9-]+)/g)].map((m) => m[1]).concat([...kod.matchAll(/getElementById\('([a-z0-9-]+)'/g)].map((m) => m[1])));
  assert.ok(kullanilan.size >= 12);
  for (const id of kullanilan) {
    const htmlde = new RegExp(`id="${id}"`).test(html);
    const kodda = new RegExp(`(id = '${id}'|id="${id}"|id: '${id}')`).test(kod);
    assert.ok(htmlde || kodda, 'kimlik hiçbir yerde tanımlı değil: #' + id);
  }
});

test('index.html: erişilebilirlik ve telefon ayarları', () => {
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /id="duyuru"[^>]*aria-live="polite"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /Tanımlar: TDK Güncel Türkçe Sözlük/);
});
