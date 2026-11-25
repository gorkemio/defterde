// node --test — engine/game.js: geri bildirim (tekrar eden harfler, I/İ), kurallar, zor mod, kaydet/yükle, paylaşım
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../engine/game.js');

const { YOK: Y, YANLIS_YER: W, DOGRU: D } = G;
const KUME = new Set(['KALEM', 'KAZAK', 'KAPAK', 'AAAAA', 'AKAKA', 'ARMUT', 'MELEK', 'IRMAK', 'İRMİK', 'KARAR', 'KAYAK', 'SALON', 'BALIK', 'KALAY', 'KEMAL']);

test('brief örnekleri: KALEM ← KAZAK, KAPAK ← AAAAA, KAPAK ← AKAKA', () => {
  assert.deepEqual(G.geriBildirim('KAZAK', 'KALEM'), [D, D, Y, Y, Y]);
  assert.deepEqual(G.geriBildirim('AAAAA', 'KAPAK'), [Y, D, Y, D, Y]);
  assert.deepEqual(G.geriBildirim('AKAKA', 'KAPAK'), [W, W, W, W, Y]);
});

test('tekrar eden harfler: doğru yer önce sayılır, fazlası yok', () => {
  assert.deepEqual(G.geriBildirim('AABAA', 'AAABC'), [D, D, W, W, Y]);
  assert.deepEqual(G.geriBildirim('MELEK', 'KALEM'), [W, Y, D, D, W]);
  assert.deepEqual(G.geriBildirim('KARAR', 'KAYAK'), [D, D, Y, D, Y]);
  assert.deepEqual(G.geriBildirim('KALEM', 'KALEM'), [D, D, D, D, D]);
});

test('I ile İ karışmaz (küçük harf girdi tr-TR ile büyütülür)', () => {
  assert.deepEqual(G.geriBildirim('İRMİK', 'IRMAK'), [Y, D, D, Y, D]);
  assert.deepEqual(G.geriBildirim('ırmak', 'IRMAK'), [D, D, D, D, D]);
  assert.deepEqual(G.geriBildirim('irmik', 'İRMİK'), [D, D, D, D, D]);
  assert.notDeepEqual(G.geriBildirim('irmak', 'IRMAK'), [D, D, D, D, D]);
});

test('kurallar: geçersiz kelime hak saymaz, 6 hak, kazanma', () => {
  let d = G.yeni({ cevap: 'KALEM', no: 1, tarih: '2026-10-20' });
  assert.equal(G.tahminEt(d, 'KAL', KUME).hata, 'kisa');
  assert.equal(G.tahminEt(d, 'KALEX', KUME).hata, 'listede-yok');
  assert.equal(G.tahminEt(d, 'ZZZZZ', KUME).hata, 'listede-yok');
  assert.equal(d.tahminler.length, 0);
  for (const k of ['ARMUT', 'MELEK', 'KAZAK', 'KAPAK', 'SALON']) d = G.tahminEt(d, k, KUME).durum;
  assert.equal(d.sonuc, null);
  d = G.tahminEt(d, 'BALIK', KUME).durum;
  assert.equal(d.sonuc, 'kaybetti');
  assert.equal(G.tahminEt(d, 'KALEM', KUME).hata, 'bitti');
  let k = G.yeni({ cevap: 'KALEM' });
  k = G.tahminEt(k, 'ARMUT', KUME).durum;
  k = G.tahminEt(k, 'kalem', KUME).durum;
  assert.equal(k.sonuc, 'kazandi');
  assert.equal(k.tahminler.length, 2);
});

test('zor mod: doğru yer aynı yerde, yanlış yer kullanılmalı; bozulan kural yazılır', () => {
  let d = G.yeni({ cevap: 'KALEM', zor: true });
  d = G.tahminEt(d, 'KAZAK', KUME).durum;                    // K, A doğru yerde
  let r = G.tahminEt(d, 'SALON', KUME);
  assert.equal(r.hata, 'zor');
  assert.equal(r.kural, 'yer');
  assert.equal(r.mesaj, '1. harf K olmalı');
  assert.ok(!G.tahminEt(d, 'KALAY', KUME).hata);
  let e = G.yeni({ cevap: 'KALEM', zor: true });
  e = G.tahminEt(e, 'ARMUT', KUME).durum;                    // A ve M yanlış yerde
  r = G.tahminEt(e, 'KAZAK', KUME);
  assert.equal(r.kural, 'harf');
  assert.equal(r.mesaj, 'M harfini kullanmalısın');
  assert.ok(!G.tahminEt(e, 'KEMAL', KUME).hata);
  // tekrar eden harf sayısı: AKAKA ← KAPAK'tan sonra iki K ve iki A gerekir
  assert.deepEqual(G.zorModKontrol('KALEM', [{ kelime: 'AKAKA', sonuc: [W, W, W, W, Y] }]), { kural: 'harf', harf: 'A', sayi: 2, mesaj: 'A harfi 2 kez olmalı' });
  assert.equal(G.zorModKontrol('KAPAK', [{ kelime: 'AKAKA', sonuc: [W, W, W, W, Y] }]), null);
  const kolay = G.tahminEt(G.tahminEt(G.yeni({ cevap: 'KALEM' }), 'KAZAK', KUME).durum, 'SALON', KUME);
  assert.ok(!kolay.hata, 'zor mod kapalıyken kural yok');
});

test('oyun durumu kaydedilip geri yüklenir; bozuk ya da tutarsız kayıt reddedilir', () => {
  let d = G.yeni({ mod: 'gunun', cevap: 'KALEM', no: 3, tarih: '2026-10-22', zor: true });
  d = G.tahminEt(d, 'KAZAK', KUME).durum;
  d = G.tahminEt(d, 'KALAY', KUME).durum;
  const geri = G.yukle(G.kaydet(d));
  assert.deepEqual(geri, d);
  assert.equal(G.tahminEt(geri, 'KALEM', KUME).durum.sonuc, 'kazandi');
  assert.equal(G.yukle('{bozuk'), null);
  assert.equal(G.yukle(JSON.stringify({ ...d, surum: 99 })), null);
  assert.equal(G.yukle(JSON.stringify({ ...d, tahminler: [{ kelime: 'KAZAK', sonuc: [2, 2, 2, 2, 2] }] })), null);
  assert.equal(G.yukle(JSON.stringify({ ...d, cevap: 'KAL' })), null);
});

test('klavye durumları: en iyi işaret kalır', () => {
  let d = G.yeni({ cevap: 'KALEM' });
  for (const k of ['ARMUT', 'MELEK', 'KAZAK']) d = G.tahminEt(d, k, KUME).durum;
  const m = G.tusDurumlari(d.tahminler);
  assert.equal(m.get('A'), 'd');
  assert.equal(m.get('M'), 'y');
  assert.equal(m.get('K'), 'd');
  assert.equal(m.get('R'), 'x');
  assert.equal(m.get('Z'), 'x');
});

test('paylaşım metni: oyunun işaretleri, zor modda *, cevap geçmez', () => {
  let d = G.yeni({ mod: 'gunun', cevap: 'KALEM', no: 12 });
  for (const k of ['ARMUT', 'MELEK', 'KAZAK', 'KALEM']) d = G.tahminEt(d, k, KUME).durum;
  assert.equal(G.paylasimMetni(d), 'Beş Harf No. 12 · 4/6\n▧□▧□□\n▧□▩▩▧\n▩▩□□□\n▩▩▩▩▩');
  assert.equal(G.paylasimMetni(d, { renkli: true }).split('\n')[4], '🟩🟩🟩🟩🟩');
  assert.ok(G.paylasimMetni(Object.assign({}, d, { zor: true })).startsWith('Beş Harf No. 12 · 4/6*'));
  assert.ok(!G.paylasimMetni(d).includes('KALEM'));
  const kayip = Object.assign({}, d, { sonuc: 'kaybetti' });
  assert.ok(G.paylasimMetni(kayip).startsWith('Beş Harf No. 12 · X/6'));
  assert.ok(G.paylasimMetni(Object.assign({}, d, { mod: 'serbest' })).startsWith('Beş Harf · serbest · 4/6'));
});

test('engine/ dosyaları DOM, localStorage, Kit ya da navigator kullanmaz', () => {
  const kok = path.join(__dirname, '..', 'engine');
  for (const f of fs.readdirSync(kok)) {
    const metin = fs.readFileSync(path.join(kok, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const yasak of ['document.', 'localStorage', 'Kit.', 'navigator.', 'sessionStorage'])
      assert.ok(!metin.includes(yasak) || (yasak === 'Kit.' && /window\.Kit\.tr/.test(metin) && !metin.replace(/window\.Kit\.tr/g, '').includes('Kit.')), `${f}: ${yasak}`);
  }
});

test('arkadaş bağlantısı: kodla/çöz tur dönüşü, I/İ, bozuk link reddedilir, kelime okunmaz', () => {
  for (const k of ['KALEM', 'IRMAK', 'İRMİK', 'ŞARKI', 'ÇÖZÜM', 'ĞĞĞĞĞ', 'ZZZZZ', 'AAAAA']) {
    const kod = G.linkKodla(k);
    assert.match(kod, /^[0-9a-s]{6}$/);
    assert.equal(G.linkCoz(kod), k);
    assert.ok(!kod.toUpperCase().includes(k));
  }
  assert.notEqual(G.linkKodla('IRMAK'), G.linkKodla('İRMAK'));
  const kod = G.linkKodla('KALEM');
  assert.equal(G.linkCoz(kod.slice(0, 5) + (kod[5] === '0' ? '1' : '0')), null);       // denetim karakteri
  assert.equal(G.linkCoz('abc'), null);
  assert.equal(G.linkCoz('zzzzzz'), null);
  assert.equal(G.linkCoz(null), null);
  assert.equal(G.linkKodla('KALE'), null);
});
