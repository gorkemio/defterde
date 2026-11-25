// node --test — scripts/suzgec.mjs: normalizasyon, süzgeçler, anlam, dondurulmuş sıra
import test from 'node:test';
import assert from 'node:assert/strict';
import { tr, maddeOzet, grupla, cevapKarari, tahminKarari, listeAyristir, anlamGizle, kisalt, siraGuncelle, karistir, anlamSec } from '../scripts/suzgec.mjs';

const madde = (madde, o = {}) => ({
  madde, ozel_mi: o.ozel ? '1' : '0', kac: o.kac || '0', taki: o.taki || null,
  anlamlarListe: (o.anlamlar || [{ anlam: o.anlam || 'Bir şey', etiket: o.etiket || ['isim'] }]).map((a, i) => ({
    anlam_sira: String(i + 1), fiil: a.fiil ? '1' : '0', anlam: a.anlam,
    ozelliklerListe: (a.etiket || []).map((e) => ({ tur: ['isim', 'sıfat', 'zarf', 'zamir'].includes(e) ? '3' : '4', tam_adi: e })),
  })),
});
const grup = (...m) => grupla(m.map(maddeOzet)).values().next().value;

test('normalizasyon: tr-TR büyük harf, şapka, NFC, I/İ ayrımı, kod noktasıyla uzunluk', () => {
  assert.equal(maddeOzet(madde('kâğıt')).kelime, 'KAĞIT');
  assert.equal(maddeOzet(madde('ılgın')).kelime, 'ILGIN');
  assert.equal(maddeOzet(madde('ilgin')).kelime, 'İLGİN');
  assert.notEqual(maddeOzet(madde('ırmak')).kelime, maddeOzet(madde('irmak')).kelime);
  assert.equal(maddeOzet(madde('şeker'.normalize('NFD'))).kelime, 'ŞEKER');
  assert.equal(maddeOzet(madde('şeker')).uzunluk, 5);
  assert.equal(maddeOzet(madde('âlem')).kelime, 'ALEM');
});

test('biçim süzgeci: boşluk, tire, kesme, rakam, büyük harf, özel ad, alfabe dışı', () => {
  assert.equal(maddeOzet(madde('ak ses')).neden, 'çok sözcüklü');
  assert.equal(maddeOzet(madde('alt-üst')).neden, 'tire, kesme, noktalama, rakam');
  assert.equal(maddeOzet(madde("d'ali")).neden, 'tire, kesme, noktalama, rakam');
  assert.equal(maddeOzet(madde('a4')).neden, 'tire, kesme, noktalama, rakam');
  assert.equal(maddeOzet(madde('TBMM')).neden, 'büyük harfli (kısaltma, simge)');
  assert.equal(maddeOzet(madde('Ankara', { ozel: true })).neden, 'özel ad');
  assert.equal(maddeOzet(madde('taxis')).neden, 'alfabe dışı harf');
  assert.ok(maddeOzet(madde('kalem')).gecerli);
});

test('cevap süzgeci: kaba, argo, eskimiş, söz türü, sıklık, konu, elle', () => {
  const siklik = new Map([['KALEM', 500], ['SEYRE', 25000], ['PİSLİ', 900], ['TANRI', 300]]);
  const ok = (g, o = {}) => cevapKarari(g, { siklik, ...o });
  assert.equal(ok(grup(madde('kalem'))).kabul, true);
  assert.equal(ok(grup(madde('kalem', { etiket: ['isim', 'argo'] }))).neden, 'argo/alay (ana anlam)');
  assert.equal(ok(grup(madde('kalem', { anlamlar: [{ anlam: 'x', etiket: ['isim'] }, { anlam: 'y', etiket: ['kaba konuşmada'] }] }))).neden, 'kaba/hakaret etiketli');
  assert.equal(ok(grup(madde('kalem', { etiket: ['isim', 'eskimiş'] }))).neden, 'eskimiş/ağız (ana anlam)');
  assert.equal(ok(grup(madde('kalem', { etiket: [] }))).neden, 'söz türü yok (çekim kalıntısı)');
  assert.match(ok(grup(madde('seyre'))).neden, /^seyrek/);
  assert.match(ok(grup(madde('ekmek'))).neden, /^seyrek/);                       // sıklıkta yok
  const L = listeAyristir('tanrı*\n[cevap]\nkalem\n');
  assert.equal(ok(grup(madde('tanrı')), { yasakli: L.hepsi }).neden, 'konu süzgeci');
  assert.equal(ok(grup(madde('kalem')), { cikar: L.cevap }).neden, 'elle çıkarıldı');
  assert.equal(ok(grup(madde('seyre')), { ekle: listeAyristir('[cevap]\nseyre').cevap }).kabul, true);   // elle ekleme sıklığı aşar
  // eş sesli: argo madde öbürünü götürmez; kaba madde götürür (izinli hariç)
  assert.equal(ok(grup(madde('kalem', { etiket: ['isim', 'argo'], kac: '1' }), madde('kalem', { kac: '2' }))).kabul, true);
  const iz = listeAyristir('köpek');
  const kopek = [madde('köpek', { anlamlar: [{ anlam: 'Hayvan', etiket: ['isim'] }, { anlam: 'Aşağılık kimse', etiket: ['hakaret yollu'] }] })];
  assert.equal(grupla(kopek.map(maddeOzet), iz.hepsi).get('KÖPEK').zehirli, false);
  assert.equal(grupla(kopek.map(maddeOzet)).get('KÖPEK').zehirli, true);
});

test('tahmin süzgeci gevşek: eskimiş ve argo kalır, kaba ve yasaklı çıkar', () => {
  assert.equal(tahminKarari(grup(madde('düver', { etiket: ['isim', 'eskimiş'] }))).kabul, true);
  assert.equal(tahminKarari(grup(madde('haspa', { etiket: ['isim', 'argo'] }))).kabul, true);
  assert.equal(tahminKarari(grup(madde('taşak', { etiket: ['isim', 'kaba konuşmada'] }))).kabul, false);
  assert.equal(tahminKarari(grup(madde('porno')), { yasakli: listeAyristir('porno*').hepsi }).kabul, false);
});

test('liste dosyası: bölümler, önek, yorum', () => {
  const L = listeAyristir('# yorum\nortak\n[cevap]\nkalem   # açıklama\nsilah*\n[tahmin]\nburda\n');
  assert.ok(L.cevap.has('KALEM') && L.cevap.has('SİLAHLI') && L.cevap.has('ORTAK'));
  assert.ok(!L.tahmin.has('KALEM') && L.tahmin.has('BURDA') && L.tahmin.has('ORTAK'));
  assert.deepEqual(L.tahmin.kelimeler.sort(), ['BURDA', 'ORTAK']);
});

test('anlam: 120 karakter, kelime sınırı, gönderme, kelimenin kendisi gizlenir', () => {
  const uzun = 'Çok uzun bir tanım '.repeat(12);
  const k = kisalt(uzun);
  assert.ok(Array.from(k).length <= 120 && k.endsWith('…'));
  assert.equal(anlamSec(madde('alaka', { anlam: '► ilgi' })).anlam, '“ilgi” sözcüğüyle aynı anlamda');
  assert.equal(anlamGizle('Kalem kutusu ve kalemlik', 'KALEM'), '… kutusu ve …');
  assert.equal(anlamGizle('Kitabı okumak', 'KİTAP', ['KİTAB']), '… okumak');
  assert.equal(anlamGizle('İstanbul ılık', 'ILIK'), 'İstanbul …');             // I/İ karışmaz
});

test('günlük sıra: tohumlu karışım sabit; dondurulmuş sıra çıkarılanın yerine yenisini koyar', () => {
  assert.deepEqual(karistir(['A', 'B', 'C', 'D'], 't'), karistir(['A', 'B', 'C', 'D'], 't'));
  const eski = ['KALEM', 'MASA1', 'DEFTER', 'SİLGİ'];
  const yeni = siraGuncelle(eski, ['KALEM', 'DEFTER', 'SİLGİ', 'KİTAP', 'KAĞIT'], 'tohum');
  assert.equal(yeni[0], 'KALEM');
  assert.ok(['KİTAP', 'KAĞIT'].includes(yeni[1]));                                  // MASA1'in yerine
  assert.equal(yeni[2], 'DEFTER');
  assert.equal(yeni[3], 'SİLGİ');
  assert.equal(yeni.length, 5);
  assert.deepEqual(new Set(yeni), new Set(['KALEM', 'DEFTER', 'SİLGİ', 'KİTAP', 'KAĞIT']));
});

test('tr modülü kit/tr.js: ğ ş ı İ ç ö ü harf sayılır', () => {
  assert.equal(tr.ALFABE.length, 29);
});
