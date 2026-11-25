// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { degerlendir, anlamSec, kisalt, gondermeMetni, turBul, puanla, bantBul, siraBul, sozlukKur, tr } from '../scripts/filtre.mjs';

/* ---------- TDK biçimli örnekler ---------- */

const ISIM = { tur: '3', tam_adi: 'isim', kisa_adi: 'a.' };
const SIFAT = { tur: '3', tam_adi: 'sıfat', kisa_adi: 'sf.' };
const ZARF = { tur: '3', tam_adi: 'zarf', kisa_adi: 'zf.' };
const EDAT = { tur: '3', tam_adi: 'edat', kisa_adi: 'e.' };
const NESNESIZ = { tur: '3', tam_adi: 'nesnesiz', kisa_adi: 'nsz.' };
const etiket = (ad) => ({ tur: '4', tam_adi: ad, kisa_adi: ad });
const ARGO = etiket('argo'), KABA = etiket('kaba konuşmada'), HAKARET = etiket('hakaret yollu');
const ESKI = etiket('eskimiş'), MECAZ = etiket('mecaz'), AGIZ = etiket('ağızlardan'), ALAY = etiket('alay yollu');

// a('metin', [etiketler], fiil) → anlam; sira otomatik
const a = (anlam, ozellikler, fiil = '0') => ({ anlam, fiil, ...(ozellikler ? { ozelliklerListe: ozellikler } : {}) });
function madde(ad, anlamListe, ek = {}) {
  return { madde: ad, kac: '0', ozel_mi: '0', anlamlarListe: anlamListe.map((x, i) => ({ anlam_sira: String(i + 1), ...x })), ...ek };
}

const kalem = madde('kalem', [a('Yazma, çizme vb. işlerde kullanılan çeşitli biçimlerde araç', [ISIM]), a('Resmî kuruluşlarda yazı işlerinin görüldüğü yer')]);

/* ---------- elenenler ---------- */

test('kabul: kalem → KALEM, tür isim', () => {
  const s = degerlendir(kalem);
  assert.ok(s.kabul);
  assert.equal(s.kayit.kelime, 'KALEM');
  assert.equal(s.kayit.tur, 'a');
  assert.equal(s.kayit.anlam, 'Yazma, çizme vb. işlerde kullanılan çeşitli biçimlerde araç');
  assert.equal(s.kayit.eski, false);
});

test('özel ad (ozel_mi = 1) elenir', () => {
  const m = madde('Türkçe', [a('Türklerin konuştuğu dil', [ISIM])], { ozel_mi: '1' });
  assert.deepEqual([degerlendir(m).kabul, degerlendir(m).neden], [false, 'özel ad']);
  assert.ok(degerlendir(m, { ozelAdIzin: true }).kabul);            // kategori listelerinde izinli
});

test('boşluklu madde elenir', () => {
  const m = madde('ağaç yaşken eğilir', [a('Eğitim erken yaşta verilir')]);
  assert.equal(degerlendir(m).neden, 'boşluk (çok sözcüklü)');
});

test('tire, kesme, noktalama, rakam elenir', () => {
  for (const ad of ['-lik', 'Kur\'an', 'canlar!', 'full-time', 'g8', 'a.ş']) {
    assert.equal(degerlendir(madde(ad, [a('x')])).neden, 'tire, kesme, noktalama, rakam', ad);
  }
});

test('büyük harfli madde (kısaltma, simge) elenir', () => {
  assert.equal(degerlendir(madde('TBMM', [a('Türkiye Büyük Millet Meclisi')])).neden, 'büyük harfli (kısaltma, simge)');
  assert.equal(degerlendir(madde('Dy', [a('Disporsiyum simgesi')])).neden, 'büyük harfli (kısaltma, simge)');
});

test('uzunluk: 2 harf ve 15 harf elenir, 3 ve 14 kalır', () => {
  assert.equal(degerlendir(madde('ab', [a('x')])).neden, 'uzunluk (3–14 dışı)');
  assert.equal(degerlendir(madde('a'.repeat(15), [a('x')])).neden, 'uzunluk (3–14 dışı)');
  assert.ok(degerlendir(madde('göz', [a('Görme organı', [ISIM])])).kabul);
  assert.ok(degerlendir(madde('a'.repeat(14), [a('x')])).kabul);
});

test('alfabe dışı: w, x, q ve aksanlı harfler elenir', () => {
  for (const ad of ['wushu', 'taksi'.replace('s', 'x'), 'quiz', 'café', 'ñandu']) {
    assert.equal(degerlendir(madde(ad, [a('x')])).neden, 'alfabe dışı harf (w, x, q, aksanlı)', ad);
  }
});

test('argo ana anlamsa kelime çıkar (gebermek, hödük)', () => {
  const gebermek = madde('gebermek', [a('Sevilmeyen bir kişi ölmek', [NESNESIZ, ARGO]), a('Bir kimseye aşırı ilgi duymak')]);
  const hoduk = madde('hödük', [a('Görgüsüz, kaba, anlayışı kıt (kimse)', [SIFAT, ARGO]), a('Korkak, ürkek (kimse)', [AGIZ])]);
  assert.equal(degerlendir(gebermek).neden, 'argo/alay (ana anlam)');
  assert.equal(degerlendir(hoduk).neden, 'argo/alay (ana anlam)');
});

test('alay yollu ana anlam da çıkar', () => {
  assert.equal(degerlendir(madde('zavallıcık', [a('Zavallı (kimse)', [SIFAT, ALAY])])).neden, 'argo/alay (ana anlam)');
});

test('argo ikincil anlamdaysa kelime kalır, o anlam gösterilmez (mangır, yürümek)', () => {
  const mangir = madde('mangır', [
    a('Bakırdan yapılmış, iki buçuk para değerinde sikke', [ISIM]),
    a('Nargile lülesine konulan bir yakacak'),
    a('► para', [ARGO]),
  ]);
  const s = degerlendir(mangir);
  assert.ok(s.kabul);
  assert.equal(s.kayit.anlam, 'Bakırdan yapılmış, iki buçuk para değerinde sikke');
  // ana anlam argo olmayan, ilk anlamı gönderme olan kelimede argo anlam tanım olamaz
  const yurumek = madde('yürümek', [a('Adım atarak ilerlemek, gitmek', [NESNESIZ], '1'), a('Gereği gibi yapılmak', [MECAZ]), a('► ölmek', [ARGO])]);
  assert.ok(degerlendir(yurumek).kabul);
  assert.equal(anlamSec(madde('x', [a('► ölmek', [ARGO]), a('Gerçek anlam')])).anlam, 'Gerçek anlam');
});

test('herhangi bir anlamda kaba ya da hakaret etiketi kelimeyi çıkarır', () => {
  const m1 = madde('kelime', [a('Düzgün anlam', [ISIM]), a('Başka bir anlam', [KABA])]);
  const m2 = madde('sözcük', [a('Düzgün anlam', [ISIM]), a('Üçüncü', null), a('Hakaret', [HAKARET])]);
  assert.equal(degerlendir(m1).neden, 'kaba/hakaret etiketli');
  assert.equal(degerlendir(m2).neden, 'kaba/hakaret etiketli');
});

test('karaliste', () => {
  assert.equal(degerlendir(kalem, { karaliste: new Set(['KALEM']) }).neden, 'karaliste');
});

test('tanım yok: anlamsız madde ya da yalnız argo anlamlı', () => {
  assert.equal(degerlendir(madde('boşluk', [])).neden, 'tanım yok');
  assert.equal(degerlendir(madde('kuşluk', [a('x', [KABA])])).neden, 'kaba/hakaret etiketli');
});

/* ---------- gönderme (►) ---------- */

test('yalnız ► göndermesi olan madde: kabul ama gonderme işaretli', () => {
  const m = madde('mektep', [a('► okul', [ISIM, ESKI])]);
  const s = degerlendir(m);
  assert.ok(s.kabul);
  assert.equal(s.kayit.gonderme, true);
  assert.equal(s.kayit.anlam, '“okul” sözcüğüyle aynı anlamda');
  assert.equal(s.kayit.eski, true);
});

test('gondermeMetni: romen numara atılır, karmaşık gönderme kullanılmaz', () => {
  assert.equal(gondermeMetni('► kaynak (I)'), '“kaynak” sözcüğüyle aynı anlamda');
  assert.equal(gondermeMetni('► alçalma, met (I) karşıtı'), null);
  assert.equal(gondermeMetni('► (kadın) oyuncu'), null);
  assert.equal(gondermeMetni('►'), null);
});

test('anlamSec: gerçek tanım göndermeden önce gelir', () => {
  const m = madde('göz', [a('► oda', [ISIM]), a('Görme organı')]);
  assert.deepEqual(anlamSec(m), { anlam: 'Görme organı', gonderme: false });
});

/* ---------- tür ve eskimiş ---------- */

test('turBul', () => {
  assert.equal(turBul(madde('a', [a('x', [ISIM])])), 'a');
  assert.equal(turBul(madde('a', [a('x', [SIFAT])])), 's');
  assert.equal(turBul(madde('a', [a('x', [ZARF])])), 'z');
  assert.equal(turBul(madde('a', [a('x', [EDAT])])), 'e');
  assert.equal(turBul(madde('a', [a('x', [NESNESIZ])])), 'f');
  assert.equal(turBul(madde('gelmek', [a('Ulaşmak', [{ tur: '3', tam_adi: '-e' }], '1')])), 'f');
  assert.equal(turBul(madde('a', [a('x', null), a('y', [SIFAT])])), 's');       // ilk bulunan etiket
  assert.equal(turBul(madde('a', [a('x')])), '?');                              // hiç etiket yoksa türü bilinmiyor
});

test('eskimiş ve ağızlardan yalnız ana anlamda "eski" sayılır', () => {
  assert.equal(degerlendir(madde('mektep', [a('Okul', [ISIM, ESKI])])).kayit.eski, true);
  assert.equal(degerlendir(madde('abdal', [a('Ermiş', [ISIM, AGIZ])])).kayit.eski, true);
  assert.equal(degerlendir(madde('kitap', [a('Basılı eser', [ISIM]), a('Eski anlam', [ESKI])])).kayit.eski, false);
});

/* ---------- tanım kısaltma ---------- */

test('kisalt: 120 karakter sınırı, kelime sınırı, açık parantez', () => {
  assert.equal(kisalt('Kısa tanım'), 'Kısa tanım');
  assert.equal(kisalt('Kısa tanım:'), 'Kısa tanım');
  const uzun = 'Bir iki üç dört beş altı yedi sekiz dokuz on bir iki üç dört beş altı yedi sekiz dokuz on bir iki üç dört beş altı yedi sekiz dokuz on';
  const k = kisalt(uzun);
  assert.ok(Array.from(k).length <= 120, String(Array.from(k).length));
  assert.ok(k.endsWith('…'));
  assert.ok(!k.slice(0, -1).endsWith(' '));
  assert.ok(uzun.startsWith(k.slice(0, -1)));                                   // kelime ortasından kesilmez
  const p = kisalt('x'.repeat(40) + ' ' + 'y'.repeat(60) + ' (Pyrus malus subsp. mitis ve başka bir uzun bilimsel ad burada devam eder)');
  assert.ok(!p.includes('('), p);
});

test('kisalt: etiket benzeri biçimlendirme temizlenir', () => {
  assert.equal(kisalt('Bir <i>şey</i>'), 'Bir şey');
});

/* ---------- puan, bant, sıra ---------- */

test('puanla: uzunluk, farklı harf, nadir harf ve sıklık bandı', () => {
  // KEDİ: 2·4 + 4 farklı + 0 nadir + sıra≤5000 → 0
  assert.equal(puanla('kedi', 100), 12);
  // AĞAÇ: 2·4 + 3 farklı (A Ğ Ç) + (Ğ3 + Ç2) + 0
  assert.equal(puanla('ağaç', 100), 8 + 3 + 5);
  assert.equal(puanla('kedi', 10000), 12 + 4);
  assert.equal(puanla('kedi', 30000), 12 + 8);
  assert.equal(puanla('kedi', null), 12 + 12);
});

test('bantBul: kolay çocuk listesinden, orta sıklıktan', () => {
  const b = (kelime, sira, tur = 'a', eski = false, cocuk = false) => bantBul({ kelime, sira, tur, eski, cocuk });
  // sıklık tek başına kolay yapmaz
  assert.equal(b('tahliye', 900), 'o');
  assert.equal(b('kedi', 800), 'o');
  // çocuk listesinde + 4–7 harf + isim/sıfat/fiil → kolay (sıklık olmasa da)
  assert.equal(b('kedi', 800, 'a', false, true), 'k');
  assert.equal(b('zürafa', null, 'a', false, true), 'k');
  assert.equal(b('zürafa', 90000, 'a', false, true), 'k');
  assert.equal(b('göz', 100, 'a', false, true), 'o');          // 3 harf: kolay değil
  assert.equal(b('kütüphane', 100, 'a', false, true), 'o');    // 9 harf: kolay değil
  assert.equal(b('yediyedi', 100, 'a', false, true), 'o');     // 8 harf: kolay değil (4–7)
  assert.equal(b('okula', 100, 'z', false, true), 'o');        // zarf kolay olamaz
  assert.equal(b('koşmak', 3000, 'f', false, true), 'k');
  assert.equal(b('mektep', 2000, 'a', true, true), 'z');       // eskimiş her zaman zor
  assert.equal(b('benden', 255, '?', false, true), 'z');       // türü etiketsiz her zaman zor
  // orta: ilk 20 bin, 3–9 harf
  assert.equal(b('mandalina', 20000), 'o');
  assert.equal(b('mandalina', 20001), 'z');
  assert.equal(b('göz', 100), 'o');
  assert.equal(b('sekizsekiz', 100), 'z');                     // 10 harf
  assert.equal(b('dokuzdokuz', 100), 'z');
  assert.equal(b('kedi', null), 'z');                          // sıklıkta yok, çocuk listesinde de değil
});

test('siraBul: fiilde mastar yerine kök sıklığı da sayılır', () => {
  const sk = new Map([['GEL', 90], ['GELMEK', 4000], ['KİTAP', 500]]);
  assert.equal(siraBul('KİTAP', 'a', sk), 500);
  assert.equal(siraBul('GELMEK', 'f', sk), 90);
  assert.equal(siraBul('GELMEK', 'a', sk), 4000);           // fiil değilse kök aranmaz
  assert.equal(siraBul('YAZMAK', 'f', sk), null);
  assert.equal(siraBul('KÂĞIT', 'a', sk), null);
});

/* ---------- tüm sözlük ---------- */

test('sozlukKur: eşleştirme, eş sesli birleştirme ve sayımlar', () => {
  const maddeler = [
    kalem,
    madde('Türkçe', [a('Dil', [ISIM])], { ozel_mi: '1' }),
    madde('ağaç yaşken eğilir', [a('x')]),
    madde('gebermek', [a('Ölmek', [NESNESIZ, ARGO])]),
    madde('kat', [a('Gökte görünen', [ISIM])], { kac: '2' }),
    madde('kat', [a('Şaşkınlık bildirir', [{ tur: '3', tam_adi: 'ünlem' }])], { kac: '1' }),
    madde('mektep', [a('► okul', [ISIM, ESKI])]),                  // sıklıkta yok → çıkar
    madde('okul', [a('Eğitim yeri', [ISIM])]),
  ];
  const siklik = new Map([['KALEM', 3000], ['KAT', 120], ['OKUL', 400]]);
  const r = sozlukKur(maddeler, { siklik, cocuk: new Set(['KALEM']) });
  assert.deepEqual(r.kayitlar.map((k) => k.kelime), ['KALEM', 'KAT', 'OKUL']);
  const ay = r.kayitlar.find((k) => k.kelime === 'KAT');
  assert.equal(ay.tur, 'a');                                      // isim olan eş sesli öne geçer
  assert.equal(ay.anlam, 'Gökte görünen');
  assert.equal(r.birlesen, 1);
  assert.equal(r.elenen['özel ad'], 1);
  assert.equal(r.elenen['boşluk (çok sözcüklü)'], 1);
  assert.equal(r.elenen['argo/alay (ana anlam)'], 1);
  assert.equal(r.elenen['yalnız ► göndermesi var, sıklıkta yok'], 1);
  const kalemK = r.kayitlar.find((k) => k.kelime === 'KALEM');
  assert.equal(kalemK.bant, 'k');                                 // çocuk listesinde, 5 harf, isim
  assert.equal(r.kayitlar.find((k) => k.kelime === 'OKUL').bant, 'o');   // listede değil: sıklıktan orta
  assert.equal(kalemK.sira, 3000);
  assert.equal(kalemK.puan, puanla('KALEM', 3000));
});

test('sozlukKur: kaba/hakaret etiketli eş sesli kardeşi aynı yazılışlı kelimeyi de çıkarır', () => {
  const maddeler = [
    madde('poz', [a('Fotoğraf için duruş', [ISIM])], { kac: '1' }),
    madde('poz', [a('Kaba bir anlam', [ISIM, KABA])], { kac: '2' }),
    madde('sakın', [a('Kaçınma uyarısı', [ISIM])]),
  ];
  const r = sozlukKur(maddeler, { siklik: new Map([['POZ', 800], ['SAKIN', 800]]) });
  assert.deepEqual(r.kayitlar.map((k) => k.kelime), ['SAKIN']);
  assert.equal(r.elenen['kaba/hakaret etiketli'], 1);
  assert.equal(r.elenen['eş sesli kardeşi kaba/hakaret'], 1);
});

test('sozlukKur: argo ana anlamlı eş sesli yalnız kendini eler (zil: okul zili kalır)', () => {
  const maddeler = [
    madde('zil', [a('► parasız', [SIFAT, ARGO])], { kac: '1' }),
    madde('zil', [a('Çalınca ses veren araç', [ISIM])], { kac: '2' }),
    madde('mama', [a('► abla', [ISIM, ARGO])], { kac: '1' }),
    madde('mama', [a('Bebeklerin yediği yiyecek', [ISIM])], { kac: '2' }),
  ];
  const r = sozlukKur(maddeler, { siklik: new Map([['ZİL', 700], ['MAMA', 900]]) });
  assert.deepEqual(r.kayitlar.map((k) => k.kelime).sort(), ['MAMA', 'ZİL']);
  assert.equal(r.kayitlar.find((k) => k.kelime === 'ZİL').anlam, 'Çalınca ses veren araç');
  assert.equal(r.elenen['argo/alay (ana anlam)'], 2);
});

test('izinli: ikincil anlamı kaba olan masum kelime kalır, o anlam gizlenir (köpek)', () => {
  const kopek = madde('köpek', [a('Köpekgillerden bir hayvan', [ISIM]), a('Aşağılık kimse', [HAKARET])]);
  assert.equal(degerlendir(kopek).neden, 'kaba/hakaret etiketli');
  const s = degerlendir(kopek, { izinli: new Set(['KÖPEK']) });
  assert.ok(s.kabul);
  assert.equal(s.kayit.anlam, 'Köpekgillerden bir hayvan');
  assert.equal(s.kayit.gizli, 1);
  // izin ana anlamı kaba olan kelimeye yetmez ama listeye zaten yazılmaz; yine de kabul edilir diye bir güvence verilmez
  const r = sozlukKur([kopek], { izinli: new Set(['KÖPEK']), siklik: new Map([['KÖPEK', 700]]) });
  assert.deepEqual(r.kayitlar.map((k) => k.kelime), ['KÖPEK']);
});

test('sozlukKur: ölçüt I/İ ayrımını korur', () => {
  const r = sozlukKur([madde('ılık', [a('Sıcak ile soğuk arası', [SIFAT])]), madde('ilik', [a('Kemik içi dokusu', [ISIM])])]);
  assert.deepEqual(r.kayitlar.map((k) => k.kelime).sort(), ['ILIK', 'İLİK']);
});

test('sozlukKur: şapkalı madde şapkasız kelimeye döner', () => {
  const r = sozlukKur([madde('kâğıt', [a('Yazı malzemesi', [ISIM])])]);
  assert.equal(r.kayitlar[0].kelime, 'KAĞIT');
  assert.equal(tr.normalize('kâğıt'), r.kayitlar[0].kelime);
});

/* ---------- tanım temizliği ve seçimi ---------- */

test('kisalt: ";" sonrası eş anlamlı kuyruk, karşıt notu ve Latince ad atılır', () => {
  assert.equal(kisalt('Hızlı yapılan; çabuk, tez (I), ivedi, becit, müstacel'), 'Hızlı yapılan');
  assert.equal(kisalt('Açılmış, kapalı olmayan, kapalı karşıtı'), 'Açılmış, kapalı olmayan');
  assert.equal(kisalt('Gülgillerden, çiçekleri pembe veya beyaz bir ağaç (Pyrus malus)'), 'Çiçekleri pembe veya beyaz bir ağaç');   // sınıf öneki de gider
  assert.equal(kisalt('Kedigillerden, memeli, evcil, küçük hayvan'), 'Memeli, evcil, küçük hayvan');
  assert.equal(kisalt('Omurgalılardan, suda yaşayan, solungaçla nefes alan hayvan'), 'Suda yaşayan, solungaçla nefes alan hayvan');
  assert.equal(kisalt('Bakmaktan, çok sevinç duyan kimse'), 'Bakmaktan, çok sevinç duyan kimse');          // "…ler/…lar+den" değilse kalır
  assert.equal(kisalt('Erkek kişi; herif'), 'Erkek kişi');
  assert.equal(kisalt('Ak; beyaz'), 'Ak; beyaz');                              // çok kısa öncül (< 10 karakter) kesilmez
  assert.equal(kisalt('Bir şey (kimse)'), 'Bir şey (kimse)');                  // Latince olmayan parantez kalır
});

test('anlamSec: teknik ve "…mak işi" kalıbındaki ilk anlamlar atlanır', () => {
  const KIMYA = { tur: '1', tam_adi: 'kimya' }, MUZIK = { tur: '1', tam_adi: 'müzik' }, HAYVAN = { tur: '1', tam_adi: 'hayvan bilimi' };
  const amin = madde('amin', [a('Amonyaktaki hidrojen yerine hidrokarbonlu kökler geçmesiyle oluşan bileşik', [KIMYA, ISIM]), a('Dua sonunda söylenen "öyle olsun" anlamında söz')]);
  assert.equal(anlamSec(amin).anlam, 'Dua sonunda söylenen "öyle olsun" anlamında söz');
  const bekar = madde('bekar', [a('Bir sesi yarım ton kalınlaştıran işaret', [MUZIK]), a('Evli olmayan kimse')]);
  assert.equal(anlamSec(bekar).anlam, 'Evli olmayan kimse');
  const bakma = madde('bakma', [a('Bakmak işi'), a('Dikkatle gözlemleme')]);
  assert.equal(anlamSec(bakma).anlam, 'Dikkatle gözlemleme');
  // somut dünya etiketi (hayvan bilimi) teknik sayılmaz: ilk anlam kalır
  const kus = madde('kuş', [a('Yumurtlayan omurgalılardan, akciğerli, sıcakkanlı, vücudu tüylerle kaplı hayvan', [HAYVAN, ISIM]), a('Elbiselerde kol altına eklenen üçgen kumaş parçası')]);
  assert.match(anlamSec(kus).anlam, /^Yumurtlayan/);
  // hepsi teknikse ilk anlam
  const x = madde('x', [a('Birinci', [KIMYA]), a('İkinci', [KIMYA])]);
  assert.equal(anlamSec(x).anlam, 'Birinci');
  // kısır anlam tek başınaysa yine kullanılır
  assert.equal(anlamSec(madde('y', [a('Gitmek işi')])).anlam, 'Gitmek işi');
});

test('tanimlar: elle yazılmış tanım TDK tanımının yerine geçer (misafir: gözdeki leke değil)', () => {
  const m = madde('misafir', [a('Gözün saydam tabakasında oluşan beyaz leke', [ISIM])]);
  const r = sozlukKur([m], { siklik: new Map([['MİSAFİR', 900]]), tanimlar: new Map([['MİSAFİR', 'Ziyarete gelen kimse; konuk']]) });
  assert.equal(r.kayitlar[0].anlam, 'Ziyarete gelen kimse; konuk');
  assert.equal(r.kayitlar[0].gonderme, false);
});
