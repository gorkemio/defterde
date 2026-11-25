// secici.js — kelime seçimi, zorluk bantları, tekrar kontrolü, günün kelimesi. DOM'a dokunmaz.
// Tarayıcıda AA.secici, node'da module.exports.
//
// veri = { sozluk: [[kelime, anlam, tür, bant, puan, sıra]], kategoriler: { ad: [[kelime, ipucu, bant, puan]] },
//          atasozleri: [[söz, açıklama]], gunluk: [kelime] }   (data/*.js dosyalarından; AA.veri)
// Aday = { kelime, anlam, kategori, bant }  bant: 'k' | 'o' | 'z'
(function () {
  'use strict';

  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('./config.js') : window.AA.config;

  const S = {};
  const BANT = { kolay: 'k', orta: 'o', zor: 'z' };
  const KOMSU = { k: ['o'], o: ['k', 'z'], z: ['o'] };       // bir bantta aday azsa eklenecek bantlar, önce yakın olan

  /* ---------- küçük yardımcılar ---------- */

  // FNV-1a: aynı metinden her zaman aynı sayı (günün kelimesi için)
  S.karma = function (metin) {
    let h = 2166136261;
    for (let i = 0; i < metin.length; i++) { h ^= metin.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Tohumlu rastgele sayı üreteci (mulberry32): testlerde aynı tohum aynı diziyi verir.
  S.rng = function (tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const iki = (n) => String(n).padStart(2, '0');
  // Yerel saate göre yyyy-mm-dd (UTC değil: gece yarısı gün değişsin)
  S.yerelTarih = (d = new Date()) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;

  const gunNo = (s) => { const [y, m, g] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, g) / 86400000); };
  S.gunFarki = (a, b) => gunNo(b) - gunNo(a);

  /* ---------- adaylar ---------- */

  const satirAday = (kategori) => ([kelime, anlam, bant, puan]) => ({ kelime, anlam, kategori, bant, puan });

  // kategori: 'Genel' | kategori adı | 'Atasözleri'.  zorluk: 'kolay' | 'orta' | 'zor' | 'hepsi'.
  // Genel = sözlük + kategori listelerindeki kelimeler (sözlükte olmayanlar: şehir, ülke gibi özel adlar).
  // Bantta 15'ten az aday varsa komşu bant eklenir; atasözlerinde zorluk yalnız çizgi hakkını belirler.
  S.adaylar = function (veri, { kategori = 'Genel', zorluk = 'orta' } = {}) {
    if (kategori === 'Atasözleri') return veri.atasozleri.map(([kelime, anlam]) => ({ kelime, anlam, kategori, bant: 'o' }));

    let hepsi;
    if (kategori === 'Genel') {
      hepsi = veri.sozluk.map(([kelime, anlam, , bant, puan]) => ({ kelime, anlam, kategori: 'Genel', bant, puan }));
      const var_ = new Set(hepsi.map((a) => a.kelime));
      for (const [ad, satirlar] of Object.entries(veri.kategoriler)) {
        for (const a of satirlar.map(satirAday('Genel'))) if (!var_.has(a.kelime)) { var_.add(a.kelime); hepsi.push(a); }
      }
    } else {
      const satirlar = veri.kategoriler[kategori];
      if (!satirlar) throw new RangeError('Bilinmeyen kategori: ' + kategori);
      hepsi = satirlar.map(satirAday(kategori));
    }
    if (zorluk === 'hepsi') return hepsi;

    const bant = BANT[zorluk];
    if (!bant) throw new RangeError('Bilinmeyen zorluk: ' + zorluk);
    const bantlar = [bant];
    let liste = hepsi.filter((a) => a.bant === bant);
    for (const k of KOMSU[bant]) {
      if (liste.length >= C.aday.enAz) break;
      bantlar.push(k);
      liste = hepsi.filter((a) => bantlar.includes(a.bant));
    }
    return liste;
  };

  // Hileci Hoca'nın kelime havuzu. Kategori seçiliyse tüm bantlar; Genel'de yalnız kolay ve orta bant (zor banttaki ~28 bin kelimelik
  // nadir sözcük yığını itirafı anlamsız yapardı). Kolaydan zora sıralı: itirafta ilk 10 kelime tanıdık kelimeler olur.
  S.hileciHavuzu = function (veri, kategori = 'Genel') {
    if (kategori === 'Atasözleri') throw new RangeError('Hileci Hoca atasözüyle oynanmaz');
    let liste;
    if (kategori === 'Genel') {
      const gorulen = new Set();
      liste = [...S.adaylar(veri, { kategori, zorluk: 'kolay' }), ...S.adaylar(veri, { kategori, zorluk: 'orta' })].filter((a) => (gorulen.has(a.kelime) ? false : gorulen.add(a.kelime)));
      liste = liste.filter((a) => a.bant !== 'z');
    } else liste = S.adaylar(veri, { kategori, zorluk: 'hepsi' });
    return liste.slice().sort((a, b) => a.puan - b.puan || (a.kelime < b.kelime ? -1 : 1));
  };

  /* ---------- seçim ve tekrar kontrolü ---------- */

  // Son gecmis kelimede olmayanlardan rastgele biri; hepsi kullanıldıysa geçmiş yok sayılır.
  S.sec = function (adaylar, gecmis, rng) {
    if (!adaylar.length) throw new Error('Aday yok');
    const yasak = new Set(gecmis || []);
    const uygun = adaylar.filter((a) => !yasak.has(a.kelime));
    const havuz = uygun.length ? uygun : adaylar;
    return havuz[Math.floor((rng || Math.random)() * havuz.length)];
  };

  // Geçmişe kelime ekler (varsa sona taşır); yalnız son N kelime tutulur. Yeni dizi döner (localStorage'a yazılır).
  S.gecmisEkle = function (gecmis, kelime, enCok = C.gecmisUzunlugu) {
    return (gecmis || []).filter((k) => k !== kelime).concat(kelime).slice(-enCok);
  };

  /* ---------- günün kelimesi ---------- */

  // Aynı tarih herkes için aynı kelime. no: başlangıç gününde 1. havuz dondurulmuştur (data/gunluk.js).
  S.gununKelimesi = function (havuz, tarih, baslangic = C.gunlukBaslangic) {
    if (!havuz.length) throw new Error('Günlük havuz boş');
    return { kelime: havuz[S.karma('gun|' + tarih) % havuz.length], no: S.gunFarki(baslangic, tarih) + 1, tarih };
  };

  // Günün kelimesinin tanımı ve kategorisi (paylaşım metni için).
  S.gununAdayi = function (veri, tarih, baslangic) {
    const g = S.gununKelimesi(veri.gunluk, tarih, baslangic);
    const satir = veri.sozluk.find((r) => r[0] === g.kelime);
    return { ...g, anlam: satir ? satir[1] : '', kategori: S.kategorisi(veri, g.kelime) };
  };

  // Kelimenin ait olduğu ilk kategori (config sırasıyla); hiçbirinde yoksa 'Genel'.
  S.kategorisi = function (veri, kelime) {
    for (const ad of C.kategoriler) {
      if (ad === 'Genel' || ad === 'Atasözleri') continue;
      if ((veri.kategoriler[ad] || []).some((r) => r[0] === kelime)) return ad;
    }
    return 'Genel';
  };

  /* ---------- maraton ---------- */

  // n: 1'den başlayan kelime sırası
  S.maratonZorluk = function (n) {
    return n <= C.maraton.kolayBitis ? 'kolay' : n <= C.maraton.ortaBitis ? 'orta' : 'zor';
  };

  if (typeof window !== 'undefined') (window.AA = window.AA || {}).secici = S;
  if (node) module.exports = S;
})();
