// node --test — ses sentezleri tarayıcı olmadan sahte bir bağlamla sınanır; çağrılan her ses adının tanımlı olduğu denetlenir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kok = path.join(__dirname, '..');
const oku = (f) => fs.readFileSync(path.join(kok, f), 'utf8');

// kit/ses.js'in ortak sentezleri (S.sentez = { kalem(c, h, t0) {...}, ... }) ve sesler.js'in eklediği (S.sentez.ip = ...)
const kitAdlari = [...oku('kit/ses.js').matchAll(/^\s{4}(\w+)\(c, h, t0\)/gm)].map((m) => m[1]);
const eklenen = [...oku('sesler.js').matchAll(/S\.sentez\.(\w+) = /g)].map((m) => m[1]);
const tanimli = new Set([...kitAdlari, ...eklenen]);

test('ortak ve oyuna özgü sentezler bulunuyor', () => {
  for (const a of ['kalem', 'cit', 'kazan']) assert.ok(kitAdlari.includes(a), a);
  assert.deepEqual(eklenen.sort(), ['adim', 'cevir', 'hehe', 'ip']);
});

test('kodda çağrılan her ses adı tanımlı', () => {
  const kod = ['ui.js', 'draw.js'].map(oku).join('\n');
  const cagrilan = new Set([...kod.matchAll(/\bses\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(cagrilan.size >= 7, 'çağrı sayısı: ' + cagrilan.size);
  for (const a of cagrilan) assert.ok(tanimli.has(a), 'tanımsız ses: ' + a);
  // kullanıma hazır olmayan ses oyunu durdurmaz: ui.js'te yakalanır
  assert.match(oku('ui.js'), /const ses = \(adi, ms = 0\) => \{ try \{/);
});

test('sesler.js: her sentez sahte bağlamda hatasız çalışır, beklenen sayıda nota ve gürültü üretir', () => {
  const nota = [], parazit = [];
  const S = { sentez: {}, nota: (...a) => nota.push(a), parazit: (...a) => parazit.push(a) };
  const pencere = { Kit: { ses: S } };
  new Function('window', oku('sesler.js'))(pencere);
  const say = (ad) => { nota.length = 0; parazit.length = 0; S.sentez[ad]({}, {}, 1.5); return [nota.length, parazit.length]; };
  assert.deepEqual(say('ip'), [1, 1]);
  assert.deepEqual(say('adim'), [8, 8]);
  assert.deepEqual(say('cevir'), [0, 2]);
  assert.deepEqual(say('hehe'), [4, 0]);
  // adımlar ~0,9 sn'ye yayılır ve koşu animasyonundan (1 sn) uzun sürmez
  say('adim');
  const zamanlar = nota.map((n) => n[2]);
  assert.ok(Math.max(...zamanlar) - Math.min(...zamanlar) < 1.0);
  // süreler ve ses seviyeleri makul: hiçbir nota 1 sn'den uzun ya da 0,5'ten gür değil
  for (const ad of ['ip', 'adim', 'cevir', 'hehe']) { say(ad); for (const n of nota) { assert.ok(n[6] <= 1 && n[7] <= 0.5, ad); } }
});

test('Kit.ses yoksa sesler.js sessizce çıkar (oyun yine çalışır)', () => {
  assert.doesNotThrow(() => new Function('window', oku('sesler.js'))({}));
});

test('index.html: ses betikleri ui.js\'ten önce ve doğru sırada; ses düğmesi var', () => {
  const html = oku('index.html');
  const b = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].replace(/\?v=[0-9a-f]+$/, ''));
  assert.ok(b.indexOf('kit/ses.js') >= 0 && b.indexOf('kit/ses.js') < b.indexOf('sesler.js') && b.indexOf('sesler.js') < b.indexOf('ui.js'));
  assert.match(html, /id="ses-oyun"/);
  assert.match(html, /id="ses-ic"/);
  assert.match(html, /id="ses-kart"/);
  assert.match(oku('ui.js'), /kur\(\{ anahtar: 'aa-sessiz' \}\)/);                   // sessiz ayarı saklanır
});
