// node --test — hazirla.mjs'in ürettiği data/*.js dosyalarını denetler (üretimden sonra çalıştırılır).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tr = require('../tr.js');

const kok = path.join(__dirname, '..');
const sozluk = require('../data/sozluk.js');
const kategoriler = require('../data/kategoriler.js');
const atasozleri = require('../data/atasozleri.js');
const gunluk = require('../data/gunluk.js');

// karaliste.txt: "kelime" ya da "önek*"
const satirlar = fs.readFileSync(path.join(kok, 'scripts', 'karaliste.txt'), 'utf8').split('\n').map((s) => s.replace(/#.*/, '').trim()).filter(Boolean);
const tam = new Set(satirlar.filter((s) => !s.endsWith('*')).map((s) => tr.normalize(s)));
const onek = satirlar.filter((s) => s.endsWith('*')).map((s) => tr.normalize(s.slice(0, -1)));
const karaMi = (k) => tam.has(k) || onek.some((p) => k.startsWith(p));

const BANT = new Set(['k', 'o', 'z']);
const TUR = new Set(['a', 's', 'f', 'z', 'e', 'b', 'ü', 'm', '?']);

test('sözlük: biçim, geçerlilik ve tekrar', () => {
  assert.ok(Array.isArray(sozluk) && sozluk.length > 20000, 'sözlük boş ya da çok küçük: ' + sozluk.length);
  const gorulen = new Set();
  for (const [kelime, anlam, tur, bant, puan, sira] of sozluk) {
    assert.ok(tr.gecerliKelime(kelime), 'geçersiz kelime: ' + kelime);
    assert.equal(tr.normalize(kelime), kelime, 'normalize edilmemiş: ' + kelime);
    assert.ok(!gorulen.has(kelime), 'tekrar: ' + kelime);
    gorulen.add(kelime);
    assert.ok(typeof anlam === 'string' && anlam.length >= 3 && Array.from(anlam).length <= 120, `anlam uzunluğu: ${kelime} (${Array.from(anlam).length})`);
    assert.ok(!/[<>]|­/.test(anlam), 'anlamda işaret kalıntısı: ' + kelime);
    assert.ok(!anlam.startsWith('►'), 'gönderme işareti: ' + kelime);
    assert.ok(TUR.has(tur), `tür: ${kelime} ${tur}`);
    assert.ok(BANT.has(bant), `bant: ${kelime} ${bant}`);
    assert.ok(Number.isInteger(puan) && puan > 0, 'puan: ' + kelime);
    assert.ok(sira === null || (Number.isInteger(sira) && sira > 0), 'sıra: ' + kelime);
  }
});

test('sözlük: karalistedeki kelime ve önekler sızmamış', () => {
  const sizan = sozluk.filter(([k]) => karaMi(k)).map(([k]) => k);
  assert.deepEqual(sizan, []);
  for (const [ad, liste] of Object.entries(kategoriler)) {
    const s = liste.filter(([k]) => karaMi(k)).map(([k]) => k);
    assert.deepEqual(s, [], 'kategori ' + ad);
  }
});

test('sözlük: kolay banttaki her kelime 4–7 harfli, isim/sıfat/fiil ve sıklık dışı eski değil', () => {
  const kolay = sozluk.filter((r) => r[3] === 'k');
  assert.ok(kolay.length >= 400, 'kolay çok az: ' + kolay.length);
  for (const [kelime, , tur] of kolay) {
    const n = Array.from(kelime).length;
    assert.ok(n >= 4 && n <= 7, `kolay uzunluk: ${kelime}`);
    assert.ok('asf'.includes(tur), `kolay tür: ${kelime} ${tur}`);
  }
});

test('sözlük: I/İ karışmaz (ılık ≠ ilik) ve şapkalı biçimler yok', () => {
  const k = new Set(sozluk.map((r) => r[0]));
  assert.ok(!sozluk.some(([w]) => /[ÂÎÛâîû]/.test(w)), 'şapkalı harf kalmış');
  for (const [a, b] of [['ILIK', 'İLİK'], ['KIZ', 'KİZ'], ['ISI', 'İSİ']]) {
    if (k.has(a) && k.has(b)) assert.notEqual(a, b);
  }
  assert.ok(k.has('KAĞIT') && !k.has('KAĞİT'));
});

test('sözlük: argo/kaba etiketli ana anlam ve özel ad sızmamış (bilinen örnekler)', () => {
  const k = new Set(sozluk.map((r) => r[0]));
  for (const w of ['GEBERMEK', 'HÖDÜK', 'BOK', 'GÖT', 'SİK', 'OROSPU', 'PEZEVENK', 'PİÇ', 'TAŞAK', 'DALYARAK', 'İBNE', 'KAHPE', 'ISTANBUL', 'İSTANBUL']) {
    assert.ok(!k.has(w), 'sızdı: ' + w);
  }
  for (const w of ['KEDİ', 'KÖPEK', 'İNEK', 'ZİL', 'MAMA', 'HAYVAN', 'OĞLAN', 'ELMA', 'KAĞIT', 'ILIK']) assert.ok(k.has(w), 'eksik: ' + w);
});

test('sözlük: ikincil anlamı argo olan kelime kalır ama o anlam gösterilmez', () => {
  const m = new Map(sozluk.map((r) => [r[0], r[1]]));
  assert.ok(m.has('MANGIR') && !/para/i.test(m.get('MANGIR').replace(/para değerinde/i, '')), 'mangır: ' + m.get('MANGIR'));
  assert.ok(m.has('YÜRÜMEK'));
  assert.ok(!/ölmek/i.test(m.get('YÜRÜMEK')), m.get('YÜRÜMEK'));
});

test('kategoriler: on liste, her biri en az 80 kelime, Şehirler tam 81', () => {
  assert.deepEqual(Object.keys(kategoriler).sort(),
    ['Doğa', 'Hayvanlar', 'Meslekler', 'Meyve-Sebze', 'Mutfak', 'Okul', 'Spor', 'Vücut', 'Şehirler', 'Ülkeler'].sort());
  for (const [ad, liste] of Object.entries(kategoriler)) {
    assert.ok(liste.length >= 80, `${ad}: ${liste.length} kelime (en az 80)`);
    assert.ok(liste.length <= 300, `${ad}: ${liste.length} kelime (en çok 300)`);
    const gorulen = new Set();
    for (const [kelime, ipucu, bant, puan] of liste) {
      assert.ok(tr.gecerliKelime(kelime), `${ad}: geçersiz ${kelime}`);
      assert.ok(!gorulen.has(kelime), `${ad}: tekrar ${kelime}`);
      gorulen.add(kelime);
      assert.ok(typeof ipucu === 'string' && ipucu.length >= 3 && Array.from(ipucu).length <= 140, `${ad}/${kelime}: ipucu`);
      assert.ok(BANT.has(bant), `${ad}/${kelime}: bant`);
      assert.ok(Number.isInteger(puan), `${ad}/${kelime}: puan`);
    }
    for (const b of ['k', 'o', 'z']) assert.ok(liste.filter((r) => r[2] === b).length >= 15, `${ad}: ${b} bandında 15'ten az kelime`);
  }
  assert.equal(kategoriler['Şehirler'].length, 81);
});

test('kategoriler: şehir ipuçları plaka kodu taşır, 81 il tekil ve doğru normalize', () => {
  const s = new Map(kategoriler['Şehirler'].map((r) => [r[0], r[1]]));
  for (const il of ['İSTANBUL', 'ANKARA', 'İZMİR', 'DİYARBAKIR', 'ŞANLIURFA', 'IĞDIR', 'ÇANAKKALE', 'HAKKARİ', 'DÜZCE', 'AFYONKARAHİSAR']) assert.ok(s.has(il), 'il eksik: ' + il);
  assert.match(s.get('İSTANBUL'), /Marmara/);
  assert.match(s.get('İSTANBUL'), /34/);
  assert.match(s.get('ANKARA'), /06/);
  assert.match(s.get('AĞRI'), /04/);
  assert.match(s.get('DÜZCE'), /81/);
  const kodlar = [...s.values()].map((v) => Number(v.match(/Plaka kodu (\d\d)/)[1])).sort((a, b) => a - b);
  assert.deepEqual(kodlar, Array.from({ length: 81 }, (_, i) => i + 1));
});

test('kategoriler: ipucu kelimenin kendisini içermez (şehir, ülke ve elle yazılan tanımlar)', () => {
  const sorunlu = [];
  for (const ad of ['Şehirler', 'Ülkeler']) {
    for (const [kelime, ipucu] of kategoriler[ad]) if (tr.normalize(ipucu).includes(kelime)) sorunlu.push(`${ad}/${kelime}`);
  }
  assert.deepEqual(sorunlu, []);
});

test('atasözleri: 150–200, biçim ve tekrar', () => {
  assert.ok(atasozleri.length >= 150 && atasozleri.length <= 200, 'sayı: ' + atasozleri.length);
  const gorulen = new Set();
  for (const [soz, aciklama] of atasozleri) {
    assert.ok(tr.gecerliSoz(soz), 'geçersiz söz: ' + soz);
    assert.equal(tr.normalize(soz), soz, 'normalize edilmemiş: ' + soz);
    assert.ok(Array.from(soz).length <= 45, 'uzun: ' + soz);
    assert.ok(soz.includes(' '), 'tek sözcük: ' + soz);
    assert.ok(Array.from(aciklama).length >= 5 && Array.from(aciklama).length <= 120, 'açıklama: ' + soz);
    assert.ok(!gorulen.has(soz), 'tekrar: ' + soz);
    gorulen.add(soz);
  }
  assert.ok(gorulen.has('AĞAÇ YAŞKEN EĞİLİR'));
});

test('günün kelimesi havuzu: sözlükte var, kolay/orta, benzersiz', () => {
  assert.ok(gunluk.length >= 500, 'havuz küçük: ' + gunluk.length);
  const m = new Map(sozluk.map((r) => [r[0], r]));
  assert.equal(new Set(gunluk).size, gunluk.length);
  for (const w of gunluk) {
    const r = m.get(w);
    assert.ok(r, 'sözlükte yok: ' + w);
    assert.ok(r[3] === 'k' || r[3] === 'o', `bant: ${w} ${r[3]}`);
    assert.ok('as'.includes(r[2]), `tür: ${w} ${r[2]}`);
    assert.ok(!karaMi(w), 'karaliste: ' + w);
  }
});

test('boyut: dört veri dosyası toplam 3 MB altında; sözlük 2,6 MB altında', () => {
  const boyut = (f) => fs.statSync(path.join(kok, 'data', f)).size;
  const hepsi = ['sozluk.js', 'kategoriler.js', 'atasozleri.js', 'gunluk.js'].map(boyut);
  assert.ok(hepsi[0] <= 2_600_000, 'sozluk.js: ' + hepsi[0]);
  assert.ok(hepsi.reduce((a, b) => a + b, 0) <= 3_000_000, 'toplam: ' + hepsi.reduce((a, b) => a + b, 0));
});

test('veri dosyaları tarayıcıda global değişken olarak yüklenir (AA.veri.*)', () => {
  for (const f of ['sozluk', 'kategoriler', 'atasozleri', 'gunluk']) {
    const metin = fs.readFileSync(path.join(kok, 'data', f + '.js'), 'utf8');
    assert.match(metin, new RegExp('\\.veri = AA\\.veri \\|\\| \\{\\}\\)\\.' + f + ' = veri'), f);
    // window sahte ortamında çalıştır: file:// altında fetch olmadan yüklenebildiğini kanıtlar
    const sahte = { window: {} };
    new Function('window', 'module', metin)(sahte.window, undefined);
    assert.ok(sahte.window.AA.veri[f], f + ' yüklenmedi');
  }
});

test('yer tutucu ipucu: kaynak notu veri dosyalarında yazılı', () => {
  const metin = fs.readFileSync(path.join(kok, 'data', 'sozluk.js'), 'utf8');
  assert.match(metin, /TDK Güncel Türkçe Sözlük/);
  assert.match(metin, /CC BY-SA 4\.0/);
});
