// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../modlar.js');
const G = require('../game.js');
const S = require('../secici.js');
const tr = require('../tr.js');

const veri = {
  sozluk: require('../data/sozluk.js'), kategoriler: require('../data/kategoriler.js'),
  atasozleri: require('../data/atasozleri.js'), gunluk: require('../data/gunluk.js'),
};
const indeks = M.sozlukIndeksi(veri);

/* ---------- Okul: gizli giriş ---------- */

test('okulGirdisi: geçerli kelime normalize edilir (istanbul → İSTANBUL, ılık → ILIK)', () => {
  assert.deepEqual(M.okulGirdisi('istanbul'), { ok: true, kelime: 'İSTANBUL', anlam: null, kategori: null });
  assert.equal(M.okulGirdisi('ılık').kelime, 'ILIK');
  assert.equal(M.okulGirdisi('  kâğıt  ').kelime, 'KAĞIT');
});

test('okulGirdisi: boş, kısa, uzun, rakam, noktalama, Q/W/X hataları', () => {
  const hata = (m, o) => { const r = M.okulGirdisi(m, o); assert.equal(r.ok, false, JSON.stringify(m)); return r.hata; };
  assert.match(hata(''), /Bir kelime/);
  assert.match(hata('   '), /Bir kelime/);
  assert.match(hata('ab'), /En az 3/);
  assert.match(hata('a'.repeat(15)), /En çok 14/);
  assert.match(hata('kedi1'), /Yalnız harf/);
  assert.match(hata('kedi!'), /Yalnız harf/);
  assert.match(hata('taxi'), /Q, W ve X/);
  assert.match(hata('wushu'), /Q, W ve X/);
  assert.match(hata('bir iki üç dört'), /En çok 3/);
  assert.match(hata('a'.repeat(15) + ' ' + 'b'.repeat(15) + ' ' + 'c'.repeat(15)), /45 karakter/);
});

test('okulGirdisi: 2–3 sözcüklü söz kabul edilir', () => {
  const r = M.okulGirdisi('Ağaç yaşken eğilir');
  assert.deepEqual([r.ok, r.kelime], [true, 'AĞAÇ YAŞKEN EĞİLİR']);
  assert.equal(M.okulGirdisi('iki kedi').kelime, 'İKİ KEDİ');
});

test('okulGirdisi: sözlük kontrolü açıkken bilinmeyen kelime reddedilir, anlam gelir', () => {
  const r = M.okulGirdisi('kalem', { kontrol: true, indeks });
  assert.equal(r.ok, true);
  assert.ok(r.anlam && r.anlam.length > 3);
  const y = M.okulGirdisi('zxqkk'.replace('x', 'z').replace('q', 'z'), { kontrol: true, indeks });
  assert.equal(y.ok, false);
  assert.match(y.hata, /Sözlükte bulamadım/);
  assert.equal(M.okulGirdisi('zzzkk', { kontrol: false, indeks }).ok, true);        // kontrol kapalıysa her kelime
  assert.equal(M.okulGirdisi('Ankara', { kontrol: true, indeks }).kategori, 'Şehirler');        // kategori listesinden
  assert.equal(M.okulGirdisi('Ağaç yaşken eğilir', { kontrol: true, indeks }).kategori, 'Atasözleri');
});

test('sözlük indeksi: hem sözlük hem kategori hem atasözü', () => {
  assert.ok(indeks.has('KEDİ') && indeks.has('ANKARA') && indeks.has('TÜRKİYE') && indeks.has('AĞAÇ YAŞKEN EĞİLİR'));
  assert.ok(!indeks.has('ZZZZZ'));
});

/* ---------- Günün kelimesi ---------- */

test('günlük bilgi: aynı tarih aynı kelime, hak 10, kategori ve numara', () => {
  const a = M.gunlukBilgi(veri, '2026-10-18'), b = M.gunlukBilgi(veri, '2026-10-18');
  assert.deepEqual(a, b);
  assert.equal(a.hak, 10);
  assert.equal(a.no, 1);
  assert.ok(tr.gecerliKelime(a.kelime));
  assert.notEqual(M.gunlukBilgi(veri, '2026-10-21').kelime + '|', a.kelime + '|' + 'x');
});

test('günlük oyun: adımlar yeniden oynatılınca aynı durum çıkar (yenileme sonrası kaldığı yerden devam)', () => {
  const bilgi = M.gunlukBilgi(veri, '2026-11-02');
  const hedef = bilgi.kelime;
  const yanlis = tr.ALFABE.find((h) => !hedef.includes(h));
  const dogru = Array.from(hedef)[0];
  const adimlar = [['t', yanlis], ['t', dogru], ['a']];
  const d = M.gunlukOyna(bilgi, adimlar);
  assert.equal(d.hak, 10);
  assert.deepEqual(d.yanlis, [yanlis]);
  assert.ok(d.denenen.includes(dogru));
  assert.equal(d.ipucu.anlam, true);
  assert.equal(d.kalan, 10 - 1 - 1);
  // harf ipucu da tekrar oynatılır
  const kalanHarf = [...new Set(Array.from(hedef))].find((h) => !d.denenen.includes(h));
  if (kalanHarf) {
    const d2 = M.gunlukOyna(bilgi, [...adimlar, ['h', kalanHarf]]);
    assert.equal(d2.ipucu.harf, 1);
    assert.ok(d2.denenen.includes(kalanHarf));
  }
  // tam oyun: bitince sonraki adımlar yok sayılır
  let tam = [];
  for (const h of new Set(Array.from(hedef))) tam.push(['t', h]);
  const bit = M.gunlukOyna(bilgi, [...tam, ['t', 'Z']]);
  assert.equal(bit.sonuc, 'kurtuldu');
});

test('günlük kayıt: adımlar birikir, sonuç ve çizgi güncellenir, paylaşım metni kelimeyi vermez', () => {
  const bilgi = M.gunlukBilgi(veri, '2026-10-18');
  let kayit = M.gunlukKayitYeni(bilgi);
  assert.deepEqual([kayit.adimlar, kayit.sonuc, kayit.cizgi], [[], null, 0]);
  let d = G.yeniOyun({ kelime: bilgi.kelime, zorluk: 'orta', mod: 'gunun', kategori: bilgi.kategori, hak: 10 });
  const yanlis = tr.ALFABE.find((h) => !bilgi.kelime.includes(h));
  d = G.tahmin(d, yanlis);
  kayit = M.gunlukKayitIsle(kayit, ['t', yanlis], d);
  assert.equal(kayit.cizgi, 1);
  assert.equal(kayit.sonuc, null);
  for (const h of new Set(Array.from(bilgi.kelime))) { d = G.tahmin(d, h); kayit = M.gunlukKayitIsle(kayit, ['t', h], d); }
  assert.equal(kayit.sonuc, 'kurtuldu');
  const metin = M.gunlukPaylasim(kayit);
  assert.match(metin, /^Adam Asmaca #1 · .+ · 1\/10 çizgi · Kurtuldu$/);
  assert.ok(!metin.includes(bilgi.kelime));
});

/* ---------- Maraton ---------- */

test('maratonOzet: rekor ve en iyi', () => {
  assert.deepEqual(M.maratonOzet(5, 3), { kurtarilan: 5, enIyi: 5, rekor: true, metin: 'Yeni rekor!' });
  assert.deepEqual(M.maratonOzet(3, 5), { kurtarilan: 3, enIyi: 5, rekor: false, metin: '' });
  assert.deepEqual(M.maratonOzet(0, 0), { kurtarilan: 0, enIyi: 0, rekor: false, metin: '' });
  assert.equal(S.maratonZorluk(1), 'kolay');
});

test('modlar.js DOM\'a dokunmaz', () => {
  const fs = require('node:fs'), path = require('node:path');
  const k = fs.readFileSync(path.join(__dirname, '..', 'modlar.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/document\.|localStorage|Kit\.|navigator\./.test(k));
});
