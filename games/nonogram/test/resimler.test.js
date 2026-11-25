const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../nonogram/model.js');
const S = require('../nonogram/solver.js');
const D = require('../nonogram/difficulty.js');
const K = require('../nonogram/kilim.js');

const kok = path.join(__dirname, '..');
function yukle() {
  const ctx = {}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(kok, 'data/defterler.js'), 'utf8'), ctx);
  for (const f of fs.readdirSync(path.join(kok, 'data/resimler')).sort()) vm.runInContext(fs.readFileSync(path.join(kok, 'data/resimler', f), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(kok, 'data/hesap.js'), 'utf8'), ctx);
  const liste = [];
  for (const d of ctx.KK_DEFTERLER) for (const r of ctx.KK_RESIMLER[d.id] || []) liste.push(r);
  return { defterler: ctx.KK_DEFTERLER, liste, hesap: ctx.KK_HESAP };
}
const V = yukle();
const bulmaca = (r) => M.bulmacaYap({ id: r.id, en: r.en, boy: r.boy, satirlar: r.satirlar, baslangic: (V.hesap[r.id] || {}).baslangic || [] });
const RENK = ['siyah', 'gri', 'kahve', 'kirmizi', 'turuncu', 'hardal', 'acikyesil', 'koyuyesil', 'acikmavi', 'lacivert', 'mor', 'pembe'];

test('R1 bütün resimler (gerekirse başlangıç kareleriyle) tek çözümlü ve tahminsiz', () => {
  for (const r of V.liste) {
    const b = bulmaca(r);
    const t = S.tekillik(b, { dugumButcesi: 60000 });
    assert.equal(t.sonuc, 'tek', r.id);
    assert.notEqual(D.derece(b).bant, 'tahmin', r.id);
  }
});

test('R2 her resmin bandı hesap.js ile aynı ve boyuna uygun (5×5 kolay … 25×25 en çok uzman); defterde kolaydan zora', () => {
  const hedef = (r) => { const n = Math.max(r.en, r.boy); return n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : 3; };
  for (const r of V.liste) {
    const h = V.hesap[r.id], d = D.derece(bulmaca(r));
    assert.ok(h, `${r.id} hesap.js'te yok`);
    assert.equal(d.bant, h.bant, r.id);
    assert.equal(d.puan, h.puan, r.id);
    assert.ok(D.BANTLAR.indexOf(d.bant) <= hedef(r), `${r.id} ${d.bant}`);
  }
});

test('R3 biçim: boyut, palet, harfler, benzersiz id, Türkçe ad, bilinen kategori; yasak konu yok', () => {
  const idler = new Set(), kat = new Set(V.defterler.map(d => d.id));
  for (const r of V.liste) {
    assert.match(r.id, /^[a-z0-9-]+$/, r.id);
    assert.ok(!idler.has(r.id), `${r.id} tekrar`); idler.add(r.id);
    assert.match(r.ad, /^[A-ZÇĞİÖŞÜ]/, r.id);
    assert.ok(kat.has(r.kategori), r.id);
    assert.equal(r.satirlar.length, r.boy, r.id);
    for (const s of r.satirlar) { assert.equal(s.length, r.en, r.id); for (const ch of s) assert.ok(ch === '.' || (r.palet[ch] && RENK.includes(r.palet[ch])), `${r.id} "${ch}"`); }
    assert.ok(!/bayrak|logo|marka|cami|kilise|haç|hilal|harita/i.test(r.ad + ' ' + (r.not || '')), `${r.id}: yasak konu`);
  }
});

test('R4 hedef sayılar: 150 resim (20 × 5×5, 35 × 10×10, 45 × 15×15, 30 × 20×20, 20 × 25×25) ve dikdörtgenler', () => {
  const say = {};
  for (const r of V.liste) { const k = `${r.en}x${r.boy}`; say[k] = (say[k] || 0) + 1; }
  assert.ok(say['5x5'] >= 20, JSON.stringify(say)); assert.ok(say['10x10'] >= 35); assert.ok(say['15x15'] >= 45);
  assert.ok(say['20x20'] >= 30); assert.ok(say['25x25'] >= 20);
  assert.ok(say['10x15'] >= 4 && say['15x20'] >= 4, 'günlük takvim için dikdörtgenler');
  for (const d of V.defterler) assert.ok(V.liste.filter(r => r.kategori === d.id).length >= 15, d.id);
});

test('R5 hesap.js güncel (imza = boyut + satırlar)', () => {
  for (const r of V.liste) assert.equal(V.hesap[r.id].imza, K.karma('resim', r.en, r.boy, r.satirlar.join('/')).toString(36), `${r.id}: npm run resimler`);
});
