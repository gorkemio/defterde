const test = require('node:test');
const assert = require('node:assert/strict');
const { Depo } = require('../kit/bulmaca/depo.js');
const { Izgara } = require('../kit/bulmaca/izgara.js');
const { Gecmis } = require('../kit/bulmaca/gecmis.js');
const G = require('../kit/bulmaca/gunluk.js');
const { Album } = require('../kit/bulmaca/album.js');
const { uret } = require('../kit/bulmaca/uretici.js');
const { Kronometre } = require('../kit/bulmaca/sure.js');

function sahteDepo() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } }; }

test('B1 depo: zarf, önek, bozuk veri, bellek yedeği', () => {
  const ls = sahteDepo(), d = Depo('kk-', ls);
  d.yaz('ayar', { mod: 'rahat' });
  assert.deepEqual(d.oku('ayar'), { mod: 'rahat' });
  assert.ok(ls.getItem('kk-ayar').includes('"surum":1'));
  ls.setItem('kk-bozuk', '{x');
  assert.equal(d.oku('bozuk', 5), 5);
  d.yaz('durum-a', 1); d.yaz('durum-b', 2);
  assert.deepEqual(d.anahtarlar('durum-'), ['durum-a', 'durum-b']);
  const atan = { getItem() { throw new Error('yasak'); }, setItem() { throw new Error('yasak'); }, removeItem() {}, key() {}, length: 0 };
  const d2 = Depo('kk-', atan);
  d2.yaz('x', 3);
  assert.equal(d2.oku('x'), 3, 'bellekte kalır');
});

test('B2 ızgara ve geçmiş: sürükleme tek işlem, sınırsız geri al/yinele', () => {
  const g = Izgara(5, 4);
  assert.equal(g.koy(1, 2, 1), true); assert.equal(g.koy(1, 2, 1), false);
  const k = Izgara.oku(g.yaz());
  assert.deepEqual(Array.from(k.veri), Array.from(g.veri));
  const h = Gecmis();
  assert.equal(h.islem([{ i: 0, eski: 0, yeni: 0 }]), false, 'değişmeyen işlem kaydedilmez');
  h.islem([{ i: 0, eski: 0, yeni: 1 }, { i: 1, eski: 0, yeni: 1 }], 'surukle');
  h.islem([{ i: 2, eski: 0, yeni: 2 }]);
  assert.deepEqual(h.geriAl(), [{ i: 2, deger: 0 }]);
  assert.deepEqual(h.geriAl(), [{ i: 1, deger: 0 }, { i: 0, deger: 0 }]);
  assert.equal(h.geriAl(), null);
  assert.deepEqual(h.yinele(), [{ i: 0, deger: 1 }, { i: 1, deger: 1 }]);
  h.islem([{ i: 3, eski: 0, yeni: 1 }]);
  assert.equal(h.yinele(), null, 'yeni işlem yinele yığınını siler');
  for (let i = 0; i < 1000; i++) h.islem([{ i, eski: 0, yeni: 1 }]);
  assert.equal(h.uzunluk, 1002);
  const h2 = Gecmis(h.yaz());
  assert.ok(h2.geriVar);
});

test('B3 günlük: İstanbul tarihi ve gün sınırı', () => {
  assert.equal(G.istanbulTarih(new Date('2026-10-20T20:59:59Z')), '2026-10-20');
  assert.equal(G.istanbulTarih(new Date('2026-10-20T21:00:00Z')), '2026-10-21');
  assert.equal(G.haftaGunu('2026-10-19'), 1);
  assert.equal(G.haftaGunu('2026-10-25'), 0);
  assert.equal(G.gunNo('2026-10-21', '2026-10-19'), 3);
  assert.equal(G.tarihYazi('2026-10-20'), '20 Ekim');
  assert.equal(G.sonrakiGuneKalanMs(new Date('2026-10-20T20:59:00Z')), 60000);
});

test('B4 seri ve paylaşım metni', () => {
  assert.equal(G.seri(['2026-10-18', '2026-10-19', '2026-10-20'], '2026-10-21'), 3, 'bugün çözülmedi: kırılmaz');
  assert.equal(G.seri(['2026-10-18', '2026-10-19', '2026-10-21'], '2026-10-21'), 1);
  assert.equal(G.enUzunSeri(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']), 3);
  assert.equal(G.paylasimMetni(['Kare Karalamaca', '20 Ekim', '15×15', G.sureYazi(402000), 'hatasız']), 'Kare Karalamaca · 20 Ekim · 15×15 · 6:42 · hatasız');
});

test('B5 albüm', () => {
  const a = Album(Depo('t-', sahteDepo()));
  a.kaydet('mutfak', 'simit', { sure: 50000, hata: 0, ipucu: 0, tarih: '2026-10-20' });
  a.kaydet('mutfak', 'simit', { sure: 40000, hata: 1, ipucu: 0, tarih: '2026-10-21' });
  assert.equal(a.kayit('simit').kez, 2); assert.equal(a.kayit('simit').enIyiSure, 40000);
  assert.deepEqual(a.ozet('mutfak', 6), { cozulen: 1, toplam: 6 });
  assert.equal(a.istatistik().oynanan, 2);
});

test('B6 kronometre', () => {
  const k = Kronometre(1000);
  assert.equal(k.ms(), 1000);
  k.baslat(); k.duraklat();
  assert.ok(k.ms() >= 1000);
});

test('B7 üretici: hedef bant, yoksa en yakın', () => {
  const sira = ['zor', 'kolay', 'orta'];
  const r = uret({ tohum: 's', aday: (t, i) => ({ i }), derece: (b) => ({ bant: sira[b.i % 3], puan: b.i }), hedefBant: 'orta' });
  assert.equal(r.derece.bant, 'orta'); assert.equal(r.deneme, 3);
  const r2 = uret({ tohum: 's', aday: (t, i) => ({ i }), derece: () => ({ bant: 'kolay', puan: 1 }), hedefBant: 'zor', enCokDeneme: 10 });
  assert.equal(r2.derece.bant, 'kolay');
});
