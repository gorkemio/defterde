// kit/tr.js — Türkçe harf işleme. DOM'a dokunmaz; tarayıcıda Kit.tr, node'da module.exports.
// adamasmaca/tr.js'ten taşındı (aynı API) ve üç ekleme yapıldı: INDEKS/indeks, kodla (harf kodları), kaydir (basit kodlama).
//
// KURAL: büyütme/küçültme yalnız 'tr-TR' yereliyle yapılır (i → İ, ı → I, I → ı, İ → i).
// Yerelsiz çevirme bu kit'i kullanan oyunlarda yasaktır; oyunun test/tr.test.js'i kaynakları tarayıp denetler.
(function () {
  'use strict';

  const YEREL = 'tr-TR';

  // 29 harflik Türkçe alfabe. Q, W, X yok: bunlar yok sayılır.
  const ALFABE = Array.from('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.normalize('NFC'));
  const KUME = new Set(ALFABE);
  const INDEKS = new Map(ALFABE.map((h, i) => [h, i]));    // harf → 0–28 (alfabe sırası)

  // Zorluk puanında nadir harf ağırlıkları (ğ, j, f, ö, ü, ç, ş, ı ağırlıklı).
  const NADIR = { J: 4, Ğ: 3, F: 2, Ö: 2, Ü: 2, Ç: 2, Ş: 2, I: 2, V: 1, Z: 1, H: 1, P: 1 };

  const SAPKA = { â: 'a', î: 'i', û: 'u', Â: 'A', Î: 'İ', Û: 'U' };

  const buyut = (s) => String(s).normalize('NFC').toLocaleUpperCase(YEREL);
  const kucult = (s) => String(s).normalize('NFC').toLocaleLowerCase(YEREL);
  const sapkaSil = (s) => String(s).normalize('NFC').replace(/[âîûÂÎÛ]/g, (c) => SAPKA[c]);

  // Oyunun ve gösterimin kullandığı biçim: şapkasız, büyük harf, tek boşluk. kâğıt → KAĞIT, istanbul → İSTANBUL.
  const normalize = (s) => buyut(sapkaSil(s)).replace(/\s+/g, ' ').trim();

  // Normalize edilmiş metnin harfleri (boşluk dahil). NFC'de her Türkçe harf tek kod noktasıdır.
  const harfler = (s) => Array.from(normalize(s));

  // Tek karakter 29 harften biri mi? (Q, W, X, rakam, noktalama → false)
  function harfMi(ch) {
    if (typeof ch !== 'string' || Array.from(ch).length !== 1) return false;
    return KUME.has(normalize(ch));
  }

  // Fiziksel klavyeden gelen KeyboardEvent.key → oyun harfi ya da null.
  // 'i' → İ, 'I' ve 'ı' → I. Dizilimden bağımsız: yalnız üretilen karaktere bakılır.
  function tusHarf(key) {
    if (typeof key !== 'string' || Array.from(key).length !== 1) return null;   // 'Enter', 'Shift', 'Dead' ...
    const h = normalize(key);
    return KUME.has(h) ? h : null;
  }

  // Bir harfin kelimedeki tüm konumları (0'dan başlayan indeksler).
  function konumlar(kelime, harf) {
    const k = harfler(kelime), h = normalize(harf), liste = [];
    k.forEach((c, i) => { if (c === h) liste.push(i); });
    return liste;
  }

  // Tek kelime: 3–14 harf (sınırlar verilebilir), hepsi 29 harften biri, boşluk yok.
  function gecerliKelime(s, enAz = 3, enCok = 14) {
    if (typeof s !== 'string') return false;
    const h = harfler(s);
    return h.length >= enAz && h.length <= enCok && h.every((c) => KUME.has(c));
  }

  // Atasözü/deyim: tek boşlukla ayrılmış kelimeler, noktalama yok, boşluklarla birlikte en çok 45 karakter.
  function gecerliSoz(s, enCok = 45) {
    if (typeof s !== 'string') return false;
    const n = normalize(s);
    if (!n || Array.from(n).length > enCok) return false;
    return n.split(' ').every((p) => p.length > 0 && Array.from(p).every((c) => KUME.has(c)));
  }

  const farkliHarf = (kelime) => new Set(harfler(kelime)).size;
  const nadirPuan = (kelime) => harfler(kelime).reduce((t, h) => t + (NADIR[h] || 0), 0);

  /* ---------- ekler (Beş Harf, 20 Ekim 2026) ---------- */

  // Harfin alfabe sırası (0–28) ya da -1.
  const indeks = (h) => (INDEKS.has(h) ? INDEKS.get(h) : -1);

  // Kelime → harf kodları (Uint8Array). Normalize eder; alfabe dışı harf ya da boşluk varsa hata fırlatır.
  function kodla(kelime) {
    const h = harfler(kelime);
    const k = new Uint8Array(h.length);
    h.forEach((c, i) => {
      const x = indeks(c);
      if (x < 0) throw new Error('Alfabe dışı harf: ' + JSON.stringify(c) + ' (' + kelime + ')');
      k[i] = x;
    });
    return k;
  }

  // Basit kodlama: metindeki n. harf 29'luk alfabe halkasında 1 + (anahtar + 11n) mod 28 adım kaydırılır; harf olmayan
  // karakterler (satır sonu) aynen kalır. yon = -1 geri çevirir. Gizlilik değil: kaynak koda bakan kazara okumasın diye.
  function kaydir(metin, yon = 1, anahtar = 7) {
    let n = 0, cikti = '';
    for (const c of String(metin)) {
      const x = indeks(c);
      if (x < 0) { cikti += c; continue; }
      const adim = 1 + ((anahtar + 11 * n) % 28);
      cikti += ALFABE[(((x + yon * adim) % 29) + 29) % 29];
      n++;
    }
    return cikti;
  }

  const tr = {
    YEREL, ALFABE, NADIR, INDEKS,
    buyut, kucult, sapkaSil, normalize, harfler,
    harfMi, tusHarf, konumlar, gecerliKelime, gecerliSoz, farkliHarf, nadirPuan,
    indeks, kodla, kaydir,
  };

  if (typeof window !== 'undefined') (window.Kit = window.Kit || {}).tr = tr;
  if (typeof module !== 'undefined' && module.exports) module.exports = tr;
})();
