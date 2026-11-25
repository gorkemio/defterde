const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const kok = path.join(__dirname, '..');
const oku = (p) => fs.readFileSync(path.join(kok, p));

test('KT1 kopyalanan kit dosyaları kaynaklarıyla birebir (eski oyunlar kırılmaz)', () => {
  const nokta = path.join(kok, '../noktaoyunu/kit'), kibrit = path.join(kok, '../kibrit/kit');
  if (!fs.existsSync(nokta) || !fs.existsSync(kibrit)) return;   // kardeş klasörler yoksa atla
  for (const f of ['kagit.css', 'kursunkalem.css', 'kuruboya.css', 'kecelikalem.css', 'kecelikalem.js', 'karakter.js', 'malzeme.js', 'ses.js', 'kursunkalem.js', 'kuruboya.js', 'gren.png'])
    assert.ok(oku('kit/' + f).equals(fs.readFileSync(path.join(nokta, f))), f);
  for (const f of ['kalem.js', 'rakam.js']) assert.ok(oku('kit/' + f).equals(fs.readFileSync(path.join(kibrit, f))), f);
});

test('KT2 index.html: dış adres yok, ES modülü yok, rough.js yerel ve sabit sürüm; bütün betikler var', () => {
  const h = oku('index.html').toString();
  assert.ok(!/(src|href)=["']https?:/i.test(h), 'dış adres');
  assert.ok(!/type=["']module["']/.test(h), 'ES modülü');
  assert.match(h, /assets\/vendor\/rough-4\.6\.6\.js/);
  for (const m of h.matchAll(/(?:src|href)="([^"?#]+)/g)) if (!m[1].startsWith('data:')) assert.ok(fs.existsSync(path.join(kok, m[1])), m[1]);
});

test('KT3 nonogram/ ve kit/bulmaca/ DOM\'a dokunmaz', () => {
  for (const d of ['nonogram', 'kit/bulmaca']) for (const f of fs.readdirSync(path.join(kok, d))) {
    const s = oku(path.join(d, f)).toString();
    assert.ok(!/document\.|getContext|addEventListener\(['"](click|pointer)/.test(s.replace(/typeof document[^;]*;/g, '')) || f === 'sure.js', `${d}/${f}`);
  }
});

test('KT4 font Türkçe karakterleri içerir', () => {
  const b = oku('assets/fonts/ArchitectsDaughter-Regular.ttf'), n = b.readUInt16BE(4);
  let cmap; for (let i = 0; i < n; i++) { const o = 12 + 16 * i; if (b.toString('ascii', o, o + 4) === 'cmap') cmap = b.readUInt32BE(o + 8); }
  const set = new Set(), nt = b.readUInt16BE(cmap + 2);
  for (let i = 0; i < nt; i++) {
    const off = cmap + b.readUInt32BE(cmap + 4 + 8 * i + 4);
    if (b.readUInt16BE(off) !== 4) continue;
    const s2 = b.readUInt16BE(off + 6), e = off + 14, st = e + s2 + 2, dl = st + s2, ro = dl + s2;
    for (let k = 0; k < s2 / 2; k++) { const a = b.readUInt16BE(st + 2 * k), z = b.readUInt16BE(e + 2 * k); for (let c = a; c <= z && c < 0xffff; c++) set.add(c); }
    void ro;
  }
  for (const ch of 'İıŞşĞğÇçÖöÜü×·') assert.ok(set.has(ch.codePointAt(0)), ch);
});
